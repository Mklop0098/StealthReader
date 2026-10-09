use rusqlite::{params, Row};

use crate::domain::models::{BookmarkDto, ReaderAnchor};
use crate::domain::text::snippet_around;
use crate::error::{CoreError, CoreResult};
use crate::util::{new_id, now_iso};

use super::Repository;

const EXCERPT_RADIUS: i64 = 40;

fn map_bookmark(row: &Row<'_>) -> rusqlite::Result<BookmarkDto> {
    let char_offset: i64 = row.get(6)?;
    let content: Option<String> = row.get(9)?;
    let excerpt = content.map(|c| snippet_around(&c, char_offset, EXCERPT_RADIUS));
    Ok(BookmarkDto {
        id: row.get(0)?,
        book_id: row.get(1)?,
        chapter_id: row.get(2)?,
        chapter_ordinal: row.get(3)?,
        chapter_title: row.get(4)?,
        paragraph_id: row.get(5)?,
        char_offset,
        excerpt,
        note: row.get(7)?,
        created_at: row.get(8)?,
    })
}

const BOOKMARK_SELECT: &str = "SELECT bm.id, bm.book_id, bm.chapter_id, c.ordinal, c.title, \
        bm.paragraph_id, bm.char_offset, bm.note, bm.created_at, p.content \
    FROM bookmarks bm \
    JOIN chapters c ON c.id = bm.chapter_id \
    LEFT JOIN paragraphs p ON p.id = bm.paragraph_id";

impl Repository {
    pub fn create_bookmark(
        &self,
        anchor: &ReaderAnchor,
        note: Option<String>,
    ) -> CoreResult<BookmarkDto> {
        if !self.book_exists(&anchor.book_id)? {
            return Err(CoreError::NotFound(format!("book {}", anchor.book_id)));
        }
        if !self.chapter_belongs_to_book(&anchor.book_id, &anchor.chapter_id)? {
            return Err(CoreError::InvalidInput(
                "chapter does not belong to book".into(),
            ));
        }
        if let Some(paragraph_id) = &anchor.paragraph_id {
            if !self.paragraph_belongs_to_chapter(&anchor.chapter_id, paragraph_id)? {
                return Err(CoreError::InvalidInput(
                    "paragraph does not belong to chapter".into(),
                ));
            }
        }

        let bookmark_id = new_id();
        let created_at = now_iso();
        let note = note.filter(|n| !n.trim().is_empty());
        self.conn.execute(
            "INSERT INTO bookmarks \
                (id, book_id, chapter_id, paragraph_id, char_offset, note, created_at) \
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                bookmark_id,
                anchor.book_id,
                anchor.chapter_id,
                anchor.paragraph_id,
                anchor.char_offset.max(0),
                note,
                created_at
            ],
        )?;

        self.bookmark_by_id(&bookmark_id)
    }

    pub fn bookmark_by_id(&self, bookmark_id: &str) -> CoreResult<BookmarkDto> {
        let sql = format!("{BOOKMARK_SELECT} WHERE bm.id = ?1");
        let mut stmt = self.conn.prepare(&sql)?;
        stmt.query_row(params![bookmark_id], map_bookmark)
            .map_err(|err| match err {
                rusqlite::Error::QueryReturnedNoRows => {
                    CoreError::NotFound(format!("bookmark {bookmark_id}"))
                }
                other => CoreError::Database(other),
            })
    }

    pub fn list_bookmarks(&self, book_id: &str) -> CoreResult<Vec<BookmarkDto>> {
        let sql = format!("{BOOKMARK_SELECT} WHERE bm.book_id = ?1 ORDER BY bm.created_at DESC");
        let mut stmt = self.conn.prepare(&sql)?;
        let rows = stmt.query_map(params![book_id], map_bookmark)?;
        Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
    }

    pub fn delete_bookmark(&self, bookmark_id: &str) -> CoreResult<()> {
        let affected = self
            .conn
            .execute("DELETE FROM bookmarks WHERE id = ?1", params![bookmark_id])?;
        if affected == 0 {
            return Err(CoreError::NotFound(format!("bookmark {bookmark_id}")));
        }
        Ok(())
    }
}
