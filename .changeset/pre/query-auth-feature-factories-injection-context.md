---
'@ethlete/query': patch
---

Auth: `createPersistentAuthFeature` and `createTrackingFeature` run in the feature context's injector, so calling them outside an injection context no longer throws NG0203.
