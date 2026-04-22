/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PRIMARY_ADMIN_EMAIL: string;
  readonly VITE_GEMINI_API_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
