---
'@ethlete/components': patch
---

`etTableStickyColumns` re-measures its pinned offsets after a render in which the rows changed, so a content-sized pinned column no longer leaves its neighbours at stale offsets.
