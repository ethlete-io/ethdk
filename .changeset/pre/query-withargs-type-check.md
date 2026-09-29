---
'@ethlete/query': major
---

Calling a query creator whose route uses `pathParams` without `withArgs` is now a type error; opt out with the literal `silenceMissingWithArgsFeatureError: true`, and let a stored `withArgs` feature's type be inferred rather than annotated `QueryFeature`.
