---
'@ethlete/agent-rules': patch
---

`ethlete-agents sync`, `check` and `migrate` now report `--dry-run=false` (any value on a flag that takes none) instead of running a dry run, and drop empty entries from `--targets`, so `--targets=,` asks for a value instead of failing on an unknown target named "".
