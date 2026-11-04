---
'ethlete-studio': patch
'@ethlete/cli': patch
---

Studio now judges a stale cli build by the same source hash the cli guards itself with, instead of file modification times.
