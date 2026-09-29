# Bracket lib scan - open findings

Scan of `libs/bracket/src` from 2026-09-28. 0 Low, 3 Spec (verified 2026-09-28: 5 confirmed, 1 re-rated; the High and the four Mediums are fixed; the other Lows fixed or dropped 2026-09-28; the last 2 Lows fixed 2026-09-29 in dd44b4dd9). A second pass covered what the
first pass skipped: `drawing/grid/double-elimination-stacked.ts`, `drawing/curve.ts`, `drawing/shapes.ts`,
`grid/prebuild/bracket-gap-master-column.ts`, `grid/prebuild/bracket-folded-third-place-section.ts` and the
`grid/core` element/part/column/section/sub-column factories and finalizer. Skipped: nothing. Specs read only to
check coverage.

## Spec gaps

- Spec: `drawMan` has no spec (`drawSwissMan` has `draw-man-swiss.spec.ts`). A spec that draws a double elimination fixture would show the loser-feed connectors. M
- Spec: `double-elimination.spec.ts` covers only the ET3405 error of `createDoubleEliminationGrid`, not a drawn grid; `createDoubleEliminationStackedGrid` has no spec. M
- Spec: `round-relations.spec.ts` covers a truncated lower bracket and a reverse final, but no mirrored layout. S
