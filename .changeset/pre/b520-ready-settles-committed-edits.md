---
'@ethlete/cli': patch
---

`design ready` settles a committed direct edit of a merged part into `merged.json` before it checks the part, so it no longer refuses with "changed outside a sketch" once HEAD holds the edit. An uncommitted edit still refuses.
