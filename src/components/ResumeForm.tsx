/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Resume, ResumeSection, SectionType } from '../types';
import { store } from '../store';
import { PlusCircle, Trash2, ChevronDown, ChevronRight, Eye, EyeOff, Clipboard, Plus } from 'lucide-react';

interface ResumeFormProps {
  resume: Resume;
  onUpdate: () => void;
}

export default function ResumeForm({ resume, onUpdate }: ResumeFormProps) {
  const sections = resume.sections;

  // Tracks which item currently has an active Delete/Cancel confirmation prompt.
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // The preview supports inline rich-text editing, which stores HTML (e.g.
  // <b>, <font style="font-size:..">). The form inputs are plain-text editors,
  // so we strip that markup for display. Editing a field here saves plain text
  // (replacing any rich formatting for that field) — formatting is done in the
  // preview, content in the form.
  const clean = (v: any): string =>
    v == null
      ? ''
      : String(v)
          .replace(/<br\s*\/?>(?=)/gi, '\n')
          .replace(/<\/(p|div|li)>/gi, '\n')
          .replace(/<[^>]*>/g, '')
          .replace(/&nbsp;/gi, ' ')
          .replace(/&amp;/gi, '&')
          .replace(/&lt;/gi, '<')
          .replace(/&gt;/gi, '>')
          .replace(/\n{3,}/g, '\n\n')
          .trimStart();

  const handleUpdateItem = (sectionId: string, itemId: string, data: any) => {
    store.updateSectionItem(sectionId, itemId, data);
    onUpdate();
  };

  /**
   * Renders an explicit two-step delete control. A plain trash button first;
   * once clicked it expands into "Delete" / "Cancel" — deletion only proceeds
   * when the user explicitly confirms.
   */
  const renderDeleteControl = (sectionId: string, itemId: string, posClass: string) => {
    if (confirmDeleteId === itemId) {
      return (
        <div className={`${posClass} flex items-center gap-1 bg-red-50 border border-red-200 rounded-lg px-1.5 py-1 z-10 animate-fade-in shadow-sm`}>
          <button
            type="button"
            onClick={() => {
              handleDeleteItem(sectionId, itemId);
              setConfirmDeleteId(null);
            }}
            className="px-1.5 py-0.5 bg-red-600 text-white rounded text-[10px] font-bold hover:bg-red-700 transition-colors cursor-pointer"
            title="Confirm deletion"
          >
            Delete
          </button>
          <button
            type="button"
            onClick={() => setConfirmDeleteId(null)}
            className="px-1.5 py-0.5 text-slate-500 hover:text-slate-700 rounded text-[10px] font-bold hover:bg-slate-200 transition-colors cursor-pointer"
            title="Cancel deletion"
          >
            Cancel
          </button>
        </div>
      );
    }
    return (
      <button
        type="button"
        onClick={() => setConfirmDeleteId(itemId)}
        className={`${posClass} p-1.5 text-slate-400 hover:text-red-600 rounded-md hover:bg-white transition-all cursor-pointer`}
        title="Delete entry"
      >
        <Trash2 size={12} />
      </button>
    );
  };

  const handleAddField = (sectionId: string, type: SectionType) => {
    let template: any = {};
    if (type === 'experience') {
      template = { company: '', position: '', startDate: '', endDate: '', current: false, location: '', description: '' };
    } else if (type === 'education') {
      template = { institution: '', degree: '', fieldOfStudy: '', startDate: '', endDate: '', current: false, grade: '', description: '' };
    } else if (type === 'skills') {
      template = { name: '', level: 'Intermediate' };
    } else if (type === 'projects') {
      template = { name: '', role: '', url: '', startDate: '', endDate: '', current: false, description: '' };
    } else if (type === 'certifications') {
      template = { name: '', issuer: '', date: '' };
    } else if (type === 'awards') {
      template = { title: '', issuer: '', date: '', description: '' };
    } else if (type === 'languages') {
      template = { name: '', proficiency: 'Fluent' };
    } else if (type === 'volunteer') {
      template = { organization: '', role: '', startDate: '', endDate: '', current: false, description: '' };
    } else if (type === 'publications') {
      template = { title: '', publisher: '', date: '', url: '', description: '' };
    } else if (type === 'references') {
      template = { name: '', relationship: '', company: '', contact: '' };
    } else if (type === 'custom') {
      template = { title: '', subtitle: '', date: '', description: '' };
    }

    store.addSectionItem(sectionId, template);
    onUpdate();
  };

  const handleDeleteItem = (sectionId: string, itemId: string) => {
    store.deleteSectionItem(sectionId, itemId);
    onUpdate();
  };

  // Helper toggle accordion collapse
  const handleToggleCollapse = (sectionId: string) => {
    store.toggleSectionCollapse(sectionId);
    onUpdate();
  };

  return (
    <div className="space-y-4" id="resume-builder-form-scroller">
      {sections.map((sec) => {
        const isCollapsed = sec.collapsed ?? false;
        const isVisible = sec.visible;

        return (
          <div
            key={sec.id}
            className={`bg-white border rounded-2xl overflow-hidden transition-all shadow-xxs ${
              isVisible ? 'border-slate-100' : 'border-slate-20 bg-slate-50/30 opacity-75'
            }`}
          >
            {/* 1. Accordion/Section Header Bar */}
            <div
              onClick={() => handleToggleCollapse(sec.id)}
              className="px-5 py-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors select-none"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="text-slate-400">
                  {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                </div>
                <div className="min-w-0">
                  <h3 className="text-xs font-extrabold text-slate-800 leading-none flex items-center gap-1.5">
                    {sec.name}
                    {!isVisible && (
                      <span className="text-[9px] bg-slate-100 text-slate-505 font-bold uppercase py-0.5 px-1.5 rounded-full font-mono">
                        Invisible
                      </span>
                    )}
                  </h3>
                  <p className="text-xxxxs text-slate-400 capitalize font-mono mt-1 pr-6 truncate">
                    Editable category: {sec.type} • {sec.items.length} records
                  </p>
                </div>
              </div>

              {/* Extra toggles directly on header bar */}
              <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={() => {
                    store.toggleSectionVisibility(sec.id);
                    onUpdate();
                  }}
                  className={`p-2 rounded-lg hover:bg-slate-100 transition-all ${
                    isVisible ? 'text-slate-400 hover:text-indigo-650' : 'text-slate-350 hover:text-slate-700'
                  }`}
                  title={isVisible ? 'Hide from PDF outline' : 'Add into PDF outline'}
                >
                  {isVisible ? <Eye size={14} /> : <EyeOff size={14} />}
                </button>
              </div>
            </div>

            {/* 2. Expanded Inputs Section */}
            {!isCollapsed && isVisible && (
              <div className="px-5 pb-5 pt-1 border-t border-slate-50 space-y-4 animate-fade-in text-left">
                
                {/* CASE A: Personal Info Details */}
                {sec.type === 'personal' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {(() => {
                      const item = sec.items[0] || {};
                      const createField = (label: string, key: string, type: string = 'text', placeholder: string = '') => (
                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">{label}</label>
                          <input
                            type={type}
                            value={clean(item[key])}
                            placeholder={placeholder}
                            onChange={(e) => handleUpdateItem(sec.id, '', { [key]: e.target.value })}
                            className="w-full text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-200/60 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-indigo-500 focus:bg-white transition-all shadow-xxs font-medium"
                          />
                        </div>
                      );
                      return (
                        <>
                          <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {createField('Full Name', 'fullName', 'text', 'John Doe')}
                            {createField('Professional Title', 'jobTitle', 'text', 'Lead Software Architect')}
                          </div>
                          {createField('Email Address', 'email', 'email', 'john.doe@example.com')}
                          {createField('Phone Number', 'phone', 'tel', '+1 (555) 019-2834')}
                          {createField('City, Country', 'location', 'text', 'San Francisco, CA')}
                          {createField('Web Portfolio', 'website', 'url', 'https://johndoe.dev')}
                          {createField('LinkedIn URL', 'linkedin', 'text', 'linkedin.com/in/johndoe')}
                          {createField('GitHub Handle', 'github', 'text', 'github.com/johndoe')}
                        </>
                      );
                    })()}
                  </div>
                )}

                {/* CASE B: Professional Summary text block */}
                {sec.type === 'summary' && (
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Self Summary Statement</label>
                    <textarea
                      rows={5}
                      value={clean(sec.items[0])}
                      onChange={(e) => handleUpdateItem(sec.id, '', e.target.value)}
                      placeholder="E.g. Dynamic and results-driven Principal Software Engineer with 8+ years experience guiding cross-functional teams..."
                      className="w-full text-xs text-slate-800 px-3.5 py-3 bg-slate-50 border border-slate-200/60 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-indigo-500 focus:bg-white transition-all shadow-xxs leading-relaxed font-sans"
                    />
                    <div className="flex justify-between text-xxxxs text-slate-400 font-mono select-none">
                      <span>Tip: Highlight metric wins & Action verbs first.</span>
                      <span>Length: {(sec.items[0] || '').length} / 450 max optimal</span>
                    </div>
                  </div>
                )}

                {/* CASE C: Work Experience Timeline List */}
                {sec.type === 'experience' && (
                  <div className="space-y-4">
                    {sec.items.map((exp, expIdx) => (
                      <div key={exp.id} className="p-4 bg-slate-50 border border-slate-105 rounded-xl space-y-3 relative group/item animate-fade-in">
                        {renderDeleteControl(sec.id, exp.id, 'absolute top-3.5 right-3.5')}

                        <div className="text-[10px] font-bold text-slate-450 uppercase select-none tracking-wide">Work Position #{expIdx + 1}</div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                          <div className="space-y-1">
                            <label className="text-xxxxs font-bold text-slate-500 uppercase">Company/Org</label>
                            <input
                              type="text"
                              value={clean(exp.company)}
                              onChange={(e) => handleUpdateItem(sec.id, exp.id, { company: e.target.value })}
                              className="w-full text-xxs px-3 py-2 bg-white border border-slate-200/70 rounded-lg focus:outline-hidden"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xxxxs font-bold text-slate-500 uppercase">Job Title</label>
                            <input
                              type="text"
                              value={clean(exp.position)}
                              onChange={(e) => handleUpdateItem(sec.id, exp.id, { position: e.target.value })}
                              className="w-full text-xxs px-3 py-2 bg-white border border-slate-200/70 rounded-lg focus:outline-hidden"
                            />
                          </div>
                        </div>

                        {/* Dates grid */}
                        <div className="grid grid-cols-2 gap-3.5">
                          <div className="space-y-1">
                            <label className="text-xxxxs font-bold text-slate-500 uppercase">Start Date (MM-YYYY)</label>
                            <input
                              type="text"
                              value={clean(exp.startDate)}
                              placeholder="01-2020"
                              onChange={(e) => handleUpdateItem(sec.id, exp.id, { startDate: e.target.value })}
                              className="w-full text-xxs px-3 py-2 bg-white border border-slate-200/70 rounded-lg focus:outline-hidden"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xxxxs font-bold text-slate-500 uppercase">End Date (MM-YYYY)</label>
                            <input
                              type="text"
                              disabled={exp.current}
                              value={clean(exp.current ? '' : exp.endDate)}
                              placeholder="12-2023"
                              onChange={(e) => handleUpdateItem(sec.id, exp.id, { endDate: e.target.value })}
                              className="w-full text-xxs px-3 py-2 bg-white border border-slate-200/70 rounded-lg focus:outline-hidden disabled:bg-slate-100 disabled:text-slate-450"
                            />
                          </div>
                        </div>
                        <div className="flex items-center gap-2 pt-1 select-none">
                          <input
                            type="checkbox"
                            id={`exp-curr-${exp.id}`}
                            checked={exp.current || false}
                            onChange={(e) => handleUpdateItem(sec.id, exp.id, { current: e.target.checked })}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-505 cursor-pointer w-3.5 h-3.5"
                          />
                          <label htmlFor={`exp-curr-${exp.id}`} className="text-xxxxs font-bold text-slate-550 uppercase tracking-widest cursor-pointer select-none">Currently Ongoing</label>
                        </div>

                        <div className="space-y-1">
                          <label className="text-xxxxs font-bold text-slate-500 uppercase">Office Location</label>
                          <input
                            type="text"
                            value={clean(exp.location)}
                            placeholder="New York, NY"
                            onChange={(e) => handleUpdateItem(sec.id, exp.id, { location: e.target.value })}
                            className="w-full text-xxs px-3 py-2 bg-white border border-slate-200/70 rounded-lg focus:outline-hidden"
                          />
                        </div>

                        {/* Bullet descrip detail */}
                        <div className="space-y-1">
                          <label className="text-xxxxs font-bold text-slate-550 uppercase tracking-wide">Tasks and Metric Achievements (One bullet per line)</label>
                          <textarea
                            rows={3}
                            value={clean(exp.description)}
                            placeholder="- Spearheaded design for VirtuCloud cloud dashboard reducing billing latency by 45%&#10;- Mentored 4 developer apprentices..."
                            onChange={(e) => handleUpdateItem(sec.id, exp.id, { description: e.target.value })}
                            className="w-full text-xxs px-3 py-2 bg-white border border-slate-200/70 rounded-lg focus:outline-hidden font-sans leading-relaxed"
                          />
                        </div>
                      </div>
                    ))}

                    <button
                      type="button"
                      onClick={() => handleAddField(sec.id, 'experience')}
                      className="w-full flex items-center justify-center gap-1.5 py-3 border border-dashed border-indigo-200 rounded-xl bg-indigo-50/5 text-indigo-700 hover:bg-slate-50 hover:border-indigo-400 transition-all font-bold text-xxs shadow-xxxxs cursor-pointer"
                    >
                      <Plus size={13} />
                      Add Work Position Record
                    </button>
                  </div>
                )}

                {/* CASE D: Education background details */}
                {sec.type === 'education' && (
                  <div className="space-y-4">
                    {sec.items.map((edu, eduIdx) => (
                      <div key={edu.id} className="p-4 bg-slate-50 border border-slate-105 rounded-xl space-y-3 relative group/item animate-fade-in">
                        {renderDeleteControl(sec.id, edu.id, 'absolute top-3.5 right-3.5')}

                        <div className="text-[10px] font-bold text-slate-450 uppercase select-none tracking-wide">Academic Degree #{eduIdx + 1}</div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                          <div className="space-y-1">
                            <label className="text-xxxxs font-bold text-slate-500 uppercase">Institution / School</label>
                            <input
                              type="text"
                              value={clean(edu.institution)}
                              onChange={(e) => handleUpdateItem(sec.id, edu.id, { institution: e.target.value })}
                              className="w-full text-xxs px-3 py-2 bg-white border border-slate-200/70 rounded-lg focus:outline-hidden"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xxxxs font-bold text-slate-500 uppercase">Degree (e.g. MS, Bachelor)</label>
                            <input
                              type="text"
                              value={clean(edu.degree)}
                              onChange={(e) => handleUpdateItem(sec.id, edu.id, { degree: e.target.value })}
                              className="w-full text-xxs px-3 py-2 bg-white border border-slate-200/70 rounded-lg focus:outline-hidden"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                          <div className="space-y-1">
                            <label className="text-xxxxs font-bold text-slate-500 uppercase">Field of Study</label>
                            <input
                              type="text"
                              value={clean(edu.fieldOfStudy)}
                              onChange={(e) => handleUpdateItem(sec.id, edu.id, { fieldOfStudy: e.target.value })}
                              className="w-full text-xxs px-3 py-2 bg-white border border-slate-200/70 rounded-lg focus:outline-hidden"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                              <label className="text-xxxxs font-bold text-slate-500 uppercase">Start Date (MM-YYYY)</label>
                              <input
                                type="text"
                                value={clean(edu.startDate)}
                                placeholder="09-2016"
                                onChange={(e) => handleUpdateItem(sec.id, edu.id, { startDate: e.target.value })}
                                className="w-full text-xxs px-3 py-2 bg-white border border-slate-200/70 rounded-lg focus:outline-hidden"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-xxxxs font-bold text-slate-500 uppercase">End Date (MM-YYYY)</label>
                              <input
                                type="text"
                                placeholder="06-2020"
                                value={clean(edu.endDate)}
                                onChange={(e) => handleUpdateItem(sec.id, edu.id, { endDate: e.target.value })}
                                className="w-full text-xxs px-3 py-2 bg-white border border-slate-200/70 rounded-lg focus:outline-hidden"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 gap-3.5 mt-2">
                          <div className="space-y-1">
                            <label className="text-xxxxs font-bold text-slate-500 uppercase">Grade / GPA (Optional)</label>
                            <input
                              type="text"
                              value={clean(edu.grade)}
                              placeholder="3.92 GPA"
                              onChange={(e) => handleUpdateItem(sec.id, edu.id, { grade: e.target.value })}
                              className="w-full text-xxs px-3 py-2 bg-white border border-slate-200/70 rounded-lg focus:outline-hidden"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xxxxs font-bold text-slate-550 uppercase tracking-wide">Description / Highlights</label>
                            <textarea
                              rows={4}
                              value={clean(edu.description)}
                              placeholder="E.g. Specialization in Distributed Systems, Graphics, and Advanced Web Security standards. Completed thesis projects..."
                              onChange={(e) => handleUpdateItem(sec.id, edu.id, { description: e.target.value })}
                              className="w-full text-xxs px-3 py-2 bg-white border border-slate-200/70 rounded-lg focus:outline-hidden font-sans leading-relaxed"
                            />
                          </div>
                        </div>
                      </div>
                    ))}

                    <button
                      type="button"
                      onClick={() => handleAddField(sec.id, 'education')}
                      className="w-full flex items-center justify-center gap-1.5 py-3 border border-dashed border-indigo-200 rounded-xl bg-indigo-50/5 text-indigo-705 hover:bg-slate-50 hover:border-indigo-400 font-bold text-xxs cursor-pointer"
                    >
                      <Plus size={13} />
                      Add Education Degree
                    </button>
                  </div>
                )}

                {/* CASE E: Skills set with levels */}
                {sec.type === 'skills' && (
                  <div className="space-y-3">
                    {sec.items.length > 0 && (
                      <div className="grid grid-cols-1 gap-2 pb-2">
                        {sec.items.map((sk) => (
                          <div key={sk.id} className="p-1.5 bg-slate-50 border border-slate-100 rounded-xl flex items-center gap-2 animate-fade-in hover:border-slate-205 transition-all shadow-xxxxs">
                            <input
                              type="text"
                              placeholder="Skill spec (e.g. React)"
                              value={clean(sk.name)}
                              onChange={(e) => handleUpdateItem(sec.id, sk.id, { name: e.target.value })}
                              className="flex-1 min-w-0 text-xs bg-white border border-slate-200 rounded-lg px-3 py-1.5 outline-hidden font-medium text-slate-800 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100 transition-all select-all"
                            />
                            <select
                              value={clean(sk.level)}
                              onChange={(e) => handleUpdateItem(sec.id, sk.id, { level: e.target.value })}
                              className="w-24 sm:w-28 shrink-0 min-w-0 text-xs bg-white border border-slate-200 rounded-lg py-1.5 px-2 outline-hidden font-medium text-slate-700 cursor-pointer focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100 transition-all"
                            >
                              <option value="">No Level</option>
                              <option value="Beginner">Beginner</option>
                              <option value="Intermediate">Intermediate</option>
                              <option value="Advanced">Advanced</option>
                              <option value="Expert">Expert</option>
                            </select>
                            {renderDeleteControl(sec.id, sk.id, 'shrink-0')}
                          </div>
                        ))}
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => handleAddField(sec.id, 'skills')}
                      className="w-full flex items-center justify-center gap-1.5 py-2 hover:bg-slate-50/70 text-slate-655 hover:text-indigo-705 bg-white rounded-xl text-xxs font-bold border border-slate-200 cursor-pointer transition-all shadow-xxxxs"
                    >
                      <Plus size={12} />
                      Add Skill Row
                    </button>
                  </div>
                )}

                {/* CASE F: Projects List entries */}
                {sec.type === 'projects' && (
                  <div className="space-y-3">
                    {sec.items.map((proj) => (
                      <div key={proj.id} className="p-4 bg-slate-50 border rounded-xl space-y-3 relative animate-fade-in pr-10">
                        {renderDeleteControl(sec.id, proj.id, 'absolute top-4 right-4')}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-xxxxs font-bold text-slate-500 uppercase">Project Title</label>
                            <input
                              type="text"
                              value={clean(proj.name)}
                              onChange={(e) => handleUpdateItem(sec.id, proj.id, { name: e.target.value })}
                              className="w-full text-xxs px-3 py-2 bg-white border rounded-lg focus:outline-hidden"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xxxxs font-bold text-slate-500 uppercase">Applicant Role</label>
                            <input
                              type="text"
                              value={clean(proj.role)}
                              placeholder="Lead architect"
                              onChange={(e) => handleUpdateItem(sec.id, proj.id, { role: e.target.value })}
                              className="w-full text-xxs px-3 py-2 bg-white border rounded-lg focus:outline-hidden"
                            />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-xxxxs font-bold text-slate-500 uppercase">Github Link / URL</label>
                          <input
                            type="text"
                            value={clean(proj.url)}
                            onChange={(e) => handleUpdateItem(sec.id, proj.id, { url: e.target.value })}
                            className="w-full text-xxs px-3 py-2 bg-white border rounded-lg focus:outline-hidden"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3 pt-1">
                          <div className="space-y-1">
                            <label className="text-xxxxs font-bold text-slate-500 uppercase">Start Date (MM-YYYY)</label>
                            <input
                              type="text"
                              value={clean(proj.startDate)}
                              placeholder="01-2022"
                              onChange={(e) => handleUpdateItem(sec.id, proj.id, { startDate: e.target.value })}
                              className="w-full text-xxs px-3 py-2 bg-white border border-slate-200/70 rounded-lg focus:outline-hidden"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xxxxs font-bold text-slate-500 uppercase">End Date (MM-YYYY)</label>
                            <input
                              type="text"
                              disabled={proj.current}
                              value={clean(proj.current ? '' : proj.endDate)}
                              placeholder="06-2023"
                              onChange={(e) => handleUpdateItem(sec.id, proj.id, { endDate: e.target.value })}
                              className="w-full text-xxs px-3 py-2 bg-white border border-slate-200/70 rounded-lg focus:outline-hidden disabled:bg-slate-100 disabled:text-slate-450"
                            />
                          </div>
                        </div>
                        <div className="flex items-center gap-2 select-none pt-0.5">
                          <input
                            type="checkbox"
                            id={`proj-curr-${proj.id}`}
                            checked={proj.current || false}
                            onChange={(e) => handleUpdateItem(sec.id, proj.id, { current: e.target.checked })}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-505 cursor-pointer w-3.5 h-3.5"
                          />
                          <label htmlFor={`proj-curr-${proj.id}`} className="text-xxxxs font-bold text-slate-550 uppercase tracking-widest cursor-pointer select-none">Project Currently Ongoing</label>
                        </div>

                        <div className="space-y-1">
                          <label className="text-xxxxs font-bold text-slate-500 uppercase">Brief descriptions (Bullets split per line)</label>
                          <textarea
                            rows={3}
                            value={clean(proj.description)}
                            onChange={(e) => handleUpdateItem(sec.id, proj.id, { description: e.target.value })}
                            className="w-full text-xxs px-3 py-2 bg-white border rounded-lg focus:outline-hidden"
                          />
                        </div>
                      </div>
                    ))}

                    <button
                      type="button"
                      onClick={() => handleAddField(sec.id, 'projects')}
                      className="w-full flex items-center justify-center gap-1 py-3 border border-dashed border-indigo-200 bg-indigo-50/10 hover:bg-slate-50 text-indigo-700 text-xxs font-bold rounded-lg cursor-pointer"
                    >
                      <Plus size={13} />
                      Add Project Card
                    </button>
                  </div>
                )}

                {/* CASE G: Secondary sections layouts (Certifications, Awards, Languages, References, Volunteer, Publications...) */}
                {['certifications', 'awards', 'languages', 'volunteer', 'publications', 'references', 'custom'].includes(sec.type) && (
                  <div className="space-y-3">
                    {sec.items.map((item, itemIdx) => (
                      <div key={item.id} className="p-4 bg-slate-50 border rounded-xl relative space-y-3 pr-10 animate-fade-in border-slate-105">
                        {renderDeleteControl(sec.id, item.id, 'absolute top-4 right-4')}

                        <span className="text-[9px] font-bold text-slate-400 uppercase font-mono tracking-widest leading-none">Record #{itemIdx+1}</span>

                        {sec.type === 'certifications' && (
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <input
                              type="text"
                              placeholder="Name (e.g. AWS Solutions Architect)"
                              value={clean(item.name)}
                              onChange={(e) => handleUpdateItem(sec.id, item.id, { name: e.target.value })}
                              className="text-xxs px-3 py-2 border rounded-md bg-white w-full"
                            />
                            <input
                              type="text"
                              placeholder="Issuer Authority"
                              value={clean(item.issuer)}
                              onChange={(e) => handleUpdateItem(sec.id, item.id, { issuer: e.target.value })}
                              className="text-xxs px-3 py-2 border rounded-md bg-white w-full"
                            />
                            <input
                              type="text"
                              placeholder="Date (MM-YYYY)"
                              value={clean(item.date)}
                              onChange={(e) => handleUpdateItem(sec.id, item.id, { date: e.target.value })}
                              className="text-xxs px-3 py-2 border rounded-md bg-white w-full"
                            />
                          </div>
                        )}

                        {sec.type === 'awards' && (
                          <div className="space-y-2">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                              <input
                                type="text"
                                placeholder="Win Title (e.g. Hackathon Winner)"
                                value={clean(item.title)}
                                onChange={(e) => handleUpdateItem(sec.id, item.id, { title: e.target.value })}
                                className="text-xxs px-3 py-2 border rounded-md bg-white w-full min-w-0"
                              />
                              <input
                                type="text"
                                placeholder="Issuer"
                                value={clean(item.issuer)}
                                onChange={(e) => handleUpdateItem(sec.id, item.id, { issuer: e.target.value })}
                                className="text-xxs px-3 py-2 border rounded-md bg-white w-full min-w-0"
                              />
                              <input
                                type="text"
                                placeholder="Date (MM-YYYY)"
                                value={clean(item.date)}
                                onChange={(e) => handleUpdateItem(sec.id, item.id, { date: e.target.value })}
                                className="text-xxs px-3 py-2 border rounded-md bg-white w-full min-w-0"
                              />
                            </div>
                            <input
                              type="text"
                              placeholder="Award detail descriptions summary"
                              value={clean(item.description)}
                              onChange={(e) => handleUpdateItem(sec.id, item.id, { description: e.target.value })}
                              className="text-xxs px-3 py-2 border rounded-md bg-white w-full min-w-0"
                            />
                          </div>
                        )}

                        {sec.type === 'languages' && (
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              type="text"
                              placeholder="Language (e.g. Spanish)"
                              value={clean(item.name)}
                              onChange={(e) => handleUpdateItem(sec.id, item.id, { name: e.target.value })}
                              className="text-xxs px-3 py-2 border rounded-md bg-white w-full min-w-0"
                            />
                            <input
                              type="text"
                              placeholder="Competency (e.g. Fluent)"
                              value={clean(item.proficiency)}
                              onChange={(e) => handleUpdateItem(sec.id, item.id, { proficiency: e.target.value })}
                              className="text-xxs px-3 py-2 border rounded-md bg-white w-full min-w-0"
                            />
                          </div>
                        )}

                        {sec.type === 'references' && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <input
                              type="text"
                              placeholder="Name"
                              value={clean(item.name)}
                              onChange={(e) => handleUpdateItem(sec.id, item.id, { name: e.target.value })}
                              className="text-xxs px-3 py-2 border rounded-md bg-white w-full min-w-0"
                            />
                            <input
                              type="text"
                              placeholder="Relationship & Company"
                              value={clean(item.relationship)}
                              onChange={(e) => handleUpdateItem(sec.id, item.id, { relationship: e.target.value })}
                              className="text-xxs px-3 py-2 border rounded-md bg-white w-full min-w-0"
                            />
                            <input
                              type="text"
                              placeholder="Contact (Email, Phone, Slack)"
                              value={clean(item.contact)}
                              onChange={(e) => handleUpdateItem(sec.id, item.id, { contact: e.target.value })}
                              className="text-xxs px-3 py-2 border rounded-md bg-white sm:col-span-2 w-full min-w-0"
                            />
                          </div>
                        )}

                        {sec.type === 'volunteer' && (
                          <div className="space-y-2">
                            <div className="grid grid-cols-2 gap-2">
                              <input
                                type="text"
                                placeholder="Organization Name"
                                value={clean(item.organization)}
                                onChange={(e) => handleUpdateItem(sec.id, item.id, { organization: e.target.value })}
                                className="text-xxs px-3 py-2 border rounded-md bg-white w-full min-w-0"
                              />
                              <input
                                type="text"
                                placeholder="Volunteer Role"
                                value={clean(item.role)}
                                onChange={(e) => handleUpdateItem(sec.id, item.id, { role: e.target.value })}
                                className="text-xxs px-3 py-2 border rounded-md bg-white w-full min-w-0"
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div className="space-y-0.5">
                                <label className="text-xxxxs font-bold text-slate-400 uppercase">Start Date (MM-YYYY)</label>
                                <input
                                  type="text"
                                  value={clean(item.startDate)}
                                  placeholder="01-2020"
                                  onChange={(e) => handleUpdateItem(sec.id, item.id, { startDate: e.target.value })}
                                  className="text-xxs px-3 py-2 border rounded-md bg-white w-full"
                                />
                              </div>
                              <div className="space-y-0.5">
                                <label className="text-xxxxs font-bold text-slate-400 uppercase">End Date (MM-YYYY)</label>
                                <input
                                  type="text"
                                  disabled={item.current}
                                  value={clean(item.current ? '' : item.endDate)}
                                  placeholder="12-2021"
                                  onChange={(e) => handleUpdateItem(sec.id, item.id, { endDate: e.target.value })}
                                  className="text-xxs px-3 py-2 border rounded-md bg-white w-full disabled:bg-slate-100 disabled:text-slate-450"
                                />
                              </div>
                            </div>
                            <div className="flex items-center gap-2 select-none pt-0.5">
                              <input
                                type="checkbox"
                                id={`volunteer-curr-${item.id}`}
                                checked={item.current || false}
                                onChange={(e) => handleUpdateItem(sec.id, item.id, { current: e.target.checked })}
                                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-505 cursor-pointer w-3.5 h-3.5"
                              />
                              <label htmlFor={`volunteer-curr-${item.id}`} className="text-xxxxs font-bold text-slate-550 uppercase tracking-widest cursor-pointer select-none">Currently Ongoing</label>
                            </div>
                            <textarea
                              placeholder="Details of volunteer contributions"
                              value={clean(item.description)}
                              onChange={(e) => handleUpdateItem(sec.id, item.id, { description: e.target.value })}
                              className="text-xxs px-3 py-2 border rounded-md bg-white w-full min-w-0"
                            />
                          </div>
                        )}

                        {sec.type === 'publications' && (
                          <div className="space-y-2">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                              <input
                                type="text"
                                placeholder="Paper Title"
                                value={clean(item.title)}
                                onChange={(e) => handleUpdateItem(sec.id, item.id, { title: e.target.value })}
                                className="text-xxs px-3 py-2 border rounded-md bg-white w-full min-w-0"
                              />
                              <input
                                type="text"
                                placeholder="Publisher"
                                value={clean(item.publisher)}
                                onChange={(e) => handleUpdateItem(sec.id, item.id, { publisher: e.target.value })}
                                className="text-xxs px-3 py-2 border rounded-md bg-white w-full min-w-0"
                              />
                              <input
                                type="text"
                                placeholder="Date (MM-YYYY)"
                                value={clean(item.date)}
                                onChange={(e) => handleUpdateItem(sec.id, item.id, { date: e.target.value })}
                                className="text-xxs px-3 py-2 border rounded-md bg-white w-full min-w-0"
                              />
                            </div>
                            <input
                              type="text"
                              placeholder="URL Link / Academic reference"
                              value={clean(item.url)}
                              onChange={(e) => handleUpdateItem(sec.id, item.id, { url: e.target.value })}
                              className="text-xxs px-3 py-2 border rounded-md bg-white w-full min-w-0"
                            />
                          </div>
                        )}

                        {sec.type === 'custom' && (
                          <div className="space-y-2">
                            <div className="grid grid-cols-2 gap-2">
                              <input
                                type="text"
                                placeholder="Title (e.g. Masterclass)"
                                value={clean(item.title)}
                                onChange={(e) => handleUpdateItem(sec.id, item.id, { title: e.target.value })}
                                className="text-xxs px-3 py-2 border rounded-md bg-white w-full min-w-0"
                              />
                              <input
                                type="text"
                                placeholder="Subtitle / Sponsor"
                                value={clean(item.subtitle)}
                                onChange={(e) => handleUpdateItem(sec.id, item.id, { subtitle: e.target.value })}
                                className="text-xxs px-3 py-2 border rounded-md bg-white w-full min-w-0"
                              />
                            </div>
                            <input
                              type="text"
                              placeholder="Timeline / Dates"
                              value={clean(item.date)}
                              onChange={(e) => handleUpdateItem(sec.id, item.id, { date: e.target.value })}
                              className="text-xxs px-3 py-2 border rounded-md bg-white w-full min-w-0"
                            />
                            <textarea
                              placeholder="Specific bullet description outline"
                              value={clean(item.description)}
                              onChange={(e) => handleUpdateItem(sec.id, item.id, { description: e.target.value })}
                              className="text-xxs px-3 py-2 border rounded-md bg-white w-full min-w-0"
                            />
                          </div>
                        )}
                      </div>
                    ))}

                    <button
                      type="button"
                      onClick={() => handleAddField(sec.id, sec.type)}
                      className="w-full flex items-center justify-center gap-1 py-2.5 bg-slate-50 border hover:bg-slate-100 rounded-lg text-xxs font-bold text-slate-700 cursor-pointer"
                    >
                      <PlusCircle size={12} />
                      Add item into {sec.name}
                    </button>
                  </div>
                )}

              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
