/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Resume, ResumeSection, SectionType, LanguageCode, ResumeStyles } from './types';
import { TRANSLATIONS } from './translations';

const STORAGE_KEY = 'premium_resume_builder_data';

export const DEFAULT_STYLES: ResumeStyles = {
  primaryColor: '#1e3a8a', // Deep navy
  textColor: '#1f2937', // Dark gray
  backgroundColor: '#ffffff',
  fontFamily: 'sans', // Inter
  fontSize: 'md',
  spacing: 'normal',
  dividerStyle: 'solid',
  sectionHeadingSize: 'md',
  sectionHeadingAlignment: 'left',
  borderRadius: 'md',
};

export function createNewResume(title: string, lang: LanguageCode = 'en'): Resume {
  const trans = TRANSLATIONS[lang];
  return {
    id: `resume-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    title,
    updatedAt: new Date().toISOString(),
    language: lang,
    templateId: 'ats-friendly',
    styles: { ...DEFAULT_STYLES },
    sections: [
      {
        id: 'personal',
        type: 'personal',
        name: trans.personal,
        visible: true,
        items: [{
          fullName: '',
          jobTitle: '',
          email: '',
          phone: '',
          location: '',
          website: '',
          linkedin: '',
          github: '',
        }]
      },
      {
        id: 'summary',
        type: 'summary',
        name: trans.summary,
        visible: true,
        items: ['']
      },
      {
        id: 'experience',
        type: 'experience',
        name: trans.experience,
        visible: true,
        items: []
      },
      {
        id: 'education',
        type: 'education',
        name: trans.education,
        visible: true,
        items: []
      },
      {
        id: 'skills',
        type: 'skills',
        name: trans.skills,
        visible: true,
        items: []
      },
      {
        id: 'projects',
        type: 'projects',
        name: trans.projects,
        visible: true,
        items: []
      },
      {
        id: 'certifications',
        type: 'certifications',
        name: trans.certifications,
        visible: true,
        items: []
      },
      {
        id: 'awards',
        type: 'awards',
        name: trans.awards,
        visible: true,
        items: []
      },
      {
        id: 'languages',
        type: 'languages',
        name: trans.languages,
        visible: true,
        items: []
      },
      {
        id: 'volunteer',
        type: 'volunteer',
        name: trans.volunteer,
        visible: true,
        items: []
      },
      {
        id: 'publications',
        type: 'publications',
        name: trans.publications,
        visible: true,
        items: []
      },
      {
        id: 'references',
        type: 'references',
        name: trans.references,
        visible: true,
        items: []
      }
    ]
  };
}

export function createDemoResume(lang: LanguageCode = 'en'): Resume {
  const base = createNewResume('John Doe - Principal Engineer', lang);
  const trans = TRANSLATIONS[lang];

  // Fill personal section
  base.sections[0].items[0] = {
    fullName: 'John Doe',
    jobTitle: 'Principal Software Engineer',
    email: 'john.doe@example.com',
    phone: '+1 (555) 019-2834',
    location: 'San Francisco, CA',
    website: 'https://johndoe.dev',
    linkedin: 'linkedin.com/in/johndoe',
    github: 'github.com/johndoe',
  };

  // Fill summary
  base.sections[1].items[0] = 
    'Innovative and results-driven Principal Software Engineer with 10+ years of experience designing and building high-performance web applications, distributed systems, and modern SaaS clouds. Direct expertise in React, TypeScript, Node.js, and high-frequency messaging. Proven track record of steering cross-functional engineering squads, reducing systems latency by 45%, and architecting robust developer-facing workflows.';

  // Fill experience
  base.sections[2].items = [
    {
      id: 'exp-1',
      company: 'CloudScale Technologies Inc.',
      position: 'Principal Platform Architect',
      startDate: '2021-02',
      endDate: '',
      current: true,
      location: 'San Francisco, CA',
      description: '- Architected high-throughput microservices processing over 120,000 requests per second with 99.99% operational uptime.\n- Led migration of legacy Angular clients to a unified React and Vite monorepo, decreasing time-to-market by 30%.\n- Spearheaded system virtualization and optimized database index layers, achieving a 45% reduction in compute bills.'
    },
    {
      id: 'exp-2',
      company: 'BuildFlow Systems',
      position: 'Senior Full Stack Engineer',
      startDate: '2018-06',
      endDate: '2021-01',
      current: false,
      location: 'New York, NY',
      description: '- Engineered responsive real-time data visualizer dashboard using D3.js, React, and server-sent events.\n- Authored customizable parsing microservice processing millions of structural business documents daily.\n- Mentored and trained 8 junior developers on TypeScript best practices and reliable unit testing coverage.'
    }
  ];

  // Fill education
  base.sections[3].items = [
    {
      id: 'edu-1',
      institution: 'Stanford University',
      degree: 'Master of Science',
      fieldOfStudy: 'Computer Science',
      startDate: '2016-09',
      endDate: '2018-05',
      current: false,
      grade: 'GPA 3.92',
      description: 'Specialization in Distributed Systems, Graphics, and Advanced Web Security standards.'
    }
  ];

  // Fill skills
  base.sections[4].items = [
    { id: 'sk-1', name: 'TypeScript / JavaScript', level: 'Expert' },
    { id: 'sk-2', name: 'React / Redux / Zustand', level: 'Expert' },
    { id: 'sk-3', name: 'Node.js / Express', level: 'Expert' },
    { id: 'sk-4', name: 'PostgreSQL / MongoDB / Redis', level: 'Advanced' },
    { id: 'sk-5', name: 'Docker / Kubernetes / AWS', level: 'Advanced' },
    { id: 'sk-6', name: 'System Design & Architecture', level: 'Expert' }
  ];

  // Fill projects
  base.sections[5].items = [
    {
      id: 'pj-1',
      name: 'OmniStream Engine',
      role: 'Lead Designer & Core Contributor',
      url: 'github.com/johndoe/omnistream',
      startDate: '2022-01',
      endDate: '',
      current: true,
      description: 'An open-source reactive data-stream aggregator written entirely in modern TypeScript, handling complex event correlations at sub-millisecond intervals.'
    }
  ];

  // Certifications
  base.sections[6].items = [
    { id: 'ct-1', name: 'AWS Certified Solutions Architect – Professional', issuer: 'Amazon Web Services', date: '2023-04' }
  ];

  // Awards
  base.sections[7].items = [
    { id: 'aw-1', title: 'Outstanding Engineering Achievement Award', issuer: 'CloudScale Tech', date: '2024-11', description: 'Awarded for lead architecting the Cloud Virtualization layer saving $1.2M annually.' }
  ];

  // Languages
  base.sections[8].items = [
    { id: 'lg-1', name: 'English', proficiency: 'Native' },
    { id: 'lg-2', name: 'Spanish', proficiency: 'Conversational' }
  ];

  // Volunteer
  base.sections[9].items = [
    {
      id: 'vl-1',
      organization: 'Code For America',
      role: 'Volunteer Staff Developer',
      startDate: '2020-01',
      endDate: '',
      current: true,
      description: 'Maintained and refined open municipal database access portals for city transit, boosting local web engagement by 60%.'
    }
  ];

  // Publications
  base.sections[10].items = [
    { id: 'pb-1', title: 'Scaling Modern Reactive Single Page Frameworks', publisher: 'IEEE Software Engineering Journal', date: '2022-08', url: 'https://ieee-se-journal.example.com/scaling-react', description: 'A study detailing virtual DOM rendering optimizations under heavy constant network payloads.' }
  ];

  // References
  base.sections[11].items = [
    { id: 'rf-1', name: 'Sarah Jenkins', relationship: 'Former Engineering Director', company: 'BuildFlow Systems', contact: 'sarah.j@buildflow.com' }
  ];

  return base;
}

export interface StoreState {
  resumes: Resume[];
  activeResumeId: string | null;
  past: Resume[][];
  future: Resume[][];
}

export const loadInitialState = (): StoreState => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
      const parsed = JSON.parse(data);
      if (parsed && Array.isArray(parsed.resumes) && parsed.resumes.length > 0) {
        return {
          resumes: parsed.resumes,
          activeResumeId: parsed.activeResumeId || parsed.resumes[0].id,
          past: [],
          future: []
        };
      }
    }
  } catch (e) {
    console.warn('Failed to parse local resume storage', e);
  }

  // Fallback to fresh demo resume if empty
  const demo = createDemoResume('en');
  const fallbackState: StoreState = {
    resumes: [demo],
    activeResumeId: demo.id,
    past: [],
    future: []
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ resumes: fallbackState.resumes, activeResumeId: fallbackState.activeResumeId }));
  return fallbackState;
};

export class ResumeStoreManager {
  private state: StoreState;
  private listeners: Set<(state: StoreState) => void> = new Set();

  constructor() {
    this.state = loadInitialState();
  }

  public getState() {
    return this.state;
  }

  public subscribe(listener: (state: StoreState) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit() {
    this.listeners.forEach((listener) => listener(this.state));
    // Persist to local storage
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          resumes: this.state.resumes,
          activeResumeId: this.state.activeResumeId,
        })
      );
    } catch (e) {
      console.error('LocalStorage write failed:', e);
    }
  }

  private pushToHistory() {
    // Deep clone current resumes
    const serialized = JSON.stringify(this.state.resumes);
    this.state.past.push(JSON.parse(serialized));
    this.state.future = []; // Clear redo stack on change
    if (this.state.past.length > 30) {
      this.state.past.shift(); // Limit history to 30 steps
    }
  }

  public undo() {
    if (this.state.past.length === 0) return;
    const previous = this.state.past.pop()!;
    this.state.future.push(JSON.parse(JSON.stringify(this.state.resumes)));
    this.state.resumes = previous;
    this.emit();
  }

  public redo() {
    if (this.state.future.length === 0) return;
    const next = this.state.future.pop()!;
    this.state.past.push(JSON.parse(JSON.stringify(this.state.resumes)));
    this.state.resumes = next;
    this.emit();
  }

  public getActiveResume(): Resume | null {
    return this.state.resumes.find((r) => r.id === this.state.activeResumeId) || null;
  }

  public setActiveResume(id: string) {
    if (this.state.activeResumeId === id) return;
    this.state.activeResumeId = id;
    this.emit();
  }

  public createNewResume(title: string, lang: LanguageCode = 'en') {
    this.pushToHistory();
    const resume = createNewResume(title, lang);
    this.state.resumes.push(resume);
    this.state.activeResumeId = resume.id;
    this.emit();
    return resume;
  }

  public createDemoResume(lang: LanguageCode = 'en') {
    this.pushToHistory();
    const resume = createDemoResume(lang);
    this.state.resumes.push(resume);
    this.state.activeResumeId = resume.id;
    this.emit();
    return resume;
  }

  public deleteResume(id: string) {
    this.pushToHistory();
    this.state.resumes = this.state.resumes.filter((r) => r.id !== id);
    if (this.state.activeResumeId === id) {
      this.state.activeResumeId = this.state.resumes.length > 0 ? this.state.resumes[0].id : null;
    }
    this.emit();
  }

  public renameResume(id: string, newTitle: string) {
    this.pushToHistory();
    this.state.resumes = this.state.resumes.map((r) => {
      if (r.id === id) {
        return { ...r, title: newTitle, updatedAt: new Date().toISOString() };
      }
      return r;
    });
    this.emit();
  }

  public duplicateResume(id: string) {
    this.pushToHistory();
    const source = this.state.resumes.find((r) => r.id === id);
    if (!source) return;

    const copy: Resume = JSON.parse(JSON.stringify(source));
    copy.id = `resume-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    copy.title = `${source.title} (Copy)`;
    copy.updatedAt = new Date().toISOString();

    this.state.resumes.push(copy);
    this.state.activeResumeId = copy.id;
    this.emit();
  }

  public updateActiveResume(updater: (resume: Resume) => Resume) {
    if (!this.state.activeResumeId) return;
    this.pushToHistory();
    this.state.resumes = this.state.resumes.map((r) => {
      if (r.id === this.state.activeResumeId) {
        const updated = updater(r);
        return { ...updated, updatedAt: new Date().toISOString() };
      }
      return r;
    });
    this.emit();
  }

  public setLanguage(lang: LanguageCode) {
    this.updateActiveResume((resume) => {
      // Also update default built-in section names to match translation
      const trans = TRANSLATIONS[lang];
      const updatedSections = resume.sections.map((sec) => {
        // If they matching a standard default name, translate it automatically
        const oldTransKey = Object.keys(TRANSLATIONS[resume.language]).find(
          (key) => TRANSLATIONS[resume.language][key] === sec.name
        );
        if (oldTransKey && trans[oldTransKey]) {
          return { ...sec, name: trans[oldTransKey] };
        }
        return sec;
      });
      return {
        ...resume,
        language: lang,
        sections: updatedSections,
      };
    });
  }

  public setTemplateId(tid: string) {
    this.updateActiveResume((resume) => ({
      ...resume,
      templateId: tid,
    }));
  }

  public updateStyles(styles: Partial<ResumeStyles>) {
    this.updateActiveResume((resume) => ({
      ...resume,
      styles: { ...resume.styles, ...styles },
    }));
  }

  public updateSectionHeader(sectionId: string, newName: string) {
    this.updateActiveResume((resume) => {
      const sections = resume.sections.map((sec) =>
        sec.id === sectionId ? { ...sec, name: newName } : sec
      );
      return { ...resume, sections };
    });
  }

  public toggleSectionVisibility(sectionId: string) {
    this.updateActiveResume((resume) => {
      const sections = resume.sections.map((sec) =>
        sec.id === sectionId ? { ...sec, visible: !sec.visible } : sec
      );
      return { ...resume, sections };
    });
  }

  public toggleSectionCollapse(sectionId: string) {
    this.updateActiveResume((resume) => {
      const sections = resume.sections.map((sec) =>
        sec.id === sectionId ? { ...sec, collapsed: !sec.collapsed } : sec
      );
      return { ...resume, sections, styles: resume.styles }; // bypass history lock by omitting if wanted, but standard update is fine
    });
  }

  public reorderSections(orderedIds: string[]) {
    this.updateActiveResume((resume) => {
      const sectionMap = new Map(resume.sections.map((s) => [s.id, s]));
      const newSections: ResumeSection[] = [];
      
      // Add based on orderedIds
      orderedIds.forEach((id) => {
        const sec = sectionMap.get(id);
        if (sec) {
          newSections.push(sec);
          sectionMap.delete(id);
        }
      });

      // Any remaining tags that weren't in reorder (safety fallback)
      sectionMap.forEach((sec) => {
        newSections.push(sec);
      });

      return { ...resume, sections: newSections };
    });
  }

  public moveSection(idx: number, direction: 'up' | 'down') {
    const active = this.getActiveResume();
    if (!active) return;
    const sections = [...active.sections];
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= sections.length) return;

    // Swap elements
    const temp = sections[idx];
    sections[idx] = sections[targetIdx];
    sections[targetIdx] = temp;

    this.updateActiveResume((resume) => ({
      ...resume,
      sections,
    }));
  }

  public addCustomSection(customName: string) {
    this.updateActiveResume((resume) => {
      const customId = `custom-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
      const newSection: ResumeSection = {
        id: customId,
        type: 'custom',
        name: customName || 'Custom Section',
        visible: true,
        items: []
      };
      return {
        ...resume,
        sections: [...resume.sections, newSection],
      };
    });
  }

  public deleteSection(sectionId: string) {
    this.updateActiveResume((resume) => ({
      ...resume,
      sections: resume.sections.filter((sec) => sec.id !== sectionId),
    }));
  }

  public addSectionItem(sectionId: string, itemTemplate: any) {
    this.updateActiveResume((resume) => {
      const sections = resume.sections.map((sec) => {
        if (sec.id === sectionId) {
          return {
            ...sec,
            items: [...sec.items, { id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`, ...itemTemplate }],
          };
        }
        return sec;
      });
      return { ...resume, sections };
    });
  }

  public updateSectionItem(sectionId: string, itemId: string, itemData: any) {
    this.updateActiveResume((resume) => {
      const sections = resume.sections.map((sec) => {
        if (sec.id === sectionId) {
          // If the section type is personal or summary, they have a single item that can be updated directly
          if (sec.type === 'personal') {
            return {
              ...sec,
              items: [{ ...sec.items[0], ...itemData }],
            };
          }
          if (sec.type === 'summary') {
            return {
              ...sec,
              items: [itemData],
            };
          }

          // Otherwise, match item id
          const items = sec.items.map((it) => (it.id === itemId ? { ...it, ...itemData } : it));
          return { ...sec, items };
        }
        return sec;
      });
      return { ...resume, sections };
    });
  }

  public deleteSectionItem(sectionId: string, itemId: string) {
    this.updateActiveResume((resume) => {
      const sections = resume.sections.map((sec) => {
        if (sec.id === sectionId) {
          return {
            ...sec,
            items: sec.items.filter((it) => it.id !== itemId),
          };
        }
        return sec;
      });
      return { ...resume, sections };
    });
  }

  public restoreBackup(resumesData: Resume[], activeId: string | null) {
    this.pushToHistory();
    this.state.resumes = resumesData;
    this.state.activeResumeId = activeId || (resumesData.length > 0 ? resumesData[0].id : null);
    this.emit();
  }

  public clearAllData() {
    this.pushToHistory();
    const demo = createDemoResume('en');
    this.state.resumes = [demo];
    this.state.activeResumeId = demo.id;
    this.emit();
  }
}

export const store = new ResumeStoreManager();
