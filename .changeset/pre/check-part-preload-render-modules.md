---
'@ethlete/cli': patch
---

`design check --part` loads the drawn parts' modules on the design server while the typecheck runs, so its render check starts on a filled module graph and finishes sooner.
