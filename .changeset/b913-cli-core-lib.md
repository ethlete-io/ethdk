---
'@ethlete/cli': patch
'@ethlete/cli-core': patch
'@ethlete/design': patch
'ethlete-studio': none
---

Move the helpers cli and design share into the private `libs/cli-core` lib; the published `@ethlete/cli` keeps the same file layout.
