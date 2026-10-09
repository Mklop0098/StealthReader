import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeChapter } from '../../test/fakeClient.js';
import { useChapterTyping } from './typing.js';

const chapter = makeChapter({ paragraphs: [{ id: 'p-1', ordinal: 0, content: 'a'.repeat(200) }] });
const anchor = { bookId: chapter.bookId, chapterId: chapter.id, paragraphId: null, charOffset: 0, viewportFraction: 0 };
const props = { chapter, anchor, enabled: true, reducedMotion: false };
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('chapter typing', () => {
  it('reveals characters and resets on another chapter with the same paragraph count', () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'performance'] });
    const { result, rerender, unmount } = renderHook(useChapterTyping, { initialProps: props });
    expect(result.current.visibleText(0)).toBe('');
    act(() => vi.advanceTimersByTime(500));
    expect(result.current.visibleText(0).length).toBeGreaterThan(0);
    expect(result.current.visibleText(0).length).toBeLessThan(200);
    const next = makeChapter({ ...chapter, id: 'next', paragraphs: [{ id: 'p-next', ordinal: 0, content: 'b'.repeat(200) }] });
    rerender({ ...props, chapter: next, anchor: { ...anchor, chapterId: next.id } });
    expect(result.current.visibleText(0)).toBe('');
    act(() => vi.advanceTimersByTime(4000));
    expect(result.current.visibleText(0)).toBe('b'.repeat(200));
    expect(result.current.isTyping).toBe(false);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('caps animation duration on a huge chapter, supports skip and cleans up on unmount', () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'performance'] });
    const large = makeChapter({ paragraphs: [{ id: 'p-1', ordinal: 0, content: 'x'.repeat(100_000) }] });
    const { result, rerender, unmount } = renderHook(useChapterTyping, { initialProps: { ...props, chapter: large } });
    act(() => vi.advanceTimersByTime(3600));
    expect(result.current.visibleText(0).length).toBe(100_000);
    rerender({ ...props, chapter: { ...large, id: 'another' } });
    act(() => result.current.finish());
    expect(result.current.isTyping).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
    rerender({ ...props, chapter: { ...large, id: 'third' } });
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('respects reduced motion and the animation setting', () => {
    const { result, rerender } = renderHook(useChapterTyping, { initialProps: { ...props, reducedMotion: true } });
    expect(result.current.visibleText(0)).toBe(chapter.paragraphs[0]!.content);
    expect(result.current.isTyping).toBe(false);
    rerender({ ...props, enabled: false, reducedMotion: false });
    expect(result.current.isTyping).toBe(false);
  });

  it('does not split emoji and starts at the saved paragraph', () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'performance'] });
    const unicode = makeChapter({ paragraphs: [
      { id: 'before', ordinal: 0, content: 'Already read' },
      { id: 'saved', ordinal: 1, content: '😀'.repeat(150) },
    ] });
    const { result } = renderHook(useChapterTyping, { initialProps: { ...props, chapter: unicode, anchor: { ...anchor, paragraphId: 'saved' } } });
    expect(result.current.visibleText(0)).toBe('Already read');
    for (let tick = 0; tick < 20; tick++) {
      act(() => vi.advanceTimersByTime(32));
      expect(result.current.visibleText(1).length % 2).toBe(0);
    }
  });

  it('does not animate when the operating system requests reduced motion', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    const { result } = renderHook(useChapterTyping, { initialProps: props });
    expect(result.current.isTyping).toBe(false);
  });
});
