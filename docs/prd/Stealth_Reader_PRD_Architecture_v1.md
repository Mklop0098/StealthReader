# Stealth Reader — PRD & Technical Architecture v1.0

> Status: Implementation-ready specification | Target: Windows 10/11 x64 | MVP: VS Code, Excel, Terminal skins

## 1. Vision and scope
Stealth Reader is an offline-first desktop novel reader presented through work-inspired skins. It prioritizes rapid switching to a neutral workspace, privacy on screen, reliable reading progress, and accessible reading controls. It does **not** promise invisibility to operating-system monitoring, endpoint management, screenshots, or administrators.

### Goals
- Import local UTF-8 TXT and DRM-free EPUB; read and resume without Internet.
- Three skins driven by a single reader state model: VS Code-inspired, Excel-inspired, Terminal-inspired.
- A configurable Quick Switch to a neutral, non-book workspace; remove novel content from visible UI and window title.
- Never lose reading progress when changing skins, navigating chapters, or using Quick Switch.
- Default to local-only storage with no analytics or network calls.

### Non-goals
- Actual integration with VS Code/Excel/Terminal; exact trademark/brand replication.
- DRM removal, cloud sync, AI summaries, PDF/OCR, plugin marketplace, evasion of enterprise monitoring.
- Guaranteed global shortcut interception in all privilege levels and desktop states.

### Personas and jobs
- Developer: prefers editor layout, line numbers, tabs, file explorer.
- Office user: prefers grid, sheet tabs, formula bar, table navigation.
- Minimalist: prefers terminal/log appearance and keyboard reading.

### Success metrics (testable targets, not guarantees)
- Cold start to library interactive <= 3 seconds on reference Windows 11 device (SSD, 8 GB RAM).
- Skin switch <= 200 ms p95 on reference device with a loaded chapter.
- Quick Switch removes all novel text from the visible app within 150 ms p95 after shortcut dispatch.
- Reopen returns to same chapter and anchor for 100% of normal close/restart tests.
- Import a 5 MB UTF-8 TXT or 10 MB DRM-free EPUB <= 5 seconds on reference device.
- 0 unhandled exceptions in 1-hour automated navigation soak test.

## 2. Core requirements and acceptance
| ID | Requirement | Priority | Acceptance |
|---|---|---|---|
| FR-01 | Import UTF-8 TXT | P0 | Select TXT; parse paragraphs; create library entry; show errors for invalid encoding |
| FR-02 | Import DRM-free EPUB | P0 | Read container and spine order; strip unsafe active content; preserve text/paragraphs |
| FR-03 | Library CRUD | P0 | List/search/open/delete; delete asks whether original imported copy should be removed |
| FR-04 | Read chapters | P0 | Next/previous chapter, scroll, font size, line spacing, width |
| FR-05 | Resume | P0 | Restores book, chapter, paragraph anchor and intra-paragraph offset |
| FR-06 | VS Code skin | P0 | Explorer, tabs, status bar, editor pane; no actual executable code |
| FR-07 | Excel skin | P0 | Grid, columns, row numbers, sheets; long text wraps and remains navigable |
| FR-08 | Terminal skin | P0 | Log-like lines, prompt and scrolling; optional typewriter animation off by default |
| FR-09 | Quick Switch | P0 | Hotkey opens neutral view without text, cover, book name or spoiler in window title |
| FR-10 | Restore reading | P0 | Explicit hotkey/button returns to prior reading location without resetting scroll |
| FR-11 | Bookmarks | P0 | Create/remove/list bookmarks; jump to anchor |
| FR-12 | Local privacy | P0 | No telemetry; no network permissions; clear recent-book display option |
| FR-13 | Search within book | P1 | Query highlights matching passages, jumps to results |
| FR-14 | Custom keybindings | P1 | Conflict validation and fallback to in-app shortcut |
| FR-15 | Backup/export | P1 | Export/import user progress and settings, with versioned schema |

## 3. UX and navigation
### Information architecture
- First launch: welcome -> import book -> choose skin -> reader.
- Library: book cards/list, search, import, settings, resume.
- Reader: skin chrome, text surface, chapter navigation, command palette, bookmark.
- Neutral Workspace: innocuous placeholder dataset/code/logs; no book content or metadata.
- Settings: skins, fonts, hotkeys, privacy, backup, data management.

