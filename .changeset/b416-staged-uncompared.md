---
'@ethlete/cli': patch
---

`et design check --rules --base` finds the app files of an implemented part faster: it walks a barrel's exports once and reaches only the parts whose records list a changed file.
