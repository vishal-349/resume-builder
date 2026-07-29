/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * The upload dialog: pick a file, watch it parse, or read why it failed.
 *
 * Purely presentational — every decision is made by `useResumeImport`.
 */

import React, { useState } from 'react';
import { FileSpreadsheet, FileText, Info, Sparkles } from 'lucide-react';
import { FILE_INPUT_ACCEPT, getAIBuildInfo, type ImportError, type ImportProgress } from '../../services/import';
import ImportProgressView from './ImportProgress';
import ImportErrorPanel from './ImportErrorPanel';
import ApiKeyGate from './ApiKeyGate';

interface Props {
  isBusy: boolean;
  progress: ImportProgress | null;
  error: ImportError | null;
  canRetry: boolean;
  /** False when no API key / proxy is configured — shows the key gate instead. */
  isConfigured: boolean;
  onSelectFile: (file: File) => void;
  onSubmitText: (text: string) => void;
  onRetry: () => void;
  onDismissError: () => void;
  onKeySaved: () => void;
  onClose: () => void;
}

export default function ImportDialog({
  isBusy,
  progress,
  error,
  canRetry,
  isConfigured,
  onSelectFile,
  onSubmitText,
  onRetry,
  onDismissError,
  onKeySaved,
  onClose,
}: Props) {
  const [dragActive, setDragActive] = useState(false);
  const [showPaste, setShowPaste] = useState(false);
  const [pastedText, setPastedText] = useState('');
  const [showKeyGate, setShowKeyGate] = useState(false);

  const needsKey = !isConfigured || showKeyGate;

  // A proxy build must never ask the visitor for a key — the key lives on the
  // server. If that ever happens it is a bug in the resolution path, not a
  // configuration problem, so say so loudly rather than silently prompting.
  if (needsKey && !showKeyGate) {
    const build = getAIBuildInfo();
    if (build.hasProxyUrl) {
      console.error(
        '[resume-import] Key prompt shown despite a configured proxy — this is a bug. Build config:',
        build
      );
    }
  }

  const handleKeySaved = () => {
    setShowKeyGate(false);
    onKeySaved();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in no-print">
      <div className="bg-white border border-blue-100 rounded-2xl max-w-xl w-full p-6 space-y-4 text-left shadow-2xl relative overflow-hidden animate-float-up max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-start border-b border-slate-100 pb-3">
          <div>
            <span className="text-[10px] font-black text-blue-500 uppercase font-mono tracking-wider flex items-center gap-1.5">
              <Sparkles size={11} /> AI Resume Import
            </span>
            <h3 className="text-sm font-bold text-slate-900 mt-0.5">Upload a PDF or Word file</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isBusy}
            className="p-1 px-2.5 bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-800 rounded-lg text-xs transition-colors cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
        </div>

        {needsKey ? (
          <ApiKeyGate onSaved={handleKeySaved} onCancel={isConfigured ? () => setShowKeyGate(false) : undefined} />
        ) : isBusy ? (
          <ImportProgressView progress={progress} onCancel={onClose} />
        ) : error ? (
          <ImportErrorPanel
            error={error}
            canRetry={canRetry}
            onRetry={onRetry}
            onDismiss={onDismissError}
            onOpenKeySettings={() => setShowKeyGate(true)}
          />
        ) : (
          <div
            className={`space-y-4 font-display rounded-xl transition-all ${
              dragActive ? 'ring-2 ring-violet-400 ring-offset-2' : ''
            }`}
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); if (!dragActive) setDragActive(true); }}
            onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setDragActive(true); }}
            onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setDragActive(false); }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setDragActive(false);
              const file = e.dataTransfer?.files?.[0];
              if (file) onSelectFile(file);
            }}
          >
            <p className="text-[10px] text-slate-500 font-medium leading-relaxed">
              Pick a file below, or <span className="font-bold text-violet-600">drag &amp; drop</span> it anywhere in
              this box. Your resume is read by AI, which understands columns, tables and headings — so the rebuilt
              version keeps your original structure.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* PDF */}
              <label className="relative border border-slate-200 bg-white hover:border-red-400 hover:bg-red-50/40 rounded-xl p-5 text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-3 group shadow-xxs hover:shadow-md">
                <input
                  type="file"
                  accept=".pdf,application/pdf"
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  onClick={(e) => { (e.currentTarget as HTMLInputElement).value = ''; }}
                  onChange={(e) => e.target.files?.[0] && onSelectFile(e.target.files[0])}
                />
                <div className="w-12 h-12 rounded-full bg-red-50 group-hover:bg-red-100 flex items-center justify-center text-red-500 transition-colors">
                  <FileText size={24} />
                </div>
                <div className="space-y-0.5">
                  <h4 className="text-xs font-bold text-slate-800">Upload PDF</h4>
                  <p className="text-[9.5px] text-slate-400 leading-normal max-w-[170px] mx-auto">
                    Best results — the layout is read visually, including scanned pages
                  </p>
                </div>
                <span className="text-[8px] font-bold py-0.5 px-2 bg-red-50 text-red-600 rounded-full font-mono">
                  .pdf
                </span>
              </label>

              {/* DOCX */}
              <label className="relative border border-slate-200 bg-white hover:border-blue-400 hover:bg-blue-50/40 rounded-xl p-5 text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-3 group shadow-xxs hover:shadow-md">
                <input
                  type="file"
                  accept={FILE_INPUT_ACCEPT}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  onClick={(e) => { (e.currentTarget as HTMLInputElement).value = ''; }}
                  onChange={(e) => e.target.files?.[0] && onSelectFile(e.target.files[0])}
                />
                <div className="w-12 h-12 rounded-full bg-blue-50 group-hover:bg-blue-100 flex items-center justify-center text-blue-600 transition-colors">
                  <FileSpreadsheet size={24} />
                </div>
                <div className="space-y-0.5">
                  <h4 className="text-xs font-bold text-slate-800">Upload Word</h4>
                  <p className="text-[9.5px] text-slate-400 leading-normal max-w-[170px] mx-auto">
                    Modern Word documents. Save legacy .doc files as .docx first
                  </p>
                </div>
                <span className="text-[8px] font-bold py-0.5 px-2 bg-blue-50 text-blue-700 rounded-full font-mono">
                  .docx
                </span>
              </label>
            </div>

            {/* Paste fallback */}
            <div className="pt-2 border-t border-slate-100 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[9.5px] font-black text-slate-400 uppercase tracking-wider">Fallback</span>
                <button
                  type="button"
                  onClick={() => setShowPaste(!showPaste)}
                  className="text-xxs font-bold text-violet-600 hover:text-violet-800 cursor-pointer hover:underline"
                >
                  {showPaste ? 'Hide text block' : 'Or paste raw resume text'}
                </button>
              </div>

              {showPaste && (
                <div className="space-y-2 animate-fade-in pt-1">
                  <textarea
                    rows={4}
                    placeholder="Paste the full text of your resume here…"
                    value={pastedText}
                    onChange={(e) => setPastedText(e.target.value)}
                    className="w-full text-xxs px-3 py-2 bg-slate-50 border border-slate-150 rounded-xl focus:border-violet-400 focus:ring-2 focus:ring-violet-200 focus:outline-hidden font-display leading-relaxed text-slate-700"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowPaste(false)}
                      className="px-3 py-1 hover:bg-slate-50 text-slate-500 rounded-lg text-xxs font-bold cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => onSubmitText(pastedText)}
                      disabled={pastedText.trim().length === 0}
                      className="px-4 py-1.5 bg-sunset hover:opacity-90 disabled:opacity-40 text-white rounded-lg text-xxs font-bold transition-all cursor-pointer"
                    >
                      Analyze text
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Privacy disclosure — the document leaves the browser, so say so. */}
            <p className="flex items-start gap-1.5 text-[9.5px] text-slate-400 leading-relaxed pt-1 border-t border-slate-100">
              <Info size={11} className="shrink-0 mt-px" />
              <span>
                Your document is sent to Google's Gemini API to be analyzed, then discarded. The resulting resume is
                stored only in this browser. Everything else in this app stays local.
              </span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
