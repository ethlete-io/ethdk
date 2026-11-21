---
'@ethlete/cli': patch
---

`design check` now keeps the action check results of a part across runs: it passed no harness app root, so the action cache was never keyed or read.
