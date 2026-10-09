import { useEffect, useRef } from 'react';
import { LibraryView } from '../features/library/LibraryView.js';
import { ReaderScreen } from '../features/reader/ReaderScreen.js';
import { SettingsView } from '../features/settings/SettingsView.js';
import { skinRegistry } from '../skins/registry.js';
import { useAppStore, type AppStore } from './store.js';
import { useElapsedMs, useShortcutEvents, useStealthKeys } from './useShortcuts.js';
import { AppWindowBar } from '../skins/chrome.js';

interface AppProps {
  /** Injectable for tests; defaults to the application store. */
  store?: AppStore;
}

export function App({ store = useAppStore }: AppProps) {
  const mode = store((s) => s.mode);
  const settings = store((s) => s.settings);
  const shortcutWarning = store((s) => s.shortcutWarning);
  const dismissWarning = store((s) => s.dismissShortcutWarning);
  const bootstrap = store((s) => s.bootstrap);
  const restoreReading = store((s) => s.restoreReading);

  const bootstrapped = useRef(false);
  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;
    void bootstrap();
  }, [bootstrap]);

  useShortcutEvents(store);
  useStealthKeys(store);

  const elapsedMs = useElapsedMs(mode === 'neutral');
  const skin = skinRegistry.get(settings.activeSkin);

  const banner = shortcutWarning ? (
    <div className="banner warning global-banner" role="alert">
      <span>{shortcutWarning}</span>
      <button
        type="button"
        className="icon-button"
        onClick={dismissWarning}
        aria-label="Dismiss warning"
      >
        ×
      </button>
    </div>
  ) : null;

  if (mode === 'neutral') {
    return (
      <div className="app-shell app-neutral">
        {banner}
        <skin.NeutralView elapsedMs={elapsedMs} />
        <button type="button" className="neutral-restore" onClick={restoreReading}>
          Restore reading
        </button>
      </div>
    );
  }

  if (mode === 'booting') {
    return (
      <div className="app-shell">
        <AppWindowBar />
        <div className="empty-state">
          <p>Loading…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      {mode !== 'reading' && <AppWindowBar />}
      {banner}
      {mode === 'settings' ? (
        <SettingsView store={store} />
      ) : mode === 'reading' ? (
        <ReaderScreen store={store} />
      ) : (
        <LibraryView store={store} />
      )}
    </div>
  );
}
