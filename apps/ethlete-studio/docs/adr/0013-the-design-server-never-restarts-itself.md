---
status: accepted
built: dd708ee4a
decided: 2026-11-04
source: plans/ethlete-studio/backlog-parallel/decisions-latest.md, "Studio runs committed code only" (findings 363-365) item 2
---

# The design server never restarts itself

After a commit in `libs/cli`, Studio shows "CLI geändert - neu starten"; only the click restarts the server from the
new copy (as decided for finding 363, B309).
