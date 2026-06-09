/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Central font-family registry.
 *
 * `ResumeStyles.fontFamily` may hold either a real font name (e.g. "Times New Roman")
 * chosen from the dropdown, or one of the legacy design tokens ("sans" | "serif" |
 * "mono" | "space" | "outfit") used by the template presets. Everything funnels
 * through `resolveFontStack` / `resolveDocxFont` so the preview, print, and DOCX
 * export all stay in sync.
 */

export type FontCategory = 'sans' | 'serif' | 'mono';

export interface FontOption {
  /** Stored value in ResumeStyles.fontFamily and what the dropdown selects. */
  value: string;
  /** Human label shown in the dropdown. */
  label: string;
  /** Generic family used for CSS fallback and DOCX mapping. */
  category: FontCategory;
}

const GENERIC_STACK: Record<FontCategory, string> = {
  sans: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif',
  serif: 'Cambria, Georgia, "Times New Roman", Times, serif',
  mono: 'ui-monospace, SFMono-Regular, "JetBrains Mono", Menlo, Consolas, monospace',
};

/** Full, web-safe + bundled-design font list shown in the Typography dropdown. */
export const FONT_OPTIONS: FontOption[] = [
  // Common system / web-safe fonts requested for the dropdown
  { value: 'Arial', label: 'Arial', category: 'sans' },
  { value: 'Helvetica', label: 'Helvetica', category: 'sans' },
  { value: 'Calibri', label: 'Calibri', category: 'sans' },
  { value: 'Segoe UI', label: 'Segoe UI', category: 'sans' },
  { value: 'Verdana', label: 'Verdana', category: 'sans' },
  { value: 'Tahoma', label: 'Tahoma', category: 'sans' },
  { value: 'Trebuchet MS', label: 'Trebuchet MS', category: 'sans' },
  { value: 'Times New Roman', label: 'Times New Roman', category: 'serif' },
  { value: 'Georgia', label: 'Georgia', category: 'serif' },
  { value: 'Garamond', label: 'Garamond', category: 'serif' },
  { value: 'Cambria', label: 'Cambria', category: 'serif' },
  { value: 'Palatino', label: 'Palatino', category: 'serif' },
  { value: 'Book Antiqua', label: 'Book Antiqua', category: 'serif' },
  { value: 'Courier New', label: 'Courier New', category: 'mono' },
  // Bundled design fonts (loaded via @import in index.css)
  { value: 'Inter', label: 'Inter (Modern Sans)', category: 'sans' },
  { value: 'Space Grotesk', label: 'Space Grotesk', category: 'sans' },
  { value: 'Outfit', label: 'Outfit', category: 'sans' },
  { value: 'JetBrains Mono', label: 'JetBrains Mono', category: 'mono' },
  { value: 'Playfair Display', label: 'Playfair Display', category: 'serif' },
];

/** Legacy preset tokens mapped to a concrete primary font + its category. */
const LEGACY_TOKENS: Record<string, { primary: string; category: FontCategory }> = {
  sans: { primary: 'Inter', category: 'sans' },
  serif: { primary: 'Georgia', category: 'serif' },
  mono: { primary: 'JetBrains Mono', category: 'mono' },
  space: { primary: 'Space Grotesk', category: 'sans' },
  outfit: { primary: 'Outfit', category: 'sans' },
};

function resolve(value: string | undefined): { primary: string; category: FontCategory } {
  if (!value) return { primary: 'Inter', category: 'sans' };
  if (LEGACY_TOKENS[value]) return LEGACY_TOKENS[value];
  const known = FONT_OPTIONS.find((f) => f.value === value);
  return { primary: value, category: known ? known.category : 'sans' };
}

/** CSS font-family stack for the preview & print output. */
export function resolveFontStack(value: string | undefined): string {
  const { primary, category } = resolve(value);
  const quoted = /\s/.test(primary) ? `"${primary}"` : primary;
  return `${quoted}, ${GENERIC_STACK[category]}`;
}

/** Primary font name to feed the DOCX exporter. */
export function resolveDocxFont(value: string | undefined): string {
  return resolve(value).primary;
}
