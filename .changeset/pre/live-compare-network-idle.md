---
'@ethlete/cli': patch
---

`design compare --live` waits for the app page's requests to settle before it shoots, so canvas frames that load late are in the picture.
