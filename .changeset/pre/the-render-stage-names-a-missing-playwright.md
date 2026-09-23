---
'@ethlete/cli': patch
'@ethlete/agent-rules': patch
---

`et design check --call` now reports `NO BROWSER` when neither the checkout nor the package
resolves `playwright`, instead of throwing the module loader's own error.
