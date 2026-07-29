/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * AI resume-import verification harness.
 *
 *   npm run test:import -- [path-to-resume.pdf]
 *
 * Runs a real resume through the live pipeline and asserts the structural
 * invariants the builder depends on. Unlike the previous heuristic parser, model
 * output is not byte-stable, so this checks SHAPE rather than exact equality:
 * required fields present, item shapes correct per section type, document order
 * preserved, headings non-empty, confidence in range.
 *
 * Requires GEMINI_API_KEY (or VITE_GEMINI_API_KEY) in the environment.
 */

import fs from 'node:fs';
import path from 'node:path';

import { toParsedResume } from '../src/services/ai/normalize';
import { SYSTEM_INSTRUCTION, buildUserPrompt } from '../src/services/ai/prompt';
import { RESUME_RESPONSE_SCHEMA } from '../src/services/ai/schema';
import { GeminiProvider } from '../src/services/ai/gemini';
import { DEFAULT_MODEL, type AIConfig } from '../src/services/ai/config';
import { validateFile } from '../src/services/import/fileValidation';
import { toDocumentPayload } from '../src/services/import/documentSource';
import { assembleResume } from '../src/services/import/resumeAssembler';
import { findDuplicate, nextAvailableTitle } from '../src/services/import/duplicateDetection';
import { analyzeResumeATS } from '../src/atsChecker';

const API_KEY = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '';
const MODEL = process.env.VITE_GEMINI_MODEL || 'gemini-flash-latest';
const filePath = process.argv[2] || 'sample-resume/vishal-tyagi-resume-exp-6-years.pdf';

/* ------------------------------------------------------------------ */
/* Assertions                                                          */
/* ------------------------------------------------------------------ */

let failures = 0;
let checks = 0;

