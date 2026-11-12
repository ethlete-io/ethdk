---
'@ethlete/cli': patch
---

The design server writes an uncaught error with its stack, time, pid and port to `.ethlete/cache/design-server-crash.log`, prints the path and exits 1, and reports the last crash in its identity.
