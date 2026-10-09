use tauri::{Manager, State};

use stealth_core::domain::models::{
    BookDetails, BookSummary, ChapterDto, ChapterSummary, PaginatedBooks,
};

use crate::error::{AppError, IpcResult};
use crate::importer;
use crate::state::AppState;

#[tauri::command]
pub async fn import_book(
    app: tauri::AppHandle,
    path: String,
    on_progress: tauri::ipc::Channel<stealth_core::import::ImportProgress>,
) -> IpcResult<BookSummary> {
    // Parsing, file I/O and the database commit must not run on the UI thread.
    match tauri::async_runtime::spawn_blocking(move || {
        importer::import_file(&app.state::<AppState>(), &path, &mut |progress| {
            let _ = on_progress.send(progress);
        })
    })
    .await
    {
        Ok(result) => result.into(),
        Err(err) => AppError::new(
            stealth_core::error::ErrorCode::ImportFailed,
            format!("import worker failed: {err}"),
            true,
        )
        .into(),
    }
}

#[tauri::command]
pub fn list_books(
    state: State<'_, AppState>,
    query: Option<String>,
    page: Option<i64>,
    page_size: Option<i64>,
) -> IpcResult<PaginatedBooks> {
    let repo = state.db();
    repo.list_books(query.as_deref(), page.unwrap_or(0), page_size.unwrap_or(50))
        .into()
}

#[tauri::command]
pub fn get_book(state: State<'_, AppState>, book_id: String) -> IpcResult<BookDetails> {
    state.db().get_book(&book_id).into()
}

#[tauri::command]
pub fn list_chapters(
    state: State<'_, AppState>,
    book_id: String,
) -> IpcResult<Vec<ChapterSummary>> {
    state.db().list_chapters(&book_id).into()
}

#[tauri::command]
pub fn get_chapter(state: State<'_, AppState>, chapter_id: String) -> IpcResult<ChapterDto> {
    state.db().get_chapter(&chapter_id).into()
}

/// Deletes a book and cascades its chapters, paragraphs, progress and
/// bookmarks. When `delete_original` is set, the retained copy is removed too.
#[tauri::command]
pub fn delete_book(
    state: State<'_, AppState>,
    book_id: String,
    delete_original: Option<bool>,
) -> IpcResult<()> {
    let repo = state.db();
    let details = match repo.get_book(&book_id) {
        Ok(details) => details,
        Err(err) => return AppError::from(err).into(),
    };
    if let Err(err) = repo.delete_book(&book_id) {
        return AppError::from(err).into();
    }
    if delete_original.unwrap_or(false) {
        let _ = importer::delete_original(&state, &details.source_sha256, &details.format);
    }
    IpcResult::ok(())
}
