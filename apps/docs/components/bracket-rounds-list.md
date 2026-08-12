# Bracket rounds list

`<et-bracket-rounds-list>` draws the same tournament as [`<et-bracket>`](/components/bracket)
as a vertical list of rounds instead of a connected grid - the representation that survives a
phone, an article column, or a match-day page. It takes the same `BracketDataSource`, resolves
the same cards through the same `provideBracketConfig`, and reads your matches through the same
[`matchNormalizer`](/components/bracket#the-normalizer).

Import `BRACKET_IMPORTS` (or `BracketRoundsListComponent` directly), and register the same
[layouts](/components/bracket#layouts) the grid needs - the list draws no connectors, but it asks the
matching layout how to group and section the rounds (see [What it draws](#what-it-draws)).

::: tip This is not only a fallback
A list of "who plays whom this round" is the right thing on a match-day page however much room
there is. The [responsive switch](#responsive-switching) below is one use of it, not the point of it.
:::

```ts
import { Component } from '@angular/core';
import { BRACKET_IMPORTS, BracketDataSource, generateBracketDataForEthlete } from '@ethlete/components';

@Component({
  selector: 'app-match-day',
  imports: [BRACKET_IMPORTS],
  template: `<et-bracket-rounds-list [source]="source" />`,
})
export class MatchDayComponent {
  source: BracketDataSource<unknown, unknown> = generateBracketDataForEthlete(apiRounds);
}
```

## Live demo

<StoryEmbed id="components-sports-bracket-rounds-list--double-elimination" height="520px" />

## What it draws

- **One block per round** - the round's header, then its matches stacked underneath.
- **Sections for double elimination** - the winners bracket, the losers bracket, and the deciding
  rounds (grand final, bracket reset, third place) are grouped under headings. Every other mode is
  one unnamed run of rounds.
- **One block per group in a swiss stage**, the way the grid draws it: a round appears once per
  win–loss group, each under its own header.
- **The final card for the deciding round** - the same rule the grid applies, so a double-elimination
  bracket with a bracket reset crowns the reset, not the grand final.

The last three are the active [layout](/components/bracket#layouts)'s answers, not the list's:
`doubleEliminationBracketLayout()` is what knows a round belongs under "Lower bracket",
`swissBracketLayout()` is what splits a round into standings groups, and a layout may also carry its own
default cards. So the list resolves a layout for the source's `mode` exactly as `<et-bracket>` does -
from `provideBracketConfig({ layouts })` or its own `layouts` input - and throws
[`ET3413`](/components/error-codes#bracket-et34xx) when none matches. Registering the mirrored variant
of a layout changes nothing here: a fold is a statement about a canvas, and a list has none.

What it drops is everything a narrow column can't show: the SVG connectors and the
[journey highlight](/components/bracket#journey-highlight) that rides on them. The layout inputs
(`columnWidth`, gaps, line geometry) are meaningless here and are not accepted.

## Options

| Input                  | Default      | Purpose                                                                               |
| ---------------------- | ------------ | ------------------------------------------------------------------------------------- |
| `source`               | - (required) | The resolved `BracketDataSource` - the same one `<et-bracket>` takes.                 |
| `layouts`              | -            | Replaces the registered [layout](/components/bracket#layouts) list for this instance. |
| `selectedRoundId`      | `null`       | Render only this round, by its id in the source. `null` stacks every round.           |
| `hideRoundHeaders`     | `false`      | Drop the per-round headers.                                                           |
| `roundHeaderLevel`     | `3`          | `aria-level` the default round headers announce themselves at.                        |
| `matchNormalizer`      | -            | How to read your match data, for the default cards.                                   |
| `matchComponent`       | -            | Your own cell for ordinary matches.                                                   |
| `finalMatchComponent`  | -            | Your own cell for the deciding round.                                                 |
| `roundHeaderComponent` | -            | Your own round header.                                                                |

`layouts`, `hideRoundHeaders`, `roundHeaderLevel` and the four component slots also come from
`provideBracketConfig` when you don't bind them, so a config registered for the bracket already
applies here.

## Round switcher

A tournament with sixteen rounds is a long page. `selectedRoundId` narrows the list to one round;
the control that picks it is yours, because a tab bar, a select and a pair of arrows are all
reasonable and the list shouldn't pick for you. The round ids and names are on the source you
already hold:

```ts
@Component({
  template: `
    <button (click)="roundId.set(null)" et-button size="sm" type="button">All rounds</button>

    @for (round of source.rounds; track round.id) {
      <button (click)="roundId.set(round.id)" et-button size="sm" type="button">{{ round.name }}</button>
    }

    <et-bracket-rounds-list [source]="source" [selectedRoundId]="roundId()" />
  `,
})
export class RoundsComponent {
  protected roundId = signal<string | null>(null);
}
```

<StoryEmbed id="components-sports-bracket-rounds-list--round-switcher" height="480px" />

## Responsive switching

A 32-team bracket in a phone viewport is unusable no matter how compact the cards get, so the
answer is to swap representation rather than to shrink. Two exported helpers make the decision:

| Helper                                             | Returns                                                               |
| -------------------------------------------------- | --------------------------------------------------------------------- |
| `bracketNaturalWidth(source, config)`              | How wide `<et-bracket>` would draw this source, in px.                |
| `bracketFitsWidth(source, config, availableWidth)` | Whether that width fits - `bracketNaturalWidth(…) <= availableWidth`. |

Both lay the bracket out for real rather than estimating from the round count, because a
double-elimination grid's width is not a multiple of anything: a wider final column, a continue
column and front-padded rounds all move it. Pass the same layout settings the bracket will run
with, or the prediction is about a different bracket.

That includes the **`layouts`**: the width of a bracket is the layout's answer - a folded bracket is
roughly twice as wide as the same source drawn left to right - so `config.layouts` must hold a layout
for the source's `mode`, or the helpers throw
[`ET3413`](/components/error-codes#bracket-et34xx) just as rendering would. One config object shared
between the provider, the helper and the component is the way to keep them honest.

```ts
@Component({
  selector: 'app-bracket',
  imports: [BRACKET_IMPORTS, SCROLLABLE_IMPORTS, SCROLLABLE_NAVIGATION_IMPORTS],
  template: `
    @if (fitsBracket()) {
      <et-scrollable [etScrollableButtons]="{ sticky: true }">
        <et-bracket [source]="source()" [layouts]="BRACKET_CONFIG.layouts" [columnWidth]="BRACKET_CONFIG.columnWidth" />
      </et-scrollable>
    } @else {
      <et-bracket-rounds-list [source]="source()" [layouts]="BRACKET_CONFIG.layouts" />
    }
  `,
  host: { class: 'block' },
})
export class AppBracketComponent {
  // The host is the measured container. Measure something that does *not* grow with its content -
  // measuring the scroll container itself would always report a fit.
  private dimensions = signalHostElementDimensions();

  public source = input.required<BracketDataSource<unknown, unknown>>();

  // One object: what the helper predicts and what the components draw can't drift apart.
  // (Registered app-wide with provideBracketConfig instead, the `layouts` bindings drop out.)
  protected readonly BRACKET_CONFIG: BracketConfig = {
    layouts: [singleEliminationBracketLayout(), doubleEliminationBracketLayout()],
    columnWidth: 220,
  };

  protected fitsBracket = computed(() =>
    bracketFitsWidth(this.source(), this.BRACKET_CONFIG, this.dimensions().client?.width ?? 0),
  );
}
```

This is a recipe rather than a shipped `<et-bracket-adaptive>` on purpose: the wrapper would have
to forward every layout input of both representations to earn its keep, and the four lines above
don't.

<StoryEmbed id="components-sports-bracket-adaptive--wide" height="520px" />

Zoom and pan over a full-size bracket is the other answer to the same problem, and it stays
backlogged - switching representation reads better on the devices that need it.

## Accessibility

The list is scaffolding - `section` / `ul` / `li` - and the semantics live in the cards, exactly as
they do in [the grid](/components/bracket#accessibility):

- **Each match announces itself as one thing**, because the default cells are
  [`et-match-card`](/components/match#accessibility)s.
- **Rounds are real headings** at `roundHeaderLevel` (default `3`), and a double-elimination
  section heading sits one level above them - so a screen reader walks upper bracket → round →
  matches by structure.
- **Nothing is a click target by default.** Cells navigate only if you supply a
  [card that links](/components/bracket#making-cells-navigate).

## Theming

Three public custom properties, all lengths:

| Token                                  | Default | Controls                                      |
| -------------------------------------- | ------- | --------------------------------------------- |
| `--et-bracket-rounds-list-section-gap` | `32px`  | Space between double-elimination sections.    |
| `--et-bracket-rounds-list-round-gap`   | `20px`  | Space between rounds within a section.        |
| `--et-bracket-rounds-list-match-gap`   | `8px`   | Space between matches, and header to matches. |

Colors come from the ambient [surface theme](/core/theming) - the section headings use
`--et-surface-color-muted-solid`, and everything else is the match card's own.

## Error codes

The list throws the bracket domain's codes; see
[`ET34xx`](/components/error-codes#bracket-et34xx). Most relevantly it needs the same registered
[layout](/components/bracket#layouts) for the source's mode
([`ET3413`](/components/error-codes#bracket-et34xx)) and the same `matchNormalizer` the grid's default
cards need ([`ET3412`](/components/error-codes#bracket-et34xx)).
