---
'@ethlete/query': minor
---

Add a signals-first query form: `createQueryForm({ fields, queryParamPrefix? })` alongside field creators `queryField`, `searchQueryField`, `sortQueryField`, `stringArrayQueryField`, `numberArrayQueryField`, `booleanArrayQueryField`, `dateQueryField`, `dateArrayQueryField`.

Built on Angular signal forms, so each field is bindable to the SDK's own controls with `[formField]` (e.g. `<input etInput [formField]="qf.fields.search" />`). Fields commit as a debounced signal `value`, sync to the URL query params (default elision, `ET_NULL__` sentinel, `active:direction` sort format, prefix namespacing), reset dependents via the `isResetBy` graph, expose `activeFilterCount` as a signal, and support a detached `branch()` for edit-then-apply filter flows.

The existing reactive-forms `QueryForm` is unchanged and remains available.
