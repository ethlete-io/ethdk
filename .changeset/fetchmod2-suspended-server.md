---
'@ethlete/cli': patch
---

The design server's late-timer line now says the server was suspended, with its CPU use, when the machine slept, instead of calling a sleep a blocked event loop.
