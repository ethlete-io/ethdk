---
'@ethlete/query-devtools': patch
---

The toggle entry point no longer imports the `@ethlete/components` barrel, so the lazy shell adds no components code to the initial bundle of an application.
