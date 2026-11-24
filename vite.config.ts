import { defineConfig } from 'vite';

// Backend HeadsUp Inbox (server/) dengar di 127.0.0.1:8787 —
// /api di-proxy ke sana saat dev & preview agar frontend cukup pakai URL relatif.
const apiProxy = { '/api': 'http://127.0.0.1:8787' };

export default defineConfig({
  server: { port: 5173, strictPort: true, host: '127.0.0.1', proxy: apiProxy },
  preview: { port: 5173, strictPort: true, host: '127.0.0.1', proxy: apiProxy },
  build: { outDir: 'dist', emptyOutDir: true },
});
