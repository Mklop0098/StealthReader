/**
 * Canonical reading anchor. Paragraph identity + Unicode-scalar offset is
 * authoritative; viewportFraction is advisory only and must never be used to
 * relocate a reader on its own (see PRD section 5, "Text anchor semantics").
 */
export interface ReaderAnchor {
  bookId: string;
  chapterId: string;
  paragraphId: string | null;
  /** Offset in Unicode scalar values (not UTF-16 code units). */
  charOffset: number;
  /** Advisory scroll position within the chapter, 0..1. */
  viewportFraction: number;
}

/** Anchor without the identifying bookId, as used when saving a chapter-local position. */
export interface ChapterAnchor {
  chapterId: string;
  paragraphId: string | null;
  charOffset: number;
  viewportFraction: number;
}
