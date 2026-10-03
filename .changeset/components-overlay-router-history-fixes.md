---
'@ethlete/components': patch
---

A `syncUrl` overlay router no longer pops the history entry of an overlay opened while it was still leaving, which closed that overlay too. A route change that closes a `syncUrl` overlay with `queryParamsHandling: 'preserve'` no longer carries the overlay's query param onto the next page.
