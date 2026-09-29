---
'@ethlete/core': minor
---

Breaking: `injectAppUpdates().check()` is now `check$()` and `fetchDeployedBuildFingerprint()` is now `fetchDeployedBuildFingerprint$()`; both return cold Observables instead of Promises.
