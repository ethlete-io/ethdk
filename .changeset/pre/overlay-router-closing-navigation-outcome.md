---
'@ethlete/components': patch
---

A url-synced overlay router now clears its query param also when a guard cancels the closing navigation before the leave animation ends, and no longer steps the history back after a navigation that kept the param on a new page.
