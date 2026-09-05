---
'@ethlete/query': patch
---

Fix `[etInfinityQueryTrigger]` throwing NG0200 when it is a direct child of an `[etInfinityQuery]` template. The directive now creates its embedded view in `ngOnInit` instead of its constructor, so an `@if` guard is no longer required.
