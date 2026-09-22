---
'@ethlete/components': patch
---

`etCopyButton` no longer emits `copySuccess` after its host is destroyed, the notification
manager floors `maxVisible` at a whole `1`, and the standings overlapping-zones dev guard
re-checks whenever `zones` changes instead of only at first render.
