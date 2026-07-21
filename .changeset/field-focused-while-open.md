---
'@ethlete/components': patch
---

Form fields now keep their focused styling (accent border, lit label/affix) while a control's popup is open. Opening a date/time/date-range picker, select or cascader panel moves focus into the detached overlay, so `:focus-visible` no longer matched the field and it visibly dropped back to its resting look — controls now report an `expanded` state the field reflects as `[data-expanded]`.

Also fixes a flicker on the date-picker trigger button: clicking it while the field was focused briefly blurred the input (hiding the clear button and dropping the focused style) one frame before the picker opened. The trigger now prevents the mousedown default, matching the clear button, so focus stays on the field through the toggle.
