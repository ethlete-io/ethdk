---
'@ethlete/cli': patch
---

Do not refuse `design` for a checkout whose `dist/libs/cli` is a symlink into another checkout, as in the e2e-check worktrees.
