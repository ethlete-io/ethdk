---
'@ethlete/cli': patch
---

`et update` gitignores its task list, so a later run no longer needs `--force`, and `--continue` keeps the `--from` versions and the codemods an earlier run applied.
