---
'@ethlete/query': patch
---

Legacy interop: a second `execute()` on an in-flight query is a no-op again unless `cancelPrevious` is set, so a double-clicked submit no longer aborts and re-sends the mutation.
