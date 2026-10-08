# Sankey chart

`et-sankey-chart` draws a flow: nodes in columns from left to right, each as tall as what flows through it, joined by ribbons as wide as their value. It suits budgets, energy balances and funnels - anything where an amount splits and merges between stages. Import `SankeyChartComponent`.

```ts
import { SankeyChartComponent } from '@ethlete/components';
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

| Input            | Type                                   | Default    | Description                                                                            |
| ---------------- | -------------------------------------- | ---------- | -------------------------------------------------------------------------------------- |
| `nodes`          | `readonly SankeyChartNodeInput[]`      | -          | Required. The stages: `{ id, label, colorToken? }`. `id` must be unique.               |
| `links`          | `readonly SankeyChartLinkInput[]`      | -          | Required. The flows: `{ source, target, value }`, naming nodes by `id`. No cycles.     |
| `label`          | `string`                               | -          | Required. Names the chart for assistive tech and captions the table view.              |
| `height`         | `number`                               | `320`      | Height of the plot in px.                                                              |
| `nodeWidth`      | `number`                               | `12`       | Width of a node in px.                                                                 |
| `nodeGap`        | `number`                               | `12`       | Space between the nodes of one column in px. Shrinks when a tall column would not fit. |
| `labelWidth`     | `number`                               | `120`      | Room for the labels left of the first column and right of the last one, in px.         |
| `direction`      | `'auto' \| 'horizontal' \| 'vertical'` | `'auto'`   | Which way the flow runs. `auto` turns it vertical below `verticalBelow`.               |
| `verticalBelow`  | `number`                               | `480`      | The chart width in px below which `auto` turns the flow vertical.                      |
| `valueFormatter` | `((value: number) => string) \| null`  | `null`     | Formats values in the tooltips, the descriptions and the table.                        |
| `incomingLabel`  | `string`                               | `'In'`     | Names what flows into a node, in its tooltip and description.                          |
| `outgoingLabel`  | `string`                               | `'Out'`    | Names what flows out of a node, in its tooltip and description.                        |
| `sourceHeader`   | `string`                               | `'Source'` | The table view's source column header.                                                 |
| `targetHeader`   | `string`                               | `'Target'` | The table view's target column header.                                                 |
| `valueHeader`    | `string`                               | `'Value'`  | The table view's value column header.                                                  |
| `linkSeparator`  | `string`                               | `'to'`     | The word between source and target in a link's name, tooltip and accessible name.      |
| `linkKeyHint`    | `SankeyChartLinkKeyHint \| null`       | English    | Writes the key hint under a keyboard-focused link's tooltip. `null` shows none.        |
| `colorToken`     | registered color theme name \| `null`  | `null`     | The color theme for nodes without their own `colorToken` or a palette entry.           |

Without a `valueFormatter`, values are formatted with `Intl.NumberFormat` in the locale from `injectLocale()` (`@ethlete/core`).

## Layout

- **Columns.** A node without incoming links sits in the first column; every other node sits one column right of the rightmost of its sources - the length of the longest path reaching it. A node that only receives flow therefore stays in the column its path reaches, not in the last one. The columns are spread evenly between the two label gutters.
- **Heights.** A node is as tall as the larger of what flows in and what flows out. One scale serves the whole chart, set by the fullest column, so that column fills `height` with `nodeGap` between its nodes; the other columns are centered. With many nodes in one column the gap shrinks so the gaps never take more than half the height.
- **Order.** Nodes start in input order and then go through a few sweeps of weighted-barycenter ordering - each node moves towards the average position of its neighbours, weighted by link value - which removes most crossings. The order with the fewest crossings wins.
- **Ribbons.** A link is a filled cubic curve from the right edge of its source to the left edge of its target, as wide as its value at both ends. Ribbons stack at a node in the order of the nodes at their other end, so they leave and arrive without crossing each other.
- **Zero links.** A link with value `0` draws no ribbon and does not affect columns, heights or order, but it keeps its row in the table view.

<StoryEmbed id="components-data-display-sankey-chart--multi-level" height="520px" />

### Labels

A label in the first column sits left of its node and one in the last column right of it, vertically centered, with `labelWidth` of room. A label in a middle column sits on a chip - a bordered box in the surface background colour - centred on its node, and may be as wide as the space between two columns. A middle-column node shorter than 24px has no room for a chip, so its label sits right of the node, over the ribbons, with a soft halo in the surface background colour. A longer label is cut off with an ellipsis, and the full name stays in the tooltip, the accessible name and the table. The chip covers the node bar and the ribbon ends beneath it; the tooltip and the table still give the node's totals.

### Narrow screens

Below `verticalBelow` (`480px`) of chart width, the default `direction="auto"` turns the flow top to bottom: columns become rows, ribbons run from the bottom edge of a node to the top edge of the next, and the node sizes divide the chart's width. `height` stays the height of the plot, so give a vertical chart room for its rows. The width is measured on the chart, not the viewport, so a narrow card on a wide screen turns too.

In a vertical flow the first row is labelled above its nodes and the last row below them. A middle-row node at least 24px wide carries its label on a chip centred on it; a narrower one has its label below it, with the halo. Every label is centred on its node and may be as wide as the space to the neighbouring labels in its row, so labels on small nodes are cut off sooner - the tooltip, the accessible name and the table keep the full name.

Set `direction="horizontal"` to keep columns at any width: the plot then never gets narrower than `--et-sankey-chart-min-width` (`480px`) and scrolls sideways. `direction="vertical"` turns the flow at any width.

<StoryEmbed id="components-data-display-sankey-chart--narrow-screen" height="620px" />

### Colours

Node `i` is drawn in its own `colorToken`, else in entry `i` of the app's [color palette](/core/theming#offering-colors-to-a-user) (`provideColorPalette`, optional), else in the chart's `colorToken`, else in a step of the surrounding accent. A link takes its source node's colour at reduced opacity. A palette is never cycled: the nodes past it share the accent in steps from full strength down to 40% (a lone node keeps the full accent), so they stay apart. Give the chart a `colorToken` to step a different theme, or give nodes a `colorToken` each to group them.

<StoryEmbed id="components-data-display-sankey-chart--many-nodes" height="560px" />

## Interaction

Hovering or focusing a node highlights its links and dims all others; hovering or focusing a link highlights that link alone. On a touch device, a tap focuses the mark, which opens its tooltip and highlights it the same way; a tap elsewhere closes it again. Hover highlighting ignores touch pointers, so a tap never leaves a hover state behind.

- A node's tooltip names it and shows what flows in and out (`In 660`, `Out 660`), leaving out a side with no flow. It opens above the node.
- A link's tooltip shows its value and `Source to Target`. It opens above the ribbon's midpoint.

When the chart first renders, the nodes and labels fade in, then the ribbons. Under `prefers-reduced-motion: reduce` everything appears at once.

## Drill-down

`(markActivate)` emits when a node or link is clicked, or when Space is pressed on the focused mark. Enter emits on a link and on a node without outgoing links; on a node with outgoing links it keeps stepping into them (see [Keyboard](#keyboard)). The payload is a `SankeyChartMarkActivateEvent`, `{ kind: 'node', node }` or `{ kind: 'link', link }`, holding the `SankeyChartNodeInput` or `SankeyChartLinkInput` you passed in.

```ts
protected openFlow(event: SankeyChartMarkActivateEvent) {
  if (event.kind === 'node') this.openAccount(event.node.id);
  else this.openTransfers(event.link.source, event.link.target);
}
```

The story `Components/Data display/Sankey chart/Mark activate` shows it.

## Custom template

`SankeyChartDirective` (`[etSankeyChart]`) holds the geometry without markup: `renderedNodes()` (per node its rect, hit `target`, `colorToken`, `accentMix`, in/out totals and texts, `description` and label position), `renderedLinks()` (per link its ribbon `path`, `width`, midpoint `anchor`, `source`, `target`, `colorToken`, `accentMix`, `valueText` and `name`), `highlightedLinks()`, `activeNodeKey()`, `hasHighlight()`, `table()`, `plotWidth()`, `flowDirection()` (the direction with `auto` resolved against the width of the element around `etChartPlot`) and `formatValue()`. Report hover with `hoverMark()`/`unhoverMark()`. Put `etSankeyChartMark="node"` or `etSankeyChartMark="link"` with `[etSankeyChartMarkKey]` (the node's `key` or the link's `key`) on each focusable mark: it reports focus, holds the chart's one tab stop (`tabStopMark()`) and handles the keys below. `focusMarkElement()` moves focus to a mark from code. Put `etChartPlot` on the element the flow is laid out in - its width is what the columns divide. Without one the directive throws `ET5100` in dev mode. Import `SankeyChartDirective`, `SankeyChartMarkDirective` and `ChartPlotDirective`.

```html
<div #chart="etSankeyChart" [nodes]="nodes" [links]="links" etSankeyChart label="Budget">
  <div etChartPlot>
    <svg [attr.width]="chart.plotWidth()" [attr.height]="chart.height()">
      @for (link of chart.renderedLinks(); track link.key) {
      <svg:path
        [attr.d]="link.path"
        [attr.aria-label]="link.name"
        [etSankeyChartMarkKey]="link.key"
        etSankeyChartMark="link"
        role="img"
      />
      } @for (node of chart.renderedNodes(); track node.key) {
      <svg:rect
        [attr.x]="node.x"
        [attr.y]="node.y"
        [attr.width]="node.width"
        [attr.height]="node.height"
        [attr.aria-label]="node.name"
        [etSankeyChartMarkKey]="node.key"
        etSankeyChartMark="node"
        role="img"
      />
      }
    </svg>
  </div>
