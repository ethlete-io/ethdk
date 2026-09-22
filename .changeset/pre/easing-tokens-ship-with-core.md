---
'@ethlete/core': patch
'@ethlete/components': patch
---

Animations: `@ethlete/core` now ships the `--ease-*` tokens its own stylesheets transition with, through `mountEasingTokens()`, so an app that loads no `@ethlete/cdk` stylesheet no longer loses every overlay animation.
