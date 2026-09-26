---
'@ethlete/query': patch
---

Paged query stack: `isLastPageLoaded` is now `true` for an empty result and when a refresh reports fewer pages than are loaded, so an infinite scroll stops loading. A `fetchNextPage()` call while a page loads now fetches the following page under `blockExecutionDuringLoading: false`, as documented, instead of throwing ET401 in dev mode and returning `null` in production.

Query batch: unsubscribing from a run mid-flight now settles it. The aborted and queued items are recorded as `cancelled`, the status ends as `cancelled` (or `partial` / `error`), and `retryFailed()` resends them.
