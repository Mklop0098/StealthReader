import { useEffect, useState } from 'react';
import type { AppStore } from '../../app/store.js';
import { matchesAccelerator } from '../../app/keys.js';
import { skinRegistry } from '../../skins/registry.js';
import { CommandPalette } from './CommandPalette.js';

interface ReaderScreenProps {
  store: AppStore;
}

export function ReaderScreen({ store }: ReaderScreenProps) {
  const settings = store((s) => s.settings);
  const activeBook = store((s) => s.activeBook);
  const chapter = store((s) => s.chapter);
  const anchor = store((s) => s.anchor);
  const resumeMessage = store((s) => s.resumeMessage);
  const setAnchor = store((s) => s.setAnchor);
  const openChapter = store((s) => s.openChapter);
  const stepChapter = store((s) => s.stepChapter);
  const goToLibrary = store((s) => s.goToLibrary);
  const setSkin = store((s) => s.setSkin);

  const [paletteOpen, setPaletteOpen] = useState(false);
  const [controlsOpen, setControlsOpen] = useState(false);

  useEffect(() => {
    const handler = (event: KeyboardEvent): void => {
      const target = event.target;
      if (event.defaultPrevented || event.isComposing || paletteOpen ||
        (target instanceof HTMLElement && target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]'))) return;
      const chapterKey = !event.ctrlKey && !event.altKey && !event.metaKey &&
        (event.key === '<' || event.key === '>' || (!event.shiftKey && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')));
      if (chapterKey) {
        event.preventDefault();
        if (!event.repeat) void store.getState().stepChapter(event.key === '<' || event.key === 'ArrowLeft' ? -1 : 1);
        return;
      }
      const { hotkeys } = store.getState().settings;
      const match = (action: string): boolean => {
        const binding = hotkeys.find((h) => h.action === action);
        return binding ? matchesAccelerator(event, binding.accelerator) : false;
      };
      if (match('nextChapter')) {
        event.preventDefault();
        void store.getState().stepChapter(1);
      } else if (match('prevChapter')) {
        event.preventDefault();
        void store.getState().stepChapter(-1);
      } else if (match('toggleBookmark')) {
        event.preventDefault();
        void store.getState().toggleBookmark();
      } else if (match('openSearch')) {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [store, paletteOpen]);

  if (!activeBook || !chapter || !anchor) {
    return (
      <div className="empty-state">
        <p>Loading…</p>
      </div>
    );
  }

  const skin = skinRegistry.get(settings.activeSkin);

  return (
    <div className={`reader-screen reader-theme-${settings.activeSkin}`}>
      <div className={`reader-controls ${controlsOpen ? 'is-open' : ''}`}>
      <button className="reader-controls-trigger" type="button" aria-label="Reader controls" aria-expanded={controlsOpen} aria-controls="reader-toolbar" onClick={() => setControlsOpen(open => !open)}>⋯</button>
      <div className="reader-toolbar" id="reader-toolbar">
        <button type="button" className="button" onClick={goToLibrary}>
          Library
        </button>
        <span className="reader-toolbar-title">
          {settings.activeSkin === 'vscode' ? 'metrics-service' : settings.activeSkin === 'claude' ? 'Workspace' : activeBook.title}
        </span>
        <span className="reader-toolbar-spacer" />
        {(['vscode', 'excel', 'terminal', 'claude'] as const).map((id) => (
          <button
            key={id}
            type="button"
            className={`chip ${settings.activeSkin === id ? 'is-active' : ''}`}
            onClick={() => void setSkin(id)}
            aria-pressed={settings.activeSkin === id}
          >
            {skinRegistry.get(id).displayName}
          </button>
        ))}
        <button type="button" className="button" onClick={() => setPaletteOpen(true)}>
          Bookmarks & search
        </button>
      </div>
      </div>

      {resumeMessage && (
        <div className="banner info" role="status">
          {resumeMessage}
        </div>
      )}

      <div className="reader-surface">
        <skin.ReaderView
          chapter={chapter}
          anchor={anchor}
          onAnchorChange={setAnchor}
          book={{ id: activeBook.id, title: activeBook.title }}
          chapters={activeBook.chapters}
          onSelectChapter={(chapterId) => void openChapter(chapterId)}
          onStepChapter={(direction) => void stepChapter(direction)}
          settings={settings}
        />
      </div>

      {paletteOpen && <CommandPalette store={store} onClose={() => setPaletteOpen(false)} />}
    </div>
  );
}
