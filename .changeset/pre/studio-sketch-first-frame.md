---
'ethlete-studio': patch
'@ethlete/cli': patch
---

A cold sketch shows its first frame sooner: Studio lists the sketches without the slow unchanged-state comparison first (`?unchanged=no`), asks for shots and diffs at once, then lists them in full.
