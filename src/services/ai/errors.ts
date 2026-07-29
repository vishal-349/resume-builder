/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Typed error taxonomy for the import pipeline.
 *
 * Every failure path — validation, file reading, transport, model output —
 * surfaces as an `ImportError` with a code the UI can branch on and a message
 * safe to show a user. Nothing throws a bare `Error`, and nothing crashes.
 */

export type ImportErrorCode =
  /* Pre-flight, no network spend */
  | 'UNSUPPORTED_FORMAT'
  | 'LEGACY_DOC'
  | 'FILE_TOO_LARGE'
  | 'EMPTY_FILE'
  | 'UNREADABLE_DOCUMENT'
  /* Configuration */
  | 'MISSING_API_KEY'
  | 'INVALID_API_KEY'
  /* Transport */
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'CANCELLED'
  | 'RATE_LIMITED'
  | 'QUOTA_EXCEEDED'
  | 'PROVIDER_UNAVAILABLE'
  /* Model output */
  | 'SAFETY_BLOCKED'
  | 'MALFORMED_RESPONSE'
  | 'NO_CONTENT_FOUND'
  /* Fallback */
  | 'UNKNOWN';

export interface ImportErrorOptions {
  /** Overrides the default user-facing message for the code. */
  message?: string;
  /** Extra technical detail — logged, and shown in a collapsible panel. */
  detail?: string;
  /** Whether retrying the exact same request could plausibly succeed. */
  retryable?: boolean;
  /** Seconds to wait before retrying (from a Retry-After header). */
  retryAfterSeconds?: number;
  cause?: unknown;
}

/** Default copy per code. Written for the person who uploaded the file. */
const DEFAULT_MESSAGES: Record<ImportErrorCode, string> = {
  UNSUPPORTED_FORMAT: 'That file type is not supported. Please upload a PDF or a Word (.docx) document.',
  LEGACY_DOC:
    'Legacy .doc files are not supported. Open the file in Word or Google Docs and save it as PDF or .docx, then import again.',
  FILE_TOO_LARGE: 'That file is too large to analyze. Please upload a resume under 10 MB.',
  EMPTY_FILE: 'That file appears to be empty.',
  UNREADABLE_DOCUMENT:
    'We could not read any content from that document. If it is a scanned image, try exporting it as a PDF instead.',
  MISSING_API_KEY: 'No AI key is configured, so resume import is unavailable. Add a key to continue.',
  INVALID_API_KEY: 'The AI key was rejected. Check that it is correct and still active, then try again.',
  NETWORK_ERROR: 'Could not reach the AI service. Check your internet connection and try again.',
  TIMEOUT: 'The analysis took too long and was stopped. Try again, or use a shorter resume.',
  CANCELLED: 'Import cancelled.',
  RATE_LIMITED: 'Too many requests in a short window. Wait a moment and try again.',
  QUOTA_EXCEEDED: 'The AI quota for this key has been used up. Try again later or use a different key.',
  PROVIDER_UNAVAILABLE: 'The AI service is temporarily unavailable. Please try again in a moment.',
  SAFETY_BLOCKED: 'The AI declined to process this document. Try importing a different version of your resume.',
  MALFORMED_RESPONSE: 'The AI returned a response we could not read. Please try again.',
  NO_CONTENT_FOUND:
    'We could not find any resume content in that document. If it is a scanned or image-only file, try a text-based PDF.',
  UNKNOWN: 'Something went wrong while importing your resume. Please try again.',
};

/** Codes where an immediate retry of the same request is worth offering. */
const RETRYABLE: ReadonlySet<ImportErrorCode> = new Set<ImportErrorCode>([
  'NETWORK_ERROR',
  'TIMEOUT',
  'RATE_LIMITED',
  'PROVIDER_UNAVAILABLE',
  'MALFORMED_RESPONSE',
  'UNKNOWN',
]);

export class ImportError extends Error {
  readonly code: ImportErrorCode;
  readonly detail?: string;
  readonly retryable: boolean;
  readonly retryAfterSeconds?: number;

  constructor(code: ImportErrorCode, options: ImportErrorOptions = {}) {
    super(options.message || DEFAULT_MESSAGES[code]);
    this.name = 'ImportError';
    this.code = code;
    this.detail = options.detail;
    this.retryable = options.retryable ?? RETRYABLE.has(code);
    this.retryAfterSeconds = options.retryAfterSeconds;
    if (options.cause !== undefined) (this as { cause?: unknown }).cause = options.cause;
  }
}

export const isImportError = (err: unknown): err is ImportError =>
  err instanceof ImportError || (typeof err === 'object' && err !== null && (err as ImportError).name === 'ImportError');

/**
 * Coerce anything thrown anywhere in the pipeline into an ImportError, so the
 * UI only ever handles one error type.
 */
export function toImportError(err: unknown): ImportError {
  if (isImportError(err)) return err;
  if (err instanceof DOMException && err.name === 'AbortError') {
    return new ImportError('CANCELLED');
  }
  if (err instanceof TypeError && /fetch|network/i.test(err.message)) {
    return new ImportError('NETWORK_ERROR', { detail: err.message, cause: err });
  }
  const detail = err instanceof Error ? err.message : String(err);
  return new ImportError('UNKNOWN', { detail, cause: err });
}
