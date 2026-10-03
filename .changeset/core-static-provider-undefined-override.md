---
'@ethlete/core': patch
---

A static provider override no longer erases a default with a key set to `undefined`, so `provideXDefaults({ size: undefined })` keeps the default size; `null` still overrides.
