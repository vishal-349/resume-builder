/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * File → `DocumentPayload`.
 *
 * The guiding rule: hand the AI the richest representation it can read.
 *
 *  • PDF  → original bytes. The model SEES the page — columns, tables, rules,
 *           fonts, colours — and reads scanned pages visually. This is why the
 *           pipeline is accurate where text extraction was not.
 *  • DOCX → HTML. Word has no page geometry to see, but its markup carries the
 *           real structure (heading levels, bold runs, lists, tables), which is
 *           strictly more informative than a flattened text dump.
 */

import mammoth from 'mammoth';
import { ImportError } from '../ai/errors';
import type { ValidatedFile } from './fileValidation';
import type { DocumentPayload } from './types';

/** Above this, the HTML is truncated rather than blowing up the request. */
const MAX_HTML_CHARS = 200_000;

/* ------------------------------------------------------------------ */
/* Binary → base64                                                     */
/* ------------------------------------------------------------------ */

/**
 * ArrayBuffer → base64.
 *
 * Chunked because `String.fromCharCode(...bytes)` on a multi-MB file blows the
 * argument limit and throws a RangeError.
 */
function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const CHUNK = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

/* ------------------------------------------------------------------ */
/* PDF                                                                 */
/* ------------------------------------------------------------------ */

/** Cheap page count straight from the PDF structure — no parser needed. */
function countPdfPages(buffer: ArrayBuffer): number {
  try {
    const text = new TextDecoder('latin1').decode(new Uint8Array(buffer));
    const matches = text.match(/\/Type\s*\/Page[^s]/g);
    return matches ? matches.length : 0;
  } catch {
    return 0;
  }
}

async function readPdf(validated: ValidatedFile, maxPages: number): Promise<DocumentPayload> {
  const buffer = await validated.file.arrayBuffer();

  // A valid PDF always starts with %PDF-. Catching a mislabelled file here
  // saves a request that would fail server-side with a vaguer message.
  const header = new TextDecoder('latin1').decode(new Uint8Array(buffer.slice(0, 5)));
  if (header !== '%PDF-') {
    throw new ImportError('UNREADABLE_DOCUMENT', {
      message: `"${validated.file.name}" does not look like a valid PDF. Try re-exporting it.`,
      retryable: false,
    });
  }

  const pages = countPdfPages(buffer);
  if (pages > maxPages) {
    throw new ImportError('FILE_TOO_LARGE', {
      message: `That PDF has ${pages} pages, over the ${maxPages}-page limit for a single import. Split it or import a shorter version.`,
      retryable: false,
    });
  }

  return {
    kind: 'binary',
    mimeType: validated.mimeType,
    base64: toBase64(buffer),
    fileName: validated.file.name,
    format: 'pdf',
  };
}

/* ------------------------------------------------------------------ */
/* DOCX                                                                */
/* ------------------------------------------------------------------ */

/**
 * Strip what carries no structural signal, so the token budget goes to
 * content. Base64 images in particular can be megabytes of noise.
 */
function condenseHtml(html: string): string {
  return html
    .replace(/<img[^>]*>/gi, '')
    .replace(/\s+style="[^"]*"/gi, '')
    .replace(/\s+class="[^"]*"/gi, '')
    .replace(/<p>\s*<\/p>/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Run mammoth against whichever input option the resolved build accepts.
 *
 * mammoth ships two builds with different signatures: the browser build takes
 * `arrayBuffer`, the Node build takes `buffer`. Which one a bundler or test
 * runner resolves is not knowable up front, so try both rather than guessing.
 * That keeps this one service usable in the browser, in the test harness, and
 * in a future server-side proxy without forking the code.
 */
async function convertDocxToHtml(arrayBuffer: ArrayBuffer): Promise<string> {
  type MammothInput = Parameters<typeof mammoth.convertToHtml>[0];
  const attempts: MammothInput[] = [{ arrayBuffer }];
  if (typeof Buffer !== 'undefined') {
    attempts.push({ buffer: Buffer.from(new Uint8Array(arrayBuffer)) } as unknown as MammothInput);
  }

  let lastError: unknown;
  for (const options of attempts) {
    try {
      const result = await mammoth.convertToHtml(options);
      return result.value || '';
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}

async function readDocx(validated: ValidatedFile): Promise<DocumentPayload> {
  const arrayBuffer = await validated.file.arrayBuffer();

  let html: string;
  try {
    html = condenseHtml(await convertDocxToHtml(arrayBuffer));
  } catch (err) {
    throw new ImportError('UNREADABLE_DOCUMENT', {
      message: `Could not read "${validated.file.name}". If it was saved by an older version of Word, re-save it as .docx or export it as a PDF.`,
      detail: (err as Error).message,
      retryable: false,
      cause: err,
    });
  }

  // Markup with no text content means an empty or image-only document.
  if (html.replace(/<[^>]+>/g, '').trim().length < 40) {
    throw new ImportError('UNREADABLE_DOCUMENT', {
      message: `"${validated.file.name}" contains no readable text. If the content is an image, export it as a PDF instead — those can be read visually.`,
      retryable: false,
    });
  }

  return {
    kind: 'text',
    text: html.length > MAX_HTML_CHARS ? `${html.slice(0, MAX_HTML_CHARS)}\n<!-- truncated -->` : html,
    fileName: validated.file.name,
    format: 'docx',
  };
}

/* ------------------------------------------------------------------ */
/* Entry points                                                        */
/* ------------------------------------------------------------------ */

export async function toDocumentPayload(validated: ValidatedFile, maxPdfPages: number): Promise<DocumentPayload> {
  return validated.format === 'pdf' ? readPdf(validated, maxPdfPages) : readDocx(validated);
}

/** The paste-text fallback, wrapped so it flows through the same pipeline. */
export function textToPayload(text: string, fileName = 'Pasted text'): DocumentPayload {
  return { kind: 'text', text, fileName, format: 'text' };
}
