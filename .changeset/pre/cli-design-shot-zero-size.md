---
"@ethlete/cli": patch
---

`GET /__design/shot` answers 422 with the reason when the part root has zero size or the screenshot fails, instead of waiting out the 30 s Playwright timeout.
