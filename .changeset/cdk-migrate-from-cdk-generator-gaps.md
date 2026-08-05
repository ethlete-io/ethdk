---
'@ethlete/cdk': patch
---

Fix `migrate-from-cdk`: stop duplicating import specifiers, rewriting `<et-picture>` attributes on templates still bound to cdk's component, and mechanically renaming `TableImports`/`TabImports` onto an unrelated API.
