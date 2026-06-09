/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Resume, ResumeSection } from '../types';
import { store } from '../store';
import { Eye, EyeOff, ChevronUp, ChevronDown, Trash2, Plus, GripVertical, Settings2, FileCode2, Edit2 } from 'lucide-react';

interface SectionManagerProps {
  resume: Resume;
  onUpdate: () => void;
}

export default function SectionManager({ resume, onUpdate }: SectionManagerProps) {
  const [customName, setCustomName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

  const handleCreateCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (customName.trim().length > 0) {
      store.addCustomSection(customName.trim());
      setCustomName('');
      onUpdate();
    }
  };

  const handleRename = (id: string, name: string) => {
    store.updateSectionHeader(id, name);
    onUpdate();
  };

  const deleteCustomSec = (id: string) => {
    if (confirm("Are you sure you want to delete this section and all of its items? Action cannot be undone.")) {
      store.deleteSection(id);
      onUpdate();
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
    <div className="space-y-4" id="section-manager-panel">
      {/* 1. Creator of custom modules */}
      <form onSubmit={handleCreateCustom} className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex gap-2">
        <input
          type="text"
          placeholder="New custom section (e.g. Hobbies, Patents...)"
          value={customName}
          onChange={(e) => setCustomName(e.target.value)}
          className="flex-1 text-xs px-3 py-2 bg-white border border-slate-205 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500 shadow-xxs"
        />
        <button
          type="submit"
          disabled={customName.trim().length === 0}
          className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 transition-all text-white rounded-lg text-xs font-bold flex items-center gap-1 shrink-0"
        >
          <Plus size={14} />
          Add List
        </button>
      </form>

      {/* 2. List of current ordered sections */}
      <div className="space-y-1.5">
        {resume.sections.map((sec, idx) => {
          const isFirst = idx === 0;
          const isLast = idx === resume.sections.length - 1;
          const isEditing = editingId === sec.id;

          return (
            <div
              key={sec.id}
              className={`p-3 bg-white border rounded-xl flex items-center justify-between gap-3 transition-colors ${
                sec.visible ? 'border-slate-100 hover:border-slate-200' : 'border-slate-100 bg-slate-50/40 opacity-70'
              }`}
            >
              {/* Grip / Reorder markers */}
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <div className="flex flex-col gap-0.5">
                  <button
                    disabled={isFirst}
                    onClick={() => {
                      store.moveSection(idx, 'up');
                      onUpdate();
                    }}
                    className={`p-0.5 text-slate-400 rounded-md hover:bg-slate-50 hover:text-slate-700 disabled:opacity-20`}
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
                    className={`p-0.5 text-slate-400 rounded-md hover:bg-slate-50 hover:text-slate-700 disabled:opacity-20`}
                    title="Move section down"
                  >
                    <ChevronDown size={13} />
                  </button>
                </div>

                {/* Editable Text Section */}
                <div className="flex-1 min-w-0">
                  {isEditing ? (
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="text-xs font-semibold text-slate-800 border-b border-indigo-600 outline-hidden bg-transparent py-0.5"
                        autoFocus
                        onBlur={() => saveRenameInput(sec.id)}
                        onKeyDown={(e) => e.key === 'Enter' && saveRenameInput(sec.id)}
                      />
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-slate-700 truncate select-none leading-none">
                        {sec.name}
                      </span>
                      <button
                        onClick={() => triggerRenameInput(sec)}
                        className="p-0.5 text-slate-400 hover:text-slate-600 rounded bg-slate-50 hover:bg-slate-100 transition-all"
                        title="Edit Heading Name"
                      >
                        <Edit2 size={10} />
                      </button>
                    </div>
                  )}
                  <p className="text-xxxxs uppercase font-mono tracking-wider text-slate-400 mt-1">
                    Index: {idx + 1} • {sec.type}
                  </p>
                </div>
              </div>

              {/* Toggles and status badges */}
              <div className="flex items-center gap-1.5 shrink-0">
                {/* Visibility controller */}
                <button
                  type="button"
                  onClick={() => {
                    store.toggleSectionVisibility(sec.id);
                    onUpdate();
                  }}
                  className={`p-2.5 rounded-lg border transition-all ${
                    sec.visible
                      ? 'text-indigo-600 bg-indigo-50/15 border-indigo-100'
                      : 'text-slate-400 bg-slate-50 border-slate-100'
                  }`}
                  title={sec.visible ? 'Hide section from PDF' : 'Display section on PDF'}
                >
                  {sec.visible ? <Eye size={13} /> : <EyeOff size={13} />}
                </button>

                {/* Custom list deletes */}
                {sec.type === 'custom' && (
                  <button
                    type="button"
                    onClick={() => deleteCustomSec(sec.id)}
                    className="p-2.5 rounded-lg border border-red-100 text-red-500 hover:bg-red-50 hover:text-red-700 transition-all"
                    title="Delete custom section"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
