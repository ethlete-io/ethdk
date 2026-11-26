---
'@ethlete/query': patch
---

`migrate-to-query-v3` now points a consumer at the right `legacy*` wrapper when two projects declare a creator with the same name. Before, the last declaration in the workspace won and consumers of the other one were left on the v3 creator.
