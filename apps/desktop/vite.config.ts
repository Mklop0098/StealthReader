import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Tauri expects a fixed dev port and must not watch the Rust crate.
// Test configuration lives in vitest.config.ts so this file stays free of the
// vitest/vite type mismatch caused by different bundled vite versions.
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: { ignored: ['**/src-tauri/**'] },
  },
  build: {
    target: 'chrome110',
    sourcemap: true,
    emptyOutDir: true,
  },
});
