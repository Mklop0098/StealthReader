import { create } from 'zustand';
import {
  DEFAULT_SETTINGS,
  IpcCommandError,
  type AppSettings,
  type BookDetails,
  type BookSummary,
  type Bookmark,
  type ChapterDto,
  type ReaderAnchor,
  type SearchHit,
  type SkinId,
} from '@stealth-reader/shared-types';

import { ipc, type IpcClient, type ImportProgress } from '../contracts/ipc.js';
import { NEUTRAL_WINDOW_TITLE, PROGRESS_DEBOUNCE_MS } from './constants.js';

export type AppMode = 'booting' | 'library' | 'reading' | 'neutral' | 'settings';

export interface AppStoreState {
  mode: AppMode;
  /** Mode to return to when the user explicitly restores from neutral. */
  modeBeforeNeutral: AppMode;
  settings: AppSettings;
  books: BookSummary[];
  bookQuery: string;
  activeBook: BookDetails | null;
  chapter: ChapterDto | null;
  anchor: ReaderAnchor | null;
  bookmarks: Bookmark[];
  searchHits: SearchHit[];
  searchQuery: string;
  sessionId: string | null;
  resumeMessage: string | null;
  shortcutWarning: string | null;
  statusMessage: string | null;
  busy: boolean;
  importProgress: ImportProgress | null;
  /** Monotonic counter attached to progress writes for last-write-wins. */
  progressSeq: number;

  bootstrap: () => Promise<void>;
  refreshBooks: (query?: string) => Promise<void>;
  importBook: (path: string) => Promise<void>;
  openBook: (bookId: string) => Promise<void>;
  openChapter: (chapterId: string, paragraphId?: string | null) => Promise<void>;
  stepChapter: (direction: 1 | -1) => Promise<void>;
  setAnchor: (anchor: ReaderAnchor) => void;
  flushProgress: () => Promise<void>;
  saveSettings: (patch: Partial<AppSettings>) => Promise<void>;
  setSkin: (skin: SkinId) => Promise<void>;
  quickSwitch: () => void;
  restoreReading: () => void;
  goToLibrary: () => void;
  goToSettings: () => void;
  toggleBookmark: (note?: string | null) => Promise<void>;
  removeBookmark: (bookmarkId: string) => Promise<void>;
  runSearch: (query: string) => Promise<void>;
  clearSearch: () => void;
  deleteBook: (bookId: string, deleteOriginal: boolean) => Promise<void>;
  dismissShortcutWarning: () => void;
}

