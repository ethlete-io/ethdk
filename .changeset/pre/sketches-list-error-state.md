---
'ethlete-studio': patch
'@ethlete/cli': patch
---

`design check` no longer reads the state names in a part's `dataStates` map as Tailwind classes (CLASS-UNDEFINED). The Studio open-points line of a missing data state names the state the map gives, e.g. `empty (no-sketches)`.
