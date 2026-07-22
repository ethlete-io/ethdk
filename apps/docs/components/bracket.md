# Bracket

`<et-bracket>` renders a tournament bracket — single-elimination, double-elimination
(synchronous or deferred/async lower brackets), and swiss-with-elimination stages — as
an absolutely-positioned grid of match cards wired together with SVG connector lines. You
feed it a `BracketDataSource` (build one from your API with the bundled integrations) and
it computes the layout, draws the connectors, and highlights a participant's journey on
hover.

Import `BRACKET_IMPORTS` (or `BracketComponent` directly). App-wide defaults for the
layout inputs can be set once with `provideBracketConfig({ ... })`.

::: warning Work in progress — cards are placeholders
The round-header, match, final-match and continue **cards currently render as barebones
debug placeholders** (plain boxes showing ids/names). The layout engine, data
integrations, connectors, journey highlight and swiss grouping are complete; the
opinionated default cards are not yet built. Supply your own via the
`matchComponent` / `finalMatchComponent` / `roundHeaderComponent` / `continueComponent`
inputs (or `provideBracketConfig`) until the defaults land — see
[Custom cards](#custom-cards).
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

| Integration | Function | Input |
| --- | --- | --- |
| Ethlete API | `generateBracketDataForEthlete(rounds)` | `RoundStageStructureWithMatchesView[]` (from `@ethlete/types`) |

For any other backend, construct a `BracketDataSource` by hand (or write a small adapter in
your app).

## Options

All layout inputs are numbers (px) unless noted and can be defaulted app-wide via
`provideBracketConfig`. Defaults below are the component's fallbacks.

| Input | Default | Purpose |
| --- | --- | --- |
| `source` | — (required) | The resolved `BracketDataSource`. |
| `layout` | `'left-to-right'` | `'left-to-right'` or `'mirrored'` (finals in the centre). |
| `columnWidth` | `250` | Width of a round column. |
| `matchHeight` | `75` | Height of a match card. |
| `columnGap` | `60` | Horizontal gap between round columns. |
| `rowGap` | `30` | Vertical gap between matches in a column. |
| `rowRoundGap` | `20` | Vertical gap between the upper/lower halves of a double-elimination round. |
| `finalColumnWidth` | `300` | Width of the final column. |
| `finalMatchHeight` | `75` | Height of the final match card. |
| `roundHeaderHeight` | `50` | Height of the round-header row. |
| `roundHeaderGap` | `20` | Gap between the header row and the first match. |
| `hideRoundHeaders` | `false` | Drop the header row entirely. |
| `lineWidth` | `2` | Connector stroke width. |
| `lineStartingCurveAmount` | `10` | Curve radius where a connector leaves a match. |
| `lineEndingCurveAmount` | `0` | Curve radius where a connector meets the next match. |
| `lineDashArray` | `0` | Connector dash length (`0` = solid). |
| `lineDashOffset` | `0` | Connector dash offset. |
| `disableJourneyHighlight` | `false` | Turn off hover journey highlighting. |
| `swissGroupPadding` | `10` | Padding inside a swiss group border box. |
| `swissGroupBorderRadius` | `12` | Corner radius of a swiss group border box. |
| `swissColors` | — | Per-group-type colors (see [Swiss](#swiss)). |
| `showContinueElement` | `false` | Append a "continue" column (see [Continue element](#continue-element)). |
| `continueColumnWidth` | `250` | Width of the continue column. |
| `continueElementHeight` | `75` | Height of the continue card. |
| `continueLineDashArray` | `6` | Dash length for the continue connectors. |

## Custom cards

Each slot is an Angular component rendered per element via `ngComponentOutlet`. Provide
your own to replace the [placeholder defaults](#bracket):

| Input | Receives (all `input.required`) |
| --- | --- |
| `matchComponent` | `bracketRound`, `bracketMatch`, `bracketRoundSwissGroup` |
| `finalMatchComponent` | same as `matchComponent` (used for final-round matches) |
| `roundHeaderComponent` | `bracketRound`, `bracketRoundSwissGroup` |
| `continueComponent` | `bracketMatches` (the matches whose winners advance) |

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

<!-- TODO(bracket): ship opinionated default cards (match, final match, round header, continue)
     using the surface/color theming tokens, then replace the "cards are placeholders" warning
     above with real screenshots/embeds and document each card's slots + tokens here. Until then
     the default components in libs/components/src/lib/bracket/bracket-default-*.component.ts are
     intentionally barebones debug boxes. -->

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

## Journey highlight

Hovering a match or its connector dims the rest of the bracket and highlights that
participant's full path through the tournament. It runs outside Angular on pointer events
and adds `et-bracket-host--journey-hover` / `et-bracket-journey-active` classes. Disable it
with `disableJourneyHighlight`.

## Accessibility

<!-- TODO(bracket): the placeholder cards carry no roles/labels yet. When the default cards
     land, give matches accessible names (participants + score + status), expose the bracket
     as a navigable structure, and document keyboard interaction here. -->

The layout host is presentational (absolutely-positioned `ul`/`li` scaffolding). Accessible
semantics — participant names, scores, result status, and keyboard traversal — belong to the
match/header cards; the barebones defaults don't provide them yet, so **supply accessible
custom cards for production use**. Journey highlighting is a pointer-only affordance and is
not required to understand the bracket.

## Theming

Connector and swiss-group-border colors are public custom properties. They default to the
ambient [surface](/core/theming) border color, so the bracket blends into whatever surface
it sits on — set them to override:

| Token | Default | Purpose |
| --- | --- | --- |
| `--et-bracket-line-color` | `--et-surface-border-solid` | Connector line color. |
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

| Area | `@ethlete/cdk` | `@ethlete/components` |
| --- | --- | --- |
| Import | `BracketNew` namespace / `NewBracket*` from `@ethlete/cdk` | flat exports from `@ethlete/components` |
| Selector | `et-new-bracket` | `et-bracket` |
| Component | `NewBracketComponent` | `BracketComponent` (+ `BRACKET_IMPORTS`) |
| Config | `NewBracketConfig`, `provideNewBracketConfig`, `injectNewBracketConfig` | `BracketConfig`, `provideBracketConfig`, `injectBracketConfig` |
| Default cards | `NewBracketDefault*Component` | `BracketDefault*Component` |
| Data types | `NewBracket`, `NewBracketRound`, `NewBracketMatch`, `createNewBracket` | `Bracket`, `BracketRound`, `BracketMatch`, `createBracket` |
| CSS classes | `et-new-bracket*` / `et-bracket-new*` (+ `et-legacy` marker) | `et-bracket*` (no `et-legacy`) |
| Color tokens | `--bracket-line-color` (default `red`), `--bracket-swiss-group-border-color` | `--et-bracket-line-color` / `--et-bracket-swiss-group-border-color` (default `--et-surface-border-solid`) |
| Errors | native `Error` | `RuntimeError` (ET34xx) |
| Styling | unlayered global CSS | wrapped in `@layer components` (utilities override without `!important`) |

Also note:

- The **fifa.gg integration** (`generateBracketDataForGg`, `GgData`) was **not** ported — it
  was app-specific. Convert start-of-stage payloads to a `BracketDataSource` in your app, or
  use `generateBracketDataForEthlete`.
- The default match/round-header/continue cards are still barebones placeholders (see the
  work-in-progress note at the top); supply custom cards for production.
