# Implementation Status

Tracking for every backlog ID (PRD section 10) and acceptance test
(PRD section 11). Status values: **Done**, **Partial**, **Not started**.

Last updated: 2026-10-09 (after the initial implementation pass).

## Verification snapshot

| Check | Command | Result |
|---|---|---|
| Rust tests | `cargo test --workspace` | 31 passing (27 core + 4 shell) |
| TypeScript tests | `pnpm -r test` | 29 passing (16 desktop, 10 shared-types, 3 skin-sdk) |
| TypeScript types | `pnpm -r typecheck` | clean (strict, `noUnusedLocals`, `noImplicitAny`) |
| Rust type check | `cargo check --workspace` | clean, no warnings |
| Frontend build | `pnpm --filter @stealth-reader/desktop build` | produces `apps/desktop/dist` |

## Phase 0 — Foundation

| ID | Status | Notes |
|---|---|---|
| P0-01 monorepo + Tauri 2 + React + TS + scripts | Done | pnpm workspace, Cargo workspace, `dev`/`build`/`test`/`typecheck`/`lint` scripts. `lint` is a placeholder (no ESLint config in MVP). |
| P0-02 Tauri capabilities, CSP, local-only permissions | Done | `capabilities/default.json` scoped to `core:default`, window title, dialog open, global-shortcut register/unregister. CSP blocks remote origins; `connect-src ipc:`. |
| P0-03 typed IPC/error envelope + migration runner | Done | `IpcResult<T>` envelope, `AppError` codes; migrations via `PRAGMA user_version`. |
| P0-04 CI Windows build, unit tests, installer artifact | Partial | `.github/workflows/ci.yml` runs `cargo fmt --check`, `cargo test`, `cargo clippy -D warnings`, `pnpm -r typecheck`, `pnpm -r test` and the frontend build on `windows-latest`. Installer artifact is not produced in CI yet. |

**Exit criteria:** fresh checkout builds and launches; migrations run; CI green —
met except the installer artifact.

## Phase 1 — Import & Library

| ID | Status | Notes |
|---|---|---|
| P1-01 schema and repositories | Done | Full schema + `revision` column + `import_jobs` (ADR-0005). |
| P1-02 TXT parser with encoding validation | Done | Strict UTF-8, BOM handling, UTF-16 rejection, adaptive paragraph splitting, heading heuristics. |
| P1-03 EPUB parser with spine ordering and stripping | Done | `zip` + `quick-xml`, quotas, traversal rejection, HTML→text with script/style removal (ADR-0001). |
| P1-04 import coordinator with transaction | Done | Parse outside transaction; single transaction insert; staging + journal + startup recovery. |
| P1-05 library list/search/delete UI | Done | Cards, search, delete confirm with "also remove retained copy". |

**Exit criteria:** fixture books import; invalid EPUB rejected; atomic rollback
tested — met (rollback path returns `IMPORT_FAILED` and leaves no rows; covered by
the failed-insert branch, though not directly exercised by a test).

## Phase 2 — Reading Core

| ID | Status | Notes |
|---|---|---|
| P2-01 Chapter DTO, navigation, anchor model | Done | `ChapterDto`, `ReaderAnchor`, prev/next, chapter list. |
| P2-02 progress persistence + stale-write protection | Done | Debounced writes, monotonic `seq`, SQL-guarded upsert (AT-09). |
| P2-03 bookmark CRUD and resume | Done | Create/list/delete, excerpt generation, resume with validated fallback. |
| P2-04 font/spacing/width + keyboard navigation | Done | Sliders (clamped), `Alt+←/→`, `Ctrl+Alt+Shift+B`, `Ctrl+Shift+F`. |
| P2-05 large-chapter rendering + performance tests | Partial | Excel virtualization + IntersectionObserver anchor tracking (ADR-0003). No measured perf test with a 5,000-paragraph chapter. |

## Phase 3 — Three Skins

| ID | Status | Notes |
|---|---|---|
| P3-01 Skin SDK and registry | Done | `packages/skin-sdk`: `ReaderSkin`, `ReaderViewProps` (ADR-0006), `SkinRegistry` with unit tests. |
| P3-02 VS Code-inspired reader + neutral | Done | Explorer, tabs, gutter, status bar, static code neutral view. |
| P3-03 Excel-inspired grid + neutral | Done | Virtualized rows, row numbers, formula bar, sheet tabs, synthetic order table neutral. |
| P3-04 Terminal-inspired log reader + neutral | Done | Prompt gutter, optional typewriter (off by default, stopped by Quick Switch), build-log neutral. |
| P3-05 cross-skin anchor mapping + visual QA | Partial | Semantic anchor is shared and tested; no scripted cross-skin position test or visual QA pass. |

