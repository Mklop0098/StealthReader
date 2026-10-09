# Desktop E2E tests (backlog)

Not implemented yet. Planned tooling: `tauri-driver` (WebDriver) with Playwright,
running on Windows CI.

Coverage to add, mapped to the acceptance catalog:

| Test | Acceptance |
|---|---|
| Launch app, import a TXT fixture through the native picker, open chapter 1 | AT-01, AT-15 |
| Import an EPUB fixture, verify spine order in the reader | AT-02 |
| Import a deliberately broken ZIP, assert the recoverable error banner | AT-03 |
| Open a 5,000-paragraph chapter, scroll to paragraph 5000, assert responsiveness and stored anchor | AT-04 |
| Walk VS Code → Excel → Terminal, assert the same paragraph/offset is restored | AT-05 |
| Trigger the real global shortcut, assert neutral DOM and window title | AT-06 |
| Restore from neutral with the restore accelerator | AT-07 |
| Force-close and relaunch, assert the last committed anchor | AT-08 |
| Create a bookmark, relaunch, jump to it | AT-10 |
| Run the app with networking disabled | AT-15 |
| Keyboard-only pass with a screen reader over library → reader → neutral | AT-16 |

Notes:

- Global shortcut assertions must account for OS registration failure: the test
  should accept either a working accelerator or the documented fallback.
- Window-title assertions read the OS title, not the DOM `<title>`.
