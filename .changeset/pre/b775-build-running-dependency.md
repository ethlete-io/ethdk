---
'@ethlete/cli': patch
---

The design server now waits for a lib that nx rebuilds as a dependency or through `nx run-many -p a,b`, instead of answering an import error while its dist is rewritten.
