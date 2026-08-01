# Standings

A league or group table: positions, participants, played/won/drawn/lost, the points they rank by, and recent
form where the competition reports it. With position **zones** - promotion, playoffs, relegation, advancing
out of a group - that band the rows and draw their own legend.

Import `STANDINGS_IMPORTS`. No provider is required; `provideStandingsLabels()` localizes the strings.

```html
<et-standings [rows]="rows()" [zones]="zones" [highlightedRowId]="myTeamId()" />
```

```ts
import { STANDINGS_IMPORTS, StandingsZone, normalizeEthletePlacement } from '@ethlete/components';

@Component({ imports: [STANDINGS_IMPORTS] })
export class GroupTableComponent {
  protected rows = computed(() => this.query.response()?.placements.map(normalizeEthletePlacement) ?? []);

  // `color` names one of your registered color themes - this library ships none
  protected readonly zones: StandingsZone[] = [
    { from: 1, to: 2, color: 'success', label: 'Advances to the playoffs' },
    { from: 18, to: 20, color: 'danger', label: 'Relegated' },
  ];
}
```

## Live demo

<StoryEmbed id="components-standings--default" height="480px" />

## Any backend: the normalized row

Same philosophy as the [match card](/components/match#any-backend-the-normalized-match) - the table takes a
view-model this library owns, and an adapter maps your API into it:

```ts
type NormalizedStandingRow = {
  id: string; // stable identity, for tracking rows across updates
  position: number; // 1-based; rows are drawn in the order given, never re-sorted
  participant: NormalizedMatchParticipant | null; // null renders the TBD placeholder
  played: number;
  wins: number;
  ties: number;
  losses: number;
  points: number; // what the table ranks by
  difference: number | null; // goal/game difference, when the competition tracks one
  form: ('win' | 'loss' | 'tie')[] | null; // recent results, oldest first
};
```

The table **does not sort**. Whatever order you pass is the order drawn, because the tiebreakers that decide
a real table (head-to-head, goals scored, fair-play points) live in the competition's rules, not in a UI
component.

| Export                                 | Maps                                                                                           |
| -------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `normalizeEthletePlacement(placement)` | `PlacementView` → `NormalizedStandingRow`                                                      |
| `normalizeEthleteGroupRanking(opts)`   | `GroupRankingView` → `{ caption, rows, zones }`, with `qualifiedPlayers` as the advancing zone |

Two mapping notes: `score` is what the API ranks by so it becomes `points`, and the list views carry no form
history - fill `form` in yourself if you have it elsewhere.

## Zones

A zone is a band of positions that means something. One config drives both the row banding and the legend,
which is what stops the two from drifting apart:

```ts
{ from: 1, to: 2, color: 'success', label: 'Advances to the playoffs' }
```

`color` names one of **your** registered color themes - this library ships none and hardcodes none, so what
"advancing" looks like is your app's decision (see [theming](/core/theming)). The row is scoped to that
theme, so its accent bar and tint come out in it.

Zones must not overlap: a row in two bands has no defined appearance, and dev mode throws
[`ET4400`](/components/error-codes#standings-et44xx) naming the two zones. Set `showLegend` to `false` to
band the rows without explaining them.

## Two densities

Like the match card, the table measures itself and drops columns rather than scrolling sideways:

| Width     | Columns                                           |
| --------- | ------------------------------------------------- |
| < 560px   | Position, participant, points                     |
| 560–719px | …plus played, won, drawn, lost and the difference |
| ≥ 720px   | …plus recent form                                 |

<StoryEmbed id="components-standings--compact" height="420px" />

A column nobody reports is dropped entirely: no row with a `difference` means no difference column, and no
row with `form` means no form column - an empty column is worse than a missing one.

## Options

| Input              | Type                               | Default | What it does                                                     |
| ------------------ | ---------------------------------- | ------- | ---------------------------------------------------------------- |
| `rows`             | `readonly NormalizedStandingRow[]` | -       | Required. Drawn in the order given.                              |
| `zones`            | `readonly StandingsZone[]`         | `[]`    | Position bands (see [Zones](#zones)).                            |
| `highlightedRowId` | `string \| null`                   | `null`  | The `id` of the row to single out - "your team".                 |
| `showLegend`       | `boolean`                          | `true`  | Draw the legend under the table. No zones, no legend either way. |
| `labels`           | `Partial<StandingsLabels> \| null` | `null`  | Per-instance string overrides.                                   |

## Localization

Every string comes from `provideStandingsLabels()`, app-wide or per instance via `labels`. Column headers
have two labels each - the abbreviation on screen and the word for assistive tech:

```ts
provideStandingsLabels({
  caption: 'Tabelle',
  participant: 'Verein',
  points: 'Pkt',
  pointsFull: 'Punkte',
  ties: 'U',
  tiesFull: 'Unentschieden',
  highlightedRow: 'Dein Verein',
});
```

## Accessibility

- **A real `<table>`**, so it can be navigated cell by cell with the column and row announced. The
  `<caption>` names it (visually hidden - the page's own heading usually says it already), every column
  header is a `<th scope="col">`, and each **position is a `<th scope="row">`** because that is what
  identifies the row.
- **Abbreviations are spelled out.** Every abbreviated header carries `abbr`, so "P" is read as "Played".
- **Zones are never colour-only.** A banded row carries its zone's label as visually hidden text, so a
  screen reader hears "Advances to the playoffs" on the row itself - the legend is a separate element a
  row-by-row reader never reaches.
- **The highlighted row** is `aria-current="true"` and carries the `highlightedRow` label the same way.
- **Form is labelled per result** ("Win", "Draw", "Loss"), since the column is a row of coloured squares.
- Dropped columns are dropped from the DOM or set to `display: none`, so assistive tech never announces a
  column the reader can't see.

## Theming

Colors come from the app-registered [surface and color theme](/core/theming) systems: surface tokens for the
table's text, borders and row banding, and the zone's own color theme for its accent bar and tint. Recent
form is drawn from surface tokens rather than a green/amber/red this library invents - the shape of the
streak is what the column is for, and every dot is labelled.

| Token                                | Default | What it sets                              |
| ------------------------------------ | ------- | ----------------------------------------- |
| `--et-standings-row-height`          | `44px`  | Row and header height                     |
| `--et-standings-cell-padding-inline` | `8px`   | Horizontal cell padding                   |
| `--et-standings-zone-bar-width`      | `3px`   | Width of a zone's inline-start accent bar |
| `--et-standings-font-size`           | `13px`  | Table text, including participant names   |

## Error codes

The standings domain owns `ET4400`–`ET4499` - see
[error codes](/components/error-codes#standings-et44xx).
