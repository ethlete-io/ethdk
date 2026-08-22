---
'@ethlete/components': patch
---

A split button now throws `ET2304`/`ET2305` on a duplicated action or trigger segment, and
keeps the first one registered rather than ending up with none.
