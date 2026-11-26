---
'@ethlete/cli': patch
---

`design sketch approve` and `design sketch merge` no longer take `--decided-by`: an agent approves with `--by <model id>` (and optional `--mandate`), recorded as its own; only Studio records the designer.
