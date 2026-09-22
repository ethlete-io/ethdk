---
'@ethlete/query': patch
---

Query forms: `skipResets` now applies only to the fields that write changes, so a pending debounced edit to another field still resets its dependents.
