# Sankey chart

`et-sankey-chart` draws a flow: nodes in columns from left to right, each as tall as what flows through it, joined by ribbons as wide as their value. It suits budgets, energy balances and funnels - anything where an amount splits and merges between stages. Import `CHART_IMPORTS`.

```ts
import { CHART_IMPORTS } from '@ethlete/components';
```

```html
<et-sankey-chart [nodes]="nodes" [links]="links" label="Match-day revenue and where it goes" />
```

```ts
nodes: SankeyChartNodeInput[] = [
  { id: 'tickets', label: 'Tickets' },
  { id: 'catering', label: 'Catering' },
  { id: 'revenue', label: 'Match-day revenue' },
  { id: 'staff', label: 'Stewards and staff' },
  { id: 'reserves', label: 'Reserves' },
];

links: SankeyChartLinkInput[] = [
  { source: 'tickets', target: 'revenue', value: 420 },
  { source: 'catering', target: 'revenue', value: 150 },
  { source: 'revenue', target: 'staff', value: 380 },
  { source: 'revenue', target: 'reserves', value: 190 },
];
```

## Live demo

<StoryEmbed id="components-data-display-sankey-chart--default" height="420px" />

## Options

| Input            | Type                                  | Default    | Description                                                                            |
| ---------------- | ------------------------------------- | ---------- | -------------------------------------------------------------------------------------- |
| `nodes`          | `readonly SankeyChartNodeInput[]`     | -          | Required. The stages: `{ id, label, colorToken? }`. `id` must be unique.               |
| `links`          | `readonly SankeyChartLinkInput[]`     | -          | Required. The flows: `{ source, target, value }`, naming nodes by `id`. No cycles.     |
| `label`          | `string`                              | -          | Required. Names the chart for assistive tech and captions the table view.              |
| `height`         | `number`                              | `320`      | Height of the plot in px.                                                              |
| `nodeWidth`      | `number`                              | `12`       | Width of a node in px.                                                                 |
| `nodeGap`        | `number`                              | `12`       | Space between the nodes of one column in px. Shrinks when a tall column would not fit. |
| `labelWidth`     | `number`                              | `120`      | Room for the labels left of the first column and right of the last one, in px.         |
| `valueFormatter` | `((value: number) => string) \| null` | `null`     | Formats values in the tooltips, the descriptions and the table.                        |
| `incomingLabel`  | `string`                              | `'In'`     | Names what flows into a node, in its tooltip and description.                          |
| `outgoingLabel`  | `string`                              | `'Out'`    | Names what flows out of a node, in its tooltip and description.                        |
| `sourceHeader`   | `string`                              | `'Source'` | The table view's source column header.                                                 |
| `targetHeader`   | `string`                              | `'Target'` | The table view's target column header.                                                 |
| `valueHeader`    | `string`                              | `'Value'`  | The table view's value column header.                                                  |
| `colorToken`     | registered color theme name \| `null` | `null`     | The color theme for nodes without their own `colorToken` or a palette entry.           |

Without a `valueFormatter`, values are formatted with `Intl.NumberFormat` in the locale from `injectLocale()` (`@ethlete/core`).

## Layout

- **Columns.** A node without incoming links sits in the first column; every other node sits one column right of the rightmost of its sources - the length of the longest path reaching it. A node that only receives flow therefore stays in the column its path reaches, not in the last one. The columns are spread evenly between the two label gutters.
- **Heights.** A node is as tall as the larger of what flows in and what flows out. One scale serves the whole chart, set by the fullest column, so that column fills `height` with `nodeGap` between its nodes; the other columns are centered. With many nodes in one column the gap shrinks so the gaps never take more than half the height.
- **Order.** Nodes start in input order and then go through a few sweeps of weighted-barycenter ordering - each node moves towards the average position of its neighbours, weighted by link value - which removes most crossings. The order with the fewest crossings wins.
- **Ribbons.** A link is a filled cubic curve from the right edge of its source to the left edge of its target, as wide as its value at both ends. Ribbons stack at a node in the order of the nodes at their other end, so they leave and arrive without crossing each other.
- **Zero links.** A link with value `0` draws no ribbon and does not affect columns, heights or order, but it keeps its row in the table view.

<StoryEmbed id="components-data-display-sankey-chart--multi-level" height="520px" />

### Labels

A node's label sits outside it, vertically centered: to the left of the node in the first column, to the right of it in every other column. The first and last columns get `labelWidth` of room; a label in a middle column gets the space up to the next column. A longer label is cut off with an ellipsis, and the full name stays in the tooltip, the accessible name and the table. Labels over ribbons get a soft halo in the surface background colour so they stay legible.

### Narrow screens

The plot never gets narrower than `--et-sankey-chart-min-width` (`480px`). In a narrower container the chart scrolls sideways instead of squeezing its columns together.

### Colours

