/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { TemplateDefinition } from './types';

export interface ColorPreset {
  id: string;
  name: string;
  primary: string;
  text: string;
  bg: string;
}

export const COLOR_PRESETS: ColorPreset[] = [
  { id: 'slate', name: 'Slate Gray', primary: '#334155', text: '#1e293b', bg: '#ffffff' },
  { id: 'navy', name: 'Navy Blue', primary: '#1e3a8a', text: '#1f2937', bg: '#ffffff' },
  { id: 'emerald', name: 'Emerald', primary: '#0f766e', text: '#111827', bg: '#ffffff' },
  { id: 'crimson', name: 'Burgundy', primary: '#881337', text: '#1f2937', bg: '#ffffff' },
  { id: 'designer', name: 'Rose Gold', primary: '#9d174d', text: '#374151', bg: '#fdf2f8' },
  { id: 'charcoal', name: 'Solid Black', primary: '#111827', text: '#111827', bg: '#ffffff' },
  { id: 'indigo', name: 'Indigo Core', primary: '#4338ca', text: '#111827', bg: '#ffffff' },
  { id: 'amber', name: 'Amber Glow', primary: '#b45309', text: '#1f2937', bg: '#fffbeb' },
  { id: 'cyber', name: 'Tech Terminal', primary: '#059669', text: '#022c22', bg: '#f0fdf4' },
];

