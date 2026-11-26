---
'@ethlete/cli': patch
---

`definePart` takes its state names from `states` only, so an `unreachable` list no longer narrows them and fails the type check.
