/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle } from 'docx';
import { Resume, ResumeSection } from './types';
import { resolveDocxFont } from './fonts';

// Strips inline HTML tags that inline rich-text editing can introduce, so the
// exported document contains clean plain text only.
function stripHtml(value: string | undefined): string {
  if (!value) return '';
  return value
    .replace(/<br\s*\/?>(?=)/gi, '\n')
    .replace(/<\/(p|div|li)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .trim();
}

// Builds a "start – end" date range, omitting anything empty so blank dates
// never produce stray separators in the export.
function formatRange(start: string | undefined, end: string | undefined, current?: boolean): string {
  const s = stripHtml(start);
  const e = current ? 'Present' : stripHtml(end);
  if (s && e) return `${s} – ${e}`;
  return s || e || '';
}

export function saveAsDocx(resume: Resume) {
  const styles = resume.styles;
  const primaryColor = styles.primaryColor || '#1e3a8a';
  const docFont = resolveDocxFont(styles.fontFamily);

  // Helper for bullet list from multi-line text descriptions
  const createBulletParagraphs = (descText: string) => {
    const plain = stripHtml(descText);
    if (!plain) return [];

    // Split by newlines, clean empty ones
    const lines = plain.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    return lines.map(line => {
      // Strips leading bullet points if present, so we don't double bullet
      const clean = line.replace(/^[\s·•\-*\d\.\)]+/, '').trim();
      return new Paragraph({
        text: clean,
        bullet: {
          level: 0,
        },
        spacing: {
          before: 80,
          after: 80,
        },
      });
    });
  };

  const docChildren: any[] = [];

  // 1. Head Card - Personal Information
  const personalSec = resume.sections.find(s => s.type === 'personal');
  const contact = personalSec?.items[0] || {};

  if (personalSec && personalSec.visible) {
    // Full Name Heading
    docChildren.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        heading: HeadingLevel.HEADING_1,
        spacing: {
          after: 120,
        },
        children: [
          new TextRun({
            text: stripHtml(contact.fullName),
            bold: true,
            size: 48, // 24pt
            color: primaryColor.replace('#', ''),
            font: docFont,
          }),
        ],
      })
    );

    // Job Title Subtitle
    if (stripHtml(contact.jobTitle)) {
      docChildren.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: {
            after: 240,
          },
          children: [
            new TextRun({
              text: stripHtml(contact.jobTitle).toUpperCase(),
              bold: true,
              size: 20, // 10pt
              color: '555555',
              font: docFont,
            }),
          ],
        })
      );
    }

    // Contact Grid line (Email, Phone, Location...)
    const contactParts = [
      contact.email,
      contact.phone,
      contact.location,
      contact.website,
      contact.linkedin,
      contact.github,
    ].map(stripHtml).filter(Boolean);

    docChildren.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: {
          after: 480,
        },
        children: [
          new TextRun({
            text: contactParts.join('  |  '),
            size: 18, // 9pt
            color: '666666',
            font: docFont,
          }),
        ],
      })
    );
  }

  // Double check and iterate over all visible sections
  resume.sections.forEach((sec: ResumeSection) => {
    if (!sec.visible || sec.type === 'personal' || sec.items.length === 0) return;

    // 2. Section Title Paragraph
    docChildren.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: {
          before: 360,
          after: 180,
        },
        border: {
          bottom: {
            color: primaryColor.replace('#', ''),
            space: 4,
            style: BorderStyle.SINGLE,
            size: 12,
          },
        },
        children: [
          new TextRun({
            text: stripHtml(sec.name).toUpperCase(),
            bold: true,
            size: 24, // 12pt
            color: primaryColor.replace('#', ''),
            font: docFont,
          }),
        ],
      })
    );

    // 3. Render section specific items
    if (sec.type === 'summary') {
      const textVal = stripHtml(sec.items[0]);
      if (textVal) {
        docChildren.push(
          new Paragraph({
            spacing: { after: 240 },
            children: [
              new TextRun({
                text: textVal,
                size: 20,
                font: docFont,
              }),
            ],
          })
        );
      }
    }
    
    else if (sec.type === 'experience') {
      sec.items.forEach((exp: any) => {
        const position = stripHtml(exp.position);
        const company = stripHtml(exp.company);
        const range = formatRange(exp.startDate, exp.endDate, exp.current);
        const location = stripHtml(exp.location);

        const headerRuns: TextRun[] = [];
        if (position) headerRuns.push(new TextRun({ text: `${position} `, bold: true, size: 20, font: docFont }));
        if (company) headerRuns.push(new TextRun({ text: `${position ? 'at ' : ''}${company} `, bold: true, color: '555555', size: 20, font: docFont }));
        if (range) headerRuns.push(new TextRun({ text: `– (${range})`, color: '777777', size: 18, font: docFont }));

        if (headerRuns.length > 0) {
          docChildren.push(new Paragraph({ spacing: { before: 120, after: 60 }, children: headerRuns }));
        }

        if (location) {
          docChildren.push(
            new Paragraph({
              spacing: { after: 120 },
              children: [
                new TextRun({ text: location, italics: true, size: 18, color: '888888', font: docFont }),
              ],
            })
          );
        }

        // Bullets description
        const bullets = createBulletParagraphs(exp.description);
        docChildren.push(...bullets);
      });
    }
    
    else if (sec.type === 'education') {
      sec.items.forEach((edu: any) => {
        const degree = stripHtml(edu.degree);
        const field = stripHtml(edu.fieldOfStudy);
        const institution = stripHtml(edu.institution);
        const range = formatRange(edu.startDate, edu.endDate, edu.current);
        const grade = stripHtml(edu.grade);
        const description = stripHtml(edu.description);

        const headerRuns: TextRun[] = [];
        const degreeLine = [degree, field].filter(Boolean).join(' in ');
        if (degreeLine) headerRuns.push(new TextRun({ text: `${degreeLine} `, bold: true, size: 20, font: docFont }));
        if (institution) headerRuns.push(new TextRun({ text: `${degreeLine ? '– ' : ''}${institution} `, bold: true, color: '555555', size: 20, font: docFont }));
        if (range) headerRuns.push(new TextRun({ text: `| ${range}`, color: '777777', size: 18, font: docFont }));

        if (headerRuns.length > 0) {
          docChildren.push(new Paragraph({ spacing: { before: 120, after: 60 }, children: headerRuns }));
        }

        const detail = [grade ? `Grade: ${grade}` : '', description].filter(Boolean).join(' | ');
        if (detail) {
          docChildren.push(
            new Paragraph({
              spacing: { after: 120 },
              children: [new TextRun({ text: detail, size: 18, font: docFont })],
            })
          );
        }
      });
    }
    
    else if (sec.type === 'projects') {
      sec.items.forEach((proj: any) => {
        const name = stripHtml(proj.name);
        const role = stripHtml(proj.role);
        const url = stripHtml(proj.url);

        const runs: TextRun[] = [];
        if (name) runs.push(new TextRun({ text: `${name} `, bold: true, size: 20, font: docFont }));
        if (role) runs.push(new TextRun({ text: `(${role})`, color: '666666', size: 18, font: docFont }));
        if (url) runs.push(new TextRun({ text: ` | ${url}`, italics: true, size: 18, font: docFont }));

        if (runs.length > 0) {
          docChildren.push(new Paragraph({ spacing: { before: 120, after: 60 }, children: runs }));
        }

        const projectBullets = createBulletParagraphs(proj.description);
        docChildren.push(...projectBullets);
      });
    }

    else if (sec.type === 'skills') {
      // Skills inline horizontal render separated by • bullets
      const skNames = sec.items
        .map((sk: any) => {
          const name = stripHtml(sk.name);
          const level = stripHtml(sk.level);
          return name ? `${name}${level ? ` (${level})` : ''}` : '';
        })
        .filter(Boolean);
      if (skNames.length > 0) {
        docChildren.push(
          new Paragraph({
            spacing: { after: 240 },
            children: [new TextRun({ text: skNames.join('   •   '), size: 20, font: docFont })],
          })
        );
      }
    }

    else if (sec.type === 'languages') {
      const langNames = sec.items
        .map((lg: any) => {
          const name = stripHtml(lg.name);
          const proficiency = stripHtml(lg.proficiency);
          return name ? `${name}${proficiency ? ` (${proficiency})` : ''}` : '';
        })
        .filter(Boolean);
      if (langNames.length > 0) {
        docChildren.push(
          new Paragraph({
            spacing: { after: 180 },
            children: [new TextRun({ text: langNames.join('   |   '), size: 20, font: docFont })],
          })
        );
      }
    }

    else if (sec.type === 'certifications') {
      sec.items.forEach((cert: any) => {
        const name = stripHtml(cert.name);
        const issuer = stripHtml(cert.issuer);
        const date = stripHtml(cert.date);
        if (!name && !issuer && !date) return;

        const runs: TextRun[] = [];
        if (name) runs.push(new TextRun({ text: `${name} `, bold: true, size: 20, font: docFont }));
        if (issuer) runs.push(new TextRun({ text: `by ${issuer}`, color: '555555', size: 18, font: docFont }));
        if (date) runs.push(new TextRun({ text: ` (${date})`, color: '888888', size: 18, font: docFont }));

        docChildren.push(new Paragraph({ spacing: { after: 120 }, bullet: { level: 0 }, children: runs }));
      });
    }

    else if (sec.type === 'awards') {
      sec.items.forEach((aw: any) => {
        const title = stripHtml(aw.title);
        const issuer = stripHtml(aw.issuer);
        const date = stripHtml(aw.date);
        const description = stripHtml(aw.description);

        const runs: TextRun[] = [];
        if (title) runs.push(new TextRun({ text: `${title} `, bold: true, size: 20, font: docFont }));
        if (issuer) runs.push(new TextRun({ text: `by ${issuer} `, color: '555555', size: 18, font: docFont }));
        if (date) runs.push(new TextRun({ text: `(${date})`, color: '888888', size: 18, font: docFont }));

        if (runs.length > 0) {
          docChildren.push(new Paragraph({ spacing: { after: 120 }, children: runs }));
        }
        if (description) {
          docChildren.push(
            new Paragraph({ spacing: { after: 180 }, children: [new TextRun({ text: description, size: 18, font: docFont })] })
          );
        }
      });
    }

    else if (sec.type === 'volunteer') {
      sec.items.forEach((vol: any) => {
        const role = stripHtml(vol.role);
        const organization = stripHtml(vol.organization);
        const range = formatRange(vol.startDate, vol.endDate, vol.current);

        const runs: TextRun[] = [];
        const heading = [role, organization].filter(Boolean).join(' at ');
        if (heading) runs.push(new TextRun({ text: `${heading} `, bold: true, size: 20, font: docFont }));
        if (range) runs.push(new TextRun({ text: `– (${range})`, color: '777777', size: 18, font: docFont }));

        if (runs.length > 0) {
          docChildren.push(new Paragraph({ spacing: { before: 120, after: 60 }, children: runs }));
        }
        const volBullets = createBulletParagraphs(vol.description);
        docChildren.push(...volBullets);
      });
    }

    else if (sec.type === 'publications') {
      sec.items.forEach((pub: any) => {
        const title = stripHtml(pub.title);
        const publisher = stripHtml(pub.publisher);
        const date = stripHtml(pub.date);
        const description = stripHtml(pub.description);

        const runs: TextRun[] = [];
        if (title) runs.push(new TextRun({ text: `"${title}" `, bold: true, size: 20, font: docFont }));
        if (publisher) runs.push(new TextRun({ text: `published in ${publisher} `, color: '666666', size: 18, font: docFont }));
        if (date) runs.push(new TextRun({ text: `(${date})`, color: '888888', size: 18, font: docFont }));

        if (runs.length > 0) {
          docChildren.push(new Paragraph({ spacing: { after: 120 }, children: runs }));
        }
        if (description) {
          docChildren.push(
            new Paragraph({ spacing: { after: 180 }, children: [new TextRun({ text: description, size: 18, font: docFont })] })
          );
        }
      });
    }

    else if (sec.type === 'references') {
      sec.items.forEach((ref: any) => {
        const name = stripHtml(ref.name);
        const relationship = stripHtml(ref.relationship);
        const company = stripHtml(ref.company);
        const contact = stripHtml(ref.contact);

        const runs: TextRun[] = [];
        if (name) runs.push(new TextRun({ text: `${name} `, bold: true, size: 20, font: docFont }));
        const sub = [relationship, company].filter(Boolean).join(', ');
        if (sub) runs.push(new TextRun({ text: `– ${sub} `, size: 18, font: docFont }));
        if (contact) runs.push(new TextRun({ text: `| Contact: ${contact}`, italics: true, size: 18, color: '555555', font: docFont }));

        if (runs.length > 0) {
          docChildren.push(new Paragraph({ spacing: { after: 120 }, children: runs }));
        }
      });
    }
    
    else if (sec.type === 'custom') {
      sec.items.forEach((item: any) => {
        const title = stripHtml(item.title);
        const subtitle = stripHtml(item.subtitle);
        const date = stripHtml(item.date);

        const runs: TextRun[] = [];
        if (title) runs.push(new TextRun({ text: `${title} `, bold: true, size: 20, font: docFont }));
        if (subtitle) runs.push(new TextRun({ text: `(${subtitle})`, color: '555555', size: 18, font: docFont }));
        if (date) runs.push(new TextRun({ text: ` – ${date}`, color: '888888', size: 18, font: docFont }));

        if (runs.length > 0) {
          docChildren.push(new Paragraph({ spacing: { before: 120, after: 60 }, children: runs }));
        }
        const customBullets = createBulletParagraphs(item.description);
        docChildren.push(...customBullets);
      });
    }
  });

  // Create document object
  const doc = new Document({
    sections: [
      {
        properties: {},
        children: docChildren,
      },
    ],
  });

  // Export and download
  Packer.toBlob(doc).then((blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${resume.title.replace(/[\s\/]/g, '_') || 'resume'}.docx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }).catch((err) => {
    console.error('Word generation failed:', err);
  });
}
export function saveAsTxt(resume: Resume) {
  // Joins only the non-empty parts of a line with a separator.
  const join = (parts: (string | undefined)[], sep: string) => parts.map(stripHtml).filter(Boolean).join(sep);

  let output = `==================================================\n`;
  output += `   ${stripHtml(resume.title).toUpperCase()}\n`;
  output += `==================================================\n\n`;

  resume.sections.forEach(sec => {
    if (!sec.visible || sec.items.length === 0) return;

    let body = '';

    if (sec.type === 'personal') {
      const contact = sec.items[0] || {};
      const lines: string[] = [];
      if (stripHtml(contact.fullName)) lines.push(`Name: ${stripHtml(contact.fullName)}`);
      if (stripHtml(contact.jobTitle)) lines.push(`Role: ${stripHtml(contact.jobTitle)}`);
      if (stripHtml(contact.email)) lines.push(`Email: ${stripHtml(contact.email)}`);
      if (stripHtml(contact.phone)) lines.push(`Phone: ${stripHtml(contact.phone)}`);
      if (stripHtml(contact.location)) lines.push(`Location: ${stripHtml(contact.location)}`);
      if (stripHtml(contact.website)) lines.push(`Portfolio: ${stripHtml(contact.website)}`);
      if (stripHtml(contact.linkedin)) lines.push(`LinkedIn: ${stripHtml(contact.linkedin)}`);
      if (stripHtml(contact.github)) lines.push(`GitHub: ${stripHtml(contact.github)}`);
      body = lines.join('\n');
    }

    else if (sec.type === 'summary') {
      body = stripHtml(sec.items[0]);
    }

    else if (sec.type === 'experience') {
      body = sec.items.map((exp: any) => {
        const lines: string[] = [];
        if (join([exp.position, exp.company], ' at ')) lines.push(`* ${join([exp.position, exp.company], ' at ')}`);
        const range = join([exp.startDate, exp.current ? 'Present' : exp.endDate], ' - ');
        if (range) lines.push(`  Duration: ${range}`);
        if (stripHtml(exp.location)) lines.push(`  Location: ${stripHtml(exp.location)}`);
        if (stripHtml(exp.description)) lines.push(`  Key Achievements:\n${stripHtml(exp.description)}`);
        return lines.join('\n');
      }).filter(Boolean).join('\n\n');
    }

    else if (sec.type === 'education') {
      body = sec.items.map((edu: any) => {
        const lines: string[] = [];
        if (join([edu.degree, edu.fieldOfStudy], ' in ')) lines.push(`* ${join([edu.degree, edu.fieldOfStudy], ' in ')}`);
        if (stripHtml(edu.institution)) lines.push(`  Institution: ${stripHtml(edu.institution)}`);
        const range = join([edu.startDate, edu.current ? 'Present' : edu.endDate], ' - ');
        if (range) lines.push(`  Duration: ${range}`);
        if (stripHtml(edu.grade)) lines.push(`  Grade: ${stripHtml(edu.grade)}`);
        if (stripHtml(edu.description)) lines.push(`  Details: ${stripHtml(edu.description)}`);
        return lines.join('\n');
      }).filter(Boolean).join('\n\n');
    }

    else if (sec.type === 'skills') {
      body = sec.items
        .map((sk: any) => (stripHtml(sk.name) ? `${stripHtml(sk.name)}${stripHtml(sk.level) ? ` (${stripHtml(sk.level)})` : ''}` : ''))
        .filter(Boolean)
        .join(', ');
    }

    else if (sec.type === 'projects') {
      body = sec.items.map((proj: any) => {
        const lines: string[] = [];
        if (stripHtml(proj.name)) lines.push(`* Project: ${stripHtml(proj.name)}`);
        if (stripHtml(proj.role)) lines.push(`  Role: ${stripHtml(proj.role)}`);
        if (stripHtml(proj.url)) lines.push(`  Link: ${stripHtml(proj.url)}`);
        const range = join([proj.startDate, proj.current ? 'Present' : proj.endDate], ' - ');
        if (range) lines.push(`  Duration: ${range}`);
        if (stripHtml(proj.description)) lines.push(`  Description: ${stripHtml(proj.description)}`);
        return lines.join('\n');
      }).filter(Boolean).join('\n\n');
    }

    else if (sec.type === 'certifications') {
      body = sec.items
        .map((cert: any) => join([cert.name && `${stripHtml(cert.name)}`, cert.issuer && `issued by ${stripHtml(cert.issuer)}`, cert.date && `(${stripHtml(cert.date)})`], ' '))
        .filter(Boolean)
        .map((l: string) => `- ${l}`)
        .join('\n');
    }

    else if (sec.type === 'languages') {
      body = sec.items
        .map((lg: any) => (stripHtml(lg.name) ? `${stripHtml(lg.name)}${stripHtml(lg.proficiency) ? ` (${stripHtml(lg.proficiency)})` : ''}` : ''))
        .filter(Boolean)
        .join(', ');
    }

    else if (sec.type === 'awards') {
      body = sec.items.map((aw: any) => {
        const head = join([aw.title, aw.issuer && `issued by ${stripHtml(aw.issuer)}`, aw.date && `(${stripHtml(aw.date)})`], ' ');
        const lines: string[] = [];
        if (head) lines.push(`- ${head}`);
        if (stripHtml(aw.description)) lines.push(`  Description: ${stripHtml(aw.description)}`);
        return lines.join('\n');
      }).filter(Boolean).join('\n');
    }

    else {
      body = sec.items.map((item: any) => {
        const head = join([item.title, item.date && `(${stripHtml(item.date)})`], ' ');
        const lines: string[] = [];
        if (head) lines.push(`- ${head}`);
        if (stripHtml(item.description)) lines.push(`  Detail: ${stripHtml(item.description)}`);
        return lines.join('\n');
      }).filter(Boolean).join('\n');
    }

    // Skip sections that produced no real content at all.
    if (!body.trim()) return;

    output += `--- ${stripHtml(sec.name).toUpperCase()} ---\n`;
    output += `${body}\n\n`;
  });

  const blob = new Blob([output], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${resume.title.replace(/[\s\/]/g, '_') || 'resume'}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
