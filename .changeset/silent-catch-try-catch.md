---
'@ethlete/eslint-plugin': patch
---

`no-silent-catch-error` also flags a `try/catch` whose catch ignores the error and returns a fallback value, such as `catch { return [] }`.
