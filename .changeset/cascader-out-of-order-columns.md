---
'@ethlete/components': patch
---

Fix the cascader dropping already-loaded columns when a level resolves out of order,
swallowing Space on a focused node while a search input is registered, and keeping the
previous value's breadcrumb after the value is replaced from outside.
