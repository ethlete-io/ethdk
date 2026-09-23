---
'@ethlete/components': patch
---

Button: a bound `pressed="false"` now announces `aria-pressed="false"`, so an unpressed toggle reads as a toggle; leave `pressed` unset on a plain action button.
