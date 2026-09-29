---
'@ethlete/eslint-plugin': patch
---

`no-native-observers` and `no-direct-dom-manipulation` now catch aliased, subclassed, `window.`-prefixed and bracket-access uses and stop reporting shadowed names.
