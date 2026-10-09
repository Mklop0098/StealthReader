//! Cross-repository services: settings sanitation and session resume. These
//! are pure functions over the repository so they can be unit tested and reused
//! by the Tauri command layer without duplicating rules.

use std::collections::HashSet;

use crate::domain::models::{is_skin_id, AppSettings, HotkeyBinding, ReaderAnchor};
use crate::error::{CoreError, CoreResult};
use crate::repository::{ChapterRef, Repository};

const REQUIRED_ACTIONS: [&str; 2] = ["quickSwitch", "restoreReading"];

/// Clamps and validates user settings so persisted values are always usable.
pub fn sanitize_settings(mut settings: AppSettings) -> AppSettings {
    if !is_skin_id(&settings.active_skin) {
        settings.active_skin = "vscode".to_string();
    }

    if settings.font.family.trim().is_empty() {
        settings.font.family = "reader-skin".to_string();
    }
    settings.font.size = settings.font.size.clamp(12.0, 40.0);
    settings.font.line_height = settings.font.line_height.clamp(1.0, 3.0);
    settings.font.width = settings.font.width.clamp(480.0, 1600.0);

    let mut seen: HashSet<String> = HashSet::new();
    let defaults = AppSettings::default();
    let mut hotkeys: Vec<HotkeyBinding> = Vec::new();

    let source = if settings.hotkeys.is_empty() {
        defaults.hotkeys.clone()
    } else {
        settings.hotkeys.clone()
    };
    for binding in source {
        if binding.accelerator.trim().is_empty() {
            continue;
        }
        if !seen.insert(binding.action.clone()) {
            continue;
        }
        hotkeys.push(binding);
    }
    // Guarantee the two stealth-critical actions always have a binding, using
    // the accelerator from the defaults when the user removed or cleared it.
    for action in REQUIRED_ACTIONS {
        if !seen.contains(action) {
            if let Some(fallback) = defaults.hotkeys.iter().find(|h| h.action == action) {
                hotkeys.push(fallback.clone());
                seen.insert(action.to_string());
            }
        }
    }
    settings.hotkeys = hotkeys;

    settings
}

#[derive(Debug, Clone, PartialEq)]
pub struct ResumeState {
    pub anchor: Option<ReaderAnchor>,
    /// True when the stored anchor was missing or invalid and a fallback was used.
    pub fell_back: bool,
    /// Safe, book-content-free explanation of the fallback.
    pub message: Option<String>,
}

/// Resolves the resume position for a book, validating that referenced
/// chapter/paragraph still exist (PRD section 3, UX flow D step 3-4).
pub fn resolve_resume(repo: &Repository, book_id: &str) -> CoreResult<ResumeState> {
    if !repo.book_exists(book_id)? {
        return Err(CoreError::NotFound(format!("book {book_id}")));
    }

    let first_chapter: Option<ChapterRef> = repo.list_chapter_refs(book_id)?.into_iter().next();

    if let Some(mut anchor) = repo.get_progress(book_id)? {
        let chapter_ok = repo.chapter_belongs_to_book(book_id, &anchor.chapter_id)?;
        if chapter_ok {
            let paragraph_ok = match &anchor.paragraph_id {
                Some(paragraph_id) => {
                    repo.paragraph_belongs_to_chapter(&anchor.chapter_id, paragraph_id)?
                }
                None => true,
            };
            if paragraph_ok {
                anchor.char_offset = anchor.char_offset.max(0);
                anchor.viewport_fraction = anchor.viewport_fraction.clamp(0.0, 1.0);
                return Ok(ResumeState {
                    anchor: Some(anchor),
                    fell_back: false,
                    message: None,
                });
            }
        }
        // Stored anchor referenced data that no longer exists; fall back.
        let fallback = first_chapter.map(|chapter| ReaderAnchor {
            book_id: book_id.to_string(),
            chapter_id: chapter.id,
            paragraph_id: None,
            char_offset: 0,
            viewport_fraction: 0.0,
        });
        return Ok(ResumeState {
            anchor: fallback,
            fell_back: true,
            message: Some(
                "Saved reading position was unavailable; opened the beginning of the book."
                    .to_string(),
            ),
        });
    }

    Ok(ResumeState {
        anchor: first_chapter.map(|chapter| ReaderAnchor {
            book_id: book_id.to_string(),
            chapter_id: chapter.id,
            paragraph_id: None,
            char_offset: 0,
            viewport_fraction: 0.0,
        }),
        fell_back: false,
        message: None,
    })
}
