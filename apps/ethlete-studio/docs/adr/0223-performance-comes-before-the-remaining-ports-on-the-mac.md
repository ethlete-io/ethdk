---
status: accepted
open: B418
decided: 2026-11-07
source: doc-agent session, grill round after Tom's "das ist echt extrem lahm"
---

# Performance comes before the remaining ports on the Mac

Tom: "das ist echt extrem lahm", then "q1ok" on the recommendation. The Mac is an Intel i7-9750H (6 cores, 12 threads)
and every check renders in Chromium; a sketch check took 850 s, and parallel agents drove the load to 215, so renders
timed out and were retried. New order on the Mac, replacing step 3 of ADR 0218 and narrowing ADR 0219: (1) finish the
`pages/sketches@all-states` sketch to ready, because Tom waits for it; (2) performance next (S7c, S8, S5), with no
parallel compare or render agents; (3) then the pages/system port, B417 and the push of `next`. Code-only agents that
do not render may still run in parallel.
