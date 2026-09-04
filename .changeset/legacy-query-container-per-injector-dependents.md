---
'@ethlete/query': patch
---

Legacy query containers: each owning injector now tracks its own dependents, so a query shared by containers outside a component is no longer aborted when only one of them lets go.
