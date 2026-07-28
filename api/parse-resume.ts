/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Server-side AI proxy for Resume Import (Vercel Serverless Function).
 *
 * Why this exists: anything prefixed with VITE_ is compiled into the client
 * bundle and is therefore readable by anyone who loads the deployed site. This
 * endpoint keeps the provider key on the server, so the browser never holds it.
 *
 * Activate it by setting, in the Vercel project's Environment Variables:
 *   GEMINI_API_KEY      = <your key>          (NO VITE_ prefix — server only)
 *   VITE_AI_PROXY_URL   = /api/parse-resume
 * and leaving VITE_GEMINI_API_KEY unset.
 *
 * The request/response shape is the contract `ProxyProvider` already speaks, so
 * no client code changes when this is switched on.
 */

/** Minimal request/response typing — avoids taking a dependency on @vercel/node. */
interface VercelRequest {
  method?: string;
  body?: unknown;
}
interface VercelResponse {
  status(code: number): VercelResponse;
  json(body: unknown): void;
  setHeader(name: string, value: string): void;
  end(): void;
}

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const DEFAULT_MODEL = 'gemini-flash-latest';
const REQUEST_TIMEOUT_MS = 120_000;

/** Mirrors the client's DocumentPayload. */
type DocumentPayload =
  | { kind: 'binary'; mimeType: string; base64: string; fileName: string }
  | { kind: 'text'; text: string; fileName: string };

interface ParseRequestBody {
  payload?: DocumentPayload;
  systemInstruction?: string;
  userPrompt?: string;
  responseSchema?: unknown;
}

/** Error codes ProxyProvider recognises. Anything else is normalized client-side. */
type ErrorCode =
  | 'INVALID_API_KEY'
  | 'RATE_LIMITED'
  | 'QUOTA_EXCEEDED'
  | 'PROVIDER_UNAVAILABLE'
  | 'SAFETY_BLOCKED'
  | 'MALFORMED_RESPONSE'
  | 'NO_CONTENT_FOUND';

const fail = (res: VercelResponse, status: number, code: ErrorCode, message: string, detail?: string) =>
  res.status(status).json({ error: { code, message, detail } });

/** Map an upstream Gemini failure onto the client's error taxonomy. */
function mapUpstreamError(status: number, body: string): { status: number; code: ErrorCode; message: string } {
  if (status === 401 || status === 403 || (status === 400 && /api[_ ]?key/i.test(body))) {
    return { status: 502, code: 'INVALID_API_KEY', message: 'The server\'s AI key was rejected.' };
  }
  if (status === 429) {
    const exhausted = /quota|billing|exceeded your current quota/i.test(body);
    return exhausted
      ? { status: 429, code: 'QUOTA_EXCEEDED', message: 'The AI quota has been used up. Please try again later.' }
      : { status: 429, code: 'RATE_LIMITED', message: 'Too many requests right now. Please try again in a moment.' };
  }
  return { status: 502, code: 'PROVIDER_UNAVAILABLE', message: 'The AI service is temporarily unavailable.' };
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method === 'OPTIONS') {
    res.setHeader('Allow', 'POST, OPTIONS');
    res.status(204).end();
    return;
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    fail(res, 405, 'PROVIDER_UNAVAILABLE', 'Method not allowed.');
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    // A configuration mistake, not a user error — say so plainly in the logs.
    console.error('GEMINI_API_KEY is not set on the server.');
    fail(res, 500, 'PROVIDER_UNAVAILABLE', 'Resume import is not configured on this deployment.');
    return;
  }

  const body = (typeof req.body === 'string' ? safeParse(req.body) : req.body) as ParseRequestBody | null;
  const payload = body?.payload;
  if (!payload || !body?.userPrompt || !body?.systemInstruction || !body?.responseSchema) {
    fail(res, 400, 'MALFORMED_RESPONSE', 'Malformed request.', 'Missing payload, prompt, or schema.');
    return;
  }

  // Rebuild the provider request server-side; the document is forwarded as-is,
  // so PDFs still reach the model as original bytes.
  const parts: Record<string, unknown>[] = [];
  if (payload.kind === 'binary') {
    parts.push({ inlineData: { mimeType: payload.mimeType, data: payload.base64 } });
  }
  parts.push({ text: body.userPrompt });

  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const upstream = await fetch(`${API_BASE}/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
        systemInstruction: { parts: [{ text: body.systemInstruction }] },
        generationConfig: {
          temperature: 0,
          topP: 0.95,
          responseMimeType: 'application/json',
          responseSchema: body.responseSchema,
        },
      }),
      signal: controller.signal,
    });

    if (!upstream.ok) {
      const text = await upstream.text().catch(() => '');
      const mapped = mapUpstreamError(upstream.status, text);
      // Never echo the upstream body to the client — it can contain key hints.
      console.error(`Gemini ${upstream.status}: ${text.slice(0, 500)}`);
      fail(res, mapped.status, mapped.code, mapped.message);
      return;
    }

    const result = (await upstream.json()) as {
      candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string }[];
      promptFeedback?: { blockReason?: string };
      usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
    };

    if (result.promptFeedback?.blockReason) {
      fail(res, 422, 'SAFETY_BLOCKED', 'The AI declined to process this document.');
      return;
    }

    // Thinking models can prepend reasoning parts; those are not the answer.
    const text = (result.candidates?.[0]?.content?.parts || [])
      .filter((part) => !part.thought)
      .map((part) => part.text || '')
      .join('')
      .trim();

    if (!text) {
      fail(res, 422, 'NO_CONTENT_FOUND', 'No resume content could be read from that document.');
      return;
    }

    const cleaned = text.replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');
    let data: unknown;
    try {
      data = JSON.parse(cleaned);
    } catch {
      fail(res, 502, 'MALFORMED_RESPONSE', 'The AI returned a response we could not read.');
      return;
    }

    res.status(200).json({
      data,
      provider: 'gemini',
      model,
      usage: {
        inputTokens: result.usageMetadata?.promptTokenCount,
        outputTokens: result.usageMetadata?.candidatesTokenCount,
      },
    });
  } catch (err) {
    const aborted = err instanceof Error && err.name === 'AbortError';
    console.error('parse-resume failed:', err);
    fail(
      res,
      aborted ? 504 : 502,
      'PROVIDER_UNAVAILABLE',
      aborted ? 'The analysis took too long and was stopped.' : 'Could not reach the AI service.'
    );
  } finally {
    clearTimeout(timer);
  }
}

function safeParse(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
