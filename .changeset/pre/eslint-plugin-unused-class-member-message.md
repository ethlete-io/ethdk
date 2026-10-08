---
'@ethlete/eslint-plugin': patch
---

The `no-unused-class-member` message now says the member is never referenced through `this`, matching what the rule checks: a member that is only written still counts as used.
