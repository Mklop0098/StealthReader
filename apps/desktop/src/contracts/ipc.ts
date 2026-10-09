/**
 * Typed IPC client. Every command result is passed through a validator from
 * `@stealth-reader/shared-types`, so malformed payloads fail loudly here rather
 * than leaking untyped data into React state (PRD section 6).
 */
import { Channel, invoke } from '@tauri-apps/api/core';
import {
  IpcCommandError,
  parseBookDetails,
  parseBookmark,
  parseBookmarkList,
  parseBookSummary,
  parseChapterDto,
  parseChapterList,
  parsePaginatedBooks,
  parseReaderAnchor,
  parseResumeResult,
  parseSearchHits,
  parseSettings,
  unwrap,
  type AppSettings,
  type BookDetails,
  type Bookmark,
  type BookSummary,
  type ChapterDto,
  type ChapterSummary,
  type PaginatedBooks,
  type ReaderAnchor,
  type ResumeResult,
  type SearchHit,
} from '@stealth-reader/shared-types';

import {
  parseProgressAck,
  parseShortcutsRegistration,
  type ProgressAck,
  type ShortcutsRegistration,
} from './models.js';

type Parse<T> = (value: unknown) => T;

function describe(cause: unknown): string {
  if (typeof cause === 'string') return cause;
  if (cause instanceof Error) return cause.message;
  return 'Unknown transport error';
}

async function call<T>(
  command: string,
  args: Record<string, unknown>,
  parse: Parse<T>,
): Promise<T> {
  let raw: unknown;
  try {
    raw = await invoke<unknown>(command, args);
  } catch (cause) {
    throw new IpcCommandError({
      code: 'INVALID_INPUT',
      message: describe(cause),
      recoverable: true,
    });
  }
  return unwrap(raw, parse);
}

const parseNullableAnchor = (value: unknown): ReaderAnchor | null =>
  value === null || value === undefined ? null : parseReaderAnchor(value);

const parseVoid = (_value: unknown): void => undefined;

function parseId(value: unknown): string {
  if (typeof value !== 'string') {
    throw new Error('Malformed IPC payload: expected id string');
  }
  return value;
}

export interface ImportProgress {
  stage: 'reading' | 'parsing' | 'chapters' | 'copying' | 'saving' | 'complete' | 'opening';
  percent: number;
  completed: number;
  total: number;
}

export const ipc = {
  importBook: (path: string, onProgress?: (progress: ImportProgress) => void): Promise<BookSummary> => {
    const channel = new Channel<ImportProgress>();
    channel.onmessage = (progress) => {
      if (
        ['reading', 'parsing', 'chapters', 'copying', 'saving', 'complete'].includes(progress.stage) &&
        Number.isFinite(progress.percent) && progress.percent >= 0 && progress.percent <= 100 &&
        Number.isInteger(progress.completed) && progress.completed >= 0 &&
        Number.isInteger(progress.total) && progress.total >= progress.completed
      ) onProgress?.(progress);
    };
    return call('import_book', { path, onProgress: channel }, parseBookSummary);
  },

  listBooks: (query: string | null, page = 0, pageSize = 50): Promise<PaginatedBooks> =>
    call('list_books', { query, page, pageSize }, parsePaginatedBooks),

  getBook: (bookId: string): Promise<BookDetails> =>
    call('get_book', { bookId }, parseBookDetails),

  listChapters: (bookId: string): Promise<ChapterSummary[]> =>
    call('list_chapters', { bookId }, parseChapterList),

  getChapter: (chapterId: string): Promise<ChapterDto> =>
    call('get_chapter', { chapterId }, parseChapterDto),

  deleteBook: (bookId: string, deleteOriginal: boolean): Promise<void> =>
    call('delete_book', { bookId, deleteOriginal }, parseVoid),

  saveProgress: (anchor: ReaderAnchor, seq: number): Promise<ProgressAck> =>
    call('save_progress', { anchor, seq }, parseProgressAck),

  getProgress: (bookId: string): Promise<ReaderAnchor | null> =>
    call('get_progress', { bookId }, parseNullableAnchor),

  resumeBook: (bookId: string): Promise<ResumeResult> =>
    call('resume_book', { bookId }, parseResumeResult),

  createBookmark: (anchor: ReaderAnchor, note: string | null): Promise<Bookmark> =>
    call('create_bookmark', { anchor, note }, parseBookmark),

  listBookmarks: (bookId: string): Promise<Bookmark[]> =>
    call('list_bookmarks', { bookId }, parseBookmarkList),

  deleteBookmark: (bookmarkId: string): Promise<void> =>
    call('delete_bookmark', { bookmarkId }, parseVoid),

  searchBook: (bookId: string, query: string, limit = 50): Promise<SearchHit[]> =>
    call('search_book', { bookId, query, limit }, parseSearchHits),

  startSession: (bookId: string | null, skinId: string): Promise<string> =>
    call('start_session', { bookId, skinId }, parseId),

  endSession: (sessionId: string): Promise<void> =>
    call('end_session', { sessionId }, parseVoid),

  getSettings: (): Promise<AppSettings> => call('get_settings', {}, parseSettings),

  updateSettings: (settings: AppSettings): Promise<AppSettings> =>
    call('update_settings', { settings }, parseSettings),

  registerShortcuts: (
    quickSwitch: string,
    restoreReading: string,
  ): Promise<ShortcutsRegistration> =>
    call('register_shortcuts', { quickSwitch, restoreReading }, parseShortcutsRegistration),

  setWindowTitle: (title: string): Promise<void> =>
    call('set_window_title', { title }, parseVoid),
};

export type IpcClient = typeof ipc;
