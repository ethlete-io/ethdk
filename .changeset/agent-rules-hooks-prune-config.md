---
'@ethlete/agent-rules': patch
---

Fix `sync` deleting hand-written hooks whose file name starts with `ethlete`, pruning empty skill folders when `--root` is relative, and name the offending key when `ethlete-agents.config.json` has a value of the wrong type. `migrate` now validates the config before changing anything and leaves a symlinked `CLAUDE.md` alone.
