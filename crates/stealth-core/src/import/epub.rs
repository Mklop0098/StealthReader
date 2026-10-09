//! DRM-free EPUB import.
//!
//! The archive is opened defensively: entry count, declared and actual
//! uncompressed sizes and traversal-style names are all validated before any
//! content is read. Active content in XHTML is stripped by the text extractor,
//! so scripts and remote resources never reach the frontend (AT-11).

use std::collections::HashMap;
use std::io::{Cursor, Read};

use quick_xml::events::{BytesStart, Event};
use quick_xml::{Reader, XmlVersion};
use zip::ZipArchive;

use crate::domain::html::extract_document;
use crate::domain::models::ImportedChapter;
use crate::domain::text::{count_words, scalar_len, truncate_scalar};
use crate::error::{CoreError, CoreResult};

use super::limits::{
    MAX_CHAPTERS, MAX_ENTRY_UNCOMPRESSED_BYTES, MAX_EPUB_ENTRIES, MAX_PARAGRAPHS_PER_CHAPTER,
    MAX_PARAGRAPH_CHARS, MAX_TOTAL_UNCOMPRESSED_BYTES,
};

#[derive(Debug, Clone)]
pub struct EpubContent {
    pub title: Option<String>,
    pub author: Option<String>,
    pub language: Option<String>,
    pub chapters: Vec<ImportedChapter>,
}

struct EntryMeta {
    original: String,
    normalized: String,
    size: u64,
}

#[derive(Default)]
struct OpfData {
    title: Option<String>,
    author: Option<String>,
    language: Option<String>,
    manifest: HashMap<String, (String, String)>,
    spine: Vec<String>,
}

#[derive(Clone, Copy, PartialEq)]
enum MetaField {
    Title,
    Creator,
    Language,
}

pub fn parse_epub(bytes: &[u8]) -> CoreResult<EpubContent> {
    parse_epub_with_progress(bytes, &mut |_| {})
}

pub fn parse_epub_with_progress(
    bytes: &[u8],
    progress: &mut dyn FnMut(super::ImportProgress),
) -> CoreResult<EpubContent> {
    let cursor = Cursor::new(bytes);
    let mut archive = ZipArchive::new(cursor).map_err(|err| CoreError::Archive(err.to_string()))?;

    if archive.len() > MAX_EPUB_ENTRIES {
        return Err(CoreError::ImportFailed(
            "EPUB archive contains too many entries".into(),
        ));
    }

    let mut total: u64 = 0;
    let mut entries: Vec<EntryMeta> = Vec::with_capacity(archive.len());
    for name in archive.file_names() {
        let normalized = name.replace('\\', "/");
        validate_entry_name(&normalized)?;
        entries.push(EntryMeta {
            original: name.to_string(),
            normalized: normalized.to_ascii_lowercase(),
            size: 0,
        });
    }
    for (index, entry) in entries.iter_mut().enumerate() {
        let file = archive
            .by_index(index)
            .map_err(|err| CoreError::Archive(err.to_string()))?;
        entry.size = file.size();
        total = total.saturating_add(file.size());
    }
    if total > MAX_TOTAL_UNCOMPRESSED_BYTES {
        return Err(CoreError::ImportFailed(
            "EPUB decompressed size exceeds the allowed budget".into(),
        ));
    }

    let container_name = find_entry(&entries, "meta-inf/container.xml")
        .ok_or_else(|| CoreError::UnsupportedFormat("EPUB is missing container.xml".into()))?
        .original
        .clone();
    let container_bytes = read_entry(&mut archive, &container_name)?;
    let container_xml = decode_text(&container_bytes);
    let opf_path = find_rootfile(&container_xml)?;

    let opf_name = find_entry(&entries, &opf_path.to_ascii_lowercase())
        .ok_or_else(|| CoreError::UnsupportedFormat("EPUB package document not found".into()))?
        .original
        .clone();
    let opf_bytes = read_entry(&mut archive, &opf_name)?;
    let opf_xml = decode_text(&opf_bytes);
    let opf = parse_opf(&opf_xml)?;

    let base_dir = parent_dir(&opf_path);
    let mut order = opf.spine.clone();
    if order.is_empty() {
        order = opf
            .manifest
            .iter()
            .filter(|(_, (_href, media))| is_content_media(media))
            .map(|(id, _)| id.clone())
            .collect();
    }

    let mut chapters: Vec<ImportedChapter> = Vec::new();
    for (index, idref) in order.iter().enumerate() {
        progress(super::ImportProgress::new(
            "chapters",
            10 + ((index * 65) / order.len().max(1)) as u8,
            index,
            order.len(),
        ));
        let Some((href, _media)) = opf.manifest.get(idref) else {
            continue;
        };
        let resolved = match resolve_href(&base_dir, href) {
            Some(path) => path,
            None => continue,
        };
        let Some(entry) = find_entry(&entries, &resolved.to_ascii_lowercase()) else {
            continue;
        };
        let data = read_entry(&mut archive, &entry.original)?;
        let html = decode_text(&data);
        let doc = extract_document(&html);
        // Headings become the chapter title; if a document is heading-only,
        // fall back to using the heading text as the body so no text is lost.
        let body_source = if doc.paragraphs.is_empty() && !doc.headings.is_empty() {
            doc.headings.clone()
        } else {
            doc.paragraphs.clone()
        };
        let paragraphs: Vec<String> = body_source
            .into_iter()
            .map(|p| clamp_paragraph(&p))
            .filter(|p| !p.is_empty())
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
        let title = doc
            .headings
            .first()
            .cloned()
            .filter(|t| !t.trim().is_empty())
            .or_else(|| {
                doc.title
                    .clone()
                    .filter(|t| !t.trim().is_empty() && Some(t) != opf.title.as_ref())
            })
            .unwrap_or_else(|| format!("Chapter {}", chapters.len() + 1));
        chapters.push(ImportedChapter {
            title,
            word_count,
            paragraphs,
        });
        if chapters.len() > MAX_CHAPTERS {
            return Err(CoreError::ImportFailed(
                "EPUB exceeds the maximum chapter count".into(),
            ));
        }
    }

    if chapters.is_empty() {
        return Err(CoreError::ImportFailed(
            "EPUB contains no readable text content".into(),
        ));
    }

    progress(super::ImportProgress::new(
        "chapters",
        75,
        order.len(),
        order.len(),
    ));
    Ok(EpubContent {
        title: opf.title,
        author: opf.author,
        language: opf.language,
        chapters,
    })
}

