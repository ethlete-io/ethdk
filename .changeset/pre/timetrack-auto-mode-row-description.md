---
'@ethlete/timetrack': minor
---

Add `autoDescriptionAsks`, `autoDescriptionRequest` and `withAutoModeDescription`: auto mode writes the
description of a settled code row that names an issue, once per row and as `auto`, and never over a
description the user wrote. The answers are kept on `DayReviewEdits.autoDescriptions`.
