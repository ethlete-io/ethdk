---
'@ethlete/agent-rules': patch
---

Fix the `codex-runs` and `e2e-progress` mods being refused at load: `atom` keys are now string literals and `$.fs` is no longer passed as a value.
