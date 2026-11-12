---
status: accepted
built: 3c2285cfe
decided: 2026-11-12
source: chat with the doc agent 2026-11-12 (morning)
---

# A shift closes more findings than it opens

In the night of 2026-11-11 to 2026-11-12 the builders built or closed 50 findings, but 94 new ones came in, so the open
list grew by about 44. Most new findings were Suspects from builder reports, not proven causes. The human: "ich lasse
dich slso die nscht durch srbeiten dsmit wir msl voran kommen und das resultat ist wir hsben 50 findings mehr als vor der
nacht?" and, choosing option b: "q1b wir schießen uns hier andsuernd ins bein weil immer wieder neues dszu kommt und dann
passiert eben gensu sowss wie das der canvas wieder clipping hst was ja 4(!) msl aufgeschrieben wurde. wir verzetteln uns
sm laufenden band. ein schritt nsch vorn und 10 zurück".

- A new finding gets a number only when its cause is proven ("Cause:") or when it blocks the current work.
- A Suspect without proof goes as one line, without a number, into `plans/ethlete-studio/parked-suspects.md`. It becomes a
  finding only when it happens a second time.
- A shift may not open more findings than it closes. When the balance of a shift is positive, the builders work only the
  open list, oldest finding first, until the balance is even again.
- The doc agent reports the balance (opened, closed, open) with every shift summary.
- The doc agent sorts the open findings 903-996 by these rules: each open Suspect without a second time moves to the
  parked list.
