---
'@ethlete/components': patch
---

Form controls implement signal forms' `focus()`, so `field().focusBoundControl()` reaches the control inside a wrapper like `<et-input>` instead of doing nothing.
