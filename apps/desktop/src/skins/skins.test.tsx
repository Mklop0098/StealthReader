import { fireEvent, render, screen } from '@testing-library/react';
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
      fireEvent.click(screen.getByRole(skin.id === 'excel' ? 'tab' : 'button', { name: skin.id === 'vscode' ? 'aggregate.ts' : /Chapter Two/ }));
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
    for (const skin of readerSkins) {
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
});