function check(label: string, condition: boolean, detail = ''): void {
  checks++;
  if (condition) {
    console.log(`  \x1b[32m✓\x1b[0m ${label}`);
  } else {
    failures++;
    console.log(`  \x1b[31m✗\x1b[0m ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

/** The exact field set each section type's renderer reads. */
const REQUIRED_FIELDS: Record<string, string[]> = {
  experience: ['company', 'position', 'startDate', 'endDate', 'current', 'location', 'description'],
  education: ['institution', 'degree', 'fieldOfStudy', 'startDate', 'endDate', 'current'],
  skills: ['name', 'level'],
  projects: ['name', 'role', 'url', 'startDate', 'endDate', 'current', 'description'],
  certifications: ['name', 'issuer', 'date'],
  awards: ['title', 'issuer', 'date'],
  languages: ['name', 'proficiency'],
  volunteer: ['organization', 'role', 'startDate', 'endDate', 'current'],
  publications: ['title', 'publisher', 'date'],
  references: ['name', 'relationship', 'company', 'contact'],
  custom: ['title', 'subtitle', 'date', 'description'],
};

/* ------------------------------------------------------------------ */
/* Runner                                                              */
/* ------------------------------------------------------------------ */

/** Build the config the browser would resolve, but from process env. */
function buildConfig(): AIConfig {
  return {
    mode: 'direct',
    apiKey: API_KEY,
    model: MODEL,
    proxyUrl: '',
    requestTimeoutMs: 120_000,
    maxRetries: 2,
    maxFileBytes: 10 * 1024 * 1024,
    maxPdfPages: 15,
  };
}

/** Read a file off disk as the browser File the service layer expects. */
function toFile(filePath: string): File {
  const buffer = fs.readFileSync(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const mime =
    ext === '.pdf'
      ? 'application/pdf'
      : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  return new File([new Uint8Array(buffer)], path.basename(filePath), { type: mime });
}

async function main(): Promise<void> {
  if (!fs.existsSync(filePath)) {
    console.log(`\n⚠️  Fixture not found: ${filePath}`);
    console.log('   Drop a resume there, or pass one: npm run test:import -- path/to/resume.pdf\n');
    process.exit(0);
  }
  if (!API_KEY) {
    console.log('\n⚠️  No API key. Set GEMINI_API_KEY (or VITE_GEMINI_API_KEY) to run this check.\n');
    process.exit(0);
  }

  const config = buildConfig();
  const file = toFile(filePath);
  const fileName = file.name;
  console.log(`\n📄 ${fileName} (${(file.size / 1024).toFixed(0)} KB) · model ${MODEL}\n`);

  // Exercise the real pipeline modules rather than reimplementing them, so the
  // harness fails when the shipped code breaks.
  const validated = validateFile(file, config.maxFileBytes);
  const payload = await toDocumentPayload(validated, config.maxPdfPages);

  console.log('Document handoff');
  check(
    payload.kind === 'binary' ? 'PDF sent as ORIGINAL bytes' : 'DOCX sent as structured HTML',
    payload.kind === 'binary' ? payload.mimeType === 'application/pdf' : payload.text.includes('<')
  );
  if (payload.kind === 'binary') {
    check('payload really is a PDF', atob(payload.base64.slice(0, 8)).startsWith('%PDF-'));
  } else {
    check('markup carries heading structure', /<h[1-6]/i.test(payload.text));
  }

  const startedAt = Date.now();
  const result = await new GeminiProvider(config).analyzeDocument({
    payload,
    systemInstruction: SYSTEM_INSTRUCTION,
    userPrompt: buildUserPrompt(payload),
    responseSchema: RESUME_RESPONSE_SCHEMA,
  });
  const durationMs = Date.now() - startedAt;

  const parsed = toParsedResume(result.data, {
    fileName,
    format: payload.format,
    provider: result.provider,
    model: result.model,
    durationMs,
  });

  console.log(`⏱  Parsed in ${(durationMs / 1000).toFixed(1)}s\n`);

  /* --- Parsed model --- */
  console.log('Parsed resume');
  check('has a resume name', !!parsed.resumeName.trim());
  check('found a candidate name', !!parsed.contact.fullName.trim(), 'contact.fullName is empty');
  check('found at least one section', parsed.sections.length > 0);
  check('overall confidence in range', parsed.confidence.score >= 0 && parsed.confidence.score <= 1);
  check('every section has a heading', parsed.sections.every((s) => !!s.heading.trim()));
  check(
    'every section confidence in range',
    parsed.sections.every((s) => s.confidence.score >= 0 && s.confidence.score <= 1)
  );
  check(
    'no section is empty',
    parsed.sections.every((s) => s.entries.length > 0 || !!s.summaryText.trim())
  );

  /* --- Assembled resume --- */
  console.log('\nAssembled resume');
  const { resume } = assembleResume(parsed, 'en');

  check('personal section leads', resume.sections[0]?.id === 'personal');
  check('section ids are unique', new Set(resume.sections.map((s) => s.id)).size === resume.sections.length);
  check(
    'every item has a unique id',
    resume.sections
      .filter((s) => s.type !== 'summary' && s.type !== 'personal')
      .every((s) => {
        const ids = s.items.map((i) => (i as { id?: string }).id);
        return ids.every(Boolean) && new Set(ids).size === ids.length;
      })
  );
  check(
    'summary items are raw strings',
    resume.sections.filter((s) => s.type === 'summary').every((s) => typeof s.items[0] === 'string')
  );
  check(
    'headings survive assembly',
    parsed.sections.every(
      (p) => !p.heading.trim() || resume.sections.some((s) => s.name === p.heading.trim())
    )
  );

  // Document order must be preserved for every section that made it through.
  const builtOrder = resume.sections.slice(1).map((s) => s.name);
  const parsedOrder = parsed.sections.map((s) => s.heading.trim());
  const positions = builtOrder.map((name) => parsedOrder.indexOf(name)).filter((i) => i !== -1);
  check(
    'document order preserved',
    positions.every((position, i) => i === 0 || position >= positions[i - 1])
  );

  // Item shapes must match what the renderer reads, field for field.
  for (const section of resume.sections) {
    if (section.type === 'personal' || section.type === 'summary') continue;
    const required = REQUIRED_FIELDS[section.type];
    if (!required || section.items.length === 0) continue;
    const missing = required.filter((field) => !(field in (section.items[0] as object)));
    check(`"${section.name}" (${section.type}) item shape`, missing.length === 0, `missing: ${missing.join(', ')}`);
  }

  /* --- Duplicate detection --- */
  console.log('\nDuplicate detection');
  const existing = [{ ...resume, id: 'existing-1', title: resume.title }];
  const selfMatch = findDuplicate(parsed, existing as never);
  check('re-importing the same resume is detected', !!selfMatch, 'no match found');
  if (selfMatch) check('match explains itself', selfMatch.reasons.length > 0);

  const stranger = {
    ...resume,
    id: 'existing-2',
    title: 'Someone Else Resume',
    sections: resume.sections.map((s) =>
      s.type === 'personal'
        ? { ...s, items: [{ fullName: 'Someone Else', email: 'nobody@example.org', phone: '+1 555 000 1111' }] }
        : s
    ),
  };
  check('an unrelated resume is NOT flagged', !findDuplicate(parsed, [stranger] as never));
  check(
    'copy title avoids collision',
    nextAvailableTitle(resume.title, existing as never) !== resume.title
  );

  /* --- ATS --- */
  console.log('\nATS analysis');
  const ats = analyzeResumeATS(resume);
  check('ATS runs on the imported resume', typeof ats.score === 'number');
  check('ATS score in range', ats.score >= 0 && ats.score <= 100);
  check('ATS returns a grade', !!ats.grade);
  console.log(`  → ${ats.score}% (${ats.grade}), ${ats.suggestions.length} suggestions`);

  /* --- Editability --- */
  console.log('\nEditability');
  const RENDERED_TYPES = new Set([
    'experience', 'education', 'skills', 'projects', 'certifications', 'awards',
    'languages', 'volunteer', 'publications', 'references', 'custom', 'summary', 'personal',
  ]);
  check(
    'every section has a renderable type',
    resume.sections.every((s) => RENDERED_TYPES.has(s.type)),
    resume.sections.filter((s) => !RENDERED_TYPES.has(s.type)).map((s) => s.type).join(', ')
  );
  check('every section is visible', resume.sections.every((s) => s.visible));
  check('every section has a non-empty name', resume.sections.every((s) => !!s.name.trim()));
  check(
    'no section is left empty',
    resume.sections.every((s) => s.type === 'personal' || s.items.length > 0)
  );

  /* --- Summary --- */
  console.log('\nExtracted structure');
  console.log(`  ${parsed.contact.fullName || '—'} · ${parsed.contact.jobTitle || 'no title'}`);
  console.log(`  ${parsed.contact.email || 'no email'} · ${parsed.contact.phone || 'no phone'}`);
  console.log(
    `  Design: ${parsed.styleHints.columnCount ?? '?'}-col, ${parsed.styleHints.fontFamily ?? '?'}, accent ${parsed.styleHints.primaryColor ?? 'none'} → template "${resume.templateId}"`
  );
  // Report ASSEMBLED item counts, not raw entry counts — one entry can expand
  // into many items (a comma-separated skills line), so entry counts mislead.
  for (const section of parsed.sections) {
    const built = resume.sections.find((s) => s.name === (section.heading.trim() || section.type));
    const count = section.type === 'summary' ? '1 block' : `${built?.items.length ?? 0} items`;
    const flag =
      section.confidence.score < 0.7 ? ` \x1b[33m⚠ ${Math.round(section.confidence.score * 100)}%\x1b[0m` : '';
    console.log(`  • ${section.heading} → ${section.type} (${count})${flag}`);
  }
  if (parsed.warnings.length) {
    console.log('\n  Warnings:');
    parsed.warnings.forEach((w) => console.log(`   - ${w}`));
  }

  console.log(
    failures === 0
      ? `\n\x1b[32m✓ ${checks} checks passed\x1b[0m\n`
      : `\n\x1b[31m✗ ${failures} of ${checks} checks failed\x1b[0m\n`
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(`\n\x1b[31m✗ Harness error:\x1b[0m ${err instanceof Error ? err.message : err}\n`);
  process.exit(1);
});
