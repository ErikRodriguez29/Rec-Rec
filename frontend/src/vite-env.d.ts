/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Injected in vite.config (from repo-root `.env` `GOOGLE_CLIENT_ID`). */
  readonly GOOGLE_CLIENT_ID?: string;
  /** Legacy; prefer `GOOGLE_CLIENT_ID`. */
  readonly VITE_GOOGLE_CLIENT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
