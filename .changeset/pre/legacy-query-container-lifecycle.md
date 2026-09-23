---
'@ethlete/query': patch
---

Legacy query containers: teardown destroys an uncacheable query, stops the poll of the last container, tracks dependents per injector, tears down the store's listeners, and leaves a superseded mutation to settle.
