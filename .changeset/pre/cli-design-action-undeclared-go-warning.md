---
'@ethlete/cli': patch
---

`design check` now reports ACTION-UNDECLARED in a part whose go still holds as one warning line per part, with the hit count and first element. A part without a go, or changed since it, still fails.
