---
'@ethlete/cli': patch
---

`design check` counts each failed action of a part it left without a check record as an `ACTION-FAILED` finding, so the part no longer reads as clean while its record is missing.
