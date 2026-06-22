/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Online grammar + spell checker via the free LanguageTool public API. Catches
 * spelling, grammar, capitalization, punctuation and style issues with suggested
 * corrections. The résumé text is sent to api.languagetool.org for analysis (the
 * only part of this app that leaves the browser); callers fall back to the local
 * checker (tools/writingCheck) when the request fails or the user is offline.
 */

export interface LTReplacement { value: string }
export interface LTMatch {
  message: string;
  shortMessage?: string;
  offset: number;
  length: number;
  replacements: LTReplacement[];
  rule?: { id: string; issueType?: string; category?: { id: string; name: string } };
}

const ENDPOINT = 'https://api.languagetool.org/v2/check';
const MAX_CHARS = 18000; // anonymous tier caps payload size

/** Run a single LanguageTool check over `text`. Throws on network / HTTP error. */
export async function checkWithLanguageTool(text: string, signal?: AbortSignal): Promise<LTMatch[]> {
  const body = new URLSearchParams({
    text: text.slice(0, MAX_CHARS),
    language: 'en-US',
    level: 'default',
  });
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: body.toString(),
    signal,
  });
  if (!res.ok) throw new Error(`LanguageTool responded ${res.status}`);
  const json = await res.json();
  return Array.isArray(json.matches) ? (json.matches as LTMatch[]) : [];
}

/** Map a LanguageTool rule category to our issue colour buckets. */
export function ltCategoryToType(match: LTMatch): 'spelling' | 'capitalization' | 'punctuation' | 'spacing' | 'grammar' | 'style' {
  const cat = match.rule?.category?.id || '';
  const issue = match.rule?.issueType || '';
  if (cat === 'TYPOS' || issue === 'misspelling') return 'spelling';
  if (cat === 'CASING') return 'capitalization';
  if (cat === 'PUNCTUATION' || cat === 'TYPOGRAPHY') return 'punctuation';
  if (cat === 'GRAMMAR' || issue === 'grammar' || cat === 'CONFUSED_WORDS') return 'grammar';
  if (cat === 'REDUNDANCY' || cat === 'STYLE' || cat === 'MISC' || issue === 'style') return 'style';
  return 'grammar';
}
