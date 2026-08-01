---
'@ethlete/query': minor
---

The auth provider's leader election - the thing that keeps every tab but one from proactively refreshing the session's tokens - now runs on the [Web Locks API](https://ethlete-sdk-docs.web.app/query/auth#multi-tab-sync), the same primitive the query client elects its polling tabs with. It replaces a one-second heartbeat written to `localStorage` with a lock the platform releases when a tab closes, crashes or navigates away.

- No timers and no `localStorage` writes while the app is idle, and no window in which two tabs both believe they are the leader: requests are granted FIFO, so the longest-waiting tab takes over.
- `isLeader` starts `false` and flips on the next microtask, because the lock is granted asynchronously. Nothing observes the gap - the proactive refresh it gates runs off a timer.
- The instance count `withTracking` reports is recounted when a tab announces itself, says goodbye or takes over, rather than every second. A tab that crashes without holding the lock is counted until the next of those happens.
- Without Web Locks the tab elects itself, which is the single-tab behavior it already fell back to.

Also fixes `withTracking` throwing a `DataCloneError` out of the effect that emitted the event: a non-leader tab forwards its events to the leader over a `BroadcastChannel`, and payloads carrying a query snapshot cannot be cloned. Those now fire in the emitting tab, with a dev-mode warning.
