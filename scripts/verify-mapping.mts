/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Offline regression tests for the import mapping layer.
 *
 *   npm run test:mapping
 *
 * No API key and no network: these feed hand-written model responses through
 * normalize + assemble and assert the exact output. They lock in behaviour that
 * live tests cannot, because model output varies between runs.
 */
import { toParsedResume } from '../src/services/ai/normalize';
import { assembleResume } from '../src/services/import/resumeAssembler';
import type { AIResumeResponse } from '../src/services/ai/schema';

let fail = 0;
const check = (label: string, cond: boolean, detail = '') => {
  console.log(cond ? `  \x1b[32m✓\x1b[0m ${label}` : `  \x1b[31m✗\x1b[0m ${label} ${detail}`);
  if (!cond) fail++;
};
const ctx = { fileName: 'f.pdf', format: 'pdf' as const, provider: 'x', model: 'm', durationMs: 0 };
const base = (sections: unknown[]): AIResumeResponse => ({
  resumeName: 'T', confidence: 0.9, confidenceNote: null, warnings: null,
  personal: { fullName: 'Ada Lovelace', professionalTitle: null, email: 'ada@example.com', phone: '+44 20 7946 0000', address: null, city: 'London', country: 'UK', linkedin: null, github: null, portfolio: null },
  styleHints: { primaryColor: null, textColor: null, fontFamily: null, columnCount: null, headingAlignment: null, density: null },
  sections: sections as never,
});

console.log('\nProse-only non-summary section (regression: was silently dropped)');
{
  const r = assembleResume(toParsedResume(base([
    { heading: 'JOB PROFILE', kind: 'other', summaryText: 'Senior QA lead with 6 years experience.', entries: [], confidence: 0.9, confidenceNote: null },
  ]), ctx), 'en').resume;
  const s = r.sections.find((x) => x.name === 'JOB PROFILE');
  check('section survives', !!s);
  check('prose is carried into an item', !!s && JSON.stringify(s.items).includes('Senior QA lead'));
}

console.log('\nSkill group prefixing');
{
  const mk = (heading: string, title: string) => assembleResume(toParsedResume(base([
    { heading, kind: 'skills', summaryText: null, entries: [{ title, organization: null, subtitle: null, role: null, location: null, startDate: null, endDate: null, current: null, dateText: null, description: null, bullets: null, url: null, level: null, tags: ['Python', 'Go'] }], confidence: 0.9, confidenceNote: null },
  ]), ctx), 'en').resume.sections.find((x) => x.name === heading)!;
  const same = mk('Technical Toolbox', 'Technical Toolbox');
  check('no prefix when entry restates the heading', (same.items[0] as { name: string }).name === 'Python',
        `got "${(same.items[0] as { name: string }).name}"`);
  const grouped = mk('Skills', 'Backend Languages');
  check('prefix kept for a real sub-group', (grouped.items[0] as { name: string }).name === 'Backend Languages: Python',
        `got "${(grouped.items[0] as { name: string }).name}"`);
}

console.log('\nEntry title that merely restates the section heading');
{
  const r = assembleResume(toParsedResume(base([
    { heading: 'Career Highlights', kind: 'achievements', summaryText: null, entries: [
      { title: 'Career Highlights', bullets: ['Cut spend 38%', 'Shipped the backbone'] },
    ], confidence: 1, confidenceNote: null },
  ]), ctx), 'en').resume;
  const item = r.sections.find((s) => s.name === 'Career Highlights')!.items[0] as Record<string, string>;
  check('heading is not repeated as the item title', item.title === '', `got "${item.title}"`);
  check('bullets survive', item.description === '- Cut spend 38%\n- Shipped the backbone', `got ${JSON.stringify(item.description)}`);
}

console.log('\nDuplicate section types keep distinct headings + ids');
{
  const r = assembleResume(toParsedResume(base([
    { heading: 'Key Skills', kind: 'skills', summaryText: null, entries: [{ title: 'Recruiting' }], confidence: 1, confidenceNote: null },
    { heading: 'Software', kind: 'skills', summaryText: null, entries: [{ title: 'SAP' }], confidence: 1, confidenceNote: null },
  ]), ctx), 'en').resume;
  const skills = r.sections.filter((s) => s.type === 'skills');
  check('both sections kept', skills.length === 2);
  check('ids are distinct', skills[0].id !== skills[1].id);
  check('headings preserved', skills.map((s) => s.name).join('|') === 'Key Skills|Software');
}

console.log('\nDate + level normalization');
{
  const r = assembleResume(toParsedResume(base([
    { heading: 'Experience', kind: 'experience', summaryText: null, entries: [
      { title: 'Engineer', organization: 'Acme', startDate: 'March 2021', endDate: 'Present', dateText: 'March 2021 – Present', bullets: ['Shipped a thing'] },
    ], confidence: 1, confidenceNote: null },
    { heading: 'Languages', kind: 'languages', summaryText: null, entries: [
      { title: 'French', level: 'limited' }, { title: 'German', level: '4/5' },
    ], confidence: 1, confidenceNote: null },
  ]), ctx), 'en').resume;
  const exp = r.sections.find((s) => s.type === 'experience')!.items[0] as Record<string, unknown>;
  check('month name → MM-YYYY', exp.startDate === '03-2021', `got ${exp.startDate}`);
  check('"Present" → current, empty end', exp.current === true && exp.endDate === '');
  check('bullets → "- " lines', exp.description === '- Shipped a thing', `got ${JSON.stringify(exp.description)}`);
  const langs = r.sections.find((s) => s.type === 'languages')!.items as Record<string, unknown>[];
  check('synonym level coerced', langs[0].proficiency === 'Conversational', `got ${langs[0].proficiency}`);
  check('ratio level coerced', ['Fluent', 'Native'].includes(String(langs[1].proficiency)), `got ${langs[1].proficiency}`);
}

console.log(fail === 0 ? '\n\x1b[32m✓ all regression checks passed\x1b[0m\n' : `\n\x1b[31m✗ ${fail} failed\x1b[0m\n`);
process.exit(fail ? 1 : 0);
