/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Single source of truth for AI configuration.
 *
 * This is the file you edit to move off a browser-held key: set
 * `VITE_AI_PROXY_URL` and the whole app routes through a backend instead, with
 * no changes anywhere else.
 */

/** Where the browser sends AI requests. */
export type AIMode = 'direct' | 'proxy';

export interface AIConfig {
  mode: AIMode;
  /** Only populated in 'direct' mode. Never sent anywhere but the provider. */
  apiKey: string;
  model: string;
  /** Only populated in 'proxy' mode. */
  proxyUrl: string;
  requestTimeoutMs: number;
  maxRetries: number;
  maxFileBytes: number;
  /** Guards against pathological page counts running up token cost. */
  maxPdfPages: number;
}

/** localStorage key for a user-supplied ("bring your own") API key. */
const BYOK_STORAGE_KEY = 'resume_builder_ai_key';

/**
 * Rolling alias rather than a pinned version.
 *
 * Google retires older model ids for new API keys — `gemini-2.5-flash` already
 * returns 404 ("no longer available to new users") on keys issued recently.
 * The alias always resolves to the current Flash model, so a fresh key works
 * without a code change. Pin a specific version with VITE_GEMINI_MODEL when you
 * need reproducibility.
 */
export const DEFAULT_MODEL = 'gemini-flash-latest';

const DEFAULTS = {
  requestTimeoutMs: 90_000,
  maxRetries: 2,
  maxFileBytes: 10 * 1024 * 1024,
  maxPdfPages: 15,
} as const;

const env = (key: keyof ImportMetaEnv): string => {
  try {
    return (import.meta.env?.[key] as string | undefined)?.trim() || '';
  } catch {
    return '';
  }
};

/* ------------------------------------------------------------------ */
/* Bring-your-own-key (runtime override)                               */
/* ------------------------------------------------------------------ */

/**
 * A key entered in the app UI. Lets a deployed static build work without a
 * rebuild, and lets each visitor use their own quota.
 */
export function getStoredApiKey(): string {
  try {
    return localStorage.getItem(BYOK_STORAGE_KEY)?.trim() || '';
  } catch {
    return '';
  }
}

export function setStoredApiKey(key: string): void {
  try {
    const trimmed = key.trim();
    if (trimmed) localStorage.setItem(BYOK_STORAGE_KEY, trimmed);
    else localStorage.removeItem(BYOK_STORAGE_KEY);
  } catch {
    /* storage unavailable (private mode) — the key simply won't persist */
  }
}

export function clearStoredApiKey(): void {
  setStoredApiKey('');
}

/* ------------------------------------------------------------------ */
/* Resolution                                                          */
/* ------------------------------------------------------------------ */

/**
 * Resolve the active configuration.
 *
 * Precedence: a configured proxy always wins (it is the secure path), then a
 * user-entered key, then the build-time env key.
 */
export function resolveAIConfig(): AIConfig {
  const proxyUrl = env('VITE_AI_PROXY_URL');
  const apiKey = getStoredApiKey() || env('VITE_GEMINI_API_KEY');

  return {
    mode: proxyUrl ? 'proxy' : 'direct',
    apiKey,
    model: env('VITE_GEMINI_MODEL') || DEFAULT_MODEL,
    proxyUrl,
    ...DEFAULTS,
  };
}

/**
 * Whether import can run at all. The UI uses this to show the key prompt
 * instead of letting the user upload a file that is guaranteed to fail.
 */
export function isAIConfigured(config: AIConfig = resolveAIConfig()): boolean {
  return config.mode === 'proxy' ? !!config.proxyUrl : !!config.apiKey;
}

/** True when the key came from the build, so the UI can hide the BYOK field. */
export function hasEnvApiKey(): boolean {
  return !!env('VITE_GEMINI_API_KEY');
}

/* ------------------------------------------------------------------ */
/* Diagnostics                                                         */
/* ------------------------------------------------------------------ */

/**
 * What this specific BUILD was compiled with.
 *
 * `VITE_*` variables are baked in at build time, not read at runtime, so a
 * variable added to the hosting dashboard after the last build simply is not
 * there — and the only visible symptom was the app quietly asking for a key.
 * This makes the build's actual configuration inspectable so that failure mode
 * is diagnosable instead of mysterious.
 *
 * Never exposes the key itself, only whether one was compiled in.
 */
export interface AIBuildInfo {
  /** True when VITE_AI_PROXY_URL was present at build time. */
  hasProxyUrl: boolean;
  proxyUrl: string;
  /** True when VITE_GEMINI_API_KEY was present at build time. */
  hasBuildKey: boolean;
  /** True when the visitor pasted their own key into this browser. */
  hasStoredKey: boolean;
  model: string;
  mode: AIMode;
  configured: boolean;
  /** Every VITE_ name this build actually carries — the ground truth. */
  viteKeysInBuild: string[];
}

export function getAIBuildInfo(): AIBuildInfo {
  const config = resolveAIConfig();
  let viteKeysInBuild: string[] = [];
  try {
    viteKeysInBuild = Object.keys(import.meta.env ?? {}).filter((k) => k.startsWith('VITE_'));
  } catch {
    /* no import.meta.env at all */
  }

  return {
    hasProxyUrl: !!config.proxyUrl,
    proxyUrl: config.proxyUrl,
    hasBuildKey: hasEnvApiKey(),
    hasStoredKey: !!getStoredApiKey(),
    model: config.model,
    mode: config.mode,
    configured: isAIConfigured(config),
    viteKeysInBuild,
  };
}

// Exposed on window so a deployed build can be inspected from the console
// without a rebuild: `__aiConfig()`.
if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).__aiConfig = getAIBuildInfo;
}
