---
'@ethlete/query': patch
---

`createQuerySubmission`'s `onSuccess` is typed for a `null` response, which is what a `204` hands it.
