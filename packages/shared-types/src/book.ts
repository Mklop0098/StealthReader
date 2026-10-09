import type { BookFormat } from './skin.js';

/** Lightweight book record shown in the library list. */
export interface BookSummary {
  id: string;
  title: string;
  author: string | null;
  format: BookFormat;
  language: string | null;
  chapterCount: number;
  createdAt: string;
  updatedAt: string;
  /** Last committed anchor, if the book has been opened before. */
  lastAnchor: { chapterId: string; chapterOrdinal: number; chapterTitle: string } | null;
}

export interface BookDetails extends BookSummary {
  sourceName: string;
  sourceSha256: string;
  chapters: ChapterSummary[];
}

export interface ChapterSummary {
  id: string;
  bookId: string;
  ordinal: number;
  title: string;
  wordCount: number;
}

export interface ParagraphDto {
  id: string;
  ordinal: number;
  content: string;
}

/** Full chapter payload handed to a skin. Text is already sanitized plain text. */
export interface ChapterDto {
  id: string;
  bookId: string;
  ordinal: number;
  title: string;
  paragraphs: ParagraphDto[];
}

export interface PaginatedBooks {
  items: BookSummary[];
  page: number;
  pageSize: number;
  total: number;
}

export interface ListBooksQuery {
  query?: string;
  page?: number;
  pageSize?: number;
}
