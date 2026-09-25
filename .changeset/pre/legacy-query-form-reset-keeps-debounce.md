---
'@ethlete/query': patch
---

Legacy `QueryForm`: a debounced field that resets an `isResetBy` field (a search resetting the page) keeps its debounce instead of committing its first keystroke at once.
