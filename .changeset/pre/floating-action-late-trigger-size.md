---
'@ethlete/components': patch
---

An `etFloatingActionAnchor` no longer holds a trigger's floating size when the trigger was never measured in the flow, for example when it first renders with the anchor already scrolled past.
