---
'@ethlete/components': patch
---

Form field: trigger-based controls (select, date pickers) keep their focused frame after a pointer-driven commit, so the frame and the clear affordance no longer disagree about whether the field is focused.
