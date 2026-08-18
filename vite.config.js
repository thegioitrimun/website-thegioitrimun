import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

import { cloudflare } from "@cloudflare/vite-plugin";

const devProxyTarget = process.env.VITE_DEV_PROXY_TARGET || 'http://127.0.0.1:8788';
const devProxySecure = /^https:/i.test(devProxyTarget);

export default defineConfig(({ command }) => {
  const useD1Backend = String(process.env.VITE_DATA_BACKEND || '').toLowerCase() === 'd1';
  const hasProxyTarget = Boolean(process.env.VITE_DEV_PROXY_TARGET);
  const plugins = [react()];
  if (command === 'build' || !hasProxyTarget) {
    plugins.push(cloudflare());
  }
  return {
  plugins,
  define: useD1Backend
    ? { 'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('') }
    : {},
  resolve: {
    alias: useD1Backend
      ? [{ find: './supabaseClient', replacement: fileURLToPath(new URL('./services/supabaseClient.d1.ts', import.meta.url)) }]
      : [],
  },
  server: {
    proxy: {
      '/api': {
        target: devProxyTarget,
        changeOrigin: true,
        secure: devProxySecure,
      },
      '/r2': {
        target: devProxyTarget,
        changeOrigin: true,
        secure: devProxySecure,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('/react-i18next/') || id.includes('/i18next/')) return 'vendor-react';
            if (id.includes('/swiper/')) return 'vendor-swiper';
            if (id.includes('/xlsx/')) return 'xlsx';
          }
          if (id.includes('/services/runtimeLoaders.ts')) return 'runtime-loaders';
          if (id.includes('/src/siteDefaults.ts')) return 'site-defaults';
          if (id.includes('/services/api.ts')) return 'app-api';
          if (id.includes('/services/geminiService.ts')) return 'app-gemini';
          if (id.includes('/components/icons.tsx')) return 'app-icons';
        },
      },
    },
  },
  };
});
