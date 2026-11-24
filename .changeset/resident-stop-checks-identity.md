---
'@ethlete/cli': patch
---

`et design` stops a resident design process only when its start time still matches the record, so a stale or copied record never stops an unrelated process with the same pid.
