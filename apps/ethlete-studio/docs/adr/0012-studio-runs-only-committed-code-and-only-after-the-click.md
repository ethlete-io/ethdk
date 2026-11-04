---
status: accepted
built: dd708ee4a
decided: 2026-11-04
source: plans/ethlete-studio/backlog-parallel/decisions-latest.md, "Studio runs committed code only" (findings 363-365) rule and item 1
---

# Studio runs only committed code, and only after the click

Agents build half-done states into the shared checkout, and every reload remounts all frames (WebKit freeze of
finding 364). So Studio starts the design server from its own copy of the CLI build, keyed by commit, taken only when
`libs/cli` has no uncommitted changes; otherwise it keeps the last copy and shows "CLI hat uncommittete Änderungen,
Studio läuft auf Stand <sha>".