</div>
```

## Accessibility

- The plot is an SVG with `role="group"`, named by `label`.
- Every node and every link has `role="img"`. A node is named by its label and described by its totals (`In: 660, Out: 660`); a link is named `Source to Target` (the word is `linkSeparator`) and described by its value. Focus draws a ring around the node's hit target or the ribbon's outline, and opens the mark's tooltip.
- The node labels are `aria-hidden`; the marks and the table carry the same names.
- A visually hidden `<table>` lists every link - zero links included - with `label` as its caption and `sourceHeader`, `targetHeader` and `valueHeader` as its columns.

### Keyboard

The chart is one tab stop. Tab enters on the first node - or on the mark that was focused last - and the next Tab leaves the chart. The arrow keys move between the marks:

| Key          | On a node                                                                   | On a link                                |
| ------------ | --------------------------------------------------------------------------- | ---------------------------------------- |
| `↓` / `↑`    | The next / previous node in the column; stops at the ends                   | The next / previous outgoing link; wraps |
| `→` / `←`    | The node in the next / previous column nearest in height; stops at the edge | -                                        |
| `Home`/`End` | The first / last node of the chart                                          | The first / last outgoing link           |
| `Enter`      | The node's first outgoing link, top to bottom; on a sink, `(markActivate)`  | `(markActivate)`                         |
| `Space`      | `(markActivate)`                                                            | `(markActivate)`                         |
| `Escape`     | Closes the tooltip                                                          | Back to the link's source node           |

Nodes go column by column, top to bottom; a node's outgoing links top to bottom at the node. In a vertical flow the keys turn with it: `↓` / `↑` move to the nearest node of the next / previous row, `→` / `←` move within a row and cycle a node's outgoing links, left to right. An incoming link is reached from its source node.

A link focused from the keyboard ends its tooltip in a muted key hint: `1 of 2 · ↑↓ next link · Esc back to Reserve` (`←→` in a vertical flow; a lone link drops the middle part). Hover, a click or a tap shows no hint. `linkKeyHint` writes the text from `{ position, count, sourceLabel, direction }`, so it can be translated:

```ts
linkKeyHint: SankeyChartLinkKeyHint = ({ position, count, sourceLabel, direction }) =>
  `${position} von ${count} · ${direction === 'vertical' ? '←→' : '↑↓'} nächster Link · Esc zurück zu ${sourceLabel}`;
