# Stealth Reader — Architecture Overview

> Companion to `docs/prd/Stealth_Reader_PRD_Architecture_v1.md`. Where this
> document and the PRD disagree, the ADRs in `docs/adr/` explain why.

## 1. Shape of the system

```
┌──────────────────────────────────────────────────────────────────────┐
│ apps/desktop (React 19 + TypeScript + Vite)                          │
│                                                                      │
│  app/            store (zustand), App shell, key handling            │
│  features/       library, reader, settings                           │
│  skins/          vscode, excel, terminal  → registered in registry   │
│  components/     ui primitives, reader-core (anchor tracking)        │
│  contracts/      typed IPC client + DTO validators                   │
└───────────────▲──────────────────────────────────────────────────────┘
                │ Tauri IPC: IpcResult<T> envelope, camelCase DTOs
┌───────────────┴──────────────────────────────────────────────────────┐
│ apps/desktop/src-tauri (Tauri 2 shell)                               │
│  commands/       thin: lock state, call core, map errors             │
│  importer        staging + journal + startup recovery                │
│  shortcuts       global shortcut registration with fallback          │
│  window          neutral/reading window title                        │
└───────────────▲──────────────────────────────────────────────────────┘
                │ plain Rust function calls
┌───────────────┴──────────────────────────────────────────────────────┐
│ crates/stealth-core (no Tauri dependency)                            │
│  domain/         models (wire DTOs), text + HTML extraction          │
│  import/         limits, txt parser, epub parser, pipeline           │
│  repository/     rusqlite: migrations, books, progress, bookmarks,   │
│                  settings, sessions, search, import journal          │
│  service/        settings sanitation, resume resolution              │
└──────────────────────────────────────────────────────────────────────┘
```

## 2. Reading position: the canonical anchor

`ReaderAnchor = { bookId, chapterId, paragraphId | null, charOffset,
viewportFraction }`.

- `paragraphId` + `charOffset` (Unicode scalar values) are **canonical**.
- `viewportFraction` is advisory and only used when the anchored paragraph is not
  currently mounted.
- Skins report anchors through `onAnchorChange`; the store debounces writes
  (800 ms) and flushes on navigation, chapter change and Quick Switch.
- The database keeps a `revision` counter so a late-arriving older write cannot
  overwrite a newer one (ADR-0005).

Because the anchor is semantic, switching skins cannot change the reading
position: each skin maps the same anchor into its own layout.

## 3. Stealth model

State machine: `BOOTING → LIBRARY → READING ⇄ NEUTRAL`, with `SETTINGS` reachable
from library/reading.

Quick Switch invariants, as implemented:

1. `quickSwitch()` performs a **synchronous** `set({ mode: 'neutral' })` before
   any I/O, then fires the window-title update and progress flush without
   awaiting them.
2. The App shell renders only `skin.NeutralView` (+ a neutral banner and the
   restore control) while neutral, so no book text, title, author or cover can be
   in the DOM. This is asserted by tests (`App.test.tsx`, `skins.test.tsx`).
3. The canonical anchor is untouched, so restore is lossless.
4. Restore requires an explicit action (button or the restore accelerator).
5. Global shortcuts are best effort: `register_shortcuts` reports per-accelerator
   success/failure and the UI shows a warning while the in-app key handler
   (`matchesAccelerator`) keeps both actions reachable.

Known limitation (documented, not solved): the OS may cache a thumbnail of the
reading window; we cannot fully control that.

## 4. Trust boundaries

- The webview receives **plain text only**. EPUB XHTML is converted to text by
  `stealth-core`; there is no `dangerouslySetInnerHTML` anywhere and the CSP
  allows no remote origins (`default-src 'self'`, `connect-src ipc:`).
- Import paths come from the native picker (frontend `plugin-dialog`) and are
  re-validated in Rust (extension, size, ZIP entry count, declared and actual
  uncompressed size, traversal-style names).
- SQL is always parameterized; no SQL string is built from user input.
- Logs and error messages contain codes and structural descriptions, never book
  text or absolute source paths.

## 5. Data flow for an import

1. Frontend picks a file, calls `import_book(path)`.
2. Shell parses the file **outside** any transaction
   (`stealth_core::import::parse_file`), which validates size and extension.
3. Shell copies the source into `staging/` and records an `import_jobs` row.
4. `insert_imported_book` writes book + chapters + paragraphs in one transaction.
5. Staging file is renamed to `originals/<sha256>.<ext>`; the job is marked
   `complete`. On startup, incomplete jobs are swept (`importer::recover`).

## 6. Module ownership

| Module | Owns | Does not own |
|---|---|---|
| `stealth-core::domain` | Models, text/HTML normalisation | Storage, UI |
| `stealth-core::import` | Validation, parsing, quotas | Transactions, UI |
| `stealth-core::repository` | SQL, migrations, ownership validation | React state |
| `stealth-core::service` | Resume + settings rules | Rendering |
| `src-tauri::commands` | Argument validation, state locking, error mapping | Business rules |
| `src-tauri::importer` | Staging, journal, recovery | Parsing rules |
| `src-tauri::shortcuts` | Registration, fallback reporting | Reading logic |
| `app/src/skins` | Presentation only | Data access |
