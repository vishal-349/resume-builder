/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * The review screen — the human checkpoint before anything is saved.
 *
 * AI extraction is very good but not infallible, so the model reports how
 * confident it is per section, and anything below the threshold is surfaced
 * here. The user can rename, reorder, and drop sections before committing.
 */

import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronUp,
  FileText,
  Github,
  Link as LinkIcon,
  Linkedin,
  Mail,
  MapPin,
  Phone,
  RotateCcw,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { countSectionItems, LOW_CONFIDENCE_THRESHOLD, type ParsedResume } from '../../services/import';
import type { ReviewedImport } from '../../hooks/useResumeImport';

interface Props {
  parsed: ParsedResume;
  onConfirm: (reviewed: ReviewedImport) => void;
  onCancel: () => void;
}

interface Row {
  id: string;
  heading: string;
  type: string;
  kind: string;
  itemCount: number;
  confidence: number;
  confidenceNote: string;
  isCustomHeading: boolean;
  included: boolean;
}

const TYPE_LABEL: Record<string, string> = {
  summary: 'Summary', experience: 'Experience', education: 'Education', skills: 'Skills',
  projects: 'Projects', certifications: 'Certifications', awards: 'Awards', languages: 'Languages',
  volunteer: 'Volunteer', publications: 'Publications', references: 'References', custom: 'Custom',
};

const confidencePercent = (score: number) => Math.round(score * 100);

