---
'@ethlete/components': patch
'@ethlete/core': minor
---

Slider and rating now drag on `dragGestureFrom`, so a gesture the browser takes away reverts
instead of committing. `dragEnded` carries the release position.
