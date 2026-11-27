---
'@ethlete/cli': patch
---

A design-server shot that fails with a drawn error frame now answers with an `x-et-error` header holding the failure text, so the client-run judge names the real cause.
