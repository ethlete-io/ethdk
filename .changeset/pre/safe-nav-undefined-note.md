---
'@ethlete/agent-rules': patch
---

The `sdk-update` skill warns that after Angular 22, `a?.b` gives `undefined`, not `null`, which breaks pipes that treat the two differently.
