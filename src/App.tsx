/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { store, loadInitialState, DEFAULT_STYLES } from './store';
import { TEMPLATE_DEFINITIONS, COLOR_PRESETS } from './templates';
import { analyzeResumeATS } from './atsChecker';
import { saveAsDocx, saveAsTxt } from './docxExport';
import { readDocument, linesFromText, DocStyle } from './import/readDocument';
import { analyzeResume, ParsedResume } from './import/analyzeResume';
import { buildImportedResume } from './import/buildImportedResume';
import { TRANSLATIONS } from './translations';

// Components
import { LivePreview } from './components/LivePreview';
import ThemeSelector from './components/ThemeSelector';
import ResumeHistory from './components/ResumeHistory';
import SectionManager from './components/SectionManager';
import StatsDashboard from './components/StatsDashboard';
import PortfolioGenerator from './components/PortfolioGenerator';
import ResumeForm from './components/ResumeForm';
import ShinyButton from './components/ShinyButton';
import ImportPreview from './components/ImportPreview';

import {
  FileText,
  Sliders,
  LayoutGrid,
  Award,
  Download,
  History,
  RotateCcw,
  RotateCw,
  Plus,
  RefreshCw,
  Eye,
  Settings,
  Shield,
  FileCode2,
  Copy,
  Printer,
  FileTextIcon,
  Search,
  BookOpen,
  Sparkles,
  ExternalLink,
  ChevronRight,
  Maximize,
  ArrowRight,
  Info,
  Globe,
  Upload,
  FileSpreadsheet,
  HelpCircle,
  Trash2
} from 'lucide-react';

