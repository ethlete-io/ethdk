---
'@ethlete/core': patch
---

A meta or link binding now keeps the place it got when it was bound. An earlier binding whose value updates no longer jumps ahead of a later one, so a child's tag stays in front of its parent's.
