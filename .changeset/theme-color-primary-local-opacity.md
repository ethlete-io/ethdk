---
'@ethlete/components': patch
---

Avatar, badge, button, FAB and icon button no longer paint a full-strength primary fill while the
element is still unstyled, so a route swap cannot flash a solid primary disc.