### UX flow A: first-time import
1. User launches app; sees empty library and Import CTA.
2. Native file picker selects TXT or EPUB.
3. Backend validates extension, file signature/container, size and parsing constraints.
4. Import creates normalized book/chapter/paragraph data in one SQLite transaction.
5. User sees book preview and chooses a skin; reader opens chapter 1.
6. Progress saves after stable scroll and on navigation/close.

### UX flow B: reading and skin switch
1. ReaderController holds canonical `{bookId, chapterId, paragraphId, offset, viewportFraction}`.
2. User switches skin; app captures anchor before unmounting old skin.
3. New skin maps canonical anchor to its own row/line/paragraph rendering.
4. Reader resumes at same text anchor; font/layout changes do not rewrite canonical progress.

### UX flow C: Quick Switch
1. Registered shortcut (default Ctrl+Alt+Shift+Q, user-configurable) is received.
2. Synchronously change app state to `neutral`; immediately unmount book-rendering surface and clear displayed book title.
3. Render preloaded neutral workspace; do not wait for DB writes or network.
4. Persist prior reading anchor asynchronously; errors never block neutral view.
5. Explicit restore action re-enters previous skin and anchor.
6. If OS registration fails, show a visible warning and provide an in-app fallback.

### UX flow D: app close/reopen
1. On navigation and debounced scroll (500–1000 ms), enqueue progress persistence.
2. Flush progress on window-close event with bounded timeout; do not rely only on unload.
3. On startup, load last session and validate referenced book/chapter/anchor.
4. If references are missing, fall back to nearest valid chapter and explain.

### Accessibility
- Keyboard-only navigation for library and reader; visible focus rings.
- Screen-reader accessible text content separate from decorative chrome.
- Respect reduced-motion; typewriter animation opt-in.
- Zoom 80–200%; sufficient contrast in all skins.
- Excel layout must not trap keyboard focus in thousands of fake cells.

## 4. Technical architecture
### Stack
- Tauri 2 desktop shell and Rust backend.
- React 19 + TypeScript + Vite frontend.
- Zustand for ephemeral UI state; TanStack Query optional for IPC-backed data caching.
- SQLite via Rust `rusqlite` or `sqlx` (choose one; use migrations).
- `epub` parsing library with explicit validation; `quick-xml`/ZIP as needed.
- Vitest + React Testing Library; Rust unit/integration tests; Playwright/Tauri-compatible desktop E2E tooling.

### Modules
| Module | Owns | Does not own |
|---|---|---|
| LibraryManager | Book listing, deletion, metadata | Text layout |
| ImportPipeline | Validate, parse, normalize, commit | UI skin |
| ReadingEngine | Chapters, paragraphs, anchors, navigation | Skin chrome |
| SkinRegistry | Register/load skin manifests | Database access |
| StealthController | Neutral/reading state, Quick Switch | Parsing |
| SessionManager | Resume, bookmarks, progress flush | Raw filesystem |
| SearchService | Search index and result anchors | Book editing |
| SettingsService | Preferences, hotkeys | Novel content |
| WindowManager | Window title, tray, shortcuts | Reading logic |
| Repository | SQLite transactions, migrations | React state |

### Directory layout
```text
stealth-reader/
  apps/desktop/
    src/
      app/{router,providers,store}/
      features/{library,reader,settings,stealth}/
      skins/{vscode,excel,terminal}/
      components/{ui,reader-core}/
      contracts/{ipc,models}/
      styles/
    src-tauri/
      src/{commands,domain,import,repository,services,window}/
      migrations/
      capabilities/
      tauri.conf.json
  packages/
    skin-sdk/
    shared-types/
  tests/{fixtures,e2e,performance}/
  docs/{prd,architecture,adr,testing}/
```

### Trust boundaries
- React skins receive sanitized text DTOs only; no arbitrary HTML from books.
- Rust validates paths, size limits, ZIP entry count, uncompressed bytes and traversal paths.
- EPUB HTML parsed as content, never rendered via `dangerouslySetInnerHTML` or executed as scripts.
- No external resources loaded from EPUB; embedded images disabled in MVP or processed to safe local assets.
- Tauri capabilities scoped to exact commands; CSP blocks remote origins.
- Logs must not include book text, full filenames or sensitive paths by default.

## 5. Data model and SQLite schema
All IDs are UUID strings. Times use UTC ISO-8601. Foreign keys and WAL are enabled. Schema versioned through migrations.

