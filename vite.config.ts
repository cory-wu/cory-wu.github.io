// The config imports the landmark registry, so that import chain spells out .ts
// extensions (required by Vite's upcoming native config loader).
/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import type { Plugin } from 'vite';
import { placements } from './src/garden/landmarks/registry.ts';
import { injectNavLinks } from './src/garden/nav-markup.ts';

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

export default defineConfig({
  base: '/',
  plugins: [siteNav()],
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
