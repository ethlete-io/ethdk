# Bracket lib scan - open findings

Scan of `libs/bracket/src` from 2026-09-28. 0 Low, 3 Spec (verified 2026-09-28: 5 confirmed, 1 re-rated; the High and the four Mediums are fixed; the other Lows fixed or dropped 2026-09-28; the last 2 Lows fixed 2026-09-29 in dd44b4dd9). A second pass covered what the
first pass skipped: `drawing/grid/double-elimination-stacked.ts`, `drawing/curve.ts`, `drawing/shapes.ts`,
`grid/prebuild/bracket-gap-master-column.ts`, `grid/prebuild/bracket-folded-third-place-section.ts` and the
`grid/core` element/part/column/section/sub-column factories and finalizer. Skipped: nothing. Specs read only to
check coverage.

## linked (relations, resolver, swiss)

- Low: a round or match that no relation reaches keeps `{ type: 'dummy' }` cast to the public relation union (`linked/bracket.ts:74,110`). Examples: a one-round bracket, a round with zero matches, an isolated match in the declared graph (`linked/match-relations.ts:474-540` has no else branch). A consumer that switches exhaustively over `relation.type`, or reads `relation.currentRound`, gets `undefined`. Decision (public union change): add a `'none'` member to both unions, or make `relation` nullable. M Re-rated from Medium: the cast is real, but no code in `libs/bracket` or `libs/components` reads a dummy relation in a way that breaks; only a hypothetical exhaustive consumer is hit. Done (dd44b4dd9): both unions have a `'none'` member carrying `currentRound` (and `currentMatch`); the cast is gone.

## Spec gaps

- Spec: `drawMan` has no spec (`drawSwissMan` has `draw-man-swiss.spec.ts`). A spec that draws a double elimination fixture would show the loser-feed connectors. M
- Spec: `double-elimination.spec.ts` covers only the ET3405 error of `createDoubleEliminationGrid`, not a drawn grid; `createDoubleEliminationStackedGrid` has no spec. M
- Spec: `round-relations.spec.ts` covers a truncated lower bracket and a reverse final, but no mirrored layout. S

## stacked double elimination and drawing helpers (second pass)

- Low: `BracketElementBase.isHidden` is written (`drawing/grid/core/bracket-grid.ts:172`) but nothing reads it, and the exported `BracketElementType` has no user (`core/bracket-element.ts:16,93,103`). `createBracketElementPart` and `createBracketElement` wrap their result in `{ elementPart }`/`{ element }`, and every caller unwraps it at once. Delete the dead members and return the value itself. S Decision: all three are exported from `@ethlete/bracket`, so removing them is a breaking API change. Done (dd44b4dd9): removed with `MutableBracketElement`; both factories return the value.
