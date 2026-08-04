# Bundle size: what is left

Two audit rounds ran against `@ethlete/{core,query,components,contentful}` (2026-07-31 and
2026-08-01) and both are essentially executed: the provider-tuple floors, the opt-in splits
(form-field styles, query persistence/sync/error-parsing/bearer-sync, RTE heading + link tools,
stream platforms, grid debug, breadcrumb collapse, scrollable chrome, anchored overlay positioning,
contentful embedded components) and the install-time peer footprint all landed. The measurement
pipeline, the goldens and the rules for reading the numbers live in
[`tools/treeshake/README.md`](../tools/treeshake/README.md); the guard is
`nx run treeshake:bundle-goldens`. Everything below is what those rounds did **not** close.

## Ground rules for any further work

- **Skip `libs/cdk`** (maintenance mode) and legacy query (`libs/query/src/lib/legacy/**`,
  reactive-forms `query-form/`).
- **Breaking changes are fine in `components` and `query`.** Breaking `@ethlete/core` needs an Nx
  migration generator shipped in the same release - the SDK is in a changesets major pre-release, so
  there is no deprecation cycle. Precedents: `@ethlete/core:migrate-to-v5`,
  `@ethlete/query:migrate-query-client-features`.
- Measure variant builds with `nx build <lib> --skip-nx-cache`. Nx restored a cached `dist` for a
  reverted tree twice during the second audit and produced bogus baselines - and once more on
  2026-08-04, where a stale cached `query` build made `components` fail to compile against it.
- **Read a number in `--third-party` mode before concluding a dependency shakes out.** `--external`
  values every third-party byte at 0.

## Open

1. **Decide whether `@floating-ui/dom` becomes an optional peer.** It is still a hard peer of core,
   components and cdk. Anchored positioning is opt-in at the _bundle_ level
   (`registerAnchoredPositionSetup`) and the `--third-party` goldens confirm it: the components floor
   costs 2,193 B with dependencies bundled, and only an entry that registers anchored positioning
   pays floating-ui (`overlay-anchored`: 3,628 B → 10,689 B). So a dialog-only app installs a package
   it never loads, which is the case for optional - but it is central enough that this is a judgment
   call. `date-fns` and the build tooling are already optional.
2. **RTE, in value order** (audited 2026-08-01, unchanged since):
   - **DOM feature modules behind provide fns** - ~1,100 of the always-retained ~2,830 LOC
     (blockquote / code-block / headings / autoformat / links are droppable for a marks-and-lists
     editor). Invasive: it narrows the headless directive's method surface. Design carefully.
   - **`provideRichTextEditorFloatingToolbar()`** - ~350 LOC + 82 CSS. Does not free the overlay
     runtime, so the win is smaller than it looks.
   - **Per-feature label defaults** - ~1 kB of the always-loaded 2.2 kB label literal serves the
     opt-in image / table / trigger tools.
3. **Injection-only CSS candidates** - a byte win needs a breaking opt-in, so do them as on-demand
   mounts instead: choice-field card variant (`choice-field.component.css:235-340`, 2 kB, 66 % of the
   sheet), carousel autoplay chrome (`carousel.component.css:165-349`, ~1.8-2.5 kB - autoplay is a
   host directive, so bytes cannot move without breaking), cascader sheet-mode slice
   (`cascader-panel.component.css:666-717` + keyframes, ~1 kB).
4. **Table monolith decomposition - 3-5 kB gz for a plain table, L, only as a deliberate project.**
   The barrel is fine (`TableComponent` alone 20.5 kB vs `TABLE_IMPORTS` 21.4 kB); the cost is inside
   `table.component.ts` (32.7 kB min, ~40 % of the entry): sticky-column machinery
   (`:447`, `:515-538`, `:1566`), autosizing (`:523`, `:1629-1664`), grouped headers (`:626-651`),
   skeleton rows (pins `SkeletonItemComponent`, `:40`, `:246`, `:968`) and unconditional
   expander/detail refs (`:686`, `:1053`). The registered-feature seams to decompose onto are
   described in `table-api.md`.

## Closed on 2026-08-04

