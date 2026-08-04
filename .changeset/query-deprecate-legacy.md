---
'@ethlete/query': minor
---

Mark every legacy (v2) query export as `@deprecated`, including the `createLegacyQueryCreator`
interop, so v2 call sites strike through in the editor instead of needing a grep. Nothing
changes at runtime and no lint rule enforces it - intent to remove is v7.

`migrate-to-query-v3` now writes each `legacy*` wrapper it generates with a matching tag that
names the current-system creator to migrate to, and a new
`nx g @ethlete/query:deprecate-legacy-queries` generator adds those tags to wrappers already in
source. It takes the same `--projects` / `--include` / `--skipFormat` options, only touches
top-level `createLegacyQueryCreator(…)` declarations, appends to an existing JSDoc block rather
than replacing it, and skips anything already tagged - so it is safe to re-run.
