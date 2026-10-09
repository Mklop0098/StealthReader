export interface Bookmark {
  id: string;
  bookId: string;
  chapterId: string;
  chapterOrdinal: number;
  chapterTitle: string;
  paragraphId: string | null;
  charOffset: number;
  /** Short excerpt shown in the bookmark list (bounded length, safe to display). */
  excerpt: string | null;
  note: string | null;
  createdAt: string;
}
