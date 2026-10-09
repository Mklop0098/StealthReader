use rusqlite::{params, OptionalExtension};

use crate::domain::models::AppSettings;
use crate::error::CoreResult;
use crate::util::now_iso;

use super::Repository;

const SETTINGS_KEY: &str = "app_settings";

impl Repository {
    /// Returns the persisted settings, falling back to defaults when absent or
    /// when the stored JSON no longer parses (forward/backward compatibility).
    pub fn get_settings(&self) -> CoreResult<AppSettings> {
        let raw: Option<String> = self
            .conn
            .query_row(
                "SELECT value_json FROM settings WHERE key = ?1",
                params![SETTINGS_KEY],
                |row| row.get(0),
            )
            .optional()?;
        match raw {
            Some(json) => Ok(serde_json::from_str(&json).unwrap_or_default()),
            None => Ok(AppSettings::default()),
        }
    }

    pub fn put_settings(&self, settings: &AppSettings) -> CoreResult<()> {
        let json = serde_json::to_string(settings).unwrap_or_else(|_| "{}".to_string());
        self.conn.execute(
            "INSERT INTO settings (key, value_json, updated_at) VALUES (?1, ?2, ?3) \
             ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, \
                updated_at = excluded.updated_at",
            params![SETTINGS_KEY, json, now_iso()],
        )?;
        Ok(())
    }
}
