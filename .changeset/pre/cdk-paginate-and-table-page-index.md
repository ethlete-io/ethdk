---
'@ethlete/cdk': patch
---

`paginate` handles a `NaN` or fractional `currentPage` and disables "previous" on a non-1 `firstPage`, and `TableDataSource` no longer sets the paginator to page `-1` when a filter matches nothing.
