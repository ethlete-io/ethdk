---
'@ethlete/query': minor
---

Add a signals-first query form: `createQueryForm({ fields, queryParamPrefix? })` alongside field creators `queryField`, `searchQueryField`, `sortQueryField`, `stringArrayQueryField`, `numberArrayQueryField`, `booleanArrayQueryField`, `dateQueryField`, `dateArrayQueryField`.

Built on Angular signal forms, so each field is bindable to the SDK's own controls with `[formField]` (e.g. `<input etInput [formField]="qf.fields.search" />`). Fields commit as a debounced signal `value`, sync to the URL query params (default elision, `ET_NULL__` sentinel, `active:direction` sort format, prefix namespacing), reset dependents via the `isResetBy` graph, expose `activeFilterCount` as a signal, and support a detached `branch()` for edit-then-apply filter flows.

Also adds a `withPageResetOnError` query feature that resets the page (a signal or a query-form field) when the current page goes out of range (HTTP `416`, or a dev-mode `500` Pagerfanta out-of-range error), plus the exported `isPageOutOfRangeError` predicate.

The existing reactive-forms `QueryForm` is unchanged and remains available.
