# Bracket prediction

A [bracket](/components/bracket) the viewer picks the winners in before the matches are played. Two
pieces make one up: `resolveBracketSlot()` reads every slot through the viewer's own picks, and
`<et-bracket-pick-card>` is the cell they pick in. To predict the order of a group table rather than a
knockout pairing, use [standings pick](/components/standings-pick) instead.

Import `BRACKET_IMPORTS` and register a [layout](/components/bracket#layouts) with
`provideBracketConfig()`, the same as for a results bracket. `resolveBracketSlot`,
`describeBracketSlot`, `createBracket` and `migrateBracketPicks` are pure functions, and they also
ship from the framework-free `@ethlete/bracket` package, which has no Angular peer dependency.

A prediction bracket is a normal `<et-bracket>` with a [card of your
own](/components/bracket#custom-cards) that wraps the pick card. The wrapper resolves the two sides
from the picks your app holds, and writes a new pick back to them:

```ts
import { Component, computed, inject, input } from '@angular/core';
import { BRACKET_IMPORTS, BracketMatch, BracketRound, BracketRoundSwissGroup } from '@ethlete/components';

@Component({
  selector: 'app-pick-cell',
  imports: [BRACKET_IMPORTS],
  template: `
    <et-bracket-pick-card
      [bracketMatch]="bracketMatch()"
      [normalized]="normalized()"
      [pickedSide]="pickedSide()"
      (pick)="picks.save(bracketMatch().id, $event)"
    />
  `,
})
export class PickCellComponent {
  protected picks = inject(PickStore);

  bracketRound = input.required<BracketRound<RoundData, MatchData>>();
  bracketMatch = input.required<BracketMatch<RoundData, MatchData>>();
  bracketRoundSwissGroup = input.required<BracketRoundSwissGroup<RoundData, MatchData> | null>();

  protected normalized = computed(() => this.picks.normalizedMatch(this.bracketMatch()));
  protected pickedSide = computed(() => this.picks.pickedSide(this.bracketMatch()));
}
```

```html
<et-bracket
  [source]="source"
  [matchComponent]="PICK_CELL"
  [finalMatchComponent]="PICK_CELL"
  [matchHeight]="104"
  disableJourneyHighlight
/>
```

The pick card is two rows tall, so give it more `matchHeight` than a results card needs.
[`disableJourneyHighlight`](/components/bracket#a-prediction-bracket-wants-it-off) belongs here as
well - the highlight reads the real source, and a predicted run is not in it.

## Live demo

<StoryEmbed id="components-sports-bracket-prediction--interactive" height="640px" />

## Resolving a slot

`resolveBracketSlot({ bracket, picks, matchId, side })` follows slot provenance through the viewer's
own choices. It resolves winners and losers, table positions, and byes; a malformed cycle or an
incomplete chain returns `null`. It deliberately ignores a later real result when following a
`match-outcome`, so scoring a prediction never rewrites what the viewer chose.

Use `createBracket(source, options)` to link the source first. Slot provenance supplies the feeder
graph by default; for a source whose slots do not carry it, pass `previousMatchIds(match)`
explicitly.

### Resolution policies

Two options change how strictly a resolution reads the graph. Both default to the behaviour above,
so an existing call is unaffected.

| Option                          | Type                               | Default       |
| ------------------------------- | ---------------------------------- | ------------- |
| `realParticipantOutranksPick`   | `(match: BracketMatch) => boolean` | `() => false` |
| `keepPickWhileFeederSideIsOpen` | `boolean`                          | `false`       |

**`realParticipantOutranksPick`** decides, per match, whether the participant actually standing on a
slot beats what the picks predict for it. It is a predicate rather than a flag because the answer
differs _within_ one bracket:

- **`true` - reality wins.** Wherever a real participant is known, that is the answer. Use it while a
  round is still open: the real pairing is the one the viewer's pick was made against, so the card
  should show it.
- **`false` - the prediction wins** (the default). The picks answer for `match-outcome` and
  `standing-rank` slots even where a result already disagrees. Use it for a locked round, where the
  record of the guess is the point.

It must answer from the match alone and answer the same way for the whole resolution, because the walk
memoizes per slot.

```ts
const lockedRoundIds = new Set(['round-1']);

resolveBracketSlot({
  bracket,
  picks,
  matchId,
  side,
  realParticipantOutranksPick: (match) => !lockedRoundIds.has(match.round.id),
});
```

**`keepPickWhileFeederSideIsOpen`** decides what a predicted winner is worth while its own match is
half-empty. By default a `match-outcome` slot resolves to `null` as soon as either side of the feeder
is unknown. Set it to `true` to keep the pick until both sides are known and it is neither of them -
until then nothing contradicts it. A predicted _loser_ still needs both sides either way, since it is
defined as whoever the viewer did not pick.

Slots that no prediction can reach (`seed`, `swiss-bucket`, `external`, a slot with no provenance)
still answer with whoever really stands there; a `bye` still advances its occupied side without a pick.

## The pick card

`<et-bracket-pick-card>` is the default operable cell to use from a custom `matchComponent`. Bind its
linked `bracketMatch`, your `normalized` view and `pickedSide`; write `(pick)` back to your prediction
state.

Both sides must be resolved before either becomes a control, so a partial matchup, a bye and a side no
pick reaches are non-focusable text rather than a dead button. The chosen side carries `aria-pressed`
and a filled mark; a selectable side that is not chosen shows the pick it would make on hover. A
`predicted` side reads in the accent ink colour and carries a visually hidden “Prediction” note,
worded by `predictedLabel`.

The mark is drawn only where a pick is the point - on a selectable side, and on the chosen side even
once it is locked. A slot nobody can ever be picked in gets no mark, so it never reads as a control.

The two sides always split the card's height evenly, whatever each of them holds - a participant row
and a row that only words its slot come out the same height.

### Three ways a pick stops

| Input      | What it means                                                      | What the card does                                                                               |
| ---------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| `locked`   | The deadline for this match passed.                                | Picks stay visible and stop changing; the chosen mark reads settled, not accent.                 |
| `disabled` | This viewer may not pick here at all - not signed in, not entered. | Nothing is a control, and no marks are drawn.                                                    |
| `readonly` | A results view, not a second way to pick.                          | Nothing is a control, no marks; once the match is decided the side it decided against is dimmed. |

They are independent inputs, not one enum: an app can lock a match it also renders read-only.

<StoryEmbed id="components-sports-bracket-prediction--pick-card-states" height="360px" />

### The note line

`note` is one line the card may carry, with `noteTone` of `'muted'` or `'invalid'`; `invalid` also
outlines the card. It is drawn **under the card and outside the card's own box**, in the row gap the
grid keeps free - a line in the flow would take the cell's height from the card and squash its two
rows. It is wired to the sides with `aria-describedby`.

The library does not model _why_ a note exists. A lock, a stale pick, a pick that followed its
participant into this match are all the app's judgement; the card takes the finished sentence.

One line, never a stack: every card in a row is the same height, and a second line would come out of
the card.

```html
<et-bracket-pick-card
  [bracketMatch]="bracketMatch()"
  [normalized]="normalized()"
  [pickedSide]="pickedSide()"
  [locked]="deadlinePassed()"
  [note]="note()"
  (pick)="savePick($event)"
  noteTone="invalid"
>
  <app-points etBracketPickCardScore />
</et-bracket-pick-card>
```

An `invalid` note reads in the app's error color theme (`type: 'error'`). An app that registers none
still works - the note simply stays in the ambient color.

## Wording a slot nobody stands on

`describeBracketSlot(source, labels)` turns a `BracketSlotSource` into one line. `source.label` always
wins: where the competition worded the slot itself, the library repeats that word rather than
inventing one. Only in its absence does the kind decide.

| `kind`          | Reads (default labels)             | Label                               |
| --------------- | ---------------------------------- | ----------------------------------- |
| `match-outcome` | Winner / Loser of an earlier match | `slotMatchWinner`, `slotMatchLoser` |
| `standing-rank` | Group A position 2                 | `slotStandingRank(standing, rank)`  |
| `seed`          | Seed 3                             | `slotSeed(seed)`                    |
| `swiss-bucket`  | Drawn once the round is scheduled  | `slotSwissBucket`                   |
| `bye`           | Bye                                | `slotBye`                           |
| `external`      | Arrives from another competition   | `slotExternal`                      |
| `source: null`  | Not known yet                      | `slotUnknown`                       |

A slot nothing is known about is `source: null` - there is no `'undescribed'` kind, so an exhaustive
switch over `BracketSlotSourceKind` keeps compiling.

<StoryEmbed id="components-sports-bracket-prediction--slot-sources" height="360px" />

A side that a prediction **could** still name is the one case the source does not word. It reads
`slotPredictEarlierRound` ("Predict the earlier round first"), or `slotNotPredicted`
("Not predicted") when the card's `earlierRoundsClosed` input says no earlier round is left to predict
in - the invitation would otherwise ask for something that can no longer be given.

Every string is overridable app-wide through [`provideBracketLabels()`](/components/bracket#localization).

### Two new fields on `BracketSlotSource`

`seed?: number | null` and `standingName?: string | null` - the numbers "Seed 3" and
"Group A position 2" are written from. **Both are optional, while the older `rank` / `standingId` /
`label` fields are required**, for two different reasons:

- `rank` and the rest predate this: every source literal in the SDK, in its specs and in consumer
  adapters already sets them. Adding a required field would break all of them at once, and a source
  adapter that has no seeding to report would have to write `seed: null` for nothing.
- They are genuinely absent, not merely unknown. `standingId` without a `standingName` is the normal
  case for an API that returns ids and expects a lookup; `seed` is meaningless for a source that seeds
  nothing. `describeBracketSlot` treats a missing field and an explicit `null` identically, so an
  adapter may set either.

`generateBracketDataForEthlete` sets neither, because the Ethlete match views carry no seeding
position and no source standing. A source built by hand may set both.

**Breaking change:** the pick card's `unresolvableLabel` and `unavailableLabel` inputs are gone. The
first is now `slotPredictEarlierRound` / `slotNotPredicted` plus `earlierRoundsClosed`; the second is
`describeBracketSlot`, which words the slot per kind instead of using one string for all of them.

## Following a pick when the pairing changes

A pick names a **participant**, not a slot. Edit a group's order and a different participant plays
that knockout match - so the pick has to follow its participant, and a pick nothing can honour has to
be reported rather than silently kept.

`migrateBracketPicks()` answers both questions for a whole linked bracket:

```ts
const migration = migrateBracketPicks({
  bracket,
  pickAsMade: (matchId) => draft[matchId] ?? saved[matchId] ?? null,
  lockedMatchIds: new Set(lockedIds),
  standingRank: ({ standingId, rank }) => groupOrder(standingId)[rank - 1] ?? null,
});

// The pick that counts on a match, after every pick has moved.
migration.pickByMatchId[matchId];
// The match a pick was made on, for a match that took one in.
migration.movedFromByMatchId[matchId];
// The pick nothing in the round can honour. Such a match holds no selection.
migration.strandedByMatchId[matchId];
```

| Option           | Type                                                          | Notes                                         |
| ---------------- | ------------------------------------------------------------- | --------------------------------------------- |
| `bracket`        | `Bracket`                                                     | Linked, from `createBracket()`                |
| `pickAsMade`     | `(matchId: string) => string \| null`                         | The pick exactly as the viewer made it        |
| `lockedMatchIds` | `ReadonlySet<string>`                                         | Optional. Picks here neither leave nor arrive |
| `standingRank`   | `(o: { standingId: string; rank: number }) => string \| null` | Optional. For `standing-rank` slots           |

It also takes the two [resolution policies](#resolution-policies) and forwards them to every
resolution it performs.

**The rules, in order:**

1. Rounds are settled earliest first, in topological order over the declared provenance - a round is
   resolved against the rounds already settled, so those must have moved first.
2. A pick that still names one of the two resolved sides of its own match stays there.
3. A **locked** pick never travels, in or out. It stays where it was made _and_ comes back in
   `strandedByMatchId`: the backend keeps it whatever a later payload leaves out, so moving it would
   misreport it.
4. A pick that names neither side travels to the one match of the **same round** whose sides it does
   name - provided that match holds no valid pick of its own, is not locked, and has not itself
   stranded a pick.
5. A pick nothing in the round can honour is stranded, and its match then holds no selection at all.
6. Stranding is applied after all travelling in the round, so a match carrying the stranded note
   holds no selection even where another pick reached it in the meantime.

"Same round" means the round as it is _played_, not as it is drawn: a mirrored layout splits one round
into two halves to draw either side of the fold, and a pick travels across that fold freely.

Feed the result back through the resolver so the rest of the bracket resolves against the migrated
picks, not the raw ones:

```ts
const picks: BracketPickSet = {
  matchWinner: (matchId) => migration.pickByMatchId[matchId] ?? null,
  standingRank: ({ standingId, rank }) => groupOrder(standingId)[rank - 1] ?? null,
};
```

Use `strandedByMatchId` to drive the "this prediction can no longer be honoured" note and a reset
action, and `movedFromByMatchId` to tell the viewer where a pick came from.

## Accessibility

Only a **selectable** side is a `<button>`; every other side is a `<div>`. A partial matchup, a bye, a
locked card and a read-only card therefore have no tab stop and no dead control, and a viewer tabbing
through the bracket reaches exactly the picks they can still make.

- **The chosen side carries `aria-pressed`**, and the filled mark next to it is `aria-hidden` - so the
  selection is announced from the control itself, not from a drawn dot.
- **A `predicted` side says so in text.** It reads in the accent ink colour, and the
  `predictedLabel` word (default `'Prediction'`) is in the accessibility tree but clipped out of
  sight, so a predicted participant is never told apart by colour alone.
- **A side nobody stands on reads its slot** rather than being blank: `describeBracketSlot` words it,
  or `slotPredictEarlierRound` / `slotNotPredicted` does - see
  [Wording a slot nobody stands on](#wording-a-slot-nobody-stands-on).
- **The note is linked with `aria-describedby`** from each side that is a control. A card where
  nothing is a control has no side to link it from, and the note is then read in document order after
  the card.
- Focus is drawn by `etFocusRing`, so a pick keeps the same focus ring as the rest of the library -
  except that it is inset rather than offset outwards, because the card clips anything outside a
  row's own box.

The card is one cell of a [bracket](/components/bracket#accessibility), whose round headings and
scaffolding are described there.

## Theming

Every colour resolves from the app-registered [surface and colour theme](/core/theming) systems: the
card fill and border from `--et-surface-background-solid` and `--et-surface-border-solid`, a hover
from `--et-surface-interaction-solid`, the chosen side with its bar and mark from
`--et-theme-color-primary-solid`, and a locked chosen bar and mark from
`--et-surface-color-muted-solid`. A
`predicted` side's text and an `invalid` note read `--et-theme-color-ink-solid` of the colour theme in
scope - which, for an `invalid` note, is the app's `type: 'error'` theme. No theme name is baked in.

| Token                                   | Default    | What it sizes                                  |
| --------------------------------------- | ---------- | ---------------------------------------------- |
| `--et-bracket-pick-card-border-radius`  | `10px`     | Card corner radius, and the `invalid` outline. |
| `--et-bracket-pick-card-padding`        | `8px 10px` | Padding inside one side.                       |
| `--et-bracket-pick-card-gap`            | `8px`      | Gap between a side's participant and its mark. |
| `--et-bracket-pick-card-mark-size`      | `14px`     | The pick mark's diameter.                      |
| `--et-bracket-pick-card-note-offset`    | `4px`      | Distance from the card's edge to the note.     |
| `--et-bracket-pick-card-note-font-size` | `10px`     | Note text size.                                |
| `--et-bracket-pick-card-slot-font-size` | `13px`     | The text that words a slot nobody stands on.   |

The mark fades in over `120ms` when its match becomes operable, and fills over `120ms` when it is
chosen; the side's tint and the bar fade over the same `120ms`. Under
`prefers-reduced-motion: reduce` every one of them changes at once.

## Error codes

The prediction helpers throw nothing of their own - an unresolvable slot answers `null`. The bracket
they draw into throws `ET34xx`, see
[/components/error-codes#bracket-et34xx](/components/error-codes#bracket-et34xx).
