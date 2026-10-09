//! Bounded processing limits. Every import is subject to these caps so a
//! malformed or hostile file (zip bomb, giant document) fails fast instead of
//! exhausting memory (PRD section 9).

/// Maximum raw input file size accepted for import.
pub const MAX_FILE_BYTES: u64 = 64 * 1024 * 1024; // 64 MiB
/// Maximum number of entries inside an EPUB archive.
pub const MAX_EPUB_ENTRIES: usize = 4_096;
/// Maximum total uncompressed bytes across all archive entries.
pub const MAX_TOTAL_UNCOMPRESSED_BYTES: u64 = 512 * 1024 * 1024; // 512 MiB
/// Maximum uncompressed size of a single archive entry.
pub const MAX_ENTRY_UNCOMPRESSED_BYTES: u64 = 32 * 1024 * 1024; // 32 MiB
/// Maximum number of chapters a single book may produce.
pub const MAX_CHAPTERS: usize = 10_000;
/// Maximum number of paragraphs in a single chapter.
pub const MAX_PARAGRAPHS_PER_CHAPTER: usize = 20_000;
/// Maximum scalar length of a single paragraph.
pub const MAX_PARAGRAPH_CHARS: usize = 200_000;
