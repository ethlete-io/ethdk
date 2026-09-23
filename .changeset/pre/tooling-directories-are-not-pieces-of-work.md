---
'@ethlete/timetrack': patch
---

A directory named with a leading dot no longer counts as a piece of work. `.changeset`, `.github`
and `.claude` are the checkout's own tooling, so a commit there is bookkeeping for another piece.
