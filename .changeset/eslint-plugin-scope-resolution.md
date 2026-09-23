---
'@ethlete/eslint-plugin': patch
---

The remaining `inject`/`input`/`output` checks resolve through their imports, `document` and `setTimeout` only match the globals, and the import bans also report re-exports and dynamic imports.
