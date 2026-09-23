# Chart

`et-bar-chart` draws one series as vertical bars: a value axis with clean ticks, the category under each bar, a hairline grid and a visually hidden table with every value. Reach for it when a handful of categories each have one number to compare. Import `CHART_IMPORTS`.

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

| Input            | Type                                  | Default      | Description                                                                         |
| ---------------- | ------------------------------------- | ------------ | ----------------------------------------------------------------------------------- |
| `data`           | `readonly BarChartDatum[]` (required) | -            | The bars, left to right. Each is `{ label: string; value: number }`.                |
| `label`          | `string` (required)                   | -            | Names the chart for assistive tech and captions the table view.                     |
| `height`         | `number`                              | `240`        | Height of the plot area in px. The category labels sit below it.                    |
| `tickCount`      | `number`                              | `5`          | Roughly how many value-axis intervals to draw.                                      |
| `maxBarWidth`    | `number`                              | `24`         | The widest a bar gets in px. A wider band keeps the rest as space between bars.     |
| `valueFormatter` | `(value: number) => string \| null`   | `null`       | Formats values on the axis, in the bar labels and in the table.                     |
| `categoryHeader` | `string`                              | `'Category'` | The table view's category column header.                                            |
| `valueHeader`    | `string`                              | `'Value'`    | The table view's value column header.                                               |
| `colorToken`     | registered color theme name \| `null` | `null`       | The color theme the bars are drawn in. Without it the bars take the scope's accent. |

Without a `valueFormatter`, values are formatted with `Intl.NumberFormat` in the locale from `injectLocale()` (`@ethlete/core`), so `3320` reads `3,320` in English.

## Scale and layout

The value axis always includes zero and rounds out to a 1, 2 or 5 step, so `[12, 87, 40]` gets the ticks `0, 20, … 100`. Negative values grow down from the zero baseline and are rounded at their lower end.

The width comes from the element the chart sits in: every category gets an equal band, and the bar is centered in it, capped at `maxBarWidth`, with at least 2px between neighbouring bars. Bars are square at the baseline and rounded 4px at the data end.

<StoryEmbed id="components-data-display-bar-chart--negative" height="380px" />

When a bar is first drawn it grows from the baseline and fades in. Under `prefers-reduced-motion: reduce` it appears without the animation.

## Custom template

`BarChartDirective` (`[etBarChart]`) holds the geometry without markup: `bars()` (position, size, `path`, `valueText` and an `ariaLabel` such as `Mar: 2,130` per bar), `ticks()`, `baselineY()`, `plotWidth()` and `formatValue()`. Put `etBarChartPlot` on the element the bars are laid out in - its width is what the bands divide. Without one the directive throws `ET5100` in dev mode.

```html
<div #chart="etBarChart" [data]="data" etBarChart label="Sign-ups per month">
  <div etBarChartPlot>
    <svg [attr.width]="chart.plotWidth()" [attr.height]="chart.height()">
      @for (bar of chart.bars(); track bar.index) {
      <svg:path [attr.d]="bar.path" />
      }
    </svg>
  </div>
</div>
```

## Accessibility

- The plot is an SVG with `role="group"`, named by `label`.
- Each bar is focusable (`tabindex="0"`) with `role="img"`, named by its category and described by its formatted value. Tab moves from bar to bar; focus draws a ring around the bar's band.
- Hovering a bar, or focusing it from the keyboard, opens a [tooltip](/components/tooltip) with the value and the category.
- A visually hidden `<table>` repeats the data with `label` as its caption and `categoryHeader` / `valueHeader` as column headers, so a screen reader can read the values as a table.
- The axis labels are `aria-hidden`; the bars and the table carry the same values.

## Theming

The bars use `--et-theme-color-primary-solid` from the nearest color scope, or from the theme named by `colorToken`. The grid uses `--et-surface-border-solid`, the axis text `--et-surface-color-muted-solid`. Theme names are registered by the application - see [theming](/core/theming).

| Token                           | Default | Description                                 |
| ------------------------------- | ------- | ------------------------------------------- |
| `--et-bar-chart-font-size`      | `12px`  | Size of the axis and category labels.       |
| `--et-bar-chart-axis-gap`       | `8px`   | Space between the plot and the axis labels. |
| `--et-bar-chart-enter-duration` | `400ms` | Duration of the bar entrance animation.     |

## Error codes

The chart domain owns `ET51xx` - see [error codes](/components/error-codes#chart-et51xx).
