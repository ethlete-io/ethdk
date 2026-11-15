---
'@ethlete/cli': patch
---

`design actions --live` counts the pressed control's own `aria-current` in its outcome, so a nav button that is already current on one page no longer reports cross-page drift.
