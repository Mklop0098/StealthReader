//! Tolerant HTML/XHTML text extraction.
//!
//! EPUB content documents are treated as *content*, never markup to render.
//! This module converts a document into plain-text paragraphs and discards all
//! active content (`<script>`, `<style>`), so the result can never execute or
//! fetch a remote resource (PRD section 4 / acceptance test AT-11).

use crate::domain::text::collapse_whitespace;

#[derive(Debug, Default, Clone, PartialEq)]
pub struct ExtractedDocument {
    /// Value of the document's `<title>` element, if any.
    pub title: Option<String>,
    /// Text of `<h1>`..`<h6>` elements, in document order.
    pub headings: Vec<String>,
    pub paragraphs: Vec<String>,
}

const BLOCK_TAGS: [&str; 30] = [
    "p",
    "div",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "li",
    "tr",
    "section",
    "article",
    "blockquote",
    "pre",
    "td",
    "th",
    "ul",
    "ol",
    "table",
    "header",
    "footer",
    "figcaption",
    "br",
    "hr",
    "aside",
    "nav",
    "main",
    "figure",
    "dl",
    "dt",
];

/// Case-insensitive search for `needle` in `haystack` starting at `from`,
/// returning the byte index of the match.
fn find_ci(haystack: &[u8], needle: &[u8], from: usize) -> Option<usize> {
    if needle.is_empty() || haystack.len() < needle.len() {
        return None;
    }
    let last = haystack.len() - needle.len();
    let mut i = from;
    while i <= last {
        let mut matched = true;
        for (offset, needle_byte) in needle.iter().enumerate() {
            if haystack[i + offset].to_ascii_lowercase() != *needle_byte {
                matched = false;
                break;
            }
        }
        if matched {
            return Some(i);
        }
        i += 1;
    }
    None
}

fn is_block_tag(name: &str) -> bool {
    BLOCK_TAGS.contains(&name)
}

fn is_heading_tag(name: &str) -> bool {
    matches!(name, "h1" | "h2" | "h3" | "h4" | "h5" | "h6")
}

/// Decodes the common HTML entities and numeric character references.
pub fn decode_entities(input: &str) -> String {
    if !input.contains('&') {
        return input.to_string();
    }
    let mut out = String::with_capacity(input.len());
    let chars: Vec<char> = input.chars().collect();
    let mut i = 0;
    while i < chars.len() {
        let ch = chars[i];
        if ch != '&' {
            out.push(ch);
            i += 1;
            continue;
        }
        // Look ahead for a terminating ';' within a short window.
        let mut end = None;
        let limit = (i + 12).min(chars.len());
        for (j, candidate) in chars.iter().enumerate().take(limit).skip(i + 1) {
            if *candidate == ';' {
                end = Some(j);
                break;
            }
            if candidate.is_whitespace() || *candidate == '&' {
                break;
            }
        }
        let Some(end) = end else {
            out.push('&');
            i += 1;
            continue;
        };
        let entity: String = chars[i + 1..end].iter().collect();
        match resolve_entity(&entity) {
            Some(resolved) => {
                out.push_str(&resolved);
                i = end + 1;
            }
            None => {
                out.push('&');
                i += 1;
            }
        }
    }
    out
}

fn resolve_entity(entity: &str) -> Option<String> {
    let named = match entity {
        "amp" => Some("&"),
        "lt" => Some("<"),
        "gt" => Some(">"),
        "quot" => Some("\""),
        "apos" => Some("'"),
        "nbsp" => Some(" "),
        "mdash" => Some("—"),
        "ndash" => Some("–"),
        "hellip" => Some("…"),
        "lsquo" => Some("‘"),
        "rsquo" => Some("’"),
        "ldquo" => Some("“"),
        "rdquo" => Some("”"),
        "laquo" => Some("«"),
        "raquo" => Some("»"),
        "copy" => Some("©"),
        "reg" => Some("®"),
        "trade" => Some("™"),
        "deg" => Some("°"),
        _ => None,
    };
    if let Some(value) = named {
        return Some(value.to_string());
    }
    if let Some(rest) = entity
        .strip_prefix("#x")
        .or_else(|| entity.strip_prefix("#X"))
    {
        let code = u32::from_str_radix(rest, 16).ok()?;
        return char::from_u32(code).map(|c| c.to_string());
    }
    if let Some(rest) = entity.strip_prefix('#') {
        let code = rest.parse::<u32>().ok()?;
        return char::from_u32(code).map(|c| c.to_string());
    }
    None
}

