//! Global shortcut registration with an explicit fallback path.
//!
//! Registration is best effort: when the OS refuses an accelerator the command
//! still succeeds and reports `registered: false` with a reason, so the UI can
//! warn the user and rely on the in-app shortcut (acceptance test AT-12).

use std::sync::{Mutex, MutexGuard, PoisonError};

use tauri::{AppHandle, Emitter, Manager, Runtime};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

use stealth_core::domain::models::ShortcutRegistrationResult;

/// Event emitted when a registered accelerator is pressed. The payload is the
/// action name (`quickSwitch` / `restoreReading`), never book data.
pub const EVENT_SHORTCUT: &str = "stealth://shortcut";

#[derive(Default)]
pub struct Bindings {
    quick_switch: Mutex<Option<Shortcut>>,
    restore_reading: Mutex<Option<Shortcut>>,
}

fn lock<T>(mutex: &Mutex<T>) -> MutexGuard<'_, T> {
    mutex.lock().unwrap_or_else(PoisonError::into_inner)
}

pub fn plugin<R: Runtime>() -> tauri::plugin::TauriPlugin<R> {
    tauri_plugin_global_shortcut::Builder::new()
        .with_handler(|app, shortcut, event| {
            if event.state() != ShortcutState::Pressed {
                return;
            }
            let bindings = app.state::<Bindings>();
            let action = if lock(&bindings.quick_switch).as_ref() == Some(shortcut) {
                Some("quickSwitch")
            } else if lock(&bindings.restore_reading).as_ref() == Some(shortcut) {
                Some("restoreReading")
            } else {
                None
            };
            if let Some(action) = action {
                let _ = app.emit(EVENT_SHORTCUT, action);
            }
        })
        .build()
}

fn register_one<R: Runtime>(
    app: &AppHandle<R>,
    accelerator: &str,
    slot: &Mutex<Option<Shortcut>>,
) -> ShortcutRegistrationResult {
    let parsed = match accelerator.parse::<Shortcut>() {
        Ok(shortcut) => shortcut,
        Err(err) => {
            return ShortcutRegistrationResult {
                registered: false,
                accelerator: accelerator.to_string(),
                reason: Some(format!("invalid accelerator syntax: {err}")),
            }
        }
    };
    match app.global_shortcut().register(parsed) {
        Ok(()) => {
            *lock(slot) = Some(parsed);
            ShortcutRegistrationResult {
                registered: true,
                accelerator: accelerator.to_string(),
                reason: None,
            }
        }
        Err(err) => ShortcutRegistrationResult {
            registered: false,
            accelerator: accelerator.to_string(),
            reason: Some(err.to_string()),
        },
    }
}

pub struct RegistrationOutcome {
    pub quick_switch: ShortcutRegistrationResult,
    pub restore_reading: ShortcutRegistrationResult,
}

/// Re-registers both stealth accelerators. The previous registrations are
/// released first so repeated calls are idempotent.
pub fn register<R: Runtime>(
    app: &AppHandle<R>,
    quick_switch: &str,
    restore_reading: &str,
) -> RegistrationOutcome {
    let bindings = app.state::<Bindings>();
    let shortcut_manager = app.global_shortcut();
    let _ = shortcut_manager.unregister_all();
    *lock(&bindings.quick_switch) = None;
    *lock(&bindings.restore_reading) = None;

    let quick = register_one(app, quick_switch, &bindings.quick_switch);
    let restore = register_one(app, restore_reading, &bindings.restore_reading);
    RegistrationOutcome {
        quick_switch: quick,
        restore_reading: restore,
    }
}
