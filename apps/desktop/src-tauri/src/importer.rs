use std::fs;
use std::path::Path;

use stealth_core::domain::models::{BookSummary, ImportedBook};
use stealth_core::import::{pipeline::parse_file_with_progress, ImportProgress};
use stealth_core::util::new_id;
use stealth_core::{CoreError, Repository};

use crate::error::AppError;
use crate::state::AppState;

/// Imports a validated file: parse, stage a managed copy of the original, then
/// commit the book. The staged copy is renamed to a content-addressed name only
/// after the database commit succeeds, and an interrupted job is reconciled on
/// the next start (`recover`).
pub fn import_file(
    state: &AppState,
    source_path: &str,
    progress: &mut dyn FnMut(ImportProgress),
) -> Result<BookSummary, AppError> {
    let parsed: ImportedBook = parse_file_with_progress(Path::new(source_path), progress)?;
    progress(ImportProgress::new("copying", 78, 0, 0));

    let job_id = new_id();
    let staged = state.staging_dir.join(format!("{job_id}.part"));
    fs::copy(source_path, &staged)?;

    progress(ImportProgress::new("saving", 85, 0, 0));
    let mut repo = state.db();
    repo.create_import_job(
        &job_id,
        &parsed.source_name,
        Some(&staged.to_string_lossy()),
        "committing",
    )?;

    let book_id = match repo.insert_imported_book(&parsed) {
        Ok(id) => id,
        Err(err) => {
            let _ = repo.set_import_job_status(&job_id, "failed", None);
            let _ = fs::remove_file(&staged);
            return Err(AppError::from(err));
        }
    };

    let final_path = state
        .originals_dir
        .join(format!("{}.{}", parsed.source_sha256, parsed.format));
    let relocated = if final_path.exists() {
        fs::remove_file(&staged).map(|_| ())
    } else {
        fs::rename(&staged, &final_path)
    };
    match relocated {
        Ok(()) => {
            let _ = repo.set_import_job_status(
                &job_id,
                "complete",
                Some(&final_path.to_string_lossy()),
            );
        }
        Err(_) => {
            let _ = fs::remove_file(&staged);
            let _ = repo.set_import_job_status(&job_id, "failed", None);
        }
    }

    let summary = repo.book_summary(&book_id)?;
    progress(ImportProgress::new("complete", 100, 0, 0));
    Ok(summary)
}

/// Removes the managed copy of an original, if it was retained.
pub fn delete_original(state: &AppState, sha256: &str, format: &str) -> Result<(), CoreError> {
    let path = state.originals_dir.join(format!("{sha256}.{format}"));
    if path.exists() {
        fs::remove_file(path)?;
    }
    Ok(())
}

/// Startup reconciliation: clears staged files from interrupted imports and
/// marks their journal entries failed. Best effort — never blocks startup.
pub fn recover(repo: &Repository, staging_dir: &Path) {
    if let Ok(jobs) = repo.pending_import_jobs() {
        for (job_id, stage_path) in jobs {
            if let Some(path) = stage_path {
                let _ = fs::remove_file(path);
            }
            let _ = repo.set_import_job_status(&job_id, "failed", None);
        }
    }
    if let Ok(entries) = fs::read_dir(staging_dir) {
        for entry in entries.flatten() {
            let _ = fs::remove_file(entry.path());
        }
    }
}
