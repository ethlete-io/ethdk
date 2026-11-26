---
'@ethlete/cli': patch
---

STALE-REPLACE no longer flags a replace whose regex is anchored with `^` or `$`; the rule searches the source, not the markup string.
