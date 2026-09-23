---
'@ethlete/query': patch
---

Legacy `QueryForm`: values track control writes without `observe()`, a commit no longer cancels an in-flight route change, and a committed value keeps its type through the form's own URL write.
