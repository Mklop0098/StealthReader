# ADR 0003 — Large-chapter rendering and virtualization

- Status: Accepted
- Date: 2026-10-09
- Related: FR-07, FR-08, accessibility ("must not trap keyboard focus"), AT-04

## Context

Chapters can contain thousands of paragraphs. Rendering them all as DOM nodes
would make the Excel skin unusable and violate the requirement that the grid
"must not trap keyboard focus in thousands of fake cells". The anchor model is
paragraph-based, so scrolling cost must not scale with an O(n) scan per frame.

## Decision

- **Excel skin:** virtualize rows with `@tanstack/react-virtual`, measuring rows
  because content wraps to variable heights. Only the visible window is mounted,
  so focus order stays short.
- **Plain-text and terminal skins:** render paragraphs directly (they are cheap
  block elements) but track the anchor with an `IntersectionObserver`
  (`components/reader-core/anchors.ts`) rather than scanning every paragraph on
  scroll. Cost is O(visible), not O(total).
- The anchor is always `{paragraphId, charOffset, viewportFraction}`; visual row
  or line numbers are never used as identity.

## Rationale

- IntersectionObserver is the cheapest correct way to know "which paragraph is on
  screen" without measuring the whole document.
- Virtualizing the grid keeps the DOM small, which is what protects keyboard
  navigation and screen-reader traversal.

## Consequences

- The Excel skin must render its own row header and column header outside the
  virtual list, and the active row is highlighted from the canonical anchor
  rather than from a "current cell" pointer.
- Anchor restore scrolls by paragraph offset (`offsetTop`), falling back to
  `viewportFraction` when the paragraph is not currently mounted.

## Alternatives considered

- Rendering everything and using `content-visibility: auto`: simpler, but does
  not reduce DOM node count, so keyboard/screen-reader traversal is still O(n).
- Paginating chapters into pages: changes the reading model and complicates the
  canonical anchor; rejected for MVP.
