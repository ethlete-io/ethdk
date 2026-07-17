---
'@ethlete/components': patch
---

Overlay sheets: the filler strip that hides the sheet's spring-overshoot now paints from the surface token (`--et-surface-background-solid`) instead of `inherit`. Sheets whose background is painted on nested content (e.g. a date picker) left the container host transparent, so during the enter-spring overshoot the momentary gap at the docked edge revealed the page background. It now paints the matching surface color.
