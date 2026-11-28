---
'@ethlete/cli': none
'@ethlete/cli-core': none
'@ethlete/design': patch
'ethlete-studio': none
---

The design tool builds on its own (`nx build design`), and Studio's bundled design runtime now takes its dependencies and source hash from `libs/design`.
