---
'@ethlete/components': minor
---

Cascader: flat search across all levels. Implement the optional `search(query)` hook on the `CascaderDataSource` (returning root → match path chains) and the panel gains a search input that swaps the columns for a flat, breadcrumb-labelled result list - committing a match closes, while a branch-only match jumps the columns to it. New headless pieces `etCascaderSearch` and `etCascaderSearchOption`; `et-cascader` renders the input automatically (`searchPlaceholder` input) and Escape now clears an active query before closing the panel.
