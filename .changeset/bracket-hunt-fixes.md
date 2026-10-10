---
'@ethlete/bracket': patch
---

A mirrored single elimination grid folds the third place under the final when `thirdPlaceTopOffset` is unset (one `rowGap` below the final's card), instead of giving it a column between the final and the right half. A mirrored double elimination without a reset ends at the grand final (`two-to-nothing`, no `nextMatch`) instead of linking it to an opening-round match. A single elimination semi-final loser is no longer `isEliminated` when a third place match follows.
