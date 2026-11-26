---
'@ethlete/core': minor
---

New generator `@ethlete/core:migrate-theme-token-names` renames the old theme token names (`--et-color-primary*`, `--et-theme-color-*`, the surface triplets and `-solid` aliases, the generated Tailwind color names) and stops with file and line for every place it cannot rewrite safely.
