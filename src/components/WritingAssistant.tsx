/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Writing assistant — scans every prose field in the résumé for spelling,
 * capitalization, spacing, repeated-word and punctuation issues. Highlights the
 * offending text, suggests per-word fixes and a fully-corrected version, and
 * applies them via the store. 100% client-side (see tools/writingCheck).
 */
import React, { useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Resume } from '../types';
import { store } from '../store';
import { checkWriting, WritingIssue } from '../tools/writingCheck';
import { SpellCheck2, X, Check, CheckCheck, Sparkles } from 'lucide-react';

interface Props {
  resume: Resume;
  onClose: () => void;
  onApplied: () => void;
}

interface FieldEntry {
  sectionId: string;
  sectionName: string;
  itemId: string;
  field: string;
  label: string;
  value: string;
  issues: WritingIssue[];
  corrected: string;
}

const FIELD_LABELS: Record<string, string> = {
  summary: 'Summary', name: 'Name', position: 'Job title', company: 'Company', location: 'Location',
  description: 'Description', institution: 'Institution', degree: 'Degree', fieldOfStudy: 'Field of study',
  role: 'Role', title: 'Title', subtitle: 'Subtitle', issuer: 'Issuer', publisher: 'Publisher',
  organization: 'Organization', relationship: 'Relationship',
};
// Non-prose fields that shouldn't be spell-checked.
const SKIP_FIELDS = new Set(['id', 'url', 'date', 'startDate', 'endDate', 'grade', 'level', 'proficiency', 'current', 'contact']);

const ISSUE_COLOR: Record<string, string> = {
  spelling: 'text-rose-600', capitalization: 'text-amber-600', spacing: 'text-sky-600',
  repeat: 'text-fuchsia-600', punctuation: 'text-teal-600',
};

/** Strip rich-text markup the preview editor may have stored, leaving plain prose
 *  (matches the form's plain-text editing model). */
const stripHtml = (v: any): string =>
  String(v ?? '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li)>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

/** Render text with the offending substrings highlighted (non-overlapping). */
function highlight(text: string, issues: WritingIssue[]) {
  const sorted = [...issues].sort((a, b) => a.index - b.index);
  const nodes: React.ReactNode[] = [];
  let cursor = 0;
  sorted.forEach((iss, i) => {
    if (iss.index < cursor) return; // skip overlaps
    if (iss.index > cursor) nodes.push(text.slice(cursor, iss.index));
    nodes.push(
      <mark key={i} className="bg-rose-100 text-rose-700 rounded px-0.5 underline decoration-rose-400 decoration-wavy">
        {text.slice(iss.index, iss.index + iss.length)}
      </mark>
    );
    cursor = iss.index + iss.length;
  });
  if (cursor < text.length) nodes.push(text.slice(cursor));
  return nodes;
}

export default function WritingAssistant({ resume, onClose, onApplied }: Props) {
  const entries = useMemo<FieldEntry[]>(() => {
    const out: FieldEntry[] = [];
    resume.sections.forEach((sec) => {
      if (sec.type === 'personal') return;
      if (sec.type === 'summary') {
        const value = stripHtml(sec.items[0]);
        const r = checkWriting(value);
        if (r.issues.length) out.push({ sectionId: sec.id, sectionName: sec.name, itemId: '', field: 'summary', label: 'Summary', value, issues: r.issues, corrected: r.corrected });
        return;
      }
      sec.items.forEach((it) => {
        if (!it || typeof it !== 'object') return;
        Object.keys(it).forEach((k) => {
          if (SKIP_FIELDS.has(k) || typeof it[k] !== 'string' || !it[k].trim()) return;
          const value = stripHtml(it[k]);
          if (!value) return;
          const r = checkWriting(value);
          if (r.issues.length) out.push({ sectionId: sec.id, sectionName: sec.name, itemId: it.id, field: k, label: FIELD_LABELS[k] || k, value, issues: r.issues, corrected: r.corrected });
        });
      });
    });
    return out;
  }, [resume]);

  const totalIssues = entries.reduce((n, e) => n + e.issues.length, 0);

  const applyOne = (e: FieldEntry) => {
    if (e.field === 'summary') store.updateSectionItem(e.sectionId, '', e.corrected);
    else store.updateSectionItem(e.sectionId, e.itemId, { [e.field]: e.corrected });
    onApplied();
  };

  const applyAll = () => {
    store.applyFieldUpdates(entries.map((e) => ({ sectionId: e.sectionId, itemId: e.itemId, field: e.field, value: e.corrected })));
    onApplied();
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in no-print">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-2xl w-full p-5 shadow-2xl animate-float-up max-h-[88vh] flex flex-col">
        <div className="flex justify-between items-center border-b border-slate-100 pb-3 shrink-0">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <SpellCheck2 size={16} className="text-violet-500" /> Writing Assistant
            {totalIssues > 0 && <span className="text-[10px] bg-rose-50 text-rose-600 font-bold px-2 py-0.5 rounded-full font-mono">{totalIssues} issue{totalIssues === 1 ? '' : 's'}</span>}
          </h3>
          <div className="flex items-center gap-2">
            {entries.length > 0 && (
              <button onClick={applyAll} className="px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-xs font-bold cursor-pointer flex items-center gap-1.5">
                <CheckCheck size={14} /> Fix all ({entries.length})
              </button>
            )}
            <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"><X size={15} /></button>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 pt-3 space-y-3 pr-1">
          {entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center gap-2">
              <Sparkles size={28} className="text-emerald-400" />
              <p className="text-sm font-bold text-slate-700">No writing issues found</p>
              <p className="text-xs text-slate-400">Spelling, capitalization, spacing and punctuation all look good.</p>
            </div>
          ) : entries.map((e, i) => (
            <div key={`${e.sectionId}-${e.itemId}-${e.field}-${i}`} className="border border-slate-150 rounded-xl p-3 space-y-2 bg-slate-50/40">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono">{e.sectionName} · {e.label}</span>
                <button onClick={() => applyOne(e)} className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-[10px] font-bold cursor-pointer flex items-center gap-1 shrink-0">
                  <Check size={11} /> Apply
                </button>
              </div>

              {/* Original with highlighted problems */}
              <p className="text-xs text-slate-700 leading-relaxed bg-white border border-slate-150 rounded-lg p-2">{highlight(e.value, e.issues)}</p>

              {/* Per-word suggestions */}
              <div className="flex flex-wrap gap-1.5">
                {e.issues.map((iss, j) => (
                  <span key={j} className="inline-flex items-center gap-1 text-[10px] bg-white border border-slate-200 rounded-md px-1.5 py-0.5" title={iss.message}>
                    <span className={`font-bold ${ISSUE_COLOR[iss.type] || 'text-slate-600'}`}>{iss.bad.replace(/\s+/g, '␣') || '∅'}</span>
                    <span className="text-slate-300">→</span>
                    <span className="font-bold text-emerald-700">{iss.suggestion.replace(/\s+/g, '␣') || '(removed)'}</span>
                  </span>
                ))}
              </div>

              {/* Fully corrected sentence */}
              <div className="text-xs text-emerald-800 bg-emerald-50/60 border border-emerald-100 rounded-lg p-2 leading-relaxed">
                <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest font-mono block mb-0.5">Suggested</span>
                {e.corrected}
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-slate-100 pt-3 shrink-0 flex justify-between items-center">
          <span className="text-[10px] text-slate-400">Checks run locally — no data leaves your browser.</span>
          <button onClick={onClose} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold cursor-pointer">Done</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
