use rusqlite::params;

use crate::domain::models::SearchHit;
use crate::domain::text::snippet_around;
use crate::error::CoreResult;

use super::Repository;

const SNIPPET_RADIUS: i64 = 60;

/// Case-insensitive search that returns the exact scalar offset of the first
/// match within each paragraph, so results can be turned into anchors.
fn find_ci_scalar_offset(haystack: &str, needle: &str) -> Option<i64> {
    let hay: Vec<char> = haystack.chars().collect();
    let pin: Vec<char> = needle.chars().collect();
    if pin.is_empty() || hay.len() < pin.len() {
        return None;
    }
    for start in 0..=(hay.len() - pin.len()) {
        let mut all = true;
        for (k, needle_char) in pin.iter().enumerate() {
            let hay_lower: String = hay[start + k].to_lowercase().collect();
            let pin_lower: String = needle_char.to_lowercase().collect();
            if hay_lower != pin_lower {
                all = false;
                break;
            }
        }
        if all {
            return Some(start as i64);
        }
    }
    None
}

fn escape_like(input: &str) -> String {
    input
        .replace('\\', "\\\\")
        .replace('%', "\\%")
        .replace('_', "\\_")
}

impl Repository {
    pub fn search_book(
        &self,
        book_id: &str,
        query: &str,
        limit: i64,
    ) -> CoreResult<Vec<SearchHit>> {
        let trimmed = query.trim();
        if trimmed.is_empty() {
            return Ok(Vec::new());
        }
        let limit = limit.clamp(1, 200);
        let pattern = format!("%{}%", escape_like(&trimmed.to_lowercase()));

        let mut stmt = self.conn.prepare(
            "SELECT c.id, c.ordinal, c.title, p.id, p.ordinal, p.content \
             FROM paragraphs p \
             JOIN chapters c ON c.id = p.chapter_id \
             WHERE c.book_id = ?1 AND LOWER(p.content) LIKE ?2 ESCAPE '\\' \
             ORDER BY c.ordinal ASC, p.ordinal ASC \
             LIMIT ?3",
        )?;

        let rows = stmt.query_map(params![book_id, pattern, limit], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, i64>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, i64>(4)?,
                row.get::<_, String>(5)?,
            ))
        })?;

        let mut hits = Vec::new();
        for row in rows {
            let (
                chapter_id,
                chapter_ordinal,
                chapter_title,
                paragraph_id,
                paragraph_ordinal,
                content,
            ) = row?;
            let char_offset = find_ci_scalar_offset(&content, trimmed).unwrap_or(0);
            hits.push(SearchHit {
                chapter_id,
                chapter_ordinal,
                chapter_title,
                paragraph_id,
                paragraph_ordinal,
                char_offset,
                snippet: snippet_around(&content, char_offset, SNIPPET_RADIUS),
            });
        }
        Ok(hits)
    }
}
