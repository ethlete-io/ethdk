# Line chart

`et-line-chart` draws values along an x axis: a value axis with clean ticks, a category or time axis, a hairline grid, a crosshair tooltip that lists every series at an x, and a visually hidden table with every value. Pass `series` for several lines, `area` to fill under them, and `stacked` to stack them. Import `CHART_IMPORTS`. For categories compared side by side, use the [bar chart](/components/chart).

```ts
import { CHART_IMPORTS } from '@ethlete/components';
```

```html
<et-line-chart [data]="visitors" label="Visitors per month" />
```

```ts
visitors: LineChartDatum[] = [
  { x: 'Jan', value: 1240 },
  { x: 'Feb', value: 1580 },
  { x: 'Mar', value: 2130 },
];
```

## Live demo

<StoryEmbed id="components-data-display-line-chart--multi-series" height="420px" />

## Options

| Input            | Type                                                           | Default   | Description                                                                                                      |
| ---------------- | -------------------------------------------------------------- | --------- | ---------------------------------------------------------------------------------------------------------------- |
| `data`           | `readonly LineChartDatum[] \| readonly LineChartSeriesDatum[]` | -         | Required. The points: `{ x, value }` for one series, `{ x, values }` with `series`. `x` is a string or a `Date`. |
| `label`          | `string`                                                       | -         | Required. Names the chart for assistive tech and captions the table view.                                        |
| `series`         | `readonly LineChartSeries[]`                                   | `[]`      | The series to draw from each datum's `values`. Empty draws one series from each datum's `value`.                 |
| `area`           | `boolean`                                                      | `false`   | Fills the space under each line.                                                                                 |
| `stacked`        | `boolean`                                                      | `false`   | Stacks the series on each other instead of drawing each from zero. Needs two or more series.                     |
| `points`         | `boolean`                                                      | `false`   | Draws a dot at every point, not only at points no line segment shows.                                            |
| `height`         | `number`                                                       | `240`     | Height of the plot area in px. The axis labels sit outside it.                                                   |
| `tickCount`      | `number`                                                       | `5`       | Roughly how many value-axis intervals to draw.                                                                   |
| `valueFormatter` | `((value: number) => string) \| null`                          | `null`    | Formats values on the axis, in the tooltip and in the table.                                                     |
| `dateFormatter`  | `((date: Date) => string) \| null`                             | `null`    | Formats a time axis' instants in the tooltip, the accessible names and the table. Axis ticks keep their format.  |
| `timeZone`       | `string \| null`                                               | `null`    | The IANA time zone a time axis is laid out and labelled in. `null` is the viewer's time zone.                    |
| `xHeader`        | `string \| null`                                               | `null`    | The table view's x column header. `null` reads `Date` on a time axis, else `Category`.                           |
| `valueHeader`    | `string`                                                       | `'Value'` | The table view's value column header in a single-series chart.                                                   |
| `colorToken`     | registered color theme name \| `null`                          | `null`    | The color theme a single-series chart is drawn in, and the fallback for a series without a color.                |

Values are formatted with `Intl.NumberFormat` in the locale from `injectLocale()` (`@ethlete/core`) unless you pass a `valueFormatter`.

## Category and time axes

String `x` values are categories: each gets an equal share of the plot, the point sits in the middle of it, and they stay in `data` order. When the shares get narrower than about 48px, only every second (third, …) category is labelled.

When every `x` is a `Date`, the chart draws a time axis instead. Points sit at their instant, so uneven gaps stay uneven, and `data` is sorted by time. The ticks pick the finest calendar interval that fits the plot width - seconds, minutes, hours, days, weeks (from Monday), months, quarters, half years or years - and sit on wall-clock boundaries of `timeZone`, so a daily tick stays on midnight across a daylight-saving change. A tick on a coarser boundary names that boundary instead: January reads as the year on a monthly axis, midnight as the date on an hourly one. Tick labels, like the tooltip and the table, are formatted with `Intl.DateTimeFormat` in the app locale.

The tooltip and the table name each instant at the resolution the data has: the month (`March 2025`) when every instant is the first of a month, the date (`Mar 30, 2025`) when every instant is a midnight, and date and time otherwise. `dateFormatter` replaces that.

Mixing `Date` and string `x` values throws `ET5120` in dev mode.

<StoryEmbed id="components-data-display-line-chart--time-axis" height="380px" />

## Scale and gaps

The value axis always includes zero and rounds out to a 1, 2 or 5 step, like the bar chart's. Lines are 2px with round joins.

A `null`, missing or non-finite value breaks the line: the series has a gap at that x, and the tooltip and the table leave it out. A point with no defined neighbour on either side gets a dot, so a lone value never disappears. `points` puts a dot on every point.

<StoryEmbed id="components-data-display-line-chart--gaps" height="420px" />

When a chart is first drawn, the lines are revealed from left to right while they fade in. Under `prefers-reduced-motion: reduce` they appear without the animation.

## Several series

Pass `series` and give each datum a `values` record keyed by series `key`. With two or more series a legend names each series above the plot, in series order: a short line per series, or a swatch when `area` is set.

```ts
series: LineChartSeries[] = [
  { key: 'online', label: 'Online' },
  { key: 'boxOffice', label: 'Box office' },
];

data: LineChartSeriesDatum[] = [
  { x: 'Jan', values: { online: 820, boxOffice: 410 } },
  { x: 'Feb', values: { online: 940, boxOffice: 380 } },
];
```

