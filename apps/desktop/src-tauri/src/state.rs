use std::path::PathBuf;
use std::sync::{Mutex, MutexGuard, PoisonError};

use stealth_core::Repository;

/// Application-wide state. A single mutex-guarded repository serializes all
/// database access in-process (serialize-writes requirement, PRD section 9).
pub struct AppState {
    pub db: Mutex<Repository>,
    pub originals_dir: PathBuf,
    pub staging_dir: PathBuf,
}

impl AppState {
    pub fn db(&self) -> MutexGuard<'_, Repository> {
        self.db.lock().unwrap_or_else(PoisonError::into_inner)
    }
}
