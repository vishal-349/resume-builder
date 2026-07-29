/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Detects whether an incoming import is a re-import of a resume the user
 * already has, so the app can ask rather than silently overwriting or quietly
 * piling up near-identical copies.
 *
 * Matching is content-based, not filename-based: people rename files
 * constantly ("resume_v3_final.pdf"), but the person and their history stay the
 * same. Filename would produce both false positives and false negatives.
 */

import type { Resume } from '../../types';
import type { ParsedResume } from './types';

/** What the user chose in the duplicate prompt. */
export type DuplicateResolution = 'replace' | 'copy' | 'cancel';

export interface DuplicateMatch {
  /** The existing resume this import appears to duplicate. */
  existing: Resume;
  /** 0–1 similarity. */
  score: number;
  /** Human-readable reasons, shown in the prompt so the choice is informed. */
  reasons: string[];
}

/** Below this we treat the import as a new document and skip the prompt. */
const MATCH_THRESHOLD = 0.6;

const normalize = (value: string): string =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const normalizeEmail = (value: string): string => value.toLowerCase().trim();

/** First+last name, ignoring middle names and honorifics. */
function nameKey(fullName: string): string {
  const parts = normalize(fullName).split(' ').filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1]}`;
}

/** Read the contact card out of an existing resume. */
function contactOf(resume: Resume): { fullName: string; email: string; phone: string } {
  const personal = resume.sections.find((section) => section.type === 'personal');
  const item = (personal?.items?.[0] || {}) as Record<string, unknown>;
  return {
    fullName: typeof item.fullName === 'string' ? item.fullName : '',
    email: typeof item.email === 'string' ? item.email : '',
    phone: typeof item.phone === 'string' ? item.phone : '',
  };
}

/** Compare only the digits — formatting varies wildly between documents. */
const phoneDigits = (value: string): string => value.replace(/\D/g, '').slice(-10);

/**
 * Score one candidate against the incoming import.
 *
 * Email is the strongest signal (near-unique per person), then name, then
 * phone, with the resume title as a weak tiebreaker.
 */
function scoreCandidate(parsed: ParsedResume, existing: Resume): DuplicateMatch | null {
  const incoming = parsed.contact;
  const current = contactOf(existing);
  const reasons: string[] = [];
  let score = 0;

  const incomingEmail = normalizeEmail(incoming.email);
  if (incomingEmail && incomingEmail === normalizeEmail(current.email)) {
    score += 0.6;
    reasons.push(`same email (${incoming.email})`);
  }

  const incomingName = nameKey(incoming.fullName);
  if (incomingName && incomingName === nameKey(current.fullName)) {
    score += 0.3;
    reasons.push(`same name (${incoming.fullName})`);
  }

  const incomingPhone = phoneDigits(incoming.phone);
  if (incomingPhone.length >= 7 && incomingPhone === phoneDigits(current.phone)) {
    score += 0.15;
    reasons.push('same phone number');
  }

  const incomingTitle = normalize(parsed.resumeName);
  if (incomingTitle && incomingTitle === normalize(existing.title)) {
    score += 0.25;
    reasons.push(`same resume name ("${existing.title}")`);
  }

  return score >= MATCH_THRESHOLD ? { existing, score: Math.min(1, score), reasons } : null;
}

/**
 * Find the existing resume most likely to be the same document.
 * Returns null when this is a genuinely new import.
 */
export function findDuplicate(parsed: ParsedResume, resumes: Resume[]): DuplicateMatch | null {
  const matches = resumes
    .map((resume) => scoreCandidate(parsed, resume))
    .filter((match): match is DuplicateMatch => match !== null)
    .sort((a, b) => b.score - a.score);

  return matches[0] ?? null;
}

/**
 * Build a non-colliding title for the "create a copy" path:
 * "Jane Doe Resume" → "Jane Doe Resume (2)" → "Jane Doe Resume (3)".
 */
export function nextAvailableTitle(desired: string, resumes: Resume[]): string {
  const taken = new Set(resumes.map((resume) => normalize(resume.title)));
  if (!taken.has(normalize(desired))) return desired;

  const base = desired.replace(/\s*\(\d+\)$/, '');
  for (let n = 2; n < 1000; n++) {
    const candidate = `${base} (${n})`;
    if (!taken.has(normalize(candidate))) return candidate;
  }
  return `${base} (${Date.now()})`;
}
