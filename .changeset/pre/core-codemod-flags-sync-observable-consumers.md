---
'@ethlete/core': patch
---

The `migrate-to-v5` codemod now reports each `toSignal(…, { requireSync: true })`, `take(1)`, `first()` or `withLatestFrom` that reads an observable it rewrote to `toObservable()`, because that observable no longer emits synchronously.
