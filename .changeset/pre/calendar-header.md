---
'@ethlete/components': minor
---

Calendar: the header is replaceable, and now moves with the grid it names.

- `ng-template etCalendarHeader` projected into `et-calendar` renders instead of the default header,
  with the headless directive as its context; `et-calendar` also exposes it as `headless`.
- The label travels with the rows, the caret no longer swings with the label's width, grids crossfade
  rather than cut, and the picker's bottom sheet keeps one height.
- Fixed: the calendar warned NG0956 twice per navigation in dev.
