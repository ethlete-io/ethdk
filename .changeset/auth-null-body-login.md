---
'@ethlete/query': patch
---

Auth: a `2xx` login or refresh response with an empty body now ends in an `error` execution state instead of staying `loading` forever.
