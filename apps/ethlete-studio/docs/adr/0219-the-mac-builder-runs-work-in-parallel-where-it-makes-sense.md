---
status: accepted
open: B416
decided: 2026-11-06
source: doc-agent session 2026-11-06, after finding 542
---

# The Mac builder runs work in parallel where it makes sense

Tom: "der builder darf dann auch so wie es sinnoll ist dinge paralel machen". The order in ADR 0218 is a priority, not
a strict sequence: the builder may run independent slices at the same time, for example the fixes of pages/sketches,
pages/system and pages/merge, or a push-safety slice next to a part fix. Each parallel agent gets its own paths and a
scratch worktree; the builder runs the full test suite and the design gate once over the joined result. The push of
`next` still waits until all five refused parts pass.
