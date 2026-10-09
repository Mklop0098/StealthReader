# Performance tests (backlog)

Not implemented yet. These map to the success metrics in PRD section 1.

Reference device: Windows 11, SSD, 8 GB RAM.

| Metric | Target | How to measure |
|---|---|---|
| Cold start → interactive library | ≤ 3 s | Time from process start to first paint of the library |
| Skin switch (loaded chapter) | ≤ 200 ms p95 | Instrument `setSkin` → next paint, repeat 50× |
| Quick Switch removes book text | ≤ 150 ms p95 | Time from accelerator dispatch to neutral DOM, 50× |
| Reopen restores chapter + anchor | 100% | Scripted close/reopen loop over the fixture set |
| Import 5 MB TXT / 10 MB EPUB | ≤ 5 s | `stealth_core::import::parse_file` timing + commit |
| Navigation soak | 0 unhandled exceptions in 1 h | Automated navigation loop with progress assertions |

Useful hooks already in place:

- `stealth_core::import::parse_file` is pure and can be benchmarked with `criterion`.
- The 5,000-paragraph chapter can be generated deterministically and used for
  both AT-04 and the skin-switch measurement.
