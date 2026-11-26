---
'@ethlete/core': major
'@ethlete/components': patch
'@ethlete/query-devtools': patch
---

Breaking: `ResizeMoveEvent` `dx`/`dy` are now `totalDx`/`totalDy`, and `resizeEnded` emits the final `ResizeMoveEvent` instead of `void`.
