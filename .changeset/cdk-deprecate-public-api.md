---
'@ethlete/cdk': minor
---

Mark every public `@ethlete/cdk` export as `@deprecated`. The tag points at the
`@ethlete/components` successor, the symbol-by-symbol migration guide and the
`migrate-from-cdk` generator, so remaining CDK usage strikes through in the editor and the
library sinks to the bottom of autocomplete. Nothing changes at runtime and no lint rule
enforces it - intent to remove is v6.