```sql
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

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

CREATE TABLE reading_progress (
  book_id TEXT PRIMARY KEY REFERENCES books(id) ON DELETE CASCADE,
  chapter_id TEXT NOT NULL REFERENCES chapters(id),
  paragraph_id TEXT REFERENCES paragraphs(id),
  char_offset INTEGER NOT NULL DEFAULT 0 CHECK(char_offset >= 0),
  viewport_fraction REAL NOT NULL DEFAULT 0 CHECK(viewport_fraction BETWEEN 0 AND 1),
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
```

**Consistency rules:** importing a book, chapters and paragraphs occurs inside a single transaction; parsing happens outside the transaction into bounded temporary structures, then inserts in batches within the transaction. Deleting a book cascades chapters, paragraphs, progress and bookmarks. Before saving progress, validate that chapter and paragraph belong to the selected book. For stronger enforcement use repository transaction validation or SQLite triggers; cross-table ownership is not guaranteed by the FKs above alone.

**Text anchor semantics:** `char_offset` counts Unicode scalar values, not UTF-16 code units; implement explicit conversion in React when using DOM selection. `viewport_fraction` is advisory only; paragraph ID and offset are canonical. Preserve stable paragraph IDs across skin switches; imports are immutable in MVP.

**Import file policy:** original imported files can be copied into app data under content-addressed filenames; parsed normalized content lives in SQLite. If file copy fails, abort import and clean staging. Use atomic rename for staged original; reconcile orphan staging files at startup. DB and filesystem are not one atomic transaction, so use an import journal/status and recovery sweep if retaining originals.

## 6. IPC contract
```typescript
export type SkinId = 'vscode' | 'excel' | 'terminal';
export interface ReaderAnchor {
  bookId: string;
  chapterId: string;
  paragraphId: string | null;
  charOffset: number;
  viewportFraction: number;
}
export interface ChapterDto {
  id: string;
  bookId: string;
  ordinal: number;
  title: string;
  paragraphs: Array<{id: string; ordinal: number; content: string}>;
}
export interface AppError {
  code: 'INVALID_INPUT'|'UNSUPPORTED_FORMAT'|'IMPORT_FAILED'|'NOT_FOUND'|'DB_ERROR'|'SHORTCUT_UNAVAILABLE';
  message: string;
  recoverable: boolean;
}
export interface ReaderSkin {
  id: SkinId;
  displayName: string;
  ReaderView: React.ComponentType<{
    chapter: ChapterDto;
    anchor: ReaderAnchor;
    onAnchorChange: (anchor: ReaderAnchor) => void;
  }>;
  NeutralView: React.ComponentType;
}
```

Rust Tauri commands (names are conceptual; generate typed bindings):
- `import_book(path): Promise<BookSummary>`
- `list_books(query?, page, page_size): Promise<PaginatedBooks>`
- `get_book(book_id): Promise<BookDetails>`
- `get_chapter(chapter_id): Promise<ChapterDto>`
- `delete_book(book_id): Promise<void>`
- `save_progress(anchor): Promise<void>`
- `get_progress(book_id): Promise<ReaderAnchor | null>`
- `create_bookmark(anchor, note?): Promise<Bookmark>`
- `list_bookmarks(book_id): Promise<Bookmark[]>`
- `delete_bookmark(bookmark_id): Promise<void>`
- `get_settings(): Promise<AppSettings>`
- `update_settings(patch): Promise<AppSettings>`
- `register_quick_switch(shortcut): Promise<ShortcutRegistrationResult>`

Commands validate arguments and return structured errors. Frontend must not pass arbitrary SQL, executable scripts, or unchecked filesystem destinations. `import_book` accepts only paths returned by native file picker or backend-validated accessible paths.

## 7. Skin-specific behavior
### VS Code-inspired
- Sidebar Explorer: book as project, chapters as files; selected chapter in active tab.
- Editor: monospaced font, optional line numbers, wrapping, gutter, status bar.
- Default presentation as plain-text document or comment-like text; do not insert content into executable code.
- Reader anchor maps to paragraph and char offset, not visual line number.
- Neutral view uses static example code without novel text.

### Excel-inspired
- Book as workbook; chapters as sheets; paragraphs as rows; columns `#`, `Content`, `Status`.
- Virtualized rows for large chapters; wrapped content, variable row height.
- Keyboard PageUp/PageDown, arrows and search do not cause focus trap.
- Neutral view shows static synthetic work-like table, never book text.
- Anchor maps to paragraph row and offset; never use row number as canonical identity.

