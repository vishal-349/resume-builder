/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Projects the AI's generic `ParsedEntry` onto the exact item shape each
 * section type's renderer expects.
 *
 * The field names here are a hard contract with `LivePreview.renderItemContent`
 * and `ResumeForm.handleAddField` — a rename in either place must be mirrored
 * here or the imported content renders blank.
 *
 * Nothing is silently dropped: any populated field with no home in the target
 * shape is appended to that item's description instead of being discarded.
 */

import type { SectionType } from '../../types';
import type { ParsedEntry, ParsedSection } from './types';

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const SKILL_LEVELS = ['Beginner', 'Intermediate', 'Advanced', 'Expert'] as const;
const LANGUAGE_LEVELS = ['Basic', 'Conversational', 'Fluent', 'Native'] as const;

/**
 * Coerce a free-text proficiency onto one of the renderer's allowed values.
 * Anything unrecognised becomes '' — the form treats that as "no level", which
 * is honest, where guessing a level would be fabrication.
 */
function coerceLevel(raw: string, allowed: readonly string[]): string {
  const value = raw.trim().toLowerCase();
  if (!value) return '';

  const exact = allowed.find((level) => level.toLowerCase() === value);
  if (exact) return exact;

  // Common synonyms and rating scales seen on real resumes.
  const synonyms: Record<string, string> = {
    beginner: 'Beginner', basic: 'Basic', elementary: 'Basic', novice: 'Beginner', foundational: 'Beginner',
    intermediate: 'Intermediate', moderate: 'Intermediate', working: 'Intermediate', competent: 'Intermediate',
    conversational: 'Conversational', limited: 'Conversational',
    advanced: 'Advanced', proficient: 'Advanced', strong: 'Advanced', 'highly proficient': 'Advanced',
    fluent: 'Fluent', professional: 'Fluent',
    expert: 'Expert', mastery: 'Expert', master: 'Expert', specialist: 'Expert',
    native: 'Native', bilingual: 'Native', 'mother tongue': 'Native', 'native speaker': 'Native',
  };
  const mapped = synonyms[value];
  if (mapped && allowed.includes(mapped)) return mapped;

  // "4/5", "80%" and similar → bucket onto the scale.
  const ratio = value.match(/^(\d+(?:\.\d+)?)\s*(?:\/\s*(\d+(?:\.\d+)?)|%)$/);
  if (ratio) {
    const numerator = Number.parseFloat(ratio[1]);
    const denominator = ratio[2] ? Number.parseFloat(ratio[2]) : 100;
    if (denominator > 0) {
      const index = Math.min(allowed.length - 1, Math.floor((numerator / denominator) * allowed.length));
      return allowed[Math.max(0, index)];
    }
  }
  return '';
}

/** Bullets + prose → the newline-delimited "- item" format the editor uses. */
function composeDescription(entry: ParsedEntry, extras: string[] = []): string {
  const parts: string[] = [];
  if (entry.description.trim()) parts.push(entry.description.trim());
  for (const bullet of entry.bullets) {
    const text = bullet.trim().replace(/^[-•*·‣▪]\s*/, '');
    if (text) parts.push(`- ${text}`);
  }
  for (const extra of extras) {
    if (extra.trim()) parts.push(extra.trim());
  }
  return parts.join('\n');
}

/** Prefer the first non-empty value. */
const firstOf = (...values: string[]): string => values.find((v) => v && v.trim())?.trim() || '';

/** A readable single-line date, for shapes that have one date field. */
const singleDate = (entry: ParsedEntry): string =>
  firstOf(entry.startDate, entry.endDate, entry.dateText);

/* ------------------------------------------------------------------ */
/* Per-type projections                                                */
/* ------------------------------------------------------------------ */

/**
 * A blank entry, for synthesizing one from loose prose that the model did not
 * break into entries. Every field present so projections never see undefined.
 */
export function emptyEntry(overrides: Partial<ParsedEntry> = {}): ParsedEntry {
  return {
    title: '', organization: '', subtitle: '', role: '', location: '',
    startDate: '', endDate: '', current: false, dateText: '',
    description: '', bullets: [], url: '', level: '', tags: [],
    ...overrides,
  };
}

/** Loose equality for comparing a label against a section heading. */
const sameLabel = (a: string, b: string): boolean =>
  a.trim().toLowerCase().replace(/[^a-z0-9]+/g, '') === b.trim().toLowerCase().replace(/[^a-z0-9]+/g, '');

/**
 * Skills are the one type where a single entry can yield many items: a source
 * line like "React, Node.js, PostgreSQL" arrives as one entry with three tags.
 */
function toSkillItems(entry: ParsedEntry, sectionHeading: string): Record<string, unknown>[] {
  const level = coerceLevel(entry.level, SKILL_LEVELS);

  if (entry.tags.length > 0) {
    // A genuine sub-group ("Languages: Python, Go") keeps its label as a prefix
    // so the author's grouping survives. But when the entry is just restating
    // the section heading, prefixing would render "Technical Toolbox: Python"
    // directly under a "Technical Toolbox" heading — noise, not information.
    const group = firstOf(entry.title, entry.subtitle);
    const isGroupLabel = !!group && entry.tags.length > 1 && !sameLabel(group, sectionHeading);
    return entry.tags
      .map((tag) => tag.trim())
      .filter(Boolean)
      .map((tag) => ({ name: isGroupLabel ? `${group}: ${tag}` : tag, level }));
  }

  const name = firstOf(entry.title, entry.subtitle, entry.description);
  return name ? [{ name, level }] : [];
}

