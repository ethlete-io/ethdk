# Changelog

## 1.0.0-next.6

### Patch Changes

- [#3067](https://github.com/ethlete-io/ethdk/pull/3067) [`e271c58`](https://github.com/ethlete-io/ethdk/commit/e271c58ffc395075a5c4496abf34b34568855276) Thanks [@github-actions](https://github.com/apps/github-actions)! - Query devtools: the value explorer shows the headers a `headers` provider hands the request, instead of an `fn(headerProvider)` row.

## 1.0.0-next.5

### Patch Changes

- [`4044a00`](https://github.com/ethlete-io/ethdk/commit/4044a0007de55d25b5a697c6e4190e21d68d022f) Thanks [@TomTomB](https://github.com/TomTomB)! - - Notifications: a toast keeps one elevation, paints above overlays, and keeps out of every reserved viewport edge.
  - Query devtools: a side dock reserves the edge it covers.
  - `SurfaceContextTracker` drops `topType` / `topElevation`.

- [`3122607`](https://github.com/ethlete-io/ethdk/commit/3122607d1727844a2d987032f45ad631f678c2ca) Thanks [@TomTomB](https://github.com/TomTomB)! - Overlays and floating chrome now keep out of space a surface above the page reserved with `reserveOverlayViewportSpace()` - so a dialog, menu or toast is no longer stacked under the docked query devtools panel.

## 1.0.0-next.4

### Patch Changes

- [`5c1190a`](https://github.com/ethlete-io/ethdk/commit/5c1190ac76c244ff1c293b390dd599ed016d26de) Thanks [@TomTomB](https://github.com/TomTomB)! - Overlays: a press on a surface stacked above them no longer counts as an outside press, so working in the query devtools leaves an open dialog, sheet, menu, select or tooltip alone.

## 1.0.0-next.3

### Minor Changes

- [`398f7a2`](https://github.com/ethlete-io/ethdk/commit/398f7a22f2694cc5627a95cbd2e8d05cd084a03c) Thanks [@TomTomB](https://github.com/TomTomB)! - A Batches tab inspects a `createQueryBatch` run - progress, throughput, time remaining and every
  item's args and outcome - and the Queries list folds a run's items under one row.

- [`398f7a2`](https://github.com/ethlete-io/ethdk/commit/398f7a22f2694cc5627a95cbd2e8d05cd084a03c) Thanks [@TomTomB](https://github.com/TomTomB)! - Clicking an Events row opens its query in a drawer on the Events tab instead of jumping to Queries.
  Each drawer's selection now survives a reload.

### Patch Changes

- [`398f7a2`](https://github.com/ethlete-io/ethdk/commit/398f7a22f2694cc5627a95cbd2e8d05cd084a03c) Thanks [@TomTomB](https://github.com/TomTomB)! - Fixes the layout of a narrow panel: the Cache table scrolls in its own box, the Events base URL no
  longer wraps one character per line, and every drawer tab's divider resizes its panes.

- [#3061](https://github.com/ethlete-io/ethdk/pull/3061) [`7cd3da8`](https://github.com/ethlete-io/ethdk/commit/7cd3da8342d0d619f06154d4155cfafedbed28f4) Thanks [@github-actions](https://github.com/apps/github-actions)! - Overlays: `data-et-overlay-layer` (or a per-open `zIndex`) puts an overlay above the default stacking level, which is how the query devtools panel and its toggle now stay visible over an app's own modals and tooltips.

## 1.0.0-next.2

### Minor Changes

- [`890baea`](https://github.com/ethlete-io/ethdk/commit/890baea0b301288f2a9a41a68a795e47181a7cdb) Thanks [@TomTomB](https://github.com/TomTomB)! - Query devtools: a docked panel now takes its room out of the page instead of covering it, so a long page still scrolls to its last row. Toggle it in the layout menu.

- [#3058](https://github.com/ethlete-io/ethdk/pull/3058) [`b6c106e`](https://github.com/ethlete-io/ethdk/commit/b6c106e17d8925fd881eb94974782e94ae03686d) Thanks [@github-actions](https://github.com/apps/github-actions)! - The Mocks tab seeds a body in a placeholder, realistic or stress value style, and `provideQueryDevtools({ schema })` takes one API description per query client.

### Patch Changes

- [#3058](https://github.com/ethlete-io/ethdk/pull/3058) [`d3e7a0b`](https://github.com/ethlete-io/ethdk/commit/d3e7a0bae48081d5eefc2f76ccd77ccae9c2e284) Thanks [@github-actions](https://github.com/apps/github-actions)! - The Mocks tab's mock form now keeps a bounded width instead of stretching to the panel, and each seed picker sits next to the button that acts on it.

## 1.0.0-next.1

### Minor Changes

- [#3057](https://github.com/ethlete-io/ethdk/pull/3057) [`bb78b37`](https://github.com/ethlete-io/ethdk/commit/bb78b3725ec66ff98bcbd9e2e8d90e190173ecca) Thanks [@github-actions](https://github.com/apps/github-actions)! - Query devtools: a **Locks** tab listing every Web Lock held across the origin - the auth and polling elections decoded, how many tabs are in each, and where this tab stands.

## 1.0.0-next.0

### Major Changes

- [#3055](https://github.com/ethlete-io/ethdk/pull/3055) [`7245dc7`](https://github.com/ethlete-io/ethdk/commit/7245dc788ddab057e39b8ac8aeb1e7c019baa2dc) Thanks [@github-actions](https://github.com/apps/github-actions)! - The devtools panel moved out of `@ethlete/components` into its own package, `@ethlete/query-devtools`, where `<et-query-devtools-lazy>` loads it on first open instead of shipping it - 125 kB gz an application no longer pays.

### Patch Changes

- [#3055](https://github.com/ethlete-io/ethdk/pull/3055) [`bbb294f`](https://github.com/ethlete-io/ethdk/commit/bbb294fd9d99d8f7d0ab0036af819fb734d0e136) Thanks [@github-actions](https://github.com/apps/github-actions)! - Mark `@analogjs/vitest-angular` an optional peer dependency, so installing the devtools no longer
  asks consumers for a test runner the package only needs to run its own specs.
