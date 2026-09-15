# Changelog

## 1.0.0-next.11

### Patch Changes

- [`2bfa704`](https://github.com/ethlete-io/ethdk/commit/2bfa704a397dd1841cd439a69ad69b58373e1307) The response diff now reports a changed `Blob`, `Date`, `Map` or `Set` instead of reading two
  of them as identical, and searching a folded slice no longer overflows on a cyclic value.
- [`0dbb0fd`](https://github.com/ethlete-io/ethdk/commit/0dbb0fd7629ed2c3b88cb9528dd30a383466729a) The panel drops a client's Cache, Faults and Events entries once that client's injector is destroyed,
  instead of keeping them alive for as long as one of its queries has a tombstone.
- [`197ba4c`](https://github.com/ethlete-io/ethdk/commit/197ba4c2714122a9b27eda8f7eab84ad42ec8241) Query devtools exports stop carrying live credentials: a copied report slims its args, a session export omits auth-provider bodies and redacts credential-named keys, and an unchainable secure request drops its `Authorization`.
- [`03f0285`](https://github.com/ethlete-io/ethdk/commit/03f0285b028cd5b740075eabe400858973d45533) `<et-query-devtools-lazy>` renders nothing without `provideQueryDevtools()` - no floating button, no
  shortcut, no panel download - and the now-public `isQueryDevtoolsEnabled()` is what it gates on.
- [`33251a2`](https://github.com/ethlete-io/ethdk/commit/33251a274b924ff60d48d50024d980a88c66620f) Devtools panel: the Settings client picker now narrows the Events tab, exports survive cyclic and non-JSON bodies, the `no auth` chip covers mocks with a query string, and copy confirmations reset again.

## 1.0.0-next.10

### Minor Changes

- [#3074](https://github.com/ethlete-io/ethdk/pull/3074) [`ee8e7d1`](https://github.com/ethlete-io/ethdk/commit/ee8e7d12b6ef06245f18df017c217d2bbe66e616) Thanks [@github-actions](https://github.com/apps/github-actions)! - The devtools session vault keeps one session per user on a backend that issues no `sub` claim, and
  the panel logs in as an account with the body keys that login needs.

### Patch Changes

- [#3074](https://github.com/ethlete-io/ethdk/pull/3074) [`bdaee24`](https://github.com/ethlete-io/ethdk/commit/bdaee24b127c7345f138bbad6dbc98bf2a8002dd) Thanks [@github-actions](https://github.com/apps/github-actions)! - The add-account row in the devtools auth tab stays on one line instead of breaking every part
  onto its own.

- [#3074](https://github.com/ethlete-io/ethdk/pull/3074) [`63201a5`](https://github.com/ethlete-io/ethdk/commit/63201a566d5577c7430293c839818b83784c2f5a) Thanks [@github-actions](https://github.com/apps/github-actions)! - Query devtools: every action in the panel now reads as a button rather than plain text, text fields
  and buttons no longer look alike, and one focus ring covers the whole panel.

- [#3074](https://github.com/ethlete-io/ethdk/pull/3074) [`33b92cf`](https://github.com/ethlete-io/ethdk/commit/33b92cf1677b8b95619cc5bf4b021a3b6146c85c) Thanks [@github-actions](https://github.com/apps/github-actions)! - Query devtools: the Auth tab no longer leaves a paragraph of empty space above the stored sessions.

## 1.0.0-next.9

### Minor Changes

- [`acc396a`](https://github.com/ethlete-io/ethdk/commit/acc396aa73313204fc09d54b083562cea5afb5b1) Thanks [@TomTomB](https://github.com/TomTomB)! - `provideQueryDevtools({ apiEnvs })` puts an API environment picker beside the floating toggle and on the Settings tab; a pick writes the app's own `localStorage` key and reloads. An env marked `production` makes the picker shout.

- [`d8fea59`](https://github.com/ethlete-io/ethdk/commit/d8fea594beb1094b0715ce24e308862d2ddd4f21) Thanks [@TomTomB](https://github.com/TomTomB)! - The devtools Auth tab now keeps every session you log in as and switches between them, logs in as an
  account declared through `provideQueryDevtools({ authAccounts })`, and can hold one tab's session
  apart from the rest.

## 1.0.0-next.8

### Patch Changes

- [#3069](https://github.com/ethlete-io/ethdk/pull/3069) [`0c324b0`](https://github.com/ethlete-io/ethdk/commit/0c324b0d765fb6a07ec9a5766638bd5b52006651) Thanks [@github-actions](https://github.com/apps/github-actions)! - Query devtools: list a query's request headers in their own section, so a secure query's `Authorization` is readable however its args reached it.

- [#3069](https://github.com/ethlete-io/ethdk/pull/3069) [`55736ec`](https://github.com/ethlete-io/ethdk/commit/55736ec21189efa86fd107043579fc4c65e4452e) Thanks [@github-actions](https://github.com/apps/github-actions)! - Correct reactive state mutability declarations across Query, Contentful and Query Devtools.

## 1.0.0-next.7

### Patch Changes

- [`a9bf390`](https://github.com/ethlete-io/ethdk/commit/a9bf390952d78d436bd23d33c86b57369a990fce) Thanks [@TomTomB](https://github.com/TomTomB)! - Auth multi-tab sync: a tab the browser froze now gives the leadership up instead of holding it while it refreshes nothing, and a follower whose token goes stale takes the refresh over when the leader does not answer.

- [`1e66670`](https://github.com/ethlete-io/ethdk/commit/1e66670e66307402d5849545146d6ca4e445693f) Thanks [@TomTomB](https://github.com/TomTomB)! - A menu row that opens a submenu now renders its own chevron icon, so remove any manual arrow you put in its `<et-menu-item-shortcut>`. Size it with `--et-menu-item-submenu-icon-size` (`12px`).

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
