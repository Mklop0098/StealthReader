use rusqlite::{params, OptionalExtension, Row, Transaction};

use crate::domain::models::{
    BookDetails, BookSummary, ChapterDto, ChapterSummary, ImportedBook, LastAnchorRef,
    PaginatedBooks, ParagraphDto,
};
use crate::error::{CoreError, CoreResult};
use crate::util::{new_id, now_iso};

use super::Repository;

/// Minimal chapter identity used for navigation and resume.
#[derive(Debug, Clone)]
pub struct ChapterRef {
    pub id: String,
    pub ordinal: i64,
    pub title: String,
}

fn map_book_summary(row: &Row<'_>) -> rusqlite::Result<BookSummary> {
    let progress_chapter: Option<String> = row.get(8)?;
    let last_anchor = match progress_chapter {
        Some(chapter_id) => Some(LastAnchorRef {
            chapter_id,
            chapter_ordinal: row.get::<_, Option<i64>>(9)?.unwrap_or(0),
            chapter_title: row.get::<_, Option<String>>(10)?.unwrap_or_default(),
        }),
        None => None,
    };
    Ok(BookSummary {
        id: row.get(0)?,
        title: row.get(1)?,
        author: row.get(2)?,
        format: row.get(3)?,
        language: row.get(4)?,
        chapter_count: row.get(5)?,
        created_at: row.get(6)?,
        updated_at: row.get(7)?,
        last_anchor,
    })
}

const BOOK_SELECT: &str = "SELECT b.id, b.title, b.author, b.format, b.language,
        (SELECT COUNT(*) FROM chapters c WHERE c.book_id = b.id) AS chapter_count,
        b.created_at, b.updated_at,
        rp.chapter_id, ch.ordinal, ch.title
    FROM books b
    LEFT JOIN reading_progress rp ON rp.book_id = b.id
    LEFT JOIN chapters ch ON ch.id = rp.chapter_id";

impl Repository {
    /// Inserts a fully parsed book, its chapters and paragraphs in one
    /// transaction (PRD section 5, consistency rules).
    pub fn insert_imported_book(&mut self, book: &ImportedBook) -> CoreResult<String> {
        let book_id = new_id();
        let now = now_iso();
        let mut tx = self.connection().unchecked_transaction()?;
        insert_book_rows(&mut tx, &book_id, book, &now)?;
        tx.commit()?;
        Ok(book_id)
    }

    pub fn list_books(
        &self,
        query: Option<&str>,
        page: i64,
        page_size: i64,
    ) -> CoreResult<PaginatedBooks> {
        let page = page.max(0);
        let page_size = page_size.clamp(1, 200);
        let offset = page * page_size;
        let term = query.map(str::trim).filter(|t| !t.is_empty());

        let total: i64 = match &term {
            Some(t) => self.conn.query_row(
                "SELECT COUNT(*) FROM books b WHERE b.title LIKE ?1 OR COALESCE(b.author,'') LIKE ?1",
                params![format!("%{t}%")],
                |row| row.get(0),
            )?,
            None => self.conn.query_row("SELECT COUNT(*) FROM books", [], |row| row.get(0))?,
        };

        let items = match &term {
            Some(t) => {
                let sql = format!(
                    "{BOOK_SELECT} WHERE b.title LIKE ?1 OR COALESCE(b.author,'') LIKE ?1 \
                     ORDER BY b.updated_at DESC, b.title ASC LIMIT ?2 OFFSET ?3"
                );
                let mut stmt = self.conn.prepare(&sql)?;
                let rows = stmt.query_map(
                    params![format!("%{t}%"), page_size, offset],
                    map_book_summary,
                )?;
                rows.collect::<rusqlite::Result<Vec<_>>>()?
            }
            None => {
                let sql = format!(
                    "{BOOK_SELECT} ORDER BY b.updated_at DESC, b.title ASC LIMIT ?1 OFFSET ?2"
                );
                let mut stmt = self.conn.prepare(&sql)?;
                let rows = stmt.query_map(params![page_size, offset], map_book_summary)?;
                rows.collect::<rusqlite::Result<Vec<_>>>()?
            }
        };

        Ok(PaginatedBooks {
            items,
            page,
            page_size,
            total,
        })
    }

