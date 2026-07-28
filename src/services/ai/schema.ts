/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * The structured-output contract for resume extraction.
 *
 * The schema and its TypeScript mirror live in the same file on purpose — if
 * one changes without the other, the drift is visible in a single diff.
 *
 * Design note: every section carries the SAME generic entry shape rather than a
 * per-kind union. Unions are poorly supported by structured-output engines and
 * invite malformed payloads; a uniform superset keeps the model's job simple
 * and moves all shape-specific logic into `entryMapper.ts`, where it is typed
 * and testable.
 */

/** Minimal OpenAPI-subset schema type, the shape structured-output engines accept. */
export interface JSONSchema {
  type: 'object' | 'array' | 'string' | 'number' | 'integer' | 'boolean';
  description?: string;
  nullable?: boolean;
  enum?: string[];
  format?: string;
  items?: JSONSchema;
  properties?: Record<string, JSONSchema>;
  required?: string[];
  /** Ordering hint — improves output stability for structured generation. */
  propertyOrdering?: string[];
  minimum?: number;
  maximum?: number;
}

/* ------------------------------------------------------------------ */
/* Semantic section kinds                                              */
/* ------------------------------------------------------------------ */

/**
 * The semantic labels the model may assign. This is intentionally NOT the set
 * of headings — headings are free text, captured verbatim. This is only "what
 * kind of thing is this section", used to pick a renderer.
 *
 * `other` is the escape hatch: anything unrecognised keeps its heading and
 * becomes an editable custom section.
 */
export const SECTION_KINDS = [
  'summary',
  'experience',
  'education',
  'skills',
  'projects',
  'certifications',
  'awards',
  'achievements',
  'languages',
  'volunteer',
  'publications',
  'references',
  'interests',
  'other',
] as const;

export type SectionKind = (typeof SECTION_KINDS)[number];

/* ------------------------------------------------------------------ */
/* TypeScript mirror of the schema                                     */
/* ------------------------------------------------------------------ */

export interface AIEntry {
  title: string | null;
  organization: string | null;
  subtitle: string | null;
  role: string | null;
  location: string | null;
  startDate: string | null;
  endDate: string | null;
  current: boolean | null;
  dateText: string | null;
  description: string | null;
  bullets: string[] | null;
  url: string | null;
  level: string | null;
  tags: string[] | null;
}

export interface AISection {
  heading: string;
  kind: SectionKind;
  summaryText: string | null;
  entries: AIEntry[] | null;
  confidence: number;
  confidenceNote: string | null;
}

export interface AIPersonal {
  fullName: string | null;
  professionalTitle: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  linkedin: string | null;
  github: string | null;
  portfolio: string | null;
}

export interface AIStyleHints {
  primaryColor: string | null;
  textColor: string | null;
  fontFamily: 'sans' | 'serif' | 'mono' | null;
  columnCount: number | null;
  headingAlignment: 'left' | 'center' | 'right' | null;
  density: 'compact' | 'normal' | 'relaxed' | null;
}

export interface AIResumeResponse {
  resumeName: string | null;
  personal: AIPersonal;
  styleHints: AIStyleHints;
  sections: AISection[];
  confidence: number;
  confidenceNote: string | null;
  warnings: string[] | null;
}

/* ------------------------------------------------------------------ */
/* Schema                                                              */
/* ------------------------------------------------------------------ */

const nullableString = (description: string): JSONSchema => ({
  type: 'string',
  nullable: true,
  description,
});

const ENTRY_SCHEMA: JSONSchema = {
  type: 'object',
  description:
    'One entry within a section. Populate only the fields the source actually provides; leave the rest null. Never invent values.',
  properties: {
    title: nullableString(
      'The primary label: job title, degree, project name, certification name, award name, skill name, or the entry heading.'
    ),
    organization: nullableString('Company, school, issuer, publisher, or organization name.'),
    subtitle: nullableString('A secondary label such as field of study, department, or qualifier.'),
    role: nullableString('The person\'s role, when it is distinct from the title (e.g. project contributions).'),
    location: nullableString('City / state / country / "Remote" attached to this entry.'),
    startDate: nullableString('Start date normalized to MM-YYYY, or YYYY when no month is given. Empty when absent.'),
    endDate: nullableString('End date normalized to MM-YYYY, or YYYY. Empty when the entry is ongoing.'),
    dateText: nullableString('The date range exactly as printed in the document, e.g. "Summer 2021 – Present".'),
    current: { type: 'boolean', nullable: true, description: 'True when the entry is ongoing (Present/Current/Now).' },
    description: nullableString('Prose description, when the entry has one that is not a bullet list.'),
    bullets: {
      type: 'array',
      nullable: true,
      description: 'Bullet points for this entry, one string per bullet, with the bullet glyph removed.',
      items: { type: 'string' },
    },
    url: nullableString('Any link attached to this entry.'),
    level: nullableString('A single qualifier: skill proficiency, language fluency, GPA, or grade.'),
    tags: {
      type: 'array',
      nullable: true,
      description:
        'Comma- or pipe-separated lists found in this entry, split into individual values (technologies, skills, keywords).',
      items: { type: 'string' },
    },
  },
  required: ['title'],
  propertyOrdering: [
    'title',
    'organization',
    'subtitle',
    'role',
    'location',
    'startDate',
    'endDate',
    'dateText',
    'current',
    'description',
    'bullets',
    'url',
    'level',
    'tags',
  ],
};

