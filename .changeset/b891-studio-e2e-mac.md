---
'@ethlete/cli': patch
'ethlete-studio': patch
---

The design server and Studio compare the served project with the checkout by real path, so a checkout reached through a symlink (macOS `/var` -> `/private/var`) no longer reads as another project.
