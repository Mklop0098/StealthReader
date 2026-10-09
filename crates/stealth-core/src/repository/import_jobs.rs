use rusqlite::{params, OptionalExtension};

use crate::error::CoreResult;
use crate::util::now_iso;

use super::Repository;

/// Lightweight journal used to reconcile a managed copy of the original import
/// when the process dies between the file write and the database commit.
impl Repository {
    pub fn create_import_job(
        &self,
        job_id: &str,
        source_name: &str,
        stage_path: Option<&str>,
        status: &str,
    ) -> CoreResult<()> {
        let now = now_iso();
        self.conn.execute(
            "INSERT INTO import_jobs (id, source_name, stage_path, status, created_at, updated_at) \
             VALUES (?1, ?2, ?3, ?4, ?5, ?5)",
            params![job_id, source_name, stage_path, status, now],
        )?;
        Ok(())
    }

    pub fn set_import_job_status(
        &self,
        job_id: &str,
        status: &str,
        stage_path: Option<&str>,
    ) -> CoreResult<()> {
        self.conn.execute(
            "UPDATE import_jobs SET status = ?2, stage_path = COALESCE(?3, stage_path), \
                updated_at = ?4 WHERE id = ?1",
            params![job_id, status, stage_path, now_iso()],
        )?;
        Ok(())
    }

    /// Jobs that were interrupted before completion.
    pub fn pending_import_jobs(&self) -> CoreResult<Vec<(String, Option<String>)>> {
        let mut stmt = self
            .conn
            .prepare("SELECT id, stage_path FROM import_jobs WHERE status != 'complete'")?;
        let rows = stmt.query_map([], |row| Ok((row.get(0)?, row.get(1)?)))?;
        Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
    }

    pub fn import_job_status(&self, job_id: &str) -> CoreResult<Option<String>> {
        let status = self
            .conn
            .query_row(
                "SELECT status FROM import_jobs WHERE id = ?1",
                params![job_id],
                |row| row.get::<_, String>(0),
            )
            .optional()?;
        Ok(status)
    }
}
