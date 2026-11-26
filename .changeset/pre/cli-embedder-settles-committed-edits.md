---
'@ethlete/cli': patch
---

`design check --part` settles a committed direct edit of each embedder it checks, as the embedder's own check does, so the result no longer depends on which part was checked first. An uncommitted edit stays `DIRECT-EDIT-PENDING`.
