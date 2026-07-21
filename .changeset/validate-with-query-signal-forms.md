---
'@ethlete/query': minor
---

Add `validateWithQuery` (v3) and `validateWithV2Query` (v2) — query-backed async
validators for Angular signal forms. They adapt an `@ethlete/query` query into
`validateAsync`, so server-side validation runs through the query client (auth,
base route, caching, error normalization) instead of a raw `httpResource`. A
`422 FormViolationListView` maps each violation onto its child field by
`propertyPath` (via `mapViolationsToFormErrors`); success reports no errors and
network/other errors surface as a form-level error.
