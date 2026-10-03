---
'@ethlete/components': patch
---

A url-synced overlay router that closes before its own navigation ends (a slow guard or resolver) now clears its query param once that navigation lands, instead of leaving it in the URL.
