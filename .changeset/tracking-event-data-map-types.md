---
'@ethlete/query': patch
---

`withTracking`: the `tokenRefreshSuccess` handler is now typed with `{ automatic }` instead of a query success payload. Type-only fix - the event already carried that data at runtime.
