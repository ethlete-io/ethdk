# Bracket lib scan - open findings

Scan of `libs/bracket/src` from 2026-09-28. 2 Low, 3 Spec (verified 2026-09-28: 5 confirmed, 1 re-rated; the High and the four Mediums are fixed; the other Lows fixed or dropped 2026-09-28). A second pass covered what the
first pass skipped: `drawing/grid/double-elimination-stacked.ts`, `drawing/curve.ts`, `drawing/shapes.ts`,
`grid/prebuild/bracket-gap-master-column.ts`, `grid/prebuild/bracket-folded-third-place-section.ts` and the
`grid/core` element/part/column/section/sub-column factories and finalizer. Skipped: nothing. Specs read only to
check coverage.

## linked (relations, resolver, swiss)

- Low: a round or match that no relation reaches keeps `{ type: 'dummy' }` cast to the public relation union (`linked/bracket.ts:74,110`). Examples: a one-round bracket, a round with zero matches, an isolated match in the declared graph (`linked/match-relations.ts:474-540` has no else branch). A consumer that switches exhaustively over `relation.type`, or reads `relation.currentRound`, gets `undefined`. Decision (public union change): add a `'none'` member to both unions, or make `relation` nullable. M Re-rated from Medium: the cast is real, but no code in `libs/bracket` or `libs/components` reads a dummy relation in a way that breaks; only a hypothetical exhaustive consumer is hit.

## Spec gaps

- Spec: `drawMan` and `drawSwissMan` have no spec. The High finding above and the loser-feed connectors would both show in a spec that draws a fixture. M
- Spec: `createDoubleEliminationGrid` and `createDoubleEliminationStackedGrid` have no grid spec. Only single elimination and swiss have one. M
- Spec: `round-relations.spec.ts` has no double elimination case: none with a reverse final, none with a truncated lower bracket, none mirrored. M

## stacked double elimination and drawing helpers (second pass)

- Low: `BracketElementBase.isHidden` is written (`drawing/grid/core/bracket-grid.ts:172`) but nothing reads it, and the exported `BracketElementType` has no user (`core/bracket-element.ts:24,101-105`). `createBracketElementPart` and `createBracketElement` wrap their result in `{ elementPart }`/`{ element }`, and every caller unwraps it at once. Delete the dead members and return the value itself. S Decision: all three are exported from `@ethlete/bracket`, so removing them is a breaking API change.
