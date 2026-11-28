---
'@ethlete/core': patch
---

The `surface-roles` migration lists the places it cannot rewrite as a WARN and exits 0, so the later migrations still run.
