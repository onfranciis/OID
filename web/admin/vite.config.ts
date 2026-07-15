/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// The SPA is served same-origin by NestJS at /admin (Phase F6), so all asset
// URLs and the dev server are rooted there. When VITE_USE_REAL_API is set, the
// dev server proxies API/auth routes to a running backend (default :3000)
// instead of using MSW, so cookies stay same-origin.
const backendTarget = process.env.VITE_BACKEND_URL ?? 'http://localhost:3000';
const proxy = process.env.VITE_USE_REAL_API
  ? {
      '/admin/api': { target: backendTarget, changeOrigin: false },
      '/login': { target: backendTarget, changeOrigin: false },
      '/logout': { target: backendTarget, changeOrigin: false },
      '/api/auth': { target: backendTarget, changeOrigin: false },
    }
  : undefined;

export default defineConfig({
  base: '/admin/',
  plugins: [react(), tailwindcss()],
  server: { proxy },
  test: {
    // Unit/integration tests live in src; e2e/ is Playwright-only.
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
});
