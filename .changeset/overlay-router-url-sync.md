---
'@ethlete/components': patch
---

The overlay router resolves a relative route from `/` without a double slash, a `syncUrl` overlay leaves no history entries behind on close, and a guard-vetoed browser Back puts the URL param back for routed and query-param overlays.
