---
'@ethlete/cli': patch
---

`design check --rules --base` now tells a part without an implemented record to run `task <part> --verify`, the only command that records it; plain `compare <part>` records nothing.