/** Colour band for a confidence score. */
function confidenceTone(score: number): { text: string; bg: string; border: string; label: string } {
  if (score >= 0.85) return { text: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', label: 'High' };
  if (score >= LOW_CONFIDENCE_THRESHOLD) return { text: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200', label: 'Good' };
  if (score >= 0.4) return { text: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', label: 'Check' };
  return { text: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200', label: 'Verify' };
}

export default function ImportReview({ parsed, onConfirm, onCancel }: Props) {
  const [resumeName, setResumeName] = useState(parsed.resumeName);
  const [rows, setRows] = useState<Row[]>(() =>
    parsed.sections.map((section) => ({
      id: section.id,
      heading: section.heading,
      type: section.type,
      kind: section.kind,
      // The number of items this section will actually import, which is not the
      // entry count — one entry can expand into many (a comma-separated skills
      // line). Showing entry counts would understate what the user is getting.
      itemCount: countSectionItems(section),
      confidence: section.confidence.score,
      confidenceNote: section.confidence.note,
      isCustomHeading: section.isCustomHeading,
      included: true,
    }))
  );

  const included = useMemo(() => rows.filter((row) => row.included), [rows]);

  const countByType = (type: string) =>
    included.filter((row) => row.type === type).reduce((sum, row) => sum + row.itemCount, 0);

  const lowConfidence = useMemo(
    () => included.filter((row) => row.confidence < LOW_CONFIDENCE_THRESHOLD),
    [included]
  );

  const overall = confidenceTone(parsed.confidence.score);

  const setHeading = (id: string, heading: string) =>
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, heading } : row)));

  const toggle = (id: string) =>
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, included: !row.included } : row)));

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= rows.length) return;
    setRows((prev) => {
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const confirm = () => {
    onConfirm({
      resumeName,
      sectionOrder: included.map((row) => row.id),
      headings: Object.fromEntries(rows.map((row) => [row.id, row.heading])),
    });
  };

  const contactChips = [
    { icon: Mail, value: parsed.contact.email },
    { icon: Phone, value: parsed.contact.phone },
    { icon: MapPin, value: parsed.contact.location },
    { icon: LinkIcon, value: parsed.contact.website },
    { icon: Linkedin, value: parsed.contact.linkedin },
    { icon: Github, value: parsed.contact.github },
  ].filter((chip) => chip.value);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in no-print">
      <div className="bg-white border border-blue-100 rounded-2xl max-w-2xl w-full p-6 space-y-4 text-left shadow-2xl relative overflow-hidden animate-float-up max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-start border-b border-slate-100 pb-3 shrink-0">
          <div>
            <span className="text-[10px] font-black text-blue-500 uppercase font-mono tracking-wider flex items-center gap-1.5">
              <Sparkles size={11} /> AI Import · Review
            </span>
            <h3 className="text-sm font-bold text-slate-900 mt-0.5">Confirm what we found</h3>
          </div>
          <div className={`px-2.5 py-1 rounded-full border ${overall.bg} ${overall.border} shrink-0`}>
            <span className={`text-[9.5px] font-black uppercase tracking-wide ${overall.text}`}>
              {confidencePercent(parsed.confidence.score)}% confident
            </span>
          </div>
        </div>

        <div className="overflow-y-auto space-y-4 pr-1 flex-1">
          {/* Low-confidence banner */}
          {(lowConfidence.length > 0 || parsed.warnings.length > 0) && (
            <div className="flex gap-2.5 p-3 bg-amber-50/70 border border-amber-200 rounded-xl">
              <AlertTriangle size={15} className="text-amber-600 shrink-0 mt-px" />
              <div className="space-y-1 min-w-0">
                <h4 className="text-[11px] font-bold text-amber-900">Worth double-checking after import</h4>
                {lowConfidence.length > 0 && (
                  <p className="text-[10px] text-amber-800 leading-relaxed">
                    {lowConfidence.length === 1 ? 'One section was' : `${lowConfidence.length} sections were`} harder to
                    read: {lowConfidence.map((row) => `"${row.heading}"`).join(', ')}.
                  </p>
                )}
                {parsed.confidence.note && (
                  <p className="text-[10px] text-amber-800 leading-relaxed">{parsed.confidence.note}</p>
                )}
                {parsed.warnings.map((warning, index) => (
                  <p key={index} className="text-[10px] text-amber-800 leading-relaxed">• {warning}</p>
                ))}
              </div>
            </div>
          )}

          {/* Resume name */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Resume name</label>
            <input
              type="text"
              value={resumeName}
              onChange={(e) => setResumeName(e.target.value)}
              className="w-full text-sm font-semibold px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-violet-300 focus:bg-white"
            />
          </div>

          {/* Contact */}
          <div className="bg-slate-50/70 border border-slate-100 rounded-xl p-3.5 space-y-2">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Contact detected</h4>
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-sm font-bold text-slate-800">{parsed.contact.fullName || '—'}</span>
              {parsed.contact.jobTitle && <span className="text-xs text-slate-500">· {parsed.contact.jobTitle}</span>}
            </div>
            {contactChips.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {contactChips.map((chip, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-1 bg-white border border-slate-200 rounded-lg text-slate-600 max-w-[220px]"
                  >
                    <chip.icon size={11} className="text-slate-400 shrink-0" />
                    <span className="truncate">{chip.value}</span>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-[10px] text-slate-400">No contact details found — you can add them after import.</p>
            )}
          </div>

          {/* Counts */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: 'Sections', value: included.length },
              { label: 'Experience', value: countByType('experience') },
              { label: 'Education', value: countByType('education') },
              { label: 'Skills', value: countByType('skills') },
            ].map((stat) => (
              <div key={stat.label} className="bg-white border border-slate-100 rounded-xl p-2.5 text-center shadow-xxs">
                <div className="text-lg font-extrabold text-slate-800 leading-none">{stat.value}</div>
                <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wide mt-1">{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Sections */}
          <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-2">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Detected sections — rename, reorder or remove
              </h4>
              <span className="text-[9px] text-slate-400 font-mono">document order</span>
            </div>

            <div className="space-y-1.5">
              {rows.map((row, index) => {
                const tone = confidenceTone(row.confidence);
                const isLow = row.confidence < LOW_CONFIDENCE_THRESHOLD;
                return (
                  <div
                    key={row.id}
                    className={`rounded-xl border transition-all ${
                      !row.included
                        ? 'bg-slate-50/60 border-slate-100 opacity-60'
                        : isLow
                          ? 'bg-amber-50/40 border-amber-200'
                          : 'bg-white border-slate-150'
                    }`}
                  >
                    <div className="flex items-center gap-2 p-2">
                      {/* Reorder */}
                      <div className="flex flex-col shrink-0">
                        <button
                          type="button"
                          disabled={index === 0}
                          onClick={() => move(index, -1)}
                          title="Move up"
                          className="p-0.5 text-slate-400 hover:text-violet-600 disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer"
                        >
                          <ChevronUp size={12} />
                        </button>
                        <button
                          type="button"
                          disabled={index === rows.length - 1}
                          onClick={() => move(index, 1)}
                          title="Move down"
                          className="p-0.5 text-slate-400 hover:text-violet-600 disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer"
                        >
                          <ChevronDown size={12} />
                        </button>
                      </div>

                      <FileText size={13} className="text-slate-300 shrink-0" />

                      <input
                        type="text"
                        value={row.heading}
                        disabled={!row.included}
                        onChange={(e) => setHeading(row.id, e.target.value)}
                        className="flex-1 min-w-0 text-xs font-semibold text-slate-800 bg-transparent border-b border-transparent focus:border-violet-400 outline-hidden py-1 disabled:line-through disabled:text-slate-400"
                      />

                      {/* One badge, not two: for a custom-typed section the type
                          label already reads "Custom", so the extra flag is noise. */}
                      <span
                        title={
                          row.isCustomHeading
                            ? 'Kept as an editable custom section under its original heading'
                            : `Renders as a ${TYPE_LABEL[row.type] || row.type} section`
                        }
                        className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full font-mono shrink-0 hidden sm:inline ${
                          row.isCustomHeading ? 'bg-violet-50 text-violet-600' : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {TYPE_LABEL[row.type] || row.type}
                      </span>

                      <span
                        title={`AI confidence: ${confidencePercent(row.confidence)}%`}
                        className={`text-[9px] font-black px-1.5 py-0.5 rounded-full border shrink-0 ${tone.bg} ${tone.text} ${tone.border}`}
                      >
                        {confidencePercent(row.confidence)}%
                      </span>

                      <span className="text-[9px] text-slate-400 font-mono shrink-0 w-12 text-right hidden sm:block">
                        {row.type === 'summary' ? '1 block' : `${row.itemCount} item${row.itemCount === 1 ? '' : 's'}`}
                      </span>

                      <button
                        type="button"
                        onClick={() => toggle(row.id)}
                        title={row.included ? 'Remove this section' : 'Restore this section'}
                        className={`p-1.5 rounded-lg border transition-all cursor-pointer shrink-0 ${
                          row.included
                            ? 'border-red-100 text-red-500 hover:bg-red-50'
                            : 'border-emerald-100 text-emerald-600 hover:bg-emerald-50'
                        }`}
                      >
                        {row.included ? <Trash2 size={12} /> : <RotateCcw size={12} />}
                      </button>
                    </div>

                    {isLow && row.included && row.confidenceNote && (
                      <p className="text-[9.5px] text-amber-800 leading-relaxed px-3 pb-2 pl-11">
                        <AlertTriangle size={9} className="inline mr-1 -mt-0.5" />
                        {row.confidenceNote}
                      </p>
                    )}
                  </div>
                );
              })}

              {rows.length === 0 && (
                <p className="text-[11px] text-slate-400 py-4 text-center">
                  No sections were detected in that document.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center pt-3 border-t border-slate-100 shrink-0 gap-3">
          <span className="text-[10px] text-slate-400 hidden sm:block">
            Everything stays fully editable after import.
          </span>
          <div className="flex gap-2 shrink-0">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirm}
              disabled={included.length === 0}
              className="px-4 py-2 bg-sunset hover:opacity-90 disabled:opacity-40 text-white rounded-lg text-xs font-bold cursor-pointer flex items-center gap-1.5"
            >
              <Check size={14} />
              Create resume ({included.length})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
