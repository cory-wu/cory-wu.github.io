// The config imports the landmark registry, so that import chain spells out .ts
// extensions (required by Vite's upcoming native config loader).
/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import type { Plugin } from 'vite';
import { placements } from './src/garden/landmarks/registry.ts';
import { injectNavLinks } from './src/garden/nav-markup.ts';
import { injectShell, sectionFromPath, splitShell } from './src/site/shell.ts';

/** Writes the landmark nav links into index.html (dev and build) so they render without JS. */
function siteNav(): Plugin {
  return {
    name: 'garden-site-nav',
    transformIndexHtml: {
      order: 'pre',
      handler: (html) => injectNavLinks(html, placements),
    },
  };
}

/** Wraps every page except the garden in the shared shell (dev and build); see src/site/shell.ts. */
function siteShell(): Plugin {
  return {
    name: 'site-shell',
    transformIndexHtml: {
      order: 'pre',
      handler: (html, ctx) => {
        if (ctx.path === '/' || ctx.path === '/index.html') return html;
        // Read on every transform so edits to the snippet show up in dev without a restart.
        const parts = splitShell(readFileSync(resolve(import.meta.dirname, 'src/site/shell.html'), 'utf8'));
        return injectShell(html, { ...parts, section: sectionFromPath(ctx.path), year: new Date().getFullYear() });
      },
    },
  };
}

export default defineConfig({
  base: '/',
  // A multi-page static site: unknown paths 404 like on GitHub Pages instead of falling back to index.html.
  appType: 'mpa',
  plugins: [siteNav(), siteShell()],
  build: {
    rollupOptions: {
      input: { main: 'index.html', writing: 'writing/index.html' },
    },
  },
  test: {
    environment: 'jsdom',
    include: ['tests/unit/**/*.test.ts'],
  },
});
