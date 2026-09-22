---
'@ethlete/components': patch
---

Date/time/date-range pickers, select and cascader now flip their alignment on the same side before flipping vertically: their anchored fallback placements changed from `['top-start']` to `['bottom-end', 'top-start', 'top-end']`. A field near the right viewport edge now opens right-aligned under the field (`bottom-end`) instead of being cross-axis shifted, matching the fallback behaviour menus already use.
