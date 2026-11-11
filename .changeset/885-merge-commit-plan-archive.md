---
'@ethlete/agent-rules': patch
---

The git-safety hook now allows the commit that concludes a merge when a plan archive under `plans/**/archive/` is staged next to the merge paths, so an archive run that shrinks a merged plan can go into the merge commit.
