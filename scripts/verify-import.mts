/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Smart-import regression / determinism harness.
 *
 *   npx tsx scripts/verify-import.mts [path-to.pdf]
 *
 * Parses a PDF twice and asserts the parsed structure is (a) byte-identical
 * between the two runs (determinism) and (b) matches the golden snapshot for the
 * bundled sample resume. Exits non-zero on any mismatch so it can gate CI.
 */
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { pageToLines, PdfItem } from '../src/import/pdfLayout';
import { analyzeResume, ParsedResume } from '../src/import/analyzeResume';
import type { DocLine } from '../src/import/readDocument';

const pdfPath = process.argv[2] || 'sample-resume/Resume.pdf';

if (!fs.existsSync(pdfPath)) {
  console.log(`\n⚠️  Fixture not found: ${pdfPath}`);
  console.log('   Smart-import regression test skipped. Drop a PDF at that path (or pass one as an');
  console.log('   argument: `npm run test:import -- path/to/resume.pdf`) to run the determinism check.\n');
  process.exit(0);
}

async function parse(file: string): Promise<ParsedResume> {
  const buf = fs.readFileSync(file);
  const pdf = await getDocument({ data: new Uint8Array(buf), useSystemFonts: true }).promise;
  const lines: DocLine[] = [];
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
    pageToLines(items).forEach((l) =>
      lines.push({ text: l.text, size: l.size, bold: false, bullet: l.bullet, headingHint: l.heading }));
  }
  return analyzeResume(lines);
}

/** Structural fingerprint — ignores generated ids (there are none in ParsedResume). */
const fingerprint = (r: ParsedResume) => JSON.stringify({
  contact: r.contact,
  sections: r.sections.map((s) => ({ title: s.title, type: s.type, items: s.items, layout: s.layout || null })),
});

let failures = 0;
const ok = (label: string) => console.log(`  ✓ ${label}`);
const fail = (label: string, detail?: string) => { failures++; console.error(`  ✗ ${label}${detail ? `\n    ${detail}` : ''}`); };

const run = await parse(pdfPath);
const rerun = await parse(pdfPath);

console.log(`\nDeterminism (${pdfPath}):`);
fingerprint(run) === fingerprint(rerun)
  ? ok('two consecutive parses are byte-identical')
  : fail('parses differ between runs');

// Golden snapshot — only checked for the bundled sample resume.
if (path.basename(pdfPath) === 'Resume.pdf') {
  console.log('\nGolden snapshot (sample-resume/Resume.pdf):');
  const c = run.contact;
  c.fullName === 'VISHAL TYAGI' ? ok('name = VISHAL TYAGI') : fail(`name = ${c.fullName}`);
  c.email === 'vishaltyagi349@gmail.com' ? ok('email') : fail(`email = ${c.email}`);
  c.phone === '8859428724' ? ok('phone') : fail(`phone = ${c.phone}`);
  c.location === 'Roorkee, Uttarakhand' ? ok('location') : fail(`location = ${c.location}`);

  const expected = [
    { title: 'JOB PROFILE', type: 'summary' },
    { title: 'SUMMARY', type: 'summary' },
    { title: 'SKILLS', type: 'skills', count: 18 },
    { title: 'WORK EXPERIENCE', type: 'experience', count: 2 },
    { title: 'EDUCATION', type: 'education', count: 1 },
    { title: 'PROJECTS', type: 'projects', count: 10 },
    { title: 'HOBBIES AND INTERESTS', type: 'custom', count: 4 },
    { title: 'LANGUAGES', type: 'languages', count: 2 },
  ];
  const got = run.sections.map((s) => ({ title: s.title, type: s.type, count: s.items.length }));
  expected.forEach((e, i) => {
    const g = got[i];
    if (!g) return fail(`section ${i} missing (expected ${e.title})`);
    const titleOk = g.title === e.title && g.type === e.type;
    const countOk = e.count == null || g.count === e.count;
    titleOk && countOk
      ? ok(`${e.title} [${e.type}]${e.count != null ? ` ×${e.count}` : ''}`)
      : fail(`section ${i}: expected ${JSON.stringify(e)}, got ${JSON.stringify(g)}`);
  });
  got.length === expected.length ? ok(`exactly ${expected.length} sections`) : fail(`section count = ${got.length}`);

  const exp = run.sections.find((s) => s.type === 'experience');
  exp?.items[0]?.position === 'SDET-01' && exp?.items[0]?.company === 'CDBE Technologies Pvt Ltd'
    ? ok('experience[0] = SDET-01 @ CDBE Technologies Pvt Ltd')
    : fail(`experience[0] = ${JSON.stringify(exp?.items[0])}`);
}

console.log(failures === 0 ? '\n✅ ALL CHECKS PASSED\n' : `\n❌ ${failures} CHECK(S) FAILED\n`);
process.exit(failures === 0 ? 0 : 1);
