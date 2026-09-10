---
'@ethlete/timetrack': patch
---

`mergeBlocks` no longer stretches a band across idle time: a row absorbs no more idle than the time
it observed, so its rectangle is never more than twice the work behind it.
