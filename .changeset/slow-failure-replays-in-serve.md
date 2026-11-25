---
'@ethlete/cli': patch
---

The design server's slow runner replays a failing part's stored result while its inputs stay unchanged, instead of running its slow checks (and their vitest forks) again on every poll. `design check --slow` still reruns a failure.
