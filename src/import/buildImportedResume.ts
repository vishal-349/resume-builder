/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Converts a ParsedResume (from the analyzer, possibly edited in the preview) into
 * a native, fully-editable Resume with dynamically-generated sections.
 */

import { Resume, ResumeSection, SectionType, LanguageCode } from '../types';
import { DEFAULT_STYLES } from '../store';
import { ParsedResume } from './analyzeResume';

const uid = (p: string) => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

const DEFAULT_NAMES: Record<string, string> = {
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
  custom: 'Custom Section',
};

export function buildImportedResume(parsed: ParsedResume, lang: LanguageCode = 'en'): Resume {
  const c = parsed.contact;
  const sections: ResumeSection[] = [];

  // Personal/contact section always leads (header rendering finds it by type).
  sections.push({
    id: 'personal',
    type: 'personal',
    name: 'Personal Information',
    visible: true,
    items: [{
      fullName: c.fullName || '',
      jobTitle: c.jobTitle || '',
      email: c.email || '',
      phone: c.phone || '',
      location: c.location || '',
      website: c.website || '',
      linkedin: c.linkedin || '',
      github: c.github || '',
    }],
  });

  const usedIds = new Set<string>(['personal']);
  parsed.sections.forEach((s, idx) => {
    if (s.type === 'personal') return; // never duplicate the contact card
    // Unique, stable id per section (allows duplicate known types e.g. two custom).
    let id = s.type === 'custom' ? uid('custom') : s.type;
    if (usedIds.has(id)) id = `${s.type}-${idx}`;
    usedIds.add(id);

    const name = (s.title && s.title.trim()) || DEFAULT_NAMES[s.type] || 'Section';

    let items: any[];
    if (s.type === 'summary') {
      items = [typeof s.items[0] === 'string' ? s.items[0] : ''];
    } else {
      items = (s.items || []).map((it) => ({ id: uid(s.type), ...it }));
    }

    sections.push({ id, type: s.type as SectionType, name, visible: true, items, ...(s.layout ? { layout: s.layout } : {}) });
  });

  return {
    id: uid('resume'),
    title: parsed.resumeName || 'Imported Resume',
    updatedAt: new Date().toISOString(),
    language: lang,
    templateId: 'imported',
    styles: { ...DEFAULT_STYLES },
    sections,
  };
}
