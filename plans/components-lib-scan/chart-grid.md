# chart and grid scan - open findings

Scan of `libs/components/src/lib/chart` and `libs/components/src/lib/grid` from 2026-09-28. 0 High, 4 Medium, 19 Low, 4 Spec. Skipped: stories, most specs, `grid/grid-debug.component.ts` template. A second pass covered `grid/headless/grid-adapter.ts` and `resolveCollisions` in `grid/headless/internals/layout-engine.ts`. SVG text injection: none found. Every label, tooltip and table cell reaches the DOM through Angular text interpolation or attribute bindings. Path `d` strings come from numbers only. There is no `innerHTML`, `bypassSecurityTrust*` or `href` in either folder.

## chart - bundle size

- Medium: `CHART_IMPORTS` holds all four chart components and their headless directives (`chart/chart.imports.ts:13`), and every chart guide tells consumers to import it (`apps/docs/components/chart.md:6`, `line-chart.md:6`, `pie-chart.md:6`, `sankey-chart.md:6`). An app that shows only a bar chart bundles the line (time scale, slices), pie and sankey (layout engine) code and CSS too. Each chart alone is 31-35 kB gz in `tools/treeshake/goldens.json:47-61`. Add per-chart tuples (`BAR_CHART_IMPORTS` etc.) or tell the guides to import the one component, and add a golden for `CHART_IMPORTS`. S Verified.

## chart - line

- Low: two rows with the same Date give the same slice key `String(row.time)` (`chart/headless/line-chart.directive.ts:465`). `@for (slice ...; track slice.key)` then has duplicate keys (NG0955 in dev, wrong DOM reuse). Add the index to the key, as the category branch does. S
- Low: `timeDomain` uses `Math.min(...times)` / `Math.max(...times)` (`chart/headless/line-chart.directive.ts:316`), and `createValueTicks` spreads all values (`chart/headless/internals/chart-scale.ts:51-52`). With about 100k+ points the spread throws a RangeError (too many arguments). Use a reduce loop. S
- Low: each touch `pointermove` calls `getBoundingClientRect()` on every slice and `hide()` on every other slice's tooltip (`chart/headless/line-chart.directive.ts:560-566`). For long series this is N layout reads per move. Read the plot element's rect once. S
- Low: an invalid `timeZone` input makes `Intl.DateTimeFormat` throw inside a computed (`chart/headless/internals/chart-time-scale.ts:75`). The chart crashes with no dev error that names the input. S

## chart - bar, pie, sankey

- Low: a single-series bar datum with `NaN` draws a 0 bar but shows "NaN" in its tooltip, description and table (`chart/headless/bar-chart.directive.ts:338,377`). The pie shows "NaN" in its legend and table too (`chart/headless/pie-chart.directive.ts:172`). Format the value the chart draws, or show an empty cell. S
- Low: in production `findSankeyDataError` returns `null` (`chart/headless/internals/sankey-layout.ts:262`), so duplicate node ids reach `renderedNodes`, which keys by `node.id` (`chart/headless/sankey-chart.directive.ts:211`). The result is duplicate `track` keys and a `byId` map that loses nodes, so links vanish. Skip duplicates in the layout the way `readEdges` does. S
- Low: `baselineY` is a deprecated alias of `baseline` (`chart/headless/bar-chart.directive.ts:226`). Remove it at the next major. S
- Low: `renderedNodes` computes the column step again (`chart/headless/sankey-chart.directive.ts:193-196`), duplicating `computeSankeyLayout` (`chart/headless/internals/sankey-layout.ts:366-369`). Return `step` from the layout. S

## grid - behaviour

