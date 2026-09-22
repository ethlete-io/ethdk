---
'@ethlete/cdk': minor
---

Add `nx g @ethlete/cdk:migrate-from-cdk`. Driven by `migration-map.json`, it rewrites the mechanical part of a
cdk → components migration (import moves and renames, skeleton `shape="rect"`, the spinner and picture template
inputs) and reports the rest in `migrate-from-cdk-tasks.md`: missing picture `alt`, class inputs grouped by
sizing mode, themed spinners, reshaped symbols, and successors that need a newer `@ethlete/components`.