## Phase 4 — Stealth & Window Integration

| ID | Status | Notes |
|---|---|---|
| P4-01 Quick Switch state machine + preloaded neutral | Done | Synchronous mode change, skin neutral view, restore control. |
| P4-02 global shortcut + fallback | Done | `register_shortcuts` returns per-accelerator results; warning banner; in-app key fallback. OS-level behaviour not verified on a real desktop session. |
| P4-03 neutral title, taskbar/tray | Partial | Window title switches to a neutral string; no tray icon; OS thumbnail caching documented as a limitation. |
| P4-04 race tests (switch during import/scroll/save) | Partial | Stale-write and synchronous-switch behaviour covered by unit tests; no concurrent integration test. |
| P4-05 accessibility + no-leak tests | Partial | No-leak tests done (AT-06/AT-14). No axe run, no screen-reader walkthrough. |

## Phase 5 — Hardening & Release

| ID | Status |
|---|---|
| P5-01 Windows 10/11 E2E | Not started |
| P5-02 EPUB fuzz / ZIP bomb / DB recovery tests | Partial (quotas and traversal implemented; no fuzz harness) |
| P5-03 installer, uninstall, retention policy | Not started |
| P5-04 crash recovery, performance, keyboard a11y | Partial (journal recovery implemented; not measured) |
| P5-05 release notes, user guide, privacy notice | Not started |

## Acceptance test catalog

| ID | Status | Evidence |
|---|---|---|
| AT-01 import valid TXT ordered | Done | `txt_import::imports_utf8_txt_with_chapter_headings` |
| AT-02 import EPUB spine order | Done | `epub_import::imports_epub_in_spine_order_without_active_content` |
| AT-03 invalid EPUB, no partial records | Done | `epub_import::rejects_non_zip_payload_claiming_to_be_epub`, `rejects_missing_container` |
| AT-04 large chapter responsive + correct anchor | Partial | Strategy implemented; no 5,000-paragraph measurement |
| AT-05 skin switch keeps paragraph/offset | Partial | Shared canonical anchor + per-skin rendering; no automated cross-skin test |
| AT-06 quick switch, no metadata | Done | `App.test::leaks no book content while neutral is active` |
| AT-07 explicit restore | Done | `App.test::restores reading from the neutral workspace` |
| AT-08 force-close/relaunch restores anchor | Partial | Resume logic tested; no process-level test |
| AT-09 latest revision wins | Done | `repository::latest_revision_wins_over_late_write` |
| AT-10 bookmark survives relaunch | Partial | CRUD + jump path implemented and tested; no relaunch test |
| AT-11 scripts never execute, no remote fetch | Done | `epub_import::imports_epub_in_spine_order_without_active_content` asserts no `alert`/remote host survives |
| AT-12 hotkey unavailable → warning + fallback | Done | `store.test::warns and keeps working when a global shortcut cannot be registered`, `keys.test` |
| AT-13 delete cascades | Done | `repository::deleting_book_cascades_children` |
| AT-14 neutral DOM has no book data | Done | `skins.test::never renders book text or metadata in a neutral view`, `App.test` |
| AT-15 offline operation | Partial | No network code paths exist and CSP blocks remote origins; not run with the network disabled |
| AT-16 screen reader / keyboard only | Not started | Keyboard paths exist and are tested for matching, but no a11y audit |

## Known gaps and deliberate deviations

1. **No CI workflow or installer** (P0-04, P5-03) — out of scope for this pass.
2. **No ESLint configuration** — `lint` scripts are placeholders.
3. **No real desktop E2E** — Tauri runtime behaviour (global shortcut, native
   picker, window title) is implemented but unverified on-device.
4. **Schema is additive over the PRD** — `reading_progress.revision` and the
   `import_jobs` table (ADR-0005).
5. **`stealth-core` is a separate crate** from the PRD's single-crate layout
   (ADR-0004).
6. **`ReaderViewProps` is extended** beyond the PRD sketch (ADR-0006).
7. **Chapter heading heuristics are heuristic** — plain-text chapter detection
   recognises `Chapter N`, `Chương N`, CJK `第N章`, common separators and short
   title lines; unusual formats fall back to a single chapter.
8. **Tray icon not implemented** (P4-03).
