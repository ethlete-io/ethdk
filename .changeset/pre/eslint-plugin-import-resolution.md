---
'@ethlete/eslint-plugin': patch
---

Angular and RxJS rules now resolve `Component`, `inject`, `input`, `effect` and friends through their imports, `document` and `setTimeout` match only the globals, and import bans also report re-exports and dynamic imports.
