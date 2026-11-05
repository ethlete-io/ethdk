---
'@ethlete/cli': patch
---

`et design task` now counts every non-spec app file that imports the part, directly or through other importers, as wiring, plus the part's own spec. What a spec imports no longer becomes wiring.
