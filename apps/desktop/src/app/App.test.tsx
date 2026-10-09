import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './App.js';
import { createAppStore } from './store.js';
import { makeFakeClient, SECRET_TEXT } from '../test/fakeClient.js';

describe('App shell', () => {
  it('keeps book and chapter titles out of the VS Code screen including reader controls', async () => {
    const store = createAppStore(makeFakeClient());
    await store.getState().bootstrap();
    await store.getState().openBook('book-1');
    const { container } = render(<App store={store} />);
    expect(container.innerHTML).not.toContain('Nightfall Archive');
    expect(container.innerHTML).not.toContain('Chapter One');
    expect(container.innerHTML).not.toContain('Chapter Two');
  });

  it('offers clearly named skins and preserves the reading position when switching', async () => {
    const store = createAppStore(makeFakeClient());
    await store.getState().bootstrap();
    await store.getState().openBook('book-1');
    const before = store.getState().anchor;
    render(<App store={store} />);
    fireEvent.click(screen.getByRole('button', { name: 'Excel' }));
    await waitFor(() => expect(store.getState().settings.activeSkin).toBe('excel'));
    expect(store.getState().anchor).toEqual(before);
    fireEvent.click(screen.getByRole('button', { name: 'Terminal' }));
    await waitFor(() => expect(screen.getByText('C:\\WINDOWS\\system32\\cmd.exe')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'VS Code' }));
    await waitFor(() => expect(screen.getByRole('complementary', { name: 'Explorer' })).toBeInTheDocument());
    expect(store.getState().anchor).toEqual(before);
  });

  it('shows chapter import progress and disables conflicting library actions', async () => {
    const store = createAppStore(makeFakeClient());
    await store.getState().bootstrap();
    store.setState({
      busy: true,
      importProgress: { stage: 'chapters', percent: 42, completed: 10, total: 20 },
    });
    render(<App store={store} />);
    expect(await screen.findByText('Processing chapters (10/20)…')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Import progress' })).toHaveAttribute('value', '42');
    expect(screen.getByRole('button', { name: 'Import book' })).toBeDisabled();
    expect(screen.getByRole('searchbox', { name: 'Search library' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Delete Nightfall Archive' })).toBeDisabled();
  });

  it('shows the library once bootstrapped', async () => {
    const store = createAppStore(makeFakeClient());
    await store.getState().bootstrap();

    render(<App store={store} />);

    expect(await screen.findByRole('heading', { name: 'Library' })).toBeInTheDocument();
    expect(screen.getByText('Nightfall Archive')).toBeInTheDocument();
  });

  it('leaks no book content while neutral is active (AT-06, AT-14)', async () => {
    const store = createAppStore(makeFakeClient());
    await store.getState().bootstrap();
    await store.getState().openBook('book-1');
    store.getState().quickSwitch();

    const { container } = render(<App store={store} />);

    expect(store.getState().mode).toBe('neutral');
    const text = container.textContent ?? '';
    expect(text).not.toContain(SECRET_TEXT);
    expect(text).not.toContain('Nightfall');
    expect(text).not.toContain('Chapter One');
  });

  it('restores reading from the neutral workspace (AT-07)', async () => {
    const store = createAppStore(makeFakeClient());
    await store.getState().bootstrap();
    await store.getState().openBook('book-1');
    store.getState().quickSwitch();

    render(<App store={store} />);
    fireEvent.click(await screen.findByRole('button', { name: /restore reading/i }));

    expect(store.getState().mode).toBe('reading');
  });
});