- Medium: a non-numeric `minColSpan`/`minRowSpan` attribute on `et-grid-item` becomes `NaN` (`grid/headless/grid-item.directive.ts:24-25`). `autoPlace` with a `NaN` span never meets `col <= columns - colSpan`, so `for (let row = 0; ; row++)` never ends and the tab hangs (`grid/headless/internals/layout-engine.ts:105-106`, same loop at `grid/headless/internals/responsive.ts:67-68`). A breakpoint with `columns <= 0` hangs the same way. Clamp spans to finite values >= 1, and add a row cap. S Verified.
- Low: `GridItemDirective`'s registration effect unregisters in `onCleanup` before it registers again (`grid/headless/grid-item.directive.ts:136-146`). Every re-registration therefore counts as a first one: the by-value guard at `grid/headless/grid.directive.ts:494` never runs, and the first-registration auto-place and compact at `:502-523` run again on each constraint input change. Unregister only on destroy or on an `itemId` change. S
- Low: if the drag or resize directive is destroyed mid-gesture, the grid state stays set, because `onDestroy` only stops the scroller and listeners (`grid/headless/grid-drag.directive.ts:126-129`, `grid/headless/grid-resize.directive.ts:106-109`). `dragState` stays set, or `isResizeActive` stays true and holds the 160 ms duration. Call `cancelDrag()` / `cancelResize()` there. S
- Low: `aria-grabbed` is deprecated ARIA, and the element reports `"false"` even when the grid is read-only (`grid/headless/grid-drag.directive.ts:30`). Remove it and describe the Ctrl/Shift+Arrow shortcuts with `aria-keyshortcuts` or a description on the item instead. S
- Low: the item's default `ariaLabel` is the hardcoded English `'Grid item'` (`grid/grid-item.component.ts`, `ariaLabel` input). Registered items never set it, so every item has the same name. Take it from `injectGridLabels()` or from the registration. S

## grid - styling and cleanup

- Low: the inline `styles` of `GridComponent` (`grid/grid.component.ts:76`) and `GridItemDefaultActionsComponent` (`grid/grid-item-default-actions.component.ts:28`) are not wrapped in `@layer components`, so Tailwind utilities cannot override them. Move them to `.css` files inside the layer. S
- Low: `grid-debug.component.css` and the debug template's `[style.color]` bindings use hardcoded hex colours (`grid/grid-debug.component.css:5-117`, `grid/grid-debug.component.ts:58-104`). The overlay is unreadable on a dark surface. S
- Low: `gridDebug`, `isGridDebugEnabled` and `GRID_DEBUG_STORAGE_KEY` are exported but never called (`grid/headless/grid.directive.ts:65-86`). `headless/index.ts` also re-exports all of `internals` (grid math, layout engine, auto-scroll) as public API (`grid/headless/index.ts:11`). Delete the dead helpers and export only what consumers need. S
- Low: the template comment at `grid/grid.component.ts:30` and the rationale comments at `grid/headless/grid-drag.directive.ts:143-144,187-189,199-202` fall outside the AGENTS.md allowlist. S

## Spec gaps

- Spec: no line-chart spec for an Invalid Date or duplicate Date x values. S
- Spec: no grid spec for removing an item and adding it back while the leave animation runs. S
- Spec: no layout-engine spec for `autoPlace` with a `NaN` or non-positive span or column count. S

## grid adapter and collisions (second pass)

- Low: the same-row swap in `resolveCollisions` has no adjacency guard (`grid/headless/internals/layout-engine.ts:175-206`). A drag from col 0 onto a single item at col 8 of the same row moves that item to col 0, over the items between, while the vertical swap at `:149-173` refuses the same far-away teleport. Require the swap target to touch the origin, as the vertical branch does, or document the swap. S
- Low: `mapGridLayout` writes each key into a plain `{}` (`grid/headless/grid-adapter.ts:56-60`). A backend layout parsed from JSON with a `__proto__` key replaces the prototype of the result instead of adding a breakpoint. Build the record with `Object.fromEntries` or `Object.create(null)`. S
- Low: `resolveCollisions` finds the moved entry twice and needs an `eslint-disable` for the non-null assertion (`grid/headless/internals/layout-engine.ts:138-144`). Find it once in the copied `result` and return early when it is missing. S
- Spec: no layout-engine spec for the two swap branches (`grid/headless/internals/layout-engine.ts:151-207`) or for `rowFloors`; the `resolveCollisions` specs cover only push-down and escape upward (`grid/headless/internals/layout-engine.spec.ts:239-349`). S

## Refuted in verification

- Grid remove button and drag ghost use undefined surface tokens: `--et-surface-color` and `--et-surface-color-muted` are defined as channel triplets by the app surface themes (Storybook, timetrack, ethlete-studio, ea-frontend), so the colours resolve and follow dark surfaces; only the move to the documented `-solid` tokens remains, as a Low cleanup.
