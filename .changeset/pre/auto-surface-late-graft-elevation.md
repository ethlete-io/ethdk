---
'@ethlete/core': patch
---

Auto-surface: content that is grafted into an overlay pane after it first renders (e.g. a select option's `etAutoSurface` avatar) now re-resolves its elevation once it lands in the pane, instead of staying stuck one level too low.
