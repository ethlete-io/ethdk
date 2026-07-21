---
'@ethlete/components': minor
---

`et-select` (and the headless `[etSelect]`) gains the `[etSelectOptions]` directive: bind the bundle returned by `selectOptionsFromQuery` or `selectOptionsFromV2Query` with a single attribute and it wires the async plumbing for you — forwarding `loading`, `error` and `hasMoreItems`, forcing `filterMode` to `external`, and driving the bundle's `setQuery`/`loadMore` from the select's `(queryChange)`/`(loadMore)` outputs. You only render the options. Both factories return the same shape, so one directive serves the current query client and the legacy `V2QueryClient` alike. The manual per-input wiring stays fully supported.
