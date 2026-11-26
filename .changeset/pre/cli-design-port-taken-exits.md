---
'@ethlete/cli': patch
---

`et design` now exits with code 1 when its pinned port (`DE_PORT`) is already in use, instead of printing the error and staying alive
