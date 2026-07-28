/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * The bridge between the AI's semantic section labels and the builder's
 * renderable `SectionType`s.
 *
 * Key property: a kind with no native renderer degrades to 'custom' WITHOUT
 * losing anything. The original heading is always preserved on the section, and
 * custom sections are fully editable in both the form and the live preview. So
 * "Career Highlights" and "Technical Toolbox" survive intact either way.
 */

import type { SectionType } from '../../types';
import type { SectionKind } from '../ai/schema';

/** Semantic kind → the builder section type that renders it. */
const KIND_TO_TYPE: Record<SectionKind, SectionType> = {
  summary: 'summary',
  experience: 'experience',
  education: 'education',
  skills: 'skills',
  projects: 'projects',
  certifications: 'certifications',
  awards: 'awards',
  languages: 'languages',
  volunteer: 'volunteer',
  publications: 'publications',
  references: 'references',
  // No dedicated renderer — kept as editable custom sections under their own
  // headings rather than being force-fitted into an unrelated type.
  achievements: 'custom',
  interests: 'custom',
  other: 'custom',
};

/**
 * Types that hold exactly one item and cannot be duplicated meaningfully.
 * A second "summary" section is merged into the first rather than shadowing it.
 */
export const SINGLETON_TYPES: ReadonlySet<SectionType> = new Set<SectionType>(['personal', 'summary']);

export function kindToSectionType(kind: string): SectionType {
  return KIND_TO_TYPE[kind as SectionKind] ?? 'custom';
}

/** True when the kind has no native renderer and relies on the custom card. */
export function isCustomKind(kind: string): boolean {
  return kindToSectionType(kind) === 'custom';
}

/** Fallback heading, used only when the document had none. */
export const DEFAULT_SECTION_NAMES: Record<SectionType, string> = {
  personal: 'Personal Information',
  summary: 'Professional Summary',
  experience: 'Work Experience',
  education: 'Education',
  skills: 'Skills',
  projects: 'Projects',
  certifications: 'Certifications',
  awards: 'Awards',
  languages: 'Languages',
  volunteer: 'Volunteer Experience',
  publications: 'Publications',
  references: 'References',
  custom: 'Additional Information',
};

/**
 * Section types the two-column templates route into the sidebar.
 * Mirrors LivePreview's own list — used to sanity-check a two-column import
 * actually has sidebar-eligible content before selecting that template.
 */
export const SIDEBAR_TYPES: ReadonlySet<SectionType> = new Set<SectionType>([
  'skills',
  'languages',
  'certifications',
  'awards',
  'references',
]);
