---
'@ethlete/core': major
---

`signalElementMutations` now returns `Signal<MutationRecord[]>` with every record of a batch, where it returned only the first record or `null`. Read `.at(-1)` for the old single record.
