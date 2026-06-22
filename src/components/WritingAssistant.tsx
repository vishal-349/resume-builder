/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Writing assistant — checks every prose field for spelling, grammar,
 * capitalization, punctuation and style. Uses the online LanguageTool service
 * (one request per résumé, results mapped back to each field); if that's
 * unreachable it falls back to a local curated check. Highlights problems,
 * suggests per-word fixes and a fully-corrected version, and applies via the store.
 */
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Resume } from '../types';
import { store } from '../store';
import { checkWriting, WritingIssue } from '../tools/writingCheck';
import { checkWithLanguageTool, ltCategoryToType } from '../tools/languageTool';
import { SpellCheck2, X, Check, CheckCheck, Sparkles, Loader2, RefreshCw, WifiOff } from 'lucide-react';

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
const SKIP_FIELDS = new Set(['id', 'url', 'date', 'startDate', 'endDate', 'grade', 'level', 'proficiency', 'current', 'contact']);
const SEP = '\n\n';

const ISSUE_COLOR: Record<string, string> = {
  spelling: 'text-rose-600', capitalization: 'text-amber-600', spacing: 'text-sky-600',
  repeat: 'text-fuchsia-600', punctuation: 'text-teal-600', grammar: 'text-indigo-600', style: 'text-slate-500',
};

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
    if (iss.index < cursor) return;
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

/** Build the corrected text by applying each issue's suggestion (non-overlapping, left→right). */
function buildCorrected(value: string, issues: WritingIssue[]): string {
  const sorted = [...issues].sort((a, b) => a.index - b.index);
  let out = '', cursor = 0;
  for (const iss of sorted) {
    if (iss.index < cursor) continue;
    out += value.slice(cursor, iss.index);
    out += iss.suggestion !== '' ? iss.suggestion : value.slice(iss.index, iss.index + iss.length);
    cursor = iss.index + iss.length;
  }
  return out + value.slice(cursor);
}

interface Segment { sectionId: string; sectionName: string; itemId: string; field: string; label: string; value: string; start: number; }

