---
'timetrack-app': patch
'@ethlete/agent-rules': patch
---

A ticket that ran behind other work now draws as one hatched band per lane instead of one per piece
another row took. The band reaches from the first piece to the last, and its label counts only the
minutes the pieces lost, so it never claims the gaps between them. `timetrack rows --json` now lists
these bands under `behind`.
