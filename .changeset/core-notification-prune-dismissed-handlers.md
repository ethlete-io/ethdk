---
'@ethlete/core': patch
---

Fix a service-worker notification that the user dismissed natively keeping its click handler. Handlers of notifications no longer shown are now dropped when the next service-worker notification is shown.
