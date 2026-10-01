import { defineConfig } from '@playwright/test';
import base from './playwright.config';

// Runs only tests/e2e/capture-fallback.ts (see `npm run capture:fallback`).
export default defineConfig({
  ...base,
  testMatch: 'capture-fallback.ts',
});
