---
'@ethlete/cli': patch
---

`et design` commands that load design modules (`system --json`, `sketch ready`) no longer share the dependency cache of the running design server, so they stop deleting its optimized deps and blanking every live frame.
