use rusqlite::{params, OptionalExtension};

use crate::domain::models::ReaderAnchor;
use crate::error::{CoreError, CoreResult};
use crate::util::now_iso;

use super::Repository;

/// Result of attempting to persist progress. `Stale` means the incoming write
/// carried a sequence number not newer than the stored one and was dropped.
#[derive(Debug, Clone, PartialEq)]
pub enum SaveOutcome {
    Applied { revision: i64 },
    Stale { revision: i64 },
}

impl Repository {
    pub fn get_progress(&self, book_id: &str) -> CoreResult<Option<ReaderAnchor>> {
        let anchor = self
            .conn
            .query_row(
                "SELECT book_id, chapter_id, paragraph_id, char_offset, viewport_fraction \
                 FROM reading_progress WHERE book_id = ?1",
                params![book_id],
                |row| {
                    Ok(ReaderAnchor {
                        book_id: row.get(0)?,
                        chapter_id: row.get(1)?,
                        paragraph_id: row.get(2)?,
                        char_offset: row.get(3)?,
                        viewport_fraction: row.get(4)?,
                    })
                },
            )
            .optional()?;
        Ok(anchor)
    }

    pub fn progress_revision(&self, book_id: &str) -> CoreResult<i64> {
        let revision = self
            .conn
            .query_row(
                "SELECT revision FROM reading_progress WHERE book_id = ?1",
                params![book_id],
                |row| row.get::<_, i64>(0),
            )
            .optional()?;
        Ok(revision.unwrap_or(0))
    }

    /// Persists an anchor using a monotonic sequence for last-write-wins
    /// ordering. Validates ownership before writing (PRD section 5 / 9).
    pub fn save_progress(&self, anchor: &ReaderAnchor, seq: i64) -> CoreResult<SaveOutcome> {
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

        let stored = self.progress_revision(&anchor.book_id)?;
        if seq <= stored {
            return Ok(SaveOutcome::Stale { revision: stored });
        }

        let char_offset = anchor.char_offset.max(0);
        let viewport = anchor.viewport_fraction.clamp(0.0, 1.0);
        let now = now_iso();
        let updated = self.conn.execute(
            "INSERT INTO reading_progress \
                (book_id, chapter_id, paragraph_id, char_offset, viewport_fraction, revision, updated_at) \
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7) \
             ON CONFLICT(book_id) DO UPDATE SET \
                chapter_id = excluded.chapter_id, \
                paragraph_id = excluded.paragraph_id, \
                char_offset = excluded.char_offset, \
                viewport_fraction = excluded.viewport_fraction, \
                revision = excluded.revision, \
                updated_at = excluded.updated_at \
             WHERE excluded.revision > reading_progress.revision",
            params![
                anchor.book_id,
                anchor.chapter_id,
                anchor.paragraph_id,
                char_offset,
                viewport,
                seq,
                now
            ],
        )?;

        if updated == 0 {
            return Ok(SaveOutcome::Stale {
                revision: self.progress_revision(&anchor.book_id)?,
            });
        }

        self.touch_book(&anchor.book_id)?;
        Ok(SaveOutcome::Applied { revision: seq })
    }
}
