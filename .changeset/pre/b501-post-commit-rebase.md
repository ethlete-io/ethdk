---
'@ethlete/cli': patch
---

The post-commit sketch rebase also runs for a commit to a part whose path holds a `sketches` folder, and for a commit that changed `libs/cli` (it builds the clean CLI when no copy exists yet).
