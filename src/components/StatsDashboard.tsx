/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Resume } from '../types';
import { store } from '../store';
import { analyzeResumeATS } from '../atsChecker';
import { FileText, Award, BarChart3, CloudLightning, DownloadCloud, UploadCloud, RefreshCw, Trash2, Heart, CheckCircle2 } from 'lucide-react';

interface StatsDashboardProps {
  resumes: Resume[];
  activeResume: Resume | null;
  onRefresh: () => void;
}

export default function StatsDashboard({ resumes, activeResume, onRefresh }: StatsDashboardProps) {
  const [dragActive, setDragActive] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [bulkConfirm, setBulkConfirm] = useState(false);

  // Stats derivations
  const totalCount = resumes.length;
  const activeFeedback = activeResume ? analyzeResumeATS(activeResume) : null;
  
  const skillCount = activeResume?.sections.find(s => s.type === 'skills')?.items.length || 0;
  const expCount = activeResume?.sections.find(s => s.type === 'experience')?.items.length || 0;
  const projectCount = activeResume?.sections.find(s => s.type === 'projects')?.items.length || 0;

  // Average score across all resumes
  const averageATS = resumes.length > 0
    ? Math.round(resumes.reduce((sum, res) => sum + analyzeResumeATS(res).score, 0) / resumes.length)
    : 0;

  // Export all database
  const exportAllJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(resumes));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `resume_database_backup_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showToast('Full backup downloaded successfully!');
  };

  const showToast = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  // Restore database
  const handleJSONUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].id && parsed[0].sections) {
          store.restoreBackup(parsed, parsed[0].id);
          onRefresh();
          showToast('Database backup restored successfully!');
        } else {
          showToast('⚠️ Invalid file format. Ensure format is backup resume JSON.');
        }
      } catch (err) {
        showToast('⚠️ Failed parsing backup JSON.');
      }
    };
    reader.readAsText(file);
  };

  const cleanAllData = () => {
    store.clearAllData();
    onRefresh();
    setBulkConfirm(false);
    showToast('Cleared all storage. Default demo initialized.');
  };

  return (
    <div className="space-y-6" id="stats-dashboard-panel">
      {successMsg && (
        <div className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-4 py-3 rounded-lg flex items-center space-x-2 text-sm justify-center animate-fade-in">
          <CheckCircle2 size={16} className="text-emerald-500" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Main bento stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium uppercase tracking-wider">Created Resumes</span>
            <FileText size={18} />
          </div>
          <div className="mt-2">
            <h4 className="text-2xl font-bold text-slate-800">{totalCount}</h4>
            <p className="text-xxs text-slate-400 mt-1">Stored offline in browser</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium uppercase tracking-wider">Average ATS</span>
            <BarChart3 size={18} />
          </div>
          <div className="mt-2">
            <h4 className={`text-2xl font-bold ${averageATS > 80 ? 'text-teal-600' : 'text-amber-500'}`}>{averageATS}%</h4>
            <p className="text-xxs text-slate-400 mt-1">Cross-resume standard score</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium uppercase tracking-wider">Active Credentials</span>
            <Award size={18} />
          </div>
          <div className="mt-2">
            <h4 className="text-2xl font-bold text-slate-800">{skillCount + expCount}</h4>
            <p className="text-xxs text-slate-400 mt-1">{skillCount} skills & {expCount} positions</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium uppercase tracking-wider">Active Projects</span>
            <CloudLightning size={18} />
          </div>
          <div className="mt-2">
            <h4 className="text-2xl font-bold text-slate-800">{projectCount}</h4>
            <p className="text-xxs text-slate-400 mt-1">Showcased work details</p>
          </div>
        </div>
      </div>

      {/* Backup and storage panel */}
      <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 relative overflow-hidden">
        <div className="relative z-10">
          <h3 className="text-md font-semibold text-slate-800 flex items-center gap-2">
            Local Data Controls
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            We prioritize absolute user privacy. Resume data never touches any external networks; it is cached strictly within local browser storage state. Use tools below to back up or wipe profiles.
          </p>

          <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button
              onClick={exportAllJSON}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 transition-all text-white rounded-lg text-xs font-semibold shadow-xs"
            >
              <DownloadCloud size={15} />
              Backup All JSON DB
            </button>

            <label className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 hover:border-slate-300 transition-all rounded-lg text-xs font-semibold cursor-pointer shadow-xs">
              <UploadCloud size={15} className="text-indigo-600" />
              <span>Restore Backup</span>
              <input
                type="file"
                accept=".json"
                onChange={handleJSONUpload}
                className="hidden"
              />
            </label>

            {bulkConfirm ? (
              <div className="flex gap-1.5 justify-stretch w-full">
                <button
                  onClick={cleanAllData}
                  className="flex-1 px-3 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xxs font-bold"
                >
                  Yes, Wipe Everything
                </button>
                <button
                  onClick={() => setBulkConfirm(false)}
                  className="px-3 py-2.5 bg-slate-200 text-slate-700 rounded-lg text-xxs font-bold"
                >
                  No
                </button>
              </div>
            ) : (
              <button
                onClick={() => setBulkConfirm(true)}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-red-50 text-red-700 border border-red-100 hover:bg-red-100 transition-all rounded-lg text-xs font-semibold"
              >
                <Trash2 size={15} />
                Wipe Local Database
              </button>
            )}
          </div>
        </div>

        {/* Decorative ambient vector */}
        <div className="absolute -bottom-8 -right-8 w-24 h-24 bg-indigo-100/30 rounded-full blur-xl pointer-events-none" />
      </div>
    </div>
  );
}
