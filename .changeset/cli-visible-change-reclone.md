---
'@ethlete/cli': patch
---

`et design check --visible-change` clones the base checkout again when the reused clone cannot check out the base commit, instead of failing with `fatal: reference is not a tree`.