Node `i` is drawn in its own `colorToken`, else in entry `i` of the app's [color palette](/core/theming#offering-colors-to-a-user) (`provideColorPalette`, optional), else in the chart's `colorToken`, else in the surrounding accent. A link takes its source node's colour at reduced opacity. A palette is never cycled: with more nodes than palette entries, the rest share the fallback - give the chart a `colorToken` naming a neutral theme of the app (the stories use this Storybook's `neutral`), or group nodes by giving them a `colorToken` each.

<StoryEmbed id="components-data-display-sankey-chart--dark" height="520px" />

## Interaction

Hovering or focusing a node highlights its links and dims all others; hovering or focusing a link highlights that link alone. On a touch device, a tap focuses the mark, which opens its tooltip and highlights it the same way; a tap elsewhere closes it again. Hover highlighting ignores touch pointers, so a tap never leaves a hover state behind.

- A node's tooltip names it and shows what flows in and out (`In 660`, `Out 660`), leaving out a side with no flow. It opens above the node.
- A link's tooltip shows its value and `Source → Target`. It opens above the ribbon's midpoint.

When the chart first renders, the nodes and labels fade in, then the ribbons. Under `prefers-reduced-motion: reduce` everything appears at once.

## Custom template

`SankeyChartDirective` (`[etSankeyChart]`) holds the geometry without markup: `renderedNodes()` (per node its rect, hit `target`, `colorToken`, in/out totals and texts, `description` and label position), `renderedLinks()` (per link its ribbon `path`, `width`, midpoint `anchor`, `source`, `target`, `colorToken`, `valueText` and `name`), `highlightedLinks()`, `activeNodeKey()`, `hasHighlight()`, `table()`, `plotWidth()` and `formatValue()`. Report hover and focus with `hoverMark()`/`unhoverMark()` and `focusMark()`/`blurMark()`. Put `etChartPlot` on the element the flow is laid out in - its width is what the columns divide. Without one the directive throws `ET5100` in dev mode.

```html
<div #chart="etSankeyChart" [nodes]="nodes" [links]="links" etSankeyChart label="Budget">
  <div etChartPlot>
    <svg [attr.width]="chart.plotWidth()" [attr.height]="chart.height()">
      @for (link of chart.renderedLinks(); track link.key) {
      <svg:path [attr.d]="link.path" />
      } @for (node of chart.renderedNodes(); track node.key) {
      <svg:rect [attr.x]="node.x" [attr.y]="node.y" [attr.width]="node.width" [attr.height]="node.height" />
      }
    </svg>
  </div>
</div>
```

## Accessibility

- The plot is an SVG with `role="group"`, named by `label`.
- Every node and every link is focusable (`tabindex="0"`) with `role="img"`. A node is named by its label and described by its totals (`In: 660, Out: 660`); a link is named `Source → Target` and described by its value.
- **Tab order: all nodes first, then all links.** Nodes go column by column, top to bottom within a column. Links follow in the order of their source node, top to bottom at that node. Focus draws a ring around the node's hit target or the ribbon's outline. Links are tab stops rather than arrow-key targets so that every mark is reachable with Tab alone, the same way as the bars of a [bar chart](/components/chart); a flow with many links therefore has many tab stops, and the table view is the quicker route through it.
- The node labels are `aria-hidden`; the marks and the table carry the same names.
- A visually hidden `<table>` lists every link - zero links included - with `label` as its caption and `sourceHeader`, `targetHeader` and `valueHeader` as its columns.

## Theming

Nodes and ribbons use `--et-theme-color-primary-solid` from the node's colour scope. Labels use `--et-surface-color-solid` with a halo in `--et-surface-background-solid`; the hover tint behind a node mixes `--et-surface-interaction-solid`. Theme names are registered by the application - see [theming](/core/theming).

| Token                                      | Default | Description                                                    |
| ------------------------------------------ | ------- | -------------------------------------------------------------- |
| `--et-sankey-chart-font-size`              | `12px`  | Size of the node labels.                                       |
| `--et-sankey-chart-min-width`              | `480px` | The narrowest the plot gets before the chart scrolls sideways. |
| `--et-sankey-chart-link-opacity`           | `0.35`  | Fill opacity of a ribbon at rest.                              |
| `--et-sankey-chart-link-highlight-opacity` | `0.6`   | Fill opacity of a highlighted ribbon.                          |
| `--et-sankey-chart-link-dim-opacity`       | `0.1`   | Fill opacity of the other ribbons while a mark is highlighted. |
| `--et-sankey-chart-enter-duration`         | `400ms` | Duration of the entrance fade; the ribbons start halfway in.   |

## Error codes

The sankey chart owns `ET5160`-`ET5179` of the chart range, checked in dev mode:

| Code     | Cause                                                           |
| -------- | --------------------------------------------------------------- |
| `ET5160` | The links form a cycle, so the nodes cannot flow left to right. |
| `ET5161` | A link names a `source` or `target` that is no node's `id`.     |
| `ET5162` | Two nodes share one `id`.                                       |
| `ET5163` | A link has a negative or non-finite `value`.                    |

In production a cycle renders an empty chart, and an invalid link is skipped. See [error codes](/components/error-codes#chart-et51xx).
