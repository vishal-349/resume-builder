/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Bring-your-own-key entry.
 *
 * Shown when no key is configured at build time, so a deployed static build
 * still works without a rebuild. The key is held in localStorage on this device
 * and sent only to the AI provider.
 */

import React, { useState } from 'react';
import { ExternalLink, Eye, EyeOff, KeyRound, ShieldCheck, TerminalSquare } from 'lucide-react';
import { getAIBuildInfo, getStoredApiKey, setStoredApiKey } from '../../services/import';

interface Props {
  onSaved: () => void;
  onCancel?: () => void;
}

export default function ApiKeyGate({ onSaved, onCancel }: Props) {
  const [key, setKey] = useState(getStoredApiKey());
  const [reveal, setReveal] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const build = getAIBuildInfo();

  const save = () => {
    if (!key.trim()) return;
    setStoredApiKey(key);
    onSaved();
  };

  return (
    <div className="py-2 space-y-4 animate-fade-in">
      <div className="flex gap-3 p-4 bg-violet-50/60 border border-violet-100 rounded-xl">
        <div className="w-9 h-9 shrink-0 rounded-full bg-violet-100 flex items-center justify-center text-violet-600">
          <KeyRound size={17} />
        </div>
        <div className="space-y-1 min-w-0">
          <h4 className="text-xs font-bold text-slate-900">Connect an AI key to import resumes</h4>
          <p className="text-[10.5px] text-slate-600 leading-relaxed">
            Resume import reads your document with Google Gemini. Paste a free API key to enable it — it is stored
            only in this browser and sent only to Google.
          </p>
          <a
            href="https://aistudio.google.com/apikey"
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-1 text-[10px] font-bold text-violet-700 hover:text-violet-900 hover:underline"
          >
            Get a free key at Google AI Studio <ExternalLink size={10} />
          </a>
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Gemini API key</label>
        <div className="relative">
          <input
            type={reveal ? 'text' : 'password'}
            value={key}
            autoComplete="off"
            spellCheck={false}
            placeholder="AIza…"
            onChange={(e) => setKey(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && save()}
            className="w-full text-xs font-mono px-3.5 py-2.5 pr-10 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-violet-300 focus:bg-white transition-all"
          />
          <button
            type="button"
            onClick={() => setReveal(!reveal)}
            title={reveal ? 'Hide key' : 'Show key'}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-700 rounded-md cursor-pointer"
          >
            {reveal ? <EyeOff size={13} /> : <Eye size={13} />}
          </button>
        </div>
        <p className="flex items-start gap-1.5 text-[9.5px] text-slate-400 leading-relaxed pt-0.5">
          <ShieldCheck size={11} className="shrink-0 mt-px" />
          <span>
            For a shared deployment, set <code className="font-mono text-slate-500">VITE_AI_PROXY_URL</code> instead so
            the key lives on your server rather than in the browser.
          </span>
        </p>
      </div>

      {/* Build diagnostics.
          VITE_* variables are baked in at build time, so one added to the host
          dashboard after the last build is simply absent — and without this the
          only symptom is this dialog appearing for no visible reason. */}
      <div className="space-y-1.5 pt-1 border-t border-slate-100">
        <button
          type="button"
          onClick={() => setShowDiagnostics(!showDiagnostics)}
          className="flex items-center gap-1.5 text-[9.5px] font-bold text-slate-400 hover:text-slate-600 uppercase tracking-wide cursor-pointer transition-colors"
        >
          <TerminalSquare size={11} />
          Expected a proxy? Check what this build received
        </button>

        {showDiagnostics && (
          <div className="space-y-2 animate-fade-in">
            <div className="text-[9.5px] font-mono bg-slate-50 border border-slate-100 rounded-lg p-2.5 space-y-0.5 text-slate-600">
              <div>
                VITE_AI_PROXY_URL ={' '}
                <span className={build.hasProxyUrl ? 'text-emerald-600 font-bold' : 'text-red-600 font-bold'}>
                  {build.hasProxyUrl ? build.proxyUrl : 'not set in this build'}
                </span>
              </div>
              <div>
                VITE_GEMINI_API_KEY ={' '}
                <span className={build.hasBuildKey ? 'text-emerald-600 font-bold' : 'text-slate-400'}>
                  {build.hasBuildKey ? 'set' : 'not set'}
                </span>
              </div>
              <div>
                VITE_* names compiled in ={' '}
                <span className="text-slate-500">
                  {build.viteKeysInBuild.length ? build.viteKeysInBuild.join(', ') : 'none'}
                </span>
              </div>
            </div>

            {!build.hasProxyUrl && (
              <p className="text-[9.5px] text-amber-800 bg-amber-50/70 border border-amber-200 rounded-lg p-2.5 leading-relaxed">
                <strong>This build was compiled without a proxy URL.</strong> Because Vite bakes{' '}
                <code className="font-mono">VITE_*</code> values in at build time, adding the variable to your hosting
                dashboard only takes effect on the <em>next</em> build — and a redeploy that reuses the build cache will
                not pick it up. Redeploy with the cache disabled, and make sure the variable is enabled for this
                environment (Preview and Production are configured separately).
              </p>
            )}
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xxs font-bold cursor-pointer"
          >
            Cancel
          </button>
        )}
        <button
          type="button"
          onClick={save}
          disabled={!key.trim()}
          className="px-4 py-2 bg-sunset hover:opacity-90 disabled:opacity-40 text-white rounded-lg text-xxs font-bold cursor-pointer transition-opacity"
        >
          Save key &amp; continue
        </button>
      </div>
    </div>
  );
}
