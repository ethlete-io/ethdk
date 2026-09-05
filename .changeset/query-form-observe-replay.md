---
'@ethlete/query': patch
---

Query forms: a value written before `observe()` survives the call - `isResetBy` no longer clears a
sibling seeded alongside it, and `defineQueryForm` writes that value to the URL.
