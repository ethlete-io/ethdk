---
'@ethlete/query': patch
---

`withTokenRevocation` no longer sends a logout revocation queued behind another one when its tokens are live again by the time its turn comes.
