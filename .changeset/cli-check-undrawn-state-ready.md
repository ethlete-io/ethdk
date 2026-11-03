---
'@ethlete/cli': patch
---

`design ready` refuses a part with a state that does not draw, and `design check` names it as a part ready refuses. The `RENDER` line of an undrawn state now carries the error that stopped it.
