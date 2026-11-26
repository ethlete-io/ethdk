---
'@ethlete/query': patch
---

Paged query stacks now report `isLastPageLoaded` for empty and shrunk results and allow `fetchNextPage()` during a load with `blockExecutionDuringLoading: false`; a query batch unsubscribed mid-flight settles as `cancelled` and `retryFailed()` resends it.
