---
status: accepted
built: dd708ee4a
decided: 2026-11-04
source: the decisions-latest log of the parallel backlog (deleted in B597, ADR 0369), "Studio runs committed code only" (findings 363-365) item 2
---

# The design server never restarts itself

After a commit in `libs/cli`, Studio shows "CLI geändert - neu starten"; only the click restarts the server from the
new copy (as decided for finding 363, B309).
