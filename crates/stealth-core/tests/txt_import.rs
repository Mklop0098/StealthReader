use stealth_core::error::ErrorCode;
use stealth_core::import::parse_bytes;

#[test]
fn imports_utf8_txt_with_chapter_headings() {
    let text = "Chapter 1\nFirst line of chapter one.\nSecond line of chapter one.\n\nChapter 2\nChapter two text here.\n";
    let book = parse_bytes(text.as_bytes(), "my_novel.txt").unwrap();
    assert_eq!(book.format, "txt");
    assert_eq!(book.title, "my_novel");
    assert_eq!(book.chapters.len(), 2);
    assert_eq!(book.chapters[0].title, "Chapter 1");
    assert_eq!(
        book.chapters[0].paragraphs,
        vec!["First line of chapter one.", "Second line of chapter one."]
    );
    assert_eq!(book.chapters[1].title, "Chapter 2");
    assert_eq!(book.chapters[1].paragraphs, vec!["Chapter two text here."]);
}

#[test]
fn single_chapter_gets_generated_title() {
    let book = parse_bytes("Just some prose.\nMore prose.".as_bytes(), "notes.txt").unwrap();
    assert_eq!(book.chapters.len(), 1);
    assert_eq!(book.chapters[0].title, "Chapter 1");
}

#[test]
fn utf8_bom_is_tolerated() {
    let mut bytes = vec![0xEF, 0xBB, 0xBF];
    bytes.extend_from_slice("Chapter 1\nHello.".as_bytes());
    let book = parse_bytes(&bytes, "bom.txt").unwrap();
    assert_eq!(book.chapters[0].paragraphs, vec!["Hello."]);
}

#[test]
fn invalid_utf8_is_rejected() {
    let bytes = [0x41, 0xFF, 0xFE, 0x42];
    let err = parse_bytes(&bytes, "bad.txt").unwrap_err();
    assert_eq!(err.code(), ErrorCode::InvalidInput);
}

#[test]
fn utf16_bom_is_reported_as_unsupported() {
    let bytes = [0xFF, 0xFE, 0x41, 0x00];
    let err = parse_bytes(&bytes, "utf16.txt").unwrap_err();
    assert_eq!(err.code(), ErrorCode::UnsupportedFormat);
}

#[test]
fn unsupported_extension_is_rejected() {
    let err = parse_bytes(b"data", "book.pdf").unwrap_err();
    assert_eq!(err.code(), ErrorCode::UnsupportedFormat);
}

#[test]
fn empty_payload_is_rejected() {
    let err = parse_bytes(b"", "empty.txt").unwrap_err();
    assert_eq!(err.code(), ErrorCode::InvalidInput);
}
