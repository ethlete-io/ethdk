# Chart

`et-bar-chart` draws bars: a value axis with clean ticks, the category beside each bar, a hairline grid and a visually hidden table with every value. It draws one series by default; give it `series` for grouped or stacked bars with a legend, and `orientation="horizontal"` for bars that grow to the right. Import `CHART_IMPORTS`.

```ts
import { CHART_IMPORTS } from '@ethlete/components';
```

```html
<et-bar-chart [data]="signUps" label="Sign-ups per month" />
```

```ts
signUps: BarChartDatum[] = [
  { label: 'Jan', value: 1240 },
  { label: 'Feb', value: 1580 },
  { label: 'Mar', value: 2130 },
];
```

## Live demo

<StoryEmbed id="components-data-display-bar-chart--default" height="380px" />

## Options

| Input            | Type                                                         | Default      | Description                                                                                               |
| ---------------- | ------------------------------------------------------------ | ------------ | --------------------------------------------------------------------------------------------------------- |
| `data`           | `readonly BarChartDatum[] \| readonly BarChartSeriesDatum[]` | -            | Required. The categories, in order: `{ label, value }` for one series, `{ label, values }` with `series`. |
| `label`          | `string`                                                     | -            | Required. Names the chart for assistive tech and captions the table view.                                 |
| `series`         | `readonly BarChartSeries[]`                                  | `[]`         | The series to draw from each datum's `values`. Empty draws one series from each datum's `value`.          |
| `layout`         | `'grouped' \| 'stacked'`                                     | `'grouped'`  | How several series share a category: side by side, or stacked on one bar.                                 |
| `orientation`    | `'vertical' \| 'horizontal'`                                 | `'vertical'` | Which way the bars grow: up from a horizontal baseline, or right from a vertical one.                     |
| `height`         | `number`                                                     | `240`        | Height of the plot area in px. The axis labels sit outside it.                                            |
| `tickCount`      | `number`                                                     | `5`          | Roughly how many value-axis intervals to draw.                                                            |
| `maxBarWidth`    | `number`                                                     | `24`         | The thickest a bar gets in px. A wider band keeps the rest as space between bars.                         |
| `valueFormatter` | `((value: number) => string) \| null`                        | `null`       | Formats values on the axis, in the tooltips and in the table.                                             |
| `categoryHeader` | `string`                                                     | `'Category'` | The table view's category column header.                                                                  |
| `valueHeader`    | `string`                                                     | `'Value'`    | The table view's value column header in a single-series chart.                                            |
| `colorToken`     | registered color theme name \| `null`                        | `null`       | The color theme a single-series chart is drawn in, and the fallback for a series without a color.         |

Without a `valueFormatter`, values are formatted with `Intl.NumberFormat` in the locale from `injectLocale()` (`@ethlete/core`), so `3320` reads `3,320` in English.

## Scale and layout

The value axis always includes zero and rounds out to a 1, 2 or 5 step, so `[12, 87, 40]` gets the ticks `0, 20, … 100`. Negative values grow down from the zero baseline (left, when horizontal) and are rounded at that end.

Every category gets an equal band of the plot, and the bar is centered in it, capped at `maxBarWidth`, with at least 2px between neighbouring bars. Bars are square at the baseline and rounded 4px at the data end. The width comes from the element the chart sits in; the height is `height`, for either orientation.

When a bar is first drawn it grows from the baseline and fades in. Under `prefers-reduced-motion: reduce` it appears without the animation.

## Several series

Pass `series` and give each datum a `values` record keyed by series `key`. A missing (`null` or absent) value draws no bar and leaves the table cell empty; `0` draws a bar with no height.

```ts
series: BarChartSeries[] = [
  { key: 'online', label: 'Online' },
  { key: 'boxOffice', label: 'Box office' },
  { key: 'partners', label: 'Partners' },
];

data: BarChartSeriesDatum[] = [
  { label: 'Jan', values: { online: 820, boxOffice: 410, partners: 160 } },
  { label: 'Feb', values: { online: 940, boxOffice: 380, partners: 210 } },
];
```

```html
<et-bar-chart [data]="data" [series]="series" label="Tickets sold per month" />
```

With two or more series a legend names each series above the plot, in series order.

<StoryEmbed id="components-data-display-bar-chart--grouped" height="420px" />

### Grouped and stacked

`layout="grouped"` (the default) puts the bars of one category side by side, 2px apart, and keeps air between categories. `layout="stacked"` draws one bar per category and stacks the series on it in order, with a 2px gap between segments; only the outermost segment gets the rounded end.

