# chart and grid scan - open findings

Scan of `libs/components/src/lib/chart` and `libs/components/src/lib/grid` from 2026-09-28. 0 High, 0 Medium, 2 Low, 4 Spec. Skipped: stories, most specs, `grid/grid-debug.component.ts` template. A second pass covered `grid/headless/grid-adapter.ts` and `resolveCollisions` in `grid/headless/internals/layout-engine.ts`. SVG text injection: none found. Every label, tooltip and table cell reaches the DOM through Angular text interpolation or attribute bindings. Path `d` strings come from numbers only. There is no `innerHTML`, `bypassSecurityTrust*` or `href` in either folder.

## chart - bar, pie, sankey

- Low: `baselineY` is a deprecated alias of `baseline` (`chart/headless/bar-chart.directive.ts:226`). Remove it at the next major. S

## grid - styling and cleanup

- Low: `headless/index.ts` re-exports all of `internals` (grid math, layout engine, auto-scroll, serialization) as public API (`grid/headless/index.ts:11`). Narrowing it to what consumers need is a breaking public-API decision. S

## Spec gaps

- Spec: no line-chart spec for an Invalid Date x value. S
- Spec: no grid spec for removing an item and adding it back while the leave animation runs. S
- Spec: no layout-engine spec for `autoPlace` with a `NaN` or non-positive span or column count. S

## grid adapter and collisions (second pass)

- Spec: no layout-engine spec for the two swap branches (`grid/headless/internals/layout-engine.ts:151-207`) or for `rowFloors`; the `resolveCollisions` specs cover only push-down and escape upward (`grid/headless/internals/layout-engine.spec.ts:239-349`). S

## Refuted in verification

- Grid remove button and drag ghost use undefined surface tokens: `--et-surface-color` and `--et-surface-color-muted` are defined as channel triplets by the app surface themes (Storybook, timetrack, ethlete-studio, ea-frontend), so the colours resolve and follow dark surfaces. Both now use the documented `-solid` tokens.
