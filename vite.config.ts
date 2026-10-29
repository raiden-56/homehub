/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { copyFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath, URL } from 'node:url';

// The dev server relies on an inline React Refresh preamble, so the strict
// Content Security Policy is only injected into production builds.
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

function contentSecurityPolicy(): Plugin {
  return {
    name: 'homehub-csp',
    apply: 'build',
    transformIndexHtml: () => [
      {
        tag: 'meta',
        attrs: { 'http-equiv': 'Content-Security-Policy', content: CONTENT_SECURITY_POLICY },
        injectTo: 'head-prepend',
      },
    ],
  };
}

// GitHub Pages has no server-side rewrites: it serves 404.html for unknown paths, so a copy of
// the app shell there lets deep links and reloads (e.g. /homehub/inventory) start the router.
function spaFallback(): Plugin {
  let outDir = 'dist';
  return {
    name: 'homehub-spa-fallback',
    apply: 'build',
    configResolved: (config) => {
      outDir = resolve(config.root, config.build.outDir);
    },
    closeBundle: () => copyFileSync(join(outDir, 'index.html'), join(outDir, '404.html')),
  };
}

/** Sub-path the app is served from, e.g. `/homehub/` on GitHub Pages. Defaults to the root. */
function basePath(): string {
  const raw = process.env.BASE_PATH?.trim().replace(/^\/+|\/+$/g, '');
  return raw ? `/${raw}/` : '/';
}

export default defineConfig({
  base: basePath(),
  plugins: [react(), contentSecurityPolicy(), spaFallback()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          mui: ['@mui/material', '@emotion/react', '@emotion/styled'],
          charts: ['recharts'],
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
  },
});
