//! Stealth Reader core.
//!
//! Deliberately free of any Tauri / UI dependency so domain rules, parsing and
//! persistence can be unit tested in isolation and reused by any shell. See
//! `docs/adr/0004-stealth-core-workspace-split.md`.

pub mod domain;
pub mod error;
pub mod import;
pub mod repository;
pub mod service;
pub mod util;

pub use error::{CoreError, CoreResult, ErrorCode};
pub use repository::{ChapterRef, RecentSession, Repository, SaveOutcome};
