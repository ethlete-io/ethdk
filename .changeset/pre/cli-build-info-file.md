---
'@ethlete/cli': patch
---

The cli build now writes its build time into a shipped build-info.json, so the design server can tell a newer install from an older one even when the package files all carry the same timestamp.
