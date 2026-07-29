/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Raw model JSON → `ParsedResume`.
 *
 * Structured output constrains the model, but it does not make the payload
 * trustworthy: fields arrive null, dates arrive in a dozen formats, enums drift,
 * and arrays come back as scalars. This module is the hard boundary — after it,
 * the rest of the app can treat every field as present and correctly typed.
 *
 * Pure and I/O-free, so it is directly testable against captured payloads.
 */

import { ImportError } from './errors';
import type { AIEntry, AIResumeResponse, AISection } from './schema';
import { isCustomKind, kindToSectionType } from '../import/sectionCatalog';
import type {
  Confidence,
  DocumentStyleHints,
  ParsedContact,
  ParsedEntry,
  ParsedResume,
  ParsedSection,
  SupportedFormat,
} from '../import/types';

/* ------------------------------------------------------------------ */
/* Scalar coercion                                                     */
/* ------------------------------------------------------------------ */

const str = (value: unknown): string => {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
};

const bool = (value: unknown): boolean => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return /^(true|yes|current|present)$/i.test(value.trim());
  return false;
};

/** Tolerates a scalar where an array was specified — a common model slip. */
const strArray = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.map(str).filter(Boolean);
  const single = str(value);
  return single ? [single] : [];
};

const clamp01 = (value: unknown): number => {
  const num = typeof value === 'number' ? value : Number.parseFloat(str(value));
  if (!Number.isFinite(num)) return 0.5; // unknown ≠ confident
  // Tolerate a 0–100 scale where 0–1 was asked for.
  const scaled = num > 1 && num <= 100 ? num / 100 : num;
  return Math.min(1, Math.max(0, scaled));
};

const oneOf = <T extends string>(value: unknown, allowed: readonly T[]): T | undefined => {
  const candidate = str(value).toLowerCase();
  return allowed.find((option) => option.toLowerCase() === candidate);
};

/** Normalize to #rrggbb, or drop it. A bad colour must not corrupt the theme. */
function hexColor(value: unknown): string | undefined {
  const raw = str(value).toLowerCase();
  const match = raw.match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/);
  if (!match) return undefined;
  const hex = match[1];
  const full = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex;
  return `#${full}`;
}

/* ------------------------------------------------------------------ */
/* Dates                                                               */
/* ------------------------------------------------------------------ */

const MONTHS: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
};

/**
 * Normalize to the MM-YYYY convention the date inputs use, falling back to
 * YYYY, then to the original text. Never invents a month.
 */
function normalizeDate(value: unknown): string {
  const raw = str(value);
  if (!raw) return '';
  if (/^(present|current|now|ongoing|till\s*date|to\s*date)$/i.test(raw)) return '';
  if (/^\d{2}-\d{4}$/.test(raw)) return raw;

  const isoish = raw.match(/^(\d{4})[-/](\d{1,2})(?:[-/]\d{1,2})?$/);
  if (isoish) return `${isoish[2].padStart(2, '0')}-${isoish[1]}`;

  const numeric = raw.match(/^(\d{1,2})[-/.](\d{4})$/);
  if (numeric) return `${numeric[1].padStart(2, '0')}-${numeric[2]}`;

  const named = raw.match(/^([a-z]{3,9})\.?[\s,-]+(\d{4})$/i);
  if (named) {
    const month = MONTHS[named[1].slice(0, 3).toLowerCase()];
    if (month) return `${month}-${named[2]}`;
  }

  const yearOnly = raw.match(/^(19|20)\d{2}$/);
  if (yearOnly) return raw;

  return raw;
}

/* ------------------------------------------------------------------ */
/* Entries                                                             */
/* ------------------------------------------------------------------ */

function normalizeEntry(raw: AIEntry | null | undefined): ParsedEntry {
  const source = (raw || {}) as AIEntry;
  const dateText = str(source.dateText);
  const endDate = normalizeDate(source.endDate);

  // "Present" can arrive as the flag, as the end date, or only in the raw text.
  const current =
    bool(source.current) ||
    /present|current|ongoing|till\s*date|to\s*date|\bnow\b/i.test(`${str(source.endDate)} ${dateText}`);

  return {
    title: str(source.title),
    organization: str(source.organization),
    subtitle: str(source.subtitle),
    role: str(source.role),
    location: str(source.location),
    startDate: normalizeDate(source.startDate),
    endDate: current ? '' : endDate,
    current,
    dateText,
    description: str(source.description),
    bullets: strArray(source.bullets),
    url: str(source.url),
    level: str(source.level),
    tags: strArray(source.tags),
  };
}

/** An entry with no text anywhere is noise from an empty table cell. */
const entryHasContent = (entry: ParsedEntry): boolean =>
  !!(
    entry.title ||
    entry.organization ||
    entry.subtitle ||
    entry.role ||
    entry.description ||
    entry.bullets.length ||
    entry.tags.length ||
    entry.url ||
    entry.level
  );

