---
'@ethlete/query': patch
---

Error handling: a `{ violations: null }` (or otherwise malformed) error body no longer throws out of `mapViolationsToFormErrors` and the Symfony parser - it degrades to a form-level `etServerError`.
