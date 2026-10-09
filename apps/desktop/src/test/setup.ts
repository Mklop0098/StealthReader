import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// The Tauri bridge is unavailable under jsdom; stub the transport modules so
// components that import them can render. Individual tests inject fake clients.
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(async () => ({
    ok: false,
    error: { code: 'INVALID_INPUT', message: 'tauri unavailable in tests', recoverable: true },
  })),
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(async () => () => {}),
}));

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn(async () => null),
}));

if (typeof globalThis.IntersectionObserver === 'undefined') {
  class NoopIntersectionObserver {
    root: Element | null = null;
    rootMargin = '';
    thresholds: number[] = [];
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }
  }
  globalThis.IntersectionObserver =
    NoopIntersectionObserver as unknown as typeof IntersectionObserver;
}
