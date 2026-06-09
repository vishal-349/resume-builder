/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle, Table, TableRow, TableCell, WidthType } from 'docx';
import { Resume, ResumeSection } from './types';

export function saveAsDocx(resume: Resume) {
  const styles = resume.styles;
  const primaryColor = styles.primaryColor || '#1e3a8a';

  // Helper for bullet list from multi-line text descriptions
  const createBulletParagraphs = (descText: string) => {
    if (!descText) return [];
    
    // Split by newlines, clean empty ones
    const lines = descText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
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
            text: contact.fullName || 'Untitled Applicant',
            bold: true,
            size: 48, // 24pt
            color: primaryColor.replace('#', ''),
            font: styles.fontFamily === 'serif' ? 'Georgia' : 'Arial',
          }),
        ],
      })
    );

    // Job Title Subtitle
    if (contact.jobTitle) {
      docChildren.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: {
            after: 240,
          },
          children: [
            new TextRun({
              text: contact.jobTitle.toUpperCase(),
              bold: true,
              size: 20, // 10pt
              color: '555555',
              font: styles.fontFamily === 'serif' ? 'Georgia' : 'Arial',
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
    ].filter(Boolean);

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
            font: styles.fontFamily === 'serif' ? 'Georgia' : 'Arial',
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
            text: sec.name.toUpperCase(),
            bold: true,
            size: 24, // 12pt
            color: primaryColor.replace('#', ''),
            font: styles.fontFamily === 'serif' ? 'Georgia' : 'Arial',
          }),
        ],
      })
    );

    // 3. Render section specific items
    if (sec.type === 'summary') {
      const textVal = sec.items[0] || '';
      docChildren.push(
        new Paragraph({
          spacing: { after: 240 },
          children: [
            new TextRun({
              text: textVal,
              size: 20,
              font: styles.fontFamily === 'serif' ? 'Georgia' : 'Arial',
            }),
          ],
        })
      );
    } 
    
    else if (sec.type === 'experience') {
      sec.items.forEach((exp: any) => {
        // Experience Header table layout or block
        // Job Title & Company name
        docChildren.push(
          new Paragraph({
            spacing: { before: 120, after: 60 },
            children: [
              new TextRun({
                text: `${exp.position || 'Software Engineer'} `,
                bold: true,
                size: 20,
                font: styles.fontFamily === 'serif' ? 'Georgia' : 'Arial',
              }),
              new TextRun({
                text: `at ${exp.company || 'Company'} `,
                bold: true,
                color: '555555',
                size: 20,
                font: styles.fontFamily === 'serif' ? 'Georgia' : 'Arial',
              }),
              new TextRun({
                text: ` –  (${exp.startDate || ''} to ${exp.current ? 'Present' : exp.endDate || ''})`,
                color: '777777',
                size: 18,
                font: styles.fontFamily === 'serif' ? 'Georgia' : 'Arial',
              }),
            ],
          })
        );

        if (exp.location) {
          docChildren.push(
            new Paragraph({
              spacing: { after: 120 },
              children: [
                new TextRun({
                  text: exp.location,
                  italics: true,
                  size: 18,
                  color: '888888',
                  font: styles.fontFamily === 'serif' ? 'Georgia' : 'Arial',
                }),
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
        docChildren.push(
          new Paragraph({
            spacing: { before: 120, after: 60 },
            children: [
              new TextRun({
                text: `${edu.degree || 'Degree'} in ${edu.fieldOfStudy || 'Field'} `,
                bold: true,
                size: 20,
                font: styles.fontFamily === 'serif' ? 'Georgia' : 'Arial',
              }),
              new TextRun({
                text: `– ${edu.institution || 'Institution'} `,
                bold: true,
                color: '555555',
                size: 20,
                font: styles.fontFamily === 'serif' ? 'Georgia' : 'Arial',
              }),
              new TextRun({
                text: ` |  ${edu.startDate || ''} - ${edu.current ? 'Present' : edu.endDate || ''}`,
                color: '777777',
                size: 18,
                font: styles.fontFamily === 'serif' ? 'Georgia' : 'Arial',
              }),
            ],
          })
        );

        if (edu.grade || edu.description) {
          docChildren.push(
            new Paragraph({
              spacing: { after: 120 },
              children: [
                new TextRun({
                  text: [edu.grade ? `Grade: ${edu.grade}` : '', edu.description].filter(Boolean).join(' | '),
                  size: 18,
                  font: styles.fontFamily === 'serif' ? 'Georgia' : 'Arial',
                }),
              ],
            })
          );
        }
      });
    } 
    
    else if (sec.type === 'projects') {
      sec.items.forEach((proj: any) => {
        docChildren.push(
          new Paragraph({
            spacing: { before: 120, after: 60 },
            children: [
              new TextRun({
                text: `${proj.name || 'Project'} `,
                bold: true,
                size: 20,
                font: styles.fontFamily === 'serif' ? 'Georgia' : 'Arial',
              }),
              new TextRun({
                text: `(${proj.role || 'Role'})`,
                color: '666666',
                size: 18,
                font: styles.fontFamily === 'serif' ? 'Georgia' : 'Arial',
              }),
              new TextRun({
                text: proj.url ? ` | ${proj.url}` : '',
                italics: true,
                size: 18,
                font: styles.fontFamily === 'serif' ? 'Georgia' : 'Arial',
              }),
            ],
          })
        );

        const projectBullets = createBulletParagraphs(proj.description);
        docChildren.push(...projectBullets);
      });
    } 
    
    else if (sec.type === 'skills') {
      // Skills inline horizontal render separated by • bullets
      const skNames = sec.items.map((sk: any) => `${sk.name} ${sk.level ? `(${sk.level})` : ''}`).filter(Boolean);
      docChildren.push(
        new Paragraph({
          spacing: { after: 240 },
          children: [
            new TextRun({
              text: skNames.join('   •   '),
              size: 20,
              font: styles.fontFamily === 'serif' ? 'Georgia' : 'Arial',
            }),
          ],
        })
      );
    } 
    
    else if (sec.type === 'languages') {
      const langNames = sec.items.map((lg: any) => `${lg.name} ${lg.proficiency ? `(${lg.proficiency})` : ''}`).filter(Boolean);
      docChildren.push(
        new Paragraph({
          spacing: { after: 180 },
          children: [
            new TextRun({
              text: langNames.join('   |   '),
              size: 20,
              font: styles.fontFamily === 'serif' ? 'Georgia' : 'Arial',
            }),
          ],
        })
      );
    } 
    
    else if (sec.type === 'certifications') {
      sec.items.forEach((cert: any) => {
        docChildren.push(
          new Paragraph({
            spacing: { after: 120 },
            bullet: { level: 0 },
            children: [
              new TextRun({
                text: `${cert.name || 'Certification'} `,
                bold: true,
                size: 20,
                font: styles.fontFamily === 'serif' ? 'Georgia' : 'Arial',
              }),
              new TextRun({
                text: cert.issuer ? `by ${cert.issuer}` : '',
                color: '555555',
                size: 18,
                font: styles.fontFamily === 'serif' ? 'Georgia' : 'Arial',
              }),
              new TextRun({
                text: cert.date ? ` (${cert.date})` : '',
                color: '888888',
                size: 18,
                font: styles.fontFamily === 'serif' ? 'Georgia' : 'Arial',
              }),
            ],
          })
        );
      });
    } 
    
    else if (sec.type === 'awards') {
      sec.items.forEach((aw: any) => {
        docChildren.push(
          new Paragraph({
            spacing: { after: 120 },
            children: [
              new TextRun({
                text: `${aw.title || 'Award Title'} `,
                bold: true,
                size: 20,
                font: styles.fontFamily === 'serif' ? 'Georgia' : 'Arial',
              }),
              new TextRun({
                text: aw.issuer ? `by ${aw.issuer} ` : '',
                color: '555555',
                size: 18,
                font: styles.fontFamily === 'serif' ? 'Georgia' : 'Arial',
              }),
              new TextRun({
                text: aw.date ? `(${aw.date})` : '',
                color: '888888',
                size: 18,
                font: styles.fontFamily === 'serif' ? 'Georgia' : 'Arial',
              }),
            ],
          })
        );
        if (aw.description) {
          docChildren.push(
            new Paragraph({
              spacing: { after: 180 },
              children: [
                new TextRun({
                  text: aw.description,
                  size: 18,
                  font: styles.fontFamily === 'serif' ? 'Georgia' : 'Arial',
                }),
              ],
            })
          );
        }
      });
    } 
    
    else if (sec.type === 'volunteer') {
      sec.items.forEach((vol: any) => {
        docChildren.push(
          new Paragraph({
            spacing: { before: 120, after: 60 },
            children: [
              new TextRun({
                text: `${vol.role || 'Volunteer'} at ${vol.organization || 'Organization'} `,
                bold: true,
                size: 20,
                font: styles.fontFamily === 'serif' ? 'Georgia' : 'Arial',
              }),
              new TextRun({
                text: `– (${vol.startDate || ''} to ${vol.current ? 'Present' : vol.endDate || ''})`,
                color: '777777',
                size: 18,
                font: styles.fontFamily === 'serif' ? 'Georgia' : 'Arial',
              }),
            ],
          })
        );
        const volBullets = createBulletParagraphs(vol.description);
        docChildren.push(...volBullets);
      });
    }

    else if (sec.type === 'publications') {
      sec.items.forEach((pub: any) => {
        docChildren.push(
          new Paragraph({
            spacing: { after: 120 },
            children: [
              new TextRun({
                text: `"${pub.title || 'Publication Title'}" `,
                bold: true,
                size: 20,
                font: styles.fontFamily === 'serif' ? 'Georgia' : 'Arial',
              }),
              new TextRun({
                text: pub.publisher ? `published in ${pub.publisher} ` : '',
                color: '666666',
                size: 18,
                font: styles.fontFamily === 'serif' ? 'Georgia' : 'Arial',
              }),
              new TextRun({
                text: pub.date ? `(${pub.date})` : '',
                color: '888888',
                size: 18,
                font: styles.fontFamily === 'serif' ? 'Georgia' : 'Arial',
              }),
            ],
          })
        );
        if (pub.description) {
          docChildren.push(
            new Paragraph({
              spacing: { after: 180 },
              children: [
                new TextRun({
                  text: pub.description,
                  size: 18,
                  font: styles.fontFamily === 'serif' ? 'Georgia' : 'Arial',
                }),
              ],
            })
          );
        }
      });
    }

    else if (sec.type === 'references') {
      sec.items.forEach((ref: any) => {
        docChildren.push(
          new Paragraph({
            spacing: { after: 120 },
            children: [
              new TextRun({
                text: `${ref.name || 'Reference Contact'} `,
                bold: true,
                size: 20,
                font: styles.fontFamily === 'serif' ? 'Georgia' : 'Arial',
              }),
              new TextRun({
                text: `– ${ref.relationship || 'Relationship'}, ${ref.company || 'Company'} `,
                size: 18,
                font: styles.fontFamily === 'serif' ? 'Georgia' : 'Arial',
              }),
              new TextRun({
                text: ref.contact ? ` | Contact: ${ref.contact}` : '',
                italics: true,
                size: 18,
                color: '555555',
                font: styles.fontFamily === 'serif' ? 'Georgia' : 'Arial',
              }),
            ],
          })
        );
      });
    } 
    
    else if (sec.type === 'custom') {
      sec.items.forEach((item: any) => {
        docChildren.push(
          new Paragraph({
            spacing: { before: 120, after: 60 },
            children: [
              new TextRun({
                text: `${item.title || 'Item Title'} `,
                bold: true,
                size: 20,
                font: styles.fontFamily === 'serif' ? 'Georgia' : 'Arial',
              }),
              new TextRun({
                text: item.subtitle ? `(${item.subtitle})` : '',
                color: '555555',
                size: 18,
                font: styles.fontFamily === 'serif' ? 'Georgia' : 'Arial',
              }),
              new TextRun({
                text: item.date ? ` – ${item.date}` : '',
                color: '888888',
                size: 18,
                font: styles.fontFamily === 'serif' ? 'Georgia' : 'Arial',
              }),
            ],
          })
        );
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
  let output = `==================================================\n`;
  output += `   ${resume.title.toUpperCase()}\n`;
  output += `==================================================\n\n`;

  resume.sections.forEach(sec => {
    if (!sec.visible || sec.items.length === 0) return;

    output += `--- ${sec.name.toUpperCase()} ---\n`;

    if (sec.type === 'personal') {
      const contact = sec.items[0] || {};
      output += `Name: ${contact.fullName || ''}\n`;
      output += `Role: ${contact.jobTitle || ''}\n`;
      output += `Email: ${contact.email || ''}\n`;
      output += `Phone: ${contact.phone || ''}\n`;
      output += `Location: ${contact.location || ''}\n`;
      if (contact.website) output += `Portfolio: ${contact.website}\n`;
      if (contact.linkedin) output += `LinkedIn: ${contact.linkedin}\n`;
      if (contact.github) output += `GitHub: ${contact.github}\n`;
    } 
    
    else if (sec.type === 'summary') {
      output += `${sec.items[0] || ''}\n`;
    } 
    
    else if (sec.type === 'experience') {
      sec.items.forEach((exp: any) => {
        output += `* Position: ${exp.position || ''}\n  Company: ${exp.company || ''}\n  Duration: ${exp.startDate || ''} - ${exp.current ? 'Present' : exp.endDate || ''}\n  Location: ${exp.location || ''}\n  Key Achievements:\n${exp.description || ''}\n\n`;
      });
    } 
    
    else if (sec.type === 'education') {
      sec.items.forEach((edu: any) => {
        output += `* Degree: ${edu.degree || ''} in ${edu.fieldOfStudy || ''}\n  Institution: ${edu.institution || ''}\n  Duration: ${edu.startDate || ''} - ${edu.current ? 'Present' : edu.endDate || ''}\n  Grade: ${edu.grade || ''}\n  Details: ${edu.description || ''}\n\n`;
      });
    } 
    
    else if (sec.type === 'skills') {
      const sks = sec.items.map((sk: any) => `${sk.name}${sk.level ? ` (${sk.level})` : ''}`);
      output += `${sks.join(', ')}\n`;
    } 
    
    else if (sec.type === 'projects') {
      sec.items.forEach((proj: any) => {
        output += `* Project: ${proj.name || ''}\n  Role: ${proj.role || ''}\n  Link: ${proj.url || ''}\n  Duration: ${proj.startDate || ''} - ${proj.current ? 'Present' : proj.endDate || ''}\n  Description: ${proj.description || ''}\n\n`;
      });
    } 
    
    else if (sec.type === 'certifications') {
      sec.items.forEach((cert: any) => {
        output += `- ${cert.name || ''} issued by ${cert.issuer || ''} (${cert.date || ''})\n`;
      });
    } 
    
    else if (sec.type === 'languages') {
      const lgs = sec.items.map((lg: any) => `${lg.name} (${lg.proficiency || ''})`);
      output += `${lgs.join(', ')}\n`;
    } 
    
    else if (sec.type === 'awards') {
      sec.items.forEach((aw: any) => {
        output += `- ${aw.title || ''} issued by ${aw.issuer || ''} (${aw.date || ''})\n  Description: ${aw.description || ''}\n`;
      });
    } 
    
    else {
      sec.items.forEach((item: any) => {
        output += `- ${item.title || ''} (${item.date || ''})\n  Detail: ${item.description || ''}\n`;
      });
    }

    output += `\n`;
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
