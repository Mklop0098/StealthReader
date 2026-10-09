use tauri::State;

use stealth_core::domain::models::{BookmarkDto, ReaderAnchor, SearchHit};
use stealth_core::repository::SaveOutcome;
use stealth_core::service::resolve_resume;

use crate::commands::{ProgressAck, ResumeDto};
use crate::error::{AppError, IpcResult};
use crate::state::AppState;

#[tauri::command]
pub fn save_progress(
    state: State<'_, AppState>,
    anchor: ReaderAnchor,
    seq: i64,
) -> IpcResult<ProgressAck> {
    let repo = state.db();
    match repo.save_progress(&anchor, seq) {
        Ok(SaveOutcome::Applied { revision }) => IpcResult::ok(ProgressAck {
            revision,
            applied: true,
        }),
        Ok(SaveOutcome::Stale { revision }) => IpcResult::ok(ProgressAck {
            revision,
            applied: false,
        }),
        Err(err) => AppError::from(err).into(),
    }
}

#[tauri::command]
pub fn get_progress(
    state: State<'_, AppState>,
    book_id: String,
) -> IpcResult<Option<ReaderAnchor>> {
    state.db().get_progress(&book_id).into()
}

#[tauri::command]
pub fn resume_book(state: State<'_, AppState>, book_id: String) -> IpcResult<ResumeDto> {
    let repo = state.db();
    match resolve_resume(&repo, &book_id) {
        Ok(resume) => IpcResult::ok(ResumeDto {
            anchor: resume.anchor,
            fell_back: resume.fell_back,
            message: resume.message,
        }),
        Err(err) => AppError::from(err).into(),
    }
}

#[tauri::command]
pub fn create_bookmark(
    state: State<'_, AppState>,
    anchor: ReaderAnchor,
    note: Option<String>,
) -> IpcResult<BookmarkDto> {
    state.db().create_bookmark(&anchor, note).into()
}

#[tauri::command]
pub fn list_bookmarks(state: State<'_, AppState>, book_id: String) -> IpcResult<Vec<BookmarkDto>> {
    state.db().list_bookmarks(&book_id).into()
}

#[tauri::command]
pub fn delete_bookmark(state: State<'_, AppState>, bookmark_id: String) -> IpcResult<()> {
    state.db().delete_bookmark(&bookmark_id).into()
}

#[tauri::command]
pub fn search_book(
    state: State<'_, AppState>,
    book_id: String,
    query: String,
    limit: Option<i64>,
) -> IpcResult<Vec<SearchHit>> {
    state
        .db()
        .search_book(&book_id, &query, limit.unwrap_or(50))
        .into()
}

#[tauri::command]
pub fn start_session(
    state: State<'_, AppState>,
    book_id: Option<String>,
    skin_id: String,
) -> IpcResult<String> {
    state
        .db()
        .start_session(book_id.as_deref(), &skin_id)
        .into()
}

#[tauri::command]
pub fn end_session(state: State<'_, AppState>, session_id: String) -> IpcResult<()> {
    state.db().end_session(&session_id).into()
}
