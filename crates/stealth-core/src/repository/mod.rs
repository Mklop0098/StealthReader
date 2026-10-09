//! SQLite access layer.
//!
//! The `Repository` owns a single `rusqlite::Connection`. The Tauri shell wraps
//! it in a `Mutex`, so all writes are serialized in-process, which satisfies the
//! "serialize writes" requirement while keeping the hot path simple.

mod bookmarks;
mod books;
mod import_jobs;
mod progress;
mod search;
mod sessions;
mod settings;

pub use books::ChapterRef;
pub use progress::SaveOutcome;
pub use sessions::RecentSession;

use std::path::Path;
use std::time::Duration;

use rusqlite::{Connection, Transaction};

use crate::error::{CoreError, CoreResult};

/// Migration scripts, applied in order and tracked via `PRAGMA user_version`.
const MIGRATIONS: &[(&str, &str)] =
    &[("0001_init", include_str!("../../migrations/0001_init.sql"))];

pub struct Repository {
    conn: Connection,
}

impl Repository {
    /// Opens (creating if needed) a database file and configures the connection.
    pub fn open(path: &Path) -> CoreResult<Self> {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let conn = Connection::open(path)?;
        let repo = Repository { conn };
        repo.configure()?;
        Ok(repo)
    }

    /// Opens a transient in-memory database (used by tests).
    pub fn open_in_memory() -> CoreResult<Self> {
        let conn = Connection::open_in_memory()?;
        let repo = Repository { conn };
        repo.configure()?;
        Ok(repo)
    }

    fn configure(&self) -> CoreResult<()> {
        // Foreign keys are enforced per connection, not per database.
        self.conn.execute_batch("PRAGMA foreign_keys = ON;")?;
        self.conn.busy_timeout(Duration::from_millis(5_000))?;
        // WAL is unavailable for in-memory databases; ignore the failure there.
        let _ = self
            .conn
            .query_row("PRAGMA journal_mode = WAL;", [], |_| Ok(()));
        Ok(())
    }

    /// Applies any pending migrations. Idempotent.
    pub fn migrate(&self) -> CoreResult<()> {
        let current: i64 = self
            .conn
            .query_row("PRAGMA user_version;", [], |row| row.get(0))?;
        for (index, (_name, sql)) in MIGRATIONS.iter().enumerate() {
            let version = (index as i64) + 1;
            if version <= current {
                continue;
            }
            self.conn.execute_batch("BEGIN;")?;
            let result = self
                .conn
                .execute_batch(sql)
                .and_then(|_| self.conn.pragma_update(None, "user_version", version));
            match result {
                Ok(()) => self.conn.execute_batch("COMMIT;")?,
                Err(err) => {
                    let _ = self.conn.execute_batch("ROLLBACK;");
                    return Err(CoreError::Database(err));
                }
            }
        }
        Ok(())
    }

    pub fn connection(&self) -> &Connection {
        &self.conn
    }

    /// Runs `f` inside a transaction, committing on success and rolling back on
    /// error. Used for multi-table writes such as importing a book.
    pub fn transaction<T, F>(&mut self, f: F) -> CoreResult<T>
    where
        F: FnOnce(&Transaction<'_>) -> CoreResult<T>,
    {
        let tx = self.conn.transaction()?;
        let value = f(&tx)?;
        tx.commit()?;
        Ok(value)
    }
}