export default function WritingAssistant({ resume, onClose, onApplied }: Props) {
  const [entries, setEntries] = useState<FieldEntry[]>([]);
  const [status, setStatus] = useState<'checking' | 'done' | 'fallback'>('checking');
  const resumeRef = useRef(resume);
  resumeRef.current = resume;

  const collectSegments = (): { segments: Segment[]; combined: string } => {
    const segments: Segment[] = [];
    let combined = '';
    const add = (sectionId: string, sectionName: string, itemId: string, field: string, label: string, raw: any) => {
      const value = stripHtml(raw);
      if (!value) return;
      segments.push({ sectionId, sectionName, itemId, field, label, value, start: combined.length });
      combined += value + SEP;
    };
    resumeRef.current.sections.forEach((sec) => {
      if (sec.type === 'personal') return;
      if (sec.type === 'summary') { add(sec.id, sec.name, '', 'summary', 'Summary', sec.items[0]); return; }
      sec.items.forEach((it) => {
        if (!it || typeof it !== 'object') return;
        Object.keys(it).forEach((k) => {
          if (SKIP_FIELDS.has(k) || typeof it[k] !== 'string' || !it[k].trim()) return;
          add(sec.id, sec.name, it.id, k, FIELD_LABELS[k] || k, it[k]);
        });
      });
    });
    return { segments, combined };
  };

  const runCheck = async (signal?: AbortSignal) => {
    setStatus('checking');
    const { segments, combined } = collectSegments();
    if (!segments.length) { setEntries([]); setStatus('done'); return; }

    const finalize = (perSeg: Map<Segment, WritingIssue[]>, mode: 'done' | 'fallback') => {
      const out: FieldEntry[] = [];
      for (const seg of segments) {
        const iss = (perSeg.get(seg) || []).sort((a, b) => a.index - b.index);
        if (iss.length) out.push({ sectionId: seg.sectionId, sectionName: seg.sectionName, itemId: seg.itemId, field: seg.field, label: seg.label, value: seg.value, issues: iss, corrected: buildCorrected(seg.value, iss) });
      }
      setEntries(out);
      setStatus(mode);
    };

    try {
      const matches = await checkWithLanguageTool(combined, signal);
      const perSeg = new Map<Segment, WritingIssue[]>();
      for (const mt of matches) {
        const seg = segments.find((s) => mt.offset >= s.start && mt.offset + mt.length <= s.start + s.value.length);
        if (!seg) continue;
        const local = mt.offset - seg.start;
        const bad = seg.value.slice(local, local + mt.length);
        const type = ltCategoryToType(mt);
        // Skip spelling flags on capitalized words — they're almost always proper
        // nouns / brands / tools (Appium, TestNG, CDBE, Glocal) that LanguageTool
        // doesn't know, and "fixing" them corrupts the résumé.
        if (type === 'spelling' && /[A-Z]/.test(bad)) continue;
        const arr = perSeg.get(seg) || [];
        arr.push({
          type,
          message: mt.shortMessage || mt.message,
          bad,
          suggestion: mt.replacements?.[0]?.value ?? '',
          index: local,
          length: mt.length,
        });
        perSeg.set(seg, arr);
      }
      if (!signal?.aborted) finalize(perSeg, 'done');
    } catch {
      // Offline / rate-limited → local curated check.
      const perSeg = new Map<Segment, WritingIssue[]>();
      for (const seg of segments) {
        const r = checkWriting(seg.value);
        if (r.issues.length) perSeg.set(seg, r.issues);
      }
      if (!signal?.aborted) finalize(perSeg, 'fallback');
    }
  };

  useEffect(() => {
    const ac = new AbortController();
    runCheck(ac.signal);
    return () => ac.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalIssues = entries.reduce((n, e) => n + e.issues.length, 0);

  const applyOne = (e: FieldEntry) => {
    if (e.field === 'summary') store.updateSectionItem(e.sectionId, '', e.corrected);
    else store.updateSectionItem(e.sectionId, e.itemId, { [e.field]: e.corrected });
    setEntries((prev) => prev.filter((x) => x !== e));
    onApplied();
  };

  const applyAll = () => {
    store.applyFieldUpdates(entries.map((e) => ({ sectionId: e.sectionId, itemId: e.itemId, field: e.field, value: e.corrected })));
    setEntries([]);
    onApplied();
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in no-print">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-2xl w-full p-5 shadow-2xl animate-float-up max-h-[88vh] flex flex-col">
        <div className="flex justify-between items-center border-b border-slate-100 pb-3 shrink-0">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <SpellCheck2 size={16} className="text-violet-500" /> Writing Assistant
            {status !== 'checking' && totalIssues > 0 && <span className="text-[10px] bg-rose-50 text-rose-600 font-bold px-2 py-0.5 rounded-full font-mono">{totalIssues} issue{totalIssues === 1 ? '' : 's'}</span>}
          </h3>
          <div className="flex items-center gap-2">
            <button onClick={() => runCheck()} disabled={status === 'checking'} className="p-1.5 text-slate-400 hover:text-violet-600 hover:bg-slate-100 rounded-lg cursor-pointer disabled:opacity-40" title="Re-check">
              <RefreshCw size={14} className={status === 'checking' ? 'animate-spin' : ''} />
            </button>
            {status !== 'checking' && entries.length > 0 && (
              <button onClick={applyAll} className="px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-xs font-bold cursor-pointer flex items-center gap-1.5">
                <CheckCheck size={14} /> Fix all ({entries.length})
              </button>
            )}
            <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"><X size={15} /></button>
          </div>
        </div>

        {status === 'fallback' && (
          <div className="mt-3 flex items-center gap-2 text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 shrink-0">
            <WifiOff size={13} /> Couldn't reach the online checker — showing a limited offline check (common typos only).
          </div>
        )}

        <div className="overflow-y-auto flex-1 pt-3 space-y-3 pr-1">
          {status === 'checking' ? (
            <div className="flex flex-col items-center justify-center py-12 text-center gap-2">
              <Loader2 size={26} className="text-violet-400 animate-spin" />
              <p className="text-sm font-bold text-slate-700">Checking grammar &amp; spelling…</p>
              <p className="text-xs text-slate-400">Analyzing your résumé.</p>
            </div>
          ) : entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center gap-2">
              <Sparkles size={28} className="text-emerald-400" />
              <p className="text-sm font-bold text-slate-700">No writing issues found</p>
              <p className="text-xs text-slate-400">Spelling, grammar, capitalization and punctuation all look good.</p>
            </div>
          ) : entries.map((e, i) => (
            <div key={`${e.sectionId}-${e.itemId}-${e.field}-${i}`} className="border border-slate-150 rounded-xl p-3 space-y-2 bg-slate-50/40">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono">{e.sectionName} · {e.label}</span>
                <button onClick={() => applyOne(e)} className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-[10px] font-bold cursor-pointer flex items-center gap-1 shrink-0">
                  <Check size={11} /> Apply
                </button>
              </div>

              <p className="text-xs text-slate-700 leading-relaxed bg-white border border-slate-150 rounded-lg p-2 whitespace-pre-wrap">{highlight(e.value, e.issues)}</p>

              <div className="flex flex-wrap gap-1.5">
                {e.issues.map((iss, j) => (
                  <span key={j} className="inline-flex items-center gap-1 text-[10px] bg-white border border-slate-200 rounded-md px-1.5 py-0.5" title={iss.message}>
                    <span className={`font-bold ${ISSUE_COLOR[iss.type] || 'text-slate-600'}`}>{iss.bad.replace(/\s+/g, '␣') || '∅'}</span>
                    <span className="text-slate-300">→</span>
                    <span className="font-bold text-emerald-700">{iss.suggestion ? iss.suggestion.replace(/\s+/g, '␣') : '(remove)'}</span>
                  </span>
                ))}
              </div>

              <div className="text-xs text-emerald-800 bg-emerald-50/60 border border-emerald-100 rounded-lg p-2 leading-relaxed whitespace-pre-wrap">
                <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest font-mono block mb-0.5">Suggested</span>
                {e.corrected}
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-slate-100 pt-3 shrink-0 flex justify-between items-center gap-2">
          <span className="text-[10px] text-slate-400">
            {status === 'fallback' ? 'Offline mode — limited local check.' : 'Grammar & spelling via LanguageTool — text is sent to api.languagetool.org for analysis.'}
          </span>
          <button onClick={onClose} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold cursor-pointer shrink-0">Done</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
