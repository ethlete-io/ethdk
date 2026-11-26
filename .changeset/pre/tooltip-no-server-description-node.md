---
'@ethlete/components': patch
---

`etTooltip` no longer creates its hidden description node during server rendering, so hydration leaves no duplicate ids in the body.
