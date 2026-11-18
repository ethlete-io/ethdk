---
status: accepted
open: none
decided: 2026-11-04
source: the decisions-latest log of the parallel backlog (deleted in B597, ADR 0369), "Silent catchError decisions" (finding 370) item 2
---

# The builder commits the design files left by bbbc9d27f

`.ethlete/design/studio/merged.json` and `pictures.json`, written by a design command after bbbc9d27f changed the
`implements` path of `components/canvas-viewport`, are committed by the builder as a follow-up of bbbc9d27f.
