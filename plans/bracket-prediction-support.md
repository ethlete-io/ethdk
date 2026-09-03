# Prediction brackets in the bracket library

Written 2026-09-02, from a consumer that had to rebuild the bracket model by hand.

A **prediction bracket** is a bracket the viewer fills in. The competition may not have started.
Most sides are empty, and the viewer chooses who advances. Later rounds become choosable only
because the viewer already chose the earlier ones.

`et-bracket` draws a bracket that **is**. It cannot draw a bracket that **might be**. The gap is
not the renderer; the renderer is good. The gap is the data model and three missing seams. This
plan names them.

Every item is a change inside this repository. Nothing here needs a consumer's types.

---

## Why a consumer copies the library today

Two reasons, and only the second one is our problem.

**The version wall.** `@ethlete/components` pins `@angular/core` exactly. A consumer three major
versions behind cannot install it, so it copies the model and keeps the type names, hoping for a
later swap. That is a packaging question, addressed in the last section.

**The model does not fit.** Even on the right Angular version, a prediction bracket does not fit
`BracketDataSource`. A match side is `NormalizedMatchParticipant | null`, and `null` means "we do
not know yet". A prediction app needs to know **why** it does not know, because the answer decides
what the cell draws and whether the cell is a control at all.

---

## 1 A slot carries its provenance

Today a side is a participant or nothing. Give it a source.

```ts
export type BracketSlotSourceKind =
  | 'match-outcome'   // the winner or the loser of another match
  | 'standing-rank'   // a position in a group or league table
  | 'seed'            // a seeding position
  | 'swiss-bucket'    // drawn once the round is scheduled
  | 'bye'             // nobody plays; the other side advances
  | 'external';       // another competition fills it

export type BracketSlotSource = {
  kind: BracketSlotSourceKind;
  /** For `match-outcome`: whether the winner or the loser arrives here. */
  role: 'winner' | 'loser' | null;
  /** For `match-outcome`: the match this side comes out of. */
  matchId: string | null;
  /** For `standing-rank`: the table, and the position in it. */
  standingId: string | null;
  rank: number | null;
  /** The competition's own wording, when it has one. Never invented by the library. */
  label: string | null;
};

export type BracketMatchSlot = {
  participant: NormalizedMatchParticipant | null;
  source: BracketSlotSource | null;
};
```

Then `BracketMatchSource.home` and `.away` become `BracketMatchSlot` rather than a participant.

This one change carries most of the value. It lets the library, not the consumer, answer three
questions a card needs:

- Is this side decided?
- Could a prediction decide it?
- If not, what does the cell say instead?

Two source kinds are never predictable — `bye` and `external` — and one is not predictable until
the draw — `swiss-bucket`. A bye must produce **no control at all**, and the other side of that
match counts as advanced. Encode that in the library, so no consumer re-derives it.

**Migration.** Keep the participant field where it is and add `source` beside it, so an existing
data source stays valid and a `null` side simply has no source.

---

## 2 The graph is declared, never inferred

`createBracket` currently derives which match feeds which from a match's position in its round.
That holds for a clean power-of-two bracket and breaks on every other one: a bracket with byes, a
lower bracket, a bracket whose first round is partly pre-filled.

Take the feeders as a function:

```ts
export type CreateBracketOptions<TMatchData> = {
  /** The matches feeding this one, upper arm first. Empty for a first-round match. */
  previousMatchIds: (match: BracketMatchSource<TMatchData>) => string[];
};
```

With item 1 in place the library can supply the default itself — read `source.matchId` off both
slots — so a consumer passes the function only for a graph the slots do not describe.

This also fixes a real bug in the relation builder rather than adding a feature.

---

## 3 A resolver: who do the viewer's own picks put here

This is the seam that makes a prediction bracket possible, and no consumer should write it twice.
It is a graph walk with a cycle guard:

```ts
export type BracketPickSet = {
  /** The participant the viewer picked to win a match. */
  matchWinner: (matchId: string) => string | null;
  /** The participant the viewer put on a table position. */
  standingRank: (options: { standingId: string; rank: number }) => string | null;
};

/**
 * Who the viewer's own picks put on a slot, or `null` when the picks do not reach it yet.
 *
 * Recursive: a semi-final side is the winner the viewer picked in a quarter-final, whose own
 * sides may in turn be table positions the viewer predicted.
 */
export const resolveBracketSlot: (options: {
  bracket: Bracket<unknown, unknown>;
  picks: BracketPickSet;
  matchId: string;
  side: MatchParticipantSide;
}) => string | null;
```

Three details that are easy to get wrong and belong in the library, not in each app:

- **The loser case.** The loser of a match is whoever the viewer did **not** pick in it. That
  follows only once both of its sides resolve. Return `null` until they do.
- **The cycle guard.** A malformed graph must return `null`, never recurse forever. Track visited
  `matchId:side` pairs.
- **Reality never overwrites a prediction.** If a match ends against the prediction, the later
  pick stays as it was and simply scores wrong. The resolver must not repair the chain — that is
  the consumer's scoring rule to apply, not the library's to guess.

---

## 4 `NormalizedMatch` needs an unresolvable side

A prediction bracket has a fourth cell state the model cannot express. Per side:

