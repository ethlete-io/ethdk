---
'@ethlete/cli': minor
'@ethlete/agent-rules': patch
---

`ng()` and `ngStates()` take `fields`: each entry becomes a signal form field with a value, errors and a touched state, bound as `[formField]="fields.<name>"`.
