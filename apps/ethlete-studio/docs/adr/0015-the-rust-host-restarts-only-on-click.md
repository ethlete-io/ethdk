---
status: accepted
built: dd708ee4a
decided: 2026-11-04
source: the decisions-latest log of the parallel backlog (deleted in B597, ADR 0369), "Studio runs committed code only" (findings 363-365) item 4
---

# The Rust host restarts only on click

`yarn studio` runs `tauri dev --no-watch`. After a commit in `apps/ethlete-studio/src-tauri`, Studio shows "Host
geändert - Studio neu starten"; the click quits the app and `yarn studio` rebuilds it from the committed state.
