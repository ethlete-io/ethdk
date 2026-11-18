---
status: accepted
built: dacf9bd64
decided: 2026-10-30
source: slice 2 open points of the motion plan (deleted in B597, see ADR 0363)
---

# Motion shots: every open point as recommended

Build `et design mcp`, then `motion_shots`; token names and the `/__design/motion` endpoint in slice 3; clip to the
union of the root and the animated boxes over all keyframes; `data-et-key` before the selector for `element`; keep
the three limits (no step after 30 s, infinite animations do not count towards `end`, `interrupt` waits for slice 4)
and document them.