Positive values stack up from the baseline and negative values stack down from it, each side on its own - a category with income and costs reads as one bar crossing zero. The value axis spans the largest total on either side. A zero or missing value takes no segment.

<StoryEmbed id="components-data-display-bar-chart--stacked-negative" height="420px" />

### Series colors

The chart reads the app's [color palette](/core/theming#offering-colors-to-a-user) (`provideColorPalette`, optional): series `i` is drawn in palette entry `i`, so the palette order is the app's categorical order. A series with its own `colorToken` uses that instead. Without a palette, or past its end, a series takes `colorToken` from the chart, then the surrounding accent.

A single series never takes a palette entry - it stays on the accent (or `colorToken`), so a lone series matches the rest of the page.

Colors follow the series' position in `series`. When series come and go (a filter, say), give each one its own `colorToken` so a survivor keeps its color. In dev mode the chart warns when two series would share one color.

```ts
providers: [
  provideColorPalette([
    { token: 'ocean', label: 'Ocean' },
    { token: 'sunset', label: 'Sunset' },
    { token: 'meadow', label: 'Meadow' },
  ]),
];
```

`ocean`, `sunset` and `meadow` stand for themes the app registered. A palette is one set of colors; for a dark surface, provide a second palette with steps chosen for it, as the `GroupedDark` story does.

## Horizontal bars

`orientation="horizontal"` lists the categories top to bottom with their labels on the left, and puts the value axis under the plot. It suits long category names and many categories. The label column takes at most 40% of the chart's width and cuts a longer label off with an ellipsis. Grouped and stacked layouts work the same way.

<StoryEmbed id="components-data-display-bar-chart--horizontal" height="360px" />

## Custom template

`BarChartDirective` (`[etBarChart]`) holds the geometry without markup: `bars()` (per bar its rect, `path`, hit `target`, tooltip `anchor` and `placement`, `series`, `colorToken`, `valueText` and a `name` such as `Mar, Online`), `ticks()`, `baseline()`, `categoryLabels()`, `valueLabels()`, `legendItems()`, `table()`, `plotWidth()` and `formatValue()`. Put `etChartPlot` on the element the bars are laid out in - its width is what the bands divide. Without one the directive throws `ET5100` in dev mode. `etBarChartPlot` still works as another name for it.

```html
<div #chart="etBarChart" [data]="data" etBarChart label="Sign-ups per month">
  <div etChartPlot>
    <svg [attr.width]="chart.plotWidth()" [attr.height]="chart.height()">
      @for (bar of chart.bars(); track bar.key) {
      <svg:path [attr.d]="bar.path" />
      }
    </svg>
  </div>
</div>
```

## Accessibility

- The plot is an SVG with `role="group"`, named by `label`.
- Each bar is focusable (`tabindex="0"`) with `role="img"`, named by its category - plus its series with several series, as in `Mar, Online` - and described by its formatted value. Tab walks the bars category by category, and through the series of a category in series order; focus draws a ring around the bar's hit target.
- Hovering a bar, focusing it from the keyboard, or tapping it opens a [tooltip](/components/tooltip) with the value, the series and the category. It points at the bar's data end - above a positive bar, below a negative one, to the side of a horizontal one - while a larger area stays the hit target: the bar's share of its band, or its segment's stretch of the column when stacked. A tap elsewhere closes it. The hover tint only applies on devices that can hover, so it never sticks after a tap.
- The legend is a list of series names, each behind a swatch. Colour is never the only cue: every bar's name carries its series.
- A visually hidden `<table>` repeats the data with `label` as its caption, `categoryHeader` over the categories and one column per series (`valueHeader` with a single series), so a screen reader can read the values as a table.
- The axis labels are `aria-hidden`; the bars and the table carry the same values.

## Theming

The bars use `--et-theme-color-primary-solid` from the nearest color scope, from the theme named by `colorToken`, or from each series' palette entry. The grid uses `--et-surface-border-solid`, the axis and legend text `--et-surface-color-muted-solid`. Theme names are registered by the application - see [theming](/core/theming).

| Token                           | Default | Description                                                       |
| ------------------------------- | ------- | ----------------------------------------------------------------- |
| `--et-bar-chart-font-size`      | `12px`  | Size of the axis, category and legend labels.                     |
| `--et-bar-chart-axis-gap`       | `8px`   | Space between the plot and the axis labels, and under the legend. |
| `--et-bar-chart-enter-duration` | `400ms` | Duration of the bar entrance animation.                           |

## Error codes

The chart domain owns `ET51xx` - see [error codes](/components/error-codes#chart-et51xx).
