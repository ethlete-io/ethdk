---
'@ethlete/components': patch
---

Query devtools: `HttpHeaders`, `FormData`, `Map`, `Set`, `Date`, `File` and `Blob` args render their real contents instead of private fields or `{}`, and the args editor preserves the ones JSON cannot carry rather than replaying them empty.
