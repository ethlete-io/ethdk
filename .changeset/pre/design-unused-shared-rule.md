---
'@ethlete/cli': patch
---

A rule in a sketch's `shared/` stylesheet counts as used when any variant of the sketch draws it, so `sketch ready` no longer fails a variant on `UNUSED` for a rule only another variant uses.
