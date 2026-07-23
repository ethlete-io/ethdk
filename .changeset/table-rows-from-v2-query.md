---
'@ethlete/components': minor
---

Table: add `tableRowsFromV2Query` — the legacy `V2QueryClient` twin of `tableRowsFromQuery`, with the same config and return shape (backed by the legacy `queryComputed` container). Both adapters now share one client-agnostic core (`createTableRowsSource`), so they stay in lockstep.
