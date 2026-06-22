/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Smart resume analyzer. Turns structured `DocLine`s into a fully dynamic
 * `ParsedResume` — detecting contact details and ANY heading (known or custom),
 * preserving section order, and parsing each section's entries heuristically.
 *
 * Nothing here forces the resume into a fixed template: unknown headings become
 * editable custom sections, and the section list is whatever the document had.
 */

import { SectionType, SectionLayout } from '../types';
import type { DocLine } from './readDocument';

export interface ParsedContact {
  fullName: string;
  jobTitle: string;
  email: string;
  phone: string;
  location: string;
  website: string;
  linkedin: string;
  github: string;
}

export interface ParsedSection {
  /** Original heading text from the document (preserved, editable). */
  title: string;
  /** Mapped rendering type — 'custom' for anything not clearly standard. */
  type: SectionType;
  /** Item objects shaped to match the builder's section types. */
  items: any[];
  /** Optional display hint inferred from the source (e.g. bulleted skill list). */
  layout?: SectionLayout;
}

export interface ParsedResume {
  resumeName: string;
  contact: ParsedContact;
  sections: ParsedSection[];
}

/* ----------------------------- regexes ----------------------------- */

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
const PHONE_RE = /(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?){2,4}\d{2,4}/;
const LINKEDIN_RE = /(?:https?:\/\/)?(?:[a-z]{2,3}\.)?linkedin\.com\/(?:in|pub)\/[A-Za-z0-9_-]+\/?/i;
const GITHUB_RE = /(?:https?:\/\/)?(?:www\.)?github\.com\/[A-Za-z0-9_-]+\/?/i;
const URL_RE = /(?:https?:\/\/)?(?:www\.)?[a-z0-9-]+\.[a-z]{2,}(?:\/[^\s,)]*)?/i;

const MONTH = '(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\\.?';
const YEAR = '(?:19|20)\\d{2}';
const NUM_DATE = '\\d{1,2}[\\/.](?:19|20)\\d{2}';   // 02/2023, 9.2019
const DATE_TOKEN = `(?:${NUM_DATE}|(?:${MONTH}\\s*)?${YEAR})`;
const PRESENT = '(?:present|current|ongoing|till\\s*date|to\\s*date|now)';
const DATE_RANGE_RE = new RegExp(`(${DATE_TOKEN})\\s*(?:[-–—]|to|until)\\s*(${DATE_TOKEN}|${PRESENT})`, 'i');
const ANY_DATE_RE = new RegExp(`${DATE_TOKEN}|${PRESENT}`, 'i');
const GRADE_RE = /(?:gpa|cgpa|grade|percentage|score)\s*[:\-]?\s*([0-9]+(?:\.[0-9]+)?\s*(?:\/\s*[0-9.]+)?%?)/i;

/* ------------------------- heading detection ----------------------- */

const SECTION_SYNONYMS: { type: SectionType; words: string[] }[] = [
  { type: 'summary', words: ['summary', 'professional summary', 'profile', 'professional profile', 'about', 'about me', 'objective', 'career objective', 'career summary', 'overview', 'professional overview', 'executive summary'] },
  { type: 'experience', words: ['experience', 'work experience', 'professional experience', 'employment', 'employment history', 'work history', 'career history', 'professional background', 'work', 'professional experiences'] },
  { type: 'education', words: ['education', 'academic', 'academics', 'academic background', 'education & training', 'qualifications', 'educational qualifications', 'academic qualifications'] },
  { type: 'skills', words: ['skills', 'technical skills', 'core competencies', 'competencies', 'technical expertise', 'expertise', 'key skills', 'areas of expertise', 'technologies', 'tech stack', 'technical proficiencies', 'proficiencies', 'skills & abilities'] },
  { type: 'projects', words: ['projects', 'key projects', 'personal projects', 'academic projects', 'selected projects', 'notable projects', 'project experience'] },
  { type: 'certifications', words: ['certifications', 'certificates', 'licenses', 'licenses & certifications', 'certifications & licenses', 'professional certifications'] },
  { type: 'awards', words: ['awards', 'honors', 'honours', 'honors & awards', 'awards & honors', 'awards and honors', 'recognition', 'awards & recognition'] },
  { type: 'languages', words: ['languages', 'language proficiency', 'languages known'] },
  { type: 'volunteer', words: ['volunteer', 'volunteering', 'volunteer experience', 'community involvement', 'community service', 'social work'] },
  { type: 'publications', words: ['publications', 'papers', 'research', 'research experience', 'patents', 'publications & patents'] },
  { type: 'references', words: ['references', 'referees', 'reference'] },
];

