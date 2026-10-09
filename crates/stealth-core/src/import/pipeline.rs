//! Import coordinator: validates a selected file, parses it into an
//! `ImportedBook`, and computes the content hash. Parsing happens entirely
//! outside any database transaction (PRD section 5).

use std::path::Path;

use crate::domain::models::ImportedBook;
use crate::error::{CoreError, CoreResult};
use crate::util::{basename, extension_lower, sha256_hex};

use super::epub::parse_epub_with_progress;
use super::limits::MAX_FILE_BYTES;
use super::txt::{decode_utf8, split_chapters};
use super::ImportProgress;

/// Reads and parses a file from disk. The caller is responsible for having
/// obtained the path from a native file picker or backend-validated source.
pub fn parse_file(path: &Path) -> CoreResult<ImportedBook> {
    parse_file_with_progress(path, &mut |_| {})
}

pub fn parse_file_with_progress(
    path: &Path,
    progress: &mut dyn FnMut(ImportProgress),
) -> CoreResult<ImportedBook> {
    progress(ImportProgress::new("reading", 0, 0, 0));
    let metadata = std::fs::metadata(path)?;
    if !metadata.is_file() {
        return Err(CoreError::InvalidInput(
            "selected path is not a file".into(),
        ));
    }
    if metadata.len() > MAX_FILE_BYTES {
        return Err(CoreError::ImportFailed(format!(
            "file exceeds the maximum import size of {} MiB",
            MAX_FILE_BYTES / (1024 * 1024)
        )));
    }
    let bytes = std::fs::read(path)?;
    let source_name = path
        .file_name()
        .and_then(|n| n.to_str())
        .map(|n| n.to_string())
        .unwrap_or_else(|| "book".to_string());
    parse_bytes_with_progress(&bytes, &source_name, progress)
}

/// Parses an in-memory payload. Kept separate from `parse_file` so tests can
/// exercise the pipeline without filesystem fixtures.
pub fn parse_bytes(bytes: &[u8], source_name: &str) -> CoreResult<ImportedBook> {
    parse_bytes_with_progress(bytes, source_name, &mut |_| {})
}

fn parse_bytes_with_progress(
    bytes: &[u8],
    source_name: &str,
    progress: &mut dyn FnMut(ImportProgress),
) -> CoreResult<ImportedBook> {
    progress(ImportProgress::new("parsing", 5, 0, 0));
    if bytes.is_empty() {
        return Err(CoreError::InvalidInput("file is empty".into()));
    }
    if bytes.len() as u64 > MAX_FILE_BYTES {
        return Err(CoreError::ImportFailed(
            "file exceeds the maximum import size".into(),
        ));
    }

    let extension = extension_lower(source_name)
        .ok_or_else(|| CoreError::UnsupportedFormat("file has no extension".into()))?;
    let sha = sha256_hex(bytes);
    let stem = file_stem(source_name);

    let book = match extension.as_str() {
        "txt" => {
            let text = decode_utf8(bytes)?;
            let chapters = split_chapters(&text)?;
            ImportedBook {
                title: stem,
                author: None,
                language: None,
                format: "txt".to_string(),
                source_name: basename(source_name),
                source_sha256: sha,
                chapters,
            }
        }
        "epub" => {
            let content = parse_epub_with_progress(bytes, progress)?;
            ImportedBook {
                title: content
                    .title
                    .filter(|t| !t.trim().is_empty())
                    .unwrap_or(stem),
                author: content.author,
                language: content.language,
                format: "epub".to_string(),
                source_name: basename(source_name),
                source_sha256: sha,
                chapters: content.chapters,
            }
        }
        other => {
            return Err(CoreError::UnsupportedFormat(format!(
                "unsupported file type .{other}; only .txt and .epub are supported"
            )))
        }
    };

    Ok(book)
}

fn file_stem(source_name: &str) -> String {
    let base = basename(source_name);
    match base.rsplit_once('.') {
        Some((stem, _ext)) if !stem.is_empty() => stem.to_string(),
        _ => base,
    }
}
