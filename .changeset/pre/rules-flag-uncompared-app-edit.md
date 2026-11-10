---
'@ethlete/cli': patch
---

`design check --rules --base <rev|range>` fails with `IMPLEMENTATION-UNCOMPARED` on an app file in the range that an implemented part reaches and that changed since its implemented record; the pre-push gate passes the pushed range.