    pub fn book_summary(&self, book_id: &str) -> CoreResult<BookSummary> {
        let sql = format!("{BOOK_SELECT} WHERE b.id = ?1");
        let mut stmt = self.conn.prepare(&sql)?;
        stmt.query_row(params![book_id], map_book_summary)
            .optional()?
            .ok_or_else(|| CoreError::NotFound(format!("book {book_id}")))
    }

    pub fn get_book(&self, book_id: &str) -> CoreResult<BookDetails> {
        let summary = self.book_summary(book_id)?;

        let (source_name, source_sha256): (String, String) = self.conn.query_row(
            "SELECT source_name, source_sha256 FROM books WHERE id = ?1",
            params![book_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )?;

        Ok(BookDetails {
            id: summary.id,
            title: summary.title,
            author: summary.author,
            format: summary.format,
            language: summary.language,
            chapter_count: summary.chapter_count,
            created_at: summary.created_at,
            updated_at: summary.updated_at,
            last_anchor: summary.last_anchor,
            source_name,
            source_sha256,
            chapters: self.list_chapters(book_id)?,
        })
    }

    pub fn list_chapters(&self, book_id: &str) -> CoreResult<Vec<ChapterSummary>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, book_id, ordinal, title, word_count FROM chapters \
             WHERE book_id = ?1 ORDER BY ordinal ASC",
        )?;
        let rows = stmt.query_map(params![book_id], |row| {
            Ok(ChapterSummary {
                id: row.get(0)?,
                book_id: row.get(1)?,
                ordinal: row.get(2)?,
                title: row.get(3)?,
                word_count: row.get(4)?,
            })
        })?;
        Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
    }

    pub fn get_chapter(&self, chapter_id: &str) -> CoreResult<ChapterDto> {
        let (id, book_id, ordinal, title): (String, String, i64, String) = self
            .conn
            .query_row(
                "SELECT id, book_id, ordinal, title FROM chapters WHERE id = ?1",
                params![chapter_id],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
            )
            .optional()?
            .ok_or_else(|| CoreError::NotFound(format!("chapter {chapter_id}")))?;

        let mut stmt = self.conn.prepare(
            "SELECT id, ordinal, content FROM paragraphs WHERE chapter_id = ?1 ORDER BY ordinal ASC",
        )?;
        let rows = stmt.query_map(params![chapter_id], |row| {
            Ok(ParagraphDto {
                id: row.get(0)?,
                ordinal: row.get(1)?,
                content: row.get(2)?,
            })
        })?;
        let paragraphs = rows.collect::<rusqlite::Result<Vec<_>>>()?;

        Ok(ChapterDto {
            id,
            book_id,
            ordinal,
            title,
            paragraphs,
        })
    }

    pub fn delete_book(&self, book_id: &str) -> CoreResult<()> {
        let affected = self
            .conn
            .execute("DELETE FROM books WHERE id = ?1", params![book_id])?;
        if affected == 0 {
            return Err(CoreError::NotFound(format!("book {book_id}")));
        }
        Ok(())
    }

    pub fn list_chapter_refs(&self, book_id: &str) -> CoreResult<Vec<ChapterRef>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, ordinal, title FROM chapters WHERE book_id = ?1 ORDER BY ordinal",
        )?;
        let rows = stmt.query_map(params![book_id], |row| {
            Ok(ChapterRef {
                id: row.get(0)?,
                ordinal: row.get(1)?,
                title: row.get(2)?,
            })
        })?;
        Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
    }

    pub fn chapter_ref(&self, chapter_id: &str) -> CoreResult<(String, ChapterRef)> {
        self.conn
            .query_row(
                "SELECT book_id, id, ordinal, title FROM chapters WHERE id = ?1",
                params![chapter_id],
                |row| {
                    Ok((
                        row.get::<_, String>(0)?,
                        ChapterRef {
                            id: row.get(1)?,
                            ordinal: row.get(2)?,
                            title: row.get(3)?,
                        },
                    ))
                },
            )
            .optional()?
            .ok_or_else(|| CoreError::NotFound(format!("chapter {chapter_id}")))
    }

    /// Returns the neighbouring chapter in `direction` (+1 next, -1 previous).
    pub fn neighbor_chapter(
        &self,
        book_id: &str,
        ordinal: i64,
        direction: i64,
    ) -> CoreResult<Option<ChapterRef>> {
        let sql = if direction >= 0 {
            "SELECT id, ordinal, title FROM chapters WHERE book_id = ?1 AND ordinal > ?2 \
             ORDER BY ordinal ASC LIMIT 1"
        } else {
            "SELECT id, ordinal, title FROM chapters WHERE book_id = ?1 AND ordinal < ?2 \
             ORDER BY ordinal DESC LIMIT 1"
        };
        let mut stmt = self.conn.prepare(sql)?;
        let found = stmt
            .query_row(params![book_id, ordinal], |row| {
                Ok(ChapterRef {
                    id: row.get(0)?,
                    ordinal: row.get(1)?,
                    title: row.get(2)?,
                })
            })
            .optional()?;
        Ok(found)
    }

    /// Validates that `chapter_id` belongs to `book_id` before a progress or
    /// bookmark write (guards the cross-table ownership gap the FKs leave).
    pub fn chapter_belongs_to_book(&self, book_id: &str, chapter_id: &str) -> CoreResult<bool> {
        let count: i64 = self.conn.query_row(
            "SELECT COUNT(*) FROM chapters WHERE id = ?1 AND book_id = ?2",
            params![chapter_id, book_id],
            |row| row.get(0),
        )?;
        Ok(count > 0)
    }

    pub fn paragraph_belongs_to_chapter(
        &self,
        chapter_id: &str,
        paragraph_id: &str,
    ) -> CoreResult<bool> {
        let count: i64 = self.conn.query_row(
            "SELECT COUNT(*) FROM paragraphs WHERE id = ?1 AND chapter_id = ?2",
            params![paragraph_id, chapter_id],
            |row| row.get(0),
        )?;
        Ok(count > 0)
    }

    pub fn book_exists(&self, book_id: &str) -> CoreResult<bool> {
        let count: i64 = self.conn.query_row(
            "SELECT COUNT(*) FROM books WHERE id = ?1",
            params![book_id],
            |row| row.get(0),
        )?;
        Ok(count > 0)
    }

    pub fn touch_book(&self, book_id: &str) -> CoreResult<()> {
        self.conn.execute(
            "UPDATE books SET updated_at = ?2 WHERE id = ?1",
            params![book_id, now_iso()],
        )?;
        Ok(())
    }

    pub fn paragraph_content(&self, paragraph_id: &str) -> CoreResult<Option<String>> {
        let content = self
            .conn
            .query_row(
                "SELECT content FROM paragraphs WHERE id = ?1",
                params![paragraph_id],
                |row| row.get::<_, String>(0),
            )
            .optional()?;
        Ok(content)
    }

    /// Number of chapters in a book; used by session resume validation.
    pub fn chapter_count(&self, book_id: &str) -> CoreResult<i64> {
        let count: i64 = self.conn.query_row(
            "SELECT COUNT(*) FROM chapters WHERE book_id = ?1",
            params![book_id],
            |row| row.get(0),
        )?;
        Ok(count)
    }
}

