---
'@ethlete/cli': patch
'@ethlete/agent-rules': patch
---

Remove `et design check --visible-change` and the `harness.baseBranch` setting it read; `et design compare --base <rev>` still compares against a clone at `<rev>`. The `background-design-commands` hook no longer names `--visible-change`.
