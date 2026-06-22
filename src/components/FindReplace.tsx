/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Find & Replace across resume content. Scope can be the whole résumé or a single
 * section, and optionally a single field within that section. Live match count;
 * applies via the store (one undo step). Never touches the Personal/contact card.
 */
import React, { useMemo, useState } from 'react';
import { Resume } from '../types';
import { store } from '../store';
import { Search, X, Replace, CheckCircle2 } from 'lucide-react';

interface Props {
  resume: Resume;
  onClose: () => void;
  onApplied: () => void;
}

const FIELD_LABELS: Record<string, string> = {
  summary: 'Summary text', name: 'Name / Title', level: 'Level', company: 'Company', position: 'Job title',
  location: 'Location', description: 'Description', institution: 'Institution', degree: 'Degree',
  fieldOfStudy: 'Field of study', grade: 'Grade', role: 'Role', url: 'URL', issuer: 'Issuer',
  title: 'Title', subtitle: 'Subtitle', date: 'Date', proficiency: 'Proficiency', publisher: 'Publisher',
  organization: 'Organization', relationship: 'Relationship', contact: 'Contact',
};

export default function FindReplace({ resume, onClose, onApplied }: Props) {
  const [find, setFind] = useState('');
  const [replace, setReplace] = useState('');
  const [sectionId, setSectionId] = useState<string>('all');
  const [field, setField] = useState<string>('all');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [done, setDone] = useState<number | null>(null);

  // Sections eligible for find/replace (everything except the contact card).
  const sections = resume.sections.filter((s) => s.type !== 'personal');

  // Field options for the chosen section.
  const fieldOptions = useMemo(() => {
    if (sectionId === 'all') return [];
    const sec = sections.find((s) => s.id === sectionId);
    if (!sec) return [];
    if (sec.type === 'summary') return [{ key: 'summary', label: 'Summary text' }];
    const keys = new Set<string>();
    sec.items.forEach((it) => {
      if (it && typeof it === 'object') Object.keys(it).forEach((k) => { if (k !== 'id' && typeof it[k] === 'string') keys.add(k); });
    });
    return Array.from(keys).map((k) => ({ key: k, label: FIELD_LABELS[k] || k }));
  }, [sectionId, sections]);

  // Live match count (read-only mirror of store.findReplace's matching logic).
  const matchCount = useMemo(() => {
    if (!find) return 0;
    const esc = find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    let re: RegExp;
    try { re = new RegExp(wholeWord ? `\\b${esc}\\b` : esc, caseSensitive ? 'g' : 'gi'); } catch { return 0; }
    let count = 0;
    const scan = (v: string) => { const mm = v.match(re); if (mm) count += mm.length; };
    resume.sections.forEach((sec) => {
      if (sec.type === 'personal') return;
      if (sectionId !== 'all' && sec.id !== sectionId) return;
      if (sec.type === 'summary') {
        if (field === 'all' || field === 'summary') sec.items.forEach((it) => typeof it === 'string' && scan(it));
        return;
      }
      sec.items.forEach((it) => {
        if (!it || typeof it !== 'object') return;
        Object.keys(it).forEach((k) => {
          if (k === 'id' || typeof it[k] !== 'string') return;
          if (sectionId !== 'all' && field !== 'all' && k !== field) return;
          scan(it[k]);
        });
      });
    });
    return count;
  }, [find, replace, sectionId, field, caseSensitive, wholeWord, resume]);

  const apply = () => {
    const n = store.findReplace({
      sectionId: sectionId === 'all' ? undefined : sectionId,
      field: sectionId !== 'all' && field !== 'all' ? field : undefined,
      find, replace, caseSensitive, wholeWord,
    });
    setDone(n);
    onApplied();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in no-print">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-5 space-y-4 shadow-2xl animate-float-up">
        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2"><Search size={15} className="text-violet-500" /> Find &amp; Replace</h3>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"><X size={15} /></button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Find</label>
            <input autoFocus value={find} onChange={(e) => { setFind(e.target.value); setDone(null); }} placeholder="e.g. having "
              className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-violet-300 focus:bg-white" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Replace with</label>
            <input value={replace} onChange={(e) => { setReplace(e.target.value); setDone(null); }} placeholder="(leave blank to remove)"
              className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-violet-300 focus:bg-white" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Scope</label>
            <select value={sectionId} onChange={(e) => { setSectionId(e.target.value); setField('all'); setDone(null); }}
              className="w-full text-xs px-2 py-2 bg-white border border-slate-200 rounded-lg cursor-pointer focus:outline-hidden focus:ring-1 focus:ring-violet-300">
              <option value="all">Entire résumé</option>
              {sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Field</label>
            <select value={field} disabled={sectionId === 'all' || fieldOptions.length === 0} onChange={(e) => { setField(e.target.value); setDone(null); }}
              className="w-full text-xs px-2 py-2 bg-white border border-slate-200 rounded-lg cursor-pointer focus:outline-hidden focus:ring-1 focus:ring-violet-300 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed">
              <option value="all">All fields</option>
              {fieldOptions.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <label className="flex items-center gap-1.5 text-[11px] text-slate-600 cursor-pointer select-none">
            <input type="checkbox" checked={caseSensitive} onChange={(e) => { setCaseSensitive(e.target.checked); setDone(null); }} className="rounded border-slate-300 text-violet-600 cursor-pointer" /> Match case
          </label>
          <label className="flex items-center gap-1.5 text-[11px] text-slate-600 cursor-pointer select-none">
            <input type="checkbox" checked={wholeWord} onChange={(e) => { setWholeWord(e.target.checked); setDone(null); }} className="rounded border-slate-300 text-violet-600 cursor-pointer" /> Whole word
          </label>
          <span className="ml-auto text-[11px] font-bold text-slate-500 font-mono">{find ? `${matchCount} match${matchCount === 1 ? '' : 'es'}` : ''}</span>
        </div>

        {done !== null && (
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
            <CheckCircle2 size={14} /> Replaced {done} occurrence{done === 1 ? '' : 's'}.
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold cursor-pointer">Close</button>
          <button onClick={apply} disabled={!find || matchCount === 0}
            className="px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-xs font-bold cursor-pointer flex items-center gap-1.5">
            <Replace size={14} /> Replace all{find && matchCount ? ` (${matchCount})` : ''}
          </button>
        </div>
      </div>
    </div>
  );
}
