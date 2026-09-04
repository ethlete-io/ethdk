---
'@ethlete/query': patch
---

Multi-tab auth: a follower's delegated refresh no longer spends a second refresh token when the leader has already rotated the pair - the leader answers with the tokens it holds.
