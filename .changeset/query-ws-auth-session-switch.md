---
'@ethlete/query': minor
---

A web socket client with an `authProvider` now follows user switches and logouts fully. It reconnects with the new token after `setTokens()` and after another tab hands over a pair for a different user. On logout every `joinRoom()` signal reads `null`, the rooms are joined again after the next login, and the client reconnects as anonymous instead of staying down. Emits still buffered from the ended session are dropped instead of reaching the next user's connection. A client without `authProvider` is unaffected.

The bearer auth provider gains `sessionId()`, which increments whenever a session starts. A login, `setTokens()` or multi-tab pair for a different user (another `sub` claim) clears the previous user's secure cache entries like a logout does. A login as the same user keeps them.
