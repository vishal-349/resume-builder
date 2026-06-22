/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Fully client-side writing checker — no AI, no network. Detects common
 * misspellings, capitalization, spacing, repeated-word and punctuation issues,
 * suggests per-word fixes, and produces a fully-corrected version of the text.
 *
 * Spelling uses a curated common-misspellings map (not a full dictionary) so it
 * never flags valid technical terms (Selenium, Cypress, JMeter, …) as errors.
 */

export type IssueType = 'spelling' | 'capitalization' | 'spacing' | 'repeat' | 'punctuation' | 'grammar' | 'style';

export interface WritingIssue {
  type: IssueType;
  message: string;
  bad: string;        // the offending text
  suggestion: string; // suggested replacement for `bad`
  index: number;      // start offset in the original text
  length: number;
}

export interface WritingReport {
  issues: WritingIssue[];
  corrected: string;  // text with every fix applied
}

/* Curated common misspellings → correct form (lowercase keys). Conservative on
 * purpose: only unambiguous, high-frequency typos. */
export const MISSPELLINGS: Record<string, string> = {
  teh: 'the', recieve: 'receive', recieved: 'received', acheive: 'achieve', acheived: 'achieved',
  achievment: 'achievement', achievments: 'achievements', seperate: 'separate', seperated: 'separated',
  definately: 'definitely', occured: 'occurred', occuring: 'occurring', occurence: 'occurrence',
  experiance: 'experience', enviroment: 'environment', enviroments: 'environments',
  developement: 'development', developped: 'developed', responsibilites: 'responsibilities',
  responsibilty: 'responsibility', responsiblities: 'responsibilities', managment: 'management',
  maintainance: 'maintenance', maintenence: 'maintenance', sucessful: 'successful', succesful: 'successful',
  sucessfully: 'successfully', succesfully: 'successfully', accross: 'across', adress: 'address',
  agressive: 'aggressive', apparant: 'apparent', begining: 'beginning', beleive: 'believe',
  buisness: 'business', calender: 'calendar', collaboraton: 'collaboration', comming: 'coming',
  commited: 'committed', committment: 'commitment', completly: 'completely', concious: 'conscious',
  consistant: 'consistent', controll: 'control', dependant: 'dependent', desicion: 'decision',
  dissapoint: 'disappoint', efficency: 'efficiency', embaras: 'embarrass', existance: 'existence',
  familar: 'familiar', flexability: 'flexibility', goverment: 'government', gaurd: 'guard',
  garantee: 'guarantee', happend: 'happened', harrass: 'harass', immediatly: 'immediately',
  independant: 'independent', knowlege: 'knowledge', liason: 'liaison', lenght: 'length',
  libary: 'library', maintaing: 'maintaining', neccessary: 'necessary', necesary: 'necessary',
  noticable: 'noticeable', occassion: 'occasion', oppurtunity: 'opportunity', oportunity: 'opportunity',
  perfomance: 'performance', performace: 'performance', persistant: 'persistent', posession: 'possession',
  preffered: 'preferred', prefered: 'preferred', priviledge: 'privilege', proffesional: 'professional',
  profesional: 'professional', programme: 'program', recomend: 'recommend', recommendaton: 'recommendation',
  refered: 'referred', relevent: 'relevant', reponsible: 'responsible', resposible: 'responsible',
  succesfull: 'successful', tommorow: 'tomorrow', truely: 'truly', untill: 'until', usefull: 'useful',
  wich: 'which', writeing: 'writing', analyse: 'analyze', optimisation: 'optimization',
  utilise: 'utilize', utilised: 'utilized', behaviour: 'behavior', catalogue: 'catalog',
  optimze: 'optimize', optimzed: 'optimized', optmize: 'optimize', mantain: 'maintain',
  thier: 'their', wnat: 'want', thru: 'through', alot: 'a lot', cant: "can't", dont: "don't",
  doesnt: "doesn't", wont: "won't", isnt: "isn't", wasnt: "wasn't", couldnt: "couldn't",
  shouldnt: "shouldn't", wouldnt: "wouldn't", didnt: "didn't", ive: "I've", im: "I'm",
};

/** Common abbreviations whose trailing period is NOT a sentence end. Tested against
 *  the text ending at the candidate period. */
