/// <reference types="vite/client" />

/** Content hash baked in at build time so the first data fetch is not a waterfall. */
declare const __DATASET_VERSION__: string;

interface ImportMetaEnv {
  readonly CDN_AUDIO_URL?: string;
}
