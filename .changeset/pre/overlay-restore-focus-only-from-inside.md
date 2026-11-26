---
'@ethlete/core': patch
---

An overlay now restores focus to its opener only when focus is still inside it at teardown, so an outside press that focuses another control keeps focus there.
