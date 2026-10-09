use chrono::{SecondsFormat, Utc};
use sha2::{Digest, Sha256};

/// Current UTC time as ISO-8601 with millisecond precision, e.g.
/// `2026-10-09T12:34:56.789Z`.
pub fn now_iso() -> String {
    Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true)
}

/// Fresh UUID v4 as a lowercase hyphenated string.
pub fn new_id() -> String {
    uuid::Uuid::new_v4().to_string()
}

/// Lowercase hex SHA-256 of arbitrary bytes.
pub fn sha256_hex(bytes: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(bytes);
    let digest = hasher.finalize();
    let mut out = String::with_capacity(digest.len() * 2);
    for byte in digest {
        out.push_str(&format!("{byte:02x}"));
    }
    out
}

/// Lowercase file extension of a path-like string, without the dot.
pub fn extension_lower(file_name: &str) -> Option<String> {
    std::path::Path::new(file_name)
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_ascii_lowercase())
}

/// Basename of a path-like string, falling back to the original value.
pub fn basename(file_name: &str) -> String {
    std::path::Path::new(file_name)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or(file_name)
        .to_string()
}
