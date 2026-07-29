/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Duplicate-import prompt.
 *
 * Overwriting someone's saved resume is destructive and irreversible from their
 * point of view, so when an import looks like a re-import we always ask. The
 * detected reasons are shown so the choice is informed rather than a guess.
 */

import React from 'react';
import { AlertCircle, Copy, RefreshCw, X } from 'lucide-react';
import type { DuplicateMatch, DuplicateResolution } from '../../services/import';

interface Props {
  match: DuplicateMatch;
  /** Title the new copy would get, previewed on the button. */
  copyTitle: string;
  onResolve: (resolution: DuplicateResolution) => void;
}

const formatDate = (iso: string): string => {
  try {
    return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return '';
  }
};

export default function DuplicateImportDialog({ match, copyTitle, onResolve }: Props) {
  const updated = formatDate(match.existing.updatedAt);

  return (
    <div className="fixed inset-0 z-[60] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in no-print">
      <div className="bg-white border border-blue-100 rounded-2xl max-w-md w-full p-6 space-y-4 text-left shadow-2xl animate-float-up">
        <div className="flex gap-3">
          <div className="w-10 h-10 shrink-0 rounded-full bg-amber-100 flex items-center justify-center text-amber-600">
            <AlertCircle size={19} />
          </div>
          <div className="space-y-1 min-w-0">
            <h3 className="text-sm font-bold text-slate-900">You already have this resume</h3>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              This looks like a re-import of <span className="font-bold text-slate-800">"{match.existing.title}"</span>
              {updated && <span className="text-slate-500"> · last edited {updated}</span>}.
            </p>
          </div>
        </div>

        <div className="bg-slate-50/70 border border-slate-100 rounded-xl p-3 space-y-1">
          <h4 className="text-[9.5px] font-black text-slate-400 uppercase tracking-widest">Why we think so</h4>
          <ul className="space-y-0.5">
            {match.reasons.map((reason, index) => (
              <li key={index} className="text-[10.5px] text-slate-600 flex gap-1.5">
                <span className="text-slate-300">•</span>
                <span>{reason}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-2">
          <button
            type="button"
            onClick={() => onResolve('replace')}
            className="w-full flex items-start gap-3 p-3 bg-white border border-slate-200 hover:border-violet-300 hover:bg-violet-50/40 rounded-xl transition-all cursor-pointer text-left group"
          >
            <RefreshCw size={15} className="text-violet-600 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <div className="text-xs font-bold text-slate-800">Replace the existing resume</div>
              <div className="text-[10px] text-slate-500 leading-relaxed">
                Updates "{match.existing.title}" with the newly imported content. Any edits you made there are
                overwritten — undo still works.
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onResolve('copy')}
            className="w-full flex items-start gap-3 p-3 bg-white border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/40 rounded-xl transition-all cursor-pointer text-left"
          >
            <Copy size={15} className="text-emerald-600 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <div className="text-xs font-bold text-slate-800">Create a new copy</div>
              <div className="text-[10px] text-slate-500 leading-relaxed">
                Keeps both. The new one is saved as "{copyTitle}".
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onResolve('cancel')}
            className="w-full flex items-start gap-3 p-3 bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 rounded-xl transition-all cursor-pointer text-left"
          >
            <X size={15} className="text-slate-400 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <div className="text-xs font-bold text-slate-800">Cancel</div>
              <div className="text-[10px] text-slate-500 leading-relaxed">
                Go back to the review screen without saving anything.
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