### Terminal-inspired
- Dark/light terminal themes; chapter displayed as log-like text, with optional timestamps in decorative gutter.
- Monospace wrapping, keyboard navigation, scrollback and command palette.
- Typewriter mode optional and instantly disabled by Quick Switch.
- Neutral view displays static benign terminal output, no real shell execution.

## 8. State machines
```text
App: BOOTING -> LIBRARY -> READING <-> NEUTRAL
                    |           |
                    +-> SETTINGS +-> ERROR_RECOVERABLE

Import: SELECTED -> VALIDATING -> PARSING -> STAGING -> COMMITTING -> COMPLETE
                     |            |          |             |
                     +-----------> FAILED <---+-------------+
```

### Quick Switch invariants
- `NEUTRAL` never renders book content, cover, title, author, recent-book labels, or sensitive accessibility labels.
- Switching to `NEUTRAL` never destroys canonical reader anchor.
- UI transition is independent of storage latency; progress write is queued.
- Switching back requires explicit user action.
- App title, taskbar preview and notification text must use neutral naming when neutral mode is active. OS thumbnail caching is not fully controllable; document this limitation.
- Global hotkey is best effort; app must report registration failure and offer in-app fallback.

## 9. Security, privacy and reliability
- No accounts, telemetry, crash uploads or remote fonts in MVP.
- Sanitize EPUB XML/HTML; reject malformed ZIP bombs and traversal; cap total decompressed bytes and chapter size.
- Never execute terminal commands or scripts from imported text.
- Parameterized SQL, migrations with backup strategy, foreign keys enabled per connection.
- Atomic SQLite transactions for multi-table updates; WAL and busy timeout.
- Debounced progress saves plus navigation/close flush; handle abrupt crash via last committed anchor.
- Prevent race conditions: serialize writes per book, include monotonic sequence in frontend updates or backend revision to reject stale progress updates.
- Provide clear deletion confirmation and optional delete-original-copy action.
- Validate app install/update signatures and publish hashes for release artifacts.
- Avoid copying proprietary product assets or implying official Microsoft affiliation.

## 10. Delivery phases and backlog
### Phase 0 — Foundation (2–3 days)
- P0-01 Create monorepo, Tauri 2 + React + TS project, lint/format/test scripts.
- P0-02 Configure Tauri capabilities, CSP, local-only permissions.
- P0-03 Add typed IPC/error envelope and Rust migration runner.
- P0-04 Configure CI Windows build, unit tests and installer artifact.
**Exit:** fresh checkout builds and launches; migrations run; CI green.

### Phase 1 — Import & Library (4–6 days)
- P1-01 Implement schema and repositories.
- P1-02 TXT parser with encoding validation and paragraph normalization.
- P1-03 EPUB parser with spine ordering and active-content stripping.
- P1-04 Import coordinator with bounded processing and transaction.
- P1-05 Library list/search/delete UI and import errors.
**Exit:** fixture books import; invalid EPUB rejected; atomic DB rollback tested.

### Phase 2 — Reading Core (4–5 days)
- P2-01 Chapter DTO, navigation and reader anchor model.
- P2-02 Progress persistence with stale-write protection.
- P2-03 Bookmark CRUD and resume.
- P2-04 Font/spacing/width controls and keyboard navigation.
- P2-05 Large-chapter rendering strategy and performance tests.
**Exit:** repeated reopen/skin-independent anchor tests pass.

### Phase 3 — Three Skins (6–8 days)
- P3-01 Skin SDK and registry.
- P3-02 VS Code-inspired reader and neutral workspace.
- P3-03 Excel-inspired virtualized grid and neutral workbook.
- P3-04 Terminal-inspired log reader and neutral output.
- P3-05 Cross-skin anchor mapping and visual QA.
**Exit:** each skin navigates same fixture; switching retains semantic position.

### Phase 4 — Stealth & Window Integration (3–5 days)
- P4-01 Quick Switch state machine and preloaded neutral view.
- P4-02 Global shortcut registration and fallback.
- P4-03 Neutral window title, taskbar/tray behavior.
- P4-04 Race tests: switch during import, scrolling, progress save.
- P4-05 Accessibility and no-leak tests.
**Exit:** no book text or metadata visible in neutral DOM or accessible labels; shortcut latency measured.

