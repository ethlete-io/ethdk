---
'@ethlete/query': patch
---

`redirectOnSessionEnd` now fires with `withTokenRevocation`, only the tab a logout started in revokes, a logout during an in-flight revocation still revokes its tokens, and multi-tab sync is inert on the server.

A `revoke()` while a revocation is in flight now returns the snapshot of the revocation that sends its own tokens, not the one already in flight.
