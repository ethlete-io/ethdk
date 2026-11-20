---
'@ethlete/cli': patch
---

`et design` rebuilds a stale lib without rebuilding its fresh dependency libs: each stale lib runs its own build targets with `--exclude-task-dependencies`, dependencies first.
