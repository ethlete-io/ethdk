---
'@ethlete/components': major
---

Table: row expansion is now the opt-in `etTableRowExpansion` (`TABLE_ROW_EXPANSION_IMPORTS`), taking 2,026 B gz off a plain table. `expandableRow` and `expandedKeys` move onto the feature, and expanded rows serialize under `state().features.expansion` (`v: 3`).
