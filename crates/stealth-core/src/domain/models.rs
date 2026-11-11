//! Domain models. These are the wire DTOs shared with TypeScript, so field
//! naming uses `camelCase` and all ids/timestamps are strings.

use serde::{Deserialize, Serialize};

pub const SKIN_IDS: [&str; 4] = ["vscode", "excel", "terminal", "claude"];

pub fn is_skin_id(value: &str) -> bool {
    SKIN_IDS.contains(&value)
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ReaderAnchor {
    pub book_id: String,
    pub chapter_id: String,
    pub paragraph_id: Option<String>,
    pub char_offset: i64,
    pub viewport_fraction: f64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LastAnchorRef {
    pub chapter_id: String,
    pub chapter_ordinal: i64,
    pub chapter_title: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BookSummary {
    pub id: String,
    pub title: String,
    pub author: Option<String>,
    pub format: String,
    pub language: Option<String>,
    pub chapter_count: i64,
    pub created_at: String,
    pub updated_at: String,
    pub last_anchor: Option<LastAnchorRef>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChapterSummary {
    pub id: String,
    pub book_id: String,
    pub ordinal: i64,
    pub title: String,
    pub word_count: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BookDetails {
    pub id: String,
    pub title: String,
    pub author: Option<String>,
    pub format: String,
    pub language: Option<String>,
    pub chapter_count: i64,
    pub created_at: String,
    pub updated_at: String,
    pub last_anchor: Option<LastAnchorRef>,
    pub source_name: String,
    pub source_sha256: String,
    pub chapters: Vec<ChapterSummary>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ParagraphDto {
    pub id: String,
    pub ordinal: i64,
    pub content: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChapterDto {
    pub id: String,
    pub book_id: String,
    pub ordinal: i64,
    pub title: String,
    pub paragraphs: Vec<ParagraphDto>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PaginatedBooks {
    pub items: Vec<BookSummary>,
    pub page: i64,
    pub page_size: i64,
    pub total: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BookmarkDto {
    pub id: String,
    pub book_id: String,
    pub chapter_id: String,
    pub chapter_ordinal: i64,
    pub chapter_title: String,
    pub paragraph_id: Option<String>,
    pub char_offset: i64,
    pub excerpt: Option<String>,
    pub note: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct FontSettings {
    pub family: String,
    pub size: f64,
    pub line_height: f64,
    pub width: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PrivacySettings {
    pub hide_recent_books: bool,
    pub launch_in_neutral: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct HotkeyBinding {
    pub action: String,
    pub accelerator: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub active_skin: String,
    pub font: FontSettings,
    pub hotkeys: Vec<HotkeyBinding>,
    pub privacy: PrivacySettings,
    pub typewriter_enabled: bool,
    #[serde(default = "default_chapter_typing")]
    pub chapter_typing_enabled: bool,
    pub line_numbers: bool,
    pub reduced_motion: bool,
}

fn default_chapter_typing() -> bool {
    true
}

impl Default for AppSettings {
    fn default() -> Self {
        AppSettings {
            active_skin: "vscode".to_string(),
            font: FontSettings {
                family: "reader-skin".to_string(),
                size: 18.0,
                line_height: 1.6,
                width: 760.0,
            },
            hotkeys: vec![
                HotkeyBinding {
                    action: "quickSwitch".into(),
                    accelerator: "CommandOrControl+Alt+Shift+Q".into(),
                },
                HotkeyBinding {
                    action: "restoreReading".into(),
                    accelerator: "CommandOrControl+Alt+Shift+W".into(),
                },
                HotkeyBinding {
                    action: "nextChapter".into(),
                    accelerator: "Alt+ArrowRight".into(),
                },
                HotkeyBinding {
                    action: "prevChapter".into(),
                    accelerator: "Alt+ArrowLeft".into(),
                },
                HotkeyBinding {
                    action: "toggleBookmark".into(),
                    accelerator: "CommandOrControl+Alt+Shift+B".into(),
                },
                HotkeyBinding {
                    action: "openSearch".into(),
                    accelerator: "CommandOrControl+Shift+F".into(),
                },
            ],
            privacy: PrivacySettings {
                hide_recent_books: false,
                launch_in_neutral: false,
            },
            typewriter_enabled: false,
            chapter_typing_enabled: true,
            line_numbers: true,
            reduced_motion: false,
        }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ShortcutRegistrationResult {
    pub registered: bool,
    pub accelerator: String,
    pub reason: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchHit {
    pub chapter_id: String,
    pub chapter_ordinal: i64,
    pub chapter_title: String,
    pub paragraph_id: String,
    pub paragraph_ordinal: i64,
    pub char_offset: i64,
    pub snippet: String,
}

/// Parsed, normalized representation produced by the import pipeline before it
/// is committed. Immutable once committed (PRD section 5).
#[derive(Debug, Clone)]
pub struct ImportedChapter {
    pub title: String,
    pub word_count: i64,
    pub paragraphs: Vec<String>,
}

#[derive(Debug, Clone)]
pub struct ImportedBook {
    pub title: String,
    pub author: Option<String>,
    pub language: Option<String>,
    pub format: String,
    pub source_name: String,
    pub source_sha256: String,
    pub chapters: Vec<ImportedChapter>,
}
