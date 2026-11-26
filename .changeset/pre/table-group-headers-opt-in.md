---
'@ethlete/components': major
---

Table: grouped column headers are now the opt-in `etTableGroupHeaders` (`TABLE_GROUP_HEADERS_IMPORTS`), taking 440 B gz off a plain table. A column's `group` has no effect without it, and `hasGroups()` / `headerGroups()` move from the table onto the feature.
