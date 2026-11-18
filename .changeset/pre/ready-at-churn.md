---
'@ethlete/cli': patch
---

`design check` no longer rewrites a `ready.json` entry whose only change is its `at` time, so an unchanged action baseline stays byte-identical and no "action baseline HEAD holds changed" line appears.