| State | Meaning |
| ----- | ------- |
| occupied | somebody really stands here |
| predicted | the viewer's own earlier pick puts somebody here |
| unresolvable | a pick could name somebody, and the viewer has not made it |
| unavailable | nothing a pick can change: a bye, an external slot, an undrawn bucket |

`home: null` collapses the last three into one. A card then cannot tell "predict the earlier
round first" from "this slot belongs to another competition", and those two want different words.

Add the state beside the participant rather than inside it:

```ts
export type NormalizedMatchSideState = 'occupied' | 'predicted' | 'unresolvable' | 'unavailable';

export type NormalizedMatch = {
  // … as today …
  homeState: NormalizedMatchSideState;
  awayState: NormalizedMatchSideState;
};
```

Default both to `occupied` when a participant is present and `unavailable` when not, so an
existing normalizer keeps working untouched.

---

## 5 A cell that is a control

`et-match-card` draws a match. A prediction bracket needs a card the viewer **operates**. Ship it
as a sibling, not as a mode of the existing card.

```
et-bracket-pick-card
  input  match          the linked BracketMatch
  input  normalized     the NormalizedMatch, as today
  input  locked         the deadline passed; the picks stay visible and stop changing
  input  disabled       this viewer may not pick at all
  output pick           MatchParticipantSide
```

What it owes the consumer:

- A side is a `<button>` only when it is selectable; otherwise it is not focusable. A side in the
  `unresolvable` or `unavailable` state is never a control, and neither is a bye.
- `aria-pressed` on the chosen side, so the choice is not colour alone.
- The predicted state is marked visibly, so a viewer can tell their own guess from a fact.
- One slot for the consumer's own scoring badge. Whether a pick was right is the consumer's data,
  and the card must not model it.

---

## 6 Narrow widths: squeeze the bracket, do not list it

The library's answer to a narrow column is a second presentation: a vertical list, one round at a
time, with the connectors dropped. For a prediction bracket that is the wrong trade. The
connectors are exactly what tells the viewer where the two matches of the shown round came from —
which matters far more when the sides are their own guesses than when they are results.

Support the other answer as well. It needs two numbers and no second renderer:

```ts
export type CreateBracketGridConfig = BracketLayoutSettings & {
  /**
   * The round the row span is computed on. `null` uses the first round, which is the full bracket.
   *
   * Naming a later round squeezes the white space out of it: its matches sit one row apart rather
   * than spread over the first round's height.
   */
  rowSpanRoundId: BracketRoundId | null;
};
```

and, on the component, a `focusRoundId` that translates the grid so that round starts at the left
edge. Keep the two separate: one squeezes the rows, the other chooses what is on screen. A design
that wants a strip of the neighbour round visible then changes only the second.

Three requirements the consumer should not have to discover:

- **The switch is a width measurement, not a breakpoint.** A three-round bracket fits a phone; a
  five-round one fits no laptop. `bracketFitsWidth` already answers this — measure a container
  that does not grow with its content, or the answer is always yes.
- **Vertical scrolling stays.** A first round of 16 matches fits no phone. Only the movement
  between rounds belongs to the navigation.
- **The transition drops under `prefers-reduced-motion`.** The jump stays.

### A bug to fix while in there

The row-span block must be clamped to at least the height of the element it holds:

```ts
const blockHeight = Math.max(
  elementHeight,
  matchFactor * settings.matchHeight + (matchFactor - 1) * settings.rowGap,
);
```

Without the clamp, a squeezed final centres a tall final card in a one-row block, and the card is
pushed up over its own round header. This reproduces today with any `finalMatchHeight` greater
than `matchHeight` as soon as the row span is taken from a later round.

---

## 7 Publish the compute core without Angular

The geometry is pure TypeScript: link the source, place the columns, place the rows, produce the
connector paths, measure the natural width. It imports nothing from Angular. Yet since change
#3046 `createBracket` and the relation builders are no longer exported, so a consumer cannot use
any of it without the component — and the component pins an exact Angular version.

Split it:

- **A framework-free entry point** holding the source types, the linker, the layout registry, the
  grid, the connectors, the width measurement, and the resolver of item 3. It depends on nothing
  but TypeScript.
- **The Angular components** on top, unchanged.

Two things follow. A consumer stuck on an older Angular can depend on the core and write forty
lines of template instead of copying two thousand lines and forking the model. And a bracket
becomes testable without a TestBed, which the core already deserves.

The core must not import `RuntimeError` or anything else from `@ethlete/core`, or the split buys
nothing — a consumer on an older `@ethlete/core` hits the same wall one layer down. Throw plain
errors with the same messages.

---

## Order of work

1. **Item 7, the split.** It is mechanical, it unblocks every consumer immediately, and doing it
   first means items 1 to 4 land in a place a consumer can actually reach.
2. **Item 2, then item 1.** Item 2 fixes a real bug on its own. Item 1 is the model change
   everything else reads.
3. **Item 3 and item 4.** Together they are the prediction feature. Neither is useful alone.
4. **Item 6.** Independent of the rest, and the clamp fix inside it is a bug today.
5. **Item 5, the card.** Last: it consumes all of the above, and its visual design wants a
   designer rather than a plan.

Items 1, 2, 4 and 6 are additive. Item 7 is a packaging change and needs a major version.
