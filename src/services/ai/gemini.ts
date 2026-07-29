/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Google Gemini adapter.
 *
 * THE ONLY FILE IN THE APPLICATION THAT KNOWS GEMINI EXISTS. It speaks the
 * Gemini REST wire format on one side and the provider-neutral `AIProvider`
 * contract on the other. Deleting this file and pointing `provider.ts` at a
 * different adapter is the entire cost of switching vendors.
 *
 * Uses plain `fetch` rather than an SDK: no dependency, and the request body
 * stays a plain object, which is exactly what makes the proxy handoff trivial.
 */

import type { AIConfig } from './config';
import { ImportError } from './errors';
import type { AIResumeResponse } from './schema';
import type { AIProvider, AnalyzeRequest, AnalyzeResult } from './types';

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

/** MIME types Gemini reads natively as documents (vision + text layer). */
const NATIVE_MIME_TYPES = ['application/pdf'] as const;

/* ------------------------------------------------------------------ */
/* Wire types (Gemini-specific — nothing outside this file uses them)  */
/* ------------------------------------------------------------------ */

interface GeminiPart {
  text?: string;
  inlineData?: { mimeType: string; data: string };
  /** Reasoning-summary parts on thinking models — never part of the answer. */
  thought?: boolean;
}

interface GeminiResponse {
  candidates?: {
    content?: { parts?: GeminiPart[] };
    finishReason?: string;
  }[];
  promptFeedback?: { blockReason?: string; blockReasonMessage?: string };
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
}

/* ------------------------------------------------------------------ */
/* Error mapping                                                       */
/* ------------------------------------------------------------------ */

/** HTTP status + payload → typed ImportError. */
function mapHttpError(status: number, body: string, retryAfter?: string): ImportError {
  const detail = body.slice(0, 500);
  const retryAfterSeconds = retryAfter ? Number.parseInt(retryAfter, 10) || undefined : undefined;

  if (status === 400 && /api[_ ]?key/i.test(body)) {
    return new ImportError('INVALID_API_KEY', { detail });
  }
  if (status === 401 || status === 403) {
    return new ImportError('INVALID_API_KEY', { detail });
  }
  if (status === 429) {
    // Gemini reports both per-minute throttling and hard quota exhaustion as
    // 429; the body distinguishes them and the two need different guidance.
    const exhausted = /quota|billing|exceeded your current quota/i.test(body);
    return new ImportError(exhausted ? 'QUOTA_EXCEEDED' : 'RATE_LIMITED', { detail, retryAfterSeconds });
  }
  if (status === 404) {
    return new ImportError('PROVIDER_UNAVAILABLE', {
      message: 'The configured AI model was not found. Check VITE_GEMINI_MODEL, or leave it unset to use the default.',
      detail,
      retryable: false,
    });
  }
  if (status >= 500) {
    return new ImportError('PROVIDER_UNAVAILABLE', { detail, retryAfterSeconds });
  }
  return new ImportError('UNKNOWN', { detail: `HTTP ${status}: ${detail}` });
}

/** Extract the JSON text from a candidate, or throw a typed error. */
function extractJsonText(response: GeminiResponse): string {
  const block = response.promptFeedback?.blockReason;
  if (block) {
    throw new ImportError('SAFETY_BLOCKED', {
      detail: response.promptFeedback?.blockReasonMessage || block,
      retryable: false,
    });
  }

  const candidate = response.candidates?.[0];
  if (!candidate) {
    throw new ImportError('NO_CONTENT_FOUND', { detail: 'The model returned no candidates.' });
  }

  if (candidate.finishReason === 'SAFETY' || candidate.finishReason === 'PROHIBITED_CONTENT') {
    throw new ImportError('SAFETY_BLOCKED', { detail: candidate.finishReason, retryable: false });
  }
  if (candidate.finishReason === 'MAX_TOKENS') {
    throw new ImportError('MALFORMED_RESPONSE', {
      message: 'The resume was too long to analyze in one pass. Try a shorter document.',
      detail: 'finishReason=MAX_TOKENS',
    });
  }

  // Thinking models can prepend reasoning-summary parts; those are not the answer
  // and would corrupt the JSON if concatenated with it.
  const text = (candidate.content?.parts || [])
    .filter((part) => !part.thought)
    .map((part) => part.text || '')
    .join('')
    .trim();

  if (!text) {
    throw new ImportError('NO_CONTENT_FOUND', {
      detail: `Empty response body (finishReason=${candidate.finishReason ?? 'unknown'}).`,
    });
  }
  return text;
}

