---
'@ethlete/components': patch
---

Cascader now resolves the current value's path again when `dataSource` changes, so a data source that arrives after the value labels it, and a swapped source no longer leaves the old tree's path on the trigger.
