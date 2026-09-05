---
'@ethlete/query': patch
---

Auth: `withTracking` now honors `trackInternalEvents`. The provider's own executions - the auto-login, the proactive refresh, the revocation - raise their events again instead of being dropped.
