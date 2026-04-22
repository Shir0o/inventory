/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PRIMARY_ADMIN_EMAIL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
