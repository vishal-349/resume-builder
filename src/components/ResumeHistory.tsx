/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Resume, LanguageCode } from '../types';
import { store } from '../store';
import { PlusCircle, Copy, Trash2, Edit3, Check, X, Calendar, FileText, Globe, AlertCircle, Star } from 'lucide-react';

interface ResumeHistoryProps {
  resumes: Resume[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onUpdate: () => void;
}

export default function ResumeHistory({ resumes, activeId, onSelect, onUpdate }: ResumeHistoryProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tempTitle, setTempTitle] = useState('');
  const [createMsg, setCreateMsg] = useState(false);
  const [selectLang, setSelectLang] = useState<LanguageCode>('en');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  const startRename = (r: Resume) => {
    setEditingId(r.id);
    setTempTitle(r.title);
  };

  const saveRename = (id: string) => {
    if (tempTitle.trim().length > 0) {
      store.renameResume(id, tempTitle.trim());
      setEditingId(null);
      onUpdate();
    }
  };

  const deleteResume = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (resumes.length === 1) {
      setNotification("At least one resume document must remain in the sandbox.");
      setTimeout(() => setNotification(null), 4000);
      return;
    }
    setDeleteConfirmId(id);
  };

  const executeDelete = (id: string) => {
    store.deleteResume(id);
    setDeleteConfirmId(null);
    onUpdate();
  };

  const duplicateResume = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    store.duplicateResume(id);
    onUpdate();
  };

  const togglePerfect = (r: Resume, e: React.MouseEvent) => {
    e.stopPropagation();
    store.setPerfect(r.id, !r.perfect);
    onUpdate();
  };

  const createNewDraft = () => {
    const draftName = `Draft ${resumes.length + 1} (${selectLang.toUpperCase()})`;
    store.createNewResume(draftName, selectLang);
    setCreateMsg(false);
    onUpdate();
  };

  const createDemoDraft = () => {
    store.createDemoResume(selectLang);
    onUpdate();
  };

  return (
    <div className="space-y-4" id="resume-history-panel">
      {notification && (
        <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 text-xxs font-semibold rounded-xl flex items-center gap-2 animate-fade-in shadow-xs">
          <AlertCircle size={14} className="text-amber-600 shrink-0" />
          <span>{notification}</span>
        </div>
      )}
      {/* Upper Create Block */}
      <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-700">Creation Settings</span>
          <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-md px-1.5 py-0.5">
            <Globe size={11} className="text-violet-600" />
            <select
              value={selectLang}
              onChange={(e) => setSelectLang(e.target.value as LanguageCode)}
              className="text-xxxxs font-bold text-slate-800 outline-hidden bg-transparent select-none cursor-pointer"
            >
              <option value="en">English (EN)</option>
              <option value="hi">Hindi (हिंदी)</option>
              <option value="fr">French (FR)</option>
              <option value="de">German (DE)</option>
              <option value="es">Spanish (ES)</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={createNewDraft}
            className="flex items-center justify-center gap-1.5 py-2 px-3 bg-sunset hover:opacity-90 glow-sunset text-white rounded-lg text-xxs font-bold shadow-xs transition-all"
          >
            <PlusCircle size={13} />
            Empty Work
          </button>
          <button
            onClick={createDemoDraft}
            className="flex items-center justify-center gap-1.5 py-2 px-3 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg text-xxs font-bold shadow-xs transition-all"
          >
            <Calendar size={13} className="text-violet-600" />
            Load Demo Resume
          </button>
        </div>
      </div>

      {/* Resumes stack list */}
      <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
        {resumes.map((res) => {
          const isActive = res.id === activeId;
          const isEditing = res.id === editingId;

          return (
            <div
              key={res.id}
              onClick={() => !isEditing && onSelect(res.id)}
              className={`p-3.5 rounded-xl border transition-all relative flex flex-col gap-1.5 cursor-pointer ${
                isActive
                  ? 'border-violet-300 bg-violet-50 ring-2 ring-violet-100 shadow-xxs'
                  : res.perfect
                  ? 'border-amber-200 bg-amber-50/40 hover:border-amber-300'
                  : 'border-slate-100 bg-white hover:border-slate-200 hover:bg-slate-50/50'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  {isEditing ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        value={tempTitle}
                        onChange={(e) => setTempTitle(e.target.value)}
                        className="w-full text-xs font-semibold text-slate-800 border-b border-violet-400 px-1 py-0.5 outline-hidden"
                        onClick={(e) => e.stopPropagation()}
                        autoFocus
                      />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          saveRename(res.id);
                        }}
                        className="p-1 bg-emerald-550 text-emerald-600 hover:bg-emerald-50 rounded"
                      >
                        <Check size={13} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingId(null);
                        }}
                        className="p-1 text-slate-400 hover:bg-slate-150 rounded"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <FileText size={14} className={isActive ? 'text-violet-600' : 'text-slate-400'} />
                      <h4 className="text-xs font-bold text-slate-800 truncate select-none leading-none">
                        {res.title}
                      </h4>
                      <span className="text-xxxxs uppercase font-bold px-1 py-0.5 rounded bg-blue-50 text-blue-500 font-mono">
                        {res.language}
                      </span>
                      {res.perfect && (
                        <span className="text-xxxxs uppercase font-bold px-1 py-0.5 rounded bg-amber-100 text-amber-700 font-mono flex items-center gap-0.5 shrink-0">
                          <Star size={9} className="fill-amber-500 text-amber-500" /> Perfect
                        </span>
                      )}
                    </div>
                  )}
                  
                  <p className="text-xxxxs text-slate-400 mt-1 select-none flex items-center gap-1">
                    <Calendar size={10} />
                    Edited: {new Date(res.updatedAt).toLocaleDateString()} {new Date(res.updatedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  </p>
                </div>

                {/* Operations links */}
                <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
                  {deleteConfirmId === res.id ? (
                    <div className="flex items-center gap-1 bg-red-50 px-2 py-1 rounded-lg border border-red-200 animate-fade-in">
                      <span className="text-[10px] font-bold text-red-650 tracking-wider">Are you sure?</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          executeDelete(res.id);
                        }}
                        className="px-1.5 py-0.5 bg-red-600 text-white rounded text-[10px] font-bold hover:bg-red-700 transition-colors cursor-pointer"
                      >
                        Delete
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteConfirmId(null);
                        }}
                        className="p-0.5 text-slate-400 hover:text-slate-600 cursor-pointer rounded hover:bg-slate-200"
                        title="Cancel"
                      >
                        <X size={11} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-0.5">
                      <button
                        onClick={(e) => togglePerfect(res, e)}
                        title={res.perfect ? 'Unmark as Perfect (master version)' : 'Mark as Perfect (master version)'}
                        className={`p-1 rounded-md transition-all cursor-pointer ${res.perfect ? 'text-amber-500 hover:bg-amber-50' : 'text-slate-400 hover:text-amber-500 hover:bg-amber-50'}`}
                      >
                        <Star size={12} className={res.perfect ? 'fill-amber-400' : ''} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          startRename(res);
                        }}
                        title="Rename"
                        className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-all cursor-pointer"
                      >
                        <Edit3 size={12} />
                      </button>
                      <button
                        onClick={(e) => duplicateResume(res.id, e)}
                        title="Duplicate — make an independent editable copy"
                        className="p-1 text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded-md transition-all cursor-pointer"
                      >
                        <Copy size={12} />
                      </button>
                      <button
                        onClick={(e) => deleteResume(res.id, e)}
                        title="Delete Draft"
                        className="p-1 text-slate-400 hover:text-red-550 hover:bg-red-50 rounded-md transition-all cursor-pointer"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
