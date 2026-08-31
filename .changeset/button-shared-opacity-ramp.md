---
'@ethlete/components': patch
---

Button, FAB and icon button now compute their variant hover/focus/active opacity escalation from one shared token recipe (`--et-button-variant-opacity-{hover,focus,active}-delta`) instead of three hand-duplicated ramps.
