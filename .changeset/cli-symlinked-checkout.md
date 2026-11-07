---
'@ethlete/cli': patch
---

`et design` works in a checkout reached through a symlink: the checkout path is resolved to its real path, and the
sketch rebase, `sketch at` and the harness build cache spell the git root the way the checkout is spelled.
