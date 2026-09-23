---
'@ethlete/query': minor
---

`createAuthGuard` stops waiting for a session restore after `restoreTimeoutMs` (default 10s) and gets `canMatchWith`/`canActivateWith` permission guards; the refresh query now retries at most 8 times by default instead of forever (`retryConfig.maxAttempts: 0` restores that).
