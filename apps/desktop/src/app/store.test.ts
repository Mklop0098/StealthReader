import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReaderAnchor } from '@stealth-reader/shared-types';
import { createAppStore } from './store.js';
import { makeFakeClient, makeSummary } from '../test/fakeClient.js';

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe('app store', () => {
  it('clears the book title from the native window when switching to VS Code', async () => {
    const setWindowTitle = vi.fn(async (_title: string) => {});
    const store = createAppStore(makeFakeClient({ setWindowTitle }));
    await store.getState().bootstrap();
    await store.getState().openBook('book-1');
    await store.getState().setSkin('terminal');
    expect(setWindowTitle).toHaveBeenLastCalledWith('Nightfall Archive');
    await store.getState().setSkin('vscode');
    expect(setWindowTitle.mock.calls.at(-1)?.[0]).not.toContain('Nightfall');
  });

  it('updates import progress, prevents duplicate imports and clears it on completion', async () => {
    let finish!: () => void;
    const wait = new Promise<void>((resolve) => { finish = resolve; });
    const importBook = vi.fn<ReturnType<typeof makeFakeClient>['importBook']>(async (_path, report) => {
      report?.({ stage: 'chapters', percent: 42, completed: 1, total: 2 });
      await wait;
      return makeSummary();
    });
    const store = createAppStore(makeFakeClient({ importBook }));
    const pending = store.getState().importBook('book.epub');
    expect(store.getState().importProgress?.percent).toBe(42);
    expect(store.getState().busy).toBe(true);
    await store.getState().importBook('other.epub');
    expect(importBook).toHaveBeenCalledTimes(1);
    finish();
    await pending;
    expect(store.getState().importProgress).toBeNull();
    expect(store.getState().busy).toBe(false);
    expect(store.getState().mode).toBe('reading');
    importBook.mock.calls[0]?.[1]?.({ stage: 'saving', percent: 85, completed: 0, total: 0 });
    expect(store.getState().importProgress).toBeNull();
  });

  it('clears import progress and shows the error when import fails', async () => {
    const store = createAppStore(makeFakeClient({ importBook: async (_path, report) => {
      report?.({ stage: 'parsing', percent: 5, completed: 0, total: 0 });
      throw new Error('Invalid EPUB');
    } }));
    await store.getState().importBook('bad.epub');
    expect(store.getState().importProgress).toBeNull();
    expect(store.getState().busy).toBe(false);
    expect(store.getState().statusMessage).toBe('Invalid EPUB');
  });

  it('bootstraps into the library and registers shortcuts', async () => {
    const registerShortcuts = vi.fn(async (quick: string, restore: string) => ({
      quickSwitch: { registered: true, accelerator: quick, reason: null },
      restoreReading: { registered: true, accelerator: restore, reason: null },
    }));
    const store = createAppStore(makeFakeClient({ registerShortcuts }));

    await store.getState().bootstrap();

    expect(store.getState().mode).toBe('library');
    expect(store.getState().books).toHaveLength(1);
    expect(registerShortcuts).toHaveBeenCalledTimes(1);
    expect(store.getState().shortcutWarning).toBeNull();
  });

  it('warns and keeps working when a global shortcut cannot be registered', async () => {
    const store = createAppStore(
      makeFakeClient({
        registerShortcuts: async (quick, restore) => ({
          quickSwitch: { registered: false, accelerator: quick, reason: 'already in use' },
          restoreReading: { registered: true, accelerator: restore, reason: null },
        }),
      }),
    );

    await store.getState().bootstrap();

    expect(store.getState().shortcutWarning).toContain('already in use');
  });

  it('quick switch enters neutral synchronously and keeps the anchor', async () => {
    vi.useFakeTimers();
    const store = createAppStore(makeFakeClient());
    await store.getState().bootstrap();
    await store.getState().openBook('book-1');

    const before = store.getState().anchor;
    expect(before).not.toBeNull();

    store.getState().quickSwitch();

    expect(store.getState().mode).toBe('neutral');
    expect(store.getState().anchor).toEqual(before);
  });

  it('restore returns to the previous mode', async () => {
    vi.useFakeTimers();
    const store = createAppStore(makeFakeClient());
    await store.getState().bootstrap();
    await store.getState().openBook('book-1');

    store.getState().quickSwitch();
    store.getState().restoreReading();

    expect(store.getState().mode).toBe('reading');
  });

  it('stamps progress writes with an increasing sequence', async () => {
    vi.useFakeTimers();
    const saveProgress = vi.fn(async (_anchor: ReaderAnchor, seq: number) => ({
      revision: seq,
      applied: true,
    }));
    const store = createAppStore(makeFakeClient({ saveProgress }));
    await store.getState().bootstrap();
    await store.getState().openBook('book-1');

    const base = store.getState().anchor!;
    store.getState().setAnchor({ ...base, paragraphId: 'p-2' });
    await store.getState().flushProgress();
    store.getState().setAnchor({ ...base, paragraphId: 'p-3' });
    await store.getState().flushProgress();

    expect(saveProgress.mock.calls.map((call) => call[1])).toEqual([1, 2]);
  });

  it('removes a deleted book from the active reading state', async () => {
    vi.useFakeTimers();
    const store = createAppStore(makeFakeClient());
    await store.getState().bootstrap();
    await store.getState().openBook('book-1');

    await store.getState().deleteBook('book-1', false);

    expect(store.getState().activeBook).toBeNull();
    expect(store.getState().mode).toBe('library');
    expect(store.getState().books).toHaveLength(0);
  });
});
