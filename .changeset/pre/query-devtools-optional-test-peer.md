---
'@ethlete/query-devtools': patch
---

Mark `@analogjs/vitest-angular` an optional peer dependency, so installing the devtools no longer
asks consumers for a test runner the package only needs to run its own specs.
