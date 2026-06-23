/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Pure PDF text-layout reconstruction for the Smart Import pipeline.
 *
 * Given the positioned text items pdf.js extracts from a page, this turns them
 * into reading-ordered logical lines — handling left-rail label layouts, balanced
 * two-column resumes, and plain single-column documents. It has no pdf.js / DOM
 * dependency so it can be unit-tested in isolation.
 */

export const BULLET_RE = /^[\s]*[•·▪◦‣⁃○●*\-–—]\s+/;

export function cleanText(s: string): string {
  return s.replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
}

export interface PdfItem { str: string; x: number; y: number; w: number; size: number; bold?: boolean; }
export interface PdfLine { text: string; size: number; bullet: boolean; heading: boolean; bold: boolean; }

/** A line is "bold" when most of its characters are in a bold font. */
function lineBold(items: PdfItem[]): boolean {
  let bold = 0, total = 0;
  for (const i of items) { const n = i.str.trim().length; total += n; if (i.bold) bold += n; }
  return total > 0 && bold / total >= 0.6;
}

/** Group text items into visual rows (top-to-bottom, left-to-right within a row). */
function rowsByY(items: PdfItem[]): { y: number; items: PdfItem[] }[] {
  const rows: { y: number; items: PdfItem[] }[] = [];
  items.forEach((it) => {
    const row = rows.find((r) => Math.abs(r.y - it.y) < 4);
    if (row) row.items.push(it);
    else rows.push({ y: it.y, items: [it] });
  });
  rows.forEach((r) => r.items.sort((a, b) => a.x - b.x));
  rows.sort((a, b) => b.y - a.y);
  return rows;
}

/** Find a clean vertical gutter that splits items into two columns; -1 if none. */
function findGutter(items: PdfItem[]): number {
  if (items.length < 6) return -1;
  let minX = Infinity, maxX = -Infinity;
  items.forEach((i) => { minX = Math.min(minX, i.x); maxX = Math.max(maxX, i.x + i.w); });
  if (maxX - minX < 220) return -1;
  let bestX = -1, bestCross = Infinity, bestBalance = 0;
  for (let gx = minX + 70; gx < maxX - 50; gx += 8) {
    let cross = 0, left = 0, right = 0;
    items.forEach((i) => {
      if (i.x < gx - 4 && i.x + i.w > gx + 4) cross += i.str.length;
      else if (i.x + i.w <= gx) left++;
      else right++;
    });
    if (left < 2 || right < 2) continue;
    const balance = Math.min(left, right);
    if (cross < bestCross || (cross === bestCross && balance > bestBalance)) {
      bestCross = cross; bestX = gx; bestBalance = balance;
    }
  }
  return bestCross <= 4 && bestX > 0 ? bestX : -1;
}

/**
 * Turn a group of content items into logical lines. When the group is laid out in
 * two columns (e.g. a two-column skills list) the left column is read fully before
 * the right, and soft-wrapped rows are stitched back onto their bullet so a wrapped
 * list item stays whole.
 */
function contentLines(items: PdfItem[]): PdfLine[] {
  if (!items.length) return [];
  const gutter = findGutter(items);
  const cols = gutter > 0
    ? [items.filter((i) => i.x + i.w / 2 < gutter), items.filter((i) => i.x + i.w / 2 >= gutter)]
    : [items];
  const out: PdfLine[] = [];
  cols.forEach((colItems) => {
    if (!colItems.length) return;
    let prev: PdfLine | null = null;
    rowsByY(colItems).forEach((r) => {
      const text = cleanText(r.items.map((i) => i.str).join(' '));
      if (!text) return;
      const size = Math.round(Math.max(...r.items.map((i) => i.size)) || 0);
      const bullet = BULLET_RE.test(text);
      const bold = lineBold(r.items);
      // In a two-column list, a non-bullet row that follows an unfinished line is a
      // soft-wrap continuation of it (so a wrapped list item is rejoined).
      if (gutter > 0 && !bullet && prev && !/[.!?:]$/.test(prev.text)) {
        prev.text = cleanText(`${prev.text} ${text}`);
      } else {
        prev = { text, size, bullet, heading: false, bold };
        out.push(prev);
      }
    });
  });
  return out;
}

/**
 * Group a page's text items into reading-ordered lines. Handles three layouts:
 *  1. Left-rail labels — section names in a narrow left column with content to the
 *     right (very common templated resumes). Labels become headings.
 *  2. Balanced two-column resumes — detected via a central gutter.
 *  3. Plain single-column.
 */
