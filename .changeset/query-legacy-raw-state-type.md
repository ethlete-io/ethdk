---
'@ethlete/query': patch
---

A legacy query from `createLegacyQueryCreator` types `rawState` with the response of the wrapped creator again, not `unknown`. Templates that read it, such as `*etInfinityQuery`, typecheck again.
