---
status: accepted
open: B388
decided: 2026-11-05
source: grill session 2026-11-05
---

# The full design check leaves CI until B388

After B372 the full `design check --product studio` runs to its end and fails on about 800 render problems that
existed before (finding 449). CI never saw them, because the step refused early on stale mocks. The CI step "Static
design rules" therefore runs `design check --rules` only (6915b243e), so CI can turn green. B388 sorts the render
problems into real defects and rule noise and fixes them; then CI runs the full check again. B388 comes right after
B377. Until then the full render check is a known gap in CI. Tom: "q1ok".
