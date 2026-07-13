/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// The SPA is served same-origin by NestJS at /admin (Phase F6), so all asset
// URLs and the dev server are rooted there.
export default defineConfig({
  base: '/admin/',
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
});