const SECTION_SCHEMA: JSONSchema = {
  type: 'object',
  description: 'One section of the resume, in the order it appears in the document.',
  properties: {
    heading: {
      type: 'string',
      description:
        'The section heading EXACTLY as printed in the document, preserving its original wording and capitalization. Do not normalize, translate, or replace it with a standard name. If the section has no printed heading, write a short accurate one.',
    },
    kind: {
      type: 'string',
      enum: [...SECTION_KINDS],
      description:
        'What kind of content this section holds, judged by the content itself and not by the heading wording. Use "other" for anything that does not clearly fit — the heading is preserved either way.',
    },
    summaryText: nullableString(
      'For prose sections (summary, profile, objective, about me), the full paragraph text. Null for list-style sections.'
    ),
    entries: {
      type: 'array',
      nullable: true,
      description: 'The entries in this section, in document order. Null or empty for prose-only sections.',
      items: ENTRY_SCHEMA,
    },
    confidence: {
      type: 'number',
      minimum: 0,
      maximum: 1,
      description:
        'How confident you are that this section was read correctly and completely. Use below 0.7 when the layout was ambiguous, text was cut off, dates were unclear, or entries may have been merged or split incorrectly.',
    },
    confidenceNote: nullableString(
      'When confidence is below 0.7, one short sentence naming what specifically is uncertain. Null otherwise.'
    ),
  },
  required: ['heading', 'kind', 'confidence'],
  propertyOrdering: ['heading', 'kind', 'summaryText', 'entries', 'confidence', 'confidenceNote'],
};

const PERSONAL_SCHEMA: JSONSchema = {
  type: 'object',
  description: 'Personal and contact details, usually from the document header.',
  properties: {
    fullName: nullableString('The candidate\'s full name.'),
    professionalTitle: nullableString('The professional title/tagline beneath the name, e.g. "Senior Data Engineer".'),
    email: nullableString('Email address.'),
    phone: nullableString('Phone number, including country code when shown.'),
    address: nullableString('Street address, if present.'),
    city: nullableString('City.'),
    country: nullableString('Country.'),
    linkedin: nullableString('LinkedIn profile URL or handle.'),
    github: nullableString('GitHub profile URL or handle.'),
    portfolio: nullableString('Personal site, portfolio, or any other profile link.'),
  },
  propertyOrdering: [
    'fullName',
    'professionalTitle',
    'email',
    'phone',
    'address',
    'city',
    'country',
    'linkedin',
    'github',
    'portfolio',
  ],
};

const STYLE_HINTS_SCHEMA: JSONSchema = {
  type: 'object',
  description:
    'The visual design of the source document, used to rebuild a matching template. Judge these from what the document LOOKS like.',
  properties: {
    primaryColor: nullableString(
      'The dominant accent colour used for headings, rules, or the header band, as a #RRGGBB hex value. Null if the document is monochrome.'
    ),
    textColor: nullableString('The main body text colour as a #RRGGBB hex value.'),
    fontFamily: {
      type: 'string',
      enum: ['sans', 'serif', 'mono'],
      nullable: true,
      description: 'Which family the body text belongs to.',
    },
    columnCount: {
      type: 'integer',
      nullable: true,
      minimum: 1,
      maximum: 2,
      description: 'Use 2 only when the resume has a genuine full-height sidebar column. Otherwise 1.',
    },
    headingAlignment: {
      type: 'string',
      enum: ['left', 'center', 'right'],
      nullable: true,
      description: 'How section headings are aligned.',
    },
    density: {
      type: 'string',
      enum: ['compact', 'normal', 'relaxed'],
      nullable: true,
      description: 'How tightly packed the content is.',
    },
  },
  propertyOrdering: ['primaryColor', 'textColor', 'fontFamily', 'columnCount', 'headingAlignment', 'density'],
};

export const RESUME_RESPONSE_SCHEMA: JSONSchema = {
  type: 'object',
  properties: {
    resumeName: nullableString(
      'A short name for this resume, ideally "<Full Name> Resume". Fall back to the professional title when no name is present.'
    ),
    personal: PERSONAL_SCHEMA,
    styleHints: STYLE_HINTS_SCHEMA,
    sections: {
      type: 'array',
      description:
        'Every section of the resume, in the exact order they appear in the document. Do not reorder, merge, drop, or add sections.',
      items: SECTION_SCHEMA,
    },
    confidence: {
      type: 'number',
      minimum: 0,
      maximum: 1,
      description: 'Overall confidence that the whole document was extracted correctly.',
    },
    confidenceNote: nullableString('One short sentence on the main source of uncertainty, if any.'),
    warnings: {
      type: 'array',
      nullable: true,
      description:
        'Content you saw but could not confidently place, or anything the user should check. One short sentence each.',
      items: { type: 'string' },
    },
  },
  required: ['personal', 'styleHints', 'sections', 'confidence'],
  propertyOrdering: ['resumeName', 'personal', 'styleHints', 'sections', 'confidence', 'confidenceNote', 'warnings'],
};
