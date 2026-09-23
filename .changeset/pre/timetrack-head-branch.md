---
'@ethlete/timetrack': patch
---

New `readHeadBranches$()` reads the branch a checkout was on at an instant from its reflog, so a day
holding no git event for a checkout can still name its branch.
