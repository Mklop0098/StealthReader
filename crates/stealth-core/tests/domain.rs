use stealth_core::domain::html::{decode_entities, extract_document};
use stealth_core::domain::text::{
    clamp_offset, collapse_whitespace, count_words, is_chapter_heading, is_separator_line,
    scalar_len, slice_scalar, snippet_around, split_paragraphs, truncate_scalar,
};

#[test]
fn offsets_count_unicode_scalar_values() {
    let text = "a😀b";
    assert_eq!(scalar_len(text), 3);
    assert_eq!(slice_scalar(text, 1, 1), "😀");
    assert_eq!(truncate_scalar(text, 2), "a😀");
    assert_eq!(clamp_offset(text, 99), 3);
    assert_eq!(clamp_offset(text, -5), 0);
}

#[test]
fn snippet_is_bounded_and_marked() {
    let text = "hello world";
    assert_eq!(snippet_around(text, 6, 3), "…lo wor…");
    assert_eq!(snippet_around(text, 0, 100), "hello world");
}

#[test]
fn whitespace_is_collapsed() {
    assert_eq!(collapse_whitespace("  a \t b\n c "), "a b c");
    assert_eq!(count_words("one two   three"), 3);
}

#[test]
fn paragraph_splitter_adapts_to_layout() {
    // Blank-line separated paragraphs keep their internal wrapping.
    assert_eq!(split_paragraphs("l1\nl2\n\nl3"), vec!["l1 l2", "l3"]);
    // Without blank lines each line is a paragraph (novel TXT layout).
    assert_eq!(split_paragraphs("a\nb\nc"), vec!["a", "b", "c"]);
    // Trailing newlines do not flip the mode.
    assert_eq!(split_paragraphs("a\nb\n"), vec!["a", "b"]);
}

#[test]
fn chapter_headings_are_detected_conservatively() {
    assert!(is_chapter_heading("Chapter 1"));
    assert!(is_chapter_heading("chapter twelve: the return"));
    assert!(is_chapter_heading("Chương 3"));
    assert!(is_chapter_heading("第一章"));
    assert!(is_chapter_heading("Prologue"));
    assert!(!is_chapter_heading("Chapterhouse rules"));
    assert!(!is_chapter_heading("Chapter two text here."));
    assert!(!is_chapter_heading("A normal sentence."));

    assert!(is_separator_line("===="));
    assert!(is_separator_line("----"));
    assert!(is_separator_line("***"));
    assert!(!is_separator_line("--"));
    assert!(!is_separator_line("a==="));
}

#[test]
fn entities_are_decoded() {
    assert_eq!(decode_entities("a &amp; b &lt;c&gt;"), "a & b <c>");
    assert_eq!(decode_entities("&#65;&#x42;"), "AB");
    assert_eq!(decode_entities("5 & 6"), "5 & 6");
}

#[test]
fn html_extraction_strips_active_content_and_keeps_text() {
    let html = r#"<html><head><title>My Doc</title>
        <script>alert('pwn')</script>
        <style>p { color: red }</style>
    </head><body>
        <h1>Heading</h1>
        <p>First &amp; only.</p>
        <p>Second <b>bold</b> text.</p>
        <div>Third</div>
    </body></html>"#;
    let doc = extract_document(html);
    assert_eq!(doc.title.as_deref(), Some("My Doc"));
    assert_eq!(doc.headings, vec!["Heading"]);
    assert_eq!(
        doc.paragraphs,
        vec!["First & only.", "Second bold text.", "Third"]
    );
    // No script or style text leaked into any field.
    let joined = format!("{:?}", doc);
    assert!(!joined.contains("alert"));
    assert!(!joined.contains("color: red"));
}
