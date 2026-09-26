---
'@ethlete/query': major
---

Calling a query creator whose route uses `pathParams` without `withArgs` is now a type error; pass the literal `silenceMissingWithArgsFeatureError: true` to opt out (a `boolean`-typed flag no longer satisfies it). Combining that flag with `withArgs` is a type error too, and a `withArgs` feature stored in a variable annotated as plain `QueryFeature` no longer counts - let its type be inferred.
