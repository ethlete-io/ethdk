---
'@ethlete/cli': patch
---

The design server's `/__design/stamp` answer now carries the `pid` of the serving process, so a client can tell a restarted server from the one it talked to before.
