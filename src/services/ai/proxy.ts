/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Backend-proxy adapter.
 *
 * The production path: the browser holds no provider key and posts the same
 * provider-neutral request to an endpoint you control, which forwards it to
 * whichever model you like. Activated purely by setting `VITE_AI_PROXY_URL` —
 * no other file changes.
 *
 * Expected server contract:
 *   POST <proxyUrl>
 *   body    → { payload, systemInstruction, userPrompt, responseSchema }
 *   200     → { data: <schema-shaped object>, provider?: string, model?: string }
 *   4xx/5xx → { error?: { code?: ImportErrorCode, message?: string } }
 */

import type { AIConfig } from './config';
import { ImportError, type ImportErrorCode } from './errors';
import type { AIResumeResponse } from './schema';
import type { AIProvider, AnalyzeRequest, AnalyzeResult } from './types';

interface ProxyResponseBody {
  data?: AIResumeResponse;
  provider?: string;
  model?: string;
  usage?: { inputTokens?: number; outputTokens?: number };
  error?: { code?: string; message?: string; detail?: string };
}

/** Only codes the server is allowed to assert; anything else is normalized. */
const SERVER_CODES: ReadonlySet<string> = new Set<ImportErrorCode>([
  'INVALID_API_KEY',
  'RATE_LIMITED',
  'QUOTA_EXCEEDED',
  'PROVIDER_UNAVAILABLE',
  'SAFETY_BLOCKED',
  'MALFORMED_RESPONSE',
  'NO_CONTENT_FOUND',
  'UNREADABLE_DOCUMENT',
]);

export class ProxyProvider implements AIProvider {
  readonly id = 'proxy';
  // The proxy forwards bytes untouched, so binary capability is whatever the
  // upstream model supports. PDFs are the only binary format we send.
  readonly supportsBinaryDocuments = true;
  readonly supportedBinaryMimeTypes = ['application/pdf'] as const;

  constructor(private readonly config: AIConfig) {}

  async analyzeDocument(request: AnalyzeRequest): Promise<AnalyzeResult> {
    if (!this.config.proxyUrl) {
      throw new ImportError('MISSING_API_KEY', {
        message: 'No AI endpoint is configured.',
        retryable: false,
      });
    }

    const timeoutController = new AbortController();
    const timer = setTimeout(() => timeoutController.abort(), this.config.requestTimeoutMs);
    const onCallerAbort = () => timeoutController.abort();
    request.signal?.addEventListener('abort', onCallerAbort, { once: true });

    try {
      const response = await fetch(this.config.proxyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payload: request.payload,
          systemInstruction: request.systemInstruction,
          userPrompt: request.userPrompt,
          responseSchema: request.responseSchema,
        }),
        signal: timeoutController.signal,
      });

      const body = (await response.json().catch(() => ({}))) as ProxyResponseBody;

      if (!response.ok) {
        const code = body.error?.code && SERVER_CODES.has(body.error.code)
          ? (body.error.code as ImportErrorCode)
          : response.status >= 500
            ? 'PROVIDER_UNAVAILABLE'
            : 'UNKNOWN';
        throw new ImportError(code, {
          message: body.error?.message,
          detail: body.error?.detail || `HTTP ${response.status}`,
        });
      }

      if (!body.data) {
        throw new ImportError('MALFORMED_RESPONSE', { detail: 'Proxy response contained no `data` field.' });
      }

      return {
        data: body.data,
        provider: body.provider || this.id,
        model: body.model || this.config.model,
        usage: body.usage,
      };
    } catch (err) {
      if (err instanceof ImportError) throw err;
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw request.signal?.aborted ? new ImportError('CANCELLED') : new ImportError('TIMEOUT');
      }
      throw new ImportError('NETWORK_ERROR', { detail: (err as Error).message, cause: err });
    } finally {
      clearTimeout(timer);
      request.signal?.removeEventListener('abort', onCallerAbort);
    }
  }
}
