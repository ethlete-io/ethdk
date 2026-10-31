---
'@ethlete/cli': minor
---

New `OPTION-VALUE-MISSING` check: each value of a string-literal mock option must appear in a state on the part's grid. Leave a value out with `omits: [{ option, value, reason }]` in `definePart`.
