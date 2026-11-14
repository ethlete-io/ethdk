---
'@ethlete/components': patch
---

A press on the trigger of an open toggletip no longer swallows the trigger's click: the click closes the toggletip and still reaches the trigger's own `(click)` handler. `OverlayConfig.closeOnOutsidePointer` accepts `'except-origin'`.
