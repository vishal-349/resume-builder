/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Resume, ResumeSection, SectionType, SectionLayout } from '../types';
import { store } from '../store';
import { Eye, EyeOff, ChevronUp, ChevronDown, Trash2, Plus, Edit2, Check, X, GripVertical, Sliders, AlignLeft, AlignCenter, AlignRight, AlignJustify } from 'lucide-react';

interface SectionManagerProps {
  resume: Resume;
  onUpdate: () => void;
}

export default function SectionManager({ resume, onUpdate }: SectionManagerProps) {
  const [customName, setCustomName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Drag & drop reordering state
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  // Which section currently has its "Display options" panel open
  const [optionsOpenId, setOptionsOpenId] = useState<string | null>(null);

  const setLayout = (sectionId: string, patch: Partial<SectionLayout>) => {
    store.updateSectionLayout(sectionId, patch);
    onUpdate();
  };

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

  const executeDelete = (id: string) => {
    store.deleteSection(id);
    setDeleteConfirmId(null);
    onUpdate();
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

  // Persist a new order derived from dragging `sourceId` onto `targetId`.
  const commitReorder = (sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;
    const ids = resume.sections.map((s) => s.id);
    const fromIdx = ids.indexOf(sourceId);
    const toIdx = ids.indexOf(targetId);
    if (fromIdx === -1 || toIdx === -1) return;

    ids.splice(fromIdx, 1);
    // Recompute target index after removal to insert at the visual position.
    const insertIdx = ids.indexOf(targetId);
    ids.splice(insertIdx, 0, sourceId);

    store.reorderSections(ids);
    onUpdate();
  };

  const handleDrop = (targetId: string) => {
    if (draggingId) {
      commitReorder(draggingId, targetId);
    }
    setDraggingId(null);
    setDragOverId(null);
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
                  title={`Add ${sec.label} section`}
                  className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 bg-white border border-slate-200 hover:border-violet-300 hover:bg-slate-50 text-slate-600 hover:text-violet-600 rounded-lg transition-all shadow-xxs cursor-pointer"
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
            placeholder="Or type a custom section (Hobbies, Interests...)"
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            className="flex-1 text-xs px-3 py-2 bg-white border border-slate-205 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-violet-300 shadow-xxs"
          />
          <button
            type="submit"
            disabled={customName.trim().length === 0}
            title="Add a new custom section"
            className="px-3 py-2 bg-sunset hover:opacity-90 glow-sunset disabled:opacity-40 transition-all text-white rounded-lg text-xs font-bold flex items-center gap-1 shrink-0 cursor-pointer"
          >
            <Plus size={13} />
            Add Custom
          </button>
        </form>
      </div>

      {/* 2. Structured list of active sections */}
      <div className="space-y-2">
        <div className="flex items-center justify-between pl-1">
          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Structure & Order</h4>
          <span className="text-[9px] text-slate-400 font-medium font-sans">Drag to reorder</span>
        </div>
        <div className="space-y-1.5">
          {resume.sections.map((sec, idx) => {
            const isFirst = idx === 0;
            const isLast = idx === resume.sections.length - 1;
            const isEditing = editingId === sec.id;
            const isPersonal = sec.type === 'personal';
            const isDragging = draggingId === sec.id;
            const isDragOver = dragOverId === sec.id && draggingId !== sec.id;

            return (
              <div
                key={sec.id}
                draggable={!isEditing}
                onDragStart={(e) => {
                  setDraggingId(sec.id);
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  if (dragOverId !== sec.id) setDragOverId(sec.id);
                }}
                onDragLeave={() => {
                  if (dragOverId === sec.id) setDragOverId(null);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  handleDrop(sec.id);
                }}
                onDragEnd={() => {
                  setDraggingId(null);
                  setDragOverId(null);
                }}
                className={`p-3 bg-white border rounded-xl transition-all ${
                  isDragging ? 'opacity-40' : ''
                } ${
                  isDragOver ? 'border-violet-300 ring-2 ring-violet-200' : sec.visible ? 'border-slate-100 hover:border-slate-200' : 'border-slate-100 bg-slate-50/40 opacity-70'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                {/* Drag handle + reordering controllers */}
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div
                    className="text-slate-300 cursor-grab active:cursor-grabbing shrink-0"
                    title="Drag to reorder section"
                  >
                    <GripVertical size={14} />
                  </div>

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
                          className="text-xs font-semibold text-slate-800 border-b border-violet-400 outline-hidden bg-transparent py-0.5 w-full font-sans focus:outline-hidden"
                          autoFocus
                          onBlur={() => saveRenameInput(sec.id)}
                          onKeyDown={(e) => e.key === 'Enter' && saveRenameInput(sec.id)}
                        />
                        <button
                          type="button"
                          onMouseDown={() => saveRenameInput(sec.id)}
                          className="p-1 bg-green-50 text-green-600 rounded"
                          title="Save section name"
                        >
                          <Check size={11} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-xs font-bold text-slate-700 truncate select-none leading-none" title={sec.name}>
                          {sec.name}
                        </span>
                        <button
                          onClick={() => triggerRenameInput(sec)}
                          className="p-0.5 text-slate-400 hover:text-slate-650 rounded bg-slate-50 hover:bg-slate-100 transition-all cursor-pointer"
                          title="Rename section header"
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
                  {/* Display options toggle */}
                  <button
                    type="button"
                    onClick={() => setOptionsOpenId(optionsOpenId === sec.id ? null : sec.id)}
                    className={`p-2 rounded-lg border transition-all cursor-pointer ${
                      optionsOpenId === sec.id
                        ? 'text-violet-600 bg-violet-50 border-violet-100'
                        : 'text-slate-400 border-slate-100 hover:bg-slate-50 hover:text-slate-600'
                    }`}
                    title="Display options for this section"
                  >
                    <Sliders size={13} />
                  </button>

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
                          ? 'text-violet-600 bg-violet-50 border-violet-100'
                          : 'text-slate-400 bg-slate-50 border-slate-100'
                      }`}
                      title={sec.visible ? 'Hide section from output' : 'Display section on output'}
                    >
                      {sec.visible ? <Eye size={13} /> : <EyeOff size={13} />}
                    </button>
                  )}

                  {/* Complete Deletion - explicit Delete / Cancel confirmation */}
                  {!isPersonal && (
                    deleteConfirmId === sec.id ? (
                      <div className="flex items-center gap-1 bg-red-50 px-2 py-1 rounded-lg border border-red-200 animate-fade-in">
                        <span className="text-[10px] font-bold text-red-650 tracking-wider hidden sm:inline">Sure?</span>
                        <button
                          type="button"
                          onClick={() => executeDelete(sec.id)}
                          className="px-1.5 py-0.5 bg-red-600 text-white rounded text-[10px] font-bold hover:bg-red-700 transition-colors cursor-pointer"
                          title="Confirm deletion"
                        >
                          Delete
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmId(null)}
                          className="px-1.5 py-0.5 text-slate-500 hover:text-slate-700 rounded text-[10px] font-bold hover:bg-slate-200 cursor-pointer"
                          title="Cancel deletion"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setDeleteConfirmId(sec.id)}
                        className="p-2 rounded-lg border border-red-100 text-red-500 hover:bg-red-50/70 hover:text-red-700 transition-all cursor-pointer"
                        title="Remove entire section"
                      >
                        <Trash2 size={13} />
                      </button>
                    )
                  )}
                </div>
                </div>

                {/* Per-section display options panel */}
                {optionsOpenId === sec.id && (
                  <div className="mt-3 pt-3 border-t border-slate-100 space-y-3 animate-fade-in" onDragStart={(e) => e.preventDefault()}>
                    {/* Show / hide section title */}
                    {!isPersonal && (
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Section Title</span>
                        <button
                          type="button"
                          onClick={() => setLayout(sec.id, { showTitle: sec.layout?.showTitle === false })}
                          className={`text-[10px] font-bold px-2 py-1 rounded-md border transition-all cursor-pointer ${
                            sec.layout?.showTitle === false
                              ? 'bg-slate-50 border-slate-200 text-slate-500'
                              : 'bg-violet-50 border-violet-300 text-violet-600'
                          }`}
                        >
                          {sec.layout?.showTitle === false ? 'Hidden' : 'Shown'}
                        </button>
                      </div>
                    )}

                    {/* Content alignment */}
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Content Align</span>
                      <div className="flex items-center gap-1">
                        {([
                          { v: 'left', Icon: AlignLeft },
                          { v: 'center', Icon: AlignCenter },
                          { v: 'right', Icon: AlignRight },
                          { v: 'justify', Icon: AlignJustify },
                        ] as const).map(({ v, Icon }) => {
                          const current = sec.layout?.align || 'left';
                          return (
                            <button
                              key={v}
                              type="button"
                              onClick={() => setLayout(sec.id, { align: v })}
                              className={`p-1.5 rounded-md border transition-all cursor-pointer ${
                                current === v ? 'bg-violet-50 border-violet-300 text-violet-600' : 'border-slate-100 text-slate-400 hover:bg-slate-50'
                              }`}
                              title={`Align ${v}`}
                            >
                              <Icon size={12} />
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Skills display style (skills section only) */}
                    {sec.type === 'skills' && (
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Skills Style</span>
                        <div className="flex items-center gap-1">
                          {(['chips', 'list', 'inline'] as const).map((v) => {
                            const current = sec.layout?.skillStyle || 'chips';
                            return (
                              <button
                                key={v}
                                type="button"
                                onClick={() => setLayout(sec.id, { skillStyle: v })}
                                className={`text-[10px] font-bold px-2 py-1 rounded-md border capitalize transition-all cursor-pointer ${
                                  current === v ? 'bg-violet-50 border-violet-300 text-violet-600' : 'border-slate-100 text-slate-500 hover:bg-slate-50'
                                }`}
                              >
                                {v === 'inline' ? 'Comma' : v === 'list' ? 'Bullets' : 'Chips'}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Columns (chip/list style sections) */}
                    {['skills', 'languages', 'certifications', 'awards', 'references'].includes(sec.type) && (
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Columns</span>
                        <div className="flex items-center gap-1">
                          {([1, 2, 3] as const).map((c) => {
                            const current = sec.layout?.columns || 1;
                            return (
                              <button
                                key={c}
                                type="button"
                                onClick={() => setLayout(sec.id, { columns: c })}
                                className={`text-[10px] font-bold w-7 py-1 rounded-md border transition-all cursor-pointer ${
                                  current === c ? 'bg-violet-50 border-violet-300 text-violet-600' : 'border-slate-100 text-slate-500 hover:bg-slate-50'
                                }`}
                              >
                                {c}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