function messageOf(error: unknown): string {
  if (error instanceof IpcCommandError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Unexpected error';
}

export function createAppStore(client: IpcClient = ipc) {
  let progressTimer: ReturnType<typeof setTimeout> | null = null;

  const store = create<AppStoreState>((set, get) => {
    const applyWindowTitle = async (): Promise<void> => {
      const { mode, activeBook } = get();
      const title =
        mode === 'neutral' || ['vscode', 'claude'].includes(get().settings.activeSkin)
          ? NEUTRAL_WINDOW_TITLE
          : activeBook
            ? activeBook.title
            : NEUTRAL_WINDOW_TITLE;
      try {
        await client.setWindowTitle(title);
      } catch {
        // A missing window is never fatal.
      }
    };

    const scheduleProgress = (): void => {
      if (progressTimer) clearTimeout(progressTimer);
      progressTimer = setTimeout(() => {
        void get().flushProgress();
      }, PROGRESS_DEBOUNCE_MS);
    };

    /** Session recording is best effort and must never block reading. */
    const endSession = async (): Promise<void> => {
      const id = get().sessionId;
      if (!id) return;
      set({ sessionId: null });
      try {
        await client.endSession(id);
      } catch {
        // ignore
      }
    };

    const trackSession = async (bookId: string): Promise<void> => {
      await endSession();
      try {
        const id = await client.startSession(bookId, get().settings.activeSkin);
        set({ sessionId: id });
      } catch {
        // ignore
      }
    };

    const applyHotkeys = async (): Promise<void> => {
      const { hotkeys } = get().settings;
      const quick = hotkeys.find((h) => h.action === 'quickSwitch');
      const restore = hotkeys.find((h) => h.action === 'restoreReading');
      if (!quick || !restore) return;
      try {
        const result = await client.registerShortcuts(quick.accelerator, restore.accelerator);
        const failures = [result.quickSwitch, result.restoreReading].filter(
          (r) => !r.registered,
        );
        set({
          shortcutWarning:
            failures.length > 0
              ? `Global shortcut unavailable (${failures
                  .map((f) => f.reason ?? f.accelerator)
                  .join('; ')}). Use the in-app shortcut instead.`
              : null,
        });
      } catch (error) {
        set({ shortcutWarning: messageOf(error) });
      }
    };

    return {
      mode: 'booting',
      modeBeforeNeutral: 'library',
      settings: DEFAULT_SETTINGS,
      books: [],
      bookQuery: '',
      activeBook: null,
      chapter: null,
      anchor: null,
      bookmarks: [],
      searchHits: [],
      searchQuery: '',
      sessionId: null,
      resumeMessage: null,
      shortcutWarning: null,
      statusMessage: null,
      busy: false,
      importProgress: null,
      progressSeq: 0,

      bootstrap: async () => {
        try {
          const settings = await client.getSettings();
          set({ settings });
          await get().refreshBooks();
          await applyHotkeys();
          // Only choose the landing screen while still booting, so a re-entrant
          // bootstrap can never yank the user out of reading or neutral mode.
          if (get().mode === 'booting') {
            set({ mode: settings.privacy.launchInNeutral ? 'neutral' : 'library' });
            await applyWindowTitle();
          }
        } catch (error) {
          set({ mode: get().mode === 'booting' ? 'library' : get().mode, statusMessage: messageOf(error) });
        }
      },

      refreshBooks: async (query) => {
        const nextQuery = query ?? get().bookQuery;
        try {
          const page = await client.listBooks(nextQuery || null, 0, 100);
          set({ books: page.items, bookQuery: nextQuery });
        } catch (error) {
          set({ statusMessage: messageOf(error) });
        }
      },

      importBook: async (path) => {
        if (get().importProgress) return;
        set({ busy: true, statusMessage: null, importProgress: { stage: 'reading', percent: 0, completed: 0, total: 0 } });
        let acceptingProgress = true;
        try {
          const book = await client.importBook(path, (importProgress) => {
            if (acceptingProgress) set({ importProgress });
          });
          acceptingProgress = false;
          set({ importProgress: { stage: 'opening', percent: 100, completed: 0, total: 0 } });
          await get().refreshBooks();
          await get().openBook(book.id);
        } catch (error) {
          set({ statusMessage: messageOf(error) });
        } finally {
          acceptingProgress = false;
          set({ busy: false, importProgress: null });
        }
      },

      openBook: async (bookId) => {
        set({ busy: true, statusMessage: null });
        try {
          const book = await client.getBook(bookId);
          const resume = await client.resumeBook(bookId);
          const targetChapterId = resume.anchor?.chapterId ?? book.chapters[0]?.id;
          if (!targetChapterId) throw new Error('Book has no chapters');
          const chapter = await client.getChapter(targetChapterId);
          const bookmarks = await client.listBookmarks(bookId);
          const anchor: ReaderAnchor = resume.anchor ?? {
            bookId,
            chapterId: chapter.id,
            paragraphId: null,
            charOffset: 0,
            viewportFraction: 0,
          };
          set({
            activeBook: book,
            chapter,
            anchor,
            bookmarks,
            resumeMessage: resume.message,
            searchHits: [],
            searchQuery: '',
            mode: 'reading',
          });
          await applyWindowTitle();
          await trackSession(bookId);
        } catch (error) {
          set({ statusMessage: messageOf(error) });
        } finally {
          set({ busy: false });
        }
      },

      openChapter: async (chapterId, paragraphId = null) => {
        const { activeBook } = get();
        if (!activeBook) return;
        try {
          const chapter = await client.getChapter(chapterId);
          set({
            chapter,
            anchor: {
              bookId: activeBook.id,
              chapterId: chapter.id,
              paragraphId,
              charOffset: 0,
              viewportFraction: 0,
            },
          });
          await get().flushProgress();
        } catch (error) {
          set({ statusMessage: messageOf(error) });
        }
      },

      stepChapter: async (direction) => {
        const { activeBook, chapter } = get();
        if (!activeBook || !chapter) return;
        const index = activeBook.chapters.findIndex((c) => c.id === chapter.id);
        const next = activeBook.chapters[index + direction];
        if (!next) return;
        await get().openChapter(next.id);
      },

      setAnchor: (anchor) => {
        set({ anchor });
        scheduleProgress();
      },

      flushProgress: async () => {
        const anchor = get().anchor;
        if (!anchor) return;
        if (progressTimer) {
          clearTimeout(progressTimer);
          progressTimer = null;
        }
        const seq = get().progressSeq + 1;
        set({ progressSeq: seq });
        try {
          await client.saveProgress(anchor, seq);
        } catch {
          // Progress persistence must never block or crash the reader.
        }
      },

      saveSettings: async (patch) => {
        const merged: AppSettings = {
          ...get().settings,
          ...patch,
          font: { ...get().settings.font, ...(patch.font ?? {}) },
          privacy: { ...get().settings.privacy, ...(patch.privacy ?? {}) },
          hotkeys: patch.hotkeys ?? get().settings.hotkeys,
        };
        try {
          const saved = await client.updateSettings(merged);
          set({ settings: saved });
          await applyWindowTitle();
          await applyHotkeys();
        } catch (error) {
          set({ statusMessage: messageOf(error) });
        }
      },

      setSkin: async (skin) => {
        await get().saveSettings({ activeSkin: skin });
      },

      quickSwitch: () => {
        const { mode } = get();
        if (mode === 'neutral') return;
        // Synchronous state change first: the neutral surface must appear
        // immediately and must not wait on storage (PRD section 3, flow C).
        set({ modeBeforeNeutral: mode, mode: 'neutral' });
        void applyWindowTitle();
        void get().flushProgress();
      },

      restoreReading: () => {
        if (get().mode !== 'neutral') return;
        const before = get().modeBeforeNeutral;
        const { chapter } = get();
        const target: AppMode = before === 'neutral' ? (chapter ? 'reading' : 'library') : before;
        set({ mode: target });
        void applyWindowTitle();
      },

      goToLibrary: () => {
        if (get().mode === 'neutral') return;
        void endSession();
        set({ mode: 'library' });
      },

      goToSettings: () => {
        set({ mode: get().mode === 'neutral' ? 'neutral' : 'settings' });
      },

      toggleBookmark: async (note = null) => {
        const { anchor, activeBook } = get();
        if (!anchor || !activeBook) return;
        try {
          const bookmark = await client.createBookmark(anchor, note);
          set({ bookmarks: [bookmark, ...get().bookmarks] });
        } catch (error) {
          set({ statusMessage: messageOf(error) });
        }
      },

      removeBookmark: async (bookmarkId) => {
        try {
          await client.deleteBookmark(bookmarkId);
          set({ bookmarks: get().bookmarks.filter((b) => b.id !== bookmarkId) });
        } catch (error) {
          set({ statusMessage: messageOf(error) });
        }
      },

      runSearch: async (query) => {
        const { activeBook } = get();
        set({ searchQuery: query });
        if (!activeBook || query.trim() === '') {
          set({ searchHits: [] });
          return;
        }
        try {
          const hits = await client.searchBook(activeBook.id, query);
          set({ searchHits: hits });
        } catch (error) {
          set({ statusMessage: messageOf(error) });
        }
      },

      clearSearch: () => set({ searchHits: [], searchQuery: '' }),

      deleteBook: async (bookId, deleteOriginal) => {
        try {
          await client.deleteBook(bookId, deleteOriginal);
          const { activeBook } = get();
          const removesActive = activeBook?.id === bookId;
          if (removesActive) await endSession();
          set({
            books: get().books.filter((b) => b.id !== bookId),
            ...(removesActive
              ? { activeBook: null, chapter: null, anchor: null, mode: 'library' as AppMode }
              : {}),
          });
        } catch (error) {
          set({ statusMessage: messageOf(error) });
        }
      },

      dismissShortcutWarning: () => set({ shortcutWarning: null }),
    };
  });

  return store;
}

export type AppStore = ReturnType<typeof createAppStore>;

/** Application-wide store instance used by the app shell. */
export const useAppStore = createAppStore();
