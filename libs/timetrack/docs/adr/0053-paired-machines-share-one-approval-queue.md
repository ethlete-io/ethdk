---
open: B616
decided: 2026-11-19
---

# Paired machines share one approval queue

On 19.11. tank held 4 auto mode approvals and the Mac 5. Each machine's auto mode queued its own Jira creates, so
nearly the same issue ("Visuelle Baselines ... integrieren") waited on both, and the human would have approved in two
places. Offered (A) the queue travels like the day rows, (B) only one machine runs auto mode, or (C) as is, the human
answered "q6ok" to the recommendation A.

- The approval queue travels between paired machines like the day rows (ADR 0047). Both show the same items, and a
  decision on one machine (approve, reject, expiry) holds on the other.
- Near-identical proposals are folded into one item before the human sees them: the same apply on the same band and
  day, or Jira creates for the same work. An approved create is written to Jira once, by one machine.
- Each machine still runs auto mode over its own sessions; only the queue is shared.
