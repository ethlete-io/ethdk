---
'@ethlete/eslint-plugin': minor
---

New rule `no-impure-top-level-provider`: bans destructuring a factory call at module scope, and — with
`{ requirePureAnnotation: true }`, for publishable library source — requires `/* @__PURE__ */` on
module-scope calls. Both shapes are undroppable, so one of them puts everything the call touches into
every consumer's bundle. Fixable.
