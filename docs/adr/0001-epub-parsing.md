# ADR 0001 — EPUB parsing approach

- Status: Accepted
- Date: 2026-10-09
- Related: FR-02, FR-15 (security), section 4 trust boundaries, AT-02, AT-03, AT-11

## Context

We must import DRM-free EPUB files, preserve spine order and paragraph text, and
never execute or fetch active content. The PRD allows either a dedicated EPUB
crate or `quick-xml` plus a ZIP reader, and requires explicit validation of ZIP
entries, sizes and traversal paths.

## Decision

Parse EPUB ourselves on top of the `zip` crate (deflate only) and `quick-xml`:

- `container.xml` and the OPF package document are parsed as XML with
  `quick-xml` (`events` API, local names only, no DTD/entity expansion).
- XHTML content documents are converted to plain text by our own tolerant
  extractor (`domain::html::extract_document`) rather than being handed to a DOM
  or HTML renderer.

## Rationale

- We never need layout fidelity — only ordered plain text. A dedicated EPUB
  renderer/library would add surface area and dependencies for no benefit.
- Doing the extraction ourselves makes the "active content is never executed"
  guarantee structural: there is no code path that turns book markup into HTML
  reaching the webview.
- All limits (`import::limits`) are enforced at the boundary, independent of a
  third-party library's defaults.

## Consequences

- We own the heuristics for chapter titles (first `<h1>`–`<h6>`, else `<title>`
  if it differs from the book title, else `Chapter N`).
- Tolerance for malformed XHTML is our responsibility; the extractor is
  intentionally forgiving and never fails on unclosed tags.
- Maximum supported input size is enforced by `MAX_FILE_BYTES` (64 MiB) and
  `MAX_TOTAL_UNCOMPRESSED_BYTES` (512 MiB), documented in `import/limits.rs`.

## Alternatives considered

- `epub` crate: convenient, but pulls in its own HTML/XML stack and gives less
  control over the security-relevant limits; rejected for MVP.
- `scraper`/`html5ever`: robust HTML parsing, but a large dependency and it
  models markup we deliberately do not render; rejected.
