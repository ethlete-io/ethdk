---
'@ethlete/query': patch
---

Persistence: secure responses are held back until the session is known and purged when a tab starts without one, so a session that ended without a logout no longer hydrates the previous user's data.
