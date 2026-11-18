---
status: accepted
open: none
decided: 2026-11-04
source: the decisions-latest log of the parallel backlog (deleted in B597, ADR 0369), "Decision records and plan size" (finding 385) item 3
---

# The push check fails on a missing or stale ADR build state

Every ADR has a build state; an `open:` ADR needs an open STATUS row, and a STATUS row that names an ADR must match
it. A missing or stale link fails the push.
