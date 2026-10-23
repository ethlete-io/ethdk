---
'@ethlete/core': patch
---

Remove the light accent variant class a server painted on `<html>` when `provideColorScheme()` hydrates in dark mode, so root-scoped accents no longer stay on the light variant.
