/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * The provider contract.
 *
 * Anything that implements `AIProvider` can back the importer: Gemini today, a
 * backend proxy tomorrow, OpenAI or Claude later. No consumer of this module
 * may reference a provider by name — `provider.ts` is the only place that
 * chooses one.
 */

import type { DocumentPayload } from '../import/types';
import type { AIResumeResponse, JSONSchema } from './schema';

export interface AnalyzeRequest {
  /** The document to analyze, original bytes wherever the provider supports it. */
  payload: DocumentPayload;
  /** Provider-agnostic behavioural instruction. */
  systemInstruction: string;
  /** The task prompt for this specific document. */
  userPrompt: string;
  /** The structure the response must conform to. */
  responseSchema: JSONSchema;
  /** Cancels an in-flight request. */
  signal?: AbortSignal;
  /** Called between internal retry attempts so the UI can stay honest. */
  onAttempt?: (attempt: number, maxAttempts: number) => void;
}

export interface AnalyzeResult {
  /** The parsed, schema-shaped response. */
  data: AIResumeResponse;
  /** Identifier for diagnostics, e.g. "gemini" or "proxy". Never branched on. */
  provider: string;
  model: string;
  /** Token usage when the provider reports it. */
  usage?: { inputTokens?: number; outputTokens?: number };
}

export interface AIProvider {
  /** Stable identifier, used only in logs and diagnostics. */
  readonly id: string;
  /**
   * Whether this provider can accept raw document bytes. When false, the
   * pipeline converts the document to structured text first.
   */
  readonly supportsBinaryDocuments: boolean;
  /** MIME types this provider can ingest natively as binary. */
  readonly supportedBinaryMimeTypes: readonly string[];
  /** Throws an `ImportError` on any failure. Never returns a partial result. */
  analyzeDocument(request: AnalyzeRequest): Promise<AnalyzeResult>;
}
