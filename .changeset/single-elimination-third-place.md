---
'@ethlete/cdk': minor
---

New bracket: support a third place match in single elimination. The final stays the last match of the bracket, so the continue element is drawn again. A mirrored layout folds the third place match below the final, and the new `thirdPlaceTopOffset` input (also in `provideNewBracketConfig`) folds it below the final in a left to right layout. Semi final losers are no longer marked `isEliminated` when a third place match follows.
