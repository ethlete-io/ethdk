---
status: accepted
built: a1698f47a
decided: 2026-11-02
source: the decisions-latest log of the parallel backlog (deleted in B597, ADR 0369), "Title bar window controls decisions" item 1
---

# Studio keeps its own title bar; macOS keeps the native traffic lights

Studio keeps its own title bar on every OS (search, update button). On macOS it is laid out around the native traffic
lights (overlay title bar style), with their space reserved on the left and no controls on the right; Studio never
draws traffic lights itself.
