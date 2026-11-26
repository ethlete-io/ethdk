---
'@ethlete/cli': patch
---

A design command's own server now moves to the next free port when another process takes its probed port first, instead of failing with "port in use".
