---
'@ethlete/core': patch
---

The `migrate-to-v5` generator now renames `ProvideThemeDirective` to `ProvideColorDirective` in files that import it from `@ethlete/theming`. Before, it left the old name, and the cdk migration then imported that old name from `@ethlete/core`.
