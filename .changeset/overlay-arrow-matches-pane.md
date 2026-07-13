---
'@ethlete/components': patch
---

Overlay: the anchored arrow now matches the pane it points at — it paints the
pane's actual background and mirrors its border (including no border when the
pane has none), instead of re-deriving a color from surface tokens that could
diverge from a custom `panelClass` or themed pane.
