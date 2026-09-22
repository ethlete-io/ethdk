---
'@ethlete/timetrack': patch
---

Review: `mergeRows` keeps the first row's `laneKey`, so a merged row stays in the column it was drawn in instead of falling into the unnamed lane.
