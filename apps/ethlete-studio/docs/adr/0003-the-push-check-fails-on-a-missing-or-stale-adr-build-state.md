---
status: accepted
open: none
decided: 2026-11-04
source: plans/ethlete-studio/backlog-parallel/decisions-latest.md, "Decision records and plan size" (finding 385) item 3
---

# The push check fails on a missing or stale ADR build state

Every ADR has a build state; an `open:` ADR needs an open STATUS row, and a STATUS row that names an ADR must match
it. A missing or stale link fails the push.