### Phase 5 — Hardening & Release (4–6 days)
- P5-01 End-to-end tests on Windows 10/11.
- P5-02 EPUB fuzz/ZIP bomb tests, invalid paths and DB recovery.
- P5-03 Installer, uninstall, local data retention policy.
- P5-04 Crash recovery, performance and keyboard accessibility.
- P5-05 Release notes, user guide, limitations and privacy notice.
**Exit:** all MVP acceptance tests pass and signed installer prepared (if certificate available).

Total initial estimate: ~23–33 working days for one experienced developer, excluding extended polish and certificate procurement.

## 11. Acceptance test catalog
| Test ID | Given | When | Then |
|---|---|---|---|
| AT-01 | Empty library | Import valid UTF-8 TXT | Book and chapters appear in correct order |
| AT-02 | Empty library | Import valid DRM-free EPUB | Spine order and paragraph text preserved |
| AT-03 | Invalid EPUB ZIP | Import | Recoverable error; no partial book records |
| AT-04 | Large chapter | Scroll to paragraph 5000 | UI remains responsive and correct anchor is stored |
| AT-05 | Reading paragraph 37 | Switch VS Code -> Excel -> Terminal | Same paragraph/offset restored |
| AT-06 | Reading with title visible | Trigger Quick Switch | Neutral view and title show no novel metadata |
| AT-07 | Quick Switch active | Explicit restore | Previous skin, chapter and anchor restored |
| AT-08 | Progress saved | Force-close and relaunch | Last committed anchor restored |
| AT-09 | Two rapid progress writes | Older write completes later | Latest revision wins |
| AT-10 | Bookmark created | Relaunch and open bookmark | Correct paragraph restored |
| AT-11 | Book with scripts/remote assets | Import EPUB | Scripts never execute; remote assets not fetched |
| AT-12 | Hotkey unavailable | Register shortcut | Warning displayed and in-app fallback works |
| AT-13 | Book deleted | Inspect DB | Related chapters, paragraphs, bookmarks and progress gone |
| AT-14 | Neutral mode | Inspect DOM/accessibility tree | No novel text, book title, cover alt text or author |
| AT-15 | No network connection | Import/read/resume | All MVP functions work offline |
| AT-16 | Screen reader / keyboard only | Navigate all core flows | Actions reachable and focus visible |

## 12. AI coding agent execution contract
1. Read this document and create `docs/implementation-status.md` tracking each backlog ID and test ID.
2. Implement phases sequentially; do not begin next phase until exit criteria pass.
3. Before code, document decisions in ADRs for parser library, SQLite access, and virtualization.
4. Use strict TypeScript, no `any` in public interfaces; validate IPC DTOs at boundaries.
5. Keep domain logic independent from skins and React components.
6. Each feature must include unit tests, at least one integration test, and updated acceptance mapping.
7. For every phase report: changed files, commands run, test results, known gaps, screenshots for UI, risks.
8. Never claim completion based only on compiling; run relevant tests.
9. Never add telemetry, cloud dependency, executable imported content or elevated OS privileges without explicit approval.
10. If requirements conflict, record ambiguity and propose smallest reversible decision; do not silently change scope.

### Definition of Done
- Feature meets written acceptance tests.
- Unit/integration/E2E tests relevant to feature pass on Windows CI.
- No unresolved critical/high security issues.
- Keyboard and accessibility checks pass for affected views.
- No book content leaks into neutral view in automated checks.
- Documentation and implementation status updated.

## 13. Risks and mitigations
| Risk | Mitigation |
|---|---|
| OS shortcut conflicts | Detect failure; allow customization and in-app switch |
| Different layout positions across skins | Canonical paragraph+character anchor |
| Huge EPUB / malformed ZIP | Decompression quotas, size caps, streaming parse |
| React unmount before progress save | Capture anchor synchronously, async serialized save |
| Sensitive text in taskbar previews | Neutral title and UI; disclose OS caching limits |
| Database/filesystem partial import | Staging journal and startup reconciliation |
| Exact branded UI IP concerns | Inspired design, original assets, clear non-affiliation |
| Global hotkey fails under elevated apps | Best-effort guarantee only, documented fallback |

## 14. Open implementation decisions
- Choose and benchmark an EPUB parser; document maximum supported input size.
- Define exact neutral dataset for each skin and ensure it contains no book-derived data.
- Confirm whether source originals are retained by default; recommended: yes with user-managed deletion.
- Determine whether first release supports only x64 or also ARM64; MVP target x64.
- Select installer/update mechanism; auto-update is out of MVP scope unless explicitly approved.
