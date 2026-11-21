---
'@ethlete/timetrack': patch
'timetrack-app': patch
---

Move a commit whose kept cherry-pick copy lands in a slot with no row to the copy that has a row, so deduping copies no longer drops a commit's row.
