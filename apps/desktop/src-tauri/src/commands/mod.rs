pub mod library;
pub mod reader;
pub mod settings;
pub mod system;

use serde::Serialize;

use stealth_core::domain::models::ShortcutRegistrationResult;

/// Acknowledgement returned by `save_progress`. `applied: false` means the
/// write was rejected as stale and the returned revision is the stored one.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProgressAck {
    pub revision: i64,
    pub applied: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ResumeDto {
    pub anchor: Option<stealth_core::domain::models::ReaderAnchor>,
    pub fell_back: bool,
    pub message: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ShortcutRegistrationDto {
    pub quick_switch: ShortcutRegistrationResult,
    pub restore_reading: ShortcutRegistrationResult,
}
