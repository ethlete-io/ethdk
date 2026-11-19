---
open: B602
decided: 2026-11-19
---

# A session's folder outranks commits only while sessions overlap

On 2026-11-19 a lone coordinating session in `specs@main` (11:47-13:17Z) was booked to the folder stand-in
`tracks/20261030_post-angular-22-cleanup`, where most of the files it touched lay, although its three commits
(OTH-100 to 102) changed only `tracks/20261102_e2e-findings`: about 47 minutes on the wrong stand-in. Until now the
session's dominant folder always outranked the commits' folder once a checkout worked in two or more folders that day,
a rule only the code stated, for the reason that a commit cannot say which of two parallel sessions made it.

Asked to choose between the session's folder winning only while sessions overlap and keeping the rule, the human
answered: "q1ok" (overlap only, recommended).

1. On a base branch, the session's dominant folder decides the piece only in the minutes in which two or more sessions
   of the same checkout overlap.
2. Outside those minutes the folder the commits changed decides. A lone session that committed in two folders is cut
   inside its run by its commits.

Cross-check (ADR 0358 in Studio): asked; answer "fix" on the wording (it adds a rule rather than amending this
checkout's ADR 0043, and the overlap grain had to be named); no question to the human saved.
