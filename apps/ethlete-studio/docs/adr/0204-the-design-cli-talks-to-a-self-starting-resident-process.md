---
status: accepted
open: B404
decided: 2026-11-06
source: grill session 2026-11-06
---

# The design CLI talks to a self-starting resident process

Every design CLI call starts its own Vite design server, render worker, Chromium and harness build, which costs
10-40 s per call (findings 492, 493). One resident process owns the harness watch build, a warm browser pool and a
picture cache keyed on input hash; the CLI only sends it requests. The first design call starts it detached when none
is running (about 1-2 GB RAM, printed as a cold start once per session); it exits after 30 min without a request, and
`et design stop` ends it at once. CI keeps the in-process path. Rejected: running the process only while Studio or
`et design` is open, because the agents rarely have Studio open and would stay on the slow path. Tom: "q1ok" (option a,
recommended).