export default function App() {
  const [storeState, setStoreState] = useState(store.getState());
  const [activeTab, setActiveTab] = useState<'editor' | 'templates' | 'customize' | 'sections' | 'portfolio' | 'history' | 'dashboard'>('editor');

  // Mobile Navigation states
  const [mobileTab, setMobileTab] = useState<'edit' | 'templates' | 'preview' | 'download'>('edit');
  const [rawPastedText, setRawPastedText] = useState('');
  const [showImportDialog, setShowImportDialog] = useState(false);
  // Smart Import: the analyzed resume awaiting user confirmation in the preview.
  const [importPreview, setImportPreview] = useState<ParsedResume | null>(null);
  const [importStyle, setImportStyle] = useState<DocStyle | undefined>(undefined);
  const [showPasteField, setShowPasteField] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [successToast, setSuccessToast] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [newTemplateName, setNewTemplateName] = useState('');
  const [resetConfirm, setResetConfirm] = useState(false);
  const [isPreviewExpanded, setIsPreviewExpanded] = useState(false);

  const printAreaRef = useRef<HTMLDivElement>(null);

  // Subscribe to central state changes
  useEffect(() => {
    const unsubscribe = store.subscribe((newState) => {
      setStoreState({ ...newState });
    });
    return () => unsubscribe();
  }, []);

  const activeResume = store.getActiveResume();
  const trans = activeResume ? TRANSLATIONS[activeResume.language] : TRANSLATIONS.en;

  // Run ATS Analyzer
  const atsResult = activeResume ? analyzeResumeATS(activeResume) : null;

  const isInIframe = typeof window !== 'undefined' && window.self !== window.top;

  const triggerPrintPDF = () => {
    try {
      window.focus();
      window.print();
    } catch (e) {
      console.error(e);
    }
  };

  const handleExportPDFClick = () => {
    if (isInIframe) {
      setShowExportModal(true);
    } else {
      triggerPrintPDF();
    }
  };

  const [isImportLoading, setIsImportLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  // Read → analyze → open the preview screen. Fully offline, no AI/backend.
  const handleFileUpload = async (file: File) => {
    setIsImportLoading(true);
    setSuccessToast(`Reading "${file.name}"...`);
    try {
      const { lines, style } = await readDocument(file);
      setImportStyle(style);
      setSuccessToast('Detecting sections & extracting data...');
      const parsed = analyzeResume(lines);
      // Default the resume name to the file name if no person name was found.
      if (!parsed.contact.fullName) {
        parsed.resumeName = file.name.replace(/\.[^/.]+$/, '') + ' Resume';
      }
      setShowImportDialog(false);
      setImportPreview(parsed);
    } catch (err: any) {
      console.error(err);
      triggerNotification('Import failed: ' + (err?.message || 'could not read file'));
    } finally {
      setIsImportLoading(false);
    }
  };

  const handleImportText = async () => {
    if (rawPastedText.trim().length === 0) return;
    setIsImportLoading(true);
    try {
      setSuccessToast('Detecting sections & extracting data...');
      setImportStyle(undefined);
      const parsed = analyzeResume(linesFromText(rawPastedText));
      setShowImportDialog(false);
      setRawPastedText('');
      setImportPreview(parsed);
    } catch (err: any) {
      console.error(err);
      triggerNotification('Import failed: ' + (err?.message || 'could not parse text'));
    } finally {
      setIsImportLoading(false);
    }
  };

  // Build the editable resume + auto-create a reusable custom template.
  const handleConfirmImport = (finalParsed: ParsedResume) => {
    try {
      const resume = buildImportedResume(finalParsed, activeResume?.language || 'en', importStyle);
      store.addImportedResume(resume);
      // Register a reusable preset named after the candidate and link the resume
      // to it (so it shows as the active design). Dedupes by name on re-import.
      try {
        const tpl = store.saveCurrentAsTemplate(finalParsed.resumeName);
        if (tpl) store.applyCustomTemplate(tpl.id);
      } catch { /* non-fatal */ }
      setImportPreview(null);
      setActiveTab('editor');
      triggerNotification(`Created "${resume.title}" — fully editable!`);
    } catch (err: any) {
      console.error(err);
      triggerNotification('Could not build resume: ' + (err?.message || 'unknown error'));
    }
  };

  const triggerNotification = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(''), 3500);
  };

  const loadDefaults = () => {
    if (resetConfirm) {
      store.clearAllData();
      triggerNotification('Draft reset to baseline demo data.');
      setResetConfirm(false);
    } else {
      setResetConfirm(true);
      setTimeout(() => setResetConfirm(false), 4000);
    }
  };

  // Filter templates list based on search term
  const filteredTemplates = TEMPLATE_DEFINITIONS.filter(t =>
    t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="app-shell min-h-screen text-slate-800 flex flex-col font-display select-none antialiased">
      {/* Animated ambient sunset backdrop */}
      <div className="aurora-blob aurora-blob-1 no-print" aria-hidden />
      <div className="aurora-blob aurora-blob-2 no-print" aria-hidden />
      <div className="aurora-blob aurora-blob-3 no-print" aria-hidden />
      <div className="app-grid no-print" aria-hidden />

      {/* Toast notifications */}
      {successToast && (
        <div className="fixed top-5 right-5 z-50 glass text-slate-800 px-4 py-3 rounded-2xl flex items-center space-x-2 text-xs font-semibold animate-float-up no-print">
          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-sunset text-white shrink-0">
            <Sparkles size={12} />
          </span>
          <span>{successToast}</span>
        </div>
      )}

      {/* Top Application Ribbon */}
      <header className="relative z-40 h-16 glass-header flex items-center justify-between px-6 sticky top-0 no-print shrink-0">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-sunset rounded-xl flex items-center justify-center text-white font-black text-lg glow-sunset">
              R
            </div>
            <div className="flex flex-col">
              <span className="font-extrabold text-base text-slate-900 tracking-tight leading-none flex items-center gap-1.5">
                Resumify<span className="text-gradient">.io</span>
                <span className="text-[9px] bg-blue-50 text-blue-600 font-bold px-1.5 py-0.5 rounded-full font-mono uppercase border border-blue-100">Local Cloud</span>
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5 font-medium leading-none">SaaS Workspace Builder v1.0</span>
              <span className="text-[9px] text-slate-400 mt-1 font-medium leading-none">
                Developed by <span className="font-bold text-slate-600">Vishal Tyagi</span>
                <a href="mailto:vishaltyagi349@gmail.com" className="hidden sm:inline text-blue-600 hover:underline"> · vishaltyagi349@gmail.com</a>
              </span>
            </div>
          </div>
        </div>

        {/* Global Toolbar and Actions */}
        <div className="flex items-center gap-2 sm:gap-4">
          {/* Quick Undo / Redo triggers */}
          <div className="flex items-center bg-white/60 rounded-lg p-0.5 border border-blue-100/70">
            <button
              disabled={storeState.past.length === 0}
              onClick={() => store.undo()}
              className="p-1.5 text-slate-500 hover:bg-white hover:text-violet-600 rounded-md disabled:opacity-20 transition-all cursor-pointer"
              title="Undo Action"
            >
              <RotateCcw size={13} />
            </button>
            <button
              disabled={storeState.future.length === 0}
              onClick={() => store.redo()}
              className="p-1.5 text-slate-500 hover:bg-white hover:text-violet-600 rounded-md disabled:opacity-20 transition-all cursor-pointer"
              title="Redo Action"
            >
              <RotateCw size={13} />
            </button>
          </div>

          <button
            onClick={() => setShowImportDialog(true)}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-white border border-violet-200 text-violet-700 hover:bg-violet-50 hover:border-violet-300 rounded-lg text-xxs font-bold transition-all cursor-pointer animate-pulse-subtle"
          >
            <Upload size={11} />
            Upload Resume
          </button>

          <button
            onClick={loadDefaults}
            className={`hidden sm:block text-xxs font-bold cursor-pointer px-2 py-1 rounded transition-all ${
              resetConfirm
                ? 'bg-red-500 text-white animate-pulse shadow-sm'
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            {resetConfirm ? 'Click again to confirm Reset!' : 'Reset Draft'}
          </button>

          <div className="hidden sm:block h-6 w-px bg-blue-100 mx-1" />

          {/* Autosaved Badge from design */}
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-full border border-emerald-100 select-none">
            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
            Autosaved
          </div>

          {/* Compact ATS Score indicator — lives in the ribbon so it never overlaps the resume */}
          {atsResult && (
            <div
              className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-white/70 rounded-full border border-blue-100 select-none"
              title={`ATS Score: ${atsResult.score}% — ${atsResult.grade}`}
            >
              <div className="relative w-6 h-6 shrink-0">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" stroke="#f1e6ec" strokeWidth="3" fill="none" />
                  <circle
                    cx="12" cy="12" r="10"
                    stroke={atsResult.score > 75 ? '#059669' : atsResult.score > 50 ? '#f59e0b' : '#ef4444'}
                    strokeWidth="3" fill="none"
                    strokeDasharray="62.8"
                    strokeDashoffset={62.8 - (62.8 * atsResult.score) / 100}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center text-[8px] font-extrabold text-slate-700">
                  {atsResult.score}
                </div>
              </div>
              <div className="flex flex-col leading-none">
                <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">ATS</span>
                <span className={`text-[10px] font-extrabold leading-tight ${
                  atsResult.score > 75 ? 'text-emerald-600' : atsResult.score > 50 ? 'text-amber-500' : 'text-blue-500'
                }`}>{atsResult.grade}</span>
              </div>
            </div>
          )}

          <ShinyButton
            onClick={handleExportPDFClick}
            label={(
              <>
                <span className="hidden sm:inline">Download / Export PDF</span>
                <span className="sm:hidden">Export PDF</span>
              </>
            )}
          />
        </div>
      </header>

      {/* Main Workspace Frame */}
      <main className="relative z-10 flex-1 max-w-8xl mx-auto w-full flex flex-col md:flex-row min-h-0">

        {/* DESKTOP WORKSPACE (Visible only on lg viewports) */}
        <div className="hidden md:flex flex-1 w-full min-h-0">

          {/* Left panel tabs sidebar selector */}
          <div className="w-24 shrink-0 flex flex-col items-center justify-between py-6 gap-6 border-r border-blue-100/70 no-print panel-glass z-10">
            <div className="flex flex-col gap-3 w-full px-2">
              {[
                { id: 'editor', icon: FileText, label: 'Form Builder' },
                { id: 'templates', icon: LayoutGrid, label: '25 Presets' },
                { id: 'customize', icon: Sliders, label: 'Visual Custom' },
                { id: 'sections', icon: Settings, label: 'Section Manager' },
                { id: 'portfolio', icon: Globe, label: 'Portfolio Site' },
                { id: 'history', icon: History, label: 'Documents' },
                { id: 'dashboard', icon: Award, label: 'ATS & Storage' },
              ].map((tb) => {
                const isSel = activeTab === tb.id;
                return (
                  <button
                    key={tb.id}
                    onClick={() => setActiveTab(tb.id as any)}
                    title={tb.label}
                    className={`px-1.5 py-2.5 rounded-xl flex flex-col items-center gap-1 group transition-all relative cursor-pointer ${
                      isSel
                        ? 'bg-sunset text-white glow-sunset'
                        : 'text-slate-400 hover:text-violet-600 hover:bg-violet-50/70'
                    }`}
                  >
                    <tb.icon size={16} className="shrink-0" />
                    <span className="text-[9.5px] font-bold block tracking-tight leading-tight mt-1 text-center select-none w-full break-words">
                      {tb.label}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Shield disclaimer */}
            <div className="p-2 text-center text-xxxxs text-slate-400 font-mono flex flex-col items-center gap-1">
              <Shield size={14} className="text-violet-500" />
              <span>SECURE DATA</span>
            </div>
          </div>

          {/* Tab Content Canvas (Middle Drawer, 33% screen width) */}
          <div className="scroll-warm w-[430px] shrink-0 panel-glass overflow-y-auto p-8 space-y-8 flex flex-col h-[calc(100vh-64px)] border-r border-blue-100/70 no-print z-10">

            {/* Dynamic headers per view */}
            <div>
              <h2 className="text-xs uppercase font-extrabold text-gradient font-mono tracking-widest leading-none">
                {activeTab === 'editor' && 'Edit Records'}
                {activeTab === 'templates' && 'Template Registry'}
                {activeTab === 'customize' && 'Style Calibration'}
                {activeTab === 'sections' && 'Modules Sequence'}
                {activeTab === 'portfolio' && 'Interactive Portfolios'}
                {activeTab === 'history' && 'Documents Registry'}
                {activeTab === 'dashboard' && 'Analytics metrics'}
              </h2>
              <h3 className="text-base font-bold text-slate-900 mt-1 select-none">
                {activeTab === 'editor' && 'Resume Content Creator'}
                {activeTab === 'templates' && 'Select Dynamic Design'}
                {activeTab === 'customize' && 'Pair Typography, Margins & Colors'}
                {activeTab === 'sections' && 'Reorder Categories'}
                {activeTab === 'portfolio' && 'Web-ready Profile Links'}
                {activeTab === 'history' && 'Draft Versions'}
                {activeTab === 'dashboard' && 'Database backup controls'}
              </h3>
            </div>

            <div className="scroll-warm flex-1 min-h-0 overflow-y-auto -mr-2 pr-2">
              {!activeResume ? (
                <div className="py-12 text-center space-y-2">
                  <p className="text-xs text-slate-400 font-medium font-mono">NO ACTIVE DRAFT DETECTED</p>
                  <button onClick={() => store.createNewResume('Draft')} className="px-4 py-2 bg-sunset text-white rounded-lg text-xxs font-bold glow-sunset">
                    Create New Draft
                  </button>
                </div>
              ) : (
                <>
                  {activeTab === 'editor' && (
                    <ResumeForm resume={activeResume} onUpdate={() => store.updateActiveResume(r => r)} />
                  )}

                  {activeTab === 'templates' && (
                    <div className="space-y-4">
                      {/* Save & reuse custom templates (stored locally) */}
                      <div className="bg-white/70 border border-blue-100 rounded-xl p-3.5 space-y-3 shadow-xxs">
                        <div>
                          <h4 className="text-[10px] font-black text-blue-500 uppercase tracking-widest leading-none">My Templates</h4>
                          <p className="text-[9.5px] text-slate-500 font-medium mt-1">Save your current design (colors, fonts, layout & section options) and reuse it anytime.</p>
                        </div>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="Name this design..."
                            value={newTemplateName}
                            onChange={(e) => setNewTemplateName(e.target.value)}
                            className="flex-1 text-xxs px-3 py-2 bg-white border border-slate-205 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-violet-300 shadow-xxs"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const t = store.saveCurrentAsTemplate(newTemplateName);
                              setNewTemplateName('');
                              if (t) triggerNotification(`Saved design "${t.name}" locally!`);
                            }}
                            title="Save current design as a reusable template"
                            className="px-3 py-2 bg-sunset hover:opacity-90 transition-all text-white rounded-lg text-xxs font-bold flex items-center gap-1 shrink-0 cursor-pointer glow-sunset"
                          >
                            <Plus size={13} />
                            Save
                          </button>
                        </div>

                        {storeState.customTemplates.length > 0 && (
                          <div className="space-y-1.5 pt-1">
                            {storeState.customTemplates.map((ct) => {
                              const isCurrent = activeResume.templateId === ct.id;
                              return (
                                <div
                                  key={ct.id}
                                  className={`flex items-center justify-between gap-2 p-2 rounded-lg border bg-white transition-all ${
                                    isCurrent ? 'border-violet-300 ring-2 ring-violet-100 shadow-xxs' : 'border-slate-100 hover:border-violet-200'
                                  }`}
                                >
                                  <button
                                    type="button"
                                    onClick={() => {
                                      store.applyCustomTemplate(ct.id);
                                      triggerNotification(`Applied your design: ${ct.name}!`);
                                    }}
                                    className="flex items-center gap-2 flex-1 min-w-0 text-left cursor-pointer"
                                    title="Apply this saved design"
                                  >
                                    <span className="w-5 h-5 rounded shrink-0 border border-slate-200" style={{ backgroundColor: ct.styles.primaryColor }} />
                                    <span className="text-xxs font-bold text-slate-800 truncate">{ct.name}</span>
                                    {isCurrent && <span className="text-[8px] bg-violet-100 text-violet-700 font-bold uppercase px-1.5 py-0.5 rounded-full font-mono shrink-0">Active</span>}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => store.deleteCustomTemplate(ct.id)}
                                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-all cursor-pointer shrink-0"
                                    title="Delete saved template"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Search box templates */}
                      <div className="relative">
                        <Search className="absolute left-3 top-2.5 size-3.5 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Search in 25 categories..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="w-full pl-9 pr-4 py-2 text-xxs bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-violet-300 text-slate-700"
                        />
                      </div>

                      <div className="grid grid-cols-1 gap-2.5">
                        {filteredTemplates.map((tpl) => {
                          const isCurrent = activeResume.templateId === tpl.id;
                          return (
                            <button
                              key={tpl.id}
                              onClick={() => {
                                store.setTemplateId(tpl.id);
                                triggerNotification(`Applied design: ${tpl.name}!`);
                              }}
                              className={`p-3.5 rounded-xl border text-left flex gap-3.5 transition-all cursor-pointer ${
                                isCurrent
                                  ? 'border-violet-300 bg-violet-50/70 ring-2 ring-violet-100 shadow-xxs'
                                  : 'border-slate-100 bg-white/70 hover:bg-white hover:border-violet-200'
                              }`}
                            >
                              <div className={`w-8 h-8 rounded-lg ${tpl.thumbnailColor} shrink-0 flex items-center justify-center font-bold text-white text-xxs font-mono uppercase shadow-sm`}>
                                {tpl.category[0]}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-xxs font-bold text-slate-800 leading-none">{tpl.name}</span>
                                  <span className="text-[8px] bg-blue-50 text-blue-500 font-bold uppercase py-0.5 px-1.5 rounded-full font-mono scale-90">
                                    {tpl.category}
                                  </span>
                                </div>
                                <p className="text-xxxxs text-slate-450 leading-snug mt-1.5">{tpl.description}</p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {activeTab === 'customize' && (
                    <ThemeSelector resume={activeResume} onUpdate={() => store.updateActiveResume(r => r)} />
                  )}

                  {activeTab === 'sections' && (
                    <SectionManager resume={activeResume} onUpdate={() => store.updateActiveResume(r => r)} />
                  )}

                  {activeTab === 'portfolio' && (
                    <PortfolioGenerator resume={activeResume} />
                  )}

                  {activeTab === 'history' && (
                    <ResumeHistory
                      resumes={storeState.resumes}
                      activeId={storeState.activeResumeId}
                      onSelect={(id) => store.setActiveResume(id)}
                      onUpdate={() => store.updateActiveResume(r => r)}
                    />
                  )}

                  {activeTab === 'dashboard' && (
                    <StatsDashboard
                      resumes={storeState.resumes}
                      activeResume={activeResume}
                      onRefresh={() => store.updateActiveResume(r => r)}
                    />
                  )}
                </>
              )}
            </div>

          </div>

          {/* Right Panel Canvas (66% screen width) - Sticky Sheet PREVIEW */}
          <div className="scroll-warm flex-1 overflow-y-auto p-12 relative flex flex-col items-center min-h-0 h-[calc(100vh-64px)]">

              {/* Bottom floating control bar pill layout */}
            <div className="absolute bottom-4 sm:bottom-8 left-1/2 -translate-x-1/2 flex items-center glass rounded-full px-5 py-2.5 gap-4 z-20 no-print transition-all">
              <button
                onClick={handleExportPDFClick}
                className="flex items-center gap-1 px-3 py-1.5 bg-sunset text-white rounded-full text-[10px] font-extrabold hover:opacity-90 transition-all cursor-pointer uppercase tracking-wider active:scale-95"
              >
                <Download size={11} />
                Download PDF
              </button>

              <button
                onClick={triggerPrintPDF}
                className="flex items-center gap-1 px-3 py-1.5 bg-slate-900 text-white rounded-full text-[10px] font-extrabold hover:bg-black transition-all cursor-pointer uppercase tracking-wider active:scale-95"
              >
                <Printer size={11} className="text-blue-300" />
                Print Hardcopy
              </button>

              <div className="hidden sm:block w-px h-5 bg-slate-200"></div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => activeResume && saveAsDocx(activeResume)}
                  className="text-[11px] font-bold text-slate-600 hover:text-violet-600 flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <Download size={11} />
                  MS Word
                </button>
                <span className="text-slate-300 text-[10px] select-none">•</span>
                <button
                  onClick={() => activeResume && saveAsTxt(activeResume)}
                  className="text-[11px] font-bold text-slate-600 hover:text-violet-600 flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <FileCode2 size={11} />
                  text
                </button>
              </div>
            </div>

            {/* Printable Preview Container */}
            <div className={`flex-1 w-full overflow-y-auto flex flex-col select-none relative z-10 no-print pb-24 transition-all duration-300 ${isPreviewExpanded ? 'max-w-4xl' : 'max-w-2xl'}`}>
              {activeResume && (
                <div className="bg-white rounded-sm sheet-glow animate-float-up relative">
                  <LivePreview
                    ref={printAreaRef}
                    resume={activeResume}
                    isExpanded={isPreviewExpanded}
                    onToggleExpand={() => setIsPreviewExpanded(prev => !prev)}
                  />
                </div>
              )}
            </div>


          </div>

        </div>

        {/* MOBILE WORKSPACE CONTAINER (Visible only on <= md viewports) */}
        <div className="md:hidden flex-1 flex flex-col min-h-0 select-none pb-20 p-4 space-y-4 no-print">

          {/* Header for status summary */}
          <div className="glass p-3 rounded-2xl flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`text-xxs font-black px-1.5 py-0.5 rounded text-white ${
                (atsResult?.score || 0) > 75 ? 'bg-emerald-500' : 'bg-amber-500'
              }`}>{atsResult?.score}% ATS</span>
              <p className="text-[10px] font-bold text-slate-700 truncate max-w-[150px]">{activeResume?.title}</p>
            </div>
            <span className="text-[10px] font-bold text-violet-700 font-mono uppercase bg-violet-100 px-2 py-0.5 rounded-md leading-none">{mobileTab} view</span>
          </div>

          {/* Sub Panels Router */}
          <div className="scroll-warm flex-1 overflow-y-auto glass p-4 rounded-2xl min-h-[300px]">
            {activeResume ? (
              <>
                {mobileTab === 'edit' && (
                  <ResumeForm resume={activeResume} onUpdate={() => store.updateActiveResume(r => r)} />
                )}

                {mobileTab === 'templates' && (
                  <div className="space-y-4 text-left">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Apply Template Preset</h3>
                    <div className="grid grid-cols-1 gap-2">
                      {TEMPLATE_DEFINITIONS.slice(0, 8).map((tpl) => (
                        <button
                          key={tpl.id}
                          onClick={() => {
                            store.setTemplateId(tpl.id);
                            triggerNotification(`Applied design: ${tpl.name}!`);
                          }}
                          className={`p-3.5 rounded-xl border text-left flex gap-3 transition-all ${
                            activeResume.templateId === tpl.id ? 'border-violet-300 bg-violet-50/70' : 'border-slate-100 bg-white/70 hover:border-violet-200'
                          }`}
                        >
                          <div className={`w-7 h-7 rounded ${tpl.thumbnailColor} shrink-0 shadow-sm`}></div>
                          <div>
                            <p className="text-xxs font-bold text-slate-800 leading-none">{tpl.name}</p>
                            <p className="text-[10px] text-slate-400 mt-1">{tpl.category}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {mobileTab === 'preview' && (
                  <div className="h-full">
                    <div className="bg-white rounded-sm sheet-glow overflow-hidden">
                      <LivePreview resume={activeResume} />
                    </div>
                  </div>
                )}

                {mobileTab === 'download' && (
                  <div className="space-y-4 text-left py-6 select-none">
                    <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider">Download Workspace</h3>
                    <p className="text-xxs text-slate-500 leading-relaxed">
                      All your data owns 100% locally. Use the buttons below to download in standard selectable formats:
                    </p>

                    <div className="space-y-2 mt-4">
                      <button
                        onClick={handleExportPDFClick}
                        className="w-full flex items-center justify-center gap-2 py-3 bg-sunset text-white rounded-xl text-xxs font-bold glow-sunset"
                      >
                        <Sparkles size={14} className="text-yellow-200" />
                        Download Selectable PDF
                      </button>

                      <button
                        onClick={triggerPrintPDF}
                        className="w-full flex items-center justify-center gap-2 py-3 bg-slate-900 text-white rounded-xl text-xxs font-bold hover:bg-black"
                      >
                        <Printer size={14} />
                        Selectable Vector PDF (Print)
                      </button>

                      <button
                        onClick={() => saveAsDocx(activeResume)}
                        className="w-full flex items-center justify-center gap-2 py-3 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xxs font-bold"
                      >
                        Export MS Word (.docx)
                      </button>

                      <button
                        onClick={() => saveAsTxt(activeResume)}
                        className="w-full flex items-center justify-center gap-2 py-3 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xxs font-bold"
                      >
                        Export Plain Text (.txt)
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p className="text-xs text-slate-400">Loading details...</p>
            )}
          </div>

          {/* Bottom Dock Navigation Bar */}
          <div className="fixed bottom-0 left-0 right-0 glass-header px-3 py-2 flex justify-around items-center z-50 no-print">
            {[
              { id: 'edit', label: 'Edit Draft', icon: FileTextIcon },
              { id: 'templates', label: 'Templates', icon: LayoutGrid },
              { id: 'preview', label: 'Preview Live', icon: Eye },
              { id: 'download', label: 'Download', icon: Download },
            ].map((tab) => {
              const isSel = mobileTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setMobileTab(tab.id as any)}
                  className={`flex flex-col items-center gap-1 py-1.5 px-3 rounded-xl transition-all ${
                    isSel ? 'text-white bg-sunset font-bold' : 'text-slate-400'
                  }`}
                >
                  <tab.icon size={16} />
                  <span className="text-[10px] leading-none">{tab.label}</span>
                </button>
              );
            })}
          </div>

        </div>

      </main>

      {/* Raw Text / File Upload Resume Importer Dialog */}
      {/* Smart Import preview — appears after a file/paste is analyzed */}
      {importPreview && (
        <ImportPreview
          parsed={importPreview}
          onCancel={() => setImportPreview(null)}
          onConfirm={handleConfirmImport}
        />
      )}

      {showImportDialog && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in no-print">
          <div className="bg-white border border-blue-100 rounded-2xl max-w-xl w-full p-6 space-y-4 text-left shadow-2xl relative overflow-hidden animate-float-up">
            <div className="flex justify-between items-start border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-black text-blue-500 uppercase font-mono tracking-wider">Smart Resume Import</span>
                <h3 className="text-sm font-bold text-slate-900 mt-0.5">Upload PDF / Word — auto-build a custom resume</h3>
              </div>
              <button
                onClick={() => !isImportLoading && setShowImportDialog(false)}
                disabled={isImportLoading}
                className="p-1 px-2.5 bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-800 rounded-lg text-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
            </div>

            {isImportLoading ? (
              <div className="py-12 flex flex-col items-center justify-center gap-4 text-center">
                <div className="w-12 h-12 rounded-full border-4 border-blue-100 border-t-violet-500 animate-spin" />
                <div className="space-y-1.5 max-w-sm">
                  <p className="text-xs font-black text-slate-800 animate-pulse">Running Local PDF / DOCX Parser...</p>
                  <p className="text-[9.5px] text-slate-450 leading-relaxed">
                    Reading file components, mapping raw text with deterministic pattern clustering, and auto-populating sections directly inside your browser.
                  </p>
                </div>
              </div>
            ) : (
              <div
                className={`space-y-4 font-display rounded-xl transition-all ${dragActive ? 'ring-2 ring-violet-400 ring-offset-2' : ''}`}
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); if (!dragActive) setDragActive(true); }}
                onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setDragActive(true); }}
                onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setDragActive(false); }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setDragActive(false);
                  const f = e.dataTransfer?.files?.[0];
                  if (f) handleFileUpload(f);
                }}
              >
                <p className="text-[10px] text-slate-500 font-medium leading-relaxed">
                  Click a card below to choose your resume file, or <span className="font-bold text-violet-600">drag &amp; drop</span> a PDF / Word file anywhere in this box. Everything is parsed locally in your browser.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Option 1: PDF — the real <input> overlays the whole card so a click always opens the picker */}
                  <label className="relative border border-slate-200 bg-white hover:border-red-400 hover:bg-red-50/40 rounded-xl p-5 text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-3 group shadow-xxs hover:shadow-md">
                    <input
                      type="file"
                      accept=".pdf,application/pdf"
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                      onClick={(e) => { (e.currentTarget as HTMLInputElement).value = ''; }}
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          handleFileUpload(e.target.files[0]);
                        }
                      }}
                    />
                    <div className="w-12 h-12 rounded-full bg-red-50 group-hover:bg-red-100 flex items-center justify-center text-red-500 transition-colors">
                      <FileText size={24} />
                    </div>
                    <div className="space-y-0.5">
                      <h4 className="text-xs font-bold text-slate-800">1. Upload PDF</h4>
                      <p className="text-[9.5px] text-slate-400 leading-normal max-w-[170px] mx-auto">
                        Extract instantly from vector or scanned PDF files
                      </p>
                    </div>
                    <span className="text-[8px] font-bold py-0.5 px-2 bg-red-50 text-red-600 rounded-full font-mono">
                      PDF Document
                    </span>
                  </label>

                  {/* Option 2: Word Doc — real <input> overlays the whole card */}
                  <label className="relative border border-slate-200 bg-white hover:border-blue-400 hover:bg-blue-50/40 rounded-xl p-5 text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-3 group shadow-xxs hover:shadow-md">
                    <input
                      type="file"
                      accept=".docx,.doc,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword"
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                      onClick={(e) => { (e.currentTarget as HTMLInputElement).value = ''; }}
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          handleFileUpload(e.target.files[0]);
                        }
                      }}
                    />
                    <div className="w-12 h-12 rounded-full bg-blue-50 group-hover:bg-blue-100 flex items-center justify-center text-blue-600 transition-colors">
                      <FileSpreadsheet size={24} />
                    </div>
                    <div className="space-y-0.5">
                      <h4 className="text-xs font-bold text-slate-800">2. Upload Word Document</h4>
                      <p className="text-[9.5px] text-slate-400 leading-normal max-w-[170px] mx-auto">
                        Compatible with standard Microsoft Word documents
                      </p>
                    </div>
                    <span className="text-[8px] font-bold py-0.5 px-2 bg-blue-50 text-blue-700 rounded-full font-mono">
                      .doc / .docx
                    </span>
                  </label>
                </div>

                {/* Alternative paste option toggle */}
                <div className="pt-2 border-t border-slate-100 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[9.5px] font-black text-slate-400 uppercase tracking-wider">Fallback Option</span>
                    <button
                      type="button"
                      onClick={() => setShowPasteField(!showPasteField)}
                      className="text-xxs font-bold text-violet-600 hover:text-violet-800 cursor-pointer hover:underline"
                    >
                      {showPasteField ? 'Hide text block' : 'Or paste raw resume text'}
                    </button>
                  </div>

                  {showPasteField && (
                    <div className="space-y-2 animate-fade-in pt-1">
                      <textarea
                        rows={4}
                        placeholder="Paste raw block text or unformatted lists directly here..."
                        value={rawPastedText}
                        onChange={(e) => setRawPastedText(e.target.value)}
                        className="w-full text-xxs px-3 py-2 bg-slate-50 border border-slate-150 rounded-xl focus:border-violet-400 focus:ring-2 focus:ring-violet-200 focus:outline-hidden font-display leading-relaxed text-slate-700"
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setShowPasteField(false)}
                          className="px-3 py-1 hover:bg-slate-50 text-slate-500 rounded-lg text-xxs font-bold"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleImportText}
                          disabled={rawPastedText.trim().length === 0}
                          className="px-4 py-1.5 bg-sunset hover:opacity-90 disabled:opacity-40 text-white rounded-lg text-xxs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                        >
                          <span>Extract Text Block</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Closing footer */}
                <div className="flex justify-end pt-2 mt-1">
                  <button
                    type="button"
                    onClick={() => setShowImportDialog(false)}
                    className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xxs font-bold cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* High-Fidelity Selectable PDF Export Dialog */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in no-print">
          <div className="bg-white border border-blue-100 rounded-2xl max-w-md w-full p-6 space-y-4 text-left shadow-2xl relative overflow-hidden font-display animate-float-up">
            <div className="flex justify-between items-start border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-sunset flex items-center justify-center text-white shrink-0">
                  <Sparkles size={16} />
                </div>
                <div>
                  <span className="text-[10px] font-black text-blue-500 uppercase font-mono tracking-wider animate-pulse">Vector PDF Exporter</span>
                  <h3 className="text-sm font-bold text-slate-900 mt-0.5">Open App in New Tab</h3>
                </div>
              </div>
              <button
                onClick={() => setShowExportModal(false)}
                className="p-1 px-2.5 bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-800 rounded-lg text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed font-medium">
              Because you are viewing this app within the sandboxed live preview panel, direct printing of selectable vector PDFs is restricted by browser security policies.
            </p>

            <p className="text-xs text-slate-600 leading-relaxed font-medium">
              To download your <strong>flawless, selectable multi-page A4 Vector PDF</strong>, please open the app in a new tab where you can click "Download PDF" and directly save or print it.
            </p>

            <div className="bg-amber-50 border border-amber-200 text-amber-900 p-3.5 rounded-xl space-y-1.5 leading-relaxed font-display font-medium text-[10.5px]">
              <p className="font-bold text-amber-900">💡 Pro Tips inside New Tab Print Preview:</p>
              <p>1. Ensure destination is set to <strong>"Save as PDF"</strong></p>
              <p>2. Toggle <strong>"Background graphics"</strong> to ENABLED</p>
              <p>3. Toggle <strong>"Headers and footers"</strong> to DISABLED</p>
            </div>

            <div className="pt-2 flex flex-col gap-2">
              <a
                href={typeof window !== 'undefined' ? window.location.href : '#'}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setShowExportModal(false)}
                className="inline-flex w-full items-center justify-center gap-2 py-3 bg-sunset hover:opacity-90 text-white font-black text-[11px] uppercase tracking-wider rounded-xl transition-all glow-sunset active:scale-95 text-center"
              >
                <span>Open App in New Tab ↗</span>
              </a>
              <button
                type="button"
                onClick={() => setShowExportModal(false)}
                className="w-full py-2.5 hover:bg-slate-50 text-slate-500 rounded-xl text-xxs font-black uppercase cursor-pointer"
              >
                Close Helper Panel
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
