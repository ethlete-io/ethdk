---
'@ethlete/cli': patch
---

Answer `/__design/system` with a 503 that names the missing `dist/libs/<lib>` build and the command that builds it, instead of leaving the request waiting.
