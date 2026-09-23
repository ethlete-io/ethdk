---
'@ethlete/timetrack': minor
---

Disconnecting a Google account now fails with `GoogleRevokeError` unless Google confirms the
revocation, and a refresh that lands after `invalidate()` no longer restores the access token.
