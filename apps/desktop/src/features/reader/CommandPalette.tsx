import type { AppStore } from '../../app/store.js';
import { Modal } from '../../components/ui/Modal.js';

interface CommandPaletteProps {
  store: AppStore;
  onClose: () => void;
}

export function CommandPalette({ store, onClose }: CommandPaletteProps) {
  const bookmarks = store((s) => s.bookmarks);
  const searchHits = store((s) => s.searchHits);
  const searchQuery = store((s) => s.searchQuery);
  const runSearch = store((s) => s.runSearch);
  const removeBookmark = store((s) => s.removeBookmark);
  const toggleBookmark = store((s) => s.toggleBookmark);
  const openChapter = store((s) => s.openChapter);

  const jump = async (chapterId: string, paragraphId: string | null): Promise<void> => {
    await openChapter(chapterId, paragraphId);
    onClose();
  };

  return (
    <Modal title="Bookmarks and search" onClose={onClose}>
      <div className="palette-toolbar">
        <button type="button" className="button" onClick={() => void toggleBookmark()}>
          Bookmark current position
        </button>
        <input
          type="search"
          className="text-input"
          placeholder="Search in this book"
          aria-label="Search in book"
          value={searchQuery}
          onChange={(event) => void runSearch(event.target.value)}
        />
      </div>

      <div className="palette-columns">
        <section aria-label="Bookmarks">
          <h3>Bookmarks ({bookmarks.length})</h3>
          <ul className="palette-list">
            {bookmarks.length === 0 && <li className="muted">No bookmarks yet.</li>}
            {bookmarks.map((bookmark) => (
              <li key={bookmark.id}>
                <button
                  type="button"
                  className="palette-item"
                  onClick={() => void jump(bookmark.chapterId, bookmark.paragraphId)}
                >
                  <span className="palette-item-title">
                    {bookmark.chapterOrdinal + 1}. {bookmark.chapterTitle}
                  </span>
                  <span className="palette-item-sub">{bookmark.excerpt ?? ''}</span>
                </button>
                <button
                  type="button"
                  className="icon-button"
                  aria-label="Remove bookmark"
                  onClick={() => void removeBookmark(bookmark.id)}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section aria-label="Search results">
          <h3>Search results ({searchHits.length})</h3>
          <ul className="palette-list">
            {searchHits.length === 0 && <li className="muted">No results.</li>}
            {searchHits.map((hit) => (
              <li key={`${hit.paragraphId}:${hit.charOffset}`}>
                <button
                  type="button"
                  className="palette-item"
                  onClick={() => void jump(hit.chapterId, hit.paragraphId)}
                >
                  <span className="palette-item-title">
                    {hit.chapterOrdinal + 1}. {hit.chapterTitle}
                  </span>
                  <span className="palette-item-sub">{hit.snippet}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </Modal>
  );
}
