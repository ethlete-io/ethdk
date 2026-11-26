---
'@ethlete/agent-rules': patch
---

Fix `sync` deleting hand-written hooks named `ethlete*` and mis-pruning skill folders with a relative `--root`; `migrate` now validates the config first and leaves a symlinked `CLAUDE.md` alone.
