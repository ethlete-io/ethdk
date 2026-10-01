---
'@ethlete/components': major
---

Breaking: stop exporting the cascader tree helpers `toChildrenObservable`, `toSearchObservable`, `toPathObservable`, `nodesEqual` and `indexOfNode`. The node and data source types, `canHaveChildren` and `defaultCompareWith` stay public. `et update` runs a migration that marks the uses.
