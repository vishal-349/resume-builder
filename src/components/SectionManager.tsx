/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Resume, ResumeSection, SectionType } from '../types';
import { store } from '../store';
import { Eye, EyeOff, ChevronUp, ChevronDown, Trash2, Plus, Edit2, Check } from 'lucide-react';

interface SectionManagerProps {
  resume: Resume;
  onUpdate: () => void;
}

export default function SectionManager({ resume, onUpdate }: SectionManagerProps) {
  const [customName, setCustomName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const standardSections: { type: SectionType; label: string }[] = [
    { type: 'summary', label: 'Summary' },
    { type: 'experience', label: 'Work Experience' },
    { type: 'education', label: 'Education' },
    { type: 'skills', label: 'Skills' },
    { type: 'projects', label: 'Projects' },
    { type: 'certifications', label: 'Certifications' },
    { type: 'awards', label: 'Awards' },
    { type: 'languages', label: 'Languages' },
    { type: 'volunteer', label: 'Volunteer Experience' },
    { type: 'publications', label: 'Publications' },
    { type: 'references', label: 'References' },
  ];

  // Map of existing types in the active resume
  const existingTypes = resume.sections.map((s) => s.type);

  // Filter types that are not present so users can add them back in a single tap
  const missingSections = standardSections.filter((std) => !existingTypes.includes(std.type));

  const handleAddStandard = (type: SectionType, label: string) => {
    store.addStandardSection(type, label);
    onUpdate();
  };

  const handleCreateCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (customName.trim().length > 0) {
      store.addCustomSection(customName.trim());
      setCustomName('');
      onUpdate();
    }
  };

  const deleteSec = (id: string) => {
    if (deleteConfirmId === id) {
      store.deleteSection(id);
      setDeleteConfirmId(null);
      onUpdate();
    } else {
      setDeleteConfirmId(id);
      // Auto-expire confirmation after 4 seconds
      setTimeout(() => {
        setDeleteConfirmId((prev) => (prev === id ? null : prev));
      }, 4000);
    }
  };

  const triggerRenameInput = (sec: ResumeSection) => {
    setEditingId(sec.id);
    setEditTitle(sec.name);
  };

  const saveRenameInput = (id: string) => {
    if (editTitle.trim().length > 0) {
      store.updateSectionHeader(id, editTitle.trim());
      setEditingId(null);
      onUpdate();
    }
  };

  return (
    <div className="space-y-6" id="section-manager-panel">
      {/* 1. Add Sections Block */}
      <div className="space-y-3 bg-slate-50/50 p-4 rounded-xl border border-slate-100">
        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Add Sections</h4>
        
        {/* Missing Standard Section Suggestions */}
        {missingSections.length > 0 && (
          <div className="space-y-1.5 pb-2">
            <p className="text-[9.5px] text-slate-450 font-medium font-sans">Click to insert a standard section:</p>
            <div className="flex flex-wrap gap-1.5">
              {missingSections.map((sec) => (
                <button
                  key={sec.type}
                  type="button"
                  onClick={() => handleAddStandard(sec.type, sec.label)}
                  className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 bg-white border border-slate-200 hover:border-indigo-650 hover:bg-slate-50 text-slate-600 hover:text-indigo-655 rounded-lg transition-all shadow-xxs cursor-pointer"
                >
                  <Plus size={10} className="text-slate-400" />
                  {sec.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Custom Section Creator Formulary */}
        <form onSubmit={handleCreateCustom} className="flex gap-2 border-t border-slate-200/50 pt-3">
          <input
            type="text"
            placeholder="Or type custom section (Hobbies, Hobbies...)"
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            className="flex-1 text-xs px-3 py-2 bg-white border border-slate-205 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500 shadow-xxs"
          />
          <button
            type="submit"
            disabled={customName.trim().length === 0}
            className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 transition-all text-white rounded-lg text-xs font-bold flex items-center gap-1 shrink-0 cursor-pointer"
          >
            <Plus size={13} />
            Add Custom
          </button>
        </form>
      </div>

      {/* 2. Structured list of active sections */}
      <div className="space-y-2">
        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none pl-1">Structure & Order</h4>
        <div className="space-y-1.5">
          {resume.sections.map((sec, idx) => {
            const isFirst = idx === 0;
            const isLast = idx === resume.sections.length - 1;
            const isEditing = editingId === sec.id;
            const isPersonal = sec.type === 'personal';

            return (
              <div
                key={sec.id}
                className={`p-3 bg-white border rounded-xl flex items-center justify-between gap-3 transition-colors ${
                  sec.visible ? 'border-slate-100 hover:border-slate-200' : 'border-slate-100 bg-slate-50/40 opacity-70'
                }`}
              >
                {/* Reordering controllers */}
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div className="flex flex-col gap-0.5">
                    <button
                      disabled={isFirst}
                      onClick={() => {
                        store.moveSection(idx, 'up');
                        onUpdate();
                      }}
                      className={`p-0.5 text-slate-400 rounded-md hover:bg-slate-50 hover:text-slate-750 disabled:opacity-20 cursor-pointer`}
                      title="Move section up"
                    >
                      <ChevronUp size={13} />
                    </button>
                    <button
                      disabled={isLast}
                      onClick={() => {
                        store.moveSection(idx, 'down');
                        onUpdate();
                      }}
                      className={`p-0.5 text-slate-400 rounded-md hover:bg-slate-50 hover:text-slate-750 disabled:opacity-20 cursor-pointer`}
                      title="Move section down"
                    >
                      <ChevronDown size={13} />
                    </button>
                  </div>

                  {/* Header content and inline renamer */}
                  <div className="flex-1 min-w-0 text-left">
                    {isEditing ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          className="text-xs font-semibold text-slate-800 border-b border-indigo-600 outline-hidden bg-transparent py-0.5 w-full font-sans focus:outline-hidden"
                          autoFocus
                          onBlur={() => saveRenameInput(sec.id)}
                          onKeyDown={(e) => e.key === 'Enter' && saveRenameInput(sec.id)}
                        />
                        <button
                          type="button"
                          onMouseDown={() => saveRenameInput(sec.id)}
                          className="p-1 bg-green-50 text-green-600 rounded"
                        >
                          <Check size={11} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-xs font-bold text-slate-700 truncate select-none leading-none">
                          {sec.name}
                        </span>
                        <button
                          onClick={() => triggerRenameInput(sec)}
                          className="p-0.5 text-slate-400 hover:text-slate-650 rounded bg-slate-50 hover:bg-slate-100 transition-all cursor-pointer"
                          title="Rename header"
                        >
                          <Edit2 size={10} />
                        </button>
                      </div>
                    )}
                    <p className="text-xxxxs uppercase font-mono tracking-wider text-slate-400 mt-1">
                      {isPersonal ? 'Contact Info' : `Section: ${sec.type}`} • {sec.items.length} fields
                    </p>
                  </div>
                </div>

                {/* Function controls */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {/* Toggle PDF Visibility */}
                  {!isPersonal && (
                    <button
                      type="button"
                      onClick={() => {
                        store.toggleSectionVisibility(sec.id);
                        onUpdate();
                      }}
                      className={`p-2 rounded-lg border transition-all cursor-pointer ${
                        sec.visible
                          ? 'text-indigo-600 bg-indigo-50/15 border-indigo-100'
                          : 'text-slate-400 bg-slate-50 border-slate-100'
                      }`}
                      title={sec.visible ? 'Hide section from output' : 'Display section on output'}
                    >
                      {sec.visible ? <Eye size={13} /> : <EyeOff size={13} />}
                    </button>
                  )}

                  {/* Complete Deletion - available for all sections except default contact details */}
                  {!isPersonal && (
                    <button
                      type="button"
                      onClick={() => deleteSec(sec.id)}
                      className={`p-2 rounded-lg border transition-all cursor-pointer ${
                        deleteConfirmId === sec.id
                          ? 'bg-red-650 text-white border-red-750 animate-pulse font-bold'
                          : 'border-red-100 text-red-500 hover:bg-red-50/70 hover:text-red-700'
                      }`}
                      title={deleteConfirmId === sec.id ? 'Click again to confirm complete removal!' : 'Remove entire section'}
                    >
                      {deleteConfirmId === sec.id ? (
                        <span className="text-[9px] font-black uppercase px-0.5">Sure?</span>
                      ) : (
                        <Trash2 size={13} />
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
