use std::io::{Cursor, Write};

use stealth_core::error::ErrorCode;
use stealth_core::import::parse_bytes;
use zip::write::SimpleFileOptions;
use zip::CompressionMethod;

fn build_epub(files: &[(&str, &str)]) -> Vec<u8> {
    let mut writer = zip::ZipWriter::new(Cursor::new(Vec::new()));
    let options = SimpleFileOptions::default().compression_method(CompressionMethod::Stored);
    writer.start_file("mimetype", options).unwrap();
    writer.write_all(b"application/epub+zip").unwrap();
    for (name, content) in files {
        writer.start_file(*name, options).unwrap();
        writer.write_all(content.as_bytes()).unwrap();
    }
    writer.finish().unwrap().into_inner()
}

const CONTAINER: &str = r#"<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>"#;

fn opf(extra_spine: &str) -> String {
    format!(
        r#"<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="id">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>Test Book</dc:title>
    <dc:creator>Jane Author</dc:creator>
    <dc:language>en</dc:language>
  </metadata>
  <manifest>
    <item id="c1" href="chap1.xhtml" media-type="application/xhtml+xml"/>
    <item id="c2" href="chap2.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine>
    <itemref idref="c1"/>
    <itemref idref="c2"/>{extra_spine}
  </spine>
</package>"#
    )
}

const CHAP1: &str = r#"<html xmlns="http://www.w3.org/1999/xhtml"><head>
<title>Test Book</title>
<script>alert('pwn')</script>
<style>p{color:red}</style>
<link rel="stylesheet" href="http://evil.example/x.css"/>
</head><body>
<h1>Chapter One</h1>
<p>First &amp; foremost.</p>
<p>Second paragraph.</p>
</body></html>"#;

const CHAP2: &str = r#"<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Test Book</title></head>
<body><h2>Chapter Two</h2><p>Body two.</p></body></html>"#;

#[test]
fn imports_epub_in_spine_order_without_active_content() {
    let bytes = build_epub(&[
        ("META-INF/container.xml", CONTAINER),
        ("OEBPS/content.opf", &opf("")),
        ("OEBPS/chap1.xhtml", CHAP1),
        ("OEBPS/chap2.xhtml", CHAP2),
    ]);

    let book = parse_bytes(&bytes, "novel.epub").expect("epub should import");
    assert_eq!(book.format, "epub");
    assert_eq!(book.title, "Test Book");
    assert_eq!(book.author.as_deref(), Some("Jane Author"));
    assert_eq!(book.language.as_deref(), Some("en"));
    assert_eq!(book.chapters.len(), 2);
    assert_eq!(book.chapters[0].title, "Chapter One");
    assert_eq!(book.chapters[1].title, "Chapter Two");
    assert_eq!(
        book.chapters[0].paragraphs,
        vec!["First & foremost.", "Second paragraph."]
    );
    assert_eq!(book.chapters[1].paragraphs, vec!["Body two."]);

    let joined = format!("{:?}", book.chapters);
    assert!(!joined.contains("alert"));
    assert!(!joined.contains("evil.example"));
}

#[test]
fn reports_ordered_chapter_progress() {
    let bytes = build_epub(&[
        ("META-INF/container.xml", CONTAINER),
        ("OEBPS/content.opf", &opf("")),
        ("OEBPS/chap1.xhtml", CHAP1),
        ("OEBPS/chap2.xhtml", CHAP2),
    ]);
    let mut updates = Vec::new();
    let content =
        stealth_core::import::epub::parse_epub_with_progress(&bytes, &mut |p| updates.push(p))
            .unwrap();
    assert_eq!(content.chapters.len(), 2);
    assert_eq!(
        updates.iter().map(|p| p.completed).collect::<Vec<_>>(),
        vec![0, 1, 2]
    );
    assert!(updates
        .iter()
        .all(|p| p.total == 2 && p.stage == "chapters"));
    assert!(updates.windows(2).all(|p| p[0].percent <= p[1].percent));
    assert_eq!(updates.last().unwrap().percent, 75);
}

#[test]
fn rejects_missing_container() {
    let bytes = build_epub(&[("OEBPS/content.opf", &opf(""))]);
    let err = parse_bytes(&bytes, "novel.epub").unwrap_err();
    assert_eq!(err.code(), ErrorCode::UnsupportedFormat);
}

#[test]
fn rejects_path_traversal_entries() {
    let bytes = build_epub(&[
        ("META-INF/container.xml", CONTAINER),
        ("../../evil.xhtml", "<p>x</p>"),
    ]);
    let err = parse_bytes(&bytes, "novel.epub").unwrap_err();
    assert_eq!(err.code(), ErrorCode::ImportFailed);
}

#[test]
fn rejects_non_zip_payload_claiming_to_be_epub() {
    let err = parse_bytes(b"this is not a zip file", "novel.epub").unwrap_err();
    assert_eq!(err.code(), ErrorCode::UnsupportedFormat);
}