/// Extracts title and paragraphs from an XHTML/HTML document.
pub fn extract_document(html: &str) -> ExtractedDocument {
    let bytes = html.as_bytes();
    let len = bytes.len();
    let mut doc = ExtractedDocument::default();
    let mut current = String::new();
    let mut capture_heading = false;
    let mut i = 0;

    while i < len {
        if bytes[i] != b'<' {
            // Advance one full UTF-8 char so we never split a code point.
            let rest = &html[i..];
            let ch = match rest.chars().next() {
                Some(c) => c,
                None => break,
            };
            current.push(ch);
            i += ch.len_utf8();
            continue;
        }

        if bytes[i..].starts_with(b"<!--") {
            match find_ci(bytes, b"-->", i + 4) {
                Some(pos) => i = pos + 3,
                None => break,
            }
            continue;
        }

        if bytes[i..]
            .get(..7)
            .is_some_and(|tag| tag.eq_ignore_ascii_case(b"<script"))
        {
            flush(&mut current, &mut doc, capture_heading);
            capture_heading = false;
            match find_ci(bytes, b"</script", i + 7) {
                Some(pos) => i = close_tag_end(bytes, pos),
                None => break,
            }
            continue;
        }

        if bytes[i..]
            .get(..6)
            .is_some_and(|tag| tag.eq_ignore_ascii_case(b"<style"))
        {
            match find_ci(bytes, b"</style", i + 6) {
                Some(pos) => i = close_tag_end(bytes, pos),
                None => break,
            }
            continue;
        }

        if bytes[i..]
            .get(..6)
            .is_some_and(|tag| tag.eq_ignore_ascii_case(b"<title"))
        {
            if let Some(gt) = find_byte(bytes, b'>', i) {
                let start = gt + 1;
                if let Some(close) = find_ci(bytes, b"</title", start) {
                    let text = &html[start..close];
                    let decoded = collapse_whitespace(&decode_entities(text));
                    if !decoded.is_empty() {
                        doc.title = Some(decoded);
                    }
                    i = close_tag_end(bytes, close);
                    continue;
                }
            }
            i += 1;
            continue;
        }

        // Generic tag: parse name and skip attributes respecting quotes.
        let tag_start = i + 1;
        let closing = bytes.get(tag_start) == Some(&b'/');
        let name_start = if closing { tag_start + 1 } else { tag_start };
        let name_end = {
            let mut j = name_start;
            while j < len && (bytes[j].is_ascii_alphanumeric() || bytes[j] == b':') {
                j += 1;
            }
            j
        };
        let name = html[name_start..name_end].to_ascii_lowercase();
        let tag_end = match find_tag_end(bytes, name_end) {
            Some(end) => end,
            None => break,
        };
        if !name.is_empty() && is_block_tag(&name) {
            flush(&mut current, &mut doc, capture_heading);
            capture_heading = !closing && is_heading_tag(&name);
        }
        i = tag_end + 1;
    }

    flush(&mut current, &mut doc, false);
    doc
}

fn find_byte(bytes: &[u8], needle: u8, from: usize) -> Option<usize> {
    let mut i = from;
    while i < bytes.len() {
        if bytes[i] == needle {
            return Some(i);
        }
        i += 1;
    }
    None
}

/// Finds the index of the `>` that closes the tag starting at `from`,
/// skipping over quoted attribute values.
fn find_tag_end(bytes: &[u8], from: usize) -> Option<usize> {
    let mut i = from;
    let mut quote: Option<u8> = None;
    while i < bytes.len() {
        let b = bytes[i];
        match quote {
            Some(q) => {
                if b == q {
                    quote = None;
                }
            }
            None => {
                if b == b'"' || b == b'\'' {
                    quote = Some(b);
                } else if b == b'>' {
                    return Some(i);
                }
            }
        }
        i += 1;
    }
    None
}

/// Given the index of `<` in a closing tag, returns the index just past `>`.
fn close_tag_end(bytes: &[u8], lt_index: usize) -> usize {
    match find_byte(bytes, b'>', lt_index) {
        Some(pos) => pos + 1,
        None => bytes.len(),
    }
}

fn flush(current: &mut String, doc: &mut ExtractedDocument, capture_heading: bool) {
    if current.trim().is_empty() {
        current.clear();
        return;
    }
    let decoded = decode_entities(current);
    let collapsed = collapse_whitespace(&decoded);
    if !collapsed.is_empty() {
        if capture_heading {
            doc.headings.push(collapsed);
        } else {
            doc.paragraphs.push(collapsed);
        }
    }
    current.clear();
}

#[cfg(test)]
mod tests {
    use super::extract_document;

    #[test]
    fn extracts_large_chapter_with_many_tags() {
        // Repeated searches to the end of the document made this input quadratic.
        let html = format!(
            "<html><body>{}</body></html>",
            "<p>Xin <em>chào</em> bạn.</p>".repeat(20_000)
        );
        let doc = extract_document(&html);
        assert_eq!(doc.paragraphs.len(), 20_000);
        assert!(doc.paragraphs.iter().all(|p| p == "Xin chào bạn."));
    }

    #[test]
    fn recognizes_mixed_case_special_tags_and_short_trailing_tag() {
        let doc = extract_document(
            "<TiTlE>Tên sách</TiTlE><STYLE>hidden</STYLE><SCRIPT>hidden</SCRIPT><p>Nội dung</p><",
        );
        assert_eq!(doc.title.as_deref(), Some("Tên sách"));
        assert_eq!(doc.paragraphs, vec!["Nội dung"]);
    }
}
