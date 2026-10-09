//! Window and shortcut commands. Both are deliberately content-free: they only
//! ever receive/return neutral strings, never book text.

use tauri::{AppHandle, Manager};

use crate::commands::ShortcutRegistrationDto;
use crate::error::IpcResult;
use crate::shortcuts;

pub const MAIN_WINDOW: &str = "main";

#[tauri::command]
pub fn register_shortcuts(
    app: AppHandle,
    quick_switch: String,
    restore_reading: String,
) -> IpcResult<ShortcutRegistrationDto> {
    let outcome = shortcuts::register(&app, &quick_switch, &restore_reading);
    IpcResult::ok(ShortcutRegistrationDto {
        quick_switch: outcome.quick_switch,
        restore_reading: outcome.restore_reading,
    })
}

/// Sets the OS window title. Callers must pass neutral text while neutral mode
/// is active (PRD section 8, Quick Switch invariants).
#[tauri::command]
pub fn set_window_title(app: AppHandle, title: String) -> IpcResult<()> {
    if let Some(window) = app.get_webview_window(MAIN_WINDOW) {
        let _ = window.set_title(&title);
    }
    IpcResult::ok(())
}
