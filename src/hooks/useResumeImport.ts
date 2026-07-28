/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * The Resume Import state machine.
 *
 * Owns the whole flow — validate, parse, review, duplicate resolution, commit —
 * so the components stay presentational. It talks to the import service through
 * its public surface only and has no idea which AI provider is behind it.
 *
 *   idle → parsing → review → [duplicate] → done
 *                  ↘ error ↗
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import { analyzeResumeATS } from '../atsChecker';
import { store } from '../store';
import type { ATSFeedback, LanguageCode, Resume } from '../types';
import {
  assembleResume,
  findDuplicate,
  ImportError,
  nextAvailableTitle,
  parseResume,
  parseResumeText,
  toImportError,
  type DuplicateMatch,
  type DuplicateResolution,
  type ImportProgress,
  type ParsedResume,
  type ParsedSection,
} from '../services/import';

export type ImportPhase = 'idle' | 'parsing' | 'review' | 'duplicate' | 'error';

/** What the review screen hands back after the user's edits. */
export interface ReviewedImport {
  resumeName: string;
  /** Section ids to keep, in the final display order. */
  sectionOrder: string[];
  /** Section id → edited heading. */
  headings: Record<string, string>;
}

export interface ImportOutcome {
  resume: Resume;
  ats: ATSFeedback;
  replaced: boolean;
}

interface DuplicatePrompt {
  match: DuplicateMatch;
  /** The assembled resume waiting on the user's decision. */
  pending: Resume;
  templateName: string;
}

export interface UseResumeImport {
  phase: ImportPhase;
  progress: ImportProgress | null;
  parsed: ParsedResume | null;
  error: ImportError | null;
  duplicate: DuplicatePrompt | null;
  outcome: ImportOutcome | null;
  isBusy: boolean;
  /** True when the last failure is worth offering a Retry button for. */
  canRetry: boolean;

  startFile: (file: File) => Promise<void>;
  startText: (text: string) => Promise<void>;
  retry: () => Promise<void>;
  confirm: (reviewed: ReviewedImport) => void;
  resolveDuplicate: (resolution: DuplicateResolution) => void;
  cancel: () => void;
  reset: () => void;
}

export function useResumeImport(language: LanguageCode = 'en'): UseResumeImport {
  const [phase, setPhase] = useState<ImportPhase>('idle');
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [parsed, setParsed] = useState<ParsedResume | null>(null);
  const [error, setError] = useState<ImportError | null>(null);
  const [duplicate, setDuplicate] = useState<DuplicatePrompt | null>(null);
  const [outcome, setOutcome] = useState<ImportOutcome | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  /** The last input, so Retry does not require re-picking the file. */
  const lastInputRef = useRef<{ kind: 'file'; file: File } | { kind: 'text'; text: string } | null>(null);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    lastInputRef.current = null;
    setPhase('idle');
    setProgress(null);
    setParsed(null);
    setError(null);
    setDuplicate(null);
    setOutcome(null);
  }, []);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    reset();
  }, [reset]);

  /** Shared driver for both input kinds. */
  const run = useCallback(async (input: { kind: 'file'; file: File } | { kind: 'text'; text: string }) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    lastInputRef.current = input;

    setPhase('parsing');
    setError(null);
    setParsed(null);
    setOutcome(null);
    setProgress({ stage: 'validating', percent: 0, message: 'Starting…' });

    try {
      const options = { onProgress: setProgress, signal: controller.signal };
      const result =
        input.kind === 'file'
          ? await parseResume(input.file, options)
          : await parseResumeText(input.text, options);

      if (controller.signal.aborted) return;
      setParsed(result);
      setPhase('review');
    } catch (err) {
      if (controller.signal.aborted) return;
      const importError = toImportError(err);
      // A user-initiated cancel is not an error state.
      if (importError.code === 'CANCELLED') {
        reset();
        return;
      }
      setError(importError);
      setPhase('error');
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
    }
  }, [reset]);

  const startFile = useCallback((file: File) => run({ kind: 'file', file }), [run]);
  const startText = useCallback((text: string) => run({ kind: 'text', text }), [run]);

  const retry = useCallback(async () => {
    const last = lastInputRef.current;
    if (last) await run(last);
  }, [run]);

  /**
   * Commit the reviewed import: apply the user's edits, assemble the resume,
   * then either save it or hand off to the duplicate prompt.
   */
  const confirm = useCallback((reviewed: ReviewedImport) => {
    if (!parsed) return;

    const keep = new Set(reviewed.sectionOrder);
    const byId = new Map<string, ParsedSection>(parsed.sections.map((section) => [section.id, section]));

    const edited: ParsedResume = {
      ...parsed,
      resumeName: reviewed.resumeName.trim() || parsed.resumeName,
      // Order comes from the review screen, which may have reordered or removed.
      sections: reviewed.sectionOrder
        .map((id) => byId.get(id))
        .filter((section): section is ParsedSection => !!section && keep.has(section.id))
        .map((section) => ({
          ...section,
          heading: (reviewed.headings[section.id] ?? section.heading).trim() || section.heading,
        })),
    };

    const { resume, templateName } = assembleResume(edited, language);
    const match = findDuplicate(edited, store.getState().resumes);

    if (match) {
      setDuplicate({ match, pending: resume, templateName });
      setPhase('duplicate');
      return;
    }
    commit(resume, templateName, undefined);
  }, [parsed, language]);

  /**
   * Persist a resume, register its captured design as a reusable preset, and
   * run ATS analysis so the score reflects the import immediately.
   */
  const commit = useCallback((resume: Resume, templateName: string, replaceId: string | undefined) => {
    store.addImportedResume(resume, replaceId);

    // Register the captured look as a named preset so it can be reused on other
    // resumes. Deliberately NOT applied — applyCustomTemplate overwrites
    // templateId, which is what drives single- vs two-column rendering.
    try {
      store.saveCurrentAsTemplate(templateName);
    } catch {
      /* preset registration is a convenience, never a reason to fail an import */
    }

    const saved = store.getActiveResume() ?? resume;
    setOutcome({ resume: saved, ats: analyzeResumeATS(saved), replaced: !!replaceId });
    setPhase('idle');
    setParsed(null);
    setDuplicate(null);
    setProgress(null);
  }, []);

  const resolveDuplicate = useCallback((resolution: DuplicateResolution) => {
    if (!duplicate) return;

    if (resolution === 'cancel') {
      // Back to the review screen — the parse is still good, only the save
      // decision was declined.
      setDuplicate(null);
      setPhase('review');
      return;
    }

    if (resolution === 'replace') {
      commit(duplicate.pending, duplicate.templateName, duplicate.match.existing.id);
      return;
    }

    const title = nextAvailableTitle(duplicate.pending.title, store.getState().resumes);
    commit({ ...duplicate.pending, title }, `${title} (Imported Design)`, undefined);
  }, [duplicate, commit]);

  return useMemo(
    () => ({
      phase,
      progress,
      parsed,
      error,
      duplicate,
      outcome,
      isBusy: phase === 'parsing',
      canRetry: !!error?.retryable,
      startFile,
      startText,
      retry,
      confirm,
      resolveDuplicate,
      cancel,
      reset,
    }),
    [phase, progress, parsed, error, duplicate, outcome, startFile, startText, retry, confirm, resolveDuplicate, cancel, reset]
  );
}