const normHeading = (s: string) =>
  s.replace(/^[\s#*=\-\[\]<>:_.]+|[\s#*=\-\[\]<>:_.]+$/g, '').trim();

// Distinctive single keywords → type, used only for SHORT headings so a company
// name like "CDBE Technologies Pvt Ltd" never maps to Skills via "technologies".
const TOKEN_TYPE: Record<string, SectionType> = {
  summary: 'summary', profile: 'summary', objective: 'summary', about: 'summary', overview: 'summary',
  experience: 'experience', employment: 'experience',
  education: 'education', academics: 'education', academic: 'education', qualifications: 'education',
  skills: 'skills', competencies: 'skills', expertise: 'skills', proficiencies: 'skills',
  projects: 'projects',
  certifications: 'certifications', certificates: 'certifications',
  awards: 'awards', honors: 'awards', honours: 'awards',
  languages: 'languages',
  volunteer: 'volunteer', volunteering: 'volunteer',
  publications: 'publications', patents: 'publications',
  references: 'references', referees: 'references',
};

function mapHeadingType(text: string): SectionType {
  const lower = normHeading(text).toLowerCase().replace(/[:.]+$/, '').trim();
  for (const grp of SECTION_SYNONYMS) {
    if (grp.words.includes(lower)) return grp.type;
  }
  const words = lower.split(/\s+/);
  if (words.length <= 3) {
    for (const w of words) if (TOKEN_TYPE[w]) return TOKEN_TYPE[w];
  }
  return 'custom';
}

const looksLikeContact = (t: string) =>
  EMAIL_RE.test(t) || PHONE_RE.test(t) || /linkedin\.com|github\.com|https?:\/\//i.test(t) || t.includes('@');

function isHeading(line: DocLine, bodySize: number): boolean {
  const t = normHeading(line.text);
  if (!t || line.bullet) return false;
  if (t.length > 42) return false;
  if (looksLikeContact(t)) return false;
  if (/[•;]/.test(t)) return false;     // mid-line bullet / list → body content
  if (/[.,:]$/.test(t) && mapHeadingType(t) === 'custom') return false; // sentence-ish, not a heading
  const words = t.split(/\s+/);
  // A recognised section word makes it a heading (kept short to avoid false hits).
  if (mapHeadingType(t) !== 'custom' && words.length <= 4) return true;
  // Explicit structural hint from the source (Word heading style / bold-only line).
  if (line.headingHint && words.length <= 7) return true;
  // PDF: clearly larger than the body text.
  if (bodySize > 0 && line.size >= bodySize * 1.25 && words.length <= 5) return true;
  // ALL CAPS short line (a very common heading style).
  const letters = t.replace(/[^A-Za-z]/g, '');
  if (letters.length >= 3 && t === t.toUpperCase() && /[A-Z]/.test(t) && words.length <= 5 && !ANY_DATE_RE.test(t)) {
    return true;
  }
  return false;
}

/* ------------------------- small utilities ------------------------- */

const stripBullet = (t: string) => t.replace(/^[\s]*[•·▪◦‣⁃○●*\-–—]\s+/, '').trim();

function extractDates(text: string): { start: string; end: string; current: boolean } {
  const m = text.match(DATE_RANGE_RE);
  if (m) {
    const end = m[2];
    const current = new RegExp(PRESENT, 'i').test(end);
    return { start: m[1].trim(), end: current ? '' : end.trim(), current };
  }
  const single = text.match(new RegExp(DATE_TOKEN, 'i'));
  if (single) return { start: single[0].trim(), end: '', current: /present|current|now/i.test(text) };
  return { start: '', end: '', current: /present|current|now/i.test(text) };
}

function splitParts(text: string): string[] {
  return text.split(/\s+\|\s+|\s+[–—]\s+|\s+·\s+|\s+at\s+|,\s+|\s{2,}|\t/i)
    .map((p) => p.trim())
    .filter(Boolean);
}

/* --------------------------- item parsers -------------------------- */

const ROLE_LABEL_RE = /^(job\s*role|role|responsibilities|duties|key\s+responsibilities|description|profile)\s*:?\s*$/i;
const COMPANY_RE = /\b(inc|llc|ltd|limited|corp|co|company|technologies|technology|solutions|systems|services|university|college|institute|labs|gmbh|pvt|private|consulting|group|enterprises|industries|nerds)\b/i;

function parseExperience(lines: DocLine[]) {
  const items: any[] = [];
  let cur: any = null;
  const pushDesc = (t: string) => { if (cur) cur.description = cur.description ? `${cur.description}\n${t}` : t; };

  lines.forEach((ln) => {
    const raw = ln.text.trim();
    if (!raw) return;
    if (ln.bullet) { pushDesc(stripBullet(raw)); return; }
    if (ROLE_LABEL_RE.test(raw)) return; // drop "Job Role:" style labels

    const hasRange = DATE_RANGE_RE.test(raw);
    // A new entry starts on a dated title line (or the very first content line).
    if (hasRange || !cur) {
      if (cur) items.push(cur);
      const d = extractDates(raw);
      const withoutDate = raw.replace(DATE_RANGE_RE, '').replace(/^[,\s]+|[,\s•·|–—-]+$/g, '').trim();
      const parts = splitParts(withoutDate);
      cur = {
        position: parts[0] || withoutDate || '',
        company: parts[1] || '',
        location: parts[2] || '',
        startDate: d.start,
        endDate: d.end,
        current: d.current,
        description: '',
      };
      return;
    }
    // Line under a title with no company yet → company (+ location); else description.
    const companyLike = COMPANY_RE.test(raw) || (raw.length < 60 && !/[.!?]/.test(raw) && raw.split(/\s+/).length <= 9);
    if (!cur.company && companyLike) {
      const parts = splitParts(raw);
      cur.company = parts[0] || raw;
      if (!cur.location && parts[1]) cur.location = parts[1];
    } else {
      pushDesc(raw);
    }
  });
  if (cur) items.push(cur);
  return items;
}

function parseEducation(lines: DocLine[]) {
  const items: any[] = [];
  let cur: any = null;
  const degreeRe = /\b(b\.?tech|m\.?tech|b\.?sc|m\.?sc|b\.?e\b|m\.?e\b|b\.?a\b|m\.?a\b|bachelor|master|ph\.?d|doctor|diploma|mba|bca|mca|associate|degree|secondary|high school)\b/i;
  const instRe = /\b(university|college|institute|school|academy|polytechnic)\b/i;
  const cleanEdu = (s: string) => s
    .replace(DATE_RANGE_RE, '')
    .replace(new RegExp(`\\b${YEAR}\\b`, 'g'), '')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[,\s]+|[,\s]+$/g, '')
    .trim();

  lines.forEach((ln) => {
    const raw = ln.text.trim();
    if (!raw) return;
    if (ln.bullet) { if (cur) cur.description = cur.description ? `${cur.description}\n${stripBullet(raw)}` : stripBullet(raw); return; }
    const dates = extractDates(raw);
    const grade = raw.match(GRADE_RE);
    const isDegree = degreeRe.test(raw);
    const isInst = instRe.test(raw);
    // A new entry begins on an institution line, or a second degree line.
    const startNew = !cur || (isInst && (cur.institution || cur.degree)) || (isDegree && cur.degree);
    if (startNew) {
      if (cur) items.push(cur);
      cur = {
        institution: '', degree: '', fieldOfStudy: '',
        startDate: dates.start, endDate: dates.end, current: dates.current,
        grade: grade ? grade[1] : '', description: '',
      };
      if (isDegree) cur.degree = cleanEdu(raw);
      else cur.institution = cleanEdu(raw);
      return;
    }
    // Augment the current entry.
    if (dates.start && !cur.startDate) { cur.startDate = dates.start; cur.endDate = dates.end; cur.current = dates.current; }
    if (grade && !cur.grade) cur.grade = grade[1];
    if (isDegree && !cur.degree) cur.degree = cleanEdu(raw);
    else if (isInst && !cur.institution) cur.institution = cleanEdu(raw);
    else if (cleanEdu(raw)) cur.description = cur.description ? `${cur.description}\n${raw}` : raw;
  });
  if (cur) items.push(cur);
  return items;
}

function parseSkills(lines: DocLine[]) {
  const seen = new Set<string>();
  const items: any[] = [];
  const add = (name: string) => {
    const n = name.replace(/\s+/g, ' ').trim();
    const key = n.toLowerCase();
    if (n && n.length <= 200 && !seen.has(key)) { seen.add(key); items.push({ name: n, level: '' }); }
  };
  lines.forEach((ln) => {
    const t = stripBullet(ln.text).trim();
    if (!t) return;
    const colon = t.match(/^([A-Za-z &/]{2,30}):\s*(.+)$/);
    // A bulleted line, a full sentence, or a long competency is kept verbatim as one
    // skill (these resumes list capabilities, not short tags). Short comma-separated
    // tag lines are split into individual skills.
    const isSentence = ln.bullet || t.length > 45 || /[.!?]/.test(t);
    if (isSentence) {
      if (colon && /,/.test(colon[2]) && colon[2].length <= 70) {
        colon[2].split(/[,;|]/).forEach((p) => add(p));
      } else {
        add(t);
      }
      return;
    }
    const body = colon ? colon[2] : t;
    body.split(/[,;|•·]|\s{2,}/).forEach((p) => add(p));
  });
  return items.slice(0, 80);
}

/** Split "Project Name (2019-20) - description" into [name, description]. */
function splitProjectNameDesc(body: string): [string, string] {
  // Prefer a " - " / " – " / ": " separator that comes after any trailing "(...)"
  // parenthetical (which often holds a date / status) so the name stays whole.
  const close = body.lastIndexOf(')');
  const from = close >= 0 ? close : 0;
  const dashRe = /\s[-–—]\s/g;
  let m: RegExpExecArray | null, sep = -1;
  while ((m = dashRe.exec(body)) !== null) { if (m.index >= from) { sep = m.index; break; } }
  if (sep >= 0) return [body.slice(0, sep).trim(), body.slice(sep + 3).trim()];
  const colon = body.indexOf(': ');
  if (colon > 0 && colon < 80) return [body.slice(0, colon).trim(), body.slice(colon + 2).trim()];
  return [body, ''];
}

function parseProjects(lines: DocLine[]) {
  const items: any[] = [];
  let cur: any = null;
  lines.forEach((ln) => {
    const raw = ln.text.trim();
    if (!raw) return;
    const url = raw.match(URL_RE);
    if (ln.bullet) {
      // Each bullet is a distinct project: "Name (status/date) - description".
      if (cur) items.push(cur);
      const body = stripBullet(raw);
      const dates = extractDates(body);
      const [rawName, desc] = splitProjectNameDesc(body);
      const name = rawName
        .replace(/\(\s+/g, '(').replace(/\s+\)/g, ')')   // tidy "( 2019 )" → "(2019)"
        .replace(/\s{2,}/g, ' ')
        .replace(/[\s,;:–—-]+$/, '')
        .trim();
      cur = { name: name || body, role: '', url: url ? url[0] : '', startDate: dates.start, endDate: dates.end, current: dates.current, description: desc };
      return;
    }
    if (!cur) { cur = { name: raw, role: '', url: url ? url[0] : '', startDate: '', endDate: '', current: false, description: '' }; return; }
    // Continuation line → append to the current project's description.
    if (url && !cur.url) cur.url = url[0];
    cur.description = cur.description ? `${cur.description} ${raw}` : raw;
  });
  if (cur) items.push(cur);
  return items;
}

function parseCertifications(lines: DocLine[]) {
  return lines.map((ln) => {
    const t = stripBullet(ln.text);
    const dates = extractDates(t);
    const name = t.replace(DATE_RANGE_RE, '').replace(/[–—|]\s*$/, '').trim();
    const parts = name.split(/\s+[–—|]\s+|,\s+/);
    return { name: parts[0] || name, issuer: parts[1] || '', date: dates.start, url: '' };
  }).filter((i) => i.name);
}

function parseAwards(lines: DocLine[]) {
  return lines.map((ln) => {
    const t = stripBullet(ln.text);
    const dates = extractDates(t);
    const title = t.replace(DATE_RANGE_RE, '').trim();
    const parts = title.split(/\s+[–—|]\s+|,\s+/);
    return { title: parts[0] || title, issuer: parts[1] || '', date: dates.start, description: '' };
  }).filter((i) => i.title);
}

function parseLanguages(lines: DocLine[]) {
  const out: any[] = [];
  lines.forEach((ln) => {
    stripBullet(ln.text).split(/[,;|]/).forEach((piece) => {
      const c = piece.trim();
      if (!c) return;
      const m = c.match(/^(.+?)\s*[\(\-–—:]\s*([A-Za-z ]+)\)?$/);
      if (m) out.push({ name: m[1].trim(), proficiency: m[2].trim() });
      else out.push({ name: c, proficiency: '' });
    });
  });
  return out;
}

function parseReferences(lines: DocLine[]) {
  const items: any[] = [];
  let cur: any = null;
  lines.forEach((ln) => {
    const raw = stripBullet(ln.text);
    if (!cur || (!ln.bullet && !looksLikeContact(raw) && raw.split(/\s+/).length <= 5 && !/[:]/.test(raw))) {
      if (cur) items.push(cur);
      cur = { name: raw, relationship: '', company: '', contact: '' };
    } else if (looksLikeContact(raw)) {
      cur.contact = cur.contact ? `${cur.contact} ${raw}` : raw;
    } else {
      cur.relationship = cur.relationship ? `${cur.relationship}, ${raw}` : raw;
    }
  });
  if (cur) items.push(cur);
  return items;
}

function parsePublications(lines: DocLine[]) {
  return lines.map((ln) => {
    const t = stripBullet(ln.text);
    const url = t.match(URL_RE);
    const dates = extractDates(t);
    return { title: t.replace(URL_RE, '').replace(DATE_RANGE_RE, '').trim() || t, publisher: '', date: dates.start, url: url ? url[0] : '', description: '' };
  }).filter((i) => i.title);
}

function parseVolunteer(lines: DocLine[]) {
  // Same shape/heuristics as experience but mapped to volunteer fields.
  return parseExperience(lines).map((e) => ({
    organization: e.company || e.position,
    role: e.company ? e.position : '',
    startDate: e.startDate,
    endDate: e.endDate,
    current: e.current,
    description: e.description,
  }));
}

function parseCustom(lines: DocLine[]) {
  const items: any[] = [];
  let cur: any = null;
  lines.forEach((ln) => {
    const raw = stripBullet(ln.text);
    if (ln.bullet) {
      if (cur) cur.description = cur.description ? `${cur.description}\n${raw}` : raw;
      else cur = { title: raw, subtitle: '', date: '', description: '' };
      return;
    }
    // Non-bullet, heading-ish line starts a new entry.
    if (cur) items.push(cur);
    const dates = extractDates(raw);
    cur = { title: raw.replace(DATE_RANGE_RE, '').trim() || raw, subtitle: '', date: dates.start, description: '' };
  });
  if (cur) items.push(cur);
  // If everything collapsed into a single entry with only a description, keep it.
  return items.filter((i) => i.title || i.description);
}

function parseSummary(lines: DocLine[]) {
  const text = lines.map((l) => stripBullet(l.text)).join(' ').replace(/\s+/g, ' ').trim();
  return text ? [text] : [''];
}

/** Infer a display layout from the parsed content (e.g. bulleted competency lists). */
function inferLayout(type: SectionType, items: any[]): SectionLayout | undefined {
  if (type === 'skills' && items.length) {
    const avg = items.reduce((s, it) => s + (it.name?.length || 0), 0) / items.length;
    const long = items.some((it) => (it.name?.length || 0) > 40);
    // Sentence-style competencies read far better as a bulleted (optionally 2-col) list.
    if (avg > 22 || long) return { skillStyle: 'list', columns: items.length > 6 ? 2 : 1 };
  }
  return undefined;
}

function parseItems(type: SectionType, lines: DocLine[]): any[] {
  switch (type) {
    case 'summary': return parseSummary(lines);
    case 'experience': return parseExperience(lines);
    case 'education': return parseEducation(lines);
    case 'skills': return parseSkills(lines);
    case 'projects': return parseProjects(lines);
    case 'certifications': return parseCertifications(lines);
    case 'awards': return parseAwards(lines);
    case 'languages': return parseLanguages(lines);
    case 'volunteer': return parseVolunteer(lines);
    case 'publications': return parsePublications(lines);
    case 'references': return parseReferences(lines);
    default: return parseCustom(lines);
  }
}

/* ----------------------------- contact ----------------------------- */

function extractContact(lines: DocLine[]): ParsedContact {
  const all = lines.map((l) => l.text).join('\n');
  const c: ParsedContact = { fullName: '', jobTitle: '', email: '', phone: '', location: '', website: '', linkedin: '', github: '' };

  const email = all.match(EMAIL_RE); if (email) c.email = email[0];
  const li = all.match(LINKEDIN_RE); if (li) c.linkedin = li[0].replace(/^https?:\/\//, '');
  const gh = all.match(GITHUB_RE); if (gh) c.github = gh[0].replace(/^https?:\/\//, '');

  // Phone — search top region first to avoid catching ZIPs/IDs deep in the doc.
  for (const ln of lines.slice(0, 15)) {
    const ph = ln.text.match(PHONE_RE);
    if (ph && ph[0].replace(/\D/g, '').length >= 8) { c.phone = ph[0].trim(); break; }
  }
  if (!c.phone) { const ph = all.match(PHONE_RE); if (ph && ph[0].replace(/\D/g, '').length >= 8) c.phone = ph[0].trim(); }

  // Website — a real URL that isn't linkedin/github and isn't just the email's
  // mail-provider domain (e.g. "gmail.com").
  const emailDomain = c.email ? c.email.split('@')[1]?.toLowerCase() : '';
  const MAIL_PROVIDER = /^(?:www\.)?(gmail|googlemail|yahoo|outlook|hotmail|icloud|proton(?:mail)?|aol|live|zoho|mail|gmx)\./i;
  // Strip emails first so the URL scan can't grab an email's "name.domain" part.
  const top = lines.slice(0, 15).map((l) => l.text).join('\n').replace(new RegExp(EMAIL_RE.source, 'gi'), ' ');
  const urls = top.match(new RegExp(URL_RE.source, 'gi')) || [];
  for (const u of urls) {
    const clean = u.replace(/^https?:\/\//, '');
    if (/linkedin|github/i.test(clean) || clean.includes('@')) continue;
    if (emailDomain && clean.toLowerCase().includes(emailDomain)) continue;
    if (MAIL_PROVIDER.test(clean) && !clean.includes('/')) continue; // bare mail domain
    if (/\.[a-z]{2,}/i.test(clean)) { c.website = clean; break; }
  }

  // Name — prefer the biggest-font line near the top; else first non-contact title-ish line.
  const head = lines.slice(0, 8);
  let nameLine = head
    .filter((l) => !looksLikeContact(l.text) && !l.bullet && l.text.length >= 3 && l.text.length <= 40 && /[A-Za-z]/.test(l.text) && l.text.split(/\s+/).length <= 5)
    .sort((a, b) => (b.size || 0) - (a.size || 0))[0];
  // Location — a "City, ST" / "City, Country" style line in the header, no @/url.
  const PLACE_RE = /^[A-Za-z .'\-]+,\s*[A-Za-z .'\-]+$/;
  for (const ln of lines.slice(0, 12)) {
    const t = ln.text;
    if (looksLikeContact(t)) continue;
    if (/,/.test(t) && t.length < 60 && /^[A-Za-z .'\-,()]+$/.test(t) && !/\b(experience|education|summary|skills)\b/i.test(t)) {
      c.location = t.trim();
      break;
    }
  }

  // Assign name + job title (job title is the line after the name, never the location).
  if (nameLine) {
    c.fullName = nameLine.text.replace(/\s{2,}/g, ' ').trim();
    const idx = lines.indexOf(nameLine);
    const next = lines[idx + 1];
    // Job title = the line right after the name, unless it's the location.
    if (
      next && !looksLikeContact(next.text) && next.text.length <= 60 &&
      next.text.split(/\s+/).length <= 8 && !next.bullet &&
      next.text.trim() !== c.location && !PLACE_RE.test(next.text.trim())
    ) {
      c.jobTitle = next.text.trim();
    }
  }
  return c;
}

/* ------------------------------ main ------------------------------- */

export function analyzeResume(lines: DocLine[]): ParsedResume {
  const clean = lines.filter((l) => l.text && l.text.trim().length > 0);
  // Body font size = the most common size among longer lines (PDF only).
  const sizeFreq = new Map<number, number>();
  clean.forEach((l) => { if (l.size > 0 && l.text.length > 12) sizeFreq.set(l.size, (sizeFreq.get(l.size) || 0) + l.text.length); });
  let bodySize = 0, best = 0;
  sizeFreq.forEach((cnt, sz) => { if (cnt > best) { best = cnt; bodySize = sz; } });

  const contact = extractContact(clean);

  // Header lines (name / job title) must not become sections.
  const headerSkip = new Set<string>();
  if (contact.fullName) headerSkip.add(contact.fullName.trim());
  if (contact.jobTitle) headerSkip.add(contact.jobTitle.trim());

  // Split into sections by detected headings.
  const sections: ParsedSection[] = [];
  let preamble: DocLine[] = [];
  let cur: { title: string; type: SectionType; lines: DocLine[] } | null = null;
  const flush = (s: { title: string; type: SectionType; lines: DocLine[] }) => {
    const items = parseItems(s.type, s.lines);
    const layout = inferLayout(s.type, items);
    sections.push(layout ? { title: s.title, type: s.type, items, layout } : { title: s.title, type: s.type, items });
  };
  clean.forEach((ln) => {
    const tt = ln.text.trim();
    if (headerSkip.has(tt)) return; // skip the name/title lines entirely
    if (isHeading(ln, bodySize)) {
      if (cur) flush(cur);
      const title = normHeading(ln.text);
      cur = { title, type: mapHeadingType(title), lines: [] };
    } else if (cur) {
      cur.lines.push(ln);
    } else if (!looksLikeContact(tt)) {
      preamble.push(ln); // drop header contact lines from the preamble/summary
    }
  });
  if (cur) flush(cur);

  // Preamble lines that aren't contact info → a leading summary (common when the
  // intro paragraph has no heading).
  const nameSet = new Set([contact.fullName, contact.jobTitle, contact.email, contact.phone, contact.location, contact.website, contact.linkedin, contact.github].filter(Boolean));
  const leftover = preamble.filter((l) => !nameSet.has(l.text.trim()) && !looksLikeContact(l.text) && l.text.trim() !== contact.fullName);
  const leftoverText = leftover.map((l) => stripBullet(l.text)).join(' ').trim();
  if (leftoverText.length > 60 && !sections.some((s) => s.type === 'summary')) {
    sections.unshift({ title: 'Professional Summary', type: 'summary', items: [leftoverText] });
  }

  // Drop sections that ended up genuinely empty.
  const nonEmpty = sections.filter((s) => {
    if (s.type === 'summary') return (s.items[0] || '').toString().trim().length > 0;
    return s.items.length > 0;
  });

  // Absolute fallback: nothing detected → put the whole body into a summary.
  if (nonEmpty.length === 0) {
    const body = clean.map((l) => stripBullet(l.text)).filter((t) => !nameSet.has(t)).join(' ').trim();
    if (body) nonEmpty.push({ title: 'Professional Summary', type: 'summary', items: [body] });
  }

  const resumeName = contact.fullName ? `${contact.fullName} Resume` : 'Imported Resume';
  return { resumeName, contact, sections: nonEmpty };
}
