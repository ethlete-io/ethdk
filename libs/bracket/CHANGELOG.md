# @ethlete/bracket

## 1.0.0-next.3

### Minor Changes

- Add `createPlaceholderBracketSource(shape)`, an empty single or double elimination source for drawing a loading state.

## 1.0.0-next.2

### Minor Changes

- Breaking: an unrelated round or match now has a `{ type: 'none' }` relation instead of a hidden placeholder, `createBracketElement`/`createBracketElementPart` return the value itself, and `isHidden`, `BracketElementType` and `MutableBracketElement` are removed; `ET3414` names a missing card.

### Patch Changes

- Grid fixes: spanned elements respect section padding, a continue column after a folded third place no longer grows the grid, short connectors never run backwards, and a double elimination without lower rounds reports ET3405.
- `BracketMatchComponent` and `BracketRoundHeaderComponent` now type the optional `bracketRoundSwissGroup` input the bracket already passes, so a custom match or header component can read its round's swiss group without an `any`.
- Loser feeds no longer draw as connectors, a double elimination with undrawn later lower rounds no longer throws, odd-sized rounds connect every feeder, and a stacked row span keeps both blocks level.
- `migrateBracketPicks` resolves each round in one walk, and `resolveBracketSlot` no longer re-walks shared feeders below a cycle in malformed provenance.
- `createBracket` throws ET3403/ET3404 for duplicate round or match ids, and `standingPickStartOrder` drops a pick with a non-integer position.
- `drawSwissMan` no longer throws ET3408 on a swiss-with-elimination stage whose elimination rounds are not drawn yet.

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