type Projection = (entry: ParsedEntry, sectionHeading: string) => Record<string, unknown>[];

const PROJECTIONS: Partial<Record<SectionType, Projection>> = {
  experience: (e) => [
    {
      company: firstOf(e.organization, e.subtitle),
      position: firstOf(e.role, e.title),
      startDate: e.startDate,
      endDate: e.current ? '' : e.endDate,
      current: e.current,
      location: e.location,
      description: composeDescription(e, e.url ? [e.url] : []),
    },
  ],

  education: (e) => [
    {
      institution: firstOf(e.organization, e.subtitle),
      degree: firstOf(e.title, e.role),
      fieldOfStudy: firstOf(e.subtitle === e.organization ? '' : e.subtitle, e.role === e.title ? '' : e.role),
      startDate: e.startDate,
      endDate: e.current ? '' : e.endDate,
      current: e.current,
      grade: e.level,
      description: composeDescription(e, [
        e.location ? e.location : '',
        e.tags.length ? e.tags.join(', ') : '',
      ]),
    },
  ],

  skills: toSkillItems,

  projects: (e) => [
    {
      name: firstOf(e.title, e.organization),
      role: firstOf(e.role, e.subtitle),
      url: e.url,
      startDate: e.startDate,
      endDate: e.current ? '' : e.endDate,
      current: e.current,
      description: composeDescription(e, e.tags.length ? [`Technologies: ${e.tags.join(', ')}`] : []),
    },
  ],

  certifications: (e) => [
    {
      name: firstOf(e.title, e.subtitle),
      issuer: firstOf(e.organization, e.role),
      date: singleDate(e),
      url: e.url,
    },
  ],

  awards: (e) => [
    {
      title: firstOf(e.title, e.subtitle),
      issuer: firstOf(e.organization, e.role),
      date: singleDate(e),
      description: composeDescription(e),
    },
  ],

  languages: (e) => [
    {
      name: firstOf(e.title, e.subtitle),
      proficiency: coerceLevel(firstOf(e.level, e.description), LANGUAGE_LEVELS),
    },
  ],

  volunteer: (e) => [
    {
      organization: firstOf(e.organization, e.title),
      role: firstOf(e.role, e.organization ? e.title : e.subtitle),
      startDate: e.startDate,
      endDate: e.current ? '' : e.endDate,
      current: e.current,
      description: composeDescription(e, e.location ? [e.location] : []),
    },
  ],

  publications: (e) => [
    {
      title: firstOf(e.title, e.subtitle),
      publisher: firstOf(e.organization, e.role),
      date: singleDate(e),
      url: e.url,
      description: composeDescription(e),
    },
  ],

  references: (e) => [
    {
      name: firstOf(e.title, e.subtitle),
      relationship: firstOf(e.role, e.subtitle === e.title ? '' : e.subtitle),
      company: e.organization,
      contact: firstOf(e.description, e.url, e.level),
    },
  ],
};

/** The catch-all shape: title / subtitle / date / description. */
const toCustomItem: Projection = (e, sectionHeading) => [
  {
    // When the model wraps a whole bulleted list in one entry, it often titles
    // that entry with the section heading. Rendering it would print the heading
    // twice — once as the section title, once as the first line beneath it.
    title: sameLabel(e.title, sectionHeading) ? '' : firstOf(e.title, e.organization),
    subtitle: firstOf(e.subtitle, e.role, e.title === e.organization ? '' : e.organization),
    date: firstOf(e.dateText, [e.startDate, e.endDate].filter(Boolean).join(' – ')),
    description: composeDescription(e, [
      e.location ? e.location : '',
      e.tags.length ? e.tags.join(', ') : '',
      e.url ? e.url : '',
      e.level ? e.level : '',
    ]),
  },
];

/* ------------------------------------------------------------------ */
/* Entry point                                                         */
/* ------------------------------------------------------------------ */

/** True when a projected item carries any content worth keeping. */
function hasContent(item: Record<string, unknown>): boolean {
  return Object.entries(item).some(
    ([key, value]) => key !== 'current' && typeof value === 'string' && value.trim().length > 0
  );
}

/**
 * Project every entry in a section onto its renderable items.
 * One entry may yield zero items (empty) or several (a skills list).
 *
 * `sectionHeading` lets a projection avoid restating context the heading
 * already provides.
 */
export function mapEntriesToItems(
  entries: ParsedEntry[],
  type: SectionType,
  sectionHeading = ''
): Record<string, unknown>[] {
  const project = PROJECTIONS[type] ?? toCustomItem;
  return entries.flatMap((entry) => project(entry, sectionHeading)).filter(hasContent);
}

/**
 * The entries a section should be built from.
 *
 * A non-summary section can still be pure prose — the model saw a heading with a
 * paragraph under it and had nothing to split. Carry that text through as one
 * entry rather than losing it.
 */
export function entriesForSection(section: ParsedSection): ParsedEntry[] {
  if (section.entries.length === 0 && section.summaryText.trim()) {
    return [emptyEntry({ description: section.summaryText.trim() })];
  }
  return section.entries;
}

/**
 * How many editable items a section will actually produce.
 *
 * Not the same as `entries.length`: one entry holding a comma-separated skills
 * line expands into many items. The review screen must show this number, or it
 * tells the user "1 item" for a section that imports ten.
 */
export function countSectionItems(section: ParsedSection): number {
  if (section.type === 'summary') return section.summaryText.trim() ? 1 : 0;
  return mapEntriesToItems(entriesForSection(section), section.type, section.heading).length;
}
