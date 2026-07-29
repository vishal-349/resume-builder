/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Domain model for the Resume Import pipeline.
 *
 * Deliberately provider-neutral: nothing in this file knows that Gemini exists.
 * Swapping the AI provider means writing a new adapter that produces these
 * shapes — every consumer downstream stays untouched.
 */

import type { SectionType } from '../../types';

/* ------------------------------------------------------------------ */
/* Source document                                                     */
/* ------------------------------------------------------------------ */

/** Formats the importer accepts. Legacy `.doc` is rejected at validation. */
export type SupportedFormat = 'pdf' | 'docx' | 'text';

/**
 * What actually gets handed to the AI provider.
 *
 * `binary` keeps the ORIGINAL bytes so a vision-capable model can read layout,
 * columns, tables and colour. `text` is the structural fallback (DOCX → HTML,
 * or raw pasted text) used when the provider cannot ingest the file natively.
 */
export type DocumentPayload =
  | { kind: 'binary'; mimeType: string; base64: string; fileName: string; format: SupportedFormat }
  | { kind: 'text'; text: string; fileName: string; format: SupportedFormat };

/* ------------------------------------------------------------------ */
/* Parsed result                                                       */
/* ------------------------------------------------------------------ */

export interface ParsedContact {
  fullName: string;
  jobTitle: string;
  email: string;
  phone: string;
  /** Merged single-line location (address / city / country as available). */
  location: string;
  website: string;
  linkedin: string;
  github: string;
}

/**
 * One entry inside a section, in a generic superset shape.
 *
 * The AI returns this uniform object for every section kind; `entryMapper`
 * projects it onto the concrete item shape the builder's renderer expects. A
 * single shape (rather than a 13-way union) keeps the response schema simple
 * and moves all mapping into typed, testable code.
 */
export interface ParsedEntry {
  title: string;
  organization: string;
  subtitle: string;
  role: string;
  location: string;
  /** Normalized to MM-YYYY where a month is known, else YYYY, else ''. */
  startDate: string;
  endDate: string;
  current: boolean;
  /** The date text exactly as printed in the document (e.g. "Summer 2021"). */
  dateText: string;
  description: string;
  bullets: string[];
  url: string;
  /** Skill/language proficiency, grade, or any other single qualifier. */
  level: string;
  /** Comma-separated lists found in the source (skills, technologies, keywords). */
  tags: string[];
}

/** How sure the model is about a piece of the extraction. */
export interface Confidence {
  /** 0–1. */
  score: number;
  /** Short model-authored explanation, shown when the score is low. */
  note: string;
}

export interface ParsedSection {
  /** Stable client-side id, assigned during normalization. */
  id: string;
  /** The heading EXACTLY as printed in the document. Never invented. */
  heading: string;
  /** Where this section renders in the builder. */
  type: SectionType;
  /** The raw semantic label the model assigned, kept for diagnostics. */
  kind: string;
  /** Prose body — only populated for summary-like sections. */
  summaryText: string;
  entries: ParsedEntry[];
  confidence: Confidence;
  /** True when the heading did not map to a native builder section type. */
  isCustomHeading: boolean;
}

/** Visual characteristics read off the source document. */
export interface DocumentStyleHints {
  primaryColor?: string;
  textColor?: string;
  fontFamily?: 'sans' | 'serif' | 'mono';
  columnCount?: 1 | 2;
  headingAlignment?: 'left' | 'center' | 'right';
  density?: 'compact' | 'normal' | 'relaxed';
}

export interface ParsedResume {
  resumeName: string;
  contact: ParsedContact;
  sections: ParsedSection[];
  styleHints: DocumentStyleHints;
  /** Overall extraction confidence for the document. */
  confidence: Confidence;
  /** Populated when the model flags content it could not place. */
  warnings: string[];
  meta: {
    fileName: string;
    format: SupportedFormat;
    /** Provider identifier, e.g. "gemini". Diagnostics only — never branched on. */
    provider: string;
    model: string;
    parsedAt: string;
    durationMs: number;
  };
}

/* ------------------------------------------------------------------ */
/* Progress reporting                                                  */
/* ------------------------------------------------------------------ */

export type ImportStage = 'validating' | 'reading' | 'analyzing' | 'building';

export interface ImportProgress {
  stage: ImportStage;
  /** 0–100, monotonically increasing across the whole pipeline. */
  percent: number;
  message: string;
}

export type ProgressReporter = (progress: ImportProgress) => void;

/** Confidence at or below this is surfaced as "please verify" in the review UI. */
export const LOW_CONFIDENCE_THRESHOLD = 0.7;
