---
'@ethlete/cli': patch
---

`design check --rules --base` now tells a part without an implemented record to run `check --part` first, then `task <part> --verify`, and says that an open point of the check blocks the record.
