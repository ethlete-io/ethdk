---
'@ethlete/eslint-plugin': patch
---

`class-member-order`: recognize custom `injectXyz()` helper functions (not just the raw `inject()` call) as inject-group members, so they're required to be declared before inputs/outputs/queries/properties like other injected dependencies.
