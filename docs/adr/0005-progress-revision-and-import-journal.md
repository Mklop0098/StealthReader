# ADR 0005 — Progress revision counter and import journal

- Status: Accepted
- Date: 2026-10-09
- Related: PRD section 5 (schema), section 9 (race conditions), section 5 (import
  file policy), AT-09, AT-13

## Context

Two PRD requirements are not satisfiable with the literal schema alone:

1. "Two rapid progress writes; older write completes later; latest revision wins"
   (AT-09). Debouncing in the frontend reduces but does not eliminate out-of-order
   completion, so the database needs a way to reject an older write.
2. Retaining a managed copy of the original file is a filesystem write, and "DB
   and filesystem are not one atomic transaction, so use an import journal/status
   and recovery sweep" (section 5).

## Decision

**Progress revision.** Add `reading_progress.revision INTEGER NOT NULL DEFAULT 0`.
The frontend attaches a monotonically increasing sequence to each write
(`save_progress(anchor, seq)`). The upsert is guarded:

```sql
ON CONFLICT(book_id) DO UPDATE SET ... WHERE excluded.revision > reading_progress.revision
```

A write whose `seq` is not greater than the stored revision is reported as
`Stale { revision }` and changes nothing.

**Import journal.** Add an `import_jobs` table. Import copies the source into a
staging file, records a `committing` job, commits the book, then atomically
renames the staging file to `originals/<sha256>.<ext>` and marks the job
`complete`. On startup, `importer::recover` deletes staging files for any
non-complete job, marks it `failed`, and sweeps the staging directory.

## Rationale

- A single monotonic counter is the smallest mechanism that makes AT-09
  deterministic without distributed coordination.
- The journal plus a startup sweep makes a crash between "file written" and
  "book committed" recoverable and leaves no orphaned bytes.

## Consequences

- The schema deviates from the PRD by one column and one table (both additive).
- The frontend must keep `progressSeq` monotonic for the lifetime of a session;
  it does (`store.progressSeq`).
- Deleting a book can optionally remove the retained original; the path is
  derived from `books.source_sha256` and `format`, so no absolute path needs to
  be stored or logged.

## Alternatives considered

- Server-assigned timestamps only: insufficient — two writes can be committed in
  the opposite order of their logical intent.
- Storing the original path in the database: rejected — it leaks a sensitive
  filesystem path from the user's machine; the content-addressed copy is enough.
