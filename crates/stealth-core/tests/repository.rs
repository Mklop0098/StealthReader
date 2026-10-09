use stealth_core::domain::models::{AppSettings, FontSettings, ReaderAnchor};
use stealth_core::error::ErrorCode;
use stealth_core::import::parse_bytes;
use stealth_core::repository::{Repository, SaveOutcome};
use stealth_core::service::{resolve_resume, sanitize_settings};

fn setup() -> Repository {
    let repo = Repository::open_in_memory().expect("open");
    repo.migrate().expect("migrate");
    repo
}

#[test]
fn legacy_settings_enable_chapter_typing_without_losing_saved_preferences() {
    let repo = setup();
    let mut settings = serde_json::to_value(AppSettings::default()).unwrap();
    settings
        .as_object_mut()
        .unwrap()
        .remove("chapterTypingEnabled");
    settings["activeSkin"] = serde_json::json!("terminal");
    settings["font"]["size"] = serde_json::json!(24.0);
    repo.connection().execute(
        "INSERT INTO settings (key, value_json, updated_at) VALUES ('app_settings', ?1, '2026-10-09')",
        [settings.to_string()],
    ).unwrap();
    let loaded = repo.get_settings().unwrap();
    assert!(loaded.chapter_typing_enabled);
    assert_eq!(loaded.active_skin, "terminal");
    assert_eq!(loaded.font.size, 24.0);
    let saved = AppSettings {
        chapter_typing_enabled: false,
        ..loaded
    };
    repo.put_settings(&saved).unwrap();
    assert!(!repo.get_settings().unwrap().chapter_typing_enabled);
}

fn import_text(repo: &mut Repository, name: &str, text: &str) -> String {
    let book = parse_bytes(text.as_bytes(), name).expect("parse");
    repo.insert_imported_book(&book).expect("insert")
}

fn count(repo: &Repository, table: &str) -> i64 {
    repo.connection()
        .query_row(&format!("SELECT COUNT(*) FROM {table}"), [], |row| {
            row.get(0)
        })
        .expect("count")
}

const TEXT_A: &str = "Chapter 1\nAlpha one.\n\nChapter 2\nAlpha two.";
const TEXT_B: &str = "Chapter 1\nBeta one.";

#[test]
fn import_persists_book_chapters_and_paragraphs() {
    let mut repo = setup();
    let book_id = import_text(&mut repo, "alpha.txt", TEXT_A);

    let page = repo.list_books(None, 0, 20).unwrap();
    assert_eq!(page.total, 1);
    assert_eq!(page.items[0].title, "alpha");
    assert_eq!(page.items[0].chapter_count, 2);

    let details = repo.get_book(&book_id).unwrap();
    assert_eq!(details.chapters.len(), 2);

    let chapter = repo.get_chapter(&details.chapters[0].id).unwrap();
    assert_eq!(chapter.title, "Chapter 1");
    assert_eq!(chapter.paragraphs[0].content, "Alpha one.");
    assert_eq!(count(&repo, "paragraphs"), 2);
}

#[test]
fn search_finds_paragraph_and_offset() {
    let mut repo = setup();
    let book_id = import_text(&mut repo, "alpha.txt", TEXT_A);
    let hits = repo.search_book(&book_id, "two", 10).unwrap();
    assert_eq!(hits.len(), 1);
    assert_eq!(hits[0].chapter_title, "Chapter 2");
    assert_eq!(hits[0].char_offset, 6); // "Alpha " is 6 scalars
}

#[test]
fn latest_revision_wins_over_late_write() {
    let mut repo = setup();
    let book_id = import_text(&mut repo, "alpha.txt", TEXT_A);
    let chapter_id = repo.list_chapter_refs(&book_id).unwrap()[0].id.clone();

    let anchor = |chapter_id: &str| ReaderAnchor {
        book_id: book_id.clone(),
        chapter_id: chapter_id.to_string(),
        paragraph_id: None,
        char_offset: 10,
        viewport_fraction: 0.5,
    };

    assert_eq!(
        repo.save_progress(&anchor(&chapter_id), 10).unwrap(),
        SaveOutcome::Applied { revision: 10 }
    );
    // An older write arriving later must be dropped (acceptance test AT-09).
    assert_eq!(
        repo.save_progress(&anchor(&chapter_id), 5).unwrap(),
        SaveOutcome::Stale { revision: 10 }
    );
    assert_eq!(repo.progress_revision(&book_id).unwrap(), 10);

    let stored = repo.get_progress(&book_id).unwrap().unwrap();
    assert_eq!(stored.char_offset, 10);
}

