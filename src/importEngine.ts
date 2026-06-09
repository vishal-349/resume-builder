/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Resume, ResumeSection, SectionType, LanguageCode } from './types';
import { createNewResume } from './store';

// Helper to clean lines
function cleanLine(line: string): string {
  return line.trim().replace(/^[\s·•\-*\d\.\)]+/, '').trim();
}

/**
 * Super-smart pattern matching parser to turn raw text resumes into complete structured Resume objects.
 */
export function parseRawResumeText(text: string, lang: LanguageCode = 'en'): Resume {
  const base = createNewResume('Imported Resume', lang);

  if (!text || text.trim().length === 0) {
    return base;
  }

  const lines = text.split('\n').map(line => line.trim());
  
  // 1. Detect Personal Information via heuristic regexes
  let fullName = '';
  let email = '';
  let phone = '';
  let location = '';
  let website = '';
  let linkedin = '';
  let github = '';
  let jobTitle = '';

  // Email regex
  const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i;
  // Phone regex
  const phoneRegex = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/;
  // URL configurations
  const linkedinRegex = /(linkedin\.com\/in\/[a-zA-Z0-9-_]+)/i;
  const githubRegex = /(github\.com\/[a-zA-Z0-9-_]+)/i;
  const generalUrlRegex = /((https?:\/\/)?(www\.)?[a-zA-Z0-9-]+\.[a-zA-Z]{2,}[^\s]*)/;

  // Scan first 20 lines for contact information
  const scanLimit = Math.min(lines.length, 25);
  for (let i = 0; i < scanLimit; i++) {
    const line = lines[i];
    if (!line) continue;

    // Try finding email
    if (!email) {
      const emailMatch = line.match(emailRegex);
      if (emailMatch) email = emailMatch[1];
    }

    // Try finding phone
    if (!phone) {
      const phoneMatch = line.match(phoneRegex);
      if (phoneMatch) phone = phoneMatch[0];
    }

    // Try finding LinkedIn
    if (!linkedin) {
      const liMatch = line.match(linkedinRegex);
      if (liMatch) linkedin = liMatch[1];
    }

    // Try finding GitHub
    if (!github) {
      const ghMatch = line.match(githubRegex);
      if (ghMatch) github = ghMatch[1];
    }

    // Capture location candidate (e.g. San Francisco, CA)
    if (!location && (line.includes(',') || line.match(/^[a-zA-Z\s]+,\s*[a-zA-Z]{2}\b/))) {
      // Ensure it is not an email or url
      if (!line.includes('@') && !line.includes('.') && line.length < 50) {
         location = line;
      }
    }

    // Website match (not linkedin or github)
    if (!website) {
      const urlMatch = line.match(generalUrlRegex);
      if (urlMatch && !urlMatch[1].includes('linkedin') && !urlMatch[1].includes('github')) {
        website = urlMatch[1];
      }
    }
  }

  // Name is usually in the first 3 lines, having letters and capitals
  for (let i = 0; i < Math.min(lines.length, 5); i++) {
    const line = lines[i];
    if (line && line.length > 3 && line.length < 40 && !line.includes('@') && !line.includes('http') && !line.includes(':') && !phoneRegex.test(line)) {
      if (/^[A-Z][a-zA-Z\s]+$/.test(line)) {
        fullName = line;
        // The line following the name is often their current job title
        const nextLine = lines[i + 1];
        if (nextLine && nextLine.length > 3 && nextLine.length < 40 && !nextLine.includes('@') && !nextLine.includes('.') && !phoneRegex.test(nextLine)) {
          jobTitle = nextLine;
        }
        break;
      }
    }
  }

  // Fill personal section
  const personalSec = base.sections.find(s => s.type === 'personal')!;
  personalSec.items[0] = {
    fullName: fullName || (lines[0] && lines[0].length < 35 ? lines[0] : ''),
    jobTitle: jobTitle || '',
    email,
    phone,
    location,
    website,
    linkedin,
    github,
  };

  // 2. Identify Sections based on synonym headers
  const sectionHeaders: { type: SectionType; triggers: string[] }[] = [
    { type: 'summary', triggers: ['summary', 'professional summary', 'career objective', 'objective', 'about me', 'profile'] },
    { type: 'experience', triggers: ['experience', 'work history', 'employment history', 'professional experience', 'work experience', 'history'] },
    { type: 'education', triggers: ['education', 'academic', 'academic history', 'degrees', 'education details', 'scholastic'] },
    { type: 'skills', triggers: ['skills', 'technical skills', 'core competencies', 'capabilities', 'expertise', 'technologies'] },
    { type: 'projects', triggers: ['projects', 'personal projects', 'key projects', 'developments', 'creations'] },
    { type: 'certifications', triggers: ['certifications', 'credentials', 'licensing', 'certificates'] },
    { type: 'awards', triggers: ['awards', 'honors', 'distinctions', 'achievements'] },
    { type: 'languages', triggers: ['languages', 'linguistics', 'idioms'] },
    { type: 'volunteer', triggers: ['volunteer', 'social work', 'volunteer experience'] },
    { type: 'publications', triggers: ['publications', 'papers', 'research', 'articles'] },
    { type: 'references', triggers: ['references', 'recommendations'] },
  ];

  type TextSegment = { type: SectionType; header: string; contentLines: string[] };
  const segments: TextSegment[] = [];
  let currentSegment: TextSegment | null = null;

  lines.forEach(line => {
    const lowerLine = line.toLowerCase().trim();
    // Check if line matches a Section Header (must be short, typically < 6 words or enclosed in separators)
    let foundHeader = false;
    if (line.length > 2 && line.length < 45) {
      for (const sh of sectionHeaders) {
        if (sh.triggers.includes(lowerLine) || 
            sh.triggers.some(t => lowerLine === `## ${t}` || lowerLine === `### ${t}` || lowerLine.replace(/[^a-z0-9 ]/g, '').trim() === t)) {
          
          // Save prior segment
          if (currentSegment) {
            segments.push(currentSegment);
          }
          currentSegment = {
            type: sh.type,
            header: line,
            contentLines: []
          };
          foundHeader = true;
          break;
        }
      }
    }

    if (!foundHeader && currentSegment) {
      currentSegment.contentLines.push(line);
    }
  });

  // Push last segment
  if (currentSegment) {
    segments.push(currentSegment);
  }

  // If no segments found, let's treat the whole thing as a summary or throw fallback
  if (segments.length === 0) {
    const summarySec = base.sections.find(s => s.type === 'summary')!;
    summarySec.items[0] = text.slice(0, 1000); // paste first 1k chars
    return base;
  }

  // 3. Process parsed sections
  segments.forEach(seg => {
    const secObj = base.sections.find(s => s.type === seg.type);
    if (!secObj) return;

    secObj.name = seg.header; // preserve custom header style!
    secObj.visible = true;

    const rawLines = seg.contentLines.filter(l => l.trim().length > 0);

    if (seg.type === 'summary') {
      secObj.items[0] = rawLines.join('\n');
    } 
    
    else if (seg.type === 'skills') {
      // Skills can be listed as a comma-separated line, or one per line
      const skillsTemp: any[] = [];
      rawLines.forEach(line => {
        if (line.includes(',') || line.includes('|') || line.includes('•')) {
          const parts = line.split(/[\|•,\t]/);
          parts.forEach(p => {
            const clean = cleanLine(p).trim();
            if (clean && clean.length > 1 && clean.length < 35) {
              skillsTemp.push({
                id: `sk-${Math.random().toString(36).substr(2, 5)}`,
                name: clean,
                level: ''
              });
            }
          });
        } else {
          const clean = cleanLine(line);
          if (clean && clean.length > 1 && clean.length < 35) {
            skillsTemp.push({
              id: `sk-${Math.random().toString(36).substr(2, 5)}`,
              name: clean,
              level: ''
            });
          }
        }
      });
      secObj.items = skillsTemp.slice(0, 20); // cap at 20 skills
    } 
    
    else if (seg.type === 'education') {
      const eduList: any[] = [];
      let currentEdu: any = null;

      rawLines.forEach(line => {
        const isHeaderCandidate = line.includes('Degree') || line.includes('Bachelor') || line.includes('Master') || line.includes('B.S') || line.includes('M.S') || line.includes('PhD') || line.includes('B.A') || line.includes('University') || line.includes('College') || line.includes('Institute');
        
        // Match dates, e.g. "2016 - 2020" or "Aug 2018"
        const dateMatch = line.match(/(?:(?:19|20)\d{2})[-–—\s]+(?:(?:19|20)\d{2}|present|current)/i);

        if (isHeaderCandidate || !currentEdu) {
          if (currentEdu) eduList.push(currentEdu);
          
          let degreeStr = '';
          const degreePatterns = [/bachelor/i, /master/i, /doctor/i, /ph\.?d/i, /b\.?a\b/i, /b\.?s\b/i, /m\.?s\b/i, /degree/i, /diploma/i, /b\.tech/i, /m\.tech/i];
          degreePatterns.forEach(pat => {
            if (line.match(pat)) {
              degreeStr = line;
            }
          });

          currentEdu = {
            id: `edu-${Math.random().toString(36).substr(2, 5)}`,
            institution: degreeStr ? line.replace(degreeStr, '').replace(/[,-]/g, '').trim() : line,
            degree: degreeStr ? cleanLine(degreeStr.split(',')[0]) : 'Bachelor of Science',
            fieldOfStudy: '',
            startDate: dateMatch ? dateMatch[0].split(/[–-]/)[0].trim() : '2016-09',
            endDate: dateMatch ? dateMatch[0].split(/[–-]/)[1]?.trim() || '' : '2020-05',
            current: line.toLowerCase().includes('present'),
            description: ''
          };
        } else {
          // Additional line - append to field of study or description
          if (!currentEdu.fieldOfStudy && line.length < 50 && !line.includes('•')) {
            currentEdu.fieldOfStudy = line;
          } else {
            currentEdu.description = currentEdu.description ? `${currentEdu.description}\n${line}` : line;
          }
        }
      });

      if (currentEdu) eduList.push(currentEdu);
      secObj.items = eduList;
    } 
    
    else if (seg.type === 'experience') {
      const expList: any[] = [];
      let currentExp: any = null;

      // Group together experience line by line
      rawLines.forEach(line => {
        const hasCompanyKeywords = line.includes('Inc') || line.includes('Co.') || line.includes('Corp') || line.includes('LLC') || line.includes('Ltd') || line.includes('Technologies') || line.includes('Solutions') || line.includes('Systems');
        const hasDateRange = line.match(/(?:(?:19|20)\d{2})[-–—\s]+(?:(?:19|20)\d{2}|present|current)/i) || line.toLowerCase().includes('present');
        const isBulletPoint = line.startsWith('•') || line.startsWith('-') || line.startsWith('*') || line.startsWith('·');

        // If it fits a company/role title header line, start of experience
        if ((hasCompanyKeywords || (hasDateRange && !isBulletPoint)) && !isBulletPoint) {
          if (currentExp) expList.push(currentExp);
          
          let dateStr = '';
          const dateMatch = line.match(/(?:(?:19|20)\d{2})[-–—\s\w]+(?:present|current|(?:19|20)\d{2})/i);
          if (dateMatch) dateStr = dateMatch[0];

          const headerText = dateStr ? line.replace(dateStr, '').trim() : line;
          const parts = headerText.split(/[,-|]/);

          currentExp = {
            id: `exp-${Math.random().toString(36).substr(2, 5)}`,
            company: parts[1] ? cleanLine(parts[1]) : cleanLine(parts[0]),
            position: parts[1] ? cleanLine(parts[0]) : 'Software Engineer',
            startDate: '2020-01',
            endDate: '2023-12',
            current: line.toLowerCase().includes('present'),
            location: parts[2] ? cleanLine(parts[2]) : '',
            description: ''
          };
        } else {
          // Aggregate bullets/tasks to description
          if (currentExp) {
            currentExp.description = currentExp.description ? `${currentExp.description}\n${line}` : line;
          } else if (expList.length > 0) {
            // Append to previous if current got closed
            const prev = expList[expList.length - 1];
            prev.description = prev.description ? `${prev.description}\n${line}` : line;
          }
        }
      });

      if (currentExp) expList.push(currentExp);
      secObj.items = expList;
    }
    
    else if (seg.type === 'projects') {
      const projList: any[] = [];
      let currentProj: any = null;

      rawLines.forEach(line => {
        const isBullet = line.startsWith('•') || line.startsWith('-') || line.startsWith('*');
        if (!isBullet && line.length < 50 && !currentProj) {
          currentProj = {
            id: `pj-${Math.random().toString(36).substr(2, 5)}`,
            name: line,
            role: 'Developer',
            startDate: '2021-01',
            endDate: '',
            current: true,
            description: ''
          };
        } else if (currentProj) {
          if (isBullet) {
            currentProj.description = currentProj.description ? `${currentProj.description}\n${line}` : line;
          } else {
            projList.push(currentProj);
            currentProj = {
              id: `pj-${Math.random().toString(36).substr(2, 5)}`,
              name: line,
              role: 'Developer',
              startDate: '2021-01',
              endDate: '',
              current: true,
              description: ''
            };
          }
        }
      });
      if (currentProj) projList.push(currentProj);
      secObj.items = projList;
    }

    else if (seg.type === 'certifications') {
      secObj.items = rawLines.map((line, idx) => ({
        id: `ct-${idx}-${Math.random().toString(36).substr(2, 5)}`,
        name: cleanLine(line),
        issuer: '',
        date: ''
      })).slice(0, 10);
    }

    else if (seg.type === 'languages') {
      secObj.items = rawLines.map((line, idx) => ({
        id: `lg-${idx}-${Math.random().toString(36).substr(2, 5)}`,
        name: cleanLine(line.split(/[-:|]/)[0]),
        proficiency: 'Fluent'
      })).slice(0, 6);
    }

    else if (seg.type === 'awards') {
      secObj.items = rawLines.map((line, idx) => ({
        id: `aw-${idx}-${Math.random().toString(36).substr(2, 5)}`,
        title: cleanLine(line),
        issuer: '',
        date: '',
        description: ''
      })).slice(0, 8);
    }
  });

  return base;
}
