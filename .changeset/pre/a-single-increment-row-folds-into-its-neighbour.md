---
'@ethlete/timetrack': patch
'timetrack-app': patch
---

A row that books a single 15-minute increment now folds into the nearest row of the same name in
its lane, which grows toward it by that increment. The day's total stays the same and the timeline
loses its holes. A row the reviewer edited never folds, a pinned row never absorbs one, and a growth
that would cover another row of the lane, or cross between background and foreground work, is left
out.
