---
'@ethlete/components': patch
---

A url-synced overlay router whose closing navigation a guard cancelled no longer pops the history entries of another url-synced overlay opened meanwhile. It then removes only its own query param.
