/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { store, loadInitialState, DEFAULT_STYLES } from './store';
import { TEMPLATE_DEFINITIONS, COLOR_PRESETS } from './templates';
import { analyzeResumeATS } from './atsChecker';
import { parseRawResumeText } from './importEngine';
import { saveAsDocx, saveAsTxt } from './docxExport';
import { parseFileToText } from './fileParser';
import { TRANSLATIONS } from './translations';

// Components
import { LivePreview } from './components/LivePreview';
import ThemeSelector from './components/ThemeSelector';
import ResumeHistory from './components/ResumeHistory';
import SectionManager from './components/SectionManager';
import StatsDashboard from './components/StatsDashboard';
import PortfolioGenerator from './components/PortfolioGenerator';
import ResumeForm from './components/ResumeForm';

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
  Globe
} from 'lucide-react';

export default function App() {
  const [storeState, setStoreState] = useState(store.getState());
  const [activeTab, setActiveTab] = useState<'editor' | 'templates' | 'customize' | 'sections' | 'portfolio' | 'history' | 'dashboard'>('editor');
  
  // Mobile Navigation states
  const [mobileTab, setMobileTab] = useState<'edit' | 'templates' | 'preview' | 'download'>('edit');
  const [rawPastedText, setRawPastedText] = useState('');
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [successToast, setSuccessToast] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

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

  const handleFileUpload = async (file: File) => {
    setIsImportLoading(true);
    setSuccessToast(`Reading "${file.name}"...`);
    try {
      const extractedText = await parseFileToText(file);
      setSuccessToast('Extracting structured coordinates...');
      
      const parsedResume = parseRawResumeText(extractedText, activeResume?.language || 'en');
      // Update file name as project title
      parsedResume.title = file.name.replace(/\.[^/.]+$/, ""); // Strip extension
      
      store.restoreBackup([...storeState.resumes, parsedResume], parsedResume.id);
      
      setShowImportDialog(false);
      triggerNotification(`Successfully extracted & structured your resume draft from "${file.name}"!`);
    } catch (err: any) {
      console.error(err);
      triggerNotification('Import failed: ' + err.message);
    } finally {
      setIsImportLoading(false);
    }
  };

  const handleImportText = () => {
    if (rawPastedText.trim().length === 0) return;
    const parsed = parseRawResumeText(rawPastedText, activeResume?.language || 'en');
    
    // Set active parsed resume
    store.restoreBackup([...storeState.resumes, parsed], parsed.id);
    setRawPastedText('');
    setShowImportDialog(false);
    triggerNotification('Resume parsed and imported successfully!');
  };

  const triggerNotification = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(''), 3500);
  };

  const loadDefaults = () => {
    if (confirm("Reset current draft? All text will be replaced with clean placeholder sections.")) {
      store.clearAllData();
      triggerNotification('Draft reset to baseline demo data.');
    }
  };

  // Filter templates list based on search term
  const filteredTemplates = TEMPLATE_DEFINITIONS.filter(t =>
    t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#F1F5F9] text-slate-900 flex flex-col font-sans select-none antialiased">
      {/* Toast notifications */}
      {successToast && (
        <div className="fixed top-4 right-4 z-50 bg-slate-900 text-white border border-slate-800 px-4 py-3 rounded-xl shadow-lg flex items-center space-x-2 text-xs font-semibold animate-fade-in no-print">
          <Award size={14} className="text-emerald-400" />
          <span>{successToast}</span>
        </div>
      )}

      {/* Top Application Ribbon */}
      <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 sticky top-0 z-40 no-print shrink-0">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-black text-lg shadow-sm">
              R
            </div>
            <div className="flex flex-col">
              <span className="font-extrabold text-base text-slate-900 tracking-tight leading-none flex items-center gap-1.5">
                Resumify.io
                <span className="text-[9px] bg-indigo-50 text-indigo-700 font-bold px-1.5 py-0.5 rounded-full font-mono uppercase border border-indigo-150">Local Cloud</span>
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5 font-medium leading-none">SaaS Workspace Builder v1.0</span>
            </div>
          </div>
        </div>

        {/* Global Toolbar and Actions */}
        <div className="flex items-center gap-4">
          {/* Quick Undo / Redo triggers */}
          <div className="flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-200/50">
            <button
              disabled={storeState.past.length === 0}
              onClick={() => store.undo()}
              className="p-1.5 text-slate-500 hover:bg-white rounded-md disabled:opacity-20 transition-all cursor-pointer"
              title="Undo Action"
            >
              <RotateCcw size={13} />
            </button>
            <button
              disabled={storeState.future.length === 0}
              onClick={() => store.redo()}
              className="p-1.5 text-slate-500 hover:bg-white rounded-md disabled:opacity-20 transition-all cursor-pointer"
              title="Redo Action"
            >
              <RotateCw size={13} />
            </button>
          </div>

          <button
            onClick={() => setShowImportDialog(true)}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-800 rounded-lg text-xxs font-bold transition-all shadow-xxs cursor-pointer"
          >
            <FileCode2 size={11} />
            Import Raw Resume
          </button>

          <button
            onClick={loadDefaults}
            className="hidden sm:block text-slate-400 hover:text-slate-600 text-xxs font-semibold cursor-pointer"
          >
            Reset Draft
          </button>

          <div className="h-6 w-[1px] bg-slate-200 mx-1" />

          {/* Autosaved Badge from design */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-full border border-emerald-100 select-none shadow-xxs">
            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
            Autosaved
          </div>

          <button
            onClick={handleExportPDFClick}
            className="bg-indigo-600 text-white px-5 py-2.5 rounded-lg font-semibold text-sm shadow-sm hover:bg-indigo-700 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer animate-fade-in"
          >
            <Sparkles size={14} className="text-yellow-300" />
            <span>Download / Export PDF</span>
          </button>
        </div>
      </header>

      {/* Main Workspace Frame */}
      <main className="flex-1 max-w-8xl mx-auto w-full flex flex-col md:flex-row min-h-0 relative">
        
        {/* DESKTOP WORKSPACE (Visible only on lg viewports) */}
        <div className="hidden md:flex flex-1 w-full min-h-0 divide-x divide-slate-200">
          
          {/* Left panel tabs sidebar selector */}
          <div className="w-16 bg-white shrink-0 flex flex-col items-center justify-between py-6 gap-6 border-r border-slate-200 no-print shadow-xs z-10">
            <div className="flex flex-col gap-4 w-full px-2.5">
              {[
                { id: 'editor', icon: FileText, label: 'Form Builder' },
                { id: 'templates', icon: LayoutGrid, label: '25 Presets' },
                { id: 'customize', icon: Sliders, label: 'Visual Custom' },
                { id: 'sections', icon: Settings, label: 'Section Manager' },
                { id: 'portfolio', icon: Globe, label: 'Portfolio site' },
                { id: 'history', icon: History, label: 'Documents' },
                { id: 'dashboard', icon: Award, label: 'ATS & Storage' },
              ].map((tb) => {
                const isSel = activeTab === tb.id;
                return (
                  <button
                    key={tb.id}
                    onClick={() => setActiveTab(tb.id as any)}
                    className={`p-3 rounded-xl flex flex-col items-center gap-1 group transition-all relative ${
                      isSel
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100'
                        : 'text-slate-400 hover:text-slate-800 hover:bg-slate-100/50'
                    }`}
                  >
                    <tb.icon size={16} />
                    <span className="text-[9px] font-bold block scale-90 tracking-tight leading-none mt-1 text-center select-none truncate w-14">
                      {tb.label}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Shield disclaimer */}
            <div className="p-2 text-center text-xxxxs opacity-40 font-mono flex flex-col items-center gap-1">
              <Shield size={14} className="text-indigo-600" />
              <span>SECURE DATA</span>
            </div>
          </div>

          {/* Tab Content Canvas (Middle Drawer, 33% screen width) */}
          <div className="w-[430px] shrink-0 bg-white overflow-y-auto p-8 space-y-8 flex flex-col h-[calc(100vh-64px)] border-slate-200 border-r no-print shadow-xs z-10">
            
            {/* Dynamic headers per view */}
            <div>
              <h2 className="text-xs uppercase font-extrabold text-slate-400 font-mono tracking-widest leading-none">
                {activeTab === 'editor' && 'Edit Records'}
                {activeTab === 'templates' && 'Template Registry'}
                {activeTab === 'customize' && 'Style Calibration'}
                {activeTab === 'sections' && 'Modules Sequence'}
                {activeTab === 'portfolio' && 'Interactive Portfolios'}
                {activeTab === 'history' && 'Documents Registry'}
                {activeTab === 'dashboard' && 'Analytics metrics'}
              </h2>
              <h3 className="text-base font-bold text-slate-850 mt-1 select-none">
                {activeTab === 'editor' && 'Resume Content Creator'}
                {activeTab === 'templates' && 'Select Dynamic Design'}
                {activeTab === 'customize' && 'Pair Typography, Margins & Colors'}
                {activeTab === 'sections' && 'Reorder Categories'}
                {activeTab === 'portfolio' && 'Web-ready Profile Links'}
                {activeTab === 'history' && 'Draft Versions'}
                {activeTab === 'dashboard' && 'Database backup controls'}
              </h3>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto">
              {!activeResume ? (
                <div className="py-12 text-center space-y-2">
                  <p className="text-xs text-slate-400 font-medium font-mono">NO ACTIVE DRAFT DETECTED</p>
                  <button onClick={() => store.createNewResume('Draft')} className="px-4 py-2 bg-indigo-650 text-white rounded-lg text-xxs font-bold">
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
                      {/* Search box templates */}
                      <div className="relative">
                        <Search className="absolute left-3 top-2.5 size-3.5 text-slate-405" />
                        <input
                          type="text"
                          placeholder="Search in 25 categories..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="w-full pl-9 pr-4 py-2 text-xxs bg-slate-50 border rounded-lg focus:outline-hidden text-slate-700"
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
                                  ? 'border-indigo-600 bg-indigo-50/15 shadow-xxs'
                                  : 'border-slate-100 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-205'
                              }`}
                            >
                              <div className={`w-8 h-8 rounded-lg ${tpl.thumbnailColor} shrink-0 flex items-center justify-center font-bold text-white text-xxs font-mono uppercase`}>
                                {tpl.category[0]}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-xxs font-bold text-slate-800 leading-none">{tpl.name}</span>
                                  <span className="text-[8px] bg-slate-150 text-slate-505 font-bold uppercase py-0.5 px-1.5 rounded-full font-mono scale-90">
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
          <div className="flex-1 bg-slate-100 overflow-y-auto p-12 relative flex flex-col items-center min-h-0 h-[calc(100vh-64px)]">
            
            {/* Top right floating ATS Gauge Card */}
            <div className="absolute top-8 right-8 w-32 bg-white rounded-2xl shadow-lg border border-slate-200 p-4 text-center space-y-2 z-20 no-print animate-fade-in hover:shadow-xl transition-all">
              <div className="relative w-14 h-14 mx-auto">
                <svg className="w-full h-full transform -rotate-90">
                  <circle cx="28" cy="28" r="24" stroke="#f1f5f9" strokeWidth="5" fill="none"/>
                  <circle 
                    cx="28" 
                    cy="28" 
                    r="24" 
                    stroke={(atsResult?.score || 0) > 75 ? '#0d9488' : (atsResult?.score || 0) > 50 ? '#f59e0b' : '#ef4444'}
                    strokeWidth="5" 
                    fill="none" 
                    strokeDasharray="150.8" 
                    strokeDashoffset={150.8 - (150.8 * (atsResult?.score || 0)) / 100}
                    className="transition-all duration-500"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center font-extrabold text-xs text-slate-800">
                  {atsResult?.score || 0}%
                </div>
              </div>
              <div>
                <div className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest leading-none">ATS SCORE</div>
                <div className={`text-[10px] font-extrabold mt-1 leading-none ${
                  (atsResult?.score || 0) > 75 ? 'text-teal-600' : (atsResult?.score || 0) > 50 ? 'text-amber-500' : 'text-red-500'
                }`}>
                  {atsResult?.grade}
                </div>
              </div>
            </div>

            {/* Bottom floating control bar pill layout */}
            <div className="absolute bottom-4 sm:bottom-8 left-1/2 -translate-x-1/2 flex items-center bg-white/95 backdrop-blur-md shadow-xl rounded-full px-5 py-2.5 border border-slate-200 gap-4 z-20 no-print hover:bg-white transition-all">
              <button
                onClick={handleExportPDFClick}
                className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white rounded-full text-[10px] font-extrabold hover:bg-indigo-750 transition-all cursor-pointer uppercase tracking-wider"
              >
                <Download size={11} />
                Download PDF
              </button>

              <button
                onClick={triggerPrintPDF}
                className="flex items-center gap-1 px-3 py-1.5 bg-slate-900 text-white rounded-full text-[10px] font-extrabold hover:bg-black transition-all cursor-pointer uppercase tracking-wider"
              >
                <Printer size={11} className="text-indigo-400" />
                Print Hardcopy
              </button>

              <div className="hidden sm:block w-px h-5 bg-slate-250"></div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => activeResume && saveAsDocx(activeResume)}
                  className="text-[11px] font-heavy text-slate-655 hover:text-indigo-600 flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <Download size={11} />
                  MS Word
                </button>
                <span className="text-slate-300 text-[10px] select-none">•</span>
                <button
                  onClick={() => activeResume && saveAsTxt(activeResume)}
                  className="text-[11px] font-heavy text-slate-655 hover:text-indigo-600 flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <FileCode2 size={11} />
                  text
                </button>
              </div>
            </div>

            {/* Printable Preview Container */}
            <div className="flex-1 w-full max-w-2xl overflow-y-auto flex flex-col select-none relative z-10 no-print pb-24">
              {activeResume && (
                <div className="bg-white rounded-none shadow-2xl border border-slate-200/80 animate-fade-in relative">
                  <LivePreview
                    ref={printAreaRef}
                    resume={activeResume}
                  />
                </div>
              )}
            </div>


          </div>

        </div>

        {/* MOBILE WORKSPACE CONTAINER (Visible only on <= md viewports) */}
        <div className="md:hidden flex-1 flex flex-col min-h-0 select-none pb-20 p-4 space-y-4 no-print">
          
          {/* Header for status summary */}
          <div className="bg-white p-3 rounded-xl border border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`text-xxs font-black px-1.5 py-0.5 rounded text-white ${
                (atsResult?.score || 0) > 75 ? 'bg-teal-600' : 'bg-amber-500'
              }`}>{atsResult?.score}% ATS</span>
              <p className="text-[10px] font-bold text-slate-700 truncate max-w-[150px]">{activeResume?.title}</p>
            </div>
            <span className="text-[10px] font-bold text-indigo-655 font-mono uppercase bg-indigo-50 px-2 py-0.5 rounded-md leading-none">{mobileTab} view</span>
          </div>

          {/* Sub Panels Router */}
          <div className="flex-1 overflow-y-auto bg-white p-4 rounded-xl border border-slate-150 min-h-[300px]">
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
                            activeResume.templateId === tpl.id ? 'border-indigo-650 bg-indigo-50/10' : 'border-slate-100 hover:border-slate-205'
                          }`}
                        >
                          <div className={`w-7 h-7 rounded ${tpl.thumbnailColor} shrink-0`}></div>
                          <div>
                            <p className="text-xxs font-bold text-slate-805 leading-none">{tpl.name}</p>
                            <p className="text-[10px] text-slate-400 mt-1">{tpl.category}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {mobileTab === 'preview' && (
                  <div className="h-full">
                    <LivePreview resume={activeResume} />
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
                        className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 text-white rounded-xl text-xxs font-bold hover:bg-indigo-700"
                      >
                        <Sparkles size={14} className="text-yellow-300" />
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
                        className="w-full flex items-center justify-center gap-2 py-3 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xxs font-bold"
                      >
                        Export MS Word (.docx)
                      </button>

                      <button
                        onClick={() => saveAsTxt(activeResume)}
                        className="w-full flex items-center justify-center gap-2 py-3 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xxs font-bold"
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
          <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 px-3 py-2 flex justify-around items-center z-50 shadow-lg no-print">
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
                    isSel ? 'text-indigo-650 font-bold bg-indigo-50/30' : 'text-slate-400'
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
      {showImportDialog && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in no-print">
          <div className="bg-white border rounded-2xl max-w-xl w-full p-6 space-y-4 text-left shadow-2xl relative overflow-hidden">
            <div className="flex justify-between items-start border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-black text-indigo-650 uppercase font-mono tracking-wider">Universal Resume Importer</span>
                <h3 className="text-sm font-bold text-slate-800 mt-0.5">Import Existing PDF, DOCX or Paste Text</h3>
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
                <div className="w-12 h-12 rounded-full border-4 border-indigo-100 border-t-indigo-600 animate-spin" />
                <div className="space-y-1 max-w-xs">
                  <p className="text-xs font-black text-slate-800 animate-pulse">Running Dynamic OCR Parser...</p>
                  <p className="text-[9.5px] text-slate-450 leading-relaxed">
                    Executing local extraction engine and NLP clustering algorithms. This process happens 100% client-side for maximum visual data protection.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4 font-sans">
                {/* 1. Drag & Drop File Upload Area */}
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                  onDragLeave={() => setDragActive(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragActive(false);
                    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                      handleFileUpload(e.dataTransfer.files[0]);
                    }
                  }}
                  onClick={() => document.getElementById('resume-file-selector')?.click()}
                  className={`border-2 border-dashed rounded-xl p-5 text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-2 ${
                    dragActive
                      ? 'border-indigo-600 bg-indigo-50/20 shadow-inner'
                      : 'border-slate-200 bg-slate-50 hover:bg-slate-50/85 hover:border-indigo-300'
                  }`}
                >
                  <input
                    id="resume-file-selector"
                    type="file"
                    accept=".pdf,.docx,.txt"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleFileUpload(e.target.files[0]);
                      }
                    }}
                  />
                  <div className="w-9 h-9 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600">
                    <Download size={16} className="animate-bounce" />
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-xxs font-black text-slate-800">
                      Drag and drop your file here, or <span className="text-indigo-650 underline">browse files</span>
                    </p>
                    <p className="text-[9.5px] text-slate-400">
                      Supports high-resolution Vector PDF, MS Word (.docx), or plain text (.txt)
                    </p>
                  </div>
                </div>

                {/* Aesthetic Section Separator */}
                <div className="relative flex items-center justify-center py-1">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-100"></div>
                  </div>
                  <span className="relative bg-white px-3 text-[9px] font-black uppercase text-slate-400 tracking-widest leading-none">
                    OR PASTE RAW TEXT DETAILS
                  </span>
                </div>

                {/* 2. Plain Textarea Paste Box */}
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-slate-400 leading-none">Draft Text Box</label>
                  <textarea
                    rows={5}
                    placeholder="Alternatively, copy and paste raw text contents, bullet points, or list formatting variables directly here..."
                    value={rawPastedText}
                    onChange={(e) => setRawPastedText(e.target.value)}
                    className="w-full text-xxs px-3 py-2 bg-slate-50 border border-slate-150 rounded-xl focus:border-indigo-400 focus:outline-hidden font-sans leading-relaxed text-slate-700"
                  />
                </div>

                {/* Dialog Control Toolbar */}
                <div className="flex justify-end gap-2 border-t border-slate-100 pt-3 mt-1">
                  <button
                    type="button"
                    onClick={() => setShowImportDialog(false)}
                    className="px-3 py-1.5 hover:bg-slate-50 text-slate-655 rounded-lg text-xxs font-bold cursor-pointer"
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    onClick={handleImportText}
                    disabled={rawPastedText.trim().length === 0}
                    className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-750 disabled:opacity-40 text-white rounded-lg text-xxs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <span>Extract Paste</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* High-Fidelity Selectable PDF Export Dialog */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in no-print">
          <div className="bg-white border border-slate-150 rounded-2xl max-w-md w-full p-6 space-y-4 text-left shadow-2xl relative overflow-hidden font-sans">
            <div className="flex justify-between items-start border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-650 shrink-0">
                  <Sparkles size={16} />
                </div>
                <div>
                  <span className="text-[10px] font-black text-indigo-650 uppercase font-mono tracking-wider animate-pulse font-bold">Vector PDF Exporter</span>
                  <h3 className="text-sm font-bold text-slate-805 mt-0.5">Open App in New Tab</h3>
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

            <div className="bg-amber-550/10 border border-amber-300 text-amber-900 p-3.5 rounded-xl space-y-1.5 leading-relaxed font-sans font-medium text-[10.5px]">
              <p className="font-bold text-amber-950">💡 Pro Tips inside New Tab Print Preview:</p>
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
                className="inline-flex w-full items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[11px] uppercase tracking-wider rounded-xl transition-all shadow-md active:scale-95 text-center"
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
