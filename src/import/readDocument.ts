/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Structured document reader for the Smart Import pipeline.
 *
 * Turns a PDF / DOCX / DOC file into a flat list of `DocLine`s that carry enough
 * structural hints (font size, bold, bullet, explicit-heading) for the analyzer
 * to detect sections — without forcing the content into any fixed template.
 */

import mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist';
import PdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { pageToLines, cleanText, BULLET_RE, PdfItem, PdfLine } from './pdfLayout';

pdfjsLib.GlobalWorkerOptions.workerSrc = PdfWorkerUrl;

export interface DocLine {
  text: string;
  /** Font size in px when known (PDF). 0 when unknown (DOCX). */
  size: number;
  bold: boolean;
  /** Line is a list item / starts with a bullet glyph. */
  bullet: boolean;
  /** The source explicitly marked this as a heading (DOCX <h1..6> or bold-only line). */
  headingHint: boolean;
}

export interface ReadResult {
  lines: DocLine[];
  /** 'pdf' | 'docx' — useful for messaging. */
  kind: string;
}

/* ------------------------------------------------------------------ */
/* PDF                                                                 */
/* ------------------------------------------------------------------ */

async function readPdf(file: File): Promise<DocLine[]> {
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const out: PdfLine[] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const items: PdfItem[] = (content.items as any[])
      .filter((it) => typeof it.str === 'string')
      .map((it) => {
        const tr = it.transform || [1, 0, 0, 1, 0, 0];
        const size = it.height || Math.hypot(tr[2], tr[3]) || 0;
        return { str: it.str, x: tr[4], y: tr[5], w: it.width || it.str.length * 5, size };
      });
    out.push(...pageToLines(items));
  }
  if (out.length === 0) {
    throw new Error('No readable text found in the PDF. It may be scanned/image-only.');
  }
  return out.map((l) => ({
    text: l.text,
    size: l.size,
    bold: false,
    bullet: l.bullet,
    headingHint: l.heading,
  }));
}

/* ------------------------------------------------------------------ */
/* DOCX / DOC                                                          */
/* ------------------------------------------------------------------ */

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(parseInt(d, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

/**
 * Parse mammoth's HTML output into structured lines. Word heading styles map to
 * <h1..6>, bold runs to <strong>/<b>, lists to <li>, and tables to <tr>/<td>.
 */
function htmlToLines(html: string): DocLine[] {
  const lines: DocLine[] = [];
  // Normalise table cells and rows to separators / line breaks before parsing.
  const normalised = html
    .replace(/<\/td>\s*<td[^>]*>/gi, ' │ ')
    .replace(/<\/(tr|table|thead|tbody)>/gi, '\n');

  const re = /<(h[1-6]|p|li|div)([^>]*)>([\s\S]*?)<\/\1>/gi;
  let mm: RegExpExecArray | null;
  while ((mm = re.exec(normalised))) {
    const tag = mm[1].toLowerCase();
    const innerRaw = mm[3];
    const isHeadingTag = /^h[1-6]$/.test(tag);
    const isLi = tag === 'li';
    // A paragraph whose entire content is bold — recorded for entry-header
    // detection, but NOT treated as a section heading (bold job titles inside
    // Work Experience must not start new sections).
    const strongWrapped = /^\s*<(strong|b)[^>]*>[\s\S]*<\/(strong|b)>\s*$/i.test(innerRaw.trim());
    // Table rows were turned into newlines, so one block may yield several lines.
    const pieces = decodeEntities(innerRaw.replace(/<[^>]+>/g, ' ')).split('\n');
    pieces.forEach((piece) => {
      const text = cleanText(piece);
      if (!text) return;
      lines.push({
        text,
        size: 0,
        bold: strongWrapped && !isLi,
        bullet: isLi || BULLET_RE.test(text),
        headingHint: isHeadingTag, // only true Word heading styles are section headings
      });
    });
  }

  // Fallback: if mammoth produced no block tags, treat raw text line by line.
  if (lines.length === 0) {
    decodeEntities(normalised.replace(/<[^>]+>/g, '\n'))
      .split('\n')
      .map(cleanText)
      .filter(Boolean)
      .forEach((text) => lines.push({ text, size: 0, bold: false, bullet: BULLET_RE.test(text), headingHint: false }));
  }
  return lines;
}

async function readDocx(file: File): Promise<DocLine[]> {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.convertToHtml({ arrayBuffer });
  const lines = htmlToLines(result.value || '');
  if (lines.length === 0) throw new Error('This document appears to be empty.');
  return lines;
}

/* ------------------------------------------------------------------ */
/* Entry                                                               */
/* ------------------------------------------------------------------ */

/** Build DocLines from raw pasted text (the paste-fallback path). */
export function linesFromText(text: string): DocLine[] {
  return text
    .split('\n')
    .map(cleanText)
    .filter(Boolean)
    .map((t) => ({ text: t, size: 0, bold: false, bullet: BULLET_RE.test(t), headingHint: false }));
}

export async function readDocument(file: File): Promise<ReadResult> {
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  if (ext === 'pdf') {
    return { lines: await readPdf(file), kind: 'pdf' };
  }
  if (ext === 'docx' || ext === 'doc') {
    try {
      return { lines: await readDocx(file), kind: 'docx' };
    } catch (err: any) {
      if (ext === 'doc') {
        throw new Error('Legacy .doc files are not fully supported in the browser. Please re-save as .docx or PDF and try again.');
      }
      throw new Error(`Could not read the Word document: ${err?.message || err}`);
    }
  }
  // Plain text / unknown — read as text.
  const text = await file.text();
  const lines = text.split('\n').map(cleanText).filter(Boolean)
    .map((t) => ({ text: t, size: 0, bold: false, bullet: BULLET_RE.test(t), headingHint: false }));
  if (lines.length === 0) throw new Error('The file appears to be empty.');
  return { lines, kind: 'text' };
}
