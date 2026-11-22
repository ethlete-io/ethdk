---
'@ethlete/cli': patch
---

Design compare: a forced element that never appears now fails once the page DOM has been quiet for 1 s, instead of idling the full 15 s draw timeout.