fn insert_book_rows(
    tx: &mut Transaction<'_>,
    book_id: &str,
    book: &ImportedBook,
    now: &str,
) -> CoreResult<()> {
    tx.execute(
        "INSERT INTO books (id, title, author, format, source_name, source_sha256, language, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?8)",
        params![
            book_id,
            book.title,
            book.author,
            book.format,
            book.source_name,
            book.source_sha256,
            book.language,
            now
        ],
    )?;

    {
        let mut chapter_stmt = tx.prepare(
            "INSERT INTO chapters (id, book_id, ordinal, title, word_count) VALUES (?1, ?2, ?3, ?4, ?5)",
        )?;
        let mut paragraph_stmt = tx.prepare(
            "INSERT INTO paragraphs (id, chapter_id, ordinal, content) VALUES (?1, ?2, ?3, ?4)",
        )?;
        for (chapter_index, chapter) in book.chapters.iter().enumerate() {
            let chapter_id = new_id();
            chapter_stmt.execute(params![
                chapter_id,
                book_id,
                chapter_index as i64,
                chapter.title,
                chapter.word_count
            ])?;
            for (paragraph_index, content) in chapter.paragraphs.iter().enumerate() {
                paragraph_stmt.execute(params![
                    new_id(),
                    chapter_id,
                    paragraph_index as i64,
                    content
                ])?;
            }
        }
    }

    Ok(())
}
