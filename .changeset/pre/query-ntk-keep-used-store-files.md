---
'@ethlete/query': patch
---

The `migrate-from-ngrx-toolkit` generator no longer keeps a whole feature store when code outside the feature uses only its service. It keeps the used file and the store files it imports, converts the rest, and names each kept file in `NTK-STORE-FILE-KEPT`.
