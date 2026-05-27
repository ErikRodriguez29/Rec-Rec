/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Injected in vite.config (from repo-root `.env` `GOOGLE_CLIENT_ID`). */
  readonly GOOGLE_CLIENT_ID?: string;
  /** Legacy; prefer `GOOGLE_CLIENT_ID`. */
  readonly VITE_GOOGLE_CLIENT_ID?: string;
  /** Week-1 anchor date (`YYYY-MM-DD`); injected from repo-root `START_DATE`. */
  readonly START_DATE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
