# ADR 0006 — Skin contract extension

- Status: Accepted
- Date: 2026-10-09
- Related: PRD section 6 (`ReaderSkin`), section 7 (skin-specific behaviour),
  FR-06/FR-07/FR-08

## Context

The PRD's `ReaderSkin.ReaderView` receives exactly `{chapter, anchor,
onAnchorChange}`. That is enough to render text, but not enough for the skin
behaviour the PRD itself specifies: the editor skin needs a chapter list
("book as project, chapters as files"), the spreadsheet skin needs sheet tabs
("chapters as sheets"), and the terminal skin needs a chapter switcher. All three
need the active font settings to honour the typography controls.

Passing those from outside the skin would either duplicate skin chrome in the app
shell or force the shell to know about skin-specific layout.

## Decision

Extend `ReaderViewProps` additively:

```ts
interface ReaderViewProps {
  chapter: ChapterDto;
  anchor: ReaderAnchor;
  onAnchorChange: (anchor: ReaderAnchor) => void;
  book: { id: string; title: string };   // for skin chrome only
  chapters: ChapterSummary[];            // sidebar / sheet tabs
  onSelectChapter: (chapterId: string) => void;
  onStepChapter: (direction: 1 | -1) => void;
  settings: AppSettings;                 // typography / line numbers / typewriter
}
```

The original three props keep their exact meaning and the skin remains a pure
presentational consumer: it still receives sanitized text DTOs only and never
touches the database.

## Rationale

- Keeps skin chrome inside the skin, which is the whole point of the skin model.
- Avoids a second "navigation" API: chapter selection flows through the same
  `ReaderController` action (`openChapter`) regardless of which skin is active.
- `onAnchorChange` remains the single source of reading-position truth.

## Consequences

- The neutral views are unchanged: they still receive only `elapsedMs`, so a
  neutral view cannot accidentally depend on book data.
- `packages/skin-sdk` is the single place these props are defined, so all skins
  and future skins share one contract.

## Alternatives considered

- Context provider for book/chapters: hides data flow and makes skins harder to
  test in isolation; rejected.
- Duplicating navigation chrome in the app shell: makes the app shell
  skin-aware, defeating the registry; rejected.
