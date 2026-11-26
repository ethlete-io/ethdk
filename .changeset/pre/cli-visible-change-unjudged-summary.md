---
'@ethlete/cli': patch
---

`et design check --visible-change` ends with every state it could not judge, so a pass that judged nothing no longer reads as a clean pass.
