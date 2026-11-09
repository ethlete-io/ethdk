---
status: accepted
open: B249
decided: 2026-11-09
source: grill session 2026-11-09
---

# The e2e wait goal is under 90 s, after a cached sketch check

The Studio e2e step of the push suite was meant to end under 60 s. Measured on 2026-11-09, it takes about 115 s and is
CPU-bound; the biggest server cost is the sketch and rule check, which runs again over the whole product for every
full listing. The design CLI keeps that check result per product until a watched file changes. Then the e2e step is
measured again, and the goal is "under 90 s over 3 runs". After that, the wait item ends and the Studio list goes on.
The human: "q1ok" (option a, recommended).
