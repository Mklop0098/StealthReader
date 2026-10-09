# ADR 0002 — SQLite access layer

- Status: Accepted
- Date: 2026-10-09
- Related: PRD section 5, section 9, FR-03, FR-05, AT-08, AT-09, AT-13

## Context

The PRD requires one of `rusqlite` or `sqlx`, migrations, foreign keys enabled
per connection, WAL, a busy timeout, atomic transactions for multi-table writes,
and protection against stale progress writes.

## Decision

Use **`rusqlite` with the `bundled` feature**.

- A single `Repository` owns one `Connection`.
- The Tauri shell wraps it in a `Mutex<Repository>`, so all writes are serialized
  in-process.
- Migrations are plain `.sql` files applied in order and tracked with
  `PRAGMA user_version` (see `repository::mod::MIGRATIONS`).
- `foreign_keys = ON` and `busy_timeout = 5s` are set on every connection; WAL is
  requested and tolerated as unavailable for in-memory databases.

## Rationale

- `bundled` compiles SQLite into the binary: no system dependency, identical
  behaviour on every Windows machine, and no need to ship a DLL.
- The app is single-process and low-write-throughput; a synchronous driver with a
  mutex is simpler and easier to reason about than an async pool, and it makes
  the "serialize writes" requirement trivially true.
- Plain SQL files keep the schema reviewable against the PRD.

## Consequences

- Long-running reads block writers. Acceptable for MVP: chapter payloads are
  bounded and imports are the only long operation (parsing happens before the
  transaction, per PRD section 5).
- Foreign keys alone do not prove cross-table ownership, so the repository
  validates chapter/paragraph ownership before progress and bookmark writes
  (`books::chapter_belongs_to_book`, `books::paragraph_belongs_to_chapter`).

## Alternatives considered

- `sqlx` with an async pool: adds async plumbing, compile-time query macros and a
  runtime we do not otherwise need; rejected.
- `r2d2` connection pool: unnecessary while a single mutex-guarded connection
  already satisfies the write serialization requirement.
