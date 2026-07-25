---
'@ethlete/query': minor
---

Cache entries are now kept for `keepUnusedFor` (5 minutes by default) after their last consumer was destroyed, instead of being discarded immediately. A query that mounts again within that window — a list page reached via browser back navigation, for instance — binds to the existing entry and renders its previous response right away while revalidating in the background (`executionState()` reports `{ type: 'loading', hasCachedResponse: true }`).

- Configurable per client (`createQueryClient({ keepUnusedFor })`) and per query creator; `0` restores the previous release-immediately behavior.
- Independent of `cache-control`, so it also applies to private/authenticated responses.
- Only entries holding a response are kept — in-flight and errored ones are still aborted immediately. At most 50 unused entries per client are retained, and retention is disabled on the server.
