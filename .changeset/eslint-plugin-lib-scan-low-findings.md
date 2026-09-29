---
'@ethlete/eslint-plugin': patch
---

`no-native-observers` and `no-direct-dom-manipulation` now catch aliased, subclassed, `window.`-prefixed and bracket-access uses. `no-impure-top-level-provider` sees through `satisfies` and `!`; `enforce-routing-view-naming` rejects `items-viewer`.
