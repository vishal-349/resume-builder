/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Resume, ResumeStyles } from '../types';
import { store } from '../store';
import { COLOR_PRESETS } from '../templates';
import { FONT_OPTIONS, resolveFontStack } from '../fonts';
import { Palette, Type, Sliders, LayoutGrid } from 'lucide-react';

interface ThemeSelectorProps {
  resume: Resume;
  onUpdate: () => void;
}

export default function ThemeSelector({ resume, onUpdate }: ThemeSelectorProps) {
  const styles = resume.styles;

  const handleStyleChange = (key: keyof ResumeStyles, value: any) => {
    store.updateStyles({ [key]: value });
    onUpdate();
  };

  return (
    <div className="space-y-6" id="theme-selector-panel">
      {/* 1. Palette Preset Configuration */}
      <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-xxs">
        <h4 className="text-sm font-semibold text-slate-800 flex items-center gap-2 mb-4">
          <Palette size={16} className="text-indigo-600" />
          Color Palette
        </h4>
        <div className="grid grid-cols-3 gap-2">
          {COLOR_PRESETS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => {
                store.updateStyles({
                  primaryColor: preset.primary,
                  textColor: preset.text,
                  backgroundColor: preset.bg,
                });
                onUpdate();
              }}
              style={{ borderLeftColor: preset.primary }}
              className={`flex items-center justify-between p-2.5 border-l-4 rounded bg-slate-50 border-slate-100 text-left hover:bg-slate-100 transition-all ${
                styles.primaryColor === preset.primary ? 'ring-2 ring-indigo-500 bg-indigo-50/20' : ''
              }`}
            >
              <div className="truncate">
                <p className="text-xxs font-bold text-slate-700 truncate">{preset.name}</p>
                <span className="text-xxxxs text-slate-400 font-mono select-all truncate">{preset.primary}</span>
              </div>
              <div
                className="w-3.5 h-3.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: preset.primary }}
              />
            </button>
          ))}
        </div>

        {/* Custom Hex Color Picker */}
        <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between gap-4">
          <div>
            <label className="text-xs font-medium text-slate-700">Custom Brand Color</label>
            <p className="text-xxxxs text-slate-400">Match company colors or job branding</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-slate-500 bg-slate-50 px-2 py-1 border border-slate-100 rounded select-all">
              {styles.primaryColor}
            </span>
            <input
              type="color"
              value={styles.primaryColor}
              onChange={(e) => handleStyleChange('primaryColor', e.target.value)}
              className="w-8 h-8 rounded cursor-pointer border border-slate-200 outline-hidden"
            />
          </div>
        </div>
      </div>

      {/* 2. Typography Customization */}
      <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-xxs">
        <h4 className="text-sm font-semibold text-slate-800 flex items-center gap-2 mb-4">
          <Type size={16} className="text-indigo-600" />
          Typography Font Family
        </h4>
        <div className="space-y-2">
          <select
            value={FONT_OPTIONS.some((f) => f.value === styles.fontFamily) ? styles.fontFamily : ''}
            onChange={(e) => handleStyleChange('fontFamily', e.target.value)}
            className="w-full text-sm px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500 cursor-pointer text-slate-800"
            style={{ fontFamily: resolveFontStack(styles.fontFamily) }}
          >
            {/* Show the active preset token (sans/serif/mono/...) if not a named font yet */}
            {!FONT_OPTIONS.some((f) => f.value === styles.fontFamily) && (
              <option value="">{`Preset: ${styles.fontFamily}`}</option>
            )}
            {FONT_OPTIONS.map((font) => (
              <option key={font.value} value={font.value} style={{ fontFamily: resolveFontStack(font.value) }}>
                {font.label}
              </option>
            ))}
          </select>
          <p className="text-xxxxs text-slate-400 font-sans">
            Applies instantly to the live preview and the exported PDF / Word document.
          </p>
          <div
            className="mt-1 p-3 rounded-lg border border-slate-100 bg-slate-50/60 text-slate-700 text-sm"
            style={{ fontFamily: resolveFontStack(styles.fontFamily) }}
          >
            The quick brown fox jumps over the lazy dog — 1234567890
          </div>
        </div>
      </div>

      {/* Contact / Header Layout — move contact details independent of template */}
      <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-xxs">
        <h4 className="text-sm font-semibold text-slate-800 flex items-center gap-2 mb-1">
          <LayoutGrid size={16} className="text-indigo-600" />
          Contact / Header Layout
        </h4>
        <p className="text-xxxxs text-slate-400 mb-3">Reposition your contact details regardless of the chosen template.</p>
        <div className="grid grid-cols-2 gap-2">
          {([
            { v: 'template', label: 'Template Default', desc: "Use the template's header" },
            { v: 'right', label: 'Contact Right', desc: 'Name left, contact right' },
            { v: 'horizontal', label: 'Below Name', desc: 'Centered, contact row under name' },
            { v: 'stacked', label: 'Left Stacked', desc: 'Left-aligned, contact under name' },
          ] as const).map((opt) => {
            const current = styles.headerLayout || 'template';
            return (
              <button
                key={opt.v}
                onClick={() => handleStyleChange('headerLayout', opt.v)}
                className={`p-2.5 rounded-lg border text-left transition-all ${
                  current === opt.v
                    ? 'border-indigo-600 bg-indigo-50/10 shadow-xxs'
                    : 'border-slate-100 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-200'
                }`}
              >
                <p className="text-xxs font-bold text-slate-800 leading-none">{opt.label}</p>
                <span className="text-xxxxs text-slate-400 mt-1 block leading-snug">{opt.desc}</span>
              </button>
            );
          })}
        </div>

        {/* Multi-page footer content */}
        <div className="mt-4 pt-4 border-t border-slate-100">
          <label className="text-xs font-medium text-slate-500 flex justify-between mb-2">
            <span>Page Footer (multi-page)</span>
            <span className="font-mono text-indigo-600 font-bold uppercase text-xxxxs">
              {(styles.footerStyle || 'name') === 'name-title' ? 'Name + Title' : 'Name'}
            </span>
          </label>
          <div className="grid grid-cols-2 gap-2">
            {([
              { v: 'name', label: 'Name Only' },
              { v: 'name-title', label: 'Name + Title' },
            ] as const).map((opt) => (
              <button
                key={opt.v}
                onClick={() => handleStyleChange('footerStyle', opt.v)}
                className={`py-1.5 rounded text-xxs font-medium border ${
                  (styles.footerStyle || 'name') === opt.v
                    ? 'border-indigo-600 bg-indigo-50/10 text-indigo-700 font-semibold'
                    : 'border-slate-100 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 3. Layout, Alignment & Sizing Density */}
      <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-xxs space-y-4">
        <h4 className="text-sm font-semibold text-slate-800 flex items-center gap-2 mb-2">
          <Sliders size={16} className="text-indigo-600" />
          Sizing & Page Density
        </h4>

        {/* Font size is intentionally NOT a global control — it is applied per
            selection from the preview's floating toolbar (select text → Size). */}

        {/* Line spacing (applies to summary & description prose) */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-500 flex justify-between">
            <span>Line Spacing</span>
            <span className="font-mono text-indigo-600 font-bold uppercase text-xxxxs">{styles.lineSpacing || 'normal'}</span>
          </label>
          <div className="grid grid-cols-3 gap-1">
            {(['tight', 'normal', 'relaxed'] as const).map((ls) => (
              <button
                key={ls}
                onClick={() => handleStyleChange('lineSpacing', ls)}
                className={`py-1.5 rounded text-xxs font-medium border capitalize ${
                  (styles.lineSpacing || 'normal') === ls
                    ? 'border-indigo-600 bg-indigo-50/10 text-indigo-700 font-semibold'
                    : 'border-slate-100 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {ls}
              </button>
            ))}
          </div>
        </div>

        {/* Spacing density */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-500 flex justify-between">
            <span>Section/Margin Spacing</span>
            <span className="font-mono text-indigo-600 font-bold uppercase text-xxxxs">{styles.spacing}</span>
          </label>
          <div className="grid grid-cols-3 gap-1">
            {(['compact', 'normal', 'relaxed'] as const).map((sp) => (
              <button
                key={sp}
                onClick={() => handleStyleChange('spacing', sp)}
                className={`py-1.5 rounded text-xxs font-medium border capitalize ${
                  styles.spacing === sp
                    ? 'border-indigo-600 bg-indigo-50/10 text-indigo-700 font-semibold'
                    : 'border-slate-100 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {sp}
              </button>
            ))}
          </div>
        </div>

        {/* Divider selection */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-500 flex justify-between">
            <span>Header Division Track</span>
            <span className="font-mono text-indigo-600 font-bold uppercase text-xxxxs">{styles.dividerStyle}</span>
          </label>
          <div className="grid grid-cols-5 gap-1">
            {(['none', 'solid', 'dashed', 'double', 'thick'] as const).map((divs) => (
              <button
                key={divs}
                onClick={() => handleStyleChange('dividerStyle', divs)}
                className={`py-1 rounded text-xxxxs font-medium border capitalize ${
                  styles.dividerStyle === divs
                    ? 'border-indigo-600 bg-indigo-50/10 text-indigo-700 font-semibold'
                    : 'border-slate-100 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {divs}
              </button>
            ))}
          </div>
        </div>

        {/* Align heading text */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-500 flex justify-between">
            <span>Section Title Alignment</span>
            <span className="font-mono text-indigo-600 font-bold uppercase text-xxxxs">{styles.sectionHeadingAlignment}</span>
          </label>
          <div className="grid grid-cols-3 gap-1">
            {(['left', 'center', 'right'] as const).map((align) => (
              <button
                key={align}
                onClick={() => handleStyleChange('sectionHeadingAlignment', align)}
                className={`py-1.5 rounded text-xxs font-medium border capitalize ${
                  styles.sectionHeadingAlignment === align
                    ? 'border-indigo-600 bg-indigo-50/10 text-indigo-700 font-semibold'
                    : 'border-slate-100 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {align}
              </button>
            ))}
          </div>
        </div>

        {/* Radiuses selection */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-500 flex justify-between">
            <span>UI Borders Rounding</span>
            <span className="font-mono text-indigo-600 font-bold uppercase text-xxxxs">{styles.borderRadius}</span>
          </label>
          <div className="grid grid-cols-5 gap-1">
            {(['none', 'sm', 'md', 'lg', 'full'] as const).map((br) => (
              <button
                key={br}
                onClick={() => handleStyleChange('borderRadius', br)}
                className={`py-1 rounded text-xxxxs font-bold border uppercase ${
                  styles.borderRadius === br
                    ? 'border-indigo-600 bg-indigo-50/10 text-indigo-700 font-bold'
                    : 'border-slate-100 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {br}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