- **`socket.io-client` in every query consumer - 13.0 kB gz, the biggest single win of the whole
  effort.** The package ships no `sideEffects: false`, so the FESM's one static `import { io }` was
  unshakeable: `import { transformToString } from '@ethlete/query'` (1.8 kB of our code) dragged
  41.7 kB min of socket.io + engine.io. It also made the "optional" peer mandatory - a REST-only app
  that skipped it could not resolve the import at all. `createWebSocketClient` now takes `io` as a
  required option (structural `WebSocketClientIo` type, so nothing in the lib imports the package,
  not even for types) and the peer declaration is gone. `query-floor` in `--third-party` mode:
  13,878 B → 838 B. `@ethlete/query/testing` gained `createWebSocketTestDouble()`, which is what
  the ws specs now drive instead of opening real sockets.
- **`@contentful/rich-text-types` runtime enums.** Already covered by the `CF_BLOCKS` / `CF_INLINES`
  literal maps - every remaining use of the enums is in a type position, so TS elides the import.
  Verified in `--third-party` mode: `contentful-deps` 6,329 B, _below_ the 6,407 B external-mode
  number, i.e. zero third-party retention. `import type` is **not** the guard here: lint autofixes
  that syntax away (`nx lint contentful --fix` rewrites it to a plain import). The golden is the guard.
- **Bundled-mode measurement** (the gap that hid both items above). `--third-party` externalizes only
  the framework; `goldens.json` carries one such entry per lib (`core-deps`, `query-deps`,
  `components-deps`, `contentful-deps`). Both `decompose.mjs`'s CSS attribution and the
  `--external` blind spot are now written down in `tools/treeshake/README.md`.
- **The orphan `animated-overlay.directive.docs.mdx`** in `libs/core/src/lib/animations/`, left
  behind when the directive moved to `libs/cdk`. Deleted.

All golden numbers were re-recorded in the same commit: the pre-existing entries drifted +1 to +8 B
from dependency bumps since the last audit, well inside tolerance.

## Measured as not worth doing - do not re-open

- **`select` 41.2 kB / `cascader` 42.4 kB decomposition.** Nothing is retained that a select does not
  use; the weight is `components/forms` (select + form-field + their headless, 41 %) plus the overlay
  it genuinely needs. The lever is the RTE-style feature split, not the select.
- **Bracket rounds-list-only layout.** `BracketRoundsListComponent` + a layout is 27.2 kB against
  29.2 kB for the full bracket + SE - a ~2 kB spread for an API split. Same for the default cards.
- **`FORM_FIELD_IMPORTS` barrel split.** Would unlock the affix CSS slice (~0.6 kB) at the cost of a
  breaking barrel change. The barrel pins the Hint/Counter/affix directives, so those slices save
  nothing until it splits - not worth it alone.
- **Overlay strategy registration**, `defineOverlay` retention (strategies cost 0.9-1.7 kB each and
  already shake), `PHONE_COUNTRIES` (<0.5 kB), the date-picker stack, `injectRenderer` (~860 B for
  "35 methods, consumers use two"), icon-button→spinner (~0.7 kB × 8 domains), notification and
  stream-manager barrel splits, query snapshot laziness (~253 B), gql over the query client (+114 B).
- **Third-party import hygiene** (swept 2026-08-01): `date-fns` is imported per-function from the
  root entry, rxjs uses modern paths outside story/debug files, `@angular/cdk` uses secondary entry
  points, and core and components duplicate no implementations.
- **slider/range-slider CSS dedupe** - implemented and reverted. See the lesson below.

## Lessons that cost real time

- **Raw-byte CSS duplication is a poor proxy for gz cost.** gzip already collapses two
  near-identical sheets (adding `RangeSliderComponent` to a slider-only bundle costs 1,316 B gz
  total), and routing a sheet through a styles-only component costs ~1 kB gz of style-manager
  machinery in an app not already using it. Best case measured −233 B, typical case a regression.
  Only split _distinct_ CSS slices. Angular also flattens CSS nesting, so a multi-element root
  selector is re-emitted on every nested rule.
- **An app bundled without Angular's builder gets no tree-shaking from these packages at all.**
  Plain Vite/esbuild/Rollup over the published FESM skips the linker and the optimizer babel passes,
  so it ships the whole library regardless of what any number here says. If that ever needs
  supporting, run those passes in this repo's publish pipeline rather than leaving them to the
  consumer.
