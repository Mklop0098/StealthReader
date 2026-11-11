import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS, type ReaderAnchor } from '@stealth-reader/shared-types';
import { readerSkins } from './registry.js';
import { makeBook, makeChapter, SECRET_TEXT } from '../test/fakeClient.js';
import type { ReaderViewProps } from '@stealth-reader/skin-sdk';

const chapter = makeChapter();
const book = makeBook();

const anchor: ReaderAnchor = {
  bookId: 'book-1',
  chapterId: 'chapter-1',
  paragraphId: 'p-1',
  charOffset: 0,
  viewportFraction: 0,
};

const readerProps: ReaderViewProps = {
  chapter,
  anchor,
  onAnchorChange: () => {},
  book: { id: 'book-1', title: 'Nightfall Archive' },
  chapters: book.chapters,
  onSelectChapter: () => {},
  onStepChapter: () => {},
  settings: DEFAULT_SETTINGS,
};

describe('reader skins', () => {
  it('keeps chapter selection and navigation functional in all three skins', () => {
    for (const skin of readerSkins) {
      const onSelectChapter = vi.fn();
      const onStepChapter = vi.fn();
      const { unmount } = render(<skin.ReaderView {...readerProps} onSelectChapter={onSelectChapter} onStepChapter={onStepChapter} />);
      if (skin.id === 'terminal') fireEvent.click(screen.getByText('Chapters ⌄'));
      if (skin.id === 'claude') {
        const reply = screen.getByRole('textbox', { name: 'Reply' });
        fireEvent.change(reply, { target: { value: '2' } });
        fireEvent.keyDown(reply, { key: 'Enter' });
      } else {
        fireEvent.click(screen.getByRole(skin.id === 'excel' ? 'tab' : 'button', { name: skin.id === 'vscode' ? 'aggregate.ts' : /Chapter Two/ }));
      }
      expect(onSelectChapter).toHaveBeenCalledWith('chapter-2');
      fireEvent.click(screen.getByRole('button', { name: skin.id === 'excel' ? 'Next sheet' : 'Next chapter' }));
      expect(onStepChapter).toHaveBeenCalledWith(1);
      unmount();
    }
  });

  it('renders book text in every reading surface', () => {
    for (const skin of readerSkins) {
      const { unmount } = render(<skin.ReaderView {...readerProps} />);
      expect(document.body.textContent).toContain(SECRET_TEXT);
      unmount();
    }
  });

  it('lists chapters in every reading surface', () => {
    for (const skin of readerSkins.filter(s => s.id !== 'claude')) {
      const { unmount } = render(<skin.ReaderView {...readerProps} />);
      expect(document.body.textContent).toContain(skin.id === 'vscode' ? 'aggregate.ts' : 'Chapter Two');
      unmount();
    }
  });

  it('keeps VS Code book and chapter titles out of visible chrome and attributes', () => {
    const skin = readerSkins.find(s => s.id === 'vscode')!;
    const { container } = render(<skin.ReaderView {...readerProps} />);
    expect(container.innerHTML).not.toContain('Nightfall Archive');
    expect(container.innerHTML).not.toContain('Chapter One');
    expect(container.innerHTML).not.toContain('Chapter Two');
    expect(container.textContent).not.toContain('chapters');
  });

  it('offers a skip control and cancels typing immediately in every skin', () => {
    for (const skin of readerSkins) {
      const { container, unmount } = render(<skin.ReaderView {...readerProps} />);
      expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
      fireEvent.click(screen.getByRole('button', { name: 'Finish typing' }));
      expect(container.querySelector('[aria-busy="true"]')).toBeNull();
      expect(container.querySelector('.typing-visible')?.textContent).toContain(SECRET_TEXT);
      unmount();
    }
  });

  it('never renders book text or metadata in a neutral view (AT-14)', () => {
    for (const skin of readerSkins) {
      const { container, unmount } = render(<skin.NeutralView elapsedMs={1000} />);
      const text = container.textContent ?? '';
      expect(text).not.toContain(SECRET_TEXT);
      expect(text).not.toContain('Nightfall');
      expect(text).not.toContain('Chapter One');
      unmount();
    }
  });

  it('Claude skin keeps chapters out of the sidebar and jumps by typed number', () => {
    const skin = readerSkins.find(s => s.id === 'claude')!;
    const onSelectChapter = vi.fn();
    const { container } = render(<skin.ReaderView {...readerProps} onSelectChapter={onSelectChapter} />);
    expect(container.querySelector('.cld-sidebar')?.textContent).not.toContain('Chapter');
    expect(container.querySelector('.cld-chat-title')?.textContent).toContain('Chapter One');
    const reply = screen.getByRole('textbox', { name: 'Reply' }) as HTMLInputElement;
    fireEvent.change(reply, { target: { value: '99' } });
    fireEvent.keyDown(reply, { key: 'Enter' });
    expect(onSelectChapter).not.toHaveBeenCalled();
    expect(reply.value).toBe('99');
    fireEvent.change(reply, { target: { value: 'hello' } });
    fireEvent.keyDown(reply, { key: 'Enter' });
    expect(onSelectChapter).not.toHaveBeenCalled();
    fireEvent.change(reply, { target: { value: '1' } });
    fireEvent.keyDown(reply, { key: 'Enter' });
    expect(onSelectChapter).toHaveBeenCalledWith('chapter-1');
    expect(reply.value).toBe('');
  });

  it('Claude skin shows a thinking indicator for 2s before typing, and skip clears it', () => {
    vi.useFakeTimers();
    try {
      const skin = readerSkins.find(s => s.id === 'claude')!;
      const first = render(<skin.ReaderView {...readerProps} />);
      expect(screen.getByRole('status', { name: 'Thinking' })).toBeTruthy();
      expect(first.container.querySelector('[aria-busy="true"]')).not.toBeNull();
      act(() => { vi.advanceTimersByTime(2000); });
      expect(screen.queryByRole('status', { name: 'Thinking' })).toBeNull();
      first.unmount();

      const second = render(<skin.ReaderView {...readerProps} />);
      fireEvent.click(screen.getByRole('button', { name: 'Finish typing' }));
      expect(screen.queryByRole('status', { name: 'Thinking' })).toBeNull();
      expect(second.container.querySelector('[aria-busy="true"]')).toBeNull();
      expect(second.container.querySelector('.typing-visible')?.textContent).toContain(SECRET_TEXT);
      second.unmount();
    } finally {
      vi.useRealTimers();
    }
  });
});