export function pageToLines(items: PdfItem[]): PdfLine[] {
  const valid = items.filter((i) => i.str && i.str.trim().length > 0);
  if (valid.length === 0) return [];

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, totalChars = 0;
  valid.forEach((i) => {
    minX = Math.min(minX, i.x); maxX = Math.max(maxX, i.x + i.w);
    minY = Math.min(minY, i.y); maxY = Math.max(maxY, i.y); totalChars += i.str.length;
  });
  const widthRange = maxX - minX;

  /* ---- 1. Left-rail label layout ---- */
  // Detect a sizeable horizontal gap near the left margin: [rail] gap [content].
  const intervals = valid
    .map((i) => [i.x, i.x + Math.max(i.w, 2)] as [number, number])
    .sort((a, b) => a[0] - b[0]);
  let railBoundary = -1, cursor = intervals[0][1];
  for (let k = 1; k < intervals.length; k++) {
    const [s, e] = intervals[k];
    if (s - cursor > 28 && cursor > minX && cursor < minX + 118) { railBoundary = (cursor + s) / 2; break; }
    cursor = Math.max(cursor, e);
  }
  if (railBoundary > 0) {
    const railItems = valid.filter((i) => i.x + i.w <= railBoundary);
    const contentItems = valid.filter((i) => i.x + i.w > railBoundary);
    // Labels: merge vertically-adjacent rail rows (a label wrapped over two lines,
    // e.g. "WORK" / "EXPERIENCE").
    const labels: { y: number; size: number; text: string }[] = [];
    rowsByY(railItems).forEach((r) => {
      const text = cleanText(r.items.map((i) => i.str).join(' '));
      if (!text) return;
      const size = Math.round(Math.max(...r.items.map((i) => i.size)) || 0);
      const last = labels[labels.length - 1];
      if (last && Math.abs(last.y - r.y) < 26 && !/[.!?:]$/.test(last.text)) {
        last.text = cleanText(`${last.text} ${text}`);
      } else labels.push({ y: r.y, size, text });
    });
    // Only treat the rail as headings when it really looks like a label rail:
    // a handful of short labels with most content sitting to their right.
    const looksLikeRail =
      labels.length >= 1 && labels.length <= 14 &&
      contentItems.length > railItems.length &&
      labels.every((l) => l.text.length <= 34);
    if (looksLikeRail) {
      const out: PdfLine[] = [];
      const firstY = labels[0].y;
      // Content above the first label (header / contact, or a wrapped tail carried
      // over from the previous page) keeps its place as ordinary lines.
      out.push(...contentLines(contentItems.filter((i) => i.y > firstY + 6)));
      labels.forEach((lab, idx) => {
        out.push({ text: lab.text, size: lab.size, bullet: false, heading: true, bold: true });
        const nextY = idx + 1 < labels.length ? labels[idx + 1].y : -Infinity;
        const slice = contentItems.filter((i) => i.y <= lab.y + 6 && i.y > nextY + 6);
        out.push(...contentLines(slice));
      });
      return out;
    }
  }

  /* ---- 2. Balanced two-column layout ---- */
  const heightRange = maxY - minY || 1;
  const ySplitTop = maxY - 0.12 * heightRange;
  const ySplitBottom = minY + 0.08 * heightRange;
  let bestSplitX = -1, minCross = Infinity;
  if (widthRange > 180) {
    const steps = 50, step = widthRange / steps;
    for (let s = 14; s <= 36; s++) {
      const cand = minX + s * step;
      let cross = 0;
      valid.forEach((i) => {
        if (i.y > ySplitTop || i.y < ySplitBottom) return;
        if (i.x < cand - 5 && i.x + i.w > cand + 5) cross += i.str.length;
      });
      if (cross < minCross) { minCross = cross; bestSplitX = cand; }
    }
  }
  const isTwoCol = widthRange > 180 && bestSplitX !== -1 && (minCross < 60 || minCross < totalChars * 0.06);

  // Split a row at a wide horizontal gap only when BOTH sides carry substantial
  // text — that signals a two-column block (e.g. a two-column skills list) rather
  // than a short right-aligned date like "Company        02/2023 – Present".
  const splitRowSegments = (items: PdfItem[]): PdfItem[][] => {
    if (items.length < 2) return [items];
    let gapIdx = -1, gapW = 0;
    for (let i = 1; i < items.length; i++) {
      const g = items[i].x - (items[i - 1].x + items[i - 1].w);
      if (g > gapW) { gapW = g; gapIdx = i; }
    }
    if (gapIdx === -1 || gapW < 45) return [items];
    const left = items.slice(0, gapIdx), right = items.slice(gapIdx);
    const len = (g: PdfItem[]) => g.reduce((n, i) => n + i.str.trim().length, 0);
    if (len(left) >= 18 && len(right) >= 18) return [left, right];
    return [items];
  };

  const assemble = (group: PdfItem[]): PdfLine[] =>
    rowsByY(group).flatMap((r) =>
      splitRowSegments(r.items).map((seg) => {
        const text = cleanText(seg.map((i) => i.str).join(' '));
        const size = Math.round(Math.max(...seg.map((i) => i.size)) || 0);
        return { text, size, bullet: BULLET_RE.test(text), heading: false, bold: lineBold(seg) };
      })
    ).filter((l) => l.text.length > 0);

  if (isTwoCol) {
    const header: PdfItem[] = [], left: PdfItem[] = [], right: PdfItem[] = [], footer: PdfItem[] = [];
    valid.forEach((i) => {
      if (i.y > ySplitTop) header.push(i);
      else if (i.y < ySplitBottom) footer.push(i);
      else if (i.x + i.w / 2 < bestSplitX) left.push(i);
      else right.push(i);
    });
    return [...assemble(header), ...assemble(left), ...assemble(right), ...assemble(footer)];
  }

  /* ---- 3. Single column ---- */
  return assemble(valid);
}
