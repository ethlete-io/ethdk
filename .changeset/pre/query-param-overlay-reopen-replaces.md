---
'@ethlete/components': patch
---

A query-param opener's `open()` replaces the history entry while the overlay is already open, so closing it no longer steps back onto the previous value.
