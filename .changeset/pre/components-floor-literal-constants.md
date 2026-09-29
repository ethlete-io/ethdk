---
'@ethlete/components': patch
---

Module-scope constants no longer read other constants at load time, so every `@ethlete/components` import is about 0.7 kB gz smaller.
