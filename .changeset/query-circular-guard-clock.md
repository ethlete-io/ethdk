---
'@ethlete/query': patch
---

Query: the circular-dependency guard (`ET800`) measures its 100 ms window with the same clock as its reset timer, so it no longer misfires under a faked clock.
