---
'@ethlete/components': patch
---

An overlay router with `syncUrl` that is closed by a router navigation no longer steps the history back when it is destroyed. Before, the cleanup could cancel the navigation that closed the overlay.
