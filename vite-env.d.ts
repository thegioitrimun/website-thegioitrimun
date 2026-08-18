/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_SUPABASE_URL: string;
    readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
    readonly VITE_SUPABASE_ANON_KEY?: string;
    readonly VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY?: string;
    readonly VITE_IMAGE_STORAGE_PROVIDER?: 'supabase' | 'r2';
    readonly VITE_R2_IMAGE_BASE_URL?: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv
}
