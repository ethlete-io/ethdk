---
'@ethlete/components': minor
---

Table filtering: add search and async options. `filterSearch` adds a search box to a column's filter menu (client-side over a static list). `filterOptions` now also accepts an async provider — the same `{ options, loading, hasMore, setQuery, loadMore }` shape `selectOptionsFromQuery` returns — so options can be loaded, searched and paginated from a query; the menu wires its search to `setQuery`, shows `loading`, and renders a "Load more" button when `hasMore`.
