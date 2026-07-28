/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * `ParsedResume` → a native, fully-editable `Resume`.
 *
 * The output is indistinguishable from a resume built by hand in the app: every
 * section is a real section, every entry a real item with its own id. Renaming,
 * reordering, deleting and adding all work immediately, because nothing about
 * an imported resume is special-cased downstream.
 *
 * Two invariants:
 *   1. Document order is preserved exactly.
 *   2. Every heading is kept verbatim — the source's vocabulary wins over ours.
 */

import { DEFAULT_STYLES } from '../../defaultStyles';
import type { LanguageCode, Resume, ResumeSection, ResumeStyles, SectionType } from '../../types';
import { entriesForSection, mapEntriesToItems } from './entryMapper';
import { DEFAULT_SECTION_NAMES, SIDEBAR_TYPES } from './sectionCatalog';
import type { DocumentStyleHints, ParsedResume, ParsedSection } from './types';

let idCounter = 0;
const uid = (prefix: string): string =>
  `${prefix}-${Date.now().toString(36)}-${(idCounter++).toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

/* ------------------------------------------------------------------ */
/* Template selection                                                  */
/* ------------------------------------------------------------------ */

/**
 * Pick the base template.
 *
 * This matters more than it looks: `LivePreview` decides single- vs two-column
 * from `templateId` alone, so honouring a sidebar layout means choosing the
 * right id here — setting styles is not enough.
 */
function selectTemplateId(hints: DocumentStyleHints, sections: ParsedSection[]): string {
  const hasSidebarContent = sections.some((section) => SIDEBAR_TYPES.has(section.type));
  if (hints.columnCount === 2 && hasSidebarContent) return 'functional-two-col';
  if (hints.fontFamily === 'serif') return 'executive-classic';
  if (hints.fontFamily === 'mono') return 'developer-terminal';
  return 'ats-friendly';
}

/** Apply the document's captured look on top of the app defaults. */
function buildStyles(hints: DocumentStyleHints): ResumeStyles {
  const styles: ResumeStyles = { ...DEFAULT_STYLES };
  if (hints.primaryColor) styles.primaryColor = hints.primaryColor;
  if (hints.textColor) styles.textColor = hints.textColor;
  if (hints.fontFamily) styles.fontFamily = hints.fontFamily;
  if (hints.density) styles.spacing = hints.density;
  if (hints.headingAlignment) styles.sectionHeadingAlignment = hints.headingAlignment;
  return styles;
}

/* ------------------------------------------------------------------ */
/* Sections                                                            */
/* ------------------------------------------------------------------ */

/**
 * Section ids must be unique but stay readable. The `personal` section keeps
 * the literal id `personal` because the header renderer looks it up by that.
 */
function sectionId(type: SectionType, used: Set<string>): string {
  if (!used.has(type)) {
    used.add(type);
    return type;
  }
  const id = uid(type);
  used.add(id);
  return id;
}

function buildSection(parsed: ParsedSection, used: Set<string>): ResumeSection | null {
  const id = sectionId(parsed.type, used);
  const name = parsed.heading.trim() || DEFAULT_SECTION_NAMES[parsed.type];

  if (parsed.type === 'summary') {
    const text = parsed.summaryText.trim();
    if (!text) return null;
    // Summary items are raw strings, not objects — matching the store.
    return { id, type: 'summary', name, visible: true, items: [text] };
  }

  const items = mapEntriesToItems(entriesForSection(parsed), parsed.type, name).map((item) => ({
    id: uid('item'),
    ...item,
  }));

  if (items.length === 0) return null;
  return { id, type: parsed.type, name, visible: true, items };
}

/* ------------------------------------------------------------------ */
/* Assembly                                                            */
/* ------------------------------------------------------------------ */

export interface AssembleResult {
  resume: Resume;
  /** Suggested preset name, so the design can be reused on other resumes. */
  templateName: string;
}

export function assembleResume(parsed: ParsedResume, language: LanguageCode = 'en'): AssembleResult {
  const usedIds = new Set<string>();
  const sections: ResumeSection[] = [];

  // Contact always leads — the header renderer finds it by id/type.
  usedIds.add('personal');
  sections.push({
    id: 'personal',
    type: 'personal',
    name: DEFAULT_SECTION_NAMES.personal,
    visible: true,
    items: [
      {
        fullName: parsed.contact.fullName,
        jobTitle: parsed.contact.jobTitle,
        email: parsed.contact.email,
        phone: parsed.contact.phone,
        location: parsed.contact.location,
        website: parsed.contact.website,
        linkedin: parsed.contact.linkedin,
        github: parsed.contact.github,
      },
    ],
  });

  // Document order, preserved.
  for (const parsedSection of parsed.sections) {
    if (parsedSection.type === 'personal') continue; // never duplicate the header
    const section = buildSection(parsedSection, usedIds);
    if (section) sections.push(section);
  }

  const styles = buildStyles(parsed.styleHints);
  const templateId = selectTemplateId(parsed.styleHints, parsed.sections);

  const resume: Resume = {
    id: uid('resume'),
    title: parsed.resumeName,
    updatedAt: new Date().toISOString(),
    language,
    templateId,
    styles,
    sections,
  };

  return { resume, templateName: `${parsed.resumeName} (Imported Design)` };
}
