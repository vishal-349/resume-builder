/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Honest staged progress for an in-flight import. Shows which step is running
 * rather than a spinner that implies nothing.
 */

import React from 'react';
import { Check, FileSearch, Loader2, ScanLine, Sparkles, Wand2 } from 'lucide-react';
import type { ImportProgress as Progress, ImportStage } from '../../services/import';

const STAGES: { id: ImportStage; label: string; icon: typeof ScanLine }[] = [
  { id: 'validating', label: 'Checking file', icon: ScanLine },
  { id: 'reading', label: 'Reading document', icon: FileSearch },
  { id: 'analyzing', label: 'AI analysis', icon: Sparkles },
  { id: 'building', label: 'Building resume', icon: Wand2 },
];

interface Props {
  progress: Progress | null;
  onCancel: () => void;
}

export default function ImportProgressView({ progress, onCancel }: Props) {
  const activeIndex = Math.max(0, STAGES.findIndex((stage) => stage.id === progress?.stage));
  const percent = progress?.percent ?? 0;

  return (
    <div className="py-6 space-y-5 animate-fade-in">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="relative w-14 h-14">
          <div className="absolute inset-0 rounded-full border-4 border-blue-100" />
          <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-violet-500 animate-spin" />
          <Sparkles size={18} className="absolute inset-0 m-auto text-violet-500" />
        </div>
        <div className="space-y-1 max-w-sm">
          <p className="text-xs font-black text-slate-800">{progress?.message || 'Working…'}</p>
          <p className="text-[9.5px] text-slate-400 leading-relaxed">
            Reading your document's layout, columns and headings to rebuild it as an editable resume.
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="space-y-2">
        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-violet-500 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${Math.max(4, percent)}%` }}
          />
        </div>

        <div className="grid grid-cols-4 gap-1.5">
          {STAGES.map((stage, index) => {
            const done = index < activeIndex;
            const active = index === activeIndex;
            const Icon = done ? Check : active ? Loader2 : stage.icon;
            return (
              <div
                key={stage.id}
                className={`flex flex-col items-center gap-1.5 p-2 rounded-xl border transition-all ${
                  active
                    ? 'border-violet-200 bg-violet-50/60'
                    : done
                      ? 'border-emerald-100 bg-emerald-50/50'
                      : 'border-slate-100 bg-white'
                }`}
              >
                <Icon
                  size={13}
                  className={`${active ? 'text-violet-600 animate-spin' : done ? 'text-emerald-600' : 'text-slate-300'}`}
                />
                <span
                  className={`text-[8.5px] font-bold text-center leading-tight ${
                    active ? 'text-violet-700' : done ? 'text-emerald-700' : 'text-slate-400'
                  }`}
                >
                  {stage.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex justify-center">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-1.5 text-xxs font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
        >
          Cancel import
        </button>
      </div>
    </div>
  );
}
