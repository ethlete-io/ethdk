---
'@ethlete/cli': patch
---

A design frame keeps its loaded `@font-face` rules when it switches to another state, so a switch draws the state once instead of up to three times.
