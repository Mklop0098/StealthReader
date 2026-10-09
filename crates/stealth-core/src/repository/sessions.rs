use rusqlite::{params, OptionalExtension};

use crate::domain::models::is_skin_id;
use crate::error::{CoreError, CoreResult};
use crate::util::{new_id, now_iso};

use super::Repository;

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RecentSession {
    pub id: String,
    pub book_id: Option<String>,
    pub skin_id: String,
    pub started_at: String,
    pub ended_at: Option<String>,
}

impl Repository {
    pub fn start_session(&self, book_id: Option<&str>, skin_id: &str) -> CoreResult<String> {
        if !is_skin_id(skin_id) {
            return Err(CoreError::InvalidInput(format!("unknown skin {skin_id}")));
        }
        if let Some(id) = book_id {
            if !self.book_exists(id)? {
                return Err(CoreError::NotFound(format!("book {id}")));
            }
        }
        let session_id = new_id();
        self.conn.execute(
            "INSERT INTO recent_sessions (id, book_id, skin_id, started_at, ended_at) \
             VALUES (?1, ?2, ?3, ?4, NULL)",
            params![session_id, book_id, skin_id, now_iso()],
        )?;
        Ok(session_id)
    }

    pub fn end_session(&self, session_id: &str) -> CoreResult<()> {
        self.conn.execute(
            "UPDATE recent_sessions SET ended_at = ?2 WHERE id = ?1 AND ended_at IS NULL",
            params![session_id, now_iso()],
        )?;
        Ok(())
    }

    pub fn latest_session(&self) -> CoreResult<Option<RecentSession>> {
        let session = self
            .conn
            .query_row(
                "SELECT id, book_id, skin_id, started_at, ended_at FROM recent_sessions \
                 ORDER BY started_at DESC LIMIT 1",
                [],
                |row| {
                    Ok(RecentSession {
                        id: row.get(0)?,
                        book_id: row.get(1)?,
                        skin_id: row.get(2)?,
                        started_at: row.get(3)?,
                        ended_at: row.get(4)?,
                    })
                },
            )
            .optional()?;
        Ok(session)
    }
}
