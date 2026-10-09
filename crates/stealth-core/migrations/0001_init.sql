-- Stealth Reader schema v1.
-- All ids are UUID strings, all timestamps are UTC ISO-8601.
-- Foreign keys and WAL are enabled per connection in repository::db.

CREATE TABLE books (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  author TEXT,
  format TEXT NOT NULL CHECK(format IN ('txt','epub')),
  source_name TEXT NOT NULL,
  source_sha256 TEXT NOT NULL,
  language TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_books_title ON books(title);
CREATE INDEX idx_books_hash ON books(source_sha256);

CREATE TABLE chapters (
  id TEXT PRIMARY KEY,
  book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  ordinal INTEGER NOT NULL CHECK(ordinal >= 0),
  title TEXT NOT NULL,
  word_count INTEGER NOT NULL DEFAULT 0,
  UNIQUE(book_id, ordinal)
);

CREATE TABLE paragraphs (
  id TEXT PRIMARY KEY,
  chapter_id TEXT NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  ordinal INTEGER NOT NULL CHECK(ordinal >= 0),
  content TEXT NOT NULL,
  UNIQUE(chapter_id, ordinal)
);
CREATE INDEX idx_paragraphs_chapter ON paragraphs(chapter_id, ordinal);

-- `revision` is a monotonic counter used to reject stale progress writes
-- (PRD section 9, race condition mitigation; acceptance test AT-09).
CREATE TABLE reading_progress (
  book_id TEXT PRIMARY KEY REFERENCES books(id) ON DELETE CASCADE,
  chapter_id TEXT NOT NULL REFERENCES chapters(id),
  paragraph_id TEXT REFERENCES paragraphs(id),
  char_offset INTEGER NOT NULL DEFAULT 0 CHECK(char_offset >= 0),
  viewport_fraction REAL NOT NULL DEFAULT 0 CHECK(viewport_fraction BETWEEN 0 AND 1),
  revision INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

CREATE TABLE bookmarks (
  id TEXT PRIMARY KEY,
  book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  chapter_id TEXT NOT NULL REFERENCES chapters(id),
  paragraph_id TEXT REFERENCES paragraphs(id),
  char_offset INTEGER NOT NULL DEFAULT 0,
  note TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_bookmarks_book ON bookmarks(book_id, created_at);

CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE recent_sessions (
  id TEXT PRIMARY KEY,
  book_id TEXT REFERENCES books(id) ON DELETE SET NULL,
  skin_id TEXT NOT NULL,
  started_at TEXT NOT NULL,
  ended_at TEXT
);

-- Import journal. Records a managed, content-addressed staged copy so a
-- crash between file copy and DB commit can be reconciled at startup.
CREATE TABLE import_jobs (
  id TEXT PRIMARY KEY,
  source_name TEXT NOT NULL,
  stage_path TEXT,
  status TEXT NOT NULL CHECK(status IN ('staging','committing','complete','failed')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_import_jobs_status ON import_jobs(status);
