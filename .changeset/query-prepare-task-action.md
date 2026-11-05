---
'@ethlete/query': patch
---

The `migrate-to-query-v3` task for a `prepare()` call in a standalone function now names the fix: add `const injector = inject(Injector)` at the top of the factory and pass `{ injector }`, or use `provideLegacyPrepareFallback()`.