/**
 * Parse the model's JSON. Structured output should make this exact, but a
 * stray markdown fence is the one failure mode worth absorbing rather than
 * spending another request on.
 */
function parseJson(text: string): AIResumeResponse {
  const cleaned = text
    .replace(/^\s*```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim();
  try {
    return JSON.parse(cleaned) as AIResumeResponse;
  } catch (err) {
    throw new ImportError('MALFORMED_RESPONSE', {
      detail: `${(err as Error).message} — received: ${cleaned.slice(0, 200)}`,
    });
  }
}

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(new ImportError('CANCELLED'));
      },
      { once: true }
    );
  });

/* ------------------------------------------------------------------ */
/* Provider                                                            */
/* ------------------------------------------------------------------ */

export class GeminiProvider implements AIProvider {
  readonly id = 'gemini';
  readonly supportsBinaryDocuments = true;
  readonly supportedBinaryMimeTypes = NATIVE_MIME_TYPES;

  constructor(private readonly config: AIConfig) {}

  async analyzeDocument(request: AnalyzeRequest): Promise<AnalyzeResult> {
    if (!this.config.apiKey) {
      throw new ImportError('MISSING_API_KEY', { retryable: false });
    }

    const body = this.buildRequestBody(request);
    const maxAttempts = this.config.maxRetries + 1;
    let lastError: ImportError | undefined;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      request.onAttempt?.(attempt, maxAttempts);
      try {
        const raw = await this.send(body, request.signal);
        return {
          data: parseJson(extractJsonText(raw)),
          provider: this.id,
          model: this.config.model,
          usage: {
            inputTokens: raw.usageMetadata?.promptTokenCount,
            outputTokens: raw.usageMetadata?.candidatesTokenCount,
          },
        };
      } catch (err) {
        const error = err instanceof ImportError ? err : new ImportError('UNKNOWN', { cause: err });
        if (!error.retryable || attempt === maxAttempts) throw error;
        lastError = error;
        // Exponential backoff, honouring Retry-After when the service sent one.
        const backoffMs = error.retryAfterSeconds
          ? error.retryAfterSeconds * 1000
          : Math.min(8000, 700 * 2 ** (attempt - 1));
        await sleep(backoffMs, request.signal);
      }
    }

    throw lastError ?? new ImportError('UNKNOWN');
  }

  /** Assemble the Gemini `generateContent` payload. */
  private buildRequestBody(request: AnalyzeRequest) {
    const parts: GeminiPart[] = [];

    // The document goes FIRST: models attend to a document more reliably when
    // the instruction follows the content it refers to.
    if (request.payload.kind === 'binary') {
      parts.push({
        inlineData: { mimeType: request.payload.mimeType, data: request.payload.base64 },
      });
    }
    parts.push({ text: request.userPrompt });

    return {
      contents: [{ role: 'user', parts }],
      systemInstruction: { parts: [{ text: request.systemInstruction }] },
      generationConfig: {
        // Extraction, not creativity — we want the same answer every time.
        temperature: 0,
        topP: 0.95,
        responseMimeType: 'application/json',
        responseSchema: request.responseSchema,
      },
    };
  }

  /** One HTTP round trip, with its own timeout composed onto the caller's signal. */
  private async send(body: unknown, signal?: AbortSignal): Promise<GeminiResponse> {
    const url = `${API_BASE}/models/${encodeURIComponent(this.config.model)}:generateContent`;
    const timeoutController = new AbortController();
    const timer = setTimeout(() => timeoutController.abort(), this.config.requestTimeoutMs);
    const onCallerAbort = () => timeoutController.abort();
    signal?.addEventListener('abort', onCallerAbort, { once: true });

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': this.config.apiKey,
        },
        body: JSON.stringify(body),
        signal: timeoutController.signal,
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw mapHttpError(response.status, text, response.headers.get('retry-after') ?? undefined);
      }
      return (await response.json()) as GeminiResponse;
    } catch (err) {
      if (err instanceof ImportError) throw err;
      // An abort here is either the user cancelling or our own timeout firing.
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw signal?.aborted ? new ImportError('CANCELLED') : new ImportError('TIMEOUT');
      }
      throw new ImportError('NETWORK_ERROR', { detail: (err as Error).message, cause: err });
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onCallerAbort);
    }
  }
}
