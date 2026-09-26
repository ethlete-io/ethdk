# Component improvements: triage

Live work only, ordered by what to do first. Finished items are removed; git history has them.

## Chart design calls, open for the user

Collected 2026-09-23 from the four chart slices. Each slice shipped the most restrained option,
listed first. Decide them one slice at a time.

### Slice A: bars (`6278e205b`)

1. Legend: above the plot, left-aligned, wrapping, 10px rounded squares, not interactive. Alternatives: below the plot, or toggle-to-isolate.
2. Stacked segments: a 2px surface gap (1px from each neighbour). Positive and negative stacks meet at zero with no gap.
3. Horizontal: category labels on the left, end-aligned, at most 40% width with an ellipsis. The tooltip opens right of positive bars and left of negative ones.
4. Grouped: bars 2px apart, and at least 20% of the band stays as air between groups.
5. No direct labels. The dataviz skill suggests them for 4 or fewer series.
6. The series tooltip shows key, value, series and category. A stacked tooltip has no total.
7. Several series without a palette: all get the accent, plus a dev `console.warn`. Alternative: an error, or a built-in variation.
8. `provideColorPalette` is one static list, so dark mode needs a second palette from the app. Should the SDK support a palette that follows the surface?
9. Colour follows the position in `series`. As a result, filtering series repaints the rest unless each series sets `colorToken`.
10. `BarChartDirective.baselineY` is `@deprecated` in favour of `baseline`. Recommendation: remove it, because the chart is not released yet.

### Sankey (`b64d0f519`)

1. Labels: the first column puts labels left of the node, all other columns to the right. Middle labels sit over ribbons with a surface halo and an ellipsis.
2. Label text uses the normal text colour and shows no value.
3. Narrow screens: the plot has a 480px minimum (`--et-sankey-chart-min-width`) and scrolls sideways.
4. Sinks stay in their longest-path column. They do not move to the last column.
5. Nodes past the palette take the chart `colorToken` or the accent. The palette does not cycle.
6. Link opacity: 0.35 at rest, 0.6 highlighted, 0.1 dimmed. Tokens can change these values.
7. The node tooltip shows the name plus "In x" and "Out y", above the node. The link tooltip shows the value and "Source → Target", above the midpoint of the ribbon.
8. Links are named with "→". Some screen readers read it as "right arrow".
9. Entrance: nodes fade in, then ribbons after half of the 400ms duration.
10. Links are tab stops after the nodes, with no arrow keys. Many links give many tab stops, and the table view is the faster route.

### Pie and donut (`0a28804d3`)

1. When the palette runs out, slices take steps of the accent, from 100% down to a 40% mix with the surface. Partial palette coverage mixes palette hues with accent steps.
2. Tooltip: the value in bold, then "Label · 57%". The shared `et-chart-tooltip` has no slot for the share.
3. Legend: the pie has its own legend with swatch, label, value and share, beside the circle, at most 360px wide, and it wraps below. The shared `et-chart-legend` has no value column.
4. When the placement side has no room, the tooltip flips to the other side and covers the chart.
5. Focus: a 2px stroke in the text colour plus the hover tint. Slice corners are not rounded.
6. Donut centre: the total at 1.5em with a muted caption. Screen readers can read it.
7. Shares are whole percents, so a tiny slice can read 0% or 1%. There is no option for decimals.
8. Empty state: a hairline circle in the border colour.
9. `size` defaults to 200. There is no preset donut ratio, and the stories use 0.6.

### Line and area (`8a02e0a99`)

1. Hover delay: the tooltip keeps its 300ms delay, so moving across x values opens it again after the delay. The crosshair follows the pointer at once. Alternative: `showDelay` 0.
2. Legend mark: a line for line charts, a rect for area charts.
3. Area opacity: 0.12 unstacked, 0.32 stacked. A stacked area on dark looks muddy.
4. The value axis always includes zero. There is no zero-free domain for lines.
5. Time ticks: about one per 72px. Weeks start on Monday for every locale. January shows the year, and midnight shows the date.
6. Category x: points sit at band centres, and labels thin out below 48px per category. A time axis runs edge to edge.
7. Missing values are left out of the tooltip. An x with no values reads "–".
8. Focus ring: a full-height rounded ring around the focused column. It gets thin on daily data.

## Stat tile

A new component, not started. Low priority, opportunistic. The `dataviz` guidance already covers
stat tiles, so the design language exists. Prefer it when the next goal is a bounded new domain.

## Watchlist - gated on browsers

Nothing here is actionable now. **Re-check support before planning any of it.** Last checked
2026-08-18.

| Waiting on                                   | What it would buy                                                                                                                                            |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| CSS anchor positioning (complete Firefox)    | Shrinks `overlay-position.ts`'s floating-ui usage. Individual anchor features reached Baseline, but the positioning contract needed here is still incomplete |
| `interpolate-size` / `calc-size` (FF/Safari) | Replaces `animated-block-size.ts`; `interpolate-size` remains limited availability, so do not make it the baseline path yet                                  |

## Settled - do not re-open

- The animated-lifecycle directive pair stays. It is not a migration target.
- `<dialog>`/top-layer and the Popover API are rejected: the native top layer breaks consumers that
  rely on z-index layering.
- Fullscreen View Transitions: rejected by the user on 2026-09-23. Interruption does not reverse,
  input is blocked for the transition, and only one transition runs per document.
  `fullscreen-animation.ts` and `flip-animation.ts` stay.
- No public `ComponentHarness` API. It would freeze internal DOM as API and needs a new entry point
  with an `@angular/cdk/testing` dependency. Re-open only when a consumer asks, for the controls it
  names.
- The form field gets no test driver, and the ARIA-state controls (checkbox, selection list,
  slider) get no shared driver base.
