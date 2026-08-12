---
'@ethlete/timetrack': minor
---

Add `dedupeKeyOf`, the identity a re-collected event is recognised by, so a git scan can re-read a
window of history without appending the same commit or branch switch a second time.
