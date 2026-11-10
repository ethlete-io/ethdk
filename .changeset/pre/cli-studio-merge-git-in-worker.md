---
'@ethlete/cli': patch
---

A Studio merge runs its git status and commit in the merge worker, so forking git no longer stalls the design server on Linux.
