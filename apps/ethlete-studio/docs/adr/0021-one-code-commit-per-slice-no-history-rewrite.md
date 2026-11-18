---
status: accepted
open: none
decided: 2026-11-04
source: the decisions-latest log of the parallel backlog (deleted in B597, ADR 0369), "Commit volume decisions" item 2
---

# One code commit per slice, no history rewrite

Code, spec, changeset and the "as built" note go in one commit; format, lint and review findings are fixed before it.
No rebase or `--fixup` squash, because several sessions share one checkout and branch; pushed commits are never
rewritten.
