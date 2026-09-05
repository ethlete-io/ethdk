---
'@ethlete/query': patch
---

Error handling: a malformed `violations` body degrades to a form-level `etServerError` instead of throwing, and the `416`, `408`, `410` and `425` status texts are corrected.
