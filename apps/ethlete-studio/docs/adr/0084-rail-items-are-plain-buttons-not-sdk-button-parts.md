---
status: accepted
built: 78f1cd587
decided: 2026-10-31
source: the decisions-latest log of the parallel backlog (deleted in B597, ADR 0369), "Surfaces follow the elevation system, not picked names" (Q203-Q206), Q234
---

# Rail items are plain buttons, not SDK button parts

The rail items of `elements/shell-main` become `<button type="button" aria-label="...">` declared in the shell-main
`controls`, with their current look. Tom rejected an SDK button variant just for a Studio-only control, and a `title`
signal in the CLI was rejected (status icons carry `title` too).
