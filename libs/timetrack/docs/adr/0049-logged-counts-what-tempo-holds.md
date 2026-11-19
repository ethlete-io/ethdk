---
open: B627
decided: 2026-11-19
---

# Logged counts what Tempo holds

On 2026-11-18 the day header read 9.5 h logged while Tempo held one 30 min worklog. `logged` summed proposed and
covered rows (`rows/round.ts`), and rows `reviewDay` accepted on enough evidence were never booked. They were drawn
anew on every reload, so the day read 1.25, 20, 5.75, 9.5 and 1 h over one night.

**Logged counts only the worklogs Tempo holds for the day.** A row the app accepted but has not written counts as
proposed until it is booked. The human accepted this.
