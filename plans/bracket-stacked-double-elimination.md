# Bracket - stacked mirrored double elimination

**Status: complete** (2026-08-01). Shipped as written, with three decisions phase 8 forced:

- **Block centring is by centre column, not by slot count.** `columnCount = maxLeft + 1 + maxRight` and
  `offset = maxLeft - blockLeft`, which reduces to the plan's `(slotCount - blockSlots) / 2` whenever a
  block's two sides are the same length and still aligns the two centres when an odd early round makes
  them differ.
- **The block-to-block connector runs beside the middle column, dashed.** The strip is not empty: the
  bracket reset and the losers block's own chain sit between the grand final and the losers champion. It
  steps out into the gutter (`columnGap / 2` past the column edge), runs vertically and steps back in -
  `gutterPath` in `drawing/line.ts`, taken when a merge's lower arm is directly below in the same column,
  and drawn with `continueLineDashArray` (the plan's own fallback) because a solid line that long past
  cards it has nothing to do with reads as a stray bracket edge.
- **The anchor is always on its block's vertical centre; a chain too long grows the block** (`bottomPadding`),
  rather than the plan's "shift the anchor up by the deficit". The shift put the anchor a few px off the
  halves feeding it, which turned both of those connectors into diagonals - the only diagonals anywhere
  in the drawing.
- **The centre chain carries one round header** (the anchor's), as specified - so the grand final and the
  bracket reset lose theirs. A header per chain round would sit on the line joining them. Documented.

Size: M - one new grid builder plus ~40 lines of shared drawing fixes.
Replaces the folded mirrored double elimination shipped in `568e9379c`, which the user judged
"weird looking". `doubleEliminationBracketLayout()` (left-to-right) is **not touched**.

For context: bracket layouts are plain value objects
(`bracket/bracket-layout.ts`) whose `createGrid` / `drawEdges` a factory in `bracket/layouts/`
supplies. That seam is what makes this cheap: a new builder in its own file, referenced only by
the mirrored factory. All paths below are relative to `libs/components/src/lib/bracket/`.

## The reference (a printyourbrackets.com "36 Team Double Elimination" sheet)

Two independent blocks, one above the other, each folded around its own centre:

- **Top block - winner's bracket.** Opening rounds start at both the left and the right edge and
  converge inward. In the middle: the winner's-bracket final and, directly **below** it in the
  same narrow middle strip, the championship game box and a "CHAMPION" line.
- **Bottom block - loser's bracket.** Same treatment: rounds run inward from both edges to a
  centred "Loser's Bracket Final" box in the middle of that block.
- **Nothing is drawn between the blocks.** A printed note says the loser's-bracket champion
  advances to the championship game; no line crosses the band.

## Current vs target

Today the mirrored double elimination folds the **whole canvas**: one column carries a winners
round over a losers round (three master-column sections: `round` / `gap` / `round`), the
outbound pass lays out an ordinary left-to-right DE at half the matches per round, and
`double-elimination.ts:426-508` replays that pass in reverse for the way back - so the finals
end up in a _run_ of middle columns and the losers bracket's fold, which closes further out than
the winners bracket's, has to cross underneath them. That crossing is the "weird" part. Target:
the two brackets stop sharing a fold. Each becomes its own mirrored block, stacked with the band
between them, both centred on the same middle column, each block's deciding rounds hanging
vertically below its centre round.

## Replacement strategy

`mirroredDoubleEliminationBracketLayout()` in `layouts/double-elimination-bracket-layout.ts`
keeps its exported name, `mode`, `dataLayout: MIRRORED`, `name` and `listSection`; only
`createGrid` changes, to `createStackedDoubleEliminationGrid` in the **new file**
`drawing/grid/double-elimination-stacked.ts`. That file must not import `double-elimination.ts`
or `double-elimination-utils.ts`, so a left-to-right consumer never retains it (and vice versa);
`grid/core/` and `grid/prebuild/` are fine - every layout retains those.

### Reused as-is

- **Mirrored halving** (`core/round.ts:90-210`): both blocks still need each even round split
  into `LEFT`/`RIGHT` halves sharing a `logicalIndex`. The data layer does not change at all.
- **Fold navigation in relations** (`linked/round-relations.ts:146-245` + the by-depth loop at
  `507-546`): `roundAtDepth` / `buildRoundsByDepth` make a right half's `previousRound` the
  round one depth out **on its own side**. Every connector drawn rides on these.
- **`drawing/draw-man.ts`**: the mirror curve inversion (line 118) and the fold-crossing line
  (71-85, a right-hand round drawing its own line into the unsplit centre round) - now per
  block instead of per canvas.
- **`prebuild/bracket-sub-column-relative-to-first-round.ts`** for every ordinary round column,
  and `prebuild/bracket-gap-master-column.ts` for the gaps (it clones the previous column's
  section heights, which is what keeps the two blocks aligned).

### Becomes dead and gets deleted (verify by grep first)

In `drawing/grid/double-elimination.ts`, once nothing passes it mirrored data: `isFoldedBack`
(48-50), `hasFoldedBackRounds` / the `allUpper*`/`allLower*` filtering (56-58), the
`outboundSubColumns` bookkeeping (154-158, 266), the `|| hasFoldedBackRounds` arms of both gap
guards (282, 416), and the whole folded-back pass (426-508) - about 100 lines. Everything else
there (ratio, `columnSplitFactor`, front padding, spans) is left-to-right machinery and stays, as
does `double-elimination-utils.ts`, which only that file imports.

## Grid construction

The positioning model (`drawing/grid/core/`): master columns run left to right; each has
**sections** stacked vertically whose heights are summed **per master column**
(`bracket-grid.ts:52-120`); each section holds sub-columns, each a vertical stack of elements;
`finalizeBracketGrid` emits one rendered column per (master column, section) from its **first**
sub-column. So the stacked layout is three sections - `winners` (round), `band` (gap), `losers`
(round) - with exactly **one** sub-column each and no spans at all (skip `setupElementSpans()`,
like `single-elimination.ts`). Blocks stay aligned because every master column's `winners`
section has the same height.

Per block (winners = `UPPER_BRACKET` rounds + `FINAL`/`REVERSE_FINAL`; losers =
`LOWER_BRACKET` rounds + `THIRD_PLACE`), from `bracketData.roundsByType`:

1. `lefts` = `mirrorRoundType === LEFT` by ascending `logicalIndex`; `rights` = the `RIGHT`
   halves by **descending** depth; `middles` = `mirrorRoundType === null` by ascending depth.
2. **Slot sequence** = `[...lefts, centre, ...rights]` - always `2 * lefts.length + 1` slots,
   so both blocks are odd and centre exactly. A block with no unsplit round at all (truncated,
   e.g. a winners bracket ending on a 2-match round with no final) gets an **empty** centre
   slot rather than an even sequence.
3. **The centre column is a vertical chain.** `foldDepth = max(depth of a LEFT half) + 1`; the
   anchor is the middle round at `foldDepth` - the round both halves converge on (the winners
   final; the losers bracket's own final round). Every _deeper_ round of the block - remaining
   middles, then `FINAL`, then `REVERSE_FINAL` (losers: remaining middles, then `THIRD_PLACE`) -
   is stacked **below** the anchor, separated by `rowRoundGap`. A middle _shallower_ than
   `foldDepth` (an odd early round that could not halve) is an anomaly: give it a left slot, as
   map order does today. The chain is what removes the old "run of middle columns" and the
   crossing - a complete losers bracket always ends `…,1,1`, so without it the inner half would
   have to reach across a second middle column.
4. **Column count** = `max(winnersSlots, losersSlots)`; each block is centred with
   `offset = (slotCount - blockSlots) / 2`, and slot `i` reads
   `sequence[i - offset] ?? null`. A `null` gets a placeholder sub-column holding one `colGap`
   element of the block's full height, so the section height (and therefore the block below)
   stays put; `finalizeBracketGrid` drops it (`bracket-finalizer.ts:114`).
5. Push `createBracketGapMasterColumn` between slots (never after the last). Master column
   width is `options.columnWidth`, except the centre slot which takes `finalColumnWidth`.

**Heights.** `headerBlock = roundHeaderHeight > 0 ? roundHeaderHeight + roundHeaderGap : 0`;
`content(B) = T.matchCount * matchHeight + (T.matchCount - 1) * rowGap`, `T` = the block's first
left round. `createRoundBracketSubColumnRelativeToFirstRound` reproduces that height _exactly_
for every other round (its `matchFactor` multiplies each match's parts), so a block's columns
match by construction. Build the centre chain's sub-column by hand:
`[header, headerGap, spacerTop, anchor, (rowRoundGap, match)…, spacerBottom]` with
`spacerTop = (content - anchorHeight) / 2`, so the anchor lands on the block's vertical centre
where both halves' connectors expect it. If `spacerBottom` goes negative, shift the anchor up by
the deficit; if it still does not fit, grow the block (`content = anchor + tail`) and pass the
surplus as a trailing `colGap` to every other column - add an optional `bottomPadding?: number`
to `CreateRoundBracketSubColumnRelativeToFirstRoundConfig` for that (additive; existing callers
unaffected). Pass `hasReverseFinal` through unchanged, so the bracket-reset card stays the one
drawn at `finalMatchHeight`.

Sanity numbers, 32-team fixture at default settings: winners = 9 slots, `content` 810; losers =
13 slots, `content` 390; canvas ≈ 4080 × (810 + 20 + 390 + headers). `continueElement` is
already `null` for mirrored data (`bracket-grid.ts:66`) - no continue column to build.

## Edges

`drawMan` is entirely relation- and rect-driven, so the per-block mirrored connectors need
**nothing new**. Two shared-code fixes are needed, both small and both improvements for the
existing mirrored layouts too:

1. **Inverted straight lines.** `linePath` (`drawing/line.ts`) always goes
   `from.inline.end → to.inline.start`. For a right-hand round in the `one-to-one` /
   `one-to-nothing` branch (`draw-man.ts:91-105`) the previous match sits to the _right_, so the
   line is drawn backwards across a card today. Add `inverted?: boolean` to `LineOptions`
   (mirroring `curve.ts`), passing `el.round.mirrorRoundType === RIGHT`. A complete losers
   bracket is full of equal-match-count consecutive rounds, so this is the norm there.
2. **Vertical connectors for a shared column.** The centre chain puts `previousMatch` directly
   above `currentMatch` in the same column, where both `linePath` and `curvePath` degenerate.
   In `drawMan`, when `|from.inline.center - to.inline.center| < 1`, emit
   `M cx from.block.end V to.block.start` instead (a `verticalPath` helper next to `linePath`).
   That one rule covers anchor → chain link, grand final → bracket reset, **and** the grand
   final's `two-to-one` (`draw-man.ts:107-152`), whose `previousUpperMatch` is the winners final
   above it and `previousLowerMatch` the losers chain tail below it - i.e. the block-to-block
   connector, straight up the empty middle strip. Keep the winner's `shortId` as the path class
   so journeys still light it. `THIRD_PLACE` is already skipped at line 60.

No other cross-block line exists: a match-level `two-to-one` whose feeders are _different_ rounds
is only ever created for the grand final (`round-relations.ts:271-287` is the sole
`createTwoToOneRelation` caller), so winners→losers drop-ins are not drawn today and will not turn
into long diagonals. `drawStackedDoubleEliminationEdges` is therefore only needed to dash the
cross-block vertical - start out reusing `drawEliminationEdges`.

## Layout-agnostic pieces - confirmed, no work

Journey highlight works off `p<n>` classes on cells and paths, never the grid (only risk: a
connector we stop drawing cannot be lit - the vertical rule keeps all of them). The rounds list
(`bracket-rounds-list.component.ts:144`) always builds left-to-right and reuses the DE layout's
`listSection`. `bracketNaturalWidth` / `bracketFitsWidth` call `layout.createGrid` and read
`grid.raw.grid.dimensions.width`, so they are right for the new builder for free.

## Phases (each one green on its own)

1. **Builder skeleton, winners block only.** New `double-elimination-stacked.ts`: slot sequence,
   placeholders, gap columns, one section; point the mirrored factory at it, ignore losers rounds.
   Green = `npx nx test components` + the mirrored DE story draws a folded winners bracket.
2. **Losers block + stacking.** Second and third sections (band = `rowRoundGap`), block centring,
   placeholder heights.
3. **Centre chains.** Anchor centring, chain tail, `bottomPadding` on
   `bracket-sub-column-relative-to-first-round.ts`, `finalColumnWidth` on the centre slot.
4. **Edges.** `linePath` inversion + `verticalPath` in `drawing/line.ts`, wired in `draw-man.ts`;
   update `drawing/draw-man.spec.ts`.
5. **Delete the folded-back path** from `double-elimination.ts` (list above) once
   `grep -rn "isFoldedBack\|foldedBack\|outboundSubColumns" libs/components` is empty outside
   `linked/` and `draw-man.ts`.
6. **Stories.** `stories/generate-bracket.ts` documents 4/8 participants only, because of the
   left-to-right ratio maths; the stacked builder has no ratio, so add a 32-participant case and
   use it **only** from `MirroredDoubleElimination` / `MirroredDoubleEliminationPartial` in
   `stories/bracket.stories.ts` - leave the left-to-right DE stories at 8.
7. **Specs.** In `bracket-layout.spec.ts` or a new `double-elimination-stacked.spec.ts`: slot
   count, both blocks centred on the same master column, `winners` section height identical in
   every column, losers section top = winners height + `rowRoundGap`, anchor on the block centre.
8. **Verify in Storybook** (`verify-in-storybook` skill): all four mirrored stories plus a
   truncated (`includeFinal: false`) and a third-place one - backwards lines, chains overflowing
   their block, the cross-block vertical.
9. **Docs.** `apps/docs/components/bracket.md`, "Double elimination folds too" (~425-440): "the
   middle is a run of columns" and "the losers bracket's way back crosses under the finals" both
   stop being true. Describe two stacked blocks, the centred chain, the single vertical. Story ids
   unchanged.
10. **Changeset.** Amend the pending `.changeset/bracket-mirrored-double-elimination.md` (minor,
    unreleased) rather than adding a second - no released behaviour changes. Note in
    (the completed bracket-tree-shaking plan) noted that the mirrored DE factory stops sharing the left-to-right
    builder, so it is no longer +12 B (expect ≈ +1.5 kB gz; left-to-right unchanged).

Finish with `npx nx lint components --fix` and `npx prettier --write` on everything touched.

## Open questions (with recommendations)

- **Block-to-block connector.** Recommendation: **draw it**, as the plain vertical the generic
  same-column rule produces - it is a real relation, it runs up an otherwise empty middle strip,
  and it keeps the losers champion's journey unbroken (the print reference has no line only
  because paper has no hover). If it reads heavy in phase 8, switch that one path to
  `settings.continueLineDashArray` from a `drawStackedDoubleEliminationEdges` of its own; do
  **not** drop it silently.
- **Champion box.** Recommendation: **no new cell type.** The grand final / bracket-reset card
  (`finalMatchHeight`, `finalColumnWidth`) is the terminus and already names the winner. A
  `champion` slot on `BracketComponents` plus a `champion` element type is an additive follow-up.
- **A `stackedBlockGap` setting.** Recommendation: reuse `rowRoundGap` (default 20px) - it is
  already "the gap between the winners and losers halves", which is what the band still is. Add
  a setting only if phase 8 shows the two blocks reading as one.
- **Layout `name`.** Recommendation: keep `'double-elimination-mirrored'` so devtools and the
  docs table stay consistent with the factory's exported name; `'double-elimination-stacked'` is
  the honest description if devtools should say what it draws.