fn clamp_paragraph(paragraph: &str) -> String {
    if scalar_len(paragraph) > MAX_PARAGRAPH_CHARS as i64 {
        truncate_scalar(paragraph, MAX_PARAGRAPH_CHARS as i64)
    } else {
        paragraph.to_string()
    }
}

fn is_content_media(media: &str) -> bool {
    matches!(
        media,
        "application/xhtml+xml" | "text/html" | "application/x-dtbook+xml"
    )
}

fn decode_text(bytes: &[u8]) -> String {
    String::from_utf8_lossy(bytes).to_string()
}

fn validate_entry_name(normalized: &str) -> CoreResult<()> {
    if normalized.starts_with('/') || normalized.contains("..") || normalized.contains(':') {
        return Err(CoreError::ImportFailed(
            "EPUB contains an unsafe archive path".into(),
        ));
    }
    Ok(())
}

fn find_entry<'a>(entries: &'a [EntryMeta], normalized_lower: &str) -> Option<&'a EntryMeta> {
    entries.iter().find(|e| e.normalized == normalized_lower)
}

fn read_entry<R: Read + std::io::Seek>(
    archive: &mut ZipArchive<R>,
    name: &str,
) -> CoreResult<Vec<u8>> {
    let mut file = archive
        .by_name(name)
        .map_err(|err| CoreError::Archive(err.to_string()))?;
    if file.size() > MAX_ENTRY_UNCOMPRESSED_BYTES {
        return Err(CoreError::ImportFailed(
            "EPUB entry is larger than the allowed limit".into(),
        ));
    }
    let mut buffer = Vec::new();
    let mut limited = file.by_ref().take(MAX_ENTRY_UNCOMPRESSED_BYTES + 1);
    limited.read_to_end(&mut buffer)?;
    if buffer.len() as u64 > MAX_ENTRY_UNCOMPRESSED_BYTES {
        return Err(CoreError::ImportFailed(
            "EPUB entry expanded beyond the allowed limit".into(),
        ));
    }
    Ok(buffer)
}

fn parent_dir(path: &str) -> String {
    match path.rfind('/') {
        Some(index) => path[..index].to_string(),
        None => String::new(),
    }
}

/// Resolves an EPUB href against the OPF directory, rejecting traversal.
fn resolve_href(base_dir: &str, href: &str) -> Option<String> {
    let cleaned = href.split(['#', '?']).next().unwrap_or("");
    let decoded = percent_decode(cleaned);
    let combined = if base_dir.is_empty() {
        decoded
    } else {
        format!("{base_dir}/{decoded}")
    };
    normalize_path(&combined)
}

fn percent_decode(input: &str) -> String {
    let bytes = input.as_bytes();
    let mut out: Vec<u8> = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            let hex = std::str::from_utf8(&bytes[i + 1..i + 3]).unwrap_or("");
            if let Ok(value) = u8::from_str_radix(hex, 16) {
                out.push(value);
                i += 3;
                continue;
            }
        }
        out.push(bytes[i]);
        i += 1;
    }
    String::from_utf8_lossy(&out).to_string()
}

