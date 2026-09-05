---
'@ethlete/query-devtools': patch
---

Query devtools: the session export no longer carries credentials - an auth provider's own queries go in
without their bodies, and credential-named keys are redacted. The panel's clock also stops ticking the
application while it is closed.
