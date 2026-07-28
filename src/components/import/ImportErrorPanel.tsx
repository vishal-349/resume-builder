/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Failure presentation. Every error carries a typed code, so each one gets a
 * specific recovery action instead of a generic "something went wrong".
 */

import React, { useState } from 'react';
import { AlertTriangle, ChevronDown, FileWarning, KeyRound, RefreshCw, WifiOff } from 'lucide-react';
import type { ImportError, ImportErrorCode } from '../../services/import';

interface Props {
  error: ImportError;
  canRetry: boolean;
  onRetry: () => void;
  onDismiss: () => void;
  /** Shown for key-related failures so the user can fix it without leaving. */
  onOpenKeySettings?: () => void;
}

/** Per-code presentation: icon, tone, and the concrete next step to suggest. */
const PRESENTATION: Partial<Record<ImportErrorCode, { icon: typeof AlertTriangle; hint: string }>> = {
  LEGACY_DOC: {
    icon: FileWarning,
    hint: 'In Word: File → Save As → Word Document (.docx), or File → Export → PDF. Google Docs: File → Download → PDF.',
  },
  UNSUPPORTED_FORMAT: { icon: FileWarning, hint: 'Only PDF and .docx files can be imported.' },
  FILE_TOO_LARGE: { icon: FileWarning, hint: 'Compressing images or exporting a print-quality PDF usually gets well under the limit.' },
  UNREADABLE_DOCUMENT: { icon: FileWarning, hint: 'A text-based PDF works best. Image-only PDFs can still be read visually — Word files cannot.' },
  MISSING_API_KEY: { icon: KeyRound, hint: 'Add a Gemini API key to enable AI-powered import.' },
  INVALID_API_KEY: { icon: KeyRound, hint: 'Double-check the key, or generate a new one at aistudio.google.com/apikey.' },
  NETWORK_ERROR: { icon: WifiOff, hint: 'The import needs an internet connection to reach the AI service.' },
  RATE_LIMITED: { icon: RefreshCw, hint: 'The free tier limits how many requests run per minute.' },
  QUOTA_EXCEEDED: { icon: KeyRound, hint: 'Daily free-tier quota resets every 24 hours.' },
  TIMEOUT: { icon: RefreshCw, hint: 'Long or image-heavy resumes take more time — a retry often succeeds.' },
};

const KEY_ERRORS: ReadonlySet<ImportErrorCode> = new Set<ImportErrorCode>([
  'MISSING_API_KEY',
  'INVALID_API_KEY',
  'QUOTA_EXCEEDED',
]);

export default function ImportErrorPanel({ error, canRetry, onRetry, onDismiss, onOpenKeySettings }: Props) {
  const [showDetail, setShowDetail] = useState(false);
  const presentation = PRESENTATION[error.code];
  const Icon = presentation?.icon || AlertTriangle;
  const showKeyAction = KEY_ERRORS.has(error.code) && !!onOpenKeySettings;

  return (
    <div className="py-4 space-y-4 animate-fade-in">
      <div className="flex gap-3 p-4 bg-red-50/70 border border-red-100 rounded-xl">
        <div className="w-9 h-9 shrink-0 rounded-full bg-red-100 flex items-center justify-center text-red-600">
          <Icon size={17} />
        </div>
        <div className="space-y-1.5 min-w-0">
          <h4 className="text-xs font-bold text-slate-900">Import failed</h4>
          <p className="text-[11px] text-slate-700 leading-relaxed">{error.message}</p>
          {presentation?.hint && (
            <p className="text-[10px] text-slate-500 leading-relaxed border-l-2 border-red-200 pl-2">
              {presentation.hint}
            </p>
          )}
          {error.retryAfterSeconds ? (
            <p className="text-[10px] font-bold text-red-600">
              Try again in about {error.retryAfterSeconds}s.
            </p>
          ) : null}
        </div>
      </div>

      {error.detail && (
        <div className="space-y-1.5">
          <button
            type="button"
            onClick={() => setShowDetail(!showDetail)}
            className="flex items-center gap-1 text-[9.5px] font-bold text-slate-400 hover:text-slate-600 uppercase tracking-wide cursor-pointer transition-colors"
          >
            <ChevronDown size={11} className={`transition-transform ${showDetail ? 'rotate-180' : ''}`} />
            Technical detail
          </button>
          {showDetail && (
            <pre className="text-[9px] font-mono text-slate-500 bg-slate-50 border border-slate-100 rounded-lg p-2.5 overflow-x-auto whitespace-pre-wrap break-words max-h-32">
              {error.code}: {error.detail}
            </pre>
          )}
        </div>
      )}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onDismiss}
          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xxs font-bold cursor-pointer transition-colors"
        >
          Choose another file
        </button>
        {showKeyAction && (
          <button
            type="button"
            onClick={onOpenKeySettings}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xxs font-bold cursor-pointer flex items-center gap-1.5 transition-colors"
          >
            <KeyRound size={12} /> Update API key
          </button>
        )}
        {canRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="px-4 py-2 bg-sunset hover:opacity-90 text-white rounded-lg text-xxs font-bold cursor-pointer flex items-center gap-1.5 transition-opacity"
          >
            <RefreshCw size={12} /> Try again
          </button>
        )}
      </div>
    </div>
  );
}
