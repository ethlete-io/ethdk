---
'@ethlete/cli': minor
---

Design comments have an addressed state. `inbox done`, a new sketch round, a merge and a discard now mark a thread addressed instead of resolving it, and only the user resolves a thread, in Studio, through `comment-done` (which no longer edits the part's note). The agent can still `comment reply` on an addressed thread, and a reply by the user opens it again. Comment files resolved by an older version for a round, merge, discard or the agent read as addressed. The inbox lists pick and discard decisions as waiting for the user, since Studio merges and discards on the user's click.
