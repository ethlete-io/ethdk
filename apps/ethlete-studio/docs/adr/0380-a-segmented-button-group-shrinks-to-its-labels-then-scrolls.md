---
status: accepted
open: B628
decided: 2026-11-19
source: doc-agent session 2026-11-19, evening, on the segmented group overflow (B628)
---

# A segmented button group shrinks to its labels, then scrolls

B628 gave `et-segmented-button-group` an `overflow` input with `'truncate'` as the default and `'scroll'` as an opt-in
that imports et-scrollable, which adds about 7.5 to 9.5 kB gzip to every group. Offered an opt-in add-on that alone
imports the scrollable, the human answered: "segmented buttons sollten scrollbar sein. das ist generell ja nur ein edge
case. in der regel scrollen die nicht". Asked what happens when the buttons do not fit: "in breite anpassen bis zur min
große mit padding aber ohne truncation danach scrollen", confirmed with "ok".

When the buttons do not fit, they shrink down to their minimum size, the full label plus padding, with no ellipsis.
If that is still too wide, the track scrolls sideways. This is the default; nothing has to be switched on. The
scrollable stays inside the group, and its bundle cost is accepted. `'truncate'` stays as an option for an app that
wants the ellipsis look.
