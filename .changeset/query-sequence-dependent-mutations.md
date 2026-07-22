---
'@ethlete/query': minor
---

Add `querySequence` for imperative waterfalls of dependent queries — chain mutations with `.then()`, thread each response into the next, and `run()` to a typed, discriminated result that aborts on the first error. Exposes `status`/`running`/`currentStep`/`error` progress signals for driving UI.
