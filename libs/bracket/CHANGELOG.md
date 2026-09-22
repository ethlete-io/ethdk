# @ethlete/bracket

## 1.0.0-next.1

### Minor Changes

- Bracket: a relayout now animates, with new `thirdPlaceTopOffset`, `finalRoundHeaderGap`, `alignRoundHeaders` and `focusInset` settings and a `--et-bracket-move-duration` token; `BracketLayout.drawEdges` now returns a `BracketDrawing` instead of an SVG string.
- Bracket pick card: per-side pick marks, a note line, a `readonly` results mode and slot wording from
  `provideBracketLabels`. **Breaking:** the `unresolvableLabel` and `unavailableLabel` inputs are gone.
- Bracket: add `migrateBracketPicks()` so a pick follows its participant when a pairing changes, plus `realParticipantOutranksPick` and `keepPickWhileFeederSideIsOpen` on `resolveBracketSlot()`.
- Bracket: add a framework-free prediction graph and resolver, prediction-aware slot states, an operable pick card, and focused round layout controls.
- Standings: add `<et-standings-pick>`, a group table a viewer reorders by drag or arrow keys, plus `standingPickOutcome` and `standingPickStartOrder` in `@ethlete/bracket`.

### Patch Changes

- Bracket: a stage draws while a later round is empty, a mirrored fold converges for a field that is not a power of two, and swiss rounds past a full table group instead of throwing.
