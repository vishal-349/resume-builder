# Resume Builder

A premium, **100% client-side** resume builder. No backend, no accounts, no AI services — everything runs in your browser and your data never leaves your device.

## Features

- 25 customizable templates with a live WYSIWYG A4 preview and automatic multi-page pagination
- Local-first storage: all resumes, settings, and customizations are saved in browser `localStorage`
- Import existing resumes from **PDF / DOCX / TXT** using a fully offline, deterministic parser
- Heuristic ATS scoring and suggestions
- Rich inline editing (bold, italic, underline, lists, alignment, fonts, colors)
- Export to **PDF (print)**, **MS Word (.docx)**, and **plain text (.txt)**
- JSON backup / restore of your entire local database
- Full font-family selection and theming
- Works completely offline after the first load

## Run Locally

**Prerequisites:** Node.js 18+

1. Install dependencies:
   ```
   npm install
   ```
2. Start the dev server:
   ```
   npm run dev
   ```

## Build & Deploy (Static Site)

```
npm run build      # outputs a static site to ./dist
npm run preview    # preview the production build locally
```

The contents of `dist/` form a fully static website and can be hosted on any static
host (GitHub Pages, Netlify, Vercel, S3, etc.). No server runtime is required.

## Privacy

All resume data is stored exclusively in your browser's local storage. Nothing is
transmitted to any external service.
