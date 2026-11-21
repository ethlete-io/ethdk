---
'@ethlete/cli': patch
'ethlete-studio': none
---

On Linux, a design server runs in its own memory-capped systemd user scope, so an out-of-memory kill hits the server and never the session that started it.
