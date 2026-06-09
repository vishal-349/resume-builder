/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type LanguageCode = 'en' | 'hi' | 'fr' | 'de' | 'es';

export interface ResumeStyles {
  primaryColor: string;
  textColor: string;
  backgroundColor: string;
  fontFamily: string;
  fontSize: 'sm' | 'md' | 'lg';
  spacing: 'compact' | 'normal' | 'relaxed';
  dividerStyle: 'none' | 'solid' | 'dashed' | 'double' | 'thick';
  sectionHeadingSize: 'sm' | 'md' | 'lg';
  sectionHeadingAlignment: 'left' | 'center' | 'right';
  borderRadius: 'none' | 'sm' | 'md' | 'lg' | 'full';
  lineSpacing?: 'tight' | 'normal' | 'relaxed';
  /**
   * Where the contact details (email/phone/links) sit, independent of the chosen
   * template. 'template' keeps the template's own header design.
   */
  headerLayout?: 'template' | 'right' | 'horizontal' | 'stacked';
}

/**
 * Per-section display customization. Lets the user override how an individual
 * section renders, on top of whatever template they started from. All fields are
 * optional so existing resumes keep their current look.
 */
export interface SectionLayout {
  showTitle?: boolean;                          // default true
  align?: 'left' | 'center' | 'right';          // content alignment, default left
  columns?: 1 | 2 | 3;                          // grid columns for list-style sections
  skillStyle?: 'chips' | 'list' | 'inline';     // skills section only, default 'chips'
}

export interface PersonalInfo {
  fullName: string;
  photoUrl?: string;
  jobTitle: string;
  email: string;
  phone: string;
  location: string;
  website: string;
  linkedin: string;
  github: string;
  [key: string]: any; // Allow custom contact fields
}

export interface WorkExperience {
  id: string;
  company: string;
  position: string;
  startDate: string;
  endDate: string;
  current: boolean;
  location: string;
  description: string; // Markdown or plain textbullet list
}

export interface Education {
  id: string;
  institution: string;
  degree: string;
  fieldOfStudy: string;
  startDate: string;
  endDate: string;
  current: boolean;
  grade?: string;
  description?: string;
}

export interface Project {
  id: string;
  name: string;
  role: string;
  url?: string;
  startDate: string;
  endDate: string;
  current: boolean;
  description: string;
  technologiesKeys?: string[];
}

export interface Skill {
  id: string;
  name: string;
  level: 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert' | '';
}

export interface Certification {
  id: string;
  name: string;
  issuer: string;
  date: string;
  url?: string;
}

export interface Award {
  id: string;
  title: string;
  issuer: string;
  date: string;
  description?: string;
}

export interface Language {
  id: string;
  name: string;
  proficiency: 'Basic' | 'Conversational' | 'Fluent' | 'Native' | '';
}

export interface VolunteerExperience {
  id: string;
  organization: string;
  role: string;
  startDate: string;
  endDate: string;
  current: boolean;
  description: string;
}

export interface Publication {
  id: string;
  title: string;
  publisher: string;
  date: string;
  url?: string;
  description?: string;
}

export interface Reference {
  id: string;
  name: string;
  relationship: string;
  company: string;
  contact: string;
}

export interface CustomSectionItem {
  id: string;
  title: string;
  subtitle?: string;
  date?: string;
  description?: string;
}

export type SectionType = 
  | 'personal'
  | 'summary'
  | 'experience'
  | 'education'
  | 'skills'
  | 'projects'
  | 'certifications'
  | 'awards'
  | 'languages'
  | 'volunteer'
  | 'publications'
  | 'references'
  | 'custom';

export interface ResumeSection {
  id: string;
  type: SectionType;
  name: string; // Custom editable section title!
  visible: boolean;
  collapsed?: boolean;
  layout?: SectionLayout; // Per-section display overrides
  items: any[]; // Depends on type
}

/** A user-saved custom design (styles + per-section layout), persisted locally. */
export interface CustomTemplate {
  id: string;
  name: string;
  createdAt: string;
  styles: ResumeStyles;
  sectionLayouts: Record<string, SectionLayout>; // keyed by section type
}

export interface Resume {
  id: string;
  title: string;
  updatedAt: string;
  language: LanguageCode;
  templateId: string;
  styles: ResumeStyles;
  sections: ResumeSection[]; // Dynamic reordering!
}

export interface ATSFeedback {
  score: number;
  grade: 'Excellent' | 'Good' | 'Needs Improvement' | 'Critical';
  suggestions: {
    category: string;
    text: string;
    impact: 'high' | 'medium' | 'low';
    fixed: boolean;
  }[];
  keywordMissing: string[];
  readabilityAssessment: string;
}

export interface TemplateDefinition {
  id: string;
  name: string;
  category: string;
  description: string;
  thumbnailColor: string;
}
