---
'@ethlete/query': patch
---

The `state$` of a legacy query no longer replays its previous `Success` to a subscriber that attaches right after `execute()`. Like v2, the subscriber now sees `Loading` first.
