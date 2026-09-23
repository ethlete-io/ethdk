# Pie chart

`et-pie-chart` draws a part-to-whole: a pie, or a donut with `innerRadius`, a legend listing every value with its share, and a visually hidden table. Use it for a handful of parts that add up to one whole - up to about six; for close values or more parts, a [bar chart](/components/chart) reads better. Import `CHART_IMPORTS`.

```ts
import { CHART_IMPORTS } from '@ethlete/components';
```

```html
<et-pie-chart [data]="devices" label="Sessions by device" />
```

```ts
devices: PieChartDatum[] = [
  { label: 'Mobile', value: 5820 },
  { label: 'Desktop', value: 3410 },
  { label: 'Tablet', value: 740 },
  { label: 'Smart TV', value: 230 },
];
```

## Live demo

<StoryEmbed id="components-data-display-pie-chart--default" height="320px" />

## Options

| Input            | Type                                  | Default      | Description                                                                                      |
| ---------------- | ------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------ |
| `data`           | `readonly PieChartDatum[]`            | -            | Required. The slices, in drawing order: `{ label, value, colorToken? }`.                         |
| `label`          | `string`                              | -            | Required. Names the chart for assistive tech and captions the table view.                        |
| `size`           | `number`                              | `200`        | The largest the circle's diameter gets in px. A narrower container shrinks it.                   |
| `innerRadius`    | `number`                              | `0`          | The donut hole as a share of the radius, from `0` (a pie) to `0.9`.                              |
| `showTotal`      | `boolean`                             | `false`      | Shows the formatted total in the donut hole, above `totalLabel`. No effect on a pie.             |
| `totalLabel`     | `string`                              | `'Total'`    | The caption under the total.                                                                     |
| `valueFormatter` | `((value: number) => string) \| null` | `null`       | Formats values in the legend, the tooltips, the total and the table.                             |
| `categoryHeader` | `string`                              | `'Category'` | The table view's category column header.                                                         |
| `valueHeader`    | `string`                              | `'Value'`    | The table view's value column header.                                                            |
| `shareHeader`    | `string`                              | `'Share'`    | The table view's share column header.                                                            |
| `colorToken`     | registered color theme name \| `null` | `null`       | The accent the slices without a color of their own are drawn in steps of. See [colors](#colors). |

Without a `valueFormatter`, values are formatted with `Intl.NumberFormat` in the locale from `injectLocale()` (`@ethlete/core`); shares use the same locale's percent format.

## Slices and shares

Slices start at 12 o'clock and run clockwise in the order of `data` - the chart never sorts them, and it never folds small slices into an "Other" slice. Sort the data, or group the tail yourself, before handing it over.

Every share is a whole percentage, rounded so that the shares in the legend and the table always add up to exactly 100%. Neighbouring slices are 2px apart, the same width from the centre to the rim.

- **A value of 0** draws no slice and is no tab stop, but keeps its row in the legend and the table, at 0%.
- **A negative or non-finite value** is not a part of a whole: it counts as 0 as well, and in dev mode the chart warns with `ET5140`.
- **A single slice** (or one positive value among zeros) draws a full disc or ring, without a gap.
- **No positive value at all** draws an empty hairline circle.

When a slice is first drawn it fades in, each slice a little after the one before. The outline itself never animates. Under `prefers-reduced-motion: reduce` the slices appear without the fade.

## Donut

`innerRadius` cuts the hole. With `showTotal` the hole shows the sum of all slices; for anything else, project content marked `etPieChartCenter`. It is centred in the hole and sized to fit inside it.

```html
<et-pie-chart [data]="devices" [innerRadius]="0.6" showTotal label="Sessions by device" />

<et-pie-chart [data]="devices" [innerRadius]="0.6" label="Sessions by device">
  <span etPieChartCenter>Last 30 days</span>
</et-pie-chart>
```

<StoryEmbed id="components-data-display-pie-chart--donut-total" height="320px" />

## Colors

The chart reads the app's [color palette](/core/theming#offering-colors-to-a-user) (`provideColorPalette`, optional): slice `i` is drawn in palette entry `i`. A slice with its own `colorToken` uses that instead - give each slice one when slices come and go, so a survivor keeps its color.

Slices that neither the palette nor their own `colorToken` cover are drawn in steps of the accent (`colorToken` on the chart, else the surrounding color scope), from full strength down to a 40% mix with the surface. Without a palette, every slice is such a step. A single slice stays on the accent.

<StoryEmbed id="components-data-display-pie-chart--many-slices" height="340px" />

A palette is one set of colors; for a dark surface, provide a second palette with steps chosen for it, as the `Dark` story does.

## Layout

The legend sits beside the circle and wraps below it when the container is too narrow for both, as on a phone. Each legend row shows the swatch, the label, the formatted value and the share.

## Custom template

`PieChartDirective` (`[etPieChart]`) holds the geometry without markup: `slices()` (per slice its `path`, `startAngle`, `endAngle`, tooltip `anchor` and `placement`, `colorToken`, `accentMix`, `valueText`, `percentText` and `description`), `entries()` (every datum, including the ones that draw no slice), `diameter()`, `radius()`, `holeRadius()`, `total()`, `totalText()`, `table()` and `formatValue()`. Put `etChartPlot` on the element the circle is fitted in - its width caps the diameter. Without one the directive throws `ET5100` in dev mode.

```html
<div #chart="etPieChart" [data]="data" etPieChart label="Sessions by device">
  <div etChartPlot>
    <svg [attr.width]="chart.diameter()" [attr.height]="chart.diameter()">
      @for (slice of chart.slices(); track slice.key) {
      <svg:path [attr.d]="slice.path" />
      }
    </svg>
  </div>
</div>
```

## Accessibility

- The circle is an SVG with `role="group"`, named by `label`.
- Each slice is focusable (`tabindex="0"`) with `role="img"`, named by its label and described by its value and share, as in `5,820 (57%)`. Tab walks the slices in data order; focus draws a ring around the slice.
- Hovering a slice, focusing it from the keyboard, or tapping it opens a [tooltip](/components/tooltip) with the value, the label and the share. It points at the middle of the slice's outer arc and opens on the side of the circle the slice sits on - to the right of a slice at 3 o'clock, below one at 6 o'clock. When that side has no room, the tooltip flips to the other side. A tap elsewhere closes it. The hover tint only applies on devices that can hover, so it never sticks after a tap.
- The legend repeats every label with its value and share as text, so a color is never the only cue.
- A visually hidden `<table>` repeats the data with `label` as its caption and `categoryHeader`, `valueHeader` and `shareHeader` as its columns.

## Theming

The slices use `--et-theme-color-primary-solid` from each slice's color theme, or a mix of the accent with `--et-surface-background-solid`. The legend text uses `--et-surface-color-muted-solid`, its values and the donut total `--et-surface-color-solid`, and the empty circle `--et-surface-border-solid`. Theme names are registered by the application - see [theming](/core/theming).

| Token                           | Default | Description                                        |
| ------------------------------- | ------- | -------------------------------------------------- |
| `--et-pie-chart-font-size`      | `12px`  | Size of the legend and centre text.                |
| `--et-pie-chart-legend-gap`     | `24px`  | Space between the circle and the legend.           |
| `--et-pie-chart-enter-duration` | `400ms` | Duration of a slice's fade-in.                     |
| `--et-pie-chart-enter-stagger`  | `40ms`  | Delay between the fade-ins of neighbouring slices. |

## Error codes

The chart domain owns `ET51xx`; the pie chart uses `ET5140`-`ET5159` - see [error codes](/components/error-codes#chart-et51xx).
