# Stealth Reader — Testing Strategy

## Layers

| Layer | Tool | Location | What it proves |
|---|---|---|---|
| Rust unit/integration | `cargo test` | `crates/stealth-core/tests/*`, `src-tauri/src/error.rs` | Parsing, anchors, quotas, SQL semantics, migrations, resume, IPC error mapping |
| TS unit | `vitest` | `packages/shared-types/src/*.test.ts`, `packages/skin-sdk/src/*.test.ts` | Boundary validation, envelope unwrapping, skin registry |
| UI component | `vitest` + Testing Library (jsdom) | `apps/desktop/src/**/*.test.tsx` | Store behaviour, neutral-mode leak checks, key matching |
| Desktop E2E | Playwright / tauri-driver | `tests/e2e` (backlog) | Real window, real IPC, real shortcuts |
| Performance | manual + scripted soak | `tests/performance` (backlog) | Cold start, skin switch, quick-switch latency, 1-hour soak |

## Commands

```bash
cargo test --workspace                     # all Rust tests
pnpm -r test                               # all TS/UI tests
pnpm -r typecheck                          # strict TS, no emit
cargo clippy --workspace --all-targets -- -D warnings
```

> `NODE_ENV=test` is forced for the desktop test script (`cross-env`). Some
> environments export `NODE_ENV=production`, which makes React resolve to its
> production build where `react.act` does not exist and Testing Library fails.

## What is asserted today

Rust (`crates/stealth-core/tests`):

- `domain.rs` — scalar-offset arithmetic, paragraph splitting (blank-line vs
  line layout), heading heuristics (including the `Chapter two text here.` false
  positive), entity decoding, script/style stripping.
- `txt_import.rs` — chapter splitting, UTF-8 BOM tolerance, invalid UTF-8 and
  UTF-16 rejection, unsupported extension, empty input.
- `epub_import.rs` — spine order, metadata, active-content stripping, traversal
  rejection, non-ZIP payload rejection.
- `repository.rs` — import/list/get, search offsets, stale-write rejection
  (AT-09), cross-book ownership rejection, bookmark round-trip, cascade delete
  (AT-13), resume fallback, settings clamping/persistence, idempotent migrations.

UI (`apps/desktop/src`):

- `App.test.tsx` — library render, **neutral leak check** (AT-06/AT-14), restore
  from neutral (AT-07).
- `skins.test.tsx` — each skin renders book text and chapter lists; each neutral
  view renders neither book text nor metadata.
- `store.test.ts` — bootstrap, shortcut-failure warning (AT-12), synchronous
  quick switch preserving the anchor, restore, monotonic progress sequence.
- `keys.test.ts` — accelerator matching and conflict detection.

## Not covered yet (tracked in `implementation-status.md`)

- Real-Tauri E2E on Windows (launch, picker, global shortcut).
- Accessibility automation (axe) and screen-reader walkthrough (AT-16).
- Large-book soak and 5 MB / 10 MB import timing (section 1 success metrics).
- Installer/upgrade/signature tests (Phase 5).