#[test]
fn progress_rejects_cross_book_chapter() {
    let mut repo = setup();
    let book_a = import_text(&mut repo, "alpha.txt", TEXT_A);
    let book_b = import_text(&mut repo, "beta.txt", TEXT_B);
    let chapter_b = repo.list_chapter_refs(&book_b).unwrap()[0].id.clone();

    let bogus = ReaderAnchor {
        book_id: book_a,
        chapter_id: chapter_b,
        paragraph_id: None,
        char_offset: 0,
        viewport_fraction: 0.0,
    };
    let err = repo.save_progress(&bogus, 1).unwrap_err();
    assert_eq!(err.code(), ErrorCode::InvalidInput);
}

#[test]
fn bookmarks_round_trip() {
    let mut repo = setup();
    let book_id = import_text(&mut repo, "alpha.txt", TEXT_A);
    let chapter = repo
        .get_chapter(&repo.list_chapter_refs(&book_id).unwrap()[0].id)
        .unwrap();
    let paragraph_id = chapter.paragraphs[0].id.clone();

    let anchor = ReaderAnchor {
        book_id: book_id.clone(),
        chapter_id: chapter.id.clone(),
        paragraph_id: Some(paragraph_id),
        char_offset: 2,
        viewport_fraction: 0.1,
    };
    let created = repo.create_bookmark(&anchor, Some("note".into())).unwrap();
    assert_eq!(created.chapter_ordinal, 0);
    assert!(created.excerpt.unwrap().contains("Alpha"));

    let list = repo.list_bookmarks(&book_id).unwrap();
    assert_eq!(list.len(), 1);

    repo.delete_bookmark(&created.id).unwrap();
    assert!(repo.list_bookmarks(&book_id).unwrap().is_empty());
}

#[test]
fn deleting_book_cascades_children() {
    let mut repo = setup();
    let book_id = import_text(&mut repo, "alpha.txt", TEXT_A);
    let chapter_id = repo.list_chapter_refs(&book_id).unwrap()[0].id.clone();
    let anchor = ReaderAnchor {
        book_id: book_id.clone(),
        chapter_id: chapter_id.clone(),
        paragraph_id: None,
        char_offset: 0,
        viewport_fraction: 0.0,
    };
    repo.save_progress(&anchor, 1).unwrap();
    repo.create_bookmark(&anchor, None).unwrap();

    repo.delete_book(&book_id).unwrap();

    assert_eq!(count(&repo, "books"), 0);
    assert_eq!(count(&repo, "chapters"), 0);
    assert_eq!(count(&repo, "paragraphs"), 0);
    assert_eq!(count(&repo, "bookmarks"), 0);
    assert_eq!(count(&repo, "reading_progress"), 0);
}

#[test]
fn resume_falls_back_when_anchor_is_missing() {
    let mut repo = setup();
    let book_id = import_text(&mut repo, "alpha.txt", TEXT_A);
    let state = resolve_resume(&repo, &book_id).unwrap();
    assert!(!state.fell_back);
    assert_eq!(
        state.anchor.unwrap().chapter_id,
        repo.list_chapter_refs(&book_id).unwrap()[0].id
    );
}

#[test]
fn settings_are_sanitized_and_persisted() {
    let base = AppSettings::default();
    let settings = AppSettings {
        active_skin: "not-a-skin".into(),
        font: FontSettings {
            size: 999.0,
            line_height: 0.1,
            ..base.font.clone()
        },
        hotkeys: Vec::new(),
        ..base
    };

    let clean = sanitize_settings(settings);
    assert_eq!(clean.active_skin, "vscode");
    assert_eq!(clean.font.size, 40.0);
    assert_eq!(clean.font.line_height, 1.0);
    // Critical stealth actions are restored from defaults.
    assert!(clean.hotkeys.iter().any(|h| h.action == "quickSwitch"));
    assert!(clean.hotkeys.iter().any(|h| h.action == "restoreReading"));

    let repo = setup();
    repo.put_settings(&clean).unwrap();
    let loaded = repo.get_settings().unwrap();
    assert_eq!(loaded.active_skin, "vscode");
    assert_eq!(loaded.font.size, 40.0);
}

#[test]
fn migration_is_idempotent() {
    let repo = setup();
    repo.migrate().expect("second migrate should be a no-op");
}