/* ------------------------------------------------------------------ */
/* Sections                                                            */
/* ------------------------------------------------------------------ */

function normalizeConfidence(score: unknown, note: unknown): Confidence {
  return { score: clamp01(score), note: str(note) };
}

function normalizeSection(raw: AISection, index: number): ParsedSection | null {
  const kind = str(raw?.kind) || 'other';
  const type = kindToSectionType(kind);
  const summaryText = str(raw?.summaryText);
  const entries = (Array.isArray(raw?.entries) ? raw.entries : []).map(normalizeEntry).filter(entryHasContent);

  // Prose that landed in entries instead of summaryText, for summary sections.
  const resolvedSummary =
    type === 'summary' && !summaryText
      ? entries.map((e) => [e.description, ...e.bullets].filter(Boolean).join('\n')).filter(Boolean).join('\n\n')
      : summaryText;

  // An entirely empty section is dropped — an empty heading in the builder is
  // clutter, and the renderer skips zero-item sections anyway.
  if (!resolvedSummary && entries.length === 0) return null;

  const heading = str(raw?.heading);

  return {
    id: `sec-${index}-${kind}`,
    heading,
    type,
    kind,
    summaryText: resolvedSummary,
    entries: type === 'summary' ? [] : entries,
    confidence: normalizeConfidence(raw?.confidence, raw?.confidenceNote),
    isCustomHeading: isCustomKind(kind),
  };
}

/* ------------------------------------------------------------------ */
/* Contact & style                                                     */
/* ------------------------------------------------------------------ */

function normalizeContact(raw: AIResumeResponse['personal']): ParsedContact {
  const source = raw || ({} as AIResumeResponse['personal']);
  const location =
    [str(source.city), str(source.country)].filter(Boolean).join(', ') || str(source.address);

  return {
    fullName: str(source.fullName),
    jobTitle: str(source.professionalTitle),
    email: str(source.email),
    phone: str(source.phone),
    location,
    website: str(source.portfolio),
    linkedin: str(source.linkedin),
    github: str(source.github),
  };
}

function normalizeStyleHints(raw: AIResumeResponse['styleHints']): DocumentStyleHints {
  const source = raw || ({} as AIResumeResponse['styleHints']);
  const columns = Number.parseInt(str(source.columnCount), 10);

  return {
    primaryColor: hexColor(source.primaryColor),
    textColor: hexColor(source.textColor),
    fontFamily: oneOf(source.fontFamily, ['sans', 'serif', 'mono'] as const),
    columnCount: columns === 2 ? 2 : columns === 1 ? 1 : undefined,
    headingAlignment: oneOf(source.headingAlignment, ['left', 'center', 'right'] as const),
    density: oneOf(source.density, ['compact', 'normal', 'relaxed'] as const),
  };
}

/* ------------------------------------------------------------------ */
/* Entry point                                                         */
/* ------------------------------------------------------------------ */

export interface NormalizeContext {
  fileName: string;
  format: SupportedFormat;
  provider: string;
  model: string;
  durationMs: number;
}

/**
 * Validate and normalize a raw model response.
 *
 * Throws `MALFORMED_RESPONSE` (retryable — the caller re-asks once) when the
 * payload is structurally unusable, and `NO_CONTENT_FOUND` when it is
 * well-formed but empty, which is the honest answer for a blank or
 * unreadable document.
 */
export function toParsedResume(raw: AIResumeResponse, context: NormalizeContext): ParsedResume {
  if (!raw || typeof raw !== 'object') {
    throw new ImportError('MALFORMED_RESPONSE', { detail: 'Response was not an object.' });
  }
  if (!Array.isArray(raw.sections)) {
    throw new ImportError('MALFORMED_RESPONSE', { detail: 'Response is missing the `sections` array.' });
  }

  const contact = normalizeContact(raw.personal);
  const sections = raw.sections
    .map(normalizeSection)
    .filter((section): section is ParsedSection => section !== null);

  if (sections.length === 0 && !contact.fullName && !contact.email) {
    throw new ImportError('NO_CONTENT_FOUND', {
      detail: 'The model returned no sections and no contact details.',
    });
  }

  const resumeName =
    str(raw.resumeName) ||
    (contact.fullName ? `${contact.fullName} Resume` : '') ||
    context.fileName.replace(/\.[^/.]+$/, '') ||
    'Imported Resume';

  return {
    resumeName,
    contact,
    sections,
    styleHints: normalizeStyleHints(raw.styleHints),
    confidence: normalizeConfidence(raw.confidence, raw.confidenceNote),
    warnings: strArray(raw.warnings),
    meta: {
      fileName: context.fileName,
      format: context.format,
      provider: context.provider,
      model: context.model,
      parsedAt: new Date().toISOString(),
      durationMs: context.durationMs,
    },
  };
}
