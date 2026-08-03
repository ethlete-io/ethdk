---
'@ethlete/cdk': minor
---

Ship a machine-readable migration map at `@ethlete/cdk/migration-map.json`: every public export of the
barrel with its `@ethlete/components` or `@ethlete/core` successor, the kind of change (`move`, `rename`,
`reshape`, `rename+reshape`, `replaced-by`, `removed`) and a docs link.
