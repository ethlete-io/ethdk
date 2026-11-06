---
status: accepted
open: B416
decided: 2026-11-06
source: doc-agent session 2026-11-06, after ADR 0217
---

# On the Mac, push safety and performance come first

Tom: "die mac session sollte dann auch daran arbeiten dass es nicht mehr zu diesen push issues kommen kann. aber auch
perf ist weiterhin wichtig. das wird man gerade auf dem mac merken da der nicht so schnell ist wie dieser pc". Order for
the Mac builder: (1) fix pages/sketches, pages/system and pages/merge, check-record pages/inventory and pages/start, push
`next` with the hook (ADR 0217); (2) push safety: the design-rules gate and the full CI run per slice on a draft pull
request while a push is held (ADR 0216), and an uncompared implemented part shows up when its app file changes, not
first at the push (finding 541); (3) performance continues (S7c, S8, S5), measured on the Mac, since the slow machine
is where a slow tool shows (ADR 0017 work budgets stay the gate).
