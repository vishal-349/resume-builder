/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Resume, ResumeSection, SectionType, LanguageCode, CustomSectionItem } from './types';
import { createNewResume } from './store';

// Helper to clean lines
function cleanLine(line: string): string {
  return line.trim().replace(/^[\s·•\-*\d\.\)]+/, '').trim();
}

/**
 * Super-smart, deterministic pattern matching rules engine.
 * Isolates headers dynamically (standard & custom), groups lines, and forms fields
 * specifically for the found items without forcing any missing fields into the viewport.
 */
export function parseRawResumeText(text: string, lang: LanguageCode = 'en'): Resume {
  const base = createNewResume('Dynamic Parsed Resume', lang);

  if (!text || text.trim().length === 0) {
    return base;
  }

  const lines = text.split('\n');

  // 1. Core Profile Details scanner
  let fullName = '';
  let email = '';
  let phone = '';
  let location = '';
  let website = '';
  let linkedin = '';
  let github = '';
  let jobTitle = '';

  const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i;
  const phoneRegex = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/;
  const linkedinRegex = /(linkedin\.com\/in\/[a-zA-Z0-9-_]+)/i;
  const githubRegex = /(github\.com\/[a-zA-Z0-9-_]+)/i;
  const generalUrlRegex = /((https?:\/\/)?(www\.)?[a-zA-Z0-9-]+\.[a-zA-Z]{2,}[^\s]*)/;

  const scanLimit = Math.min(lines.length, 30);
  for (let i = 0; i < scanLimit; i++) {
    const line = lines[i]?.trim();
    if (!line) continue;

    if (!email) {
      const emailMatch = line.match(emailRegex);
      if (emailMatch) email = emailMatch[1];
    }

    if (!phone) {
      const phoneMatch = line.match(phoneRegex);
      if (phoneMatch) phone = phoneMatch[0];
    }

    if (!linkedin) {
      const liMatch = line.match(linkedinRegex);
      if (liMatch) linkedin = liMatch[1];
    }

    if (!github) {
      const ghMatch = line.match(githubRegex);
      if (ghMatch) github = ghMatch[1];
    }

    if (!location && (line.includes(',') || line.match(/^[a-zA-Z\s]+,\s*[a-zA-Z]{2}\b/))) {
      if (!line.includes('@') && !line.includes('.') && line.length < 50 && !phoneRegex.test(line)) {
        location = line;
      }
    }

    if (!website) {
      const urlMatch = line.match(generalUrlRegex);
      if (urlMatch && !urlMatch[1].includes('linkedin') && !urlMatch[1].includes('github')) {
        website = urlMatch[1];
      }
    }
  }

  // Deduce applicant name from first 5 lines
  for (let i = 0; i < Math.min(lines.length, 5); i++) {
    const line = lines[i]?.trim();
    if (line && line.length > 3 && line.length < 40 && !line.includes('@') && !line.includes('http') && !line.includes(':') && !phoneRegex.test(line) && !line.includes('.')) {
      if (/^[A-Z][a-zA-Z\s]+$/.test(line)) {
        fullName = line;
        const nextLine = lines[i + 1]?.trim();
        if (nextLine && nextLine.length > 3 && nextLine.length < 45 && !nextLine.includes('@') && !nextLine.includes('.') && !phoneRegex.test(nextLine)) {
          jobTitle = nextLine;
        }
        break;
      }
    }
  }

  // 2. Headings scanner ruleset definition
  const sectionHeaders: { type: SectionType; triggers: string[] }[] = [
    { type: 'summary', triggers: ['summary2', 'summary', 'professional summary', 'career objective', 'objective', 'about me', 'profile', 'personal profile', 'professional profile'] },
    { type: 'experience', triggers: ['experience', 'work history', 'employment history', 'professional experience', 'work experience', 'history', 'employment', 'career history', 'professional background'] },
    { type: 'education', triggers: ['education', 'academic', 'academic history', 'degrees', 'education details', 'scholastic', 'academic background', 'scholastic background'] },
    { type: 'skills', triggers: ['skills', 'technical skills', 'core competencies', 'capabilities', 'expertise', 'technologies', 'skills & competencies', 'key skills'] },
    { type: 'projects', triggers: ['projects', 'personal projects', 'key projects', 'developments', 'creations', 'selected projects', 'academic projects'] },
    { type: 'certifications', triggers: ['certifications', 'credentials', 'licensing', 'certificates', 'courses', 'professional certifications'] },
    { type: 'awards', triggers: ['awards', 'honors', 'distinctions', 'achievements', 'honors & awards'] },
    { type: 'languages', triggers: ['languages', 'linguistics', 'idioms', 'languages spoken'] },
    { type: 'volunteer', triggers: ['volunteer', 'social work', 'volunteer experience', 'community involvement', 'community service'] },
    { type: 'publications', triggers: ['publications', 'papers', 'research', 'articles', 'patents'] },
    { type: 'references', triggers: ['references', 'recommendations'] },
  ];

  function getHeaderMatch(line: string): { type: SectionType | 'custom'; name: string } | null {
    const trimmed = line.trim();
    if (trimmed.length < 3 || trimmed.length > 50) return null;

    if (trimmed.includes('@') || trimmed.includes('://') || trimmed.includes('.com') || /^\+?\d[\d-\s()]{7,15}$/.test(trimmed)) {
      return null;
    }

    const cleanHead = trimmed.replace(/^[\s#*=\-\[\]<>:_]+|[\s#*=\-\[\]<>:_]+$/g, '').trim();
    const lower = cleanHead.toLowerCase();

    if (lower.includes('column left') || lower.includes('column right')) {
      return null;
    }

    for (const group of sectionHeaders) {
      if (group.triggers.some(t => {
        return lower === t || 
               lower === `my ${t}` || 
               lower === `key ${t}` || 
               lower === `technical ${t}` || 
               lower === `professional ${t}`;
      })) {
        return { type: group.type, name: cleanHead };
      }
    }

    // Capture other short ALL CAPS heading nodes
    if (trimmed.length >= 4 && trimmed.length <= 30 && trimmed === trimmed.toUpperCase() && /^[A-Z][A-Z\s&-]+$/.test(trimmed)) {
      return { type: 'custom', name: cleanHead };
    }

    return null;
  }

  // 3. Extract content partition groups
  const segments: { type: SectionType | 'custom'; header: string; contentLines: string[] }[] = [];
  let currentSegment: { type: SectionType | 'custom'; header: string; contentLines: string[] } | null = null;

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (trimmed.length === 0) return;

    const header = getHeaderMatch(line);
    if (header) {
      if (currentSegment) {
        segments.push(currentSegment);
      }
      currentSegment = {
        type: header.type,
        header: header.name,
        contentLines: []
      };
    } else {
      if (currentSegment) {
        currentSegment.contentLines.push(line);
      }
    }
  });

  if (currentSegment) {
    segments.push(currentSegment);
  }

  // If no sections were isolated, fallback to summary mapping
  if (segments.length === 0) {
    segments.push({
      type: 'summary',
      header: 'Summary',
      contentLines: lines.filter(l => l.trim().length > 0)
    });
  }

  // 4. Populate sections dynamically based exactly on structure found
  const finalSections: ResumeSection[] = [];
  
  // Create personal information card which always exists
  const personalSecDef = base.sections.find(s => s.type === 'personal')!;
  personalSecDef.items[0] = {
    fullName: fullName || (lines[0] && lines[0].length < 35 ? lines[0] : ''),
    jobTitle: jobTitle || '',
    email,
    phone,
    location,
    website,
    linkedin,
    github,
  };
  finalSections.push(personalSecDef);

  const loadedSectionsMap = new Map<string, ResumeSection>();

  segments.forEach((seg) => {
    let secObj: ResumeSection | undefined;

    if (seg.type === 'custom') {
      const customId = `custom-sec-${Math.random().toString(36).substr(2, 5)}`;
      secObj = {
        id: customId,
        type: 'custom',
        name: seg.header,
        visible: true,
        items: []
      };
    } else {
      const stdSec = base.sections.find(s => s.type === seg.type);
      if (stdSec) {
        if (!loadedSectionsMap.has(seg.type)) {
          secObj = {
            ...stdSec,
            name: seg.header,
            visible: true,
            items: []
          };
          loadedSectionsMap.set(seg.type, secObj);
        } else {
          secObj = loadedSectionsMap.get(seg.type);
        }
      }
    }

    if (!secObj) return;

    const rawLines = seg.contentLines.filter(l => l.trim().length > 0);
    if (rawLines.length === 0) return;

    if (secObj.type === 'summary') {
      secObj.items[0] = rawLines.join('\n');
    } 
    
    else if (secObj.type === 'skills') {
      const skillsTemp: any[] = [...secObj.items];
      rawLines.forEach(line => {
        if (line.includes(',') || line.includes('|') || line.includes('•')) {
          const parts = line.split(/[\|•,\t]/);
          parts.forEach(p => {
            const clean = p.trim().replace(/^[\s·•\-*\d\.\)]+/, '').trim();
            if (clean && clean.length > 1 && clean.length < 40) {
              skillsTemp.push({
                id: `sk-${Math.random().toString(36).substr(2, 5)}`,
                name: clean,
                level: ''
              });
            }
          });
        } else {
          const clean = line.trim().replace(/^[\s·•\-*\d\.\)]+/, '').trim();
          if (clean && clean.length > 1 && clean.length < 40) {
            skillsTemp.push({
              id: `sk-${Math.random().toString(36).substr(2, 5)}`,
              name: clean,
              level: ''
            });
          }
        }
      });
      secObj.items = skillsTemp.slice(0, 30);
    } 
    
    else if (secObj.type === 'education') {
      const eduList: any[] = [...secObj.items];
      let currentEdu: any = null;

      rawLines.forEach(line => {
        const isHeaderCandidate = line.includes('Degree') || line.includes('Bachelor') || line.includes('Master') || line.includes('B.S') || line.includes('M.S') || line.includes('PhD') || line.includes('B.A') || line.includes('University') || line.includes('College') || line.includes('Institute') || line.includes('School');
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
            degree: degreeStr ? degreeStr.split(',')[0].trim() : 'Degree',
            fieldOfStudy: '',
            startDate: dateMatch ? dateMatch[0].split(/[–-]/)[0].trim() : '2016',
            endDate: dateMatch ? dateMatch[0].split(/[–-]/)[1]?.trim() || '' : '2020',
            current: line.toLowerCase().includes('present'),
            description: ''
          };
        } else {
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
    
    else if (secObj.type === 'experience') {
      const expList: any[] = [...secObj.items];
      let currentExp: any = null;

      rawLines.forEach(line => {
        const hasCompanyKeywords = line.includes('Inc') || line.includes('Co.') || line.includes('Corp') || line.includes('LLC') || line.includes('Ltd') || line.includes('Technologies') || line.includes('Solutions') || line.includes('Systems');
        const hasDateRange = line.match(/(?:(?:19|20)\d{2})[-–—\s\w]+(?:present|current|(?:19|20)\d{2})/i) || line.toLowerCase().includes('present');
        const isBulletPoint = line.startsWith('•') || line.startsWith('-') || line.startsWith('*') || line.startsWith('·');

        if ((hasCompanyKeywords || (hasDateRange && !isBulletPoint)) && !isBulletPoint) {
          if (currentExp) expList.push(currentExp);
          
          let dateStr = '';
          const dateMatch = line.match(/(?:(?:19|20)\d{2})[-–—\s\w]+(?:present|current|(?:19|20)\d{2})/i);
          if (dateMatch) dateStr = dateMatch[0];

          const headerText = dateStr ? line.replace(dateStr, '').trim() : line;
          const parts = headerText.split(/[,-|]/);

          currentExp = {
            id: `exp-${Math.random().toString(36).substr(2, 5)}`,
            company: parts[1] ? parts[1].trim() : parts[0].trim(),
            position: parts[1] ? parts[0].trim() : 'Position',
            startDate: dateMatch ? dateStr.split(/[–-]/)[0].trim() : '2020',
            endDate: dateMatch ? dateStr.split(/[–-]/)[1]?.trim() || '' : '2023',
            current: line.toLowerCase().includes('present'),
            location: parts[2] ? parts[2].trim() : '',
            description: ''
          };
        } else {
          if (currentExp) {
            currentExp.description = currentExp.description ? `${currentExp.description}\n${line}` : line;
          } else if (expList.length > 0) {
            const prev = expList[expList.length - 1];
            prev.description = prev.description ? `${prev.description}\n${line}` : line;
          }
        }
      });

      if (currentExp) expList.push(currentExp);
      secObj.items = expList;
    }
    
    else if (secObj.type === 'projects') {
      const projList: any[] = [...secObj.items];
      let currentProj: any = null;

      rawLines.forEach(line => {
        const isBullet = line.startsWith('•') || line.startsWith('-') || line.startsWith('*');
        if (!isBullet && line.length < 50 && !currentProj) {
          currentProj = {
            id: `pj-${Math.random().toString(36).substr(2, 5)}`,
            name: line,
            role: 'Developer',
            startDate: '2021',
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
              startDate: '2021',
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

    else if (secObj.type === 'certifications') {
      const parsedCertifications = rawLines.map((line, idx) => ({
        id: `ct-${idx}-${Math.random().toString(36).substr(2, 5)}`,
        name: line.trim().replace(/^[\s·•\-*\d\.\)]+/, '').trim(),
        issuer: '',
        date: ''
      }));
      secObj.items = [...secObj.items, ...parsedCertifications];
    }

    else if (secObj.type === 'languages') {
      const parsedLanguages = rawLines.map((line, idx) => ({
        id: `lg-${idx}-${Math.random().toString(36).substr(2, 5)}`,
        name: line.trim().replace(/^[\s·•\-*\d\.\)]+/, '').trim().split(/[-:|]/)[0].trim(),
        proficiency: 'Fluent'
      }));
      secObj.items = [...secObj.items, ...parsedLanguages];
    }

    else if (secObj.type === 'awards') {
      const parsedAwards = rawLines.map((line, idx) => ({
        id: `aw-${idx}-${Math.random().toString(36).substr(2, 5)}`,
        title: line.trim().replace(/^[\s·•\-*\d\.\)]+/, '').trim(),
        issuer: '',
        date: '',
        description: ''
      }));
      secObj.items = [...secObj.items, ...parsedAwards];
    }

    else if (secObj.type === 'custom') {
      const customItemsList: CustomSectionItem[] = [];
      const paragraphs = seg.contentLines.join('\n').split(/\n\s*\n+/);
      paragraphs.forEach((p) => {
        const cleanP = p.trim();
        if (!cleanP) return;
        const pLines = cleanP.split('\n');
        const firstLine = pLines[0].trim().replace(/^[\s·•\-*\d\.\)]+/, '').trim();
        const restLines = pLines.slice(1).join('\n');
        customItemsList.push({
          id: `custom-item-${Math.random().toString(36).substr(2, 5)}`,
          title: firstLine.substring(0, 80),
          subtitle: firstLine.length > 80 ? firstLine.substring(80, 150) : '',
          date: '',
          description: restLines || firstLine
        });
      });
      secObj.items = [...secObj.items, ...customItemsList];
    }

    if (seg.type === 'custom') {
      finalSections.push(secObj);
    }
  });

  loadedSectionsMap.forEach((sec) => {
    finalSections.push(sec);
  });

  base.sections = finalSections;

  // 5. Bespoke design styling engine
  base.styles = {
    primaryColor: '#334155',
    textColor: '#1e293b',
    backgroundColor: '#ffffff',
    fontFamily: finalSections.length > 5 ? 'Inter' : 'Space Grotesk',
    fontSize: finalSections.length > 5 ? 'sm' : 'md',
    spacing: finalSections.length > 5 ? 'compact' : 'normal',
    dividerStyle: 'solid',
    sectionHeadingSize: 'md',
    sectionHeadingAlignment: 'left',
    borderRadius: 'md',
  };

  const colors = ['#334155', '#1e3a8a', '#0f766e', '#881337', '#9d174d', '#4338ca', '#b45309', '#059669'];
  let colorHash = 0;
  for (let idx = 0; idx < (fullName || 'Imported').length; idx++) {
    colorHash += (fullName || 'Imported').charCodeAt(idx);
  }
  base.styles.primaryColor = colors[colorHash % colors.length] || '#334155';

  return base;
}
