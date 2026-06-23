/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Injected at build time (see vite.config.ts) so the live build is verifiable.
declare const __BUILD_ID__: string;
declare const __BUILD_TIME__: string;
