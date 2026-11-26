---
'@ethlete/timetrack': patch
---

Review: `hideRow` and `showRow` take a row off the timeline and put it back, and `DayReview.hidden` holds what was taken off, so a row can be dropped from a day without being deleted or counted as unattributed.
