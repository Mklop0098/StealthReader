import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config.js';

// Kept separate from vite.config.ts: vitest bundles its own vite version, so
// merging here (excluded from `tsc --noEmit`) avoids cross-version type errors
// while still reusing the app's plugins and server settings.
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./src/test/setup.ts'],
      include: ['src/**/*.test.{ts,tsx}'],
      css: false,
    },
  }),
);
