import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

dotenv.config();

const app = express();
const PORT = 3000;

// Body parser
app.use(express.json({ limit: '10mb' }));

// 1. API: Health Check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// 2. API: Structured Resume Parser (Gemini API)
app.post("/api/resume/parse", async (req: express.Request, res: express.Response) => {
  const { text, language = "en" } = req.body;

  console.log(`[API/resume/parse] Received payload. Text length: ${text ? text.length : 0}, Language: ${language}`);
  if (text) {
    console.log(`[API/resume/parse] Text head:\n${text.substring(0, 500)}`);
    console.log(`[API/resume/parse] Text tail:\n${text.substring(Math.max(0, text.length - 500))}`);
  }

  if (!text || text.trim().length === 0) {
    return res.status(400).json({ error: "Extracted text payload is empty." });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: "Gemini API key is not configured. Please open AI Studio Settings > Secrets and add GEMINI_API_KEY."
    });
  }

  try {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [
        {
          text: `You are an industry-leading, highly experienced resume and CV parser/extractor.
          Your goal is to read raw, unstructured text extracted from a resume (which may have been split into dual vertical columns) and categorize EVERY single detail into the correct structured JSON format.

          CRITICAL QUALITY GUIDELINES:
          1. DUAL COLUMN HANDLING: The text may contain markers like "--- COLUMN LEFT ---" and "--- COLUMN RIGHT ---". This indicates a multi-column visual layout. Identify sections from both columns and map them logically to the target JSON schema. Never drop sections from either column!
          2. ALL EXPERIENCES: Parse EVERY single job experience, position, and internship listed in the text. Do not omit any items. For each, extract the correct position title, company name, dates (e.g., "APR 2022 - PRESENT", "JUL 2015 - JUL 2018"), and responsibilities description. Do not paraphrase or shorten; keep complete detail in the description.
          3. ALL EDUCATION: Parse EVERY single educational degree listed on the resume. For example, if there is both B.Tech and M.Des listed, extract BOTH.
          4. CONTACT INFO PRESERVATION: Maintain exact contact details (e.g. (+91) 90282 04789). Do NOT default them, do NOT replace prefixes with generic placeholders, and do NOT truncate.
          5. NO FALSE WEBSITES: If a domain like 'gmail.com' or 'linkedin.com' is listed but is merely a contact record, do NOT add it as a standalone personal 'website'. Leave 'website' blank unless it is an actual dedicated personal workspace or personal URL.
          6. STRICT FIDELITY: Do NOT invent or hallucinate any data. If a field or section is not in the text, omit it or leave it blank.

          Here is the raw extracted resume text:
          """
          ${text}
          """`
        }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            personalInfo: {
              type: Type.OBJECT,
              properties: {
                fullName: { type: Type.STRING },
                jobTitle: { type: Type.STRING },
                email: { type: Type.STRING },
                phone: { type: Type.STRING },
                location: { type: Type.STRING },
                website: { type: Type.STRING },
                linkedin: { type: Type.STRING },
                github: { type: Type.STRING }
              }
            },
            summary: { type: Type.STRING },
            experience: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  company: { type: Type.STRING },
                  position: { type: Type.STRING },
                  startDate: { type: Type.STRING },
                  endDate: { type: Type.STRING },
                  current: { type: Type.BOOLEAN },
                  location: { type: Type.STRING },
                  description: { type: Type.STRING, description: "Detailed summary of responsibilities and achievements in markdown or bullet points" }
                }
              }
            },
            education: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  institution: { type: Type.STRING },
                  degree: { type: Type.STRING },
                  fieldOfStudy: { type: Type.STRING },
                  startDate: { type: Type.STRING },
                  endDate: { type: Type.STRING },
                  current: { type: Type.BOOLEAN },
                  grade: { type: Type.STRING, description: "GPA, grade percentage or classification, e.g., 3.8/4.0 or GPA 8.2" },
                  description: { type: Type.STRING }
                }
              }
            },
            projects: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  role: { type: Type.STRING },
                  url: { type: Type.STRING },
                  startDate: { type: Type.STRING },
                  endDate: { type: Type.STRING },
                  current: { type: Type.BOOLEAN },
                  description: { type: Type.STRING },
                  technologiesKeys: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING }
                  }
                }
              }
            },
            skills: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  level: { type: Type.STRING, description: "One of: 'Beginner', 'Intermediate', 'Advanced', 'Expert' or leave empty" }
                }
              }
            },
            certifications: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  issuer: { type: Type.STRING },
                  date: { type: Type.STRING },
                  url: { type: Type.STRING }
                }
              }
            },
            languages: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  proficiency: { type: Type.STRING, description: "One of: 'Basic', 'Conversational', 'Fluent', 'Native' or leave empty" }
                }
              }
            },
            awards: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  issuer: { type: Type.STRING },
                  date: { type: Type.STRING },
                  description: { type: Type.STRING }
                }
              }
            },
            volunteer: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  organization: { type: Type.STRING },
                  role: { type: Type.STRING },
                  startDate: { type: Type.STRING },
                  endDate: { type: Type.STRING },
                  current: { type: Type.BOOLEAN },
                  description: { type: Type.STRING }
                }
              }
            },
            publications: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  publisher: { type: Type.STRING },
                  date: { type: Type.STRING },
                  url: { type: Type.STRING },
                  description: { type: Type.STRING }
                }
              }
            },
            references: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  relationship: { type: Type.STRING },
                  company: { type: Type.STRING },
                  contact: { type: Type.STRING }
                }
              }
            }
          }
        }
      }
    });

    const textOutput = response.text;
    if (!textOutput) {
      throw new Error("No text output received from Gemini API.");
    }

    const rawData = JSON.parse(textOutput.trim());

    // Build the dynamic Resume object with generated IDs
    const resumeId = `resume-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const labelsMap: Record<string, Record<string, string>> = {
      en: {
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
      },
      hi: {
        personal: 'व्यक्तिगत जानकारी',
        summary: 'पेशेवर सारांश',
        experience: 'कार्य अनुभव',
        education: 'शिक्षा',
        skills: 'कohशल',
        projects: 'परियोजनाएं',
        certifications: 'प्रमाणपत्र',
        awards: 'पुरस्कार',
        languages: 'भाषाएं',
        volunteer: 'स्वयंसेवक अनुभव',
        publications: 'प्रकाशन',
        references: 'संदर्भ',
      },
      fr: {
        personal: 'Informations Personnelles',
        summary: 'Résumé Professionnel',
        experience: 'Expérience Professionnelle',
        education: 'Éducation',
        skills: 'Compétences',
        projects: 'Projets',
        certifications: 'Certifications',
        awards: 'Distinctions',
        languages: 'Langues',
        volunteer: 'Expérience de Bénévolat',
        publications: 'Publications',
        references: 'Références',
      },
      de: {
        personal: 'Persönliche Informationen',
        summary: 'Zusammenfassung',
        experience: 'Berufserfahrung',
        education: 'Ausbildung',
        skills: 'Fähigkeiten',
        projects: 'Projekte',
        certifications: 'Zertifizierungen',
        awards: 'Auszeichnungen',
        languages: 'Sprachen',
        volunteer: 'Ehrenamtliche Tätigkeit',
        publications: 'Publikationen',
        references: 'Referenzen',
      },
      es: {
        personal: 'Información Personal',
        summary: 'Resumen Profesional',
        experience: 'Experiencia Laboral',
        education: 'Educación',
        skills: 'Habilidades',
        projects: 'Proyectos',
        certifications: 'Certificaciones',
        awards: 'Premios',
        languages: 'Idiomas',
        volunteer: 'Experiencia de Voluntariado',
        publications: 'Publicaciones',
        references: 'Referencias',
      }
    };

    const trans = labelsMap[language] || labelsMap.en;

    const personalInfo = rawData.personalInfo || {};
    const personalSection = {
      id: 'personal',
      type: 'personal',
      name: trans.personal,
      visible: true,
      items: [{
        fullName: personalInfo.fullName || '',
        jobTitle: personalInfo.jobTitle || '',
        email: personalInfo.email || '',
        phone: personalInfo.phone || '',
        location: personalInfo.location || '',
        website: personalInfo.website || '',
        linkedin: personalInfo.linkedin || '',
        github: personalInfo.github || '',
      }]
    };

    const summarySection = {
      id: 'summary',
      type: 'summary',
      name: trans.summary,
      visible: !!rawData.summary,
      items: rawData.summary ? [rawData.summary] : ['']
    };

    const experienceSection = {
      id: 'experience',
      type: 'experience',
      name: trans.experience,
      visible: !!(rawData.experience && rawData.experience.length > 0),
      items: (rawData.experience || []).map((exp: any, idx: number) => ({
        id: `exp-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 5)}`,
        company: exp.company || '',
        position: exp.position || '',
        startDate: exp.startDate || '',
        endDate: exp.endDate || '',
        current: !!exp.current,
        location: exp.location || '',
        description: exp.description || ''
      }))
    };

    const educationSection = {
      id: 'education',
      type: 'education',
      name: trans.education,
      visible: !!(rawData.education && rawData.education.length > 0),
      items: (rawData.education || []).map((edu: any, idx: number) => ({
        id: `edu-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 5)}`,
        institution: edu.institution || '',
        degree: edu.degree || '',
        fieldOfStudy: edu.fieldOfStudy || '',
        startDate: edu.startDate || '',
        endDate: edu.endDate || '',
        current: !!edu.current,
        grade: edu.grade || '',
        description: edu.description || ''
      }))
    };

    const skillsSection = {
      id: 'skills',
      type: 'skills',
      name: trans.skills,
      visible: !!(rawData.skills && rawData.skills.length > 0),
      items: (rawData.skills || []).map((sk: any, idx: number) => ({
        id: `sk-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 5)}`,
        name: sk.name || '',
        level: sk.level || ''
      }))
    };

    const projectsSection = {
      id: 'projects',
      type: 'projects',
      name: trans.projects,
      visible: !!(rawData.projects && rawData.projects.length > 0),
      items: (rawData.projects || []).map((p: any, idx: number) => ({
        id: `pj-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 5)}`,
        name: p.name || '',
        role: p.role || '',
        url: p.url || '',
        startDate: p.startDate || '',
        endDate: p.endDate || '',
        current: !!p.current,
        description: p.description || '',
        technologiesKeys: p.technologiesKeys || []
      }))
    };

    const certificationsSection = {
      id: 'certifications',
      type: 'certifications',
      name: trans.certifications,
      visible: !!(rawData.certifications && rawData.certifications.length > 0),
      items: (rawData.certifications || []).map((cert: any, idx: number) => ({
        id: `ct-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 5)}`,
        name: cert.name || '',
        issuer: cert.issuer || '',
        date: cert.date || '',
        url: cert.url || ''
      }))
    };

    const awardsSection = {
      id: 'awards',
      type: 'awards',
      name: trans.awards,
      visible: !!(rawData.awards && rawData.awards.length > 0),
      items: (rawData.awards || []).map((aw: any, idx: number) => ({
        id: `aw-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 5)}`,
        title: aw.title || '',
        issuer: aw.issuer || '',
        date: aw.date || '',
        description: aw.description || ''
      }))
    };

    const languagesSection = {
      id: 'languages',
      type: 'languages',
      name: trans.languages,
      visible: !!(rawData.languages && rawData.languages.length > 0),
      items: (rawData.languages || []).map((langItem: any, idx: number) => ({
        id: `lg-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 5)}`,
        name: langItem.name || '',
        proficiency: langItem.proficiency || ''
      }))
    };

    const volunteerSection = {
      id: 'volunteer',
      type: 'volunteer',
      name: trans.volunteer,
      visible: !!(rawData.volunteer && rawData.volunteer.length > 0),
      items: (rawData.volunteer || []).map((vol: any, idx: number) => ({
        id: `vol-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 5)}`,
        organization: vol.organization || '',
        role: vol.role || '',
        startDate: vol.startDate || '',
        endDate: vol.endDate || '',
        current: !!vol.current,
        description: vol.description || ''
      }))
    };

    const publicationsSection = {
      id: 'publications',
      type: 'publications',
      name: trans.publications,
      visible: !!(rawData.publications && rawData.publications.length > 0),
      items: (rawData.publications || []).map((pub: any, idx: number) => ({
        id: `pub-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 5)}`,
        title: pub.title || '',
        publisher: pub.publisher || '',
        date: pub.date || '',
        url: pub.url || '',
        description: pub.description || ''
      }))
    };

    const referencesSection = {
      id: 'references',
      type: 'references',
      name: trans.references,
      visible: !!(rawData.references && rawData.references.length > 0),
      items: (rawData.references || []).map((ref: any, idx: number) => ({
        id: `ref-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 5)}`,
        name: ref.name || '',
        relationship: ref.relationship || '',
        company: ref.company || '',
        contact: ref.contact || ''
      }))
    };

    const sections = [
      personalSection,
      summarySection,
      experienceSection,
      educationSection,
      skillsSection,
      projectsSection,
      certificationsSection,
      awardsSection,
      languagesSection,
      volunteerSection,
      publicationsSection,
      referencesSection
    ];

    const finalResume = {
      id: resumeId,
      title: (personalInfo.fullName ? personalInfo.fullName : "Parsed Resume"),
      updatedAt: new Date().toISOString(),
      language,
      templateId: 'ats-friendly',
      styles: {
        primaryColor: '#1e3a8a',
        textColor: '#1f2937',
        backgroundColor: '#ffffff',
        fontFamily: 'sans',
        fontSize: 'md',
        spacing: 'normal',
        dividerStyle: 'solid',
        sectionHeadingSize: 'md',
        sectionHeadingAlignment: 'left',
        borderRadius: 'md',
      },
      sections
    };

    res.json({ success: true, resume: finalResume });
  } catch (error: any) {
    console.error("Gemini CV parse error:", error);
    res.status(500).json({ error: error.message || "An error occurred during resume parsing." });
  }
});

// Configure Vite integration for local development or asset serving in production
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server fully operational at: http://localhost:${PORT}`);
  });
}

startServer();