export const TEMPLATE_DEFINITIONS: TemplateDefinition[] = [
  {
    id: 'ats-friendly',
    name: 'ATS Perfect Standard',
    category: 'ATS Friendly',
    description: 'The absolute industry standard. High-legibility single column layout guaranteed to score 100% on automated parsers.',
    thumbnailColor: 'bg-slate-700',
  },
  {
    id: 'functional-two-col',
    name: 'Modern Asymmetrical',
    category: 'Modern',
    description: 'Clean double-column format with an active skills sidebar. Ideal for designers, developers, and product minds.',
    thumbnailColor: 'bg-indigo-600',
  },
  {
    id: 'executive-classic',
    name: 'Executive Boardroom',
    category: 'Executive',
    description: 'Serif headings, centered layout, and rich double borders. Perfect for directors, managers, and corporate officers.',
    thumbnailColor: 'bg-zinc-800',
  },
  {
    id: 'minimalist-pro',
    name: 'Scaffold Minimal',
    category: 'Minimal',
    description: 'Clean spacing, high white-space ratio, and tiny elegant icons. Perfect for modern developers and architects.',
    thumbnailColor: 'bg-stone-500',
  },
  {
    id: 'corporate-navy',
    name: 'Corporate Symmetrical',
    category: 'Corporate',
    description: 'A striking top Navy header band with aligned text grids. Expresses corporate authority, security and structure.',
    thumbnailColor: 'bg-blue-900',
  },
  {
    id: 'elegant-playfair',
    name: 'Chancery Elegant',
    category: 'Elegant',
    description: 'Premium serif typography with gold accent markings. Refined style tailored for luxury, legal, or editorial staff.',
    thumbnailColor: 'bg-rose-950',
  },
  {
    id: 'creative-bento',
    name: 'Creative Bento Catalyst',
    category: 'Creative',
    description: 'Modern boxed structures holding skills and achievements on structural cards. Highly engaging design.',
    thumbnailColor: 'bg-amber-600',
  },
  {
    id: 'developer-terminal',
    name: 'Monospace Developer',
    category: 'Developer',
    description: 'Engineered entirely in raw Courier/JetBrains Mono. Fully formatted terminal styles decorated with discrete syntax tags.',
    thumbnailColor: 'bg-green-800',
  },
  {
    id: 'designer-vintage',
    name: 'Designer Atelier',
    category: 'Designer',
    description: 'Warm cream canvases, wide margins, and refined font spacing. Perfect for creative directors, copywriters, and artists.',
    thumbnailColor: 'bg-teal-700',
  },
  {
    id: 'marketing-impact',
    name: 'Marketing Impact Pulse',
    category: 'Marketing',
    description: 'A strong, action-oriented template prioritizing professional summaries and direct achievements counters.',
    thumbnailColor: 'bg-emerald-700',
  },
  {
    id: 'product-matrix',
    name: 'Product Manager Blueprint',
    category: 'Product Manager',
    description: 'A structural grid featuring core metrics directly below job positions. Highly optimized for PM roles.',
    thumbnailColor: 'bg-rose-700',
  },
  {
    id: 'academic-cv',
    name: 'Academic Curriculum Vitae',
    category: 'Academic',
    description: 'Extended layout built for long lists of publications, honors, research grids, and full academic reference grids.',
    thumbnailColor: 'bg-neutral-600',
  },
  {
    id: 'compact-onepage',
    name: 'Compact Direct Onepage',
    category: 'Compact',
    description: 'Tight margins and 9pt font compatibility. Squeezes multi-year experiences into a clean, unified single sheet.',
    thumbnailColor: 'bg-amber-800',
  },
  {
    id: 'international-visa',
    name: 'International Visa Standard',
    category: 'International',
    description: 'Includes prominent headers for nationalities, visa availability, and languages in line with EU/Swiss standards.',
    thumbnailColor: 'bg-blue-800',
  },
  {
    id: 'fresher-academic',
    name: 'Fresher First Steps',
    category: 'Fresher',
    description: 'Puts Education, Projects, and Certifications at the top to highlight capabilities prior to traditional workspace entries.',
    thumbnailColor: 'bg-teal-800',
  },
  {
    id: 'startup-hybrid',
    name: 'Startup Agile Hybrid',
    category: 'Startup',
    description: 'Friendly round corners, energetic secondary accents, and prominent open-source repositories lists.',
    thumbnailColor: 'bg-orange-600',
  },
  {
    id: 'luxury-regal',
    name: 'Luxury Regal Crimson',
    category: 'Luxury',
    description: 'Deep royal colors combined with wide noble margins, delivering a premium feel for high-end consultant roles.',
    thumbnailColor: 'bg-purple-900',
  },
  {
    id: 'premium-shadow',
    name: 'Premium Canvas Shadow',
    category: 'Premium',
    description: 'Gently floated cards stacked above a subtle grid. A sleek look to stand out in early screening calls.',
    thumbnailColor: 'bg-teal-900',
  },
  {
    id: 'senior-competency',
    name: 'Senior Core Competency',
    category: 'Senior Professional',
    description: 'Starts with a massive 3-column leadership grid. Tailored to align with executive executive structures.',
    thumbnailColor: 'bg-sky-900',
  },
  {
    id: 'business-navy',
    name: 'Business Standard Classic',
    category: 'Business',
    description: 'Corporate symmetrical design focusing on stability, metrics tracker, and clean dividers.',
    thumbnailColor: 'bg-indigo-950',
  },
  {
    id: 'consultant-bento',
    name: 'Consultant Matrix Hub',
    category: 'Consultant',
    description: 'Sleek bento layout ideal for presenting independent contract jobs, client portfolios, and core service offerings.',
    thumbnailColor: 'bg-fuchsia-900',
  },
  {
    id: 'technical-spec',
    name: 'Technical Hardware Spec',
    category: 'Technical',
    description: 'Highly structured grid listing firmware modules, platforms, and programming pipelines in a distinct schema.',
    thumbnailColor: 'bg-emerald-950',
  },
  {
    id: 'engineering-grid',
    name: 'Engineering Systems Grid',
    category: 'Engineering',
    description: 'A solid layout with clean horizontal divider tracks, prioritizing major mechanical or systems achievements.',
    thumbnailColor: 'bg-red-900',
  },
  {
    id: 'management-board',
    name: 'Management Core Tracker',
    category: 'Management',
    description: 'Sleek top manager banner highlighting size of team led and total commercial budgets managed.',
    thumbnailColor: 'bg-yellow-800',
  },
  {
    id: 'cohesive-portfolio',
    name: 'Portfolio Catalyst Page',
    category: 'Corporate',
    description: 'A professional hybrid CV that converts into a gorgeous, fully clickable landing portfolio web page layout.',
    thumbnailColor: 'bg-pink-800',
  },
];
