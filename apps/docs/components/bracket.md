# Bracket

`<et-bracket>` renders a tournament bracket — single-elimination, double-elimination
(synchronous or deferred/async lower brackets), and swiss-with-elimination stages — as
an absolutely-positioned grid of match cards wired together with SVG connector lines. You
feed it a `BracketDataSource` (build one from your API with the bundled integrations) and
it computes the layout, draws the connectors, and traces a participant's journey through the
tournament on hover or on demand.

Import `BRACKET_IMPORTS` (or `BracketComponent` directly) and **register the
[layouts](#layouts) your app draws** — a layout is an opt-in value, so only the ways of drawing a
bracket you actually name end up in your bundle. `provideBracketConfig({ layouts, ... })` registers
them and sets app-wide defaults for the layout inputs in the same call.

::: warning The default cards need a `matchNormalizer`
The bracket carries your match payload from the data source to the cards untouched, so the
**shipped cards need one function that says how to read it**. Register it once and the
defaults work; leave it out and they render nothing (dev mode throws
[`ET3412`](/components/error-codes#bracket-et34xx)). See
[Default cards](#default-cards).
:::

## Usage

Registering a layout is step one — without one the bracket has no code for your source's `mode` and
throws [`ET3413`](#layouts) rather than guessing:

```ts
import { ApplicationConfig } from '@angular/core';
import {
  normalizeEthleteBracketMatch,
  provideBracketConfig,
  singleEliminationBracketLayout,
} from '@ethlete/components';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBracketConfig({
      // what this app can draw — see Layouts below
      layouts: [singleEliminationBracketLayout()],
      // how to read your match data, for the shipped cards
      matchNormalizer: normalizeEthleteBracketMatch,
    }),
  ],
};
```

```ts
import { Component } from '@angular/core';
import { BRACKET_IMPORTS, BracketDataSource, generateBracketDataForEthlete } from '@ethlete/components';

@Component({
  selector: 'app-standings',
  imports: [BRACKET_IMPORTS],
  template: `<et-bracket [source]="source" />`,
})
export class StandingsComponent {
  // Build the source from your API payload (see Data source below)
  source: BracketDataSource<unknown, unknown> = generateBracketDataForEthlete(apiRounds);
}
```

## Live demo

<StoryEmbed id="components-bracket--single-elimination" height="480px" />

## Layouts

A layout is **how a source is drawn**: it orders the rounds, positions every cell into a grid, and
draws the SVG between them. There is one per tournament mode, plus a mirrored variant for the
elimination modes — and each one is a plain value you create with a factory and register:

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

**Registering is how you pay only for what you draw.** The renderers are big — the swiss one and the
double-elimination grid builder are each several hundred lines — and nothing references them until a
factory you call does, so an app that only ever shows single-elimination brackets ships neither.

| Factory                                    | Source `mode`            | Draws                                                                            | Roughly adds |
| ------------------------------------------ | ------------------------ | -------------------------------------------------------------------------------- | ------------ |
| `singleEliminationBracketLayout()`         | `single-elimination`     | Left to right, converging on the final.                                          | ~150 LOC     |
| `mirroredSingleEliminationBracketLayout()` | `single-elimination`     | The same bracket [folded in half](#mirrored-layouts), final in the middle.       | ~150 LOC     |
| `doubleEliminationBracketLayout()`         | `double-elimination`     | Upper over lower bracket, converging on the grand final (and the bracket reset). | ~600 LOC     |
| `mirroredDoubleEliminationBracketLayout()` | `double-elimination`     | Both brackets [folded](#double-elimination-folds-too), finals in the middle.     | ~600 LOC     |
| `swissBracketLayout(options?)`             | `swiss-with-elimination` | Standings groups per round with group-to-group connectors — see [Swiss](#swiss). | ~690 LOC     |

The two variants of a mode share their builder, so registering both a layout and its mirrored twin
costs almost nothing beyond the first.

### Per instance

Both hosts — `<et-bracket>` and
[`<et-bracket-rounds-list>`](/components/bracket-rounds-list) — take a `layouts` input that
**replaces** the `provideBracketConfig` list for that instance (it does not add to it). That is how
one page draws a bracket folded while the rest of the app draws it left to right:

```html
<et-bracket [layouts]="[mirroredSingleEliminationBracketLayout()]" [source]="source()" />
```

Create the layouts once (a field, or a module constant) rather than in the template expression — a new
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

It throws in dev **and** prod, by design: a bracket that silently drew the wrong shape — or nothing —
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
| `drawEdges`     | Returns the SVG between the cells as an HTML string.                                |
| `listGrouping?` | Splits a round into groups for the rounds list — what swiss uses for standings.     |
| `listSection?`  | Puts a round under a heading in the rounds list — what double elimination uses.     |
| `components?`   | Per-layout default cards, between the host's inputs and `provideBracketConfig`.     |
| `styles?`       | Styles-only components mounted while this layout renders (see [Theming](#theming)). |

The card component types are public (`BracketMatchComponent`, `BracketRoundHeaderComponent`,
`BracketContinueComponent`), so the `components` slot is usable from your own code — that is how
`swissBracketLayout({ matchComponent })` gives swiss sources a denser card than the elimination stage
next to them. The types `createGrid` and `drawEdges` speak in (`ComputedBracketGrid`,
`CreateBracketGridConfig`, `BracketDrawEdgesContext`) are public too, so a layout of your own can wrap
or replace a shipped one — but the SDK's own grid builders stay internal; the five factories are the
supported way to get them.

## Data source

The component never talks to your API directly — it takes a resolved `BracketDataSource`:

```ts
type BracketDataSource<TRoundData, TMatchData> = {
  mode: TournamentMode; // 'single-elimination' | 'double-elimination' | 'swiss-with-elimination'
  rounds: BracketRoundSource<TRoundData>[]; // { id, type, name, data }
  matches: BracketMatchSource<TMatchData>[]; // { id, roundId, home, away, winner, status, data }
};
```

`home` / `away` are participant ids; the engine derives the participant graph (and each
participant's journey) from them. `data` on rounds and matches is opaque to the engine and
handed back to your cards as `bracketRound().data` / `bracketMatch().data`.

The Ethlete API integration builds the source for you:

| Integration | Function                                | Input                                                          |
| ----------- | --------------------------------------- | -------------------------------------------------------------- |
| Ethlete API | `generateBracketDataForEthlete(rounds)` | `RoundStageStructureWithMatchesView[]` (from `@ethlete/types`) |

For any other backend, construct a `BracketDataSource` by hand (or write a small adapter in
your app).

## Options

All layout inputs are numbers (px) unless noted. Each is an **override**: leave one unbound and its
value comes from `provideBracketConfig`, then from the [density](#density) preset, then from the
shipped default listed below. The resolved set is on the component as `settings()`.

| Input                     | Default      | Purpose                                                                              |
| ------------------------- | ------------ | ------------------------------------------------------------------------------------ |
| `source`                  | — (required) | The resolved `BracketDataSource`.                                                    |
| `layouts`                 | —            | Replaces the registered layout list for this instance — see [Layouts](#layouts).     |
| `density`                 | `'default'`  | `'default'` or `'compact'` — see [Density](#density).                                |
| `columnWidth`             | `250`        | Width of a round column.                                                             |
| `matchHeight`             | `75`         | Height of a match card.                                                              |
| `columnGap`               | `60`         | Horizontal gap between round columns.                                                |
| `rowGap`                  | `30`         | Vertical gap between matches in a column.                                            |
| `rowRoundGap`             | `20`         | Vertical gap between the upper/lower halves of a double-elimination round.           |
| `finalColumnWidth`        | `360`        | Width of the final column — sized for the shipped final card.                        |
| `finalMatchHeight`        | `200`        | Height of the final match card — likewise.                                           |
| `roundHeaderHeight`       | `50`         | Height of the round-header row.                                                      |
| `roundHeaderGap`          | `20`         | Gap between the header row and the first match.                                      |
| `hideRoundHeaders`        | `false`      | Drop the header row entirely.                                                        |
| `lineWidth`               | `2`          | Connector stroke width.                                                              |
| `lineStartingCurveAmount` | `10`         | Curve radius where a connector leaves a match.                                       |
| `lineEndingCurveAmount`   | `0`          | Curve radius where a connector meets the next match.                                 |
| `lineDashArray`           | `0`          | Connector dash length (`0` = solid).                                                 |
| `lineDashOffset`          | `0`          | Connector dash offset.                                                               |
| `disableJourneyHighlight` | `false`      | Turn off journey highlighting and pinning entirely.                                  |
| `focusedParticipantId`    | `null`       | Two-way. Pins a participant's journey — see [Participant focus](#participant-focus). |
| `swissGroupPadding`       | `10`         | Padding inside a swiss group border box.                                             |
| `swissGroupBorderRadius`  | `12`         | Corner radius of a swiss group border box.                                           |
| `swissColors`             | —            | Per-group-type colors (see [Swiss](#swiss)).                                         |
| `showContinueElement`     | `false`      | Append a "continue" column (see [Continue element](#continue-element)).              |
| `continueColumnWidth`     | `250`        | Width of the continue column.                                                        |
| `continueElementHeight`   | `75`         | Height of the continue card.                                                         |
| `continueLineDashArray`   | `6`          | Dash length for the continue connectors.                                             |
| `matchNormalizer`         | —            | How to read your match data, for the default cards (see below).                      |
| `roundHeaderLevel`        | `3`          | `aria-level` the default round headers announce themselves at.                       |

## Default cards

Four cards ship with the bracket, and all three match-bearing ones are built on
[`et-match-card`](/components/match):

| Slot         | Default                                                                                                                 |
| ------------ | ----------------------------------------------------------------------------------------------------------------------- |
| Match        | A compact match card — two rows, short codes, the winner emphasized with an accent bar                                  |
| Final match  | A distinct hero cell: the round's name under a trophy, an accent frame in the color theme in scope, and a champion line |
| Round header | The round's name, its swiss group's name where there is one, and its match count — as a real heading                    |
| Continue     | "N winners advance", with an accessible label of its own                                                                |

### The normalizer

The bracket never looks inside your match payload — it hands `TMatchData` from the data source
to the cards and stays out of it. So the default cards need one function that turns a match into
the [normalized shape](/components/match#any-backend-the-normalized-match) they draw:

```ts
import { normalizeEthleteBracketMatch, provideBracketConfig } from '@ethlete/components';

// for an @ethlete/types feed, the normalizer ships with the integration
provideBracketConfig({ matchNormalizer: normalizeEthleteBracketMatch });
```

Any other backend writes its own. It receives the **whole linked match**, not just `data`, so a
payload that holds nothing presentational is not a dead end — participant ids, `winnerSide`,
`status` and the round are all there to build a card from:

```ts
provideBracketConfig({
  matchNormalizer: (match) => ({
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

`[matchNormalizer]` on `<et-bracket>` overrides the provider for one bracket.

### Making cells navigate

The default match card is **not** a link: the bracket can't know your routes and won't guess. A
bracket whose cells navigate wants a `matchComponent` of its own, which is the match card on an
anchor — the whole card becomes the link, correctly named, for free:

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
export class BracketMatchComponent {
  bracketRound = input.required<BracketRound<RoundData, MatchData>>();
  bracketMatch = input.required<BracketMatch<RoundData, MatchData>>();
  bracketRoundSwissGroup = input.required<BracketRoundSwissGroup<RoundData, MatchData> | null>();

  protected normalized = computed(() => myNormalizer(this.bracketMatch()));
}
```

### Localization

The cards' own strings — the match count, "N winners advance", the champion line — come from
`provideBracketLabels()`. Everything inside a match card (TBD, Live, the composed accessible
name) comes from [`provideMatchLabels()`](/components/match#localization).

| Label             | Default                                          |
| ----------------- | ------------------------------------------------ |
| `roundMatchCount` | `(n) => '<n> matches'`                           |
| `winnersAdvance`  | `(n) => '<n> winners advance'`                   |
| `continueLabel`   | `(n) => '<n> winners advance to the next stage'` |
| `champion`        | `(name) => 'Champion: <name>'`                   |
| `championPending` | `'Champion not decided yet'`                     |

## Custom cards

Each slot is an Angular component rendered per element via `ngComponentOutlet`. Provide
your own to replace any default:

| Input                  | Receives (all `input.required`)                          |
| ---------------------- | -------------------------------------------------------- |
| `matchComponent`       | `bracketRound`, `bracketMatch`, `bracketRoundSwissGroup` |
| `finalMatchComponent`  | same as `matchComponent` (used for final-round matches)  |
| `roundHeaderComponent` | `bracketRound`, `bracketRoundSwissGroup`                 |
| `continueComponent`    | `bracketMatches` (the matches whose winners advance)     |

```ts
@Component({
  selector: 'app-match-card',
  template: `{{ bracketMatch().home?.name }} vs {{ bracketMatch().away?.name }}`,
})
export class MatchCardComponent {
  bracketRound = input.required<BracketRound<RoundData, MatchData>>();
  bracketMatch = input.required<BracketMatch<RoundData, MatchData>>();
  bracketRoundSwissGroup = input.required<BracketRoundSwissGroup<RoundData, MatchData> | null>();
}
```

```html
<et-bracket [source]="source" [matchComponent]="MatchCardComponent" [finalMatchComponent]="FinalCardComponent" />
```

## Double elimination

Upper and lower brackets, the grand final and reverse (bracket-reset) final are laid out
automatically from the round `type`s. Deferred/async lower brackets (where lower-bracket
rounds resolve later than their upper-bracket feeders) are supported and align correctly, as is a
front-truncated winners bracket whose opening round is played elsewhere. It also
[folds](#double-elimination-folds-too).

<StoryEmbed id="components-bracket--double-elimination" height="520px" />

## Swiss

`swissBracketLayout()` draws `swiss-with-elimination` sources: matches are grouped by their win–loss
record and each group is wrapped in a border box; connectors run group-to-group (winners advance to
the `w+1` group, losers to the `l+1` group) and fade between group colors. Everything swiss-only is an
option of the factory:

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
        // cards drawn for swiss sources only — a swiss stage often wants a denser card
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
`swissGroupBorderRadius`) stays where the rest of the layout geometry is — an input, or
`provideBracketConfig`.

Swiss has no mirrored variant: a stage of standings groups has nothing to fold.

The `components-bracket--swiss` story shows a full stage.

## Continue element

When a stage feeds into a later competition phase, set `showContinueElement` to append a trailing
column whose card receives the matches whose winners advance. Useful for "→ playoffs" hand-offs. It is
ignored by the [mirrored layouts](#mirrored-layouts), which have no trailing edge to hang it off. The
`components-bracket--double-elimination-with-continue` story shows one.

## Mirrored layouts

`mirroredSingleEliminationBracketLayout()` and `mirroredDoubleEliminationBracketLayout()` fold the
bracket in half. Every round that can be halved — one with an even number of matches — is drawn twice,
once on each side, and the two sides converge on the rounds too small to halve, with the final in the
middle.

Folding is a [layout](#layouts) of its own rather than a mode on a layout, so you pick it by
registering it (or passing it to the `layouts` input) instead of by binding an input:

```ts
providers: [provideBracketConfig({ layouts: [mirroredSingleEliminationBracketLayout()] })];
```

Elimination brackets only — a swiss stage has no fold to make, so there is no mirrored swiss factory
to reach for.

**It trades height for width, not the other way round.** A 32-team single elimination is `1640×1720`
left-to-right and `2880×880` folded: roughly twice as wide and half as tall. That is what a poster, a
broadcast graphic or a page that scrolls badly downwards wants — it is _not_ the answer to a bracket
that is too wide, which is what [density](#density) and the
[rounds list](/components/bracket-rounds-list) are for.

<StoryEmbed id="components-bracket--mirrored-single-elimination" height="420px" />

### Double elimination folds too

With `mirroredDoubleEliminationBracketLayout()` registered, both brackets fold, and each column keeps
its winners-over-losers pairing, so the whole canvas mirrors
rather than the two brackets mirroring separately. Two things follow from the losers bracket running
longer than the winners bracket, and both are correct rather than worth working around:

- **The middle is a run of columns, not one column** — the late rounds of both brackets, which are the
  narrow ones, plus the grand final and the bracket reset.
- **The losers bracket's way back crosses under the finals.** Its fold closes further out than the
  winners bracket's, so that one connector is long. It lands on the right cells; it just has further to go.

A round that cannot be halved has no second copy, so an odd first round simply never folds — the bracket
comes out left-to-right with the final at the end, which is the honest answer rather than an error.

## Density

`density` resizes the whole bracket from one input:

| Density     | Column  | Match height | What the cards draw                |
| ----------- | ------- | ------------ | ---------------------------------- |
| `'default'` | `250px` | `75px`       | Emblem, short code, score.         |
| `'compact'` | `140px` | `52px`       | Short code and score — no emblems. |

The cards are not told which density they are in: `compact`'s column is narrower than
[`et-match-card`](/components/match)'s own 150px threshold, so each card measures itself and drops to
its minimal row. One consequence worth knowing — set `columnWidth` below 150px at any density and the
same thing happens.

A density is a **preset, not a mode**: it sits under `provideBracketConfig`, which sits under the
inputs. `density="compact"` with `[columnWidth]="180"` is a compact bracket with 180px columns.

```html
<!-- a full double-elimination bracket inside an article column -->
<et-bracket [source]="source()" density="compact" />
```

<StoryEmbed id="components-bracket-density--compact-double-elimination" height="520px" />

## Narrow screens

A bracket is as wide as its rounds make it, and no amount of shrinking makes a 32-team grid
readable on a phone. The answer is to swap representation:
[`<et-bracket-rounds-list>`](/components/bracket-rounds-list) draws the same source as a vertical
list of rounds, and `bracketFitsWidth(source, config, availableWidth)` decides when to use it.

The `config` you pass those helpers must include the **`layouts`**, because the width of a bracket is
the layout's answer — a folded 32-team bracket is nearly twice as wide as the same source drawn left to
right. A config without a layout for the source's mode throws
[`ET3413`](/components/error-codes#bracket-et34xx), same as rendering it would:

```ts
const naturalWidth = bracketNaturalWidth(source, {
  layouts: [singleEliminationBracketLayout()],
  columnWidth: 220,
});
```

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
a loss — so a pending lower-bracket match keeps them in, and a champion who dropped a set in the
winners bracket is never marked.

### Per-participant hit-testing needs a marked row

Single-participant highlighting works because each participant's row carries
`data-participant-id`. [`et-match-card`](/components/match) sets it, so the shipped cards and
anything built on the card get it for free. A card of your own opts in by setting the same
attribute on the element that represents each side; without it the card behaves as it always
did — hovering anywhere on it lights both journeys.

## Participant focus

Hover is nothing on a touch screen, so a journey can also be **pinned**: bind
`focusedParticipantId` and that participant's path stays lit, with the rest of the bracket dimmed
harder than on hover (`et-bracket-host--journey-focused`).

It is deliberately **driven from outside**. A card's click belongs to the card — it is usually a
link to a match page — so the bracket never pins on a tap, and the affordance is yours: a
participants legend beside the bracket, a search box, a query param. That is also the keyboard and
screen-reader path, since a list of buttons is navigable in a way an absolutely-positioned grid
is not.

```html
<button (click)="focusedTeamId.set(team.id)" et-button type="button">{{ team.name }}</button>

<et-bracket [(focusedParticipantId)]="focusedTeamId" [source]="source()" />
```

The bracket drops the pin on <kbd>Escape</kbd> (anywhere on the page, while pinned) and on a click
that lands past the cells, writing the `null` back through the model — bind it two-way, or listen
to `(focusedParticipantIdChange)` for URL sync and analytics.

<StoryEmbed id="components-bracket--participant-focus" height="520px" />

## Accessibility

The layout host is presentational — absolutely-positioned `ul`/`li` scaffolding — so the
semantics live in the cards, and the shipped ones carry them:

- **Every match announces itself as one thing.** The default cards are
  [`et-match-card`](/components/match#accessibility)s, so each cell has a composed accessible
  name ("Neon Esports vs. Rote Löwen Pankow, 2 : 1, Finished") rather than a handful of loose
  fragments, and score changes are announced once through a polite live region.
- **The columns are real headings.** The default round header is `role="heading"` with an
  `aria-level` from `roundHeaderLevel` (default `3`) — set it to match where the bracket sits in
  your page's outline, and a screen reader can then walk the bracket by round.
- **The continue cell is a labelled group**, since its visible text is a fragment.
- **The final names its champion** in text, so the result doesn't depend on reading emphasis.
- **Nothing is a click target by default.** Cells navigate only if you supply a
  [card that links](#making-cells-navigate), and then the whole card is one correctly-named link —
  and the only tab stop in its cell. Nothing inside a card is ever a second one.
- **A journey can be followed without a pointer.** Hover highlighting is still a pointer
  affordance, but [pinning](#participant-focus) is not: `focusedParticipantId` is driven by a
  control of yours — a participants list is the usual one — which is reachable by keyboard and
  announced as what it is. <kbd>Escape</kbd> clears the pin. The information is in the cards
  either way; the highlight only makes one path easier to trace.

A card of your own is responsible for its own semantics — the layout engine adds none.

## Theming

Connector and swiss-group-border colors are public custom properties. They default to the
ambient [surface](/core/theming) border color, so the bracket blends into whatever surface
it sits on — set them to override:

| Token                                   | Default                        | Purpose                                                                 |
| --------------------------------------- | ------------------------------ | ----------------------------------------------------------------------- |
| `--et-bracket-line-color`               | `--et-surface-border-solid`    | Connector line color.                                                   |
| `--et-bracket-swiss-group-border-color` | `var(--et-bracket-line-color)` | Swiss group border color (per-group overrides come from `swissColors`). |

These are not declared via `@property`: an `@property` `initial-value` can't contain a
`var()`, and the defaults intentionally resolve to a theme token. The bracket doesn't
provide its own surface — it reads the border color from the surface scope you place it in.

Component CSS ships inside the `@layer components` cascade layer, so app utilities and custom
rules override it without `!important`. See the [components overview](/components/) and
[surface/color theming](/core/theming).

The swiss group-border CSS is not part of the bracket's own stylesheet: `swissBracketLayout()` carries
it as a styles-only component that the host mounts the first time a swiss bracket renders (deduped
app-wide). Nothing to configure — an app that never registers the swiss layout simply never has those
rules in its document.

## Error codes

In dev and prod the bracket throws `RuntimeError`s in the **ET34xx** range when a
`BracketDataSource` is malformed or unsupported, or when no [layout](#layouts) is registered for its
`mode` ([`ET3413`](/components/error-codes#bracket-et34xx)) — see
[/components/error-codes#bracket-et34xx](/components/error-codes#bracket-et34xx).

## Migrating from `@ethlete/cdk`

This component is the `@ethlete/cdk` `NewBracket` renderer, moved into `@ethlete/components`
and renamed. The layout engine and the `BracketDataSource` shape are unchanged; the breaking changes
are naming, packaging, and how a layout is chosen:

| Area          | `@ethlete/cdk`                                                               | `@ethlete/components`                                                                                     |
| ------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Import        | `BracketNew` namespace / `NewBracket*` from `@ethlete/cdk`                   | flat exports from `@ethlete/components`                                                                   |
| Selector      | `et-new-bracket`                                                             | `et-bracket`                                                                                              |
| Component     | `NewBracketComponent`                                                        | `BracketComponent` (+ `BRACKET_IMPORTS`)                                                                  |
| Config        | `NewBracketConfig`, `provideNewBracketConfig`, `injectNewBracketConfig`      | `BracketConfig`, `provideBracketConfig`, `injectBracketConfig`                                            |
| Layout choice | every mode always bundled; `layout="left-to-right" \| "mirrored"` input      | [register layout factories](#layouts) (`layouts` in the config, or the `layouts` input) — mirrored is one |
| Default cards | `NewBracketDefault*Component`                                                | `BracketDefault*Component`                                                                                |
| Data types    | `NewBracket`, `NewBracketRound`, `NewBracketMatch`, `createNewBracket`       | `Bracket`, `BracketRound`, `BracketMatch`, `createBracket`                                                |
| CSS classes   | `et-new-bracket*` / `et-bracket-new*` (+ `et-legacy` marker)                 | `et-bracket*` (no `et-legacy`)                                                                            |
| Color tokens  | `--bracket-line-color` (default `red`), `--bracket-swiss-group-border-color` | `--et-bracket-line-color` / `--et-bracket-swiss-group-border-color` (default `--et-surface-border-solid`) |
| Errors        | native `Error`                                                               | `RuntimeError` (ET34xx)                                                                                   |
| Styling       | unlayered global CSS                                                         | wrapped in `@layer components` (utilities override without `!important`)                                  |

Also note:

- The **fifa.gg integration** (`generateBracketDataForGg`, `GgData`) was **not** ported — it
  was app-specific. Convert start-of-stage payloads to a `BracketDataSource` in your app, or
  use `generateBracketDataForEthlete`.
- The default cards are real now (the cdk's were debug boxes) and are built on
  [`et-match-card`](/components/match) — which is why they need a
  [`matchNormalizer`](#the-normalizer). `finalColumnWidth` / `finalMatchHeight` default to
  `360` / `200` to fit the shipped final card; a custom final card can set them back.
- **Nothing renders until a layout is registered.** The cdk renderer bundled every mode's grid builder
  and picked one from the source; here you name the ones your app draws, so a single-elimination-only
  app doesn't ship the swiss or double-elimination renderer. `layout="mirrored"` becomes
  `mirroredSingleEliminationBracketLayout()` / `mirroredDoubleEliminationBracketLayout()`, and swiss's
  own settings move onto `swissBracketLayout({ ... })`.
