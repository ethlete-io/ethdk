---
'@ethlete/eslint-plugin': minor
'@ethlete/agent-rules': patch
---

`recommendedTs` now uses `ethlete/consistent-type-definitions` instead of `@typescript-eslint/consistent-type-definitions`, so `--fix` no longer turns an interface inside `declare module` or `declare global` (such as the theme-name registry the `@ethlete/core` generators emit) into a type alias that merges into nothing.