```html
<et-line-chart [data]="data" [series]="series" label="Tickets sold per month" />
```

Series colors come from the app's color palette exactly as for the [bar chart](/components/chart#series-colors): series `i` takes palette entry `i` unless it has its own `colorToken`, and a single series stays on the accent.

## Areas and stacking

`area` fills the space between each line and the zero baseline with a light wash of the series color. With several overlapping series the washes add up, so keep it for one or two series - or stack them.

`stacked` puts each series on top of the ones before it: its line runs at the running total and, with `area`, its fill covers only its own band. Positive values stack up from zero and negative ones down, each side on its own. A missing value leaves a gap in its own series and counts as zero for the series above it. The tooltip lists each series' own value, not the running total.

<StoryEmbed id="components-data-display-line-chart--stacked-area" height="420px" />

## Custom template

`LineChartDirective` (`[etLineChart]`) holds the geometry without markup: `lines()` (per series its `linePath`, `areaPath`, `points` and `colorToken`), `slices()` (per x its `position`, `label`, `entries`, hit `target`, tooltip `anchor` and `description`), `ticks()`, `baseline()`, `valueLabels()`, `xLabels()`, `legendItems()`, `table()`, `plotWidth()` and `formatValue()`. Put `etChartPlot` on the element the chart is laid out in - without one the directive throws `ET5100` in dev mode.

`LineChartSliceDirective` (`[etLineChartSlice]="slice.index"`) makes an element one x of the chart: it takes part in the chart's single tab stop and its arrow-key navigation, opens its tooltip on hover, focus, tap and touch drag, and sets `data-active` while that tooltip is open. Its tooltip inputs are `etLineChartSliceTooltip`, `etLineChartSliceDescription` (required with a template tooltip), `etLineChartSliceAnchor`, `etLineChartSlicePlacement` and `etLineChartSliceShowDelay`.

```html
<div #chart="etLineChart" [data]="data" etLineChart label="Visitors per month">
  <div etChartPlot>
    <svg [attr.width]="chart.plotWidth()" [attr.height]="chart.height()">
      @for (line of chart.lines(); track line.key) {
      <svg:path [attr.d]="line.linePath" fill="none" stroke="currentColor" />
      } @for (slice of chart.slices(); track slice.key) {
      <svg:rect
        [etLineChartSlice]="slice.index"
        [etLineChartSliceTooltip]="slice.description"
        [attr.aria-label]="slice.label"
        [attr.x]="slice.target.x"
        [attr.width]="slice.target.width"
        [attr.height]="slice.target.height"
        fill="transparent"
      />
      }
    </svg>
  </div>
</div>
```

## Accessibility

- The plot is an SVG with `role="group"`, named by `label`. The lines, areas and dots are `aria-hidden`.
- Each x is one element with `role="img"`, named by its x (`Mar`, `Mar 30, 2025`) and described by the values there - `1,240`, or `Online 1,210, Box office 450` with several series.
- The chart is one tab stop. The arrow keys move between the x values and the tooltip follows:

  | Key           | Action             |
  | ------------- | ------------------ |
  | `ArrowRight`  | Next x             |
  | `ArrowLeft`   | Previous x         |
  | `Home`, `End` | First, last x      |
  | `Escape`      | Closes the tooltip |
  | `Tab`         | Leaves the chart   |

  Tabbing back returns to the x you left. The focused x draws a ring around its column.

- Hovering anywhere in an x's column, focusing it from the keyboard, or tapping it shows a crosshair, a dot on every series and a [tooltip](/components/tooltip) that lists every series at that x. It points at the topmost point. Dragging a finger across the plot moves the tooltip to the x under it; a vertical drag still scrolls the page. A tap elsewhere closes it. The hover crosshair only applies on devices that can hover, so it never sticks after a tap.
- The legend is a list of series names, each behind a swatch. Colour is never the only cue: the tooltip and every description name the series.
- A visually hidden `<table>` repeats the data with `label` as its caption, one row per x and one column per series, so a screen reader can read the values as a table.
- The axis labels are `aria-hidden`; the x elements and the table carry the same values.

## Theming

Lines, areas and dots use `--et-theme-color-primary-solid` from the nearest color scope, from the theme named by `colorToken`, or from each series' palette entry. The dots wear a ring in `--et-surface-background-solid`, the crosshair `--et-surface-color-subtle-solid`, the grid `--et-surface-border-solid`, and the axis and legend text `--et-surface-color-muted-solid`. Theme names are registered by the application - see [theming](/core/theming).

| Token                                  | Default | Description                                                       |
| -------------------------------------- | ------- | ----------------------------------------------------------------- |
| `--et-line-chart-font-size`            | `12px`  | Size of the axis and legend labels.                               |
| `--et-line-chart-axis-gap`             | `8px`   | Space between the plot and the axis labels, and under the legend. |
| `--et-line-chart-line-width`           | `2px`   | Stroke width of the lines.                                        |
| `--et-line-chart-area-opacity`         | `0.12`  | Opacity of an area fill.                                          |
| `--et-line-chart-stacked-area-opacity` | `0.32`  | Opacity of a stacked area fill.                                   |
| `--et-line-chart-enter-duration`       | `600ms` | Duration of the entrance reveal.                                  |

## Error codes

The line chart owns `ET5120` - `ET5139` of the chart range - see [error codes](/components/error-codes#chart-et51xx).