fn normalize_path(path: &str) -> Option<String> {
    let mut stack: Vec<&str> = Vec::new();
    for segment in path.split('/') {
        match segment {
            "" | "." => continue,
            ".." => {
                stack.pop()?;
            }
            other => stack.push(other),
        }
    }
    if stack.is_empty() {
        None
    } else {
        Some(stack.join("/"))
    }
}

fn local_name(element: &BytesStart<'_>) -> String {
    element.name().local_name().as_ref().to_ascii_lowercase()
}

fn attr_value(attr: &quick_xml::events::attributes::Attribute<'_>) -> CoreResult<(String, String)> {
    let key = attr.key.local_name().as_ref().to_ascii_lowercase();
    let value = attr
        .normalized_value(XmlVersion::Implicit1_0)
        .map_err(|err| CoreError::Xml(err.to_string()))?
        .to_string();
    Ok((key, value))
}

fn find_rootfile(xml: &str) -> CoreResult<String> {
    let mut reader = Reader::from_str(xml);
    reader.config_mut().trim_text(true);
    loop {
        match reader.read_event() {
            Ok(Event::Start(element)) | Ok(Event::Empty(element)) => {
                if local_name(&element) == "rootfile" {
                    for attr in element.attributes() {
                        let attr = attr.map_err(|err| CoreError::Xml(err.to_string()))?;
                        let (key, value) = attr_value(&attr)?;
                        if key == "full-path" {
                            return Ok(value);
                        }
                    }
                }
            }
            Ok(Event::Eof) => break,
            Err(err) => return Err(CoreError::Xml(err.to_string())),
            _ => {}
        }
    }
    Err(CoreError::UnsupportedFormat(
        "EPUB container is missing a rootfile reference".into(),
    ))
}

fn parse_opf(xml: &str) -> CoreResult<OpfData> {
    let mut reader = Reader::from_str(xml);
    reader.config_mut().trim_text(true);
    let mut data = OpfData::default();
    let mut capture: Option<MetaField> = None;
    let mut buffer = String::new();

    loop {
        match reader.read_event() {
            Ok(Event::Start(element)) | Ok(Event::Empty(element)) => {
                let name = local_name(&element);
                match name.as_str() {
                    "item" => {
                        let mut id = None;
                        let mut href = None;
                        let mut media = None;
                        for attr in element.attributes() {
                            let attr = attr.map_err(|err| CoreError::Xml(err.to_string()))?;
                            let (key, value) = attr_value(&attr)?;
                            match key.as_str() {
                                "id" => id = Some(value),
                                "href" => href = Some(value),
                                "media-type" => media = Some(value),
                                _ => {}
                            }
                        }
                        if let (Some(id), Some(href)) = (id, href) {
                            data.manifest.insert(id, (href, media.unwrap_or_default()));
                        }
                    }
                    "itemref" => {
                        for attr in element.attributes() {
                            let attr = attr.map_err(|err| CoreError::Xml(err.to_string()))?;
                            let (key, value) = attr_value(&attr)?;
                            if key == "idref" {
                                data.spine.push(value);
                            }
                        }
                    }
                    "title" => {
                        capture = Some(MetaField::Title);
                        buffer.clear();
                    }
                    "creator" => {
                        capture = Some(MetaField::Creator);
                        buffer.clear();
                    }
                    "language" => {
                        capture = Some(MetaField::Language);
                        buffer.clear();
                    }
                    _ => {}
                }
            }
            Ok(Event::Text(text)) => {
                if capture.is_some() {
                    buffer.push_str(text.xml10_content().as_ref());
                }
            }
            Ok(Event::End(element)) => {
                let name = element.name().local_name().as_ref().to_ascii_lowercase();
                let matches = matches!(
                    (capture, name.as_str()),
                    (Some(MetaField::Title), "title")
                        | (Some(MetaField::Creator), "creator")
                        | (Some(MetaField::Language), "language")
                );
                if matches {
                    let value = buffer.trim().to_string();
                    if !value.is_empty() {
                        match capture {
                            Some(MetaField::Title) => data.title = Some(value),
                            Some(MetaField::Creator) => {
                                if data.author.is_none() {
                                    data.author = Some(value);
                                }
                            }
                            Some(MetaField::Language) => data.language = Some(value),
                            None => {}
                        }
                    }
                    buffer.clear();
                    capture = None;
                }
            }
            Ok(Event::Eof) => break,
            Err(err) => return Err(CoreError::Xml(err.to_string())),
            _ => {}
        }
    }

    if data.manifest.is_empty() {
        return Err(CoreError::UnsupportedFormat(
            "EPUB package document has no manifest".into(),
        ));
    }
    Ok(data)
}
