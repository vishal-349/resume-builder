/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Resume } from '../types';
import { Globe, Copy, Check, Eye, ExternalLink, Code, Layers, MessageSquare, Briefcase } from 'lucide-react';

interface PortfolioGeneratorProps {
  resume: Resume;
}

export default function PortfolioGenerator({ resume }: PortfolioGeneratorProps) {
  const [layout, setLayout] = useState<'creative' | 'developer-bento' | 'minimal' | 'executive'>('creative');
  const [themeColor, setThemeColor] = useState('#4338ca'); // Indigo
  const [copied, setCopied] = useState(false);
  const [previewMode, setPreviewMode] = useState<boolean>(false);

  const personal = resume.sections.find(s => s.type === 'personal')?.items[0] || {};
  const summary = resume.sections.find(s => s.type === 'summary')?.items[0] || '';
  const skills = resume.sections.find(s => s.type === 'skills')?.items || [];
  const experiences = resume.sections.find(s => s.type === 'experience')?.items || [];
  const projects = resume.sections.find(s => s.type === 'projects')?.items || [];

  // Self-referential link based on wherever the static site is hosted — no
  // dependency on any external/remote service.
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const shareableUrl = `${origin}/portfolio/${resume.id}`;

  const copyUrl = () => {
    navigator.clipboard.writeText(shareableUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6" id="portfolio-generator-panel">
      {/* 1. Layout Selection & Settings */}
      <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-xxs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
              <Globe size={16} className="text-violet-600" />
              Dynamic Portfolio Website Generator
            </h3>
            <p className="text-xxs text-slate-500 mt-1">
              Your resume data automatically compiles into a gorgeous, modern interactive responsive landing portfolio.
            </p>
          </div>
          <button
            onClick={() => setPreviewMode(!previewMode)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-50 border border-violet-100 text-violet-700 hover:bg-violet-100 transition-all rounded-lg text-xxs font-bold shrink-0 shadow-xxs"
          >
            <Eye size={12} />
            {previewMode ? 'View Configuration' : 'Test Live Portfolio'}
          </button>
        </div>

        {/* Configuration Controllers */}
        {!previewMode && (
          <div className="space-y-4 pt-3 border-t border-slate-50">
            {/* Visual template styles */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Select Landing Aesthetic</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: 'creative', name: 'Creative Showcase', desc: 'Asymmetric bold headlines' },
                  { id: 'developer-bento', name: 'Software Bento', desc: 'Sleek grid modules & mono' },
                  { id: 'minimal', name: 'Elegant Clean', desc: 'High typography tracking' },
                  { id: 'executive', name: 'Corporate Grid', desc: 'Navy layouts & alignments' }
                ].map((tpl) => (
                  <button
                    key={tpl.id}
                    onClick={() => setLayout(tpl.id as any)}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      layout === tpl.id
                        ? 'border-violet-300 bg-violet-50 ring-2 ring-violet-100 shadow-xxs'
                        : 'border-slate-100 bg-slate-50/50 hover:bg-slate-50 hover:border-violet-200'
                    }`}
                  >
                    <p className="text-xxs font-bold text-slate-800 leading-none">{tpl.name}</p>
                    <span className="text-xxxxs text-slate-400 mt-1 block leading-snug">{tpl.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Accent selection */}
            <div className="flex items-center justify-between pt-2">
              <div>
                <label className="text-xs font-semibold text-slate-700">Landing Brand Color</label>
                <p className="text-xxxxs text-slate-400">Personalize button highlights and hover states</p>
              </div>
              <div className="flex items-center gap-2">
                {['#4338ca', '#0f766e', '#059669', '#be185d', '#d97706'].map((col) => (
                  <button
                    key={col}
                    onClick={() => setThemeColor(col)}
                    style={{ backgroundColor: col }}
                    className={`w-5 h-5 rounded-full border-2 transition-transform ${
                      themeColor === col ? 'scale-110 border-white ring-2 ring-violet-400' : 'border-transparent'
                    }`}
                  />
                ))}
                <input
                  type="color"
                  value={themeColor}
                  onChange={(e) => setThemeColor(e.target.value)}
                  className="w-6 h-6 rounded cursor-pointer border border-slate-200 outline-hidden"
                />
              </div>
            </div>

            {/* Sharing link */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-2 mt-4">
              <label className="text-xs font-semibold text-slate-700 block">Personal Share Link</label>
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  readOnly
                  value={shareableUrl}
                  className="bg-white border text-xxs px-3 py-2 rounded-lg flex-1 font-mono text-slate-500 select-all focus:outline-hidden"
                />
                <button
                  onClick={copyUrl}
                  className="p-2 bg-sunset hover:opacity-90 glow-sunset text-white rounded-lg transition-all"
                  title="Copy link to clipboard"
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 2. Realistic interactive portfolio simulator */}
      <div className="bg-white border border-slate-100 rounded-xl overflow-hidden shadow-xs flex flex-col h-[520px]">
        {/* Browser Top bar decoration */}
        <div className="bg-slate-50 px-4 py-2 border-b border-slate-100 flex items-center justify-between shrink-0 select-none">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 bg-red-400 rounded-full inline-block" />
            <span className="w-2.5 h-2.5 bg-amber-400 rounded-full inline-block" />
            <span className="w-2.5 h-2.5 bg-green-400 rounded-full inline-block" />
          </div>
          <div className="bg-white px-2 py-0.5 border border-slate-200/50 rounded-md text-xxxxs text-slate-400 font-mono w-7/12 text-center truncate">
            {shareableUrl}
          </div>
          <div className="w-5" />
        </div>

        {/* Live Simulator viewport */}
        <div className="flex-1 overflow-y-auto bg-slate-50/50 p-6 text-left relative font-sans">
          
          {/* A: Creative Showcase Layout */}
          {layout === 'creative' && (
            <div className="space-y-12">
              {/* Hero */}
              <div className="text-center md:text-left py-6 flex flex-col md:flex-row gap-6 items-center justify-between">
                <div className="space-y-3 max-w-xl">
                  <span style={{ color: themeColor, backgroundColor: `${themeColor}12` }} className="text-xxxxs uppercase font-bold tracking-widest px-2.5 py-1 rounded-full">
                    {personal.jobTitle || 'Available for Contracts'}
                  </span>
                  <h1 className="text-2xl md:text-3xl font-black text-slate-805 tracking-tight leading-none">
                    Hi, I'm <span style={{ color: themeColor }}>{personal.fullName || 'Untitled Artist'}</span>
                  </h1>
                  <p className="text-xxs text-slate-500 leading-relaxed font-sans">{summary || 'Insert summary description'}</p>
                  
                  {/* Action contact dots */}
                  <div className="flex flex-wrap gap-2 pt-2">
                    <button style={{ backgroundColor: themeColor }} className="text-white font-semibold text-xxxxs px-3 py-1.5 rounded-lg hover:opacity-90">
                      Reach Out
                    </button>
                    {personal.website && (
                      <a href={personal.website} target="_blank" rel="noreferrer" className="text-slate-655 border border-slate-200 hover:bg-white text-xxxxs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1">
                        Site <ExternalLink size={10} />
                      </a>
                    )}
                  </div>
                </div>

                {/* Simulated profile photo frame if present */}
                <div style={{ borderColor: themeColor }} className="w-20 h-20 rounded-2xl border-4 rotate-3 flex items-center justify-center bg-slate-100 text-slate-350 text-xxxxs font-bold font-mono">
                  AVATAR
                </div>
              </div>

              {/* Skills grid section */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-slate-800 border-b border-slate-100 pb-1 flex items-center gap-1.5">
                  <Layers size={13} style={{ color: themeColor }} /> Core Expertise
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {skills.map((sk: any, idx) => (
                    <div key={sk.id || idx} className="bg-white p-2.5 rounded-xl border border-slate-100 flex justify-between items-center">
                      <span className="text-xxs font-bold text-slate-705 truncate">{sk.name}</span>
                      <span className="text-xxxxs uppercase font-bold font-mono px-1.5 py-0.5 rounded bg-slate-50 text-slate-400">{sk.level || 'Expert'}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Engineering Projects block */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-slate-800 border-b border-slate-100 pb-1 flex items-center gap-1.5">
                  <Code size={13} style={{ color: themeColor }} /> Featured Work
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {projects.map((proj: any) => (
                    <div key={proj.id} className="bg-white p-4 rounded-xl border border-slate-150 shadow-xxs space-y-1.5">
                      <h5 className="font-bold text-slate-800 text-xxs flex items-center justify-between">
                        {proj.name}
                        {proj.url && <a href={proj.url} target="_blank" rel="noreferrer" style={{ color: themeColor }} className="text-xxxxs hover:underline"><ExternalLink size={10} /></a>}
                      </h5>
                      <span className="text-xxxxs text-indigo-700 font-bold tracking-wide uppercase">{proj.role}</span>
                      <p className="text-xxxxs text-slate-500 leading-snug line-clamp-2">{proj.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* B: Software Bento Grid Layout */}
          {layout === 'developer-bento' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono text-xs">
              {/* Box 1: Profile block (covers 2 cols) */}
              <div className="sm:col-span-2 bg-slate-900 border border-slate-800 text-green-400 p-4 rounded-xl flex flex-col justify-between h-36">
                <div>
                  <p className="text-xxxxs text-slate-500">// HOSTED PORTFOLIO FILE</p>
                  <h2 className="text-sm font-bold mt-1">developer.sh --run</h2>
                  <p className="text-xxs text-slate-350 mt-1 line-clamp-2">{summary}</p>
                </div>
                <div className="flex gap-2 text-xxxxs mt-2 text-slate-405">
                  <span>Name: {personal.fullName}</span>
                  <span>Title: {personal.jobTitle}</span>
                </div>
              </div>

              {/* Box 2: Connect with email */}
              <div className="bg-indigo-950 border border-indigo-900 text-indigo-250 p-4 rounded-xl flex flex-col justify-between h-36">
                <div className="flex justify-between items-start">
                  <span className="bg-indigo-900 text-indigo-100 size-6 rounded-md flex items-center justify-center"><MessageSquare size={12} /></span>
                  <span className="text-xxxxs font-bold bg-indigo-900 px-1.5 py-0.5 rounded text-indigo-200">OPEN</span>
                </div>
                <div>
                  <h4 className="font-bold text-xxs text-white">Let's build together</h4>
                  <p className="text-xxxxs text-indigo-305 mt-1 truncate">{personal.email || 'Click below'}</p>
                </div>
              </div>

              {/* Box 3: Skills array (full-width) */}
              <div className="sm:col-span-3 bg-white border border-slate-150 p-4 rounded-xl space-y-2">
                <p className="text-xxxxs font-bold text-slate-400 uppercase tracking-widest">// STACK ARSENAL</p>
                <div className="flex flex-wrap gap-1.5">
                  {skills.map((sk: any) => (
                    <span key={sk.id} className="bg-slate-50 border px-2 py-0.5 rounded font-mono text-xxxxs text-slate-700">
                      $ npm i {sk.name.toLowerCase().replace(/\s+/g, '-')}
                    </span>
                  ))}
                </div>
              </div>

              {/* Box 4: Experience logs */}
              {experiences.length > 0 && (
                <div className="sm:col-span-3 bg-white border border-slate-150 p-4 rounded-xl space-y-3">
                  <p className="text-xxxxs font-bold text-slate-400 uppercase tracking-widest">// SYSTEM JOBS LOG</p>
                  <div className="space-y-3 font-sans">
                    {experiences.slice(0, 2).map((exp: any) => (
                      <div key={exp.id} className="border-l-2 border-slate-200 pl-3">
                        <p className="text-xxs font-bold text-slate-800">{exp.position} – {exp.company}</p>
                        <p className="text-xxxxs text-slate-400">{exp.startDate} - {exp.current ? 'Present' : exp.endDate}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* C: Minimal / Modern layout */}
          {layout === 'minimal' && (
            <div className="space-y-10 max-w-xl mx-auto font-sans text-slate-800">
              <div className="text-center py-6 space-y-3">
                <h1 className="text-2xl font-light tracking-widest text-slate-900 uppercase">{personal.fullName || 'John Creed'}</h1>
                <p className="text-xxxxs tracking-widest text-indigo-600 font-bold uppercase">{personal.jobTitle || 'Executive Consult'}</p>
                <div className="h-px bg-slate-200 w-12 mx-auto mt-4" />
              </div>

              {/* Bio summary */}
              <div className="space-y-2">
                <h4 className="text-xxxxs uppercase tracking-widest font-bold text-slate-400">Biography</h4>
                <p className="text-xxs text-slate-600 font-serif leading-relaxed italic">{summary || 'Default biograph template outline details.'}</p>
              </div>

              {/* Interactive skills bullet track */}
              <div className="space-y-2">
                <h4 className="text-xxxxs uppercase tracking-widest font-bold text-slate-400">Core Focus Area</h4>
                <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-xxs text-slate-700">
                  {skills.slice(0, 6).map((sk: any) => (
                    <div key={sk.id} className="flex justify-between items-center border-b border-slate-100 pb-1">
                      <span>{sk.name}</span>
                      <span className="font-mono text-xxxxs opacity-50 capitalize">{sk.level || 'Advanced'}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* D: Corporate Layout */}
          {layout === 'executive' && (
            <div className="space-y-8 font-sans">
              <div className="bg-slate-850 p-6 rounded-xl text-white flex justify-between items-center flex-wrap gap-4" style={{ backgroundColor: themeColor }}>
                <div className="space-y-1">
                  <h3 className="text-md font-bold leading-none">{personal.fullName || 'Executive Director'}</h3>
                  <p className="text-xxxxs text-slate-200 opacity-90 font-mono italic">{personal.jobTitle}</p>
                </div>
                <div className="text-xxxxs font-mono space-y-0.5 opacity-80 text-right">
                  {personal.email && <p>E: {personal.email}</p>}
                  {personal.phone && <p>P: {personal.phone}</p>}
                  {personal.location && <p>L: {personal.location}</p>}
                </div>
              </div>

              {/* Grid content sections split */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-xs text-slate-700">
                <div className="sm:col-span-1 space-y-4">
                  <h4 className="font-bold text-slate-805 text-xxs border-l-2 border-slate-800 pl-2 uppercase">Capabilities</h4>
                  <ul className="space-y-1 list-none pl-0 text-xxxxs">
                    {skills.map((sk: any) => (
                      <li key={sk.id} className="bg-slate-105 p-1 px-2 rounded font-bold text-slate-700">{sk.name}</li>
                    ))}
                  </ul>
                </div>
                <div className="sm:col-span-2 space-y-4">
                  <h4 className="font-bold text-slate-805 text-xxs border-l-2 border-slate-850 pl-2 uppercase">Professional Track</h4>
                  <div className="space-y-4 text-xxs">
                    {experiences.map((exp: any) => (
                      <div key={exp.id} className="space-y-1 border-b border-slate-100 pb-2">
                        <div className="flex justify-between font-bold">
                          <span>{exp.position}</span>
                          <span className="opacity-50 text-xxxxs font-mono">{exp.startDate} – {exp.current ? 'Present' : exp.endDate}</span>
                        </div>
                        <p className="text-xxxxs text-slate-400">{exp.company}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
