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

/** Visual styling captured from the source document, applied on reconstruction. */
export interface DocStyle {
  primaryColor?: string;   // accent / heading colour
  textColor?: string;      // body text colour
  fontFamily?: 'sans' | 'serif' | 'mono';
}

export interface ReadResult {
  lines: DocLine[];
  /** 'pdf' | 'docx' — useful for messaging. */
  kind: string;
  /** Captured look of the source (PDF only). */
  style?: DocStyle;
}

/* ------------------------------------------------------------------ */
/* PDF                                                                 */
/* ------------------------------------------------------------------ */

const toHex = (r: number, g: number, b: number) =>
  '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const saturation = (r: number, g: number, b: number) => { const mx = Math.max(r, g, b), mn = Math.min(r, g, b); return mx === 0 ? 0 : (mx - mn) / mx; };
const luminance = (r: number, g: number, b: number) => 0.299 * r + 0.587 * g + 0.114 * b;

/** Tally serif / sans / mono usage from a page's font styles. */
function tallyFonts(styles: Record<string, any>, votes: { serif: number; sans: number; mono: number }) {
  for (const k in styles) {
    const f = String(styles[k]?.fontFamily || '').toLowerCase();
    if (!f) continue;
    if (/mono|courier|consol/.test(f)) votes.mono++;
    else if (/serif|times|georgia|garamond|cambria|minion|book antiqua|palatino/.test(f) && !/sans/.test(f)) votes.serif++;
    else votes.sans++;
  }
}

/**
 * Render a page and sample the ink colour inside each text item's box. Returns the
 * dominant body text colour and the dominant accent (colourful) colour — i.e. the
 * résumé's real palette. Best-effort; returns {} if rendering isn't available.
 */
async function sampleColors(page: any, items: PdfItem[]): Promise<{ accent?: string; text?: string }> {
  try {
    if (typeof document === 'undefined') return {};
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext('2d', { willReadFrequently: true } as any) as CanvasRenderingContext2D;
    if (!ctx) return {};
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport }).promise;
    const W = canvas.width, H = canvas.height;
    const data = ctx.getImageData(0, 0, W, H).data;
    const buckets = new Map<string, { w: number; r: number; g: number; b: number }>();

    for (const it of items) {
      const s = it.str.trim();
      if (!s) continue;
      const [ax, ay] = viewport.convertToViewportPoint(it.x, it.y);
      const [bx, by] = viewport.convertToViewportPoint(it.x + it.w, it.y + it.size);
      const x0 = Math.max(0, Math.floor(Math.min(ax, bx)));
      const x1 = Math.min(W - 1, Math.ceil(Math.max(ax, bx)));
      const y0 = Math.max(0, Math.floor(Math.min(ay, by)));
      const y1 = Math.min(H - 1, Math.ceil(Math.max(ay, by)));
      if (x1 <= x0 || y1 <= y0) continue;
      // Darkest ink pixel in the glyph box ≈ the text's true colour.
      let br = 0, bg = 0, bb = 0, bl = 256, found = false;
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const i = (y * W + x) * 4;
          if (data[i + 3] < 128) continue;
          const r = data[i], g = data[i + 1], b = data[i + 2];
          const L = luminance(r, g, b);
          if (L > 225) continue; // background / near-white
          if (L < bl) { bl = L; br = r; bg = g; bb = b; found = true; }
        }
      }
      if (!found) continue;
      const key = `${br >> 4}_${bg >> 4}_${bb >> 4}`;
      const e = buckets.get(key) || { w: 0, r: br, g: bg, b: bb };
      e.w += s.length;
      buckets.set(key, e);
    }

    const arr = [...buckets.values()];
    if (!arr.length) return {};
    const neutralDark = arr.filter((e) => saturation(e.r, e.g, e.b) < 0.25 && luminance(e.r, e.g, e.b) < 150).sort((a, b) => b.w - a.w);
    const colorful = arr.filter((e) => saturation(e.r, e.g, e.b) >= 0.3 && luminance(e.r, e.g, e.b) > 25 && luminance(e.r, e.g, e.b) < 225).sort((a, b) => b.w - a.w);
    return {
      text: neutralDark[0] ? toHex(neutralDark[0].r, neutralDark[0].g, neutralDark[0].b) : undefined,
      accent: colorful[0] ? toHex(colorful[0].r, colorful[0].g, colorful[0].b) : undefined,
    };
  } catch {
    return {};
  }
}

async function readPdf(file: File): Promise<{ lines: DocLine[]; style: DocStyle }> {
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const out: PdfLine[] = [];
  const fontVotes = { serif: 0, sans: 0, mono: 0 };
  let palette: { accent?: string; text?: string } = {};

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    // Resolve fonts so we can read their names (for bold detection).
    try { await page.getOperatorList(); } catch { /* non-fatal */ }
    const content = await page.getTextContent();
    tallyFonts((content as any).styles || {}, fontVotes);
    const boldCache = new Map<string, boolean>();
    const isBold = (fontName?: string): boolean => {
      if (!fontName) return false;
      if (boldCache.has(fontName)) return boldCache.get(fontName)!;
      let b = false;
      try { const f: any = (page as any).commonObjs.get(fontName); b = /bold|black|heavy|semibold|demibold/i.test(f?.name || ''); } catch { /* unresolved */ }
      boldCache.set(fontName, b);
      return b;
    };
    const items: PdfItem[] = (content.items as any[])
      .filter((it) => typeof it.str === 'string')
      .map((it) => {
        const tr = it.transform || [1, 0, 0, 1, 0, 0];
        const size = it.height || Math.hypot(tr[2], tr[3]) || 0;
        return { str: it.str, x: tr[4], y: tr[5], w: it.width || it.str.length * 5, size, bold: isBold(it.fontName) };
      });
    // Colour palette is sampled from the first page that carries the header/accent.
    if (p === 1) palette = await sampleColors(page, items);
    out.push(...pageToLines(items));
  }
  if (out.length === 0) {
    throw new Error('No readable text found in the PDF. It may be scanned/image-only.');
  }

  const fontFamily: DocStyle['fontFamily'] =
    fontVotes.mono > fontVotes.serif && fontVotes.mono > fontVotes.sans ? 'mono'
    : fontVotes.serif > fontVotes.sans ? 'serif'
    : 'sans';

  return {
    lines: out.map((l) => ({ text: l.text, size: l.size, bold: l.bold, bullet: l.bullet, headingHint: l.heading })),
    style: { primaryColor: palette.accent, textColor: palette.text, fontFamily },
  };
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
    const { lines, style } = await readPdf(file);
    return { lines, kind: 'pdf', style };
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
