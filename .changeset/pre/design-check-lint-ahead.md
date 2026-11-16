---
'@ethlete/cli': patch
---

`design check --part` starts eslint while the part is still being checked and resolves every prettier style in one process, so a part check is about half a second faster.
