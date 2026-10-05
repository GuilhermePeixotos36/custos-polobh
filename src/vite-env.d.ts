/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DATA_SOURCE?: string;
  readonly VITE_FEATURE_CNPJ?: string;
  readonly VITE_FEATURE_IA?: string;
  readonly VITE_AI_ENDPOINT?: string;
  readonly VITE_FEATURE_EMAIL?: string;
  readonly VITE_EMAIL_ENDPOINT?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** Versão da publicação (ver vite.config.ts). */
declare const __APP_VERSION__: string;
