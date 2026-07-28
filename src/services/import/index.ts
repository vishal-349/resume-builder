/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Public surface of the Resume Import feature.
 *
 * UI code imports from here and nowhere deeper. In particular it never imports
 * from `services/ai/gemini` — the provider is an implementation detail.
 */

export { parseResume, parseResumeText, type ParseOptions } from '../ai/parser';
export { ImportError, isImportError, toImportError, type ImportErrorCode } from '../ai/errors';
export {
  isAIConfigured,
  hasEnvApiKey,
  getStoredApiKey,
  setStoredApiKey,
  clearStoredApiKey,
  resolveAIConfig,
} from '../ai/config';

export { assembleResume, type AssembleResult } from './resumeAssembler';
export { countSectionItems } from './entryMapper';
export { findDuplicate, nextAvailableTitle, type DuplicateMatch, type DuplicateResolution } from './duplicateDetection';
export { FILE_INPUT_ACCEPT, ACCEPTED_EXTENSIONS } from './fileValidation';
export { DEFAULT_SECTION_NAMES } from './sectionCatalog';

export type {
  ParsedResume,
  ParsedSection,
  ParsedEntry,
  ParsedContact,
  DocumentStyleHints,
  Confidence,
  ImportProgress,
  ImportStage,
  SupportedFormat,
} from './types';
export { LOW_CONFIDENCE_THRESHOLD } from './types';
