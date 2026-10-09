# Test fixtures

Fixture books used by Rust and UI tests.

EPUB fixtures are built **in memory** by the tests (`crates/stealth-core/tests/epub_import.rs`)
so no binary is committed and the shape stays reviewable. TXT fixtures are inline
strings for the same reason.

When real-world regression material is added:

- Keep files small (< 200 KB) and licence-clean (public domain only).
- Name them `<format>-<purpose>.<ext>`, e.g. `epub-script-and-remote-assets.epub`.
- Record the expected paragraph count and chapter titles next to the file.
- Never commit DRM-protected content.

`generated/` is git-ignored and reserved for locally produced scratch fixtures.
