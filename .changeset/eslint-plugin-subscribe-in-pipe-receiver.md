---
'@ethlete/eslint-plugin': patch
---

`no-subscribe-in-pipe` no longer reports a `.subscribe()` inside a callback of the observable that `.pipe()` is called on, such as `defer(() => …).pipe(…)`.
