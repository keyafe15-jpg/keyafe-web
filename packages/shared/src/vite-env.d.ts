declare global {
  interface ImportMetaEnv {
    readonly VITE_GOOGLE_MAPS_API_KEY?: string;
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
}

export {};
