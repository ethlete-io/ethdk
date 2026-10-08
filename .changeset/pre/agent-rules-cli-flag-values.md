---
'@ethlete/agent-rules': patch
---

`ethlete-agents sync`, `check` and `migrate` now reject a value on a flag that takes none (`--dry-run=false`) and ignore empty `--targets` entries.
