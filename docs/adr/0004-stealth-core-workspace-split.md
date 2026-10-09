# ADR 0004 — `stealth-core` crate separate from the Tauri shell

- Status: Accepted
- Date: 2026-10-09
- Related: PRD section 4 (modules), section 12 item 5 ("keep domain logic
  independent from skins and React components"), item 8 ("never claim completion
  based only on compiling; run relevant tests")

## Context

The PRD's directory layout puts `domain`, `import`, `repository`, `services`,
`commands` and `window` inside `apps/desktop/src-tauri`. That is workable, but
it couples every domain test to a full Tauri compile (wry/tao/webview2 — several
hundred crates), which makes the "run the relevant tests for every change"
contract expensive and fragile.

## Decision

Add a Cargo workspace with two members:

- `crates/stealth-core` — domain models, text/HTML extraction, the import
  pipeline, the SQLite repository, and services. **No Tauri dependency.**
- `apps/desktop/src-tauri` — the Tauri shell: `commands`, `state`, `importer`
  (file staging/journal), `shortcuts`, and the window title command.

The PRD module names are preserved inside `stealth-core`
(`domain`, `import`, `repository`, `service`).

## Rationale

- `cargo test -p stealth-core` compiles in seconds and covers all business rules,
  parsing and persistence (27 tests today).
- The domain cannot accidentally depend on the UI or the webview, which is the
  PRD's explicit architectural intent.
- Future shells (CLI, another runtime) can reuse the core unchanged.

## Consequences

- The single-crate layout from the PRD is intentionally deviated from; the module
  names and responsibilities are unchanged.
- Cross-cutting types (`ImportedBook`, `ReaderAnchor`, DTOs) live in
  `stealth-core::domain` and are serialized with `camelCase` so the same shapes
  reach TypeScript.
- `apps/desktop/src-tauri/src/error.rs` maps `CoreError` onto the IPC `AppError`
  envelope, keeping the boundary conversion in one place.

## Alternatives considered

- Keep one crate (PRD layout verbatim): rejected — slow, UI-coupled tests.
- Put the core in a separate *repository*: rejected — overkill for one product.
