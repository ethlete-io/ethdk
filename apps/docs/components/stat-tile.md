# Stat tile

`et-stat-tile` shows one headline number: its label, the value, an optional signed delta against a named period, and an optional sparkline. Reach for it when the story is a single current value - a one-bar bar chart or a two-slice pie is a stat tile in disguise. For a trend the reader has to inspect, use a [line chart](/components/line-chart). Import `STAT_TILE_IMPORTS`.

```ts
import { STAT_TILE_IMPORTS } from '@ethlete/components';
```

```html
<et-card>
  <et-stat-tile
    [value]="4210000"
    [format]="{ style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 }"
    [delta]="0.124"
    [deltaFormat]="{ style: 'percent', maximumFractionDigits: 1 }"
    caption="vs last month"
    label="Revenue"
  >
    <et-stat-tile-sparkline [values]="revenueByMonth" />
  </et-stat-tile>
</et-card>
```

## Live demo

<StoryEmbed id="components-data-display-stat-tile--default" height="240px" />

## Anatomy

The tile renders, top to bottom: the `label`, the value (with `unit` after it, smaller), a footer with the delta and the `caption`, and then whatever you project - usually an `et-stat-tile-sparkline`. Every piece but the label and the value is optional and renders nothing when unset.

The tile has no chrome of its own. Put it in an [`et-card`](/components/card) for the box, and lay a KPI row out with your own grid - the card already carries the surface, padding and border every dashboard tile needs.

<StoryEmbed id="components-data-display-stat-tile--kpi-row" height="420px" />

## Formatting

A number `value` is formatted with `Intl.NumberFormat` in the app locale (`injectLocale()` from `@ethlete/core`). By default it groups below 10,000 and compacts from there, with one fraction digit: `1,284`, `12.9K`, `4.2M`. Pass `format` to change that - either `Intl.NumberFormatOptions`, used as given, or a function that returns the finished string. A string `value` is shown as is, and `null` shows a dash that a screen reader reads as `noValue`.

`deltaFormat` works the same way for the delta and falls back to `format`, so an absolute delta of a currency value is a currency too. Intl options always get `signDisplay: 'exceptZero'` unless they set their own; a function is responsible for its own sign.

```html
<et-stat-tile [value]="212" [delta]="18" goodDirection="down" caption="vs last week" label="p95 latency" unit="ms" />
<et-stat-tile [value]="0.034" [format]="{ style: 'percent', maximumFractionDigits: 1 }" label="Churn rate" />
<et-stat-tile [value]="score" [format]="formatScore" label="Score" />
```

## Delta colour

The delta's direction comes from its sign: up, down, or unchanged at zero. `goodDirection` says which of those is good. A good delta resolves the `success` theme of the tile's surface, a bad one the `error` theme (`injectSemanticColorTheme()`: the theme the surface names, else the one your app registered with that `type`), and the text and arrow use that scope's `--et-theme-color-ink-solid`. An unchanged delta, or any delta with `goodDirection` set to `null`, stays in the muted text colour - use `null` for a metric that has no better direction, like page views.

A theme is looked up only when a delta needs it, so an app that never shows a coloured delta registers neither. The colour only reinforces the direction: the arrow's shape and the sign carry it as well.

## Loading

`loading` replaces the value and the footer with a [skeleton](/components/skeleton) sized like them, keeps the label, sets `aria-busy` on the host and hides a projected sparkline without collapsing its space, so the tile does not jump when the data lands.

<StoryEmbed id="components-data-display-stat-tile--loading" height="240px" />

## Sparkline

`et-stat-tile-sparkline` draws `values` (oldest first, `null` for a gap) as a line in the subtle text colour, scaled to its own minimum and maximum, and marks the last value with a dot in the accent colour (`--et-theme-color-primary-solid`). It has no axes, labels or tooltip; when the reader needs those, project a [line chart](/components/line-chart) instead - the tile renders any projected content in the same slot.

## Options

`et-stat-tile`:

| Input           | Type                       | Default | Description                                                                     |
| --------------- | -------------------------- | ------- | ------------------------------------------------------------------------------- |
| `label`         | `string`                   | -       | Required. The metric's name, in sentence case.                                  |
| `value`         | `number \| string \| null` | -       | Required. A number is formatted, a string shown as given, `null` shows a dash.  |
| `format`        | `StatTileFormat \| null`   | `null`  | Intl options or a function. `null` groups below 10,000 and compacts from there. |
| `unit`          | `string \| null`           | `null`  | Shown after the value, smaller.                                                 |
| `delta`         | `number \| null`           | `null`  | The signed change. Its sign decides the direction.                              |
| `deltaFormat`   | `StatTileFormat \| null`   | `null`  | Like `format`, and falls back to it. Intl options keep the sign.                |
| `goodDirection` | `'up' \| 'down' \| null`   | `'up'`  | Which direction is good. `null` leaves every delta neutral.                     |
| `caption`       | `string \| null`           | `null`  | The comparison the delta is measured against, or a short context line.          |
| `loading`       | `boolean`                  | `false` | Shows a skeleton in place of the value and the footer.                          |

`et-stat-tile-sparkline`:

| Input    | Type                          | Default | Description                         |
| -------- | ----------------------------- | ------- | ----------------------------------- |
| `values` | `readonly (number \| null)[]` | -       | Required. The series, oldest first. |

## Accessibility

The tile reads as one sentence, in visual order: "Revenue, $4.2M, Up +12.4% vs last month". The arrow is `aria-hidden`; in its place a visually hidden word names the direction (`up`, `down` or `unchanged` from `STAT_TILE_LABELS`), so the reading never depends on the colour or on a formatter keeping the sign. The sparkline is `aria-hidden` too - the value, the delta and the caption carry what it shows - so put anything a reader must not miss into the caption.

While `loading`, the host has `aria-busy="true"` and the skeleton announces `LOADER_LABELS`' `loadingContent` once. Localize the tile's own strings with `provideStatTileLabels({ up: '…', down: '…', unchanged: '…', noValue: '…' })` - see [localization](/components/localization).

The success and error themes your app registers decide the delta's text contrast. If a theme's primary colour is too light for text on a surface, give its swatch an `inkColor` - the tile reads the ink token, never the primary itself.

## Theming

Public design tokens on `et-stat-tile`: `--et-stat-tile-gap`, `--et-stat-tile-label-font-size`, `--et-stat-tile-value-font-size`, `--et-stat-tile-value-font-weight`, `--et-stat-tile-footer-font-size`, `--et-stat-tile-sparkline-gap`. On `et-stat-tile-sparkline`: `--et-stat-tile-sparkline-height`, `--et-stat-tile-sparkline-line-width`, `--et-stat-tile-sparkline-current-size`.

Text colours come from the surface tokens (`--et-surface-color-solid` for the value, `--et-surface-color-muted-solid` for the label, unit and caption), so a tile reads correctly on every surface it sits on. The delta and the sparkline's last point come from the colour theme in scope - see [theming](/core/theming).
