/**
 * Runtime boundary validation. Every payload coming from Rust crosses a trust
 * boundary (PRD section 4, "Trust boundaries") and is parsed through these
 * guards before entering React state. Validators narrow `unknown` — they never
 * accept `any` and never trust the message shape implicitly.
 */
import type { ReaderAnchor } from './anchor.js';
import type {
  BookDetails,
  BookSummary,
  ChapterDto,
  ChapterSummary,
  PaginatedBooks,
  ParagraphDto,
} from './book.js';
import type { Bookmark } from './bookmark.js';
import { isAppError, type AppError, type IpcResult } from './errors.js';
import type { AppSettings, HotkeyBinding, ReaderAction } from './settings.js';
import { isBookFormat, isSkinId, type SkinId } from './skin.js';

export interface SearchHit {
  chapterId: string;
  chapterOrdinal: number;
  chapterTitle: string;
  paragraphId: string;
  paragraphOrdinal: number;
  charOffset: number;
  snippet: string;
}

export interface ResumeResult {
  anchor: ReaderAnchor | null;
  fellBack: boolean;
  message: string | null;
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

function fail(path: string, expected: string): never {
  throw new ValidationError(`Malformed IPC payload at ${path}: expected ${expected}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function str(value: unknown, path: string): string {
  if (typeof value !== 'string') fail(path, 'string');
  return value;
}

function num(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) fail(path, 'finite number');
  return value;
}

function bool(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean') fail(path, 'boolean');
  return value;
}

function nullableStr(value: unknown, path: string): string | null {
  if (value === null) return null;
  return str(value, path);
}

function parseParagraph(value: unknown, path: string): ParagraphDto {
  if (!isRecord(value)) fail(path, 'object');
  return {
    id: str(value.id, `${path}.id`),
    ordinal: num(value.ordinal, `${path}.ordinal`),
    content: str(value.content, `${path}.content`),
  };
}

export function parseReaderAnchor(value: unknown): ReaderAnchor {
  if (!isRecord(value)) fail('anchor', 'object');
  const charOffset = num(value.charOffset, 'anchor.charOffset');
  const viewportFraction = num(value.viewportFraction, 'anchor.viewportFraction');
  if (charOffset < 0) fail('anchor.charOffset', 'value >= 0');
  if (viewportFraction < 0 || viewportFraction > 1) {
    fail('anchor.viewportFraction', 'value in [0, 1]');
  }
  return {
    bookId: str(value.bookId, 'anchor.bookId'),
    chapterId: str(value.chapterId, 'anchor.chapterId'),
    paragraphId: nullableStr(value.paragraphId, 'anchor.paragraphId'),
    charOffset,
    viewportFraction,
  };
}

export function parseChapterDto(value: unknown): ChapterDto {
  if (!isRecord(value)) fail('chapter', 'object');
  const rawParagraphs = value.paragraphs;
  if (!Array.isArray(rawParagraphs)) fail('chapter.paragraphs', 'array');
  return {
    id: str(value.id, 'chapter.id'),
    bookId: str(value.bookId, 'chapter.bookId'),
    ordinal: num(value.ordinal, 'chapter.ordinal'),
    title: str(value.title, 'chapter.title'),
    paragraphs: rawParagraphs.map((p, i) => parseParagraph(p, `chapter.paragraphs[${i}]`)),
  };
}

export function parseBookSummary(value: unknown, path = 'book'): BookSummary {
  if (!isRecord(value)) fail(path, 'object');
  const format = value.format;
  if (!isBookFormat(format)) fail(`${path}.format`, "'txt' | 'epub'");
  const lastAnchor = value.lastAnchor;
  return {
    id: str(value.id, `${path}.id`),
    title: str(value.title, `${path}.title`),
    author: nullableStr(value.author, `${path}.author`),
    format,
    language: nullableStr(value.language, `${path}.language`),
    chapterCount: num(value.chapterCount, `${path}.chapterCount`),
    createdAt: str(value.createdAt, `${path}.createdAt`),
    updatedAt: str(value.updatedAt, `${path}.updatedAt`),
    lastAnchor:
      lastAnchor === null || lastAnchor === undefined
        ? null
        : parseLastAnchor(lastAnchor, `${path}.lastAnchor`),
  };
}

function parseLastAnchor(
  value: unknown,
  path: string,
): { chapterId: string; chapterOrdinal: number; chapterTitle: string } {
  if (!isRecord(value)) fail(path, 'object');
  return {
    chapterId: str(value.chapterId, `${path}.chapterId`),
    chapterOrdinal: num(value.chapterOrdinal, `${path}.chapterOrdinal`),
    chapterTitle: str(value.chapterTitle, `${path}.chapterTitle`),
  };
}

export function parsePaginatedBooks(value: unknown): PaginatedBooks {
  if (!isRecord(value)) fail('paginatedBooks', 'object');
  const items = value.items;
  if (!Array.isArray(items)) fail('paginatedBooks.items', 'array');
  return {
    items: items.map((item, i) => parseBookSummary(item, `paginatedBooks.items[${i}]`)),
    page: num(value.page, 'paginatedBooks.page'),
    pageSize: num(value.pageSize, 'paginatedBooks.pageSize'),
    total: num(value.total, 'paginatedBooks.total'),
  };
}

export function parseChapterSummary(value: unknown, path = 'chapter'): ChapterSummary {
  if (!isRecord(value)) fail(path, 'object');
  return {
    id: str(value.id, `${path}.id`),
    bookId: str(value.bookId, `${path}.bookId`),
    ordinal: num(value.ordinal, `${path}.ordinal`),
    title: str(value.title, `${path}.title`),
    wordCount: num(value.wordCount, `${path}.wordCount`),
  };
}

export function parseChapterList(value: unknown): ChapterSummary[] {
  if (!Array.isArray(value)) fail('chapters', 'array');
  return value.map((item, i) => parseChapterSummary(item, `chapters[${i}]`));
}

export function parseBookDetails(value: unknown): BookDetails {
  const summary = parseBookSummary(value, 'book');
  if (!isRecord(value)) fail('book', 'object');
  return {
    ...summary,
    sourceName: str(value.sourceName, 'book.sourceName'),
    sourceSha256: str(value.sourceSha256, 'book.sourceSha256'),
    chapters: parseChapterList(value.chapters),
  };
}

export function parseSearchHit(value: unknown, path = 'hit'): SearchHit {
  if (!isRecord(value)) fail(path, 'object');
  return {
    chapterId: str(value.chapterId, `${path}.chapterId`),
    chapterOrdinal: num(value.chapterOrdinal, `${path}.chapterOrdinal`),
    chapterTitle: str(value.chapterTitle, `${path}.chapterTitle`),
    paragraphId: str(value.paragraphId, `${path}.paragraphId`),
    paragraphOrdinal: num(value.paragraphOrdinal, `${path}.paragraphOrdinal`),
    charOffset: num(value.charOffset, `${path}.charOffset`),
    snippet: str(value.snippet, `${path}.snippet`),
  };
}

export function parseSearchHits(value: unknown): SearchHit[] {
  if (!Array.isArray(value)) fail('hits', 'array');
  return value.map((item, i) => parseSearchHit(item, `hits[${i}]`));
}

export function parseResumeResult(value: unknown): ResumeResult {
  if (!isRecord(value)) fail('resume', 'object');
  const anchor = value.anchor;
  return {
    anchor: anchor === null || anchor === undefined ? null : parseReaderAnchor(anchor),
    fellBack: bool(value.fellBack, 'resume.fellBack'),
    message: nullableStr(value.message, 'resume.message'),
  };
}

export function parseBookmark(value: unknown, path = 'bookmark'): Bookmark {
  if (!isRecord(value)) fail(path, 'object');
  return {
    id: str(value.id, `${path}.id`),
    bookId: str(value.bookId, `${path}.bookId`),
    chapterId: str(value.chapterId, `${path}.chapterId`),
    chapterOrdinal: num(value.chapterOrdinal, `${path}.chapterOrdinal`),
    chapterTitle: str(value.chapterTitle, `${path}.chapterTitle`),
    paragraphId: nullableStr(value.paragraphId, `${path}.paragraphId`),
    charOffset: num(value.charOffset, `${path}.charOffset`),
    excerpt: nullableStr(value.excerpt, `${path}.excerpt`),
    note: nullableStr(value.note, `${path}.note`),
    createdAt: str(value.createdAt, `${path}.createdAt`),
  };
}

export function parseBookmarkList(value: unknown): Bookmark[] {
  if (!Array.isArray(value)) fail('bookmarks', 'array');
  return value.map((item, i) => parseBookmark(item, `bookmarks[${i}]`));
}

const READER_ACTIONS: readonly ReaderAction[] = [
  'quickSwitch',
  'restoreReading',
  'nextChapter',
  'prevChapter',
  'toggleBookmark',
  'openLibrary',
  'openSettings',
  'openSearch',
] as const;

function parseHotkey(value: unknown, path: string): HotkeyBinding {
  if (!isRecord(value)) fail(path, 'object');
  const action = value.action;
  if (typeof action !== 'string' || !(READER_ACTIONS as readonly string[]).includes(action)) {
    fail(`${path}.action`, 'known ReaderAction');
  }
  return { action: action as ReaderAction, accelerator: str(value.accelerator, `${path}.accelerator`) };
}

export function parseSettings(value: unknown): AppSettings {
  if (!isRecord(value)) fail('settings', 'object');
  const activeSkin = value.activeSkin;
  if (!isSkinId(activeSkin)) fail('settings.activeSkin', 'SkinId');
  const font = value.font;
  if (!isRecord(font)) fail('settings.font', 'object');
  const hotkeys = value.hotkeys;
  if (!Array.isArray(hotkeys)) fail('settings.hotkeys', 'array');
  const privacy = value.privacy;
  if (!isRecord(privacy)) fail('settings.privacy', 'object');
  return {
    activeSkin: activeSkin as SkinId,
    font: {
      family: str(font.family, 'settings.font.family'),
      size: num(font.size, 'settings.font.size'),
      lineHeight: num(font.lineHeight, 'settings.font.lineHeight'),
      width: num(font.width, 'settings.font.width'),
    },
    hotkeys: hotkeys.map((h, i) => parseHotkey(h, `settings.hotkeys[${i}]`)),
    privacy: {
      hideRecentBooks: bool(privacy.hideRecentBooks, 'settings.privacy.hideRecentBooks'),
      launchInNeutral: bool(privacy.launchInNeutral, 'settings.privacy.launchInNeutral'),
    },
    typewriterEnabled: bool(value.typewriterEnabled, 'settings.typewriterEnabled'),
    chapterTypingEnabled: value.chapterTypingEnabled === undefined ? true : bool(value.chapterTypingEnabled, 'settings.chapterTypingEnabled'),
    lineNumbers: bool(value.lineNumbers, 'settings.lineNumbers'),
    reducedMotion: bool(value.reducedMotion, 'settings.reducedMotion'),
  };
}

/**
 * Unwraps the `IpcResult` envelope produced by Rust commands, throwing a typed
 * error when the command reported failure or when the payload is malformed.
 */
export function unwrap<T>(raw: unknown, parse: (value: unknown) => T): T {
  if (!isRecord(raw)) fail('ipcResult', 'object');
  if (raw.ok === true) {
    return parse(raw.value);
  }
  if (raw.ok === false) {
    const error: AppError = isAppError(raw.error)
      ? raw.error
      : { code: 'DB_ERROR', message: 'Unknown backend error', recoverable: false };
    throw new IpcCommandError(error);
  }
  fail('ipcResult.ok', 'boolean');
}

export class IpcCommandError extends Error {
  readonly code: AppError['code'];
  readonly recoverable: boolean;

  constructor(error: AppError) {
    super(error.message);
    this.name = 'IpcCommandError';
    this.code = error.code;
    this.recoverable = error.recoverable;
  }
}

export function isIpcResult(value: unknown): value is IpcResult<unknown> {
  return isRecord(value) && typeof value.ok === 'boolean';
}
