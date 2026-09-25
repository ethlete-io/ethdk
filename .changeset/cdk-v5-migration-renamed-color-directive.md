---
'@ethlete/cdk': patch
---

The v5 migration moves `ProvideColorDirective` and `COLOR_PROVIDER` imports from `@ethlete/cdk` to `@ethlete/core`, so a `ProvideThemeDirective` import that the core migration renamed first no longer stays behind on `@ethlete/cdk`.
