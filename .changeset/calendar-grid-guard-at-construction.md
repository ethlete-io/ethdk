---
'@ethlete/components': patch
---

Calendar: `ET2900` (an `[etCalendarGrid]` outside a calendar) now throws while the directive is constructed, on the template's stack, instead of once per grid after the first render.
