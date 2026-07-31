# Bracket

`<et-bracket>` renders a tournament bracket — single-elimination, double-elimination
(synchronous or deferred/async lower brackets), and swiss-with-elimination stages — as
an absolutely-positioned grid of match cards wired together with SVG connector lines. You
feed it a `BracketDataSource` (build one from your API with the bundled integrations) and
it computes the layout, draws the connectors, and highlights a participant's journey on
hover.

Import `BRACKET_IMPORTS` (or `BracketComponent` directly). App-wide defaults for the
layout inputs can be set once with `provideBracketConfig({ ... })`.

::: warning The default cards need a `matchNormalizer`
The bracket carries your match payload from the data source to the cards untouched, so the
**shipped cards need one function that says how to read it**. Register it once and the
defaults work; leave it out and they render nothing (dev mode throws
[`ET3412`](/components/error-codes#bracket-et34xx)). See
[Default cards](#default-cards).
:::

## Usage

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

All layout inputs are numbers (px) unless noted and can be defaulted app-wide via
`provideBracketConfig`. Defaults below are the component's fallbacks.

| Input                     | Default           | Purpose                                                                    |
| ------------------------- | ----------------- | -------------------------------------------------------------------------- |
| `source`                  | — (required)      | The resolved `BracketDataSource`.                                          |
| `layout`                  | `'left-to-right'` | `'left-to-right'` or `'mirrored'` (finals in the centre).                  |
| `columnWidth`             | `250`             | Width of a round column.                                                   |
| `matchHeight`             | `75`              | Height of a match card.                                                    |
| `columnGap`               | `60`              | Horizontal gap between round columns.                                      |
| `rowGap`                  | `30`              | Vertical gap between matches in a column.                                  |
| `rowRoundGap`             | `20`              | Vertical gap between the upper/lower halves of a double-elimination round. |
| `finalColumnWidth`        | `360`             | Width of the final column — sized for the shipped final card.              |
| `finalMatchHeight`        | `200`             | Height of the final match card — likewise.                                 |
| `roundHeaderHeight`       | `50`              | Height of the round-header row.                                            |
| `roundHeaderGap`          | `20`              | Gap between the header row and the first match.                            |
| `hideRoundHeaders`        | `false`           | Drop the header row entirely.                                              |
| `lineWidth`               | `2`               | Connector stroke width.                                                    |
| `lineStartingCurveAmount` | `10`              | Curve radius where a connector leaves a match.                             |
| `lineEndingCurveAmount`   | `0`               | Curve radius where a connector meets the next match.                       |
| `lineDashArray`           | `0`               | Connector dash length (`0` = solid).                                       |
| `lineDashOffset`          | `0`               | Connector dash offset.                                                     |
| `disableJourneyHighlight` | `false`           | Turn off hover journey highlighting.                                       |
| `swissGroupPadding`       | `10`              | Padding inside a swiss group border box.                                   |
| `swissGroupBorderRadius`  | `12`              | Corner radius of a swiss group border box.                                 |
| `swissColors`             | —                 | Per-group-type colors (see [Swiss](#swiss)).                               |
| `showContinueElement`     | `false`           | Append a "continue" column (see [Continue element](#continue-element)).    |
| `continueColumnWidth`     | `250`             | Width of the continue column.                                              |
| `continueElementHeight`   | `75`              | Height of the continue card.                                               |
| `continueLineDashArray`   | `6`               | Dash length for the continue connectors.                                   |
| `matchNormalizer`         | —                 | How to read your match data, for the default cards (see below).            |
| `roundHeaderLevel`        | `3`               | `aria-level` the default round headers announce themselves at.             |

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
rounds resolve later than their upper-bracket feeders) are supported and align correctly.

<StoryEmbed id="components-bracket--double-elimination" height="520px" />

## Swiss

For `swiss-with-elimination` sources, matches are grouped by their win–loss record and each
group is wrapped in a border box; connectors run group-to-group (winners advance to the
`w+1` group, losers to the `l+1` group) and fade between group colors. Colors are keyed by
group type via `swissColors`:

```ts
swissColors = {
  neutral: '#374151',
  positive: '#17D08C', // can still advance
  warning: '#F0B620', // decider
  negative: '#F83B51', // elimination risk
};
```

<StoryEmbed id="components-bracket--swiss" height="560px" />

## Continue element

When a stage feeds into a later competition phase, set `showContinueElement` (left-to-right
layout only) to append a trailing column whose card receives the matches whose winners
advance. Useful for "→ playoffs" hand-offs.

<StoryEmbed id="components-bracket--double-elimination-with-continue" height="560px" />

## Narrow screens

A bracket is as wide as its rounds make it, and no amount of shrinking makes a 32-team grid
readable on a phone. The answer is to swap representation:
[`<et-bracket-rounds-list>`](/components/bracket-rounds-list) draws the same source as a vertical
list of rounds, and `bracketFitsWidth(source, config, availableWidth)` decides when to use it.

## Journey highlight

Hovering a match or its connector dims the rest of the bracket and highlights that
participant's full path through the tournament. It runs outside Angular on pointer events
and adds `et-bracket-host--journey-hover` / `et-bracket-journey-active` classes. Disable it
with `disableJourneyHighlight`.

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
  [card that links](#making-cells-navigate), and then the whole card is one correctly-named link.
- Journey highlighting is a pointer-only affordance and is not required to understand the
  bracket.

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

## Error codes

In dev and prod the bracket throws `RuntimeError`s in the **ET34xx** range when a
`BracketDataSource` is malformed or unsupported — see
[/components/error-codes#bracket-et34xx](/components/error-codes#bracket-et34xx).

## Migrating from `@ethlete/cdk`

This component is the `@ethlete/cdk` `NewBracket` renderer, moved into `@ethlete/components`
and renamed. The layout engine, inputs, and `BracketDataSource` shape are unchanged — the
breaking changes are naming and packaging:

| Area          | `@ethlete/cdk`                                                               | `@ethlete/components`                                                                                     |
| ------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Import        | `BracketNew` namespace / `NewBracket*` from `@ethlete/cdk`                   | flat exports from `@ethlete/components`                                                                   |
| Selector      | `et-new-bracket`                                                             | `et-bracket`                                                                                              |
| Component     | `NewBracketComponent`                                                        | `BracketComponent` (+ `BRACKET_IMPORTS`)                                                                  |
| Config        | `NewBracketConfig`, `provideNewBracketConfig`, `injectNewBracketConfig`      | `BracketConfig`, `provideBracketConfig`, `injectBracketConfig`                                            |
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
