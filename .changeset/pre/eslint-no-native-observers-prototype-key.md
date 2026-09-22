---
'@ethlete/eslint-plugin': patch
---

Fixed `no-native-observers` crashing on `new constructor()` or `new toString()` - an identifier naming an inherited `Object.prototype` key was read as a known observer entry.
