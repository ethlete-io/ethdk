---
'@ethlete/eslint-plugin': patch
---

Angular rules now resolve `Component`, `effect`, `inject` and friends through their imports, so aliased and namespace imports are checked and a same-named symbol from another package is no longer reported or fixed.
