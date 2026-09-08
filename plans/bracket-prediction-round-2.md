# Prediction brackets, round 2

Written 2026-09-08, after a comparison against the consumer that shipped the feature.

The first plan is `bracket-prediction-support.md`. All seven of its items landed. This one records
what the consumer needed **beyond** them, and is the review checklist for the four changes now in
flight.

## The reference implementation

`/home/tom/dev/fifagg/fifagg-frontend`, branch `feature/20260819_bracket-challenge`, directory
`libs/domain/public/competition/src/lib/views/bracket-challenge/`. It copied this repo's bracket
model at `@ethlete/components@1.0.0-next.59` into a local `bracket/` folder, because the app is
three Angular majors behind. It then went further in six places. Those six are the gap.

The copy is 1000 lines against this repo's 6500: it drops the master column, section and sub column
split, so a column is a round. Read it for its ideas, never for its structure.

## What the first plan already delivered

| Item                    | Where it lives now                                                                                      |
| ----------------------- | ------------------------------------------------------------------------------------------------------- |
| 1 Slot provenance       | `libs/bracket/src/lib/integrations/base.ts`                                                             |
| 2 Declared feeder graph | `libs/bracket/src/lib/linked/match-relations.ts`                                                        |
| 3 Slot resolver         | `libs/bracket/src/lib/linked/resolve-bracket-slot.ts`                                                   |
| 4 Four side states      | `libs/components/src/lib/match/match.types.ts`                                                          |
| 5 Pick card             | `libs/components/src/lib/bracket/bracket-pick-card.component.ts`                                        |
| 6 Squeeze and focus     | `rowSpanRoundId`, `focusRoundId`, the clamp in `prebuild/bracket-sub-column-relative-to-first-round.ts` |
| 7 Framework-free core   | `@ethlete/bracket`, no dependencies                                                                     |

## Gap 1 — the drawing does not animate

The component writes `top` and `left` per cell, so a change of `rowSpanRoundId` relayouts and the
cells jump. The consumer moves every cell with `transform: translate(x, y)` and transitions it.

The connectors are worse. `drawEdges` builds one string of SVG, which the component pipes through
`bypassSecurityTrustHtml` into `<svg [innerHTML]>`. A redraw therefore re-parses every path and the
lines snap to their new place. The consumer returns the connectors as data and sets both `[attr.d]`
and `[style.d]`, because a transition never animates an attribute.

The trap: a browser interpolates the CSS `d` property only between two paths of the same shape. The
consumer's elbow always emits the same six commands, and gives both arcs a radius of `0` for a
straight line rather than emitting `M … H …`.

Without this pair, item 6 of the first plan works but snaps.

## Gap 2 — four geometry settings

- `thirdPlaceTopOffset` — folds the third-place match into the final's column, that many px below it.
- `finalRoundHeaderGap` — extra room over the final's card, given to the final's column alone.
- `alignRoundHeaders: 'start' | 'center'` — a centred header names a one-round panel.
- `focusInset` — room kept to the inline start of `focusRoundId`, for a chevron or a badge that
  straddles a card's edge.

## Gap 3 — the pick card is thinner than a real one

56 lines against the consumer's 289. Missing: a selection mark that is not colour alone; a note line
drawn outside the card's box so the two rows keep their height; an `invalid` outline; a results mode
that dims the loser, distinct from `locked` and `disabled`; an emblem fallback; an unresolvable text
that can change once no earlier round is left to predict.

## Gap 4 — the model cannot word a slot

`BracketSlotSource` carries `standingId` and `rank`, but no seed number and no readable standing
name, so "seed 3" and "Group A position 2" cannot be written from it. There is no
`describeBracketSlot` and no labels entry, so the card falls back to one generic string.

Decided: no `'undescribed'` source kind. A slot nothing is known about is already `source: null`, and
a new union member breaks every exhaustive switch for no gain.

## Gap 5 — the resolver has one policy, an app needs two

1. **Does a filled slot beat a prediction?** The resolver ignores the real participant for
   `match-outcome` and `standing-rank`. The consumer needs the real one while the round is open,
   because that is the pairing the pick was made against, and the prediction once it is locked,
   because the record of the guess is the point. The answer varies per match, so the seam is a
   predicate rather than a flag.
2. **A feeder with one side still unknown.** The resolver returns `null` as soon as either side is
   `null`. The consumer keeps the pick while one side is open, since nothing contradicts it yet.

## Gap 6 — pick migration

A pick names a participant, not a slot. Change a group order and a different participant plays the
knockout match, so the pick must follow its participant, and a pick nothing can honour must be
reported rather than silently kept. About 80 lines, pure, six rules, easy to get subtly wrong. The
consumer's `pickMigration` is the specification.

## Group picks — absent from the SDK

`et-standings` draws a table and supports zones, but it is read-only. Every part of a group
prediction was app code: the reorder by drag and by arrow keys, the cut after the last advancing
position, the seeded start order, the exact / right-side / wrong scoring, the drop line and the drag
preview. A group order also feeds a `standing-rank` slot, so the two features are one feature.

The consumer's `standingPickOutcome` refuses `exact` below the advancing line, because its backend
stores only the advancing positions. That is an artefact of that API, not a rule, and the library
must not copy it.

## What stays in the app

The tabs, the save bar, the guest picks in session storage, the swap-teams overlay, the API view
adapters, and the chevron rail.

## Two findings outside the bracket

- The SDK has no countdown helper anywhere. The consumer wrote
  `injectBracketChallengeTimeLeft`: a signal recounted once a second, days-hours-minutes until under
  a day, then down to seconds. `libs/core` is the natural home.
- `et-picture` reserves no space until the image decodes. Its `aspect-*` class sits on the `<img>`,
  which has no size until the file arrives, and behind an `@if` that costs two layout jumps rather
  than one. The box belongs around the `et-picture`, not on it.
