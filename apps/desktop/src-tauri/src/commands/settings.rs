use tauri::State;

use stealth_core::domain::models::AppSettings;
use stealth_core::service::sanitize_settings;

use crate::error::{AppError, IpcResult};
use crate::state::AppState;

#[tauri::command]
pub fn get_settings(state: State<'_, AppState>) -> IpcResult<AppSettings> {
    state.db().get_settings().into()
}

/// Persists a full settings object after clamping values to safe ranges.
#[tauri::command]
pub fn update_settings(
    state: State<'_, AppState>,
    settings: AppSettings,
) -> IpcResult<AppSettings> {
    let sanitized = sanitize_settings(settings);
    let repo = state.db();
    match repo.put_settings(&sanitized) {
        Ok(()) => IpcResult::ok(sanitized),
        Err(err) => AppError::from(err).into(),
    }
}
