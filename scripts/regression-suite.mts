/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Full-corpus regression suite for AI Resume Import.
 *
 *   GEMINI_API_KEY=... npx tsx scripts/regression-suite.mts [dir] [--direct]
 *
 * Runs every resume in a directory through the shipped pipeline and reports
 * parsing accuracy. By default every request goes through the SERVER-SIDE PROXY
 * (api/parse-resume.ts, invoked in-process) rather than calling Gemini from the
 * client path — the same route a browser takes in a proxy deployment.
 *
 * Accuracy is measured against the source document, not against itself: the
 * PDF's own text layer is extracted independently (PyMuPDF) and used to check
 * how much of the original survived the round trip.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

import { toParsedResume } from '../src/services/ai/normalize';
import { SYSTEM_INSTRUCTION, buildUserPrompt } from '../src/services/ai/prompt';
import { RESUME_RESPONSE_SCHEMA } from '../src/services/ai/schema';
import { validateFile } from '../src/services/import/fileValidation';
import { toDocumentPayload } from '../src/services/import/documentSource';
import { assembleResume } from '../src/services/import/resumeAssembler';
import { findDuplicate } from '../src/services/import/duplicateDetection';
import { analyzeResumeATS } from '../src/atsChecker';
import type { ParsedResume } from '../src/services/import/types';
import type { Resume } from '../src/types';

const DIR = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'sample-resume';
const USE_DIRECT = process.argv.includes('--direct');
const API_KEY = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '';
const MODEL = process.env.VITE_GEMINI_MODEL || 'gemini-flash-latest';
/** Spacing between documents, to stay inside the per-minute token quota. */
const PACE_MS = Number(process.env.PACE_MS || 20_000);

if (!API_KEY) {
  console.log('\n⚠️  Set GEMINI_API_KEY to run the suite.\n');
  process.exit(0);
}

/* ------------------------------------------------------------------ */
/* Source-text extraction (ground truth for coverage)                  */
/* ------------------------------------------------------------------ */

function extractSourceText(file: string): string | null {
  if (path.extname(file).toLowerCase() !== '.pdf') return null;
  try {
    return execFileSync(
      'python3',
      ['-c', 'import fitz,sys; d=fitz.open(sys.argv[1]); print("\\n".join(p.get_text() for p in d))', file],
      { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }
    );
  } catch {
    return null; // scanned PDF or PyMuPDF unavailable — coverage simply not measured
  }
}

const STOP = new Set(['and','the','for','with','from','that','this','have','has','are','was','were','will','all','any','not','but','their','they','you','your','our','its','into','over','per','via','a','an','of','to','in','on','at','by','as','or','is','be','it']);

/** Content tokens: words worth checking for survival, ignoring noise. */
function contentTokens(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9@.+#/-]+/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length >= 4 && !STOP.has(t) && !/^\d+$/.test(t))
  );
}

/** Every string the imported resume carries, flattened. */
function resumeText(resume: Resume): string {
  const out: string[] = [];
  for (const s of resume.sections) {
    out.push(s.name);
    for (const it of s.items) {
      if (typeof it === 'string') out.push(it);
      else if (it && typeof it === 'object') {
        for (const [k, v] of Object.entries(it)) if (k !== 'id' && typeof v === 'string') out.push(v);
      }
    }
  }
  return out.join('\n');
}

/* ------------------------------------------------------------------ */
/* Transport                                                           */
/* ------------------------------------------------------------------ */

let proxyCalls = 0;
let directGeminiCalls = 0;

/** Invoke api/parse-resume.ts exactly as the deployed function would be. */
async function callViaProxy(body: unknown): Promise<Record<string, unknown>> {
  const { default: handler } = await import('../api/parse-resume');
  proxyCalls++;
  let status = 0;
  let payload: Record<string, unknown> = {};
  const res = {
    status(c: number) { status = c; return res; },
    json(b: unknown) { payload = b as Record<string, unknown>; },
    setHeader() {},
    end() {},
  };
  await (handler as (req: unknown, res: unknown) => Promise<void>)({ method: 'POST', body }, res);
  if (status !== 200) {
    const err = payload.error as { message?: string; code?: string } | undefined;
    throw new Error(`proxy ${status}: ${err?.code ?? ''} ${err?.message ?? JSON.stringify(payload).slice(0, 200)}`);
  }
  return payload;
}

