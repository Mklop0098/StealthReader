use std::fmt;

/// Error type for all core (non-Tauri) operations. The Tauri command layer maps
/// these onto the `AppError` envelope defined in the IPC contract.
#[derive(Debug, thiserror::Error)]
pub enum CoreError {
    #[error("invalid input: {0}")]
    InvalidInput(String),
    #[error("unsupported format: {0}")]
    UnsupportedFormat(String),
    #[error("import failed: {0}")]
    ImportFailed(String),
    #[error("not found: {0}")]
    NotFound(String),
    #[error("database error: {0}")]
    Database(#[from] rusqlite::Error),
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
    #[error("archive error: {0}")]
    Archive(String),
    #[error("xml error: {0}")]
    Xml(String),
}

/// Stable string codes shared with the frontend `ErrorCode` union.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ErrorCode {
    InvalidInput,
    UnsupportedFormat,
    ImportFailed,
    NotFound,
    DbError,
    ShortcutUnavailable,
}

impl ErrorCode {
    pub fn as_str(self) -> &'static str {
        match self {
            ErrorCode::InvalidInput => "INVALID_INPUT",
            ErrorCode::UnsupportedFormat => "UNSUPPORTED_FORMAT",
            ErrorCode::ImportFailed => "IMPORT_FAILED",
            ErrorCode::NotFound => "NOT_FOUND",
            ErrorCode::DbError => "DB_ERROR",
            ErrorCode::ShortcutUnavailable => "SHORTCUT_UNAVAILABLE",
        }
    }
}

impl fmt::Display for ErrorCode {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.as_str())
    }
}

impl CoreError {
    pub fn code(&self) -> ErrorCode {
        match self {
            CoreError::InvalidInput(_) => ErrorCode::InvalidInput,
            CoreError::UnsupportedFormat(_) => ErrorCode::UnsupportedFormat,
            CoreError::ImportFailed(_) => ErrorCode::ImportFailed,
            CoreError::NotFound(_) => ErrorCode::NotFound,
            CoreError::Database(_) => ErrorCode::DbError,
            CoreError::Io(_) => ErrorCode::ImportFailed,
            CoreError::Archive(_) => ErrorCode::UnsupportedFormat,
            CoreError::Xml(_) => ErrorCode::UnsupportedFormat,
        }
    }

    /// Whether the caller can recover by retrying or choosing a different input.
    pub fn recoverable(&self) -> bool {
        match self {
            CoreError::Database(_) => false,
            CoreError::InvalidInput(_) => true,
            CoreError::UnsupportedFormat(_) => true,
            CoreError::ImportFailed(_) => true,
            CoreError::NotFound(_) => true,
            CoreError::Io(_) => true,
            CoreError::Archive(_) => true,
            CoreError::Xml(_) => true,
        }
    }

    pub fn invalid(msg: impl Into<String>) -> Self {
        CoreError::InvalidInput(msg.into())
    }
}

pub type CoreResult<T> = Result<T, CoreError>;
