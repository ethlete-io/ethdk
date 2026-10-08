---
'@ethlete/components': patch
---

Fix the select search box ignoring `--et-select-panel-padding` set on the panel or an ancestor, which misaligned it against the options, by registering the panel tokens as inheriting.
