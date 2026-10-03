# Bracket

Tournament bracket rendering. `et-new-bracket` draws the rounds, matches and connector lines for single elimination, double elimination and Swiss (with elimination) formats from a `BracketDataSource`. The older `et-bracket` is kept for backwards compatibility only - use the new one.

::: warning Superseded by @ethlete/components
This renderer has moved: use the [components bracket](/components/bracket) (`BRACKET_IMPORTS`) for new
code. The layout engine and the `BracketDataSource` shape are unchanged, but `et-new-bracket` becomes
`et-bracket`, every `NewBracket*` export drops the prefix (`provideNewBracketConfig` →
`provideBracketConfig`), each layout is **registered** rather than always bundled, the default cards are
real cards needing a `matchNormalizer`, and `generateBracketDataForGg` was not ported. Its
_Migrating from `@ethlete/cdk`_ section lists every rename. For the same tournament as a vertical list on
narrow viewports, see [bracket rounds list](/components/bracket-rounds-list). This page documents the CDK
version, which still receives bug fixes.
:::

```html
<et-scrollable [etScrollableButtons]="{ sticky: true }">
  <et-new-bracket [source]="source" />
</et-scrollable>
```

```ts
import { BracketNew, NewBracketComponent } from '@ethlete/cdk';

source = BracketNew.generateBracketDataForEthlete(roundsWithMatches);
```

<StoryEmbed id="cdk-bracket-new--double-et-sync" height="520px" />

## The data source

A `BracketDataSource<TRoundData, TMatchData>` is a plain object: a list of rounds (`{ id, type, name, data }`), a list of matches (`{ id, roundId, home, away, winner, status, data }`) and the tournament `mode` (`'single-elimination'`, `'double-elimination'` or `'swiss-with-elimination'`). Two builders are included - `generateBracketDataForEthlete()` maps the Ethlete API's round/match views (inferring the mode from the match type), `generateBracketDataForGg()` maps a gg-shaped source - or you construct the object yourself. The builders and the bracket data types are exported only through the `BracketNew` namespace (`BracketNew.generateBracketDataForEthlete`, `BracketNew.NewBracketMatch`, …), not as top-level names.

## Custom match & header components

The default match, round-header and continue components are debug placeholders meant to be replaced. Pass your own component classes; each receives the linked bracket data as signal inputs. A match or round-header component must declare `bracketRoundSwissGroup` too - the renderer passes it in every mode (`null` outside Swiss), and Angular reports an unknown-input error for an undeclared one:

```ts
@Component({
  template: `{{ bracketMatch().home?.id }} vs {{ bracketMatch().away?.id }}`,
})
export class MyMatchComponent {
  bracketRound = input.required<BracketNew.NewBracketRound<MyRound, MyMatch>>();
  bracketMatch = input.required<BracketNew.NewBracketMatch<MyRound, MyMatch>>();
  bracketRoundSwissGroup = input.required<BracketNew.BracketRoundSwissGroup<MyRound, MyMatch> | null>();
}
```

```html
<et-new-bracket [source]="source" [matchComponent]="MyMatchComponent" [roundHeaderComponent]="MyRoundHeaderComponent" />
```

There are four slots: `matchComponent`, `finalMatchComponent`, `roundHeaderComponent` and `continueComponent` (an element after the last round for "winners advance to the next stage", enabled with `showContinueElement`, left-to-right layout only; it receives `bracketMatches`). App-wide defaults for all of them - and for every geometry value below - can be registered once with `provideNewBracketConfig()`; explicit inputs always win.

## Geometry & appearance

Layout is controlled by numeric inputs (defaults in px): `columnWidth` (250), `matchHeight` (75), `columnGap` (60), `rowGap` (30), plus dedicated values for the final column (`finalColumnWidth` 300, `finalMatchHeight` 75), round headers (`roundHeaderHeight` 50, `roundHeaderGap` 20, or `hideRoundHeaders`) and the continue element. Connector lines are SVG paths with configurable `lineWidth`, curve amounts and dash pattern; their color comes from `--bracket-line-color`.

`layout` is `'left-to-right'` by default; `'mirrored'` (finals in the middle) is supported for single elimination only.

### Swiss specifics

In Swiss mode, rounds are grouped by score (`2-1`, `0-2`, …) with a border drawn around each group (`swissGroupPadding`, `swissGroupBorderRadius`). Groups are classified as neutral / positive / warning / negative based on wins and losses, and colored via the `swissColors` input:

```html
<et-new-bracket
  [source]="swissSource"
  [swissColors]="{ positive: '#17d08c', warning: '#f0b620', negative: '#f83b51' }"
/>
```

<StoryEmbed id="cdk-bracket-new--swiss" height="520px" />

## Journey highlight

Hovering a match (or connector line) highlights the whole journey of its participants through the bracket - every other element dims. Disable it with `disableJourneyHighlight`.
