---
'@ethlete/core': patch
---

`injectAnimatedBlockSize`: keep the `resizingClass` applied when a resize animation is interrupted by a new one, so overlay panels (select, cascader, date-picker, menu) no longer flash a scrollbar during rapid successive content changes such as async search typing.
