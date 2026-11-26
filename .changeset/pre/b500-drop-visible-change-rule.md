---
'@ethlete/cli': patch
---

`et design check --slow` and `et design serve` no longer run the `VISIBLE-CHANGE` rule, and `--slow` no longer takes `--base`; `et design check --visible-change` still runs the gate on demand.
