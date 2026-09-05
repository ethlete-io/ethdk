---
'@ethlete/query': patch
---

Query stacks without `append` now run each feature once per response instead of twice, and no longer keep a shadow query per arg alive.