async function callDirect(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  directGeminiCalls++;
  const parts: unknown[] = [];
  const p = body.payload as { kind: string; mimeType?: string; base64?: string };
  if (p.kind === 'binary') parts.push({ inlineData: { mimeType: p.mimeType, data: p.base64 } });
  parts.push({ text: body.userPrompt });
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': API_KEY },
    body: JSON.stringify({
      contents: [{ role: 'user', parts }],
      systemInstruction: { parts: [{ text: body.systemInstruction }] },
      generationConfig: { temperature: 0, responseMimeType: 'application/json', responseSchema: body.responseSchema },
    }),
  });
  if (!r.ok) throw new Error(`gemini ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const j = (await r.json()) as { candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[] };
  const text = (j.candidates?.[0]?.content?.parts || []).filter((x) => !x.thought).map((x) => x.text || '').join('');
  return { data: JSON.parse(text.replace(/^\s*```(?:json)?/i, '').replace(/```\s*$/, '')) };
}

/* ------------------------------------------------------------------ */
/* Per-document run                                                    */
/* ------------------------------------------------------------------ */

interface Report {
  file: string;
  format: string;
  sizeKB: number;
  ok: boolean;
  error?: string;
  durationMs: number;
  confidence: number;
  lowConfidenceSections: string[];
  name: string;
  contactFields: number;
  sections: { heading: string; type: string; items: number; confidence: number }[];
  customHeadings: string[];
  ats: number;
  atsGrade: string;
  /** % of source content tokens that survived into the imported resume. */
  coverage: number | null;
  issues: string[];
  warnings: string[];
}

const DATE_OK = /^(\d{2}-\d{4}|\d{4})?$/;

async function runOne(file: string): Promise<Report> {
  const buf = fs.readFileSync(file);
  const ext = path.extname(file).toLowerCase();
  const mime = ext === '.pdf'
    ? 'application/pdf'
    : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  const rep: Report = {
    file: path.basename(file), format: ext.slice(1), sizeKB: Math.round(buf.length / 1024),
    ok: false, durationMs: 0, confidence: 0, lowConfidenceSections: [], name: '',
    contactFields: 0, sections: [], customHeadings: [], ats: 0, atsGrade: '',
    coverage: null, issues: [], warnings: [],
  };

  try {
    const f = new File([new Uint8Array(buf)], path.basename(file), { type: mime });
    const payload = await toDocumentPayload(validateFile(f, 10 * 1024 * 1024), 15);

    if (payload.kind === 'binary' && !atob(payload.base64.slice(0, 8)).startsWith('%PDF-')) {
      rep.issues.push('payload was not the original PDF');
    }

    const body = {
      payload,
      systemInstruction: SYSTEM_INSTRUCTION,
      userPrompt: buildUserPrompt(payload),
      responseSchema: RESUME_RESPONSE_SCHEMA,
    };

    const t0 = Date.now();
    const result = USE_DIRECT ? await callDirect(body) : await callViaProxy(body);
    rep.durationMs = Date.now() - t0;

    const parsed: ParsedResume = toParsedResume(result.data as never, {
      fileName: rep.file, format: payload.format, provider: 'gemini', model: MODEL, durationMs: rep.durationMs,
    });
    const { resume } = assembleResume(parsed, 'en');

    /* --- structural checks --- */
    if (resume.sections[0]?.id !== 'personal') rep.issues.push('personal section is not first');
    if (new Set(resume.sections.map((s) => s.id)).size !== resume.sections.length) rep.issues.push('duplicate section ids');
    if (!resume.sections.every((s) => s.visible)) rep.issues.push('a section is not visible/editable');

    for (const p of parsed.sections) {
      const heading = p.heading.trim();
      if (heading && !resume.sections.some((s) => s.name === heading)) {
        rep.issues.push(`LOST SECTION: "${heading}"`);
      }
    }

    for (const s of resume.sections) {
      for (const it of s.items) {
        if (!it || typeof it !== 'object') continue;
        const item = it as Record<string, unknown>;
        for (const k of ['startDate', 'endDate', 'date']) {
          const v = item[k];
          if (typeof v === 'string' && v && !DATE_OK.test(v)) {
            rep.issues.push(`bad date in "${s.name}": ${k}="${v}"`);
          }
        }
      }
    }

    // Duplicate detection must fire on the resume against itself.
    if (!findDuplicate(parsed, [{ ...resume, id: 'x' }] as never)) {
      rep.issues.push('duplicate detection did not fire on self');
    }

    /* --- content coverage vs the source document --- */
    const src = extractSourceText(file);
    if (src && src.trim().length > 200) {
      const srcTokens = contentTokens(src);
      const gotTokens = contentTokens(resumeText(resume));
      const kept = [...srcTokens].filter((t) => gotTokens.has(t));
      rep.coverage = srcTokens.size ? Math.round((kept.length / srcTokens.size) * 100) : null;
    }

    const ats = analyzeResumeATS(resume);
    const c = parsed.contact;
    rep.ok = true;
    rep.confidence = parsed.confidence.score;
    rep.lowConfidenceSections = parsed.sections.filter((s) => s.confidence.score < 0.7).map((s) => s.heading);
    rep.name = c.fullName;
    rep.contactFields = [c.fullName, c.jobTitle, c.email, c.phone, c.location, c.linkedin, c.github, c.website].filter(Boolean).length;
    rep.sections = parsed.sections.map((p) => ({
      heading: p.heading,
      type: p.type,
      items: resume.sections.find((s) => s.name === p.heading.trim())?.items.length ?? 0,
      confidence: p.confidence.score,
    }));
    rep.customHeadings = parsed.sections.filter((p) => p.isCustomHeading).map((p) => p.heading);
    rep.ats = ats.score;
    rep.atsGrade = ats.grade;
    rep.warnings = parsed.warnings;
  } catch (err) {
    rep.error = err instanceof Error ? err.message : String(err);
  }
  return rep;
}

/* ------------------------------------------------------------------ */
/* Main                                                                */
/* ------------------------------------------------------------------ */

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main(): Promise<void> {
  const all = fs.readdirSync(DIR)
    .filter((f) => /\.(pdf|docx)$/i.test(f))
    .map((f) => path.join(DIR, f))
    .sort();

  // Byte-identical files are the same test; note them and run one.
  const seen = new Map<string, string>();
  const files: string[] = [];
  const dupes: [string, string][] = [];
  for (const f of all) {
    const h = crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
    const first = seen.get(h);
    if (first) dupes.push([path.basename(f), path.basename(first)]);
    else { seen.set(h, f); files.push(f); }
  }

  console.log(`\n${'═'.repeat(78)}`);
  console.log(`AI RESUME IMPORT — FULL REGRESSION SUITE`);
  console.log(`${'═'.repeat(78)}`);
  console.log(`corpus:    ${DIR} — ${all.length} files, ${files.length} unique`);
  console.log(`transport: ${USE_DIRECT ? 'DIRECT to Gemini' : 'SERVER-SIDE PROXY (api/parse-resume)'}`);
  console.log(`model:     ${MODEL}\n`);
  if (dupes.length) {
    dupes.forEach(([d, o]) => console.log(`  (skipped ${d} — byte-identical to ${o})`));
    console.log('');
  }

  const reports: Report[] = [];
  for (let i = 0; i < files.length; i++) {
    process.stdout.write(`[${i + 1}/${files.length}] ${path.basename(files[i])} … `);
    const r = await runOne(files[i]);
    reports.push(r);
    console.log(
      r.ok
        ? `\x1b[32mOK\x1b[0m ${(r.durationMs / 1000).toFixed(0)}s · ${r.sections.length} sections · ATS ${r.ats}%` +
          `${r.coverage !== null ? ` · ${r.coverage}% coverage` : ''}${r.issues.length ? ` · \x1b[33m${r.issues.length} issue(s)\x1b[0m` : ''}`
        : `\x1b[31mFAIL\x1b[0m ${r.error}`
    );
    if (i < files.length - 1) await sleep(PACE_MS);
  }

  fs.writeFileSync('import-regression-report.json', JSON.stringify({ reports, proxyCalls, directGeminiCalls }, null, 2));

  /* --- report --- */
  const passed = reports.filter((r) => r.ok);
  const failed = reports.filter((r) => !r.ok);
  const clean = passed.filter((r) => r.issues.length === 0);
  const withCoverage = passed.filter((r) => r.coverage !== null);
  const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0);

  console.log(`\n${'═'.repeat(78)}\nRESULTS\n${'═'.repeat(78)}`);
  console.log(`passed:            ${passed.length}/${reports.length}`);
  console.log(`clean (no issues): ${clean.length}/${reports.length}`);
  console.log(`avg confidence:    ${(avg(passed.map((r) => r.confidence * 100)))}%`);
  console.log(`avg ATS:           ${avg(passed.map((r) => r.ats))}%`);
  console.log(`avg coverage:      ${withCoverage.length ? avg(withCoverage.map((r) => r.coverage!)) + '%' : 'n/a'} (${withCoverage.length} PDFs measured)`);
  console.log(`avg parse time:    ${(avg(passed.map((r) => r.durationMs)) / 1000).toFixed(1)}s`);
  console.log(`\ntransport — proxy calls: ${proxyCalls} · direct Gemini calls: ${directGeminiCalls}`);

  console.log(`\n${'─'.repeat(78)}\nPER-RESUME\n${'─'.repeat(78)}`);
  for (const r of reports) {
    if (!r.ok) { console.log(`\n✗ ${r.file}\n  ERROR: ${r.error}`); continue; }
    console.log(`\n${r.issues.length ? '⚠' : '✓'} ${r.file}  [${r.format}, ${r.sizeKB} KB]`);
    console.log(`  ${r.name || '(no name)'} · ${r.contactFields}/8 contact fields · conf ${Math.round(r.confidence * 100)}% · ATS ${r.ats}% ${r.atsGrade}` +
                `${r.coverage !== null ? ` · coverage ${r.coverage}%` : ''}`);
    console.log(`  sections: ${r.sections.map((s) => `${s.heading}→${s.type}(${s.items})`).join(', ')}`);
    if (r.customHeadings.length) console.log(`  custom headings kept: ${r.customHeadings.join(', ')}`);
    if (r.lowConfidenceSections.length) console.log(`  \x1b[33mlow confidence: ${r.lowConfidenceSections.join(', ')}\x1b[0m`);
    r.warnings.forEach((w) => console.log(`  \x1b[33mmodel warning: ${w}\x1b[0m`));
    r.issues.forEach((i) => console.log(`  \x1b[31missue: ${i}\x1b[0m`));
  }

  console.log(`\n${'═'.repeat(78)}`);
  console.log(failed.length === 0 ? '\x1b[32mALL RESUMES PARSED\x1b[0m' : `\x1b[31m${failed.length} FAILED\x1b[0m`);
  console.log(`full JSON → import-regression-report.json\n`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
