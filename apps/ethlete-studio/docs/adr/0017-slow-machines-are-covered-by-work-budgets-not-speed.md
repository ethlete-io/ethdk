---
status: accepted
open: none
decided: 2026-11-04
source: plans/ethlete-studio/backlog-parallel/decisions-latest.md, "WebKit soak check decisions" (finding 365) item 2
---

# Slow machines are covered by work budgets, not speed

Checks assert budgets that hold on any machine: the design server stays responsive during a listing, and no
synchronous block exceeds 50 ms on a large fixture (about 200 sketches). No artificial CPU or network throttle. Tom's
2019 Intel MacBook Pro stays the natural slow-machine test; every fault found only there becomes a new budget check.
