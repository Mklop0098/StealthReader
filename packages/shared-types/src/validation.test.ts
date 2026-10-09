import { describe, expect, it } from 'vitest';
import {
  IpcCommandError,
  ValidationError,
  parseBookSummary,
  parseChapterDto,
  parsePaginatedBooks,
  parseReaderAnchor,
  parseSettings,
  unwrap,
  DEFAULT_SETTINGS,
} from './index.js';

describe('anchor validation', () => {
  it('enables chapter typing for legacy settings without resetting other preferences', () => {
    const { chapterTypingEnabled: _old, ...legacy } = DEFAULT_SETTINGS;
    const parsed = parseSettings({ ...legacy, activeSkin: 'terminal' });
    expect(parsed.chapterTypingEnabled).toBe(true);
    expect(parsed.activeSkin).toBe('terminal');
    expect(parseSettings({ ...legacy, chapterTypingEnabled: false }).chapterTypingEnabled).toBe(false);
  });
  it('accepts a well-formed anchor', () => {
    const anchor = parseReaderAnchor({
      bookId: 'b',
      chapterId: 'c',
      paragraphId: null,
      charOffset: 3,
      viewportFraction: 0.5,
    });
    expect(anchor.charOffset).toBe(3);
  });

  it('rejects an out-of-range viewport fraction', () => {
    expect(() =>
      parseReaderAnchor({
        bookId: 'b',
        chapterId: 'c',
        paragraphId: null,
        charOffset: 0,
        viewportFraction: 1.5,
      }),
    ).toThrow(ValidationError);
  });

  it('rejects a negative char offset', () => {
    expect(() =>
      parseReaderAnchor({
        bookId: 'b',
        chapterId: 'c',
        paragraphId: null,
        charOffset: -1,
        viewportFraction: 0,
      }),
    ).toThrow(ValidationError);
  });
});

describe('chapter validation', () => {
  it('validates nested paragraphs', () => {
    const chapter = parseChapterDto({
      id: 'c',
      bookId: 'b',
      ordinal: 0,
      title: 'One',
      paragraphs: [{ id: 'p', ordinal: 0, content: 'hello' }],
    });
    expect(chapter.paragraphs[0]?.content).toBe('hello');
  });

  it('rejects malformed paragraph content', () => {
    expect(() =>
      parseChapterDto({
        id: 'c',
        bookId: 'b',
        ordinal: 0,
        title: 'One',
        paragraphs: [{ id: 'p', ordinal: 0, content: 42 }],
      }),
    ).toThrow(ValidationError);
  });
});

describe('book validation', () => {
  it('rejects an unknown format', () => {
    expect(() =>
      parseBookSummary({
        id: 'b',
        title: 't',
        author: null,
        format: 'pdf',
        language: null,
        chapterCount: 1,
        createdAt: 'x',
        updatedAt: 'x',
        lastAnchor: null,
      }),
    ).toThrow(ValidationError);
  });

  it('validates a paginated list', () => {
    const page = parsePaginatedBooks({
      items: [],
      page: 0,
      pageSize: 50,
      total: 0,
    });
    expect(page.total).toBe(0);
  });
});

describe('settings validation', () => {
  it('accepts the default settings shape', () => {
    expect(parseSettings(DEFAULT_SETTINGS).activeSkin).toBe('vscode');
  });
});

describe('ipc envelope unwrapping', () => {
  it('returns the value on success', () => {
    const value = unwrap({ ok: true, value: 7 }, (raw) => raw as number);
    expect(value).toBe(7);
  });

  it('throws a typed IpcCommandError on failure', () => {
    try {
      unwrap(
        { ok: false, error: { code: 'NOT_FOUND', message: 'missing', recoverable: true } },
        (raw) => raw,
      );
      throw new Error('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(IpcCommandError);
      expect((error as IpcCommandError).code).toBe('NOT_FOUND');
    }
  });
});
