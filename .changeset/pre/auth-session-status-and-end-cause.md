---
'@ethlete/query': minor
---

The bearer auth provider now publishes `sessionStatus()` (`unknown | restoring | authenticated | anonymous`) and `sessionEndCause()`, and `logout()` takes a cause. Only the most recent token-issuing execution applies its tokens and writes `executionState()`, across registry keys.
