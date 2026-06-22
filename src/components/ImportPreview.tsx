/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Smart Import preview screen. Shows what the analyzer detected and lets the user
 * rename / remove sections and rename the resume before committing the import.
 */

import React, { useState } from 'react';
import { ParsedResume } from '../import/analyzeResume';
import { Mail, Phone, MapPin, Linkedin, Github, Link as LinkIcon, Check, Trash2, RotateCcw, FileText } from 'lucide-react';

interface ImportPreviewProps {
  parsed: ParsedResume;
  onConfirm: (finalParsed: ParsedResume) => void;
  onCancel: () => void;
}

interface Row {
  title: string;
  type: string;
  items: any[];
  included: boolean;
  layout?: any;
}

const TYPE_LABEL: Record<string, string> = {
  summary: 'Summary', experience: 'Experience', education: 'Education', skills: 'Skills',
  projects: 'Projects', certifications: 'Certifications', awards: 'Awards', languages: 'Languages',
  volunteer: 'Volunteer', publications: 'Publications', references: 'References', custom: 'Custom',
};

export default function ImportPreview({ parsed, onConfirm, onCancel }: ImportPreviewProps) {
  const [resumeName, setResumeName] = useState(parsed.resumeName);
  const [rows, setRows] = useState<Row[]>(
    parsed.sections.map((s) => ({ title: s.title, type: s.type, items: s.items, included: true, layout: s.layout }))
  );

  const c = parsed.contact;

  const countItems = (type: string) =>
    rows.filter((r) => r.included && r.type === type)
      .reduce((sum, r) => sum + (type === 'skills' ? r.items.length : r.items.length), 0);

  const expCount = countItems('experience');
  const eduCount = countItems('education');
  const skillCount = countItems('skills');
  const includedCount = rows.filter((r) => r.included).length;

  const setTitle = (i: number, title: string) =>
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, title } : r)));
  const toggle = (i: number) =>
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, included: !r.included } : r)));

  const confirm = () => {
    const finalParsed: ParsedResume = {
      resumeName: resumeName.trim() || 'Imported Resume',
      contact: parsed.contact,
      sections: rows.filter((r) => r.included).map((r) => ({ title: r.title.trim() || TYPE_LABEL[r.type], type: r.type as any, items: r.items, layout: r.layout })),
    };
    onConfirm(finalParsed);
  };

  const contactChips: { icon: any; value: string }[] = [
    { icon: Mail, value: c.email },
    { icon: Phone, value: c.phone },
    { icon: MapPin, value: c.location },
    { icon: LinkIcon, value: c.website },
    { icon: Linkedin, value: c.linkedin },
    { icon: Github, value: c.github },
  ].filter((x) => x.value);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in no-print">
      <div className="bg-white border border-blue-100 rounded-2xl max-w-2xl w-full p-6 space-y-4 text-left shadow-2xl relative overflow-hidden animate-float-up max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-start border-b border-slate-100 pb-3 shrink-0">
          <div>
            <span className="text-[10px] font-black text-blue-500 uppercase font-mono tracking-wider">Smart Import · Review</span>
            <h3 className="text-sm font-bold text-slate-900 mt-0.5">Confirm what we detected</h3>
          </div>
          <button onClick={onCancel} className="p-1 px-2.5 bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-800 rounded-lg text-xs transition-colors cursor-pointer">
            Cancel
          </button>
        </div>

        <div className="overflow-y-auto space-y-4 pr-1 flex-1">
          {/* Resume name */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Resume / Template Name</label>
            <input
              type="text"
              value={resumeName}
              onChange={(e) => setResumeName(e.target.value)}
              className="w-full text-sm font-semibold px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-indigo-500 focus:bg-white"
            />
          </div>

          {/* Detected contact */}
          <div className="bg-slate-50/70 border border-slate-100 rounded-xl p-3.5 space-y-2">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Contact Detected</h4>
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-sm font-bold text-slate-800">{c.fullName || '—'}</span>
              {c.jobTitle && <span className="text-xs text-slate-500">· {c.jobTitle}</span>}
            </div>
            {contactChips.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {contactChips.map((chip, i) => (
                  <span key={i} className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-1 bg-white border border-slate-200 rounded-lg text-slate-600 max-w-[220px] truncate">
                    <chip.icon size={11} className="text-slate-400 shrink-0" />
                    <span className="truncate">{chip.value}</span>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-[10px] text-slate-400">No contact fields detected — you can add them after import.</p>
            )}
          </div>

          {/* Counts */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: 'Sections', value: includedCount },
              { label: 'Experience', value: expCount },
              { label: 'Education', value: eduCount },
              { label: 'Skills', value: skillCount },
            ].map((s) => (
              <div key={s.label} className="bg-white border border-slate-100 rounded-xl p-2.5 text-center shadow-xxs">
                <div className="text-lg font-extrabold text-slate-800 leading-none">{s.value}</div>
                <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wide mt-1">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Detected sections */}
          <div className="space-y-2">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Detected Sections — rename or remove</h4>
            <div className="space-y-1.5">
              {rows.map((r, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-2 p-2 rounded-xl border transition-all ${
                    r.included ? 'bg-white border-slate-150' : 'bg-slate-50/60 border-slate-100 opacity-60'
                  }`}
                >
                  <FileText size={14} className="text-slate-300 shrink-0 ml-1" />
                  <input
                    type="text"
                    value={r.title}
                    disabled={!r.included}
                    onChange={(e) => setTitle(i, e.target.value)}
                    className="flex-1 min-w-0 text-xs font-semibold text-slate-800 bg-transparent border-b border-transparent focus:border-indigo-400 outline-hidden py-1 disabled:line-through disabled:text-slate-400"
                  />
                  <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 font-mono shrink-0">
                    {TYPE_LABEL[r.type] || r.type}
                  </span>
                  <span className="text-[9px] text-slate-400 font-mono shrink-0 w-14 text-right">
                    {r.type === 'summary' ? '1 block' : `${r.items.length} item${r.items.length === 1 ? '' : 's'}`}
                  </span>
                  <button
                    onClick={() => toggle(i)}
                    title={r.included ? 'Remove this section' : 'Restore this section'}
                    className={`p-1.5 rounded-lg border transition-all cursor-pointer shrink-0 ${
                      r.included ? 'border-red-100 text-red-500 hover:bg-red-50' : 'border-emerald-100 text-emerald-600 hover:bg-emerald-50'
                    }`}
                  >
                    {r.included ? <Trash2 size={12} /> : <RotateCcw size={12} />}
                  </button>
                </div>
              ))}
              {rows.length === 0 && (
                <p className="text-[11px] text-slate-400 py-4 text-center">No sections detected — the document text will be imported as a summary you can split up.</p>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center pt-3 border-t border-slate-100 shrink-0">
          <span className="text-[10px] text-slate-400">Everything stays fully editable after import.</span>
          <div className="flex gap-2">
            <button onClick={onCancel} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold cursor-pointer">
              Cancel
            </button>
            <button
              onClick={confirm}
              disabled={includedCount === 0}
              className="px-4 py-2 bg-sunset hover:opacity-90 disabled:opacity-40 text-white rounded-lg text-xs font-bold cursor-pointer flex items-center gap-1.5"
            >
              <Check size={14} />
              Create Resume ({includedCount})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
