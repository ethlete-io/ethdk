---
'ethlete-studio': minor
'@ethlete/agent-rules': patch
'@ethlete/cli': patch
---

Studio reads a call's `closed` and `waitsFor`: closed calls count as settled, waiting calls sit under "On hold", legacy calls with a stage clear the stage gate, and open calls now lead the sidebar.
