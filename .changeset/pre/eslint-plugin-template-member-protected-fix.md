---
'@ethlete/eslint-plugin': patch
---

`template-member-accessibility` now fixes an unneeded `protected` to `public` in one pass, instead of deleting it (and any comment after it) and leaving an implicitly public member to fix again.
