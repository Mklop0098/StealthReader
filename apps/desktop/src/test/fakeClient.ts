import {
  DEFAULT_SETTINGS,
  type BookDetails,
  type BookSummary,
  type Bookmark,
  type ChapterDto,
} from '@stealth-reader/shared-types';
import type { IpcClient } from '../contracts/ipc.js';

/** A distinctive string that must never appear in a neutral view. */
export const SECRET_TEXT = 'SECRET-NOVEL-TEXT-42';

export function makeChapter(overrides: Partial<ChapterDto> = {}): ChapterDto {
  return {
    id: 'chapter-1',
    bookId: 'book-1',
    ordinal: 0,
    title: 'Chapter One',
    paragraphs: [
      { id: 'p-1', ordinal: 0, content: `${SECRET_TEXT} opening line.` },
      { id: 'p-2', ordinal: 1, content: 'A second paragraph of the novel.' },
      { id: 'p-3', ordinal: 2, content: 'A third paragraph of the novel.' },
    ],
    ...overrides,
  };
}

export function makeSummary(overrides: Partial<BookSummary> = {}): BookSummary {
  return {
    id: 'book-1',
    title: 'Nightfall Archive',
    author: 'A. Writer',
    format: 'txt',
    language: 'en',
    chapterCount: 2,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    lastAnchor: null,
    ...overrides,
  };
}

export function makeBook(overrides: Partial<BookDetails> = {}): BookDetails {
  return {
    ...makeSummary(),
    sourceName: 'nightfall.txt',
    sourceSha256: 'a'.repeat(64),
    chapters: [
      { id: 'chapter-1', bookId: 'book-1', ordinal: 0, title: 'Chapter One', wordCount: 12 },
      { id: 'chapter-2', bookId: 'book-1', ordinal: 1, title: 'Chapter Two', wordCount: 9 },
    ],
    ...overrides,
  };
}

export function makeBookmark(overrides: Partial<Bookmark> = {}): Bookmark {
  return {
    id: 'bookmark-1',
    bookId: 'book-1',
    chapterId: 'chapter-1',
    chapterOrdinal: 0,
    chapterTitle: 'Chapter One',
    paragraphId: 'p-2',
    charOffset: 0,
    excerpt: 'A second paragraph…',
    note: null,
    createdAt: '2026-01-02T00:00:00.000Z',
    ...overrides,
  };
}

export function makeFakeClient(overrides: Partial<IpcClient> = {}): IpcClient {
  const book = makeBook();
  const base: IpcClient = {
    importBook: async () => makeSummary(),
    listBooks: async () => ({ items: [makeSummary()], page: 0, pageSize: 50, total: 1 }),
    getBook: async () => book,
    listChapters: async () => book.chapters,
    getChapter: async () => makeChapter(),
    deleteBook: async () => undefined,
    saveProgress: async (_anchor, seq) => ({ revision: seq, applied: true }),
    getProgress: async () => null,
    resumeBook: async () => ({ anchor: null, fellBack: false, message: null }),
    createBookmark: async () => makeBookmark(),
    listBookmarks: async () => [],
    deleteBookmark: async () => undefined,
    searchBook: async () => [],
    startSession: async () => 'session-1',
    endSession: async () => undefined,
    getSettings: async () => DEFAULT_SETTINGS,
    updateSettings: async (settings) => settings,
    registerShortcuts: async (quickSwitch, restoreReading) => ({
      quickSwitch: { registered: true, accelerator: quickSwitch, reason: null },
      restoreReading: { registered: true, accelerator: restoreReading, reason: null },
    }),
    setWindowTitle: async () => undefined,
  };
  return { ...base, ...overrides };
}
