---
'@ethlete/cli': patch
---

Fix `et update` for a real consumer: the `et` bin runs, `--continue` skips applied codemods, `--check` reports an unfinished run, lookups use the repo's registry, task links point at the right docs site, and failed syncs are reported.