const ABBR_RE = /(?:^|[\s(])(?:e\.?g|i\.?e|etc|vs|viz|cf|al|approx|dept|fig|vol|no|min|max|sec|hrs|mr|mrs|ms|dr|prof|jr|sr|st|inc|ltd|co|corp|u\.?s|a\.?m|p\.?m|ph\.?d|b\.?tech|m\.?tech)\.$/i;

/** Re-apply the casing of `original` (UPPER / Title / lower) to `replacement`. */
function matchCase(original: string, replacement: string): string {
  if (original === original.toUpperCase() && original !== original.toLowerCase()) return replacement.toUpperCase();
  if (original[0] === original[0]?.toUpperCase()) return replacement[0].toUpperCase() + replacement.slice(1);
  return replacement;
}

/**
 * Offline fallback writing check (curated common-misspellings + heuristics). The
 * primary checker is the online LanguageTool service (see tools/languageTool); this
 * runs only when that's unreachable, so it stays conservative to avoid false flags.
 */
export function checkWriting(input: string): WritingReport {
  const text = input || '';
  const issues: WritingIssue[] = [];

  // 1. Misspellings (curated common-typo list; casing preserved) + lone "i".
  const wordRe = /[A-Za-z][A-Za-z']*/g;
  let m: RegExpExecArray | null;
  while ((m = wordRe.exec(text)) !== null) {
    const word = m[0];
    const lower = word.toLowerCase();
    if (MISSPELLINGS[lower]) {
      issues.push({ type: 'spelling', message: `Possible misspelling of "${MISSPELLINGS[lower]}"`, bad: word, suggestion: matchCase(word, MISSPELLINGS[lower]), index: m.index, length: word.length });
    } else if (word === 'i') {
      issues.push({ type: 'capitalization', message: 'The pronoun "I" should be capitalized', bad: 'i', suggestion: 'I', index: m.index, length: 1 });
    }
  }

  // 2. Repeated words ("the the").
  const repRe = /\b(\w+)(\s+)(\1)\b/gi;
  while ((m = repRe.exec(text)) !== null) {
    issues.push({ type: 'repeat', message: `Repeated word "${m[1]}"`, bad: m[0], suggestion: m[1], index: m.index, length: m[0].length });
  }

  // 3. Double spaces.
  const dblRe = / {2,}/g;
  while ((m = dblRe.exec(text)) !== null) {
    issues.push({ type: 'spacing', message: 'Multiple spaces', bad: m[0], suggestion: ' ', index: m.index, length: m[0].length });
  }

  // 4. Space before punctuation.
  const spbRe = /\s+([,.;:!?])/g;
  while ((m = spbRe.exec(text)) !== null) {
    issues.push({ type: 'spacing', message: 'Space before punctuation', bad: m[0], suggestion: m[1], index: m.index, length: m[0].length });
  }

  // 5. Missing space after a comma/semicolon (skip numbers like 1,000).
  const msaRe = /([,;])([A-Za-z])/g;
  while ((m = msaRe.exec(text)) !== null) {
    issues.push({ type: 'spacing', message: 'Missing space after punctuation', bad: m[0], suggestion: `${m[1]} ${m[2]}`, index: m.index, length: m[0].length });
  }

  // 6. Repeated terminal punctuation ("!!", "??").
  const multRe = /([!?])\1{1,}/g;
  while ((m = multRe.exec(text)) !== null) {
    issues.push({ type: 'punctuation', message: 'Repeated punctuation', bad: m[0], suggestion: m[1], index: m.index, length: m[0].length });
  }

  // 7. Sentence-start capitalization (skip after common abbreviations like "e.g.").
  // Start of the text.
  const startM = text.match(/^(\s*)([a-z])/);
  if (startM) {
    issues.push({ type: 'capitalization', message: 'Sentence should start with a capital letter', bad: startM[2], suggestion: startM[2].toUpperCase(), index: startM[1].length, length: 1 });
  }
  // After a sentence-ending punctuation mark.
  const sentRe = /([.!?])(\s+)([a-z])/g;
  while ((m = sentRe.exec(text)) !== null) {
    const ctx = text.slice(Math.max(0, m.index - 9), m.index + 1);
    if (ABBR_RE.test(ctx)) continue; // "e.g.", "i.e.", "etc." … aren't sentence ends
    const at = m.index + 1 + m[2].length;
    issues.push({ type: 'capitalization', message: 'Sentence should start with a capital letter', bad: m[3], suggestion: m[3].toUpperCase(), index: at, length: 1 });
  }

  issues.sort((a, b) => a.index - b.index || b.length - a.length);
  // Drop a later issue that starts inside an already-reported range (e.g. the
  // sentence-start check and the standalone-"i" check flagging the same letter).
  const deduped: WritingIssue[] = [];
  let end = -1;
  for (const iss of issues) {
    if (iss.index < end) continue;
    deduped.push(iss);
    end = iss.index + iss.length;
  }
  issues.length = 0;
  issues.push(...deduped);

  // ----- Build the fully-corrected text (order matters) -----
  let corrected = text
    .replace(wordRe, (w) => {
      const lw = w.toLowerCase();
      return MISSPELLINGS[lw] ? matchCase(w, MISSPELLINGS[lw]) : w;
    })
    .replace(/\bi\b/g, 'I')
    .replace(/\b(\w+)(\s+)(\1)\b/gi, '$1')
    .replace(/([!?])\1{1,}/g, '$1')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/([,;])([A-Za-z])/g, '$1 $2')
    .replace(/ {2,}/g, ' ')
    .replace(/^(\s*)([a-z])/, (_f, sp, ch) => sp + ch.toUpperCase())
    .replace(/([.!?])(\s+)([a-z])/g, (full, p, sp, ch, off, str) =>
      ABBR_RE.test(str.slice(Math.max(0, off - 9), off + 1)) ? full : p + sp + ch.toUpperCase());

  return { issues, corrected };
}
