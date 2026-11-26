---
'@ethlete/components': minor
---

A query-param overlay no longer adds a history entry when it closes. If `open()` added the entry, the close steps back over it; otherwise the close replaces it. The next Back no longer reopens the overlay.
