import { useEffect, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import type { AppStore } from './store.js';
import { matchesAccelerator } from './keys.js';

const SHORTCUT_EVENT = 'stealth://shortcut';

/** Subscribes to OS-level shortcut events emitted by the Rust backend. */
export function useShortcutEvents(store: AppStore): void {
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let cancelled = false;

    void listen<string>(SHORTCUT_EVENT, (event) => {
      const state = store.getState();
      if (event.payload === 'quickSwitch') state.quickSwitch();
      else if (event.payload === 'restoreReading') state.restoreReading();
    })
      .then((dispose) => {
        if (cancelled) dispose();
        else unlisten = dispose;
      })
      .catch(() => {
        // Event bridge is unavailable (e.g. outside Tauri); the in-app
        // keyboard fallback still covers both actions.
      });

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [store]);
}

/** In-app fallback for the stealth accelerators (PRD FR-14, AT-12). */
export function useStealthKeys(store: AppStore): void {
  useEffect(() => {
    const handler = (event: KeyboardEvent): void => {
      const { hotkeys } = store.getState().settings;
      const quick = hotkeys.find((h) => h.action === 'quickSwitch');
      const restore = hotkeys.find((h) => h.action === 'restoreReading');
      if (quick && matchesAccelerator(event, quick.accelerator)) {
        event.preventDefault();
        store.getState().quickSwitch();
        return;
      }
      if (restore && matchesAccelerator(event, restore.accelerator)) {
        event.preventDefault();
        store.getState().restoreReading();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [store]);
}

/** Milliseconds since mount, used only for decorative neutral-view animation. */
export function useElapsedMs(active: boolean, intervalMs = 1000): number {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!active) return;
    setElapsed(0);
    const timer = setInterval(() => setElapsed((value) => value + intervalMs), intervalMs);
    return () => clearInterval(timer);
  }, [active, intervalMs]);
  return elapsed;
}
