import { useState } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import type { BookSummary } from '@stealth-reader/shared-types';
import type { AppStore } from '../../app/store.js';
import { Modal } from '../../components/ui/Modal.js';

interface LibraryViewProps {
  store: AppStore;
}

export function LibraryView({ store }: LibraryViewProps) {
  const books = store((s) => s.books);
  const bookQuery = store((s) => s.bookQuery);
  const busy = store((s) => s.busy);
  const importProgress = store((s) => s.importProgress);
  const statusMessage = store((s) => s.statusMessage);
  const refreshBooks = store((s) => s.refreshBooks);
  const importBook = store((s) => s.importBook);
  const openBook = store((s) => s.openBook);
  const deleteBook = store((s) => s.deleteBook);
  const goToSettings = store((s) => s.goToSettings);

  const [pendingDelete, setPendingDelete] = useState<BookSummary | null>(null);
  const [deleteOriginal, setDeleteOriginal] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleImport = async (): Promise<void> => {
    setLocalError(null);
    try {
      const selection = await open({
        multiple: false,
        directory: false,
        filters: [{ name: 'Books', extensions: ['txt', 'epub'] }],
      });
      if (typeof selection === 'string') {
        await importBook(selection);
      }
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : 'Import failed');
    }
  };

  const confirmDelete = async (): Promise<void> => {
    if (!pendingDelete) return;
    await deleteBook(pendingDelete.id, deleteOriginal);
    setPendingDelete(null);
    setDeleteOriginal(false);
  };

  return (
    <div className="library">
      <header className="library-header">
        <div>
          <h1>Library</h1>
          <p className="muted">Offline books stored on this device only.</p>
        </div>
        <div className="library-actions">
          <input
            type="search"
            className="text-input"
            placeholder="Search title or author"
            value={bookQuery}
            aria-label="Search library"
            disabled={importProgress !== null}
            onChange={(event) => void refreshBooks(event.target.value)}
          />
          <button type="button" className="button primary" onClick={() => void handleImport()} disabled={busy}>
            Import book
          </button>
          <button type="button" className="button" onClick={goToSettings}>
            Settings
          </button>
        </div>
      </header>

      {importProgress && (
        <div className="import-progress" role="status" aria-live="polite">
          <div className="import-progress-label">
            <span>
              {importProgress.stage === 'reading' ? 'Reading file…' :
                importProgress.stage === 'parsing' ? 'Analyzing book…' :
                importProgress.stage === 'chapters' ? `Processing chapters (${importProgress.completed}/${importProgress.total})…` :
                importProgress.stage === 'copying' ? 'Copying original file…' :
                importProgress.stage === 'saving' ? 'Saving book…' : 'Opening book…'}
            </span>
            <span>{importProgress.percent}%</span>
          </div>
          <progress aria-label="Import progress" value={importProgress.percent} max={100} />
        </div>
      )}

      {(statusMessage || localError) && (
        <div className="banner error" role="alert">
          {localError ?? statusMessage}
        </div>
      )}

      {books.length === 0 ? (
        <div className="empty-state">
          <p>No books yet. Import a UTF-8 TXT or a DRM-free EPUB to begin.</p>
        </div>
      ) : (
        <ul className="book-grid">
          {books.map((book) => (
            <li key={book.id} className="book-card">
              <button type="button" className="book-open" disabled={importProgress !== null} onClick={() => void openBook(book.id)}>
                <span className="book-title">{book.title}</span>
                <span className="book-meta">
                  <span className={`badge badge-${book.format}`}>{book.format.toUpperCase()}</span>
                  {book.author ? <span>{book.author}</span> : null}
                  <span>{book.chapterCount} chapters</span>
                </span>
                {book.lastAnchor ? (
                  <span className="book-progress">
                    {book.lastAnchor.chapterOrdinal + 1}. {book.lastAnchor.chapterTitle}
                  </span>
                ) : (
                  <span className="book-progress muted">Not started</span>
                )}
              </button>
              <button
                type="button"
                className="button danger"
                onClick={() => setPendingDelete(book)}
                aria-label={`Delete ${book.title}`}
                disabled={importProgress !== null}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}

      {pendingDelete && (
        <Modal title="Delete book" onClose={() => setPendingDelete(null)}>
          <p>
            Delete <strong>{pendingDelete.title}</strong> and all reading progress and bookmarks?
          </p>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={deleteOriginal}
              onChange={(event) => setDeleteOriginal(event.target.checked)}
            />
            Also remove the retained copy of the imported file
          </label>
          <div className="modal-actions">
            <button type="button" className="button" onClick={() => setPendingDelete(null)}>
              Cancel
            </button>
            <button type="button" className="button danger" onClick={() => void confirmDelete()}>
              Delete
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
