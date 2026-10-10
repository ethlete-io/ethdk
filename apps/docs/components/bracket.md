# Bracket

`<et-bracket>` renders a tournament bracket - single-elimination, double-elimination
(synchronous or deferred/async lower brackets), and swiss-with-elimination stages - as
an absolutely-positioned grid of match cards wired together with SVG connector lines. You
feed it a `BracketDataSource` (build one from your API with the bundled integrations) and
it computes the layout, draws the connectors, and traces a participant's journey through the
tournament on hover or on demand.

Import `BRACKET_IMPORTS` (or `BracketComponent` directly) and **register the
[layouts](#layouts) your app draws** - a layout is an opt-in value, so only the ways of drawing a
bracket you actually name end up in your bundle. `provideBracketConfig({ layouts, ... })` registers
them and sets app-wide defaults for the layout inputs in the same call. The
[cards](#default-cards) are opt-in the same way: spread `BRACKET_DEFAULT_CARDS` into the config, or
bind cards of your own.

Every bracket component has an import tuple of its own - `BRACKET_IMPORTS` (`et-bracket`),
`BRACKET_ROUNDS_LIST_IMPORTS`, `BRACKET_PARTICIPANTS_IMPORTS` and `BRACKET_PICK_CARD_IMPORTS` - so a
page that draws only the grid bundles only the grid.

::: warning The default cards need a `matchNormalizer`
The bracket carries your match payload from the data source to the cards untouched, so the
**shipped cards need one function that says how to read it**. Register it once and the
defaults work; leave it out and they render nothing (dev mode throws
[`ET3412`](/components/error-codes#bracket-et34xx)). See
[Default cards](#default-cards).
:::

## Usage

Registering a layout is step one - without one the bracket has no code for your source's `mode` and
throws [`ET3413`](#layouts) rather than guessing. Registering the cards is step two - without them it
throws [`ET3414`](#default-cards):

```ts
import { ApplicationConfig } from '@angular/core';
import {
  BRACKET_DEFAULT_CARDS,
  normalizeEthleteBracketMatch,
  provideBracketConfig,
  singleEliminationBracketLayout,
} from '@ethlete/components';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBracketConfig({
      // what this app can draw - see Layouts below
      layouts: [singleEliminationBracketLayout()],
      // the shipped cards - leave this out when every card is your own
      ...BRACKET_DEFAULT_CARDS,
      // how to read your match data, for the shipped cards
      matchNormalizer: normalizeEthleteBracketMatch,
    }),
  ],
};
```

```ts
import { Component } from '@angular/core';
import { BRACKET_IMPORTS, generateBracketDataForEthlete } from '@ethlete/components';

@Component({
  selector: 'app-standings',
  imports: [BRACKET_IMPORTS],
  template: `<et-bracket [source]="source" />`,
})
export class StandingsComponent {
  // Build the source from your API payload (see Data source below)
  source = generateBracketDataForEthlete(apiRounds);
}
```

## Live demo

<StoryEmbed id="components-sports-bracket--single-elimination" height="480px" />

## Layouts

A layout is **how a source is drawn**: it orders the rounds, positions every cell into a grid, and
draws the SVG between them. There is one per tournament mode, plus a mirrored variant for the
elimination modes - and each one is a plain value you create with a factory and register:

```ts
import {
  doubleEliminationBracketLayout,
  provideBracketConfig,
  singleEliminationBracketLayout,
} from '@ethlete/components';

providers: [
  provideBracketConfig({
    layouts: [singleEliminationBracketLayout(), doubleEliminationBracketLayout()],
  }),
];
```

**Registering is how you pay only for what you draw.** The renderers are big - the swiss one and the
double-elimination grid builder are each several hundred lines - and nothing references them until a
factory you call does, so an app that only ever shows single-elimination brackets ships neither.

| Factory                                    | Source `mode`            | Draws                                                                                                                           | Roughly adds |
| ------------------------------------------ | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| `singleEliminationBracketLayout()`         | `single-elimination`     | Left to right, converging on the final.                                                                                         | ~150 LOC     |
| `mirroredSingleEliminationBracketLayout()` | `single-elimination`     | The same bracket [folded in half](#mirrored-layouts), final in the middle.                                                      | ~150 LOC     |
| `doubleEliminationBracketLayout()`         | `double-elimination`     | Upper over lower bracket, converging on the grand final (and the bracket reset).                                                | ~600 LOC     |
| `mirroredDoubleEliminationBracketLayout()` | `double-elimination`     | The winners bracket [stacked over the losers bracket](#double-elimination-stacks-two-folds), each folded around its own centre. | ~350 LOC     |
| `swissBracketLayout(options?)`             | `swiss-with-elimination` | Standings groups per round with group-to-group connectors - see [Swiss](#swiss).                                                | ~690 LOC     |

The two single-elimination variants share their builder, so registering both costs almost nothing
beyond the first. The two double-elimination variants do not - they draw genuinely different shapes -
so registering both costs roughly the sum.

### Per instance

Both hosts - `<et-bracket>` and
[`<et-bracket-rounds-list>`](/components/bracket-rounds-list) - take a `layouts` input that
**replaces** the `provideBracketConfig` list for that instance (it does not add to it). That is how
one page draws a bracket folded while the rest of the app draws it left to right:

```html
<et-bracket [layouts]="[mirroredSingleEliminationBracketLayout()]" [source]="source()" />
```

Create the layouts once (a field, or a module constant) rather than in the template expression - a new
array on every change detection run rebuilds the grid.

The first entry whose `mode` matches the source draws it, so a list may hold one layout per mode and
the order only matters between two layouts of the same mode.

### When nothing matches

A source whose `mode` has no registered layout throws
[`ET3413`](/components/error-codes#bracket-et34xx), naming the factory to add:

```
No bracket layout registered for mode "double-elimination". Add doubleEliminationBracketLayout()
to provideBracketConfig({ layouts: [...] }) or to the layouts input.
```

It throws in dev **and** prod, by design: a bracket that silently drew the wrong shape - or nothing -
would be worse than a loud failure. If your app renders whatever mode the API returns, register a
layout for every mode you can receive.

### What a layout is made of

The `BracketLayout` type is exported, so the seam the shipped factories sit on is visible rather than
private:

| Field           | Purpose                                                                             |
| --------------- | ----------------------------------------------------------------------------------- |
| `name`          | Names it in errors and devtools (`'single-elimination-mirrored'`).                  |
| `mode`          | The `TournamentMode` it answers for.                                                |
| `createGrid`    | Positions the linked bracket's rounds and matches into columns.                     |
| `drawEdges`     | Describes what goes between the cells as data - see `BracketDrawing` below.         |
| `listGrouping?` | Splits a round into groups for the rounds list - what swiss uses for standings.     |
| `listSection?`  | Puts a round under a heading in the rounds list - what double elimination uses.     |
| `components?`   | Per-layout default cards, between the host's inputs and `provideBracketConfig`.     |
| `styles?`       | Styles-only components mounted while this layout renders (see [Theming](#theming)). |

The card component types are public (`BracketMatchComponent`, `BracketRoundHeaderComponent`,
`BracketContinueComponent`), so the `components` slot is usable from your own code - that is how
`swissBracketLayout({ matchComponent })` gives swiss sources a denser card than the elimination stage
next to them. The types `createGrid` and `drawEdges` speak in (`ComputedBracketGrid`,
`CreateBracketGridConfig`, `BracketDrawEdgesContext`) are public too, so a layout of your own can wrap
or replace a shipped one - but the SDK's own grid builders stay internal; the five factories are the
supported way to get them.

`drawEdges` returns a **`BracketDrawing`**: `{ edges, rects, gradients }`. Nothing about it is markup,
so a custom layout never builds an SVG string and the host never trusts one past the sanitizer.

| Field       | Purpose                                                                                     |
| ----------- | ------------------------------------------------------------------------------------------- |
| `edges`     | The connectors. Each is a `BracketEdge`: `id`, `d`, `cssPath`, `cssClass`, stroke and dash. |
| `rects`     | Boxes drawn behind them - what a swiss layout's group borders are.                          |
| `gradients` | Definitions an edge's `stroke` names by `url(#id)`; prefix every id with `idPrefix`.        |

Two rules a layout of your own has to keep, because the animation depends on them:

- **An `id` has to survive a re-layout.** The host tracks paths by it; a new id replaces the node
  instead of moving it, and a replaced node cannot transition. The shipped layouts name a connector
  after the two matches it joins.
- **A connector's path has to keep its shape.** A browser interpolates the CSS `d` property only
  between two paths with the same commands in the same order, so emit one fixed command sequence per
  connector and let a degenerate case collapse - a curve with a radius of nothing rather than a
  straight `M ... H ...`. The shipped layouts scale a connector's bends down to nothing between two cards
  on the same row for exactly this reason.

The participant short ids the [journey highlight](#journey-highlight) matches on ride in `cssClass`,
so an edge of your own joins in by carrying them.

## Data source

The component never talks to your API directly - it takes a resolved `BracketDataSource`:

```ts
type BracketDataSource<TRoundData, TMatchData> = {
  mode: TournamentMode; // 'single-elimination' | 'double-elimination' | 'swiss-with-elimination'
  rounds: BracketRoundSource<TRoundData>[]; // { id, type, name, data }
  matches: BracketMatchSource<TMatchData>[]; // { id, roundId, home, away, winner, status, data }
};
```

`home` / `away` are participant ids; the engine derives the participant graph (and each
participant's journey) from them.

Without slot provenance the **order of the source is the bracket's structure**: list the rounds in play
order (upper and lower rounds of a double elimination interleaved as they are played), and the matches
of each round in bracket order, top to bottom - matches 1 and 2 of a round feed match 1 of the next.
Declare `homeSource` / `awaySource` (or pass [`previousMatchIds`](#options)) and order stops mattering.

Prediction sources may additionally set `homeSource` and `awaySource` to preserve where an empty or filled slot came from. Build a slot with `bracketSlot`:

```ts
import { bracketSlot } from '@ethlete/components';

{
  id: 'final',
  roundId: 'final',
  home: null,
  away: null,
  homeSource: bracketSlot.matchOutcome('semi-final-1', 'winner'),
  awaySource: bracketSlot.matchOutcome('semi-final-2', 'winner'),
  winner: null,
  status: 'pending',
  data: null,
}
```

Provenance is all or nothing: once **any** match carries a `match-outcome` slot, the whole bracket is
linked from the declared slots alone, so a match without them draws no connectors. In dev mode the
bracket warns in the console about every match left unlinked that way and every slot `matchId` that
names no match (`createBracket`'s `onWarning` option reports the same as a `BracketWarning`).

`BracketSlotSource` is a union discriminated by `kind`, so a slot carries only the fields of its kind:

| Constructor                                                         | `kind`          | Fields                                 |
| ------------------------------------------------------------------- | --------------- | -------------------------------------- |
| `bracketSlot.matchOutcome(matchId, role, label?)`                   | `match-outcome` | `matchId`, `role: 'winner' \| 'loser'` |
| `bracketSlot.standingRank(standingId, rank, standingName?, label?)` | `standing-rank` | `standingId`, `rank`, `standingName?`  |
| `bracketSlot.seed(seed, label?)`                                    | `seed`          | `seed`                                 |
| `bracketSlot.swissBucket(label?)`                                   | `swiss-bucket`  | -                                      |
| `bracketSlot.bye(label?)`                                           | `bye`           | -                                      |
| `bracketSlot.external(label)`                                       | `external`      | -                                      |

Every kind also takes `label`, optional competition wording for the empty slot (the library never
invents one), and `seed`, the seeding position. A `bye` is never selectable and automatically advances
the other resolved side.

A round whose matches are not drawn yet is not an error: it renders as an empty column and the rounds
either side of it relate to each other, so a stage can be published before its later rounds are seeded.

`data` on rounds and matches is opaque to the engine and handed back to your cards as
`bracketRound().data` / `bracketMatch().data`.

The Ethlete API integration builds the source for you:

| Integration | Function                                           | Input                            |
| ----------- | -------------------------------------------------- | -------------------------------- |
| Ethlete API | `generateBracketDataForEthlete(rounds, { mode? })` | `EthleteRoundWithMatchesInput[]` |

The input types (`EthleteRoundInput`, `EthleteBracketMatchInput`) list only the fields the integration
reads, so the generated `RoundStageStructureWithMatchesView[]` from `@ethlete/types` fits, and so does an API
variant's own model. The function is generic: the source it returns is typed with _your_ round and match
types, so the extra fields of an extended model are still there on `bracketRound().data` /
`bracketMatch().data`.

It infers the tournament mode from the stage type of the first match that has one
(`generateTournamentModeFromEthleteRounds`), so a stage whose opening rounds are drawn but still empty
maps fine, and a `fifa_swiss` stage is a swiss stage however many of its rounds are listed yet.

A stage published with its rounds but no matches yet is not an error either: the mode is then read from
the round types - a `winner_bracket`, `loser_bracket` or `reverse_final` round makes it double
elimination, anything else single elimination - and the bracket draws its empty rounds. A swiss stage
cannot be told apart that way, so pass the mode yourself; `mode` also wins whenever it is given:

```ts
generateBracketDataForEthlete(apiRounds, { mode: 'swiss-with-elimination' });
```

Only a stage with no rounds at all throws [`ET3401`](/components/error-codes#bracket-et34xx) - render
[`<et-bracket-skeleton>`](#loading-skeleton) until it has some.

A round the API types `final` is the final. A `normal` round of a single elimination stage is the final
only when it is the **last** round of the stage - a third place round listed after it does not count -
whatever its match count, so a one-match play-in round stays an ordinary round. Map a single round
yourself with `generateRoundTypeFromEthleteRoundType(type, mode, isLastRound)`.

For any other backend, construct a `BracketDataSource` by hand (or write a small adapter in
your app).

## Options

All layout inputs are numbers (px) unless noted. Each is an **override**: leave one unbound and its
value comes from `provideBracketConfig`, then from the [density](#density) preset, then from the
shipped default listed below. The resolved set is on the component as `settings()`.

| Input                     | Default      | Purpose                                                                                                                    |
| ------------------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------- |
| `source`                  | - (required) | The resolved `BracketDataSource`.                                                                                          |
| `layouts`                 | -            | Replaces the registered layout list for this instance - see [Layouts](#layouts).                                           |
| `previousMatchIds`        | -            | `(match) => string[]`, the feeders of each match - pass the one your own `createBracket` uses.                             |
| `density`                 | `'default'`  | `'default'` or `'compact'` - see [Density](#density).                                                                      |
| `columnWidth`             | `250`        | Width of a round column.                                                                                                   |
| `matchHeight`             | `75`         | Height of a match card.                                                                                                    |
| `columnGap`               | `60`         | Horizontal gap between round columns.                                                                                      |
| `rowGap`                  | `30`         | Vertical gap between matches in a column.                                                                                  |
| `rowRoundGap`             | `20`         | Vertical gap between the upper/lower halves of a double-elimination round.                                                 |
| `rowSpanRoundId`          | `null`       | Round whose match count sets vertical spacing; the opening round is the default. An id the source lacks warns in dev mode. |
| `focusRoundId`            | `null`       | Translates this round to the inline start without changing vertical density. An id the source lacks warns in dev mode.     |
| `focusInset`              | `0`          | Room kept to the inline start of `focusRoundId` - the gutter a one-round panel navigates in.                               |
| `finalColumnWidth`        | `360`        | Width of the final column - sized for the shipped final card.                                                              |
| `finalMatchHeight`        | `200`        | Height of the final match card - likewise.                                                                                 |
| `roundHeaderHeight`       | `50`         | Height of the round-header row.                                                                                            |
| `roundHeaderGap`          | `20`         | Gap between the header row and the first match.                                                                            |
| `thirdPlaceTopOffset`     | `null`       | Folds the third place into the final's column, this far below the top of the final's card.                                 |
| `finalRoundHeaderGap`     | `null`       | Header-to-card gap for the final's column alone, where it is wider than `roundHeaderGap`.                                  |
| `alignRoundHeaders`       | `'start'`    | `'start'` or `'center'` - where a round header sits over its column.                                                       |
| `hideRoundHeaders`        | `false`      | Drop the header row entirely.                                                                                              |
| `lineWidth`               | `2`          | Connector stroke width.                                                                                                    |
| `lineStartingCurveAmount` | `10`         | Curve radius where a connector leaves a match.                                                                             |
| `lineEndingCurveAmount`   | `0`          | Curve radius where a connector meets the next match.                                                                       |
| `lineDashArray`           | `0`          | Connector dash length (`0` = solid).                                                                                       |
| `lineDashOffset`          | `0`          | Connector dash offset.                                                                                                     |
| `disableJourneyHighlight` | `false`      | Turn off journey highlighting and pinning entirely.                                                                        |
| `focusedParticipantId`    | `null`       | Two-way. Pins a participant's journey - see [Participant focus](#participant-focus).                                       |
| `swissGroupPadding`       | `10`         | Padding inside a swiss group border box.                                                                                   |
| `swissGroupBorderRadius`  | `12`         | Corner radius of a swiss group border box.                                                                                 |
| `swissColors`             | -            | Per-group-type colors (see [Swiss](#swiss)).                                                                               |
| `showContinueElement`     | `false`      | Append a "continue" column (see [Continue element](#continue-element)).                                                    |
| `continueColumnWidth`     | `250`        | Width of the continue column.                                                                                              |
| `continueElementHeight`   | `75`         | Height of the continue card.                                                                                               |
| `continueLineDashArray`   | `6`          | Dash length for the continue connectors.                                                                                   |
| `matchNormalizer`         | -            | How to read your match data, for the default cards (see below).                                                            |
| `roundHeaderLevel`        | `3`          | `aria-level` the default round headers announce themselves at.                                                             |

### The final's own column

`finalRoundHeaderGap` buys room between the final's round header and its card - for a trophy line, a
stage label, a countdown - and buys it **for the final's column only**. Widening `roundHeaderGap`
instead lowers the first card of every round, which a layout that shows one round at a time reads as
the whole bracket sliding. A value at or below `roundHeaderGap` changes nothing.

`thirdPlaceTopOffset` moves the third place match out of its own column and into the final's, that
many px below the top of the final's card, with its round header above its own card. It takes the
final's column width, and the grid gets narrower by the column and gap it saves - so
`bracketNaturalWidth()` answers a smaller number with it set.

Only a single elimination layout has a column to fold: a double elimination grid already hangs the
third place under its grand final, and ignores the setting.

A mirrored single elimination layout always folds the third place, since a column of its own would sit
between the final and the right half. Unset, the third place card sits one `rowGap` below the final's
card, with its round header in between.

```html
<et-bracket [source]="source()" [thirdPlaceTopOffset]="260" [finalRoundHeaderGap]="60" />
```

### Where a round header sits

`alignRoundHeaders` aligns whatever header component the column holds inside that column. The shipped
`et-bracket-default-round-header` fills its column and centres its own text, so it looks the same
either way; a header of your own that sizes to its content moves. `'center'` is what a one-round panel
wants, where the header names the panel rather than labelling a column it starts.

## Default cards

Four cards ship with the bracket, and the two match-bearing ones (match and final) are built on
[`et-match-card`](/components/match). They are **opt-in**: spread `BRACKET_DEFAULT_CARDS` into
`provideBracketConfig`, or name single ones (`BracketDefaultRoundHeaderComponent`, …) next to cards of
your own. An app that draws only its own cards leaves them out and bundles none of them - the default
set is about 14 kB gzipped.

A bracket needs a match card and a round header card; with neither an input, the layout nor the config
naming one it throws [`ET3414`](/components/error-codes#bracket-et34xx). The final uses the match
card when nothing names a final card, and a continue card is needed only while `showContinueElement`
is on.

Upgrading from a version that shipped the cards by default? The migration spreads
`BRACKET_DEFAULT_CARDS` into every `provideBracketConfig({ ... })` literal and lists the brackets it
could not fix in `bracket-default-cards-migration-tasks.md`:

```bash
yarn nx g @ethlete/components:migrate-bracket-default-cards
```

| Slot         | Default                                                                                                                 |
| ------------ | ----------------------------------------------------------------------------------------------------------------------- |
| Match        | A compact match card - two rows, short codes, the winner emphasized with an accent bar                                  |
| Final match  | A distinct hero cell: the round's name under a trophy, an accent frame in the color theme in scope, and a champion line |
| Round header | The round's name, its swiss group's name where there is one, and its match count - as a real heading                    |
| Continue     | "N winners advance", with an accessible label of its own                                                                |

### The normalizer

The bracket never looks inside your match payload - it hands `TMatchData` from the data source
to the cards and stays out of it. So the default cards need one function that turns a match into
the [normalized shape](/components/match#any-backend-the-normalized-match) they draw:

```ts
import { normalizeEthleteBracketMatch, provideBracketConfig } from '@ethlete/components';

// for an Ethlete API feed, the normalizer ships with the integration - any match satisfying EthleteMatchInput
provideBracketConfig({ matchNormalizer: normalizeEthleteBracketMatch });
```

Any other backend writes its own. It receives the **whole linked match**, not just `data`, so a
payload that holds nothing presentational is not a dead end - participant ids, `winnerSide`,
`status` and the round are all there to build a card from:

```ts
provideBracketConfig({
  matchNormalizer: (match: BracketMatch<MyRound, MyMatch>): NormalizedMatch => ({
    id: match.id,
    status: match.status === 'completed' ? 'finished' : 'scheduled',
    startTime: match.data.kickOff ? new Date(match.data.kickOff) : null,
    home: myParticipant(match.data.home),
    away: myParticipant(match.data.away),
    homeScore: match.data.homeGoals ?? null,
    awayScore: match.data.awayGoals ?? null,
    resultKind: 'score',
    gameScores: null,
    winnerSide: match.winnerSide,
    label: null,
  }),
});
```

The config is app-wide, so it is typed for any round and match data - annotate the parameter as above,
or a typo in `match.data` compiles. `[matchNormalizer]` on `<et-bracket>` overrides the provider for one
bracket, and is typed with that bracket's source.

### Making cells navigate

The default match card is **not** a link: the bracket can't know your routes and won't guess. A
bracket whose cells navigate wants a `matchComponent` of its own, which is the match card on an
anchor - the whole card becomes the link, correctly named, for free:

```ts
@Component({
  selector: 'app-bracket-match',
  imports: [MATCH_CARD_IMPORTS, RouterLink],
  template: `
    @if (normalized(); as match) {
      <a [match]="match" [routerLink]="['/matches', match.id]" et-match-card size="compact"></a>
    }
  `,
})
export class AppBracketMatchComponent {
  bracketRound = input.required<BracketRound<RoundData, MatchData>>();
  bracketMatch = input.required<BracketMatch<RoundData, MatchData>>();
  bracketRoundSwissGroup = input.required<BracketRoundSwissGroup<RoundData, MatchData> | null>();

  protected normalized = computed(() => myNormalizer(this.bracketMatch()));
}
```

### Localization

The cards' own strings - the match count, "N winners advance", the champion line - come from
`provideBracketLabels()`. Everything inside a match card (TBD, Live, the composed accessible
name) comes from [`provideMatchLabels()`](/components/match#localization).

| Label                 | Default                                                                     |
| --------------------- | --------------------------------------------------------------------------- |
| `roundMatchCount`     | `(n) => '<n> matches'`, `'1 match'` for one                                 |
| `winnersAdvance`      | `(n) => '<n> winners advance'`, `'1 winner advances'` for one               |
| `continueLabel`       | `(n) => '<n> winners advance to the next stage'`, `'1 winner advances ...'` |
| `champion`            | `(name) => 'Champion: <name>'`                                              |
| `championPending`     | `'Champion not decided yet'`                                                |
| `upperBracketSection` | `'Upper bracket'` - heads the winners rounds in a double-elimination list   |
| `lowerBracketSection` | `'Lower bracket'` - heads the losers rounds in a double-elimination list    |
| `finalsSection`       | `'Finals'` - heads the grand final, bracket reset and third place in a list |
| `participantsLegend`  | `'Participants'` - names the `et-bracket-participants` group                |
| `pickCardPicked`      | `'Your pick'`, announced on the picked side of a locked pick card           |
| `pickCardPredicted`   | `'Prediction'`, announced after a predicted pick-card side                  |

`describeBracketSlot` words a [slot nobody stands on](/components/bracket-prediction#wording-a-slot-nobody-stands-on)
from the same
label set:

| Label                     | Default                                                                     |
| ------------------------- | --------------------------------------------------------------------------- |
| `slotMatchWinner`         | `'Winner of an earlier match'`                                              |
| `slotMatchLoser`          | `'Loser of an earlier match'`                                               |
| `slotStandingRank`        | `(standing, rank) => '<standing> position <rank>'`, either part may be null |
| `slotSeed`                | `(seed) => 'Seed <seed>'`, or `'A seeded slot'` for a null seed             |
| `slotSwissBucket`         | `'Drawn once the round is scheduled'`                                       |
| `slotBye`                 | `'Bye'`                                                                     |
| `slotExternal`            | `'Arrives from another competition'`                                        |
| `slotUnknown`             | `'Not known yet'`                                                           |
| `slotPredictEarlierRound` | `'Predict the earlier round first'`                                         |
| `slotNotPredicted`        | `'Not predicted'`                                                           |

## Custom cards

Each slot is an Angular component rendered per element via `ngComponentOutlet`. Provide
your own to replace any default - as an input, in `provideBracketConfig`, or on a
[layout](#what-a-layout-is-made-of). A bracket with its own match card and the shipped round header
imports just that one default:

```ts
provideBracketConfig({
  layouts: [singleEliminationBracketLayout()],
  matchComponent: AppMatchCardComponent,
  roundHeaderComponent: BracketDefaultRoundHeaderComponent,
});
```

| Input                  | Receives (all `input.required`)                          |
| ---------------------- | -------------------------------------------------------- |
| `matchComponent`       | `bracketRound`, `bracketMatch`, `bracketRoundSwissGroup` |
| `finalMatchComponent`  | same as `matchComponent` (used for final-round matches)  |
| `roundHeaderComponent` | `bracketRound`, `bracketRoundSwissGroup`                 |
| `continueComponent`    | `bracketMatches` (the matches whose winners advance)     |

The linked participants carry ids only (`bracketMatch().home?.id`); names and everything else you show
live in your own `bracketMatch().data`:

```ts
@Component({
  selector: 'app-match-card',
  template: `{{ bracketMatch().data.homeName }} vs {{ bracketMatch().data.awayName }}`,
})
export class AppMatchCardComponent {
  bracketRound = input.required<BracketRound<RoundData, MatchData>>();
  bracketMatch = input.required<BracketMatch<RoundData, MatchData>>();
  bracketRoundSwissGroup = input.required<BracketRoundSwissGroup<RoundData, MatchData> | null>();
}
```

```html
<et-bracket [source]="source" [matchComponent]="AppMatchCardComponent" [finalMatchComponent]="AppFinalCardComponent" />
```

## Prediction brackets

The bracket doubles as the thing a viewer picks the winners in: `resolveBracketSlot()` reads every
slot through their own picks, and `<et-bracket-pick-card>` is the cell they pick in. Those two, the
helper that follows a pick when a pairing changes, the helpers that swap who fills a standing-rank side,
and the labels that word a slot nobody stands on, are all in [bracket prediction](/components/bracket-prediction).

## Double elimination

Upper and lower brackets, the grand final and reverse (bracket-reset) final are laid out
automatically from the round `type`s. Deferred/async lower brackets (where lower-bracket
rounds resolve later than their upper-bracket feeders) are supported and align correctly, as is a
front-truncated winners bracket whose opening round is played elsewhere. It also
[folds](#double-elimination-stacks-two-folds).

<StoryEmbed id="components-sports-bracket--double-elimination" height="520px" />

## Swiss

`swissBracketLayout()` draws `swiss-with-elimination` sources: matches are grouped by the win–loss
record their participants brought into the round (a decided round-1 match still sits in `0-0`) and
each group is wrapped in a border box; connectors run group-to-group (winners advance to the `w+1`
group, losers to the `l+1` group) and fade between group colors. A group a round could hold but has
no match for is not drawn. A participant who sat a round out - a bye, a walkover, an uneven field -
reaches the next round with fewer games than the round number implies; that record gets a group of its
own, sorted in with the rest, best record first.

Everything swiss-only is an option of the factory:

```ts
providers: [
  provideBracketConfig({
    layouts: [
      swissBracketLayout({
        colors: {
          neutral: '#374151',
          positive: '#17D08C', // can still advance
          warning: '#F0B620', // decider
          negative: '#F83B51', // elimination risk
        },
        // cards drawn for swiss sources only - a swiss stage often wants a denser card
        // than the elimination stage beside it
        matchComponent: SwissMatchComponent,
        roundHeaderComponent: SwissRoundHeaderComponent,
      }),
      singleEliminationBracketLayout(),
    ],
  }),
];
```

| Option                 | Purpose                                                                        |
| ---------------------- | ------------------------------------------------------------------------------ |
| `colors`               | Group border and connector colors, keyed by group type (`BracketSwissColors`). |
| `matchComponent`       | The match card for swiss sources only.                                         |
| `roundHeaderComponent` | The round header for swiss sources only.                                       |

The cards sit between a host's inputs and the app-wide `provideBracketConfig` components: input →
layout → config → shipped default. The `swissColors` **input** on `<et-bracket>` still exists and wins
over the factory's `colors`, per instance. Group geometry (`swissGroupPadding`,
`swissGroupBorderRadius`) stays where the rest of the layout geometry is - an input, or
`provideBracketConfig`.

Swiss has no mirrored variant: a stage of standings groups has nothing to fold.

The `components-sports-bracket--swiss` story shows a full stage.

## Continue element

When a stage feeds into a later competition phase, set `showContinueElement` to append a trailing
column whose card receives the matches whose winners advance. Useful for "→ playoffs" hand-offs. It is
ignored by the [mirrored layouts](#mirrored-layouts), which have no trailing edge to hang it off. The
`components-sports-bracket--double-elimination-with-continue` story shows one.

## Mirrored layouts

`mirroredSingleEliminationBracketLayout()` and `mirroredDoubleEliminationBracketLayout()` fold the
bracket in half. Rounds are drawn twice, once on each side, up to the first one that cannot be halved -
one with an odd number of matches, a single match, or none drawn yet. That round and every round after
it is drawn whole in the middle, so a field that is not a power of two converges early instead of
splitting past its own centre, and the final always sits in the middle.

Folding is a [layout](#layouts) of its own rather than a mode on a layout, so you pick it by
registering it (or passing it to the `layouts` input) instead of by binding an input:

```ts
providers: [provideBracketConfig({ layouts: [mirroredSingleEliminationBracketLayout()] })];
```

Elimination brackets only - a swiss stage has no fold to make, so there is no mirrored swiss factory
to reach for.

**It trades height for width, not the other way round.** A 32-team single elimination is `1640×1720`
left-to-right and `2880×880` folded: roughly twice as wide and half as tall. That is what a poster, a
broadcast graphic or a page that scrolls badly downwards wants - it is _not_ the answer to a bracket
that is too wide, which is what [density](#density) and the
[rounds list](/components/bracket-rounds-list) are for.

<StoryEmbed id="components-sports-bracket--mirrored-single-elimination" height="420px" />

### Double elimination stacks two folds

`mirroredDoubleEliminationBracketLayout()` draws **two independent blocks, one above the other**: the
winners bracket folded around its own centre, the losers bracket folded around its own, and an empty
band between them. Both blocks centre on the same middle column, however differently long they are -
the losers bracket runs longer, so the winners block starts a column or two in.

**The middle column is a vertical chain.** Under the round a block's two halves converge on hangs
everything deeper than it: the grand final and then the bracket reset below the winners final, the
third-place playoff below the losers final. That chain is what replaces the run of middle columns the
fold used to need, and with it the long connector the losers bracket's way back used to make under the
finals.

Two consequences worth knowing:

- **The chain carries one round header**, naming the round its two halves converge on. The rounds below
  it are a vertical run of single matches, and a header between each would sit on the line joining
  them - [`<et-bracket-rounds-list>`](/components/bracket-rounds-list) still names every round.
- **The losers champion's line to the grand final runs dashed, beside the middle column.** The two cards
  share a column with the whole chain stacked between them, so it steps out into the gap, runs the
  height of a block and steps back in - dashed, like the [continue element](#continue-element), because it
  carries a participant across rather than joining two neighbouring rounds. `continueLineDashArray`
  sets it.

A round that cannot be halved has no second copy, so a block whose opening round is odd simply never
folds - it comes out left-to-right with its late rounds at the end, which is the honest answer rather
than an error.

## Density

`density` resizes the whole bracket from one input:

| Density     | Column  | Match height | What the cards draw                |
| ----------- | ------- | ------------ | ---------------------------------- |
| `'default'` | `250px` | `75px`       | Emblem, short code, score.         |
| `'compact'` | `140px` | `52px`       | Short code and score - no emblems. |

The cards are not told which density they are in: `compact`'s column is narrower than
[`et-match-card`](/components/match)'s own 150px threshold, so each card measures itself and drops to
its minimal row. One consequence worth knowing - set `columnWidth` below 150px at any density and the
same thing happens.

A density is a **preset, not a mode**: it sits under `provideBracketConfig`, which sits under the
inputs. `density="compact"` with `[columnWidth]="180"` is a compact bracket with 180px columns.

```html
<!-- a full double-elimination bracket inside an article column -->
<et-bracket [source]="source()" density="compact" />
```

The `Components/Sports/Bracket Density` stories in Storybook draw the same bracket at each density,
single- and double-elimination.

## Narrow screens

A bracket is as wide as its rounds make it. There are two supported responses. A results view can
swap to [`<et-bracket-rounds-list>`](/components/bracket-rounds-list). A prediction view can retain
the connectors, set `rowSpanRoundId` to squeeze the visible rounds vertically, and move between them
with `focusRoundId`.

Every cell is positioned with a `transform` and every connector carries its path in the CSS `d`
property as well as in the attribute, so changing either input moves the whole drawing - cards,
headers and lines together - as one CSS transition, with no layout per frame.
`--et-bracket-move-duration` (default `0.2s`) sets its pace; under `prefers-reduced-motion` there is
no transition and the new layout appears at once. Vertical scrolling remains available for tall
rounds.

`focusInset` keeps room to the inline start of the focused round: it is subtracted from the
translation, so the gutter belongs to the grid rather than to the padding of the box that clips it.
That is where a panel's navigation chevrons stand, and what a card badge straddling the card's edge
needs in order not to be clipped.

Use `bracketFitsWidth(source, config, availableWidth)` to make the choice from a measured container
rather than a viewport breakpoint. Measure an ancestor that does not grow with the bracket content.

The `config` you pass those helpers must include the **`layouts`**, because the width of a bracket is
the layout's answer - a folded 32-team bracket is nearly twice as wide as the same source drawn left to
right. A config without a layout for the source's mode throws
[`ET3413`](/components/error-codes#bracket-et34xx), same as rendering it would:

```ts
const naturalWidth = bracketNaturalWidth(source, {
  layouts: [singleEliminationBracketLayout()],
  columnWidth: 220,
});
```

## Loading skeleton

`<et-bracket-skeleton>` stands in for a bracket whose source is still loading. It draws the real
`et-bracket` layout from an empty source of the shape you give it, with skeleton cards, so the swap to
the loaded bracket moves nothing. It is a separate import (`BRACKET_SKELETON_IMPORTS`), so a bracket
that never shows a skeleton bundles none of it.

```html
@if (source(); as source) {
<et-bracket [source]="source" [columnWidth]="220" />
} @else {
<et-bracket-skeleton [shape]="{ mode: 'single-elimination', participantCount: 16 }" [columnWidth]="220" />
}
```

`shape` is `{ mode: 'single-elimination', participantCount, includeThirdPlace? }` or
`{ mode: 'double-elimination', participantCount, includeFinal?, includeReverseFinal?, includeThirdPlace? }`.
`participantCount` must be a power of two - at least 2, or 4 for double elimination - or it throws
[`ET3415`](/components/error-codes#bracket-et34xx). Swiss has no skeleton.

It reads `provideBracketConfig` like any bracket, and takes the layout inputs that change the geometry:
`layouts`, `density`, `columnWidth`, `matchHeight`, `finalColumnWidth`, `finalMatchHeight`,
`roundHeaderHeight`, `roundHeaderGap`, `finalRoundHeaderGap`, `columnGap`, `rowGap`, `rowRoundGap`,
`thirdPlaceTopOffset`, `hideRoundHeaders`, `showContinueElement`, `continueColumnWidth` and
`continueElementHeight`. Bind the same values as the bracket it replaces. Journey highlight is always off.

The drawing is hidden from assistive tech; the [`et-skeleton`](/components/skeleton) around it
announces the wait once. Set `loadingAllyText` for something more specific than the `LOADER_LABELS`
default, and `animated="false"` to drop the shimmer.

For a skeleton of your own, `createPlaceholderBracketSource(shape)` returns the empty source on its
own.

<StoryEmbed id="components-sports-bracket-skeleton--double-elimination" height="520px" />

## Journey highlight

Pointing at the bracket dims the rest of it and lights a participant's path through the
tournament. What gets lit depends on what you point at:

| Under the pointer                | Lit                               |
| -------------------------------- | --------------------------------- |
| One side of a card               | That participant's journey alone. |
| Card chrome, or a connector line | Both participants of that match.  |

Tabbing to a card that is a [link](#making-cells-navigate) previews both journeys the same way,
via `:focus-visible`. All of it runs outside Angular on pointer events and adds
`et-bracket-host--journey-hover` plus `et-bracket-journey-active` on each cell and connector on
the path. Turn the whole thing off with `disableJourneyHighlight`.

### Where a journey ends

A participant's path stops at the match they went out in, and that match says so: it gets a dashed
`et-bracket-journey-endpoint` outline, and the losing row inside it is struck through
(`et-bracket-journey-eliminated`). "Out" means every match of theirs is decided and the last one is
a loss - so a pending lower-bracket match keeps them in, and a champion who dropped a set in the
winners bracket is never marked. In a swiss stage that loss must also be the one that reaches the
elimination threshold, so a first-round loser stays in while the next round is not drawn yet.

### Per-participant hit-testing needs a marked row

Single-participant highlighting works because each participant's row carries
`data-participant-id`. [`et-match-card`](/components/match) sets it, so the shipped cards and
anything built on the card get it for free. A card of your own opts in by setting the same
attribute on the element that represents each side; without it the card behaves as it always
did - hovering anywhere on it lights both journeys.

`et-bracket-pick-card` sets it, so a prediction card hit-tests per side too.

### A prediction bracket wants it off

The highlight reads the **real** source: it names a participant's matches from the bracket the API
returned, not from the viewer's picks. A prediction bracket's later rounds hold no real participant,
so a predicted run has nothing to light - hovering a picked side dims the whole bracket and lights
only the matches that were really played. Set `disableJourneyHighlight` on a bracket a viewer
[predicts in](/components/bracket-prediction).

## Participant focus

Hover is nothing on a touch screen, so a journey can also be **pinned**: bind
`focusedParticipantId` and that participant's path stays lit, with the rest of the bracket dimmed
harder than on hover (`et-bracket-host--journey-focused`).

It is deliberately **driven from outside**. A card's click belongs to the card - it is usually a
link to a match page - so the bracket never pins on a tap, and the affordance is yours: a
participants legend beside the bracket, a search box, a query param. That is also the keyboard and
screen-reader path, since a list of buttons is navigable in a way an absolutely-positioned grid
is not.

The legend ships as `et-bracket-participants` (in `BRACKET_PARTICIPANTS_IMPORTS`): a `role="group"` labelled
from `BRACKET_LABELS.participantsLegend`, with one [pressed](/components/button) `et-button` per
participant. It holds no pin of its own - bind its `focusedParticipantId` two-way to the same
signal as the bracket's. A toggle pins that participant (<kbd>Enter</kbd>/<kbd>Space</kbd> or a
tap), pressing the pinned one again drops the pin, and a pin dropped by the bracket (an Escape
that no open dialog or menu handled, a click past the cells) un-presses the toggle. One Escape drops
one pin. You pass the participants - the bracket's source carries ids,
the names are your data:

```html
<et-bracket-participants [(focusedParticipantId)]="focusedTeamId" [participants]="teams()" />

<et-bracket [(focusedParticipantId)]="focusedTeamId" [source]="source()" />
```

| Input                  | Type                                      | Default | Description                                    |
| ---------------------- | ----------------------------------------- | ------- | ---------------------------------------------- |
| `participants`         | `readonly { id: string; name: string }[]` | -       | Required. One toggle each, in the given order. |
| `focusedParticipantId` | `string \| null`                          | `null`  | Two-way. The pinned participant.               |

The toggles wrap with a `--et-bracket-participants-gap` (`8px`) gap. A search box or query param
drives the same model, so the legend is one option, not a requirement.

The bracket drops the pin on <kbd>Escape</kbd> (anywhere on the page, while pinned) and on a click
that lands past the cells, writing the `null` back through the model - bind it two-way, or listen
to `(focusedParticipantIdChange)` for URL sync and analytics.

The pin outlives the data: a new `source` - a live-updating feed, a lazy first load - is re-marked
against its own cells, so the journey follows the participant to wherever their matches now are. A
pin the current source has never heard of highlights nothing and dims nothing, and lights up on its
own once a source that does contain it arrives - restoring the pin from a query param before the
bracket has loaded is therefore fine.

<StoryEmbed id="components-sports-bracket--participant-focus" height="520px" />

## Accessibility

The layout host is presentational - absolutely-positioned `ul`/`li` scaffolding - so the
semantics live in the cards, and the shipped ones carry them:

- **Every match announces itself as one thing.** The default cards are
  [`et-match-card`](/components/match#accessibility)s, so each cell has a composed accessible
  name ("Neon Esports vs Rote Löwen Pankow, 2 : 1, Finished") rather than a handful of loose
  fragments, and score changes are announced once through a polite live region.
- **The columns are real headings.** The default round header is `role="heading"` with an
  `aria-level` from `roundHeaderLevel` (default `3`) - set it to match where the bracket sits in
  your page's outline, and a screen reader can then walk the bracket by round.
- **The continue cell is a labelled group**, since its visible text is a fragment.
- **The final names its champion** in text, so the result doesn't depend on reading emphasis.
- **Nothing is a click target by default.** Cells navigate only if you supply a
  [card that links](#making-cells-navigate), and then the whole card is one correctly-named link -
  and the only tab stop in its cell. Nothing inside a card is ever a second one.
- **A journey can be followed without a pointer.** Hover highlighting is still a pointer
  affordance, but [pinning](#participant-focus) is not: `focusedParticipantId` is driven by a
  control of yours - the shipped `et-bracket-participants` legend is the usual one - which is
  reachable by keyboard and announced as what it is. <kbd>Escape</kbd> clears the pin. The information is in the cards
  either way; the highlight only makes one path easier to trace.

A card of your own is responsible for its own semantics - the layout engine adds none.

## Theming

Connector and swiss-group-border colors are public custom properties. They default to the
ambient [surface](/core/theming) border color, so the bracket blends into whatever surface
it sits on - set them to override:

| Token                                   | Default                        | Purpose                                                                 |
| --------------------------------------- | ------------------------------ | ----------------------------------------------------------------------- |
| `--et-bracket-line-color`               | `--et-surface-border-solid`    | Connector line color.                                                   |
| `--et-bracket-swiss-group-border-color` | `var(--et-bracket-line-color)` | Swiss group border color (per-group overrides come from `swissColors`). |
| `--et-bracket-move-duration`            | `0.2s`                         | How long a relayout takes - see [Narrow screens](#narrow-screens).      |

These are not declared via `@property`: an `@property` `initial-value` can't contain a
`var()`, and the defaults intentionally resolve to a theme token. The bracket doesn't
provide its own surface - it reads the border color from the surface scope you place it in.

Component CSS ships inside the `@layer components` cascade layer, so app utilities and custom
rules override it without `!important`. See the [components overview](/components/) and
[surface/color theming](/core/theming).

The swiss group-border CSS is not part of the bracket's own stylesheet: `swissBracketLayout()` carries
it as a styles-only component that the host mounts the first time a swiss bracket renders (deduped
app-wide). Nothing to configure - an app that never registers the swiss layout simply never has those
rules in its document.

## Error codes

In dev and prod the bracket throws errors in the **ET34xx** range when a
`BracketDataSource` is malformed or unsupported, when no [layout](#layouts) is registered for its
`mode` ([`ET3413`](/components/error-codes#bracket-et34xx)), or when no [card](#default-cards) is
registered for a cell it draws (`ET3414`), and `createPlaceholderBracketSource` throws `ET3415` for an
unusable `participantCount` - see
[/components/error-codes#bracket-et34xx](/components/error-codes#bracket-et34xx).

Everything the data pipeline throws - the engine and `generateBracketDataForEthlete` - is a
`BracketRuntimeError` with a numeric `code` from `BRACKET_ERROR_CODES`; the card and layout registration
errors (`ET3412`-`ET3414`) are core `RuntimeError`s. `<et-bracket>` throws from inside its source
computation and has no error state, so reject bad data before you hand it over.
`validateBracketSource(source, options)` takes the same options as `createBracket` and returns the
`BracketRuntimeError` it would throw, or `null`:

```ts
protected source = computed(() => {
  const source = generateBracketDataForEthlete(this.apiRounds());
  const error = validateBracketSource(source, { layout: BRACKET_DATA_LAYOUT.LEFT_TO_RIGHT });

  return error ? null : source; // null renders "bracket unavailable"
});
```

## Migrating from `@ethlete/cdk`

This component is the `@ethlete/cdk` `NewBracket` renderer, moved into `@ethlete/components`
and renamed. The layout engine and the `BracketDataSource` shape are unchanged; the breaking changes
are naming, packaging, and how a layout is chosen:

| Area          | `@ethlete/cdk`                                                               | `@ethlete/components`                                                                                             |
| ------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Import        | `BracketNew` namespace / `NewBracket*` from `@ethlete/cdk`                   | flat exports from `@ethlete/components`                                                                           |
| Selector      | `et-new-bracket`                                                             | `et-bracket`                                                                                                      |
| Component     | `NewBracketComponent`                                                        | `BracketComponent` (+ `BRACKET_IMPORTS`)                                                                          |
| Config        | `NewBracketConfig`, `provideNewBracketConfig`, `injectNewBracketConfig`      | `BracketConfig`, `provideBracketConfig`, `injectBracketConfig`                                                    |
| Layout choice | every mode always bundled; `layout="left-to-right" \| "mirrored"` input      | [register layout factories](#layouts) (`layouts` in the config, or the `layouts` input) - mirrored is one         |
| Default cards | `NewBracketDefault*Component`                                                | `BracketDefault*Component`                                                                                        |
| Data types    | `NewBracket`, `NewBracketRound`, `NewBracketMatch`, `createNewBracket`       | `Bracket`, `BracketRound`, `BracketMatch` (build a `BracketDataSource` by hand - see [Data source](#data-source)) |
| CSS classes   | `et-new-bracket*` / `et-bracket-new*` (+ `et-legacy` marker)                 | `et-bracket*` (no `et-legacy`)                                                                                    |
| Color tokens  | `--bracket-line-color` (default `red`), `--bracket-swiss-group-border-color` | `--et-bracket-line-color` / `--et-bracket-swiss-group-border-color` (default `--et-surface-border-solid`)         |
| Errors        | native `Error`                                                               | `BracketRuntimeError` / `RuntimeError` (ET34xx, with a `code`)                                                    |
| Styling       | unlayered global CSS                                                         | wrapped in `@layer components` (utilities override without `!important`)                                          |

Also note:

- The **fifa.gg integration** (`generateBracketDataForGg`, `GgData`) was **not** ported - it
  was app-specific. Convert start-of-stage payloads to a `BracketDataSource` in your app, or
  use `generateBracketDataForEthlete`.
- The default cards are real now (the cdk's were debug boxes) and are built on
  [`et-match-card`](/components/match) - which is why they need a
  [`matchNormalizer`](#the-normalizer). `finalColumnWidth` / `finalMatchHeight` default to
  `360` / `200` to fit the shipped final card; a custom final card can set them back.
- **Nothing renders until a layout is registered.** The cdk renderer bundled every mode's grid builder
  and picked one from the source; here you name the ones your app draws, so a single-elimination-only
  app doesn't ship the swiss or double-elimination renderer. `layout="mirrored"` becomes
  `mirroredSingleEliminationBracketLayout()` / `mirroredDoubleEliminationBracketLayout()`, and swiss's
  own settings move onto `swissBracketLayout({ ... })`.
