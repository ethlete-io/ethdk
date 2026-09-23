---
'@ethlete/components': patch
---

`@ethlete/bracket` is now a regular dependency instead of a peer dependency, so package managers install it with `@ethlete/components`. Before, an app that did not list `@ethlete/bracket` itself failed to build, because the main bundle imports it.
