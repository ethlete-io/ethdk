---
status: accepted
open: B348
decided: 2026-11-04
source: grill session 2026-11-04, Tom: "mein rechner hier ist ja ziemlich stark, das hat kaum einer. der mac ist eher ein realer testcase"
---

# A measuring session hunts slow paths on the Mac

Tom: "könnten wir auch ggf noch einen builder darauf anstoßen den mac zu nuzten um perf engpässe zu identifizieren via
ssh? ... mein rechner hier ist ja ziemlich stark, das hat kaum einer. der mac ist eher ein realer testcase".

A second session runs now, next to the builder. It measures Studio on `ethlete-mac` over SSH and builds nothing: no
source edits, no commits on the Mac. Each slow path goes to the grill session as a finding, and the fix joins the one
builder queue. For each slow path, the session proposes the budget check that catches it on any machine (measured value,
limit, fixture), as the slow-machine decision (ADR 0017) asks.
