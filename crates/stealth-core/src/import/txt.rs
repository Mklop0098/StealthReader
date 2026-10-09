//! Plain-text (UTF-8) import.

use crate::domain::models::ImportedChapter;
use crate::domain::text::{
    count_words, is_chapter_heading, is_separator_line, normalize_newlines, scalar_len,
    split_paragraphs, strip_bom,
};
use crate::error::{CoreError, CoreResult};

use super::limits::{MAX_CHAPTERS, MAX_PARAGRAPHS_PER_CHAPTER, MAX_PARAGRAPH_CHARS};

/// Decodes a TXT payload as strict UTF-8, rejecting BOMs of other encodings with
/// an actionable message (acceptance criterion FR-01).
pub fn decode_utf8(bytes: &[u8]) -> CoreResult<String> {
    if bytes.starts_with(&[0xFF, 0xFE]) {
        return Err(CoreError::UnsupportedFormat(
            "file appears to be UTF-16LE; re-save it as UTF-8".into(),
        ));
    }
    if bytes.starts_with(&[0xFE, 0xFF]) {
        return Err(CoreError::UnsupportedFormat(
            "file appears to be UTF-16BE; re-save it as UTF-8".into(),
        ));
    }
    if bytes.starts_with(&[0xEF, 0xBB, 0xBF]) {
        return decode_strict(&bytes[3..]);
    }
    decode_strict(bytes)
}

fn decode_strict(bytes: &[u8]) -> CoreResult<String> {
    match std::str::from_utf8(bytes) {
        Ok(text) => Ok(text.to_string()),
        Err(err) => Err(CoreError::InvalidInput(format!(
            "file is not valid UTF-8 (invalid byte at offset {})",
            err.valid_up_to()
        ))),
    }
}

/// Splits a decoded text document into chapters using heading/separator
/// heuristics, then normalizes paragraphs.
pub fn split_chapters(text: &str) -> CoreResult<Vec<ImportedChapter>> {
    let normalized = normalize_newlines(text);
    let normalized = strip_bom(&normalized);

    let mut draft: Vec<(Option<String>, String)> = Vec::new();
    let mut current_title: Option<String> = None;
    let mut current_body = String::new();

    for line in normalized.split('\n') {
        if is_chapter_heading(line) {
            push_draft(&mut draft, &mut current_title, &mut current_body);
            current_title = Some(line.trim().to_string());
        } else if is_separator_line(line) {
            push_draft(&mut draft, &mut current_title, &mut current_body);
        } else {
            current_body.push_str(line);
            current_body.push('\n');
        }
    }
    push_draft(&mut draft, &mut current_title, &mut current_body);

    let mut chapters = Vec::new();
    for (index, (title, body)) in draft.iter().enumerate() {
        let paragraphs: Vec<String> = split_paragraphs(body)
            .into_iter()
            .map(|paragraph| {
                if scalar_len(&paragraph) > MAX_PARAGRAPH_CHARS as i64 {
                    crate::domain::text::truncate_scalar(&paragraph, MAX_PARAGRAPH_CHARS as i64)
                } else {
                    paragraph
                }
            })
            .collect();
        if paragraphs.is_empty() {
            continue;
        }
        if paragraphs.len() > MAX_PARAGRAPHS_PER_CHAPTER {
            return Err(CoreError::ImportFailed(
                "chapter exceeds the maximum paragraph count".into(),
            ));
        }
        let word_count = paragraphs.iter().map(|p| count_words(p)).sum();
        let title = title
            .clone()
            .filter(|t| !t.is_empty())
            .unwrap_or_else(|| format!("Chapter {}", index + 1));
        chapters.push(ImportedChapter {
            title,
            word_count,
            paragraphs,
        });
        if chapters.len() > MAX_CHAPTERS {
            return Err(CoreError::ImportFailed(
                "document exceeds the maximum chapter count".into(),
            ));
        }
    }

    if chapters.is_empty() {
        return Err(CoreError::ImportFailed(
            "no readable text found in file".into(),
        ));
    }
    Ok(chapters)
}

fn push_draft(
    draft: &mut Vec<(Option<String>, String)>,
    title: &mut Option<String>,
    body: &mut String,
) {
    if body.trim().is_empty() && title.is_none() {
        body.clear();
        return;
    }
    draft.push((title.take(), std::mem::take(body)));
}
