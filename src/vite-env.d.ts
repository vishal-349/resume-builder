/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Google Gemini API key. Local development only — see README for the proxy path. */
  readonly VITE_GEMINI_API_KEY?: string;
  /** Overrides the default Gemini model id. */
  readonly VITE_GEMINI_MODEL?: string;
  /**
   * When set, all AI calls are routed to this backend endpoint instead of going
   * directly to Gemini. The browser then never holds a provider key.
   */
  readonly VITE_AI_PROXY_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
