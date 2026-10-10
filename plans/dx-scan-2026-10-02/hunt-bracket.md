# hunt-bracket — bug hunt 2026-10-10

Scope: `libs/bracket` (data model, relations, slot resolver, swiss groups, grids, `drawMan`),
`libs/components/src/lib/{bracket,match,standings}`. Findings below are not in `bracket.md` (BR-01..12).

How it was checked: sources built by hand and run through `createBracket`, the grids and `drawMan` with `jiti`
(scripts outside the repo). Cases run: 4/8-participant single elimination with a third place (both layouts),
a 4-participant double elimination with a grand final reset, with a third place, a minimal 2-participant
double elimination, and a double elimination that has only a final.

Read and found clean: `resolveBracketSlot` (byes, loser of a feeder, the cycle guard), the double elimination
`isEliminated` rules for the final and the reset, the journey highlight's "out" rule (third place and reset
cases), `standingPickStartOrder`, `swapStandingRank`, `standingPickOutcome`, the standings zone lookup and
the duplicate row ids for tied rows, the swiss group fallback for byes and undrawn matches. Single elimination
with 1, 2, 3, 5, 6, 7 and 12 participants is already covered by `edge-cases.spec.ts`.

| ID    | Sev    | Kind     | Decision | Title                                                                                                  |
| ----- | ------ | -------- | -------- | ------------------------------------------------------------------------------------------------------ |
| HB-01 | Medium | bug      | no       | Mirrored single elimination puts the third place column between the final and the right half           |
| HB-02 | Low    | bug      | no       | Mirrored double elimination without a reset links the grand final to the first right-hand upper match  |
| HB-03 | Low    | bug      | no       | Single elimination marks a semi-final loser `isEliminated` while they still play the third place match |
| HB-04 | Low    | test-gap | no       | No spec for a third place round or a final without a reset in a mirrored layout                        |

## HB-01 Mirrored single elimination puts the third place column between the final and the right half

- Where: `libs/bracket/src/lib/core/round.ts:178,214` (right halves are added after every whole round, the
  third place included); `libs/bracket/src/lib/drawing/grid/single-elimination.ts:50` (one column per round in
  map order); `libs/bracket/src/lib/drawing/draw-man.ts:107` (straight line from the middle round to the right half).
- Problem: with `mirroredSingleEliminationBracketLayout()` and the default `thirdPlaceTopOffset: null`, the
  round map is `qf--half-1, sf--half-1, final, third-place, sf--half-2, qf--half-2`, so the grid draws the
  third place column between the final and the right semi-final. Measured with 8 participants
  (columnWidth 200, gap 50): `f1@500,85  t1@750,85  s2@1000,85`. The right semi-final draws its connector
  as a straight line from the final to itself (`draw-man.ts:107`), so the line runs through the third place
  card, which sits at the same `top`. The bracket is also one column and gap wider than it should be. A
  source with a third place round renders wrong in the mirrored layout unless the app also sets
  `thirdPlaceTopOffset`, and the guide (`apps/docs/components/bracket.md:343-349`) does not say that.
- Repro: source with rounds `qf` (4), `sf` (2), `final` (1), `third-place` (1);
  `createSingleEliminationGrid(createBracket(src, { layout: 'mirrored' }), { ...config, layout: 'mirrored' }, components)`.
- Fix: in `createRoundsMapBase`, insert the right halves before the trailing `third-place` round (so the map
  goes left halves, final, right halves, third place), or have `createSingleEliminationGrid` in a mirrored
  layout fold the third place under the final when `thirdPlaceTopOffset` is unset (the same as the stacked
  double elimination grid does). Add a mirrored case to the "folded third place" block in
  `single-elimination.spec.ts` that checks the third place column is not between the final and a right half.
- Breaking: no. Decision: no.
- Status: fixed

## HB-02 Mirrored double elimination without a reset links the grand final to the first right-hand upper match

- Where: `libs/bracket/src/lib/linked/round-relations.ts:227-238` (an unfolded round takes the next array
  entry as its next round), `:466` (the `isFinal` branch runs before the `isLastUpperRound` check that would
  skip a right half), `:275` (`handleFinalRound` builds `two-to-one` for any next round).
- Problem: in a mirrored double elimination with no `reverse-final` round, the upper rounds are
  `u1--half-1, u2, final, u1--half-2`. The final is not folded, so its next round is the array neighbour
  `u1--half-2`, and `handleFinalRound` makes the final `two-to-one` with `nextRound: u1--half-2`. Measured
  (4 participants, third place round, no reset): `fa: two-to-one > u1b`. The grand final's public
  `match.relation.nextMatch` names an opening-round match, `round.relation.type` is `two-to-one` where
  `two-to-nothing` is right, and `isBracketContinueMatch(final)` is `false`. The stacked grid does not draw
  from it, so nothing is visible today, but any consumer that reads `relation.nextMatch` or the relation type
  to find the last match gets a wrong answer. With a reset round it is correct, because the reset comes right
  after the final in the array.
- Fix: in `getNavigationContext`, for an unfolded round, drop a `RIGHT` neighbour as `nextUpperRound` (the
  same condition `isLastUpperRound` already tests), so `handleFinalRound` gets `null` and builds
  `two-to-nothing`. Add the case to `round-relations.spec.ts`.
- Breaking: no. Decision: no.
- Status: fixed

## HB-03 Single elimination marks a semi-final loser `isEliminated` while they still play the third place match

- Where: `libs/bracket/src/lib/core/match-participant.ts:100-103`.
- Problem: for `single-elimination`, every match is an elimination match and every loser is
  `isEliminated: true`. With a `third-place` round in the source, a semi-final loser still has a match to
  play, but their participant in the semi-final has `isEliminated: true` (measured: `s1` away `c` is
  eliminated, and `c` plays `t1`). The double elimination branch below it already uses the round type to
  answer "is this loss the end". `isEliminated` is public on `BracketMatchParticipant`, so a custom card that
  crosses out an eliminated side crosses out a player who is still in the tournament. The shipped journey
  highlight is not affected (it uses its own rule in `journey-highlight.ts:69-75`).
- Fix: in the single elimination branch, when the source has a `third-place` round and the match's round is
  the one directly before the final (the round whose losers feed the third place), set `isEliminationMatch`
  and `isEliminated` to `false`. If the source declares slots, a simpler test is "some match has a
  `match-outcome` slot with `role: 'loser'` naming this match". Add a spec in `match-participant.spec.ts`.
- Breaking: no (a behaviour fix to a value). Decision: no.
- Status: fixed

## HB-04 No spec for a third place round or a final without a reset in a mirrored layout

- Where: `libs/bracket/src/lib/drawing/grid/single-elimination.spec.ts:153-180` (third place cases are left to
  right only); `libs/bracket/src/lib/linked/round-relations.spec.ts`; `libs/bracket/src/lib/edge-cases.spec.ts`
  (single elimination without a third place only; one double elimination case).
- Problem: HB-01 and HB-02 both live in the mirrored path, and neither has a spec. The edge-case matrix runs
  every participant count through both layouts, but never with a third place round, and never a double
  elimination with and without a reset in the mirrored layout.
- Fix: extend the edge-case matrix with a third place round (single elimination, both layouts) and a double
  elimination with and without `reverse-final` (both layouts). Assert for each match that `nextMatch`, when
  set, names a match in a later round, and that no match card overlaps a connector's straight segment.
- Breaking: no. Decision: no.
- Status: fixed
