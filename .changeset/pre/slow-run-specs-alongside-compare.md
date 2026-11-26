---
'@ethlete/cli': patch
---

`design check` and the slow run of `design serve` run the app specs while the harness app starts and compares, instead of before it, so a part check finishes sooner with the same findings.
