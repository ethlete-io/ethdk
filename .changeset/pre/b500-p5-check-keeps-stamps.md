---
'@ethlete/cli': patch
---

`design check` no longer rewrites `merged.json` and `ready.json`: it reports the same lines, and the check records and merge hashes it computes stay in memory. `design ready` and the design server still write check records.
