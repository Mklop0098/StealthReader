mod commands;
mod error;
mod importer;
mod shortcuts;
mod state;

use std::fs;
use std::sync::Mutex;

use tauri::Manager;

use stealth_core::Repository;

use state::AppState;

const DATABASE_FILE: &str = "stealth_reader.db";

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(shortcuts::plugin())
        .setup(|app| {
            let data_dir = app.path().app_data_dir()?;
            fs::create_dir_all(&data_dir)?;
            let originals_dir = data_dir.join("originals");
            let staging_dir = data_dir.join("staging");
            fs::create_dir_all(&originals_dir)?;
            fs::create_dir_all(&staging_dir)?;

            let repo = Repository::open(&data_dir.join(DATABASE_FILE))?;
            repo.migrate()?;
            importer::recover(&repo, &staging_dir);

            app.manage(AppState {
                db: Mutex::new(repo),
                originals_dir,
                staging_dir,
            });
            app.manage(shortcuts::Bindings::default());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::library::import_book,
            commands::library::list_books,
            commands::library::get_book,
            commands::library::list_chapters,
            commands::library::get_chapter,
            commands::library::delete_book,
            commands::reader::save_progress,
            commands::reader::get_progress,
            commands::reader::resume_book,
            commands::reader::create_bookmark,
            commands::reader::list_bookmarks,
            commands::reader::delete_bookmark,
            commands::reader::search_book,
            commands::reader::start_session,
            commands::reader::end_session,
            commands::settings::get_settings,
            commands::settings::update_settings,
            commands::system::register_shortcuts,
            commands::system::set_window_title,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Stealth Reader");
}
