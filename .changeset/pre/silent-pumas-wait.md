---
'@ethlete/query': patch
---

Fix secure queries intermittently throwing `tokensNotAvailableInsideAuthAndExec` when the auth query completes on a different reactive timeline than the access token is set on (e.g. a cross-client / secure login query whose token is populated by a separate effect). The secure execute factory now waits for the access token to be available before running the request instead of assuming it is set the moment the auth query has a response, and recovers automatically once the token arrives.
