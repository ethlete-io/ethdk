---
'@ethlete/eslint-plugin': patch
---

`no-trivial-wrapper-method` no longer flags `focus`, `blur` or `reset` on a component or directive - Angular resolves those by name on the instance.
