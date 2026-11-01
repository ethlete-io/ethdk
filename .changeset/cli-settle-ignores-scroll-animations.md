---
'@ethlete/cli': patch
---

`design compare` and `design actions` no longer wait out their settle timeout on a scroll-driven animation (an open SDK menu's scroll fade), which made `design actions` and `design ready` look hung.
