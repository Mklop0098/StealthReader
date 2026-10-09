# Stealth Reader

Offline-first desktop novel reader presented through work-inspired skins
(editor, spreadsheet, terminal), with a Quick Switch that clears the screen to a
neutral workspace.

- Specification: `docs/prd/Stealth_Reader_PRD_Architecture_v1.md`
- Architecture: `docs/architecture/overview.md`
- Decisions: `docs/adr/`
- What is done vs. pending: `docs/implementation-status.md`
- Testing: `docs/testing/strategy.md`

> Stealth Reader is not affiliated with Microsoft or any product whose look it
> takes inspiration from. It does **not** hide activity from operating-system
> monitoring, screenshots, endpoint management or administrators, and it makes no
> such promise.

## Stack

| Layer | Technology |
|---|---|
| Desktop shell | Tauri 2 (Rust) |
| Frontend | React 19 + TypeScript + Vite |
| UI state | Zustand |
| Storage | SQLite via `rusqlite` (bundled), migrations tracked by `user_version` |
| Parsing | `zip` + `quick-xml` + a purpose-built HTML→text extractor |
| Tests | `cargo test`, Vitest + Testing Library |

## Layout

```
apps/desktop/            React app (src/) + Tauri shell (src-tauri/)
crates/stealth-core/     Domain, import pipeline, repository, services (no Tauri)
packages/shared-types/   IPC contract + runtime DTO validators
packages/skin-sdk/       Skin contract + registry
docs/                    prd, architecture, adr, testing, implementation-status
tests/                   fixtures, e2e, performance (backlog)
```

## Getting started

Prerequisites: Node 20+, pnpm, Rust (stable) with the MSVC toolchain, and the
WebView2 runtime (bundled with Windows 10/11).

```bash
pnpm install                # install workspace dependencies
pnpm rust:test              # cargo test --workspace
pnpm -r test                # all TS/UI tests
pnpm -r typecheck           # strict TypeScript
pnpm tauri dev              # run the desktop app (starts Vite via beforeDevCommand)
```

Useful scripts:

| Command | Purpose |
|---|---|
| `pnpm dev` | Vite dev server only (browser shell, no IPC) |
| `pnpm build` | Type-check + build the frontend into `apps/desktop/dist` |
| `pnpm rust:clippy` | Clippy with `-D warnings` |
| `pnpm rust:fmt` | `cargo fmt --all` |
| `pnpm tauri build` | Produce the NSIS installer |

## Data and privacy

- Default window title is neutral (`Analytics Console`).
- The library, database, retained originals and staging area live in the Tauri
  app-data directory (`%APPDATA%/app.stealthreader.desktop`), never in the repo.
- No telemetry, accounts, cloud sync or remote fonts. The CSP blocks remote
  origins and the only allowed connection scheme is Tauri IPC.

## Quick Switch

Default accelerators (configurable in Settings):

- `Ctrl+Alt+Shift+Q` — neutral workspace
- `Ctrl+Alt+Shift+W` — restore reading

If the OS refuses a global registration, the app shows a warning and the same
keys still work while the window is focused.
