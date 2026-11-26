---
'@ethlete/core': patch
---

Removes every circular import inside the package, so no module can be read before it has finished loading, and adds a test that fails on a new one.
