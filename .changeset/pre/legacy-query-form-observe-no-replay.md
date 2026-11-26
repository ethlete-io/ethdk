---
'@ethlete/query': patch
---

The legacy `QueryForm` no longer re-emits its unchanged value one debounce after `observe()`, which sent a second identical request from a `queryComputed` reading `currentValue()`.