```

The hint is `aria-hidden` and not part of the link's description, so a screen reader hears the link's name and value only. Screen readers in browse mode keep the arrow keys for themselves, so the table view stays the route through every link.

## Theming

Nodes and ribbons use `--et-theme-color-primary-solid` from the node's colour scope. Labels use `--et-surface-color-solid` with a halo in `--et-surface-background-solid`; the hover tint behind a node mixes `--et-surface-interaction-solid`. Theme names are registered by the application - see [theming](/core/theming).

| Token                                      | Default | Description                                                      |
| ------------------------------------------ | ------- | ---------------------------------------------------------------- |
| `--et-sankey-chart-font-size`              | `12px`  | Size of the node labels.                                         |
| `--et-sankey-chart-min-width`              | `480px` | The narrowest a horizontal plot gets before it scrolls sideways. |
| `--et-sankey-chart-link-opacity`           | `0.35`  | Fill opacity of a ribbon at rest.                                |
| `--et-sankey-chart-link-highlight-opacity` | `0.6`   | Fill opacity of a highlighted ribbon.                            |
| `--et-sankey-chart-link-dim-opacity`       | `0.1`   | Fill opacity of the other ribbons while a mark is highlighted.   |
| `--et-sankey-chart-enter-duration`         | `400ms` | Duration of the entrance fade; the ribbons start halfway in.     |

## Error codes

The sankey chart owns `ET5160`-`ET5179` of the chart range. They are checked in dev mode and reported to the `ErrorHandler`, and the chart draws no nodes or links until the data is fixed:

| Code     | Cause                                                           |
| -------- | --------------------------------------------------------------- |
| `ET5160` | The links form a cycle, so the nodes cannot flow left to right. |
| `ET5161` | A link names a `source` or `target` that is no node's `id`.     |
| `ET5162` | Two nodes share one `id`. The layout leaves the later one out.  |
| `ET5163` | A link has a negative or non-finite `value`.                    |

In production a cycle renders an empty chart, and an invalid link is skipped. See [error codes](/components/error-codes#chart-et51xx).
