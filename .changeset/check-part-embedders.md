---
'@ethlete/cli': patch
---

`design check --part X` also checks every part that embeds X, directly or through another part. X fails, and its ready mark is dropped, when one of them fails.
