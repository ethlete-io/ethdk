---
'@ethlete/components': patch
---

Every form and menu selection control now emits `touch` when the user leaves it, so a bound signal form field's `touched()` and touched-gated errors follow blur.
