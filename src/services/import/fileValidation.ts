/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Pre-flight file validation.
 *
 * Runs entirely locally, before any network spend. Every rejection is a typed
 * error carrying actionable guidance rather than a generic failure.
 */

import { ImportError } from '../ai/errors';
import type { SupportedFormat } from './types';

export const ACCEPTED_EXTENSIONS = ['pdf', 'docx'] as const;

/** The `accept` attribute for file inputs. */
export const FILE_INPUT_ACCEPT =
  '.pdf,application/pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document';

const MIME_BY_FORMAT: Record<Exclude<SupportedFormat, 'text'>, string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

export interface ValidatedFile {
  file: File;
  format: Exclude<SupportedFormat, 'text'>;
  mimeType: string;
  extension: string;
}

const extensionOf = (name: string): string => {
  const dot = name.lastIndexOf('.');
  return dot === -1 ? '' : name.slice(dot + 1).toLowerCase();
};

/**
 * Validate a user-selected file.
 *
 * Detection is by extension rather than MIME type: browsers report Office MIME
 * types inconsistently across platforms, but the extension is what the user
 * actually chose.
 */
export function validateFile(file: File, maxBytes: number): ValidatedFile {
  const extension = extensionOf(file.name);

  if (extension === 'doc') {
    // Legacy binary Word has no reliable browser parser. Rejecting with clear
    // instructions beats a half-working extraction that silently loses content.
    throw new ImportError('LEGACY_DOC', { retryable: false });
  }

  if (extension !== 'pdf' && extension !== 'docx') {
    throw new ImportError('UNSUPPORTED_FORMAT', {
      message: `"${file.name}" is not a supported file type. Please upload a PDF or a Word (.docx) document.`,
      retryable: false,
    });
  }

  if (file.size === 0) {
    throw new ImportError('EMPTY_FILE', {
      message: `"${file.name}" is empty.`,
      retryable: false,
    });
  }

  if (file.size > maxBytes) {
    const mb = (file.size / (1024 * 1024)).toFixed(1);
    const limitMb = Math.floor(maxBytes / (1024 * 1024));
    throw new ImportError('FILE_TOO_LARGE', {
      message: `"${file.name}" is ${mb} MB, over the ${limitMb} MB limit. Try exporting a lighter PDF or removing embedded images.`,
      retryable: false,
    });
  }

  return {
    file,
    format: extension,
    mimeType: MIME_BY_FORMAT[extension],
    extension,
  };
}

/** Pasted-text validation — the manual fallback path. */
export function validatePastedText(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new ImportError('EMPTY_FILE', { message: 'Paste some resume text first.', retryable: false });
  }
  if (trimmed.length < 40) {
    throw new ImportError('UNREADABLE_DOCUMENT', {
      message: 'That is too short to read as a resume. Paste the full text and try again.',
      retryable: false,
    });
  }
  return trimmed;
}
