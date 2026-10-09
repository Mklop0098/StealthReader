//! Text normalization and anchor arithmetic.
//!
//! Anchor offsets are expressed in Unicode **scalar values** (Rust `char`s),
//! never UTF-16 code units (PRD section 5). All helpers here operate on chars
//! so the frontend and backend agree on offsets.

/// Normalizes CRLF/CR to LF.
pub fn normalize_newlines(input: &str) -> String {
    if !input.contains('\r') {
        return input.to_string();
    }
    input.replace("\r\n", "\n").replace('\r', "\n")
}

/// Removes a leading UTF-8 BOM if present.
pub fn strip_bom(input: &str) -> &str {
    input.strip_prefix('\u{feff}').unwrap_or(input)
}

/// Splits a block of prose into paragraphs, collapsing internal whitespace runs
/// to single spaces.
///
/// Novels are published both with blank lines between paragraphs and with a
/// single newline per paragraph. The splitter adapts: when the block has no
/// blank-line separation at all, each line becomes a paragraph; otherwise blank
/// lines are the paragraph delimiter (so hard-wrapped text stays intact).
pub fn split_paragraphs(block: &str) -> Vec<String> {
    let block = block.trim();
    if block.is_empty() {
        return Vec::new();
    }
    let has_blank_line =
        block.contains("\n\n") || block.contains("\r\n\r\n") || block.contains("\r\r");
    let mut paragraphs = Vec::new();
    let segments: Vec<&str> = if has_blank_line {
        block.split("\n\n").collect()
    } else {
        block.split('\n').collect()
    };
    for raw in segments {
        let collapsed = collapse_whitespace(raw);
        if !collapsed.is_empty() {
            paragraphs.push(collapsed);
        }
    }
    paragraphs
}

/// Collapses any run of whitespace (spaces, tabs, newlines) to a single space.
pub fn collapse_whitespace(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    let mut in_ws = false;
    for ch in input.chars() {
        if ch.is_whitespace() {
            if !in_ws && !out.is_empty() {
                out.push(' ');
            }
            in_ws = true;
        } else {
            out.push(ch);
            in_ws = false;
        }
    }
    while out.ends_with(' ') {
        out.pop();
    }
    out
}

/// Rough word count: whitespace-delimited tokens. Scripts without spaces count
/// as a single token, which is acceptable for MVP progress display.
pub fn count_words(input: &str) -> i64 {
    input.split_whitespace().count() as i64
}

/// Number of scalar values in a string.
pub fn scalar_len(input: &str) -> i64 {
    input.chars().count() as i64
}

/// Byte index of the n-th scalar value, clamped to the end of the string.
fn byte_index_of_scalar(input: &str, scalar_offset: i64) -> usize {
    if scalar_offset <= 0 {
        return 0;
    }
    match input.char_indices().nth(scalar_offset as usize) {
        Some((idx, _)) => idx,
        None => input.len(),
    }
}

/// Returns a slice starting at `start` scalar values, spanning up to `len`.
pub fn slice_scalar(input: &str, start: i64, len: i64) -> String {
    let start_idx = byte_index_of_scalar(input, start.max(0));
    let end_idx = byte_index_of_scalar(input, start.max(0) + len.max(0));
    input[start_idx..end_idx].to_string()
}

/// Truncates to at most `max` scalar values.
pub fn truncate_scalar(input: &str, max: i64) -> String {
    slice_scalar(input, 0, max.max(0))
}

/// Clamps an offset into `0..=scalar_len(input)`.
pub fn clamp_offset(input: &str, offset: i64) -> i64 {
    offset.clamp(0, scalar_len(input))
}

/// Builds a bounded, display-safe snippet centered on `char_offset`.
pub fn snippet_around(input: &str, char_offset: i64, radius: i64) -> String {
    let start = (char_offset - radius).max(0);
    let length = radius * 2;
    let body = slice_scalar(input, start, length);
    let prefix = if start > 0 { "…" } else { "" };
    let suffix = if start + length < scalar_len(input) {
        "…"
    } else {
        ""
    };
    format!("{prefix}{body}{suffix}")
}

const MAX_HEADING_LEN: usize = 80;
/// A heading without a numeric/roman ordinal must be at most this long.
const MAX_TITLED_HEADING_LEN: usize = 40;

fn is_number_token(token: &str) -> bool {
    !token.is_empty() && token.len() <= 6 && token.chars().all(|c| c.is_ascii_digit())
}

fn is_roman_token(token: &str) -> bool {
    !token.is_empty()
        && token.len() <= 7
        && token
            .chars()
            .all(|c| matches!(c, 'i' | 'v' | 'x' | 'l' | 'c' | 'd' | 'm'))
}

fn ends_with_sentence_punctuation(text: &str) -> bool {
    matches!(text.chars().last(), Some('.' | ',' | ';' | '!' | '?'))
}

/// Decides whether the text after a chapter keyword is ordinal-like (a number
/// or roman numeral) or a short title, rejecting prose such as
/// "Chapter two text here." that merely starts with the keyword.
fn looks_like_heading(rest: &str, trimmed: &str) -> bool {
    let token = rest
        .split_whitespace()
        .next()
        .unwrap_or("")
        .trim_matches(|c| matches!(c, ':' | '.' | '—' | '-' | ')'));
    if is_number_token(token) || is_roman_token(token) {
        return true;
    }
    trimmed.chars().count() <= MAX_TITLED_HEADING_LEN && !ends_with_sentence_punctuation(trimmed)
}

/// Heuristic chapter-heading detection for plain-text imports.
pub fn is_chapter_heading(line: &str) -> bool {
    let trimmed = line.trim();
    if trimmed.is_empty() || trimmed.chars().count() > MAX_HEADING_LEN {
        return false;
    }
    let lower = trimmed.to_lowercase();
    const PREFIXES: [&str; 8] = [
        "chapter",
        "chương",
        "chuong",
        "hồi",
        "quyển",
        "prologue",
        "epilogue",
        "interlude",
    ];
    for prefix in PREFIXES {
        if let Some(rest) = lower.strip_prefix(prefix) {
            // Guard against words like "chapterhouse": the prefix must be
            // followed by a separator, a digit, or the end of the line.
            match rest.chars().next() {
                None => return true,
                Some(next) => {
                    if (!next.is_alphanumeric() || next.is_ascii_digit())
                        && looks_like_heading(rest, trimmed)
                    {
                        return true;
                    }
                }
            }
        }
    }
    // CJK style: 第N章 / 第N回 / 第N节 / 第N卷
    if trimmed.starts_with('第') {
        const CJK_UNITS: [char; 4] = ['章', '回', '节', '卷'];
        let body: String = trimmed.chars().take(20).collect();
        if CJK_UNITS.iter().any(|u| body.contains(*u)) {
            return true;
        }
    }
    false
}

/// A decorative separator line (e.g. `====`, `----`, `***`) marks a break.
pub fn is_separator_line(line: &str) -> bool {
    let trimmed = line.trim();
    if trimmed.chars().count() < 3 {
        return false;
    }
    let first = match trimmed.chars().next() {
        Some(c) => c,
        None => return false,
    };
    const SEPARATORS: [char; 8] = ['=', '-', '*', '_', '~', '#', '·', '—'];
    if !SEPARATORS.contains(&first) {
        return false;
    }
    trimmed.chars().all(|c| c == first || c.is_whitespace())
}
