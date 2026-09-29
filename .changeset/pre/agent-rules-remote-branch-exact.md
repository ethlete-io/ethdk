---
'@ethlete/agent-rules': patch
---

`git-flow repair` and `start` no longer mistake a remote branch that only ends with the name, such as `team/feat/x` for `feat/x`, for the branch.
