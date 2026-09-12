# @ethlete/bracket

## 1.0.0-next.1

### Minor Changes

- [`8b90cd4`](https://github.com/ethlete-io/ethdk/commit/8b90cd46c77f2a0d34c44d65eebfcf6adbf27675) Bracket: a relayout now animates, with new `thirdPlaceTopOffset`, `finalRoundHeaderGap`, `alignRoundHeaders` and `focusInset` settings and a `--et-bracket-move-duration` token; `BracketLayout.drawEdges` now returns a `BracketDrawing` instead of an SVG string.
- [`59adb91`](https://github.com/ethlete-io/ethdk/commit/59adb91fb2d1ccc8ea01dad2b2cb0142d9fcba43) Bracket pick card: per-side pick marks, a note line, a `readonly` results mode and slot wording from
  `provideBracketLabels`. **Breaking:** the `unresolvableLabel` and `unavailableLabel` inputs are gone.
- [`40f6464`](https://github.com/ethlete-io/ethdk/commit/40f64642d9d2aae79b62135eb3a80536dc1ef349) Bracket: add `migrateBracketPicks()` so a pick follows its participant when a pairing changes, plus `realParticipantOutranksPick` and `keepPickWhileFeederSideIsOpen` on `resolveBracketSlot()`.
- [`c6cd941`](https://github.com/ethlete-io/ethdk/commit/c6cd94105ccb2f6b7de40a18a970d755a139e406) Bracket: add a framework-free prediction graph and resolver, prediction-aware slot states, an operable pick card, and focused round layout controls.
- [`eb7135a`](https://github.com/ethlete-io/ethdk/commit/eb7135aa7840e7d4d46cfe696bc0c3fcb4f265e9) Standings: add `<et-standings-pick>`, a group table a viewer reorders by drag or arrow keys, plus `standingPickOutcome` and `standingPickStartOrder` in `@ethlete/bracket`.

### Patch Changes

- [`4033412`](https://github.com/ethlete-io/ethdk/commit/40334123b995c4d000fc9c92bab4bc936e688af2) Bracket: a stage draws while a later round is empty, a mirrored fold converges for a field that is not a power of two, and swiss rounds past a full table group instead of throwing.
