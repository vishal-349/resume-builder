/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Resume, ATSFeedback, SectionType } from './types';

const ACTION_VERBS = [
  'spearheaded', 'led', 'architected', 'engineered', 'compiled', 'formulated',
  'designed', 'managed', 'optimized', 'created', 'refined', 'developed',
  'implemented', 'accelerated', 'pioneered', 'accomplished', 'supervised',
  'orchestrated', 'authored', 'mentored', 'restructured', 'facilitated', 'decreased'
];

const RECRUITER_BUZZWORDS = [
  'scaled', 'distributed systems', 'cloud', 'security', 'database', 'optimization',
  'responsive', 'api', 'automation', 'testing', 'deployment', 'pipeline', 'efficiency',
  'performance', 'architecture', 'agile', 'scrum', 'data', 'analytics', 'collaboration'
];

export function analyzeResumeATS(resume: Resume): ATSFeedback {
  let score = 0;
  const suggestions: ATSFeedback['suggestions'] = [];
  const keywordMissing: string[] = [];

  // 1. Check Contact Info (Max 15 pts)
  const personalSec = resume.sections.find(s => s.type === 'personal');
  const contact = personalSec?.items[0] || {};
  let contactPoints = 0;
  let missingContact: string[] = [];

  if (contact.fullName && contact.fullName.trim().length > 3) contactPoints += 3;
  else missingContact.push('Full Name');

  if (contact.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email)) contactPoints += 3;
  else missingContact.push('Valid Email');

  if (contact.phone && contact.phone.trim().length > 7) contactPoints += 3;
  else missingContact.push('Phone Number');

  if (contact.location && contact.location.trim().length > 4) contactPoints += 3;
  else missingContact.push('Location (City, Country)');

  if (contact.linkedin || contact.github || contact.website) contactPoints += 3;
  else missingContact.push('At least one Professional Link (LinkedIn/GitHub)');

  score += contactPoints;
  if (missingContact.length > 0) {
    suggestions.push({
      category: 'Contact Information',
      text: `Add missing standard contact fields: ${missingContact.join(', ')} to ensure recruiters can easily reach you.`,
      impact: 'high',
      fixed: false
    });
  } else {
    suggestions.push({
      category: 'Contact Information',
      text: 'Perfect! All standard professional contact details are beautifully defined.',
      impact: 'low',
      fixed: true
    });
  }

  // 2. Summary Check (Max 10 pts)
  const summarySec = resume.sections.find(s => s.type === 'summary');
  const summaryText = summarySec?.items[0] || '';
  const summaryLength = summaryText.trim().length;

  if (summarySec && summarySec.visible) {
    if (summaryLength > 150 && summaryLength < 450) {
      score += 10;
      suggestions.push({
        category: 'Professional Summary',
        text: 'Your career summary has an optimal length (150-450 characters) and is perfectly readable.',
        impact: 'low',
        fixed: true
      });
    } else if (summaryLength === 0) {
      suggestions.push({
        category: 'Professional Summary',
        text: 'Outline a brief Professional Summary/Career Objective summarizing your top value and skills.',
        impact: 'high',
        fixed: false
      });
    } else if (summaryLength < 150) {
      score += 5;
      suggestions.push({
        category: 'Professional Summary',
        text: 'Your summary is slightly brief. Make it at least 150 characters to highlight key strengths.',
        impact: 'medium',
        fixed: false
      });
    } else {
      score += 6;
      suggestions.push({
        category: 'Professional Summary',
        text: 'Your summary is somewhat long. Try to condense it to under 450 characters to occupy less space.',
        impact: 'medium',
        fixed: false
      });
    }
  } else {
    suggestions.push({
      category: 'Professional Summary',
      text: 'The Professional Summary section is hidden. We recommend displaying it on top.',
      impact: 'medium',
      fixed: false
    });
  }

  // 3. Work Experience Details (Max 25 pts)
  const expSec = resume.sections.find(s => s.type === 'experience');
  const experiences = expSec?.items || [];
  let expPoints = 0;

  if (expSec && expSec.visible && experiences.length > 0) {
    expPoints += 10; // Section exists and is populated
    
    // Check descriptions for Action Verbs
    let usesActionVerbs = false;
    let longDescriptions = true;
    let missingDates = false;

    experiences.forEach((exp: any) => {
      const desc = (exp.description || '').toLowerCase();
      if (!exp.company || !exp.position || !exp.startDate) {
        missingDates = true;
      }
      
      const containsActionVerb = ACTION_VERBS.some(verb => desc.includes(verb));
      if (containsActionVerb) usesActionVerbs = true;

      if (desc.trim().length < 50) {
        longDescriptions = false;
      }
    });

    if (usesActionVerbs) expPoints += 8;
    if (longDescriptions) expPoints += 7;

    score += expPoints;

    if (!usesActionVerbs) {
      suggestions.push({
        category: 'Work History',
        text: 'Start your job bullets with strong action verbs (e.g., "Spearheaded", "Architected", "Engineered") instead of passive list words.',
        impact: 'high',
        fixed: false
      });
    }
    if (!longDescriptions) {
      suggestions.push({
        category: 'Work History',
        text: 'Your work experience details are brief. Try adding quantifiable achievements (e.g., "reduced latency by 45%") and describe tasks more completely.',
        impact: 'medium',
        fixed: false
      });
    }
    if (missingDates) {
      suggestions.push({
        category: 'Work History',
        text: 'Ensure ALL professional positions define their respective company, title, and start dates clearly.',
        impact: 'high',
        fixed: false
      });
    }
    
    if (usesActionVerbs && longDescriptions && !missingDates) {
      suggestions.push({
        category: 'Work History',
        text: 'Superb! Your career details contain detailed bullets, chronology, and action-oriented vocabulary.',
        impact: 'low',
        fixed: true
      });
    }
  } else {
    suggestions.push({
      category: 'Work History',
      text: 'Missing or disabled Work Experience. Detailed work history is the single most important parameter on ATS scales.',
      impact: 'high',
      fixed: false
    });
  }

  // 4. Skills Parsing & Scoring (Max 15 pts)
  const skillsSec = resume.sections.find(s => s.type === 'skills');
  const skills = skillsSec?.items || [];
  
  if (skillsSec && skillsSec.visible && skills.length > 0) {
    if (skills.length >= 6) {
      score += 15;
      suggestions.push({
        category: 'Skills Competencies',
        text: `Excellent skills catalog! You have identified ${skills.length} distinct technical competencies.`,
        impact: 'low',
        fixed: true
      });
    } else {
      score += 8;
      suggestions.push({
        category: 'Skills Competencies',
        text: 'Add at least 6 core technical skills or tool sets to optimize matching algorithms targeting your stack.',
        impact: 'medium',
        fixed: false
      });
    }
  } else {
    suggestions.push({
      category: 'Skills Competencies',
      text: 'Skills block is empty or invisible. Hard technical and professional skills must be included.',
      impact: 'high',
      fixed: false
    });
  }

  // 5. Academic Background Check (Max 15 pts)
  const eduSec = resume.sections.find(s => s.type === 'education');
  const education = eduSec?.items || [];
  
  if (eduSec && eduSec.visible && education.length > 0) {
    score += 15;
    suggestions.push({
      category: 'Academic Background',
      text: 'Academic qualifications are successfully documented with appropriate graduation timelines.',
      impact: 'low',
      fixed: true
    });
  } else {
    suggestions.push({
      category: 'Academic Background',
      text: 'Education background is undetected or hidden. Always include your degrees and institution credentials.',
      impact: 'medium',
      fixed: false
    });
  }

  // 6. Highlight Projects Check (Max 10 pts)
  const projSec = resume.sections.find(s => s.type === 'projects');
  const projects = projSec?.items || [];
  
  if (projSec && projSec.visible && projects.length > 0) {
    score += 10;
    suggestions.push({
      category: 'Personal Projects',
      text: 'Excellent! Documenting projects establishes practical, hands-on architectural capability.',
      impact: 'low',
      fixed: true
    });
  } else {
    suggestions.push({
      category: 'Personal Projects',
      text: 'No active projects listed. Highlight 1-2 key projects to demonstrate your software-craft skill offline.',
      impact: 'low',
      fixed: false
    });
  }

  // 7. Extra Booster Checklist (Max 10 pts for extra sections)
  let extraCount = 0;
  const extraTypes: SectionType[] = ['certifications', 'awards', 'languages', 'volunteer', 'publications', 'references'];
  resume.sections.forEach(sec => {
    if (extraTypes.includes(sec.type) && sec.visible && sec.items.length > 0) {
      extraCount++;
    }
  });

  if (extraCount >= 2) {
    score += 10;
    suggestions.push({
      category: 'Profile Enrichment',
      text: `Your resume is rich and balanced, showcasing secondary features (Certifications, Languages, Awards, etc.) supporting your profile.`,
      impact: 'low',
      fixed: true
    });
  } else if (extraCount === 1) {
    score += 5;
    suggestions.push({
      category: 'Profile Enrichment',
      text: 'Consider adding one more support block like Certifications, References or Languages to enrich content.',
      impact: 'low',
      fixed: false
    });
  } else {
    suggestions.push({
      category: 'Profile Enrichment',
      text: 'Enrich your professional story by lighting up sections like Certifications, Languages, or Volunteer Experience.',
      impact: 'low',
      fixed: false
    });
  }

  // Analyze keyword density
  const resumeBlobText = JSON.stringify(resume).toLowerCase();
  RECRUITER_BUZZWORDS.forEach(word => {
    if (!resumeBlobText.includes(word)) {
      keywordMissing.push(word);
    }
  });

  // Readability text
  let readabilityAssessment = 'Excellent';
  if (score < 45) {
    readabilityAssessment = 'Difficult/Incomplete - Major structural components are missing. Complete forms to build score.';
  } else if (score < 75) {
    readabilityAssessment = 'Satisfactory - Content is legible but details lack metric impact or core professional buzzwords.';
  } else {
    readabilityAssessment = 'Outstanding - Professional typography, detailed chronological dates, rich verbs, and highly scannable formatting.';
  }

  // Final grade mapping
  let grade: ATSFeedback['grade'] = 'Excellent';
  if (score < 40) grade = 'Critical';
  else if (score < 65) grade = 'Needs Improvement';
  else if (score < 85) grade = 'Good';

  return {
    score: Math.min(100, Math.max(0, score)),
    grade,
    suggestions: suggestions.sort((a, b) => {
      // Sort: incomplete first, then impact high first
      if (a.fixed && !b.fixed) return 1;
      if (!a.fixed && b.fixed) return -1;
      const rank = { high: 3, medium: 2, low: 1 };
      return rank[b.impact] - rank[a.impact];
    }),
    keywordMissing: keywordMissing.slice(0, 5), // Return top 5 missing critical terms
    readabilityAssessment,
  };
}
