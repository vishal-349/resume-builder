/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * The Resume Import feature, as one component.
 *
 * App.tsx mounts this and nothing else — it owns the dialog, review, duplicate
 * prompt and completion notice, and reports the finished import upward. All
 * behaviour lives in `useResumeImport`; this only decides what is on screen.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { isAIConfigured, nextAvailableTitle } from '../../services/import';
import { store } from '../../store';
import type { ATSFeedback, LanguageCode, Resume } from '../../types';
import { useResumeImport } from '../../hooks/useResumeImport';
import ImportDialog from './ImportDialog';
import ImportReview from './ImportReview';
import DuplicateImportDialog from './DuplicateImportDialog';

interface Props {
  open: boolean;
  language: LanguageCode;
  onClose: () => void;
  /** Fired once a resume has been saved, with its freshly computed ATS score. */
  onImported: (result: { resume: Resume; ats: ATSFeedback; replaced: boolean }) => void;
}

export default function ResumeImporter({ open, language, onClose, onImported }: Props) {
  const importer = useResumeImport(language);
  const { outcome, reset } = importer;

  /**
   * Whether AI is configured is DERIVED, never stored.
   *
   * It used to be cached in state and resynced by an effect keyed on `open`.
   * That is a cached derivation, and cached derivations go stale: this component
   * mounts once at app startup and stays mounted, so any config change that did
   * not coincide with the dialog opening left the cached value behind — showing
   * the key prompt on a perfectly configured build, with no way to tell why.
   *
   * Reading it during render costs nothing (a string check plus one
   * localStorage read) and cannot disagree with the real configuration.
   * `keyRevision` exists only to re-run that read after the user saves a key.
   */
  const [keyRevision, setKeyRevision] = useState(0);
  const configured = useMemo(() => isAIConfigured(), [keyRevision, open]);

  // Hand the finished import upward, then clear it so it fires exactly once.
  useEffect(() => {
    if (!outcome) return;
    onImported(outcome);
    reset();
    onClose();
  }, [outcome, onImported, reset, onClose]);

  const close = () => {
    importer.cancel();
    onClose();
  };

  if (!open) return null;

  if (importer.phase === 'duplicate' && importer.duplicate) {
    return (
      <DuplicateImportDialog
        match={importer.duplicate.match}
        copyTitle={nextAvailableTitle(importer.duplicate.pending.title, store.getState().resumes)}
        onResolve={importer.resolveDuplicate}
      />
    );
  }

  if (importer.phase === 'review' && importer.parsed) {
    return <ImportReview parsed={importer.parsed} onConfirm={importer.confirm} onCancel={close} />;
  }

  return (
    <ImportDialog
      isBusy={importer.isBusy}
      progress={importer.progress}
      error={importer.error}
      canRetry={importer.canRetry}
      isConfigured={configured}
      onSelectFile={importer.startFile}
      onSubmitText={importer.startText}
      onRetry={importer.retry}
      onDismissError={importer.reset}
      onKeySaved={() => setKeyRevision((n) => n + 1)}
      onClose={close}
    />
  );
}
