# Resume Builder

A premium, local-first resume builder. Your resumes live in your browser — no accounts, no
database, no server runtime. The one exception is **AI Resume Import**, which sends the document
you upload to an AI provider to be read; everything else runs entirely on your device.

## Features

- 25 customizable templates with a live WYSIWYG A4 preview and automatic multi-page pagination
- Local-first storage: all resumes, settings, and customizations are saved in browser `localStorage`
- **AI Resume Import** — upload a PDF or Word file and get back a fully editable resume that keeps
  your original section headings, order, and design ([details below](#ai-resume-import))
- Heuristic ATS scoring and suggestions, recomputed automatically after an import
- Rich inline editing (bold, italic, underline, lists, alignment, fonts, colors)
- Export to **PDF (print)**, **MS Word (.docx)**, and **plain text (.txt)**
- JSON backup / restore of your entire local database
- Full font-family selection and theming

## Run Locally

**Prerequisites:** Node.js 18+

1. Install dependencies:
   ```
   npm install
   ```
2. Configure an AI key (only needed for Resume Import — see below):
   ```
   cp .env.example .env.local     # then paste your key into .env.local
   ```
3. Start the dev server:
   ```
   npm run dev
   ```

## AI Resume Import

### Setup

Get a free API key from [Google AI Studio](https://aistudio.google.com/apikey) and put it in
`.env.local` at the project root:

```bash
VITE_GEMINI_API_KEY=AIza...your-key-here
```

Restart the dev server afterwards — Vite only reads env vars at startup.

Optional:

| Variable | Default | Purpose |
| --- | --- | --- |
| `VITE_GEMINI_API_KEY` | — | Your Gemini key. Local development only. |
| `VITE_GEMINI_MODEL` | `gemini-flash-latest` | Override the model. |
| `VITE_AI_PROXY_URL` | — | Route through your own backend instead. Takes precedence over the key. |

If no key is configured at build time, the app prompts for one in the import dialog and stores it
in `localStorage` on that device. That keeps a deployed static build usable without a rebuild.

### How it works

The uploaded document is sent to the model **as the original file**, not as extracted text. That is
the whole point: the model sees the page the way a person does — columns, tables, rules, font
weights, colours, whitespace — so it can tell a section heading from a job title, keep a sidebar
from bleeding into the main column, and read a scanned PDF visually.

```
File → validate → read → AI analysis (structured JSON) → normalize → review → editable Resume
```

| Format | What is sent | Notes |
| --- | --- | --- |
| `.pdf` | The original bytes | Best results. Scanned/image-only PDFs work — they are read visually. |
| `.docx` | Converted HTML | Word has no page geometry, but its markup carries heading levels, bold runs, lists and tables. |
| `.doc` | — | Not supported. Save as `.docx` or PDF first; the app says so explicitly. |
| Pasted text | The text | Manual fallback. |

**Nothing is force-fitted into a fixed template.** Section headings are preserved verbatim —
"Technical Toolbox" stays "Technical Toolbox", "Career Highlights" stays "Career Highlights" — in
their original document order. Headings that map to a built-in section type render with that type's
layout; anything else becomes an editable custom section. The imported resume is a native document:
every heading can be renamed, every section reordered or deleted, every entry edited.

The model also reports the document's accent colour, text colour, font family, column count,
heading alignment and density, which are used to rebuild a matching design and register it as a
reusable preset.

**Confidence.** The model scores its own certainty per section and for the document overall.
Anything below 70% is highlighted on the review screen with a note on what specifically was
ambiguous, so you know what to double-check rather than having to re-read everything.

**Duplicate imports.** If an import matches a resume you already have (by email, name, and phone —
not filename, which people change constantly), you are asked whether to replace it, save a copy, or
cancel. Nothing is overwritten silently.

### Architecture

All AI code is isolated behind a service layer. The UI imports exactly one function —
`parseResume(file)` — and has no idea which provider is behind it.

```
src/services/
  ai/
    parser.ts     ← the only entry point the UI touches
    provider.ts   ← the swap point: picks the adapter
    gemini.ts     ← the ONLY file that knows Gemini's wire format
    proxy.ts      ← backend-proxy adapter
    schema.ts     ← structured-output JSON Schema + its TypeScript mirror
    prompt.ts     ← all prompt text
    normalize.ts  ← raw model JSON → validated domain model
    config.ts     ← key resolution, model, limits
    errors.ts     ← typed error taxonomy
  import/
    fileValidation.ts     documentSource.ts      sectionCatalog.ts
    entryMapper.ts        resumeAssembler.ts     duplicateDetection.ts
```

Swapping to OpenAI or Claude means adding one file that implements the `AIProvider` interface and
registering it in `provider.ts`. No component, hook, or store code changes.

### Moving the key to a backend

Anything prefixed with `VITE_` is embedded in the client bundle and is therefore **public in a
deployed build**. For a shared deployment, run the AI call server-side:

1. Deploy an endpoint (Vercel Function, Cloudflare Worker, …) that accepts
   `{ payload, systemInstruction, userPrompt, responseSchema }`, forwards it to your provider with a
   server-side key, and returns `{ data }`.
2. Set `VITE_AI_PROXY_URL=/api/parse-resume` and leave `VITE_GEMINI_API_KEY` empty.

`ProxyProvider` is already implemented, so this requires no application code changes.

### Verifying imports

Two suites, split by what they can guarantee.

```bash
npm run test:mapping                                        # offline, no key, deterministic
GEMINI_API_KEY=... npm run test:import -- path/to/resume.pdf # live, hits the real API
```

`test:mapping` feeds hand-written model responses through normalize + assemble and asserts exact
output — date and proficiency coercion, bullet formatting, heading preservation, and the rules that
stop a section's heading being restated inside its own items. Model output varies between runs, so
these lock in the behaviour live tests cannot.

`test:import` runs a real PDF or `.docx` through the shipped pipeline modules and asserts the
structural invariants the builder depends on: the document reaches the model as original bytes (PDF)
or structured markup (DOCX), item shapes match each section type's renderer field-for-field, section
and item ids are unique, every heading survives assembly, document order holds, duplicate detection
fires on a re-import and stays quiet on an unrelated resume, and ATS analysis produces a score. Skips
cleanly with no key or no fixture.

### A note on model ids

Google retires model ids for newly issued API keys — `gemini-2.5-flash` already returns 404
("no longer available to new users") on recent keys, even though it still appears in `models.list`.
The default is therefore the rolling `gemini-flash-latest` alias. Pin a version via
`VITE_GEMINI_MODEL` only when you need reproducibility, and expect to revisit it.

## Build & Deploy (Static Site)

```
npm run build      # outputs a static site to ./dist
npm run preview    # preview the production build locally
npm run lint       # typecheck
```

The contents of `dist/` form a fully static website and can be hosted on any static host (GitHub
Pages, Netlify, Vercel, S3, etc.). No server runtime is required.

## Privacy

Your resumes are stored exclusively in your browser's local storage and are never uploaded.

The single exception is Resume Import: the document you upload is sent to the configured AI provider
(Google Gemini by default) to be analyzed, and the structured result is stored locally. The import
dialog states this before you choose a file. If you would rather not send documents to a third
party, simply do not use the import feature — every other part of the app works offline.
