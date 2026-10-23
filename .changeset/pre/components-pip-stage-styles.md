---
'@ethlete/components': patch
---

`etPipStage` and `etPipCell` now load their own layout styles, so a custom PiP chrome shows its players instead of an empty window. The grid view state is exposed as the `et-stream-pip-chrome__stage--grid` class on the stage.
