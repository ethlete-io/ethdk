---
'@ethlete/components': major
---

Select: renamed the outputs `loadMoreRequested` → `loadMore` and `addNewRequested` → `addNew` (present-tense event names). Update your `(loadMoreRequested)` / `(addNewRequested)` bindings accordingly.

`selectOptionsFromQuery` and `selectOptionsFromV2Query` now handle load-more paging internally: `args` receives a `page` signal (starting at `initialPage`, default `1`) that resets on query change, the returned bundle exposes `loadMore()` to wire to `(loadMore)`, and each page's `toOptions` slice is appended to the accumulated `options`.
