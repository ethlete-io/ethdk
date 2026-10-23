---
'@ethlete/cli': patch
---

`render.packages` now maps subpath imports such as `@ethlete/core/design/theme-css` too, both in the browser and in the calls tsconfig. `ng()` looks import names up in `@ethlete/core` as well by default.
