# Bundle-size opportunities, round 2

Scan date 2026-08-01. Follow-up to [`tree-shaking-opportunities.md`](./tree-shaking-opportunities.md)
(phases 1–5 shipped). That work fixed the **floors** (root-statement purity, tuple splits) and the
first opt-in splits (form-field styles, query persistence/sync, query-error labels, RTE heading/link
tools). This scan covers what it didn't: per-feature static reachability inside domains, component
CSS slices, third-party retention, and the **install-time dependency footprint** (which tree-shaking
cannot fix). All gz numbers are `tools/treeshake` `--external` mode unless noted.

Nothing here re-opens the items that plan measured as not worth doing (select/cascader
decomposition, bracket splits, FORM_FIELD barrel, overlay strategy registration).

**Status: eleven of the thirteen top picks shipped the same afternoon this was written**
(2026-08-01, 13:14–13:58), one was implemented and then reverted on measurement (E1), and
the two that remain are small. The per-finding sections keep the measurements and the
ruled-out notes, each now marked with what happened. What is genuinely left:

- **C2** - `@contentful/rich-text-types` runtime enums, 2.4 kB, S, non-breaking.
- **A3** - decide whether `@floating-ui/dom` becomes an optional peer now that B1 has landed.
- Deliberate-project or low-value leftovers: **D5** (table monolith decomposition), **D6**
  (RTE items, tracked in `tree-shaking-opportunities.md`), **E3** (injection-only CSS slices),
  **G** (two harness notes worth folding into `tools/treeshake/README.md`).

## Top picks by value/effort

| #   | Finding                                                    | Save (gz)                          | Effort | Breaking  | Status                         |
| --- | ---------------------------------------------------------- | ---------------------------------- | ------ | --------- | ------------------------------ |
| 1   | floating-ui out of the dialog path (core overlay runtime)  | ~7.1 kB per app that never anchors | M      | no        | shipped `6c9d38d7e`            |
| 2   | Dependency footprint: optional peers + build-tooling peers | install-time DX                    | S      | no        | shipped `353777bb5` (A3 open)  |
| 3   | Contentful config fallback drags all embedded components   | 6.2–6.7 kB                         | S–M    | partly    | shipped `9c71ed3c7`            |
| 4   | `STREAM_IMPORTS` platform + PiP split                      | ~5.2 kB                            | S      | soft      | shipped `beec05f70`            |
| 5   | Scrollable pins buttons/drag/snap → taxes tabs/carousel    | 4–6 kB × 4 domains                 | M      | yes       | shipped `2c0d3c9f7`            |
| 6   | `GridDebugComponent` in `GRID_IMPORTS`                     | 2.5 kB                             | S      | trivially | shipped `beec05f70`            |
| 7   | slider/range-slider CSS dedupe                             | ~2.4 kB                            | S      | no        | **reverted** - gz says no (E1) |
| 8   | `@contentful/rich-text-types` runtime enums                | 2.4 kB (hidden by goldens)         | S      | no        | **open**                       |
| 9   | Breadcrumb collapse pulls overlay runtime                  | 6–8 kB (narrow audience)           | M      | yes       | shipped `beec05f70`            |
| 10  | Overlay strategy CSS follows the strategy provider         | 1.2–1.6 kB                         | M      | no        | shipped `2c0d3c9f7`            |
| 11  | Query error-parsing pipeline behind `withX()` features     | ~1.4 kB (12 % of qc entry)         | M      | yes       | shipped `53fcc97ef`            |
| 12  | Bearer-auth multi-tab sync opt-in                          | ~1.1 kB                            | M      | yes       | shipped `53fcc97ef`            |
| 13  | `RuntimeError` clone → dev-only                            | ~0.4 kB off every package floor    | S      | no        | shipped                        |

---

## A. Install-time dependency footprint (user-raised; tree-shaking can't fix this)

Declared peers force consumers to `yarn install` packages they never use. Verified against each
lib's `package.json`.

**Shipped `353777bb5`** for 1, 2 and 4: `socket.io-client` (query), `date-fns` (components) and the
build tooling (`vite`, `typescript`, `ts-morph`, `@nx/devkit`, `@analogjs/*`) are all
`peerDependenciesMeta: optional` across core/query/components/cdk now. **3 is the open decision.**

1. **`socket.io-client`** — hard peer of `@ethlete/query`, value-imported in exactly one file
   (`libs/query/src/lib/ws/web-socket-client.ts:13`). Already bundle-shakeable; make it
   `peerDependenciesMeta: optional` and let the ws entry fail with a clear error when missing.
   Check that no non-ws public `.d.ts` surfaces its types.
2. **`date-fns`** — hard peer of `components`, used only by calendar / time-picker / date-time
   inputs / match-card. Same optional-peer treatment; date/time docs state the requirement.
3. **`@floating-ui/dom`** — peer of core, components, cdk. Used by overlay positioning, menu,
   tooltip, toggletip, RTE. Central enough that optional-peer is debatable; finding B1 below
   removes it from the _bundle_ for non-anchored apps either way. Decide after B1 lands.
4. **Build tooling declared as hard runtime peers (the sleeper).** `vite`, `typescript`,
   `ts-morph`, `@nx/devkit`, `@analogjs/vite-plugin-angular` are required peers of core/query/cdk —
   but they are only referenced from `generators/**` and `test-setup.ts`, never from published
   `src/`. Only `components` marks `@nx/devkit` optional. Every consumer is currently told to
   install ts-morph and vite to use `@ethlete/core`. Fix: `peerDependenciesMeta: optional` across
   the board (or `ignoredDependencies` in each lib's `@nx/dependency-checks` config so they stop
   being added). Effort S, non-breaking, pure DX win.

After any change here: `yarn install`, commit the lockfile, re-lint the libs (dependency-checks).

## B. libs/core

**All three shipped `6c9d38d7e`**: anchored positioning installs its own setup through
`registerAnchoredPositionSetup`, `@angular/cdk` is gone from `libs/core/src`, and
`AnimatedOverlayDirective` moved to
`libs/cdk/src/lib/components/overlay/directives/animated-overlay/`. One loose end from that move:
`libs/core/src/lib/animations/animated-overlay.directive.docs.mdx` was left behind in core and
nothing references it.

1. **Overlay runtime statically pulls all of `@floating-ui/dom` — ~7.1 kB gz, M, non-breaking.**
   `libs/core/src/lib/overlay/overlay-position.ts:1` imports 9 floating-ui symbols top-level;
   `setupPositioning` (`overlay-position.ts:246`) dispatches on `strategy.kind` at runtime, and
   `overlay-runtime.ts:16` reaches it unconditionally. Global/centered positioning is pure CSS.
   Measured: `injectOverlayRuntime` is 5,457 B gz external vs 12,610 B with floating-ui bundled —
   the `overlay-dialog` golden (20,135 B) is really ~27 kB in an app, ~7 kB of it dead for
   dialog/sheet/fullscreen consumers. Fix: the anchored position strategy carries its own setup
   (or registers a hook), so `createAnchoredPositionCleanup` + the floating-ui imports live in a
   module only anchored/menu/tooltip reference. The public `positionStrategy: { kind: 'anchored' }`
   type stays. Secondary (~1 kB, S): `size`/`arrow`/`hide` are pushed conditionally
   (`overlay-position.ts:167/181/193`) but imported unconditionally.
2. **Drop `@angular/cdk` from core — ~1.6 kB gz + one less peer, M.** Survives on:
   `providers/breakpoint-observer.ts:1` (`BreakpointObserver`, 1,618 B gz standalone — replace with
   a `matchMedia` implementation; non-breaking, benefits every breakpoint-signal consumer),
   `signals/element.ts:1` (`coerceElement`, 125 B — inline), `props/template-input.ts:1`
   (type-only `ComponentType`), and `animations/animated-overlay.directive.ts` (next item).
3. **`AnimatedOverlayDirective` is a cdk-lib-only leftover in core — S, breaking (public API).**
   456 LOC, zero consumers outside `libs/cdk`; carries its own duplicate floating-ui import block
   (`animated-overlay.directive.ts:36`). Shakes fine today — relocating it into `libs/cdk` is
   worth 0 bytes directly but unblocks B2's dep removal and deletes the second floating-ui entry
   point in core.
4. Clean/ruled out: `libs/types` is pure types (45 B gz); no whole-lib third-party imports
   anywhere in core; per-feature weights well-proportioned (nothing over ~5 kB for one symbol).
   `injectRenderer` is the one "35 methods, consumers use two" case (~860 B) — not worth breaking.

## C. libs/contentful

**1, 3 and 4 shipped `9c71ed3c7`** (embedded components are provider-driven, the error-code record
is a literal, and `MARK_TAILWIND_MAP` is gone in favour of semantic mark tags). **2 is open** -
`BLOCKS`/`INLINES` are still value-imported in `rich-text-renderer.util.ts`,
`rich-text-node-types.ts` and `rich-text-renderer.component.ts`.

1. **Config fallback drags all five embedded components — 6.2–6.7 kB gz.**
   `utils/contentful-config.ts:1-5` statically references Audio/File/Image/Video/Link components,
   and is used as an inline fallback by `contentful-link.component.ts:36` (which only reads
   `internalHosts`) and `rich-text-renderer.component.ts:266`. Measured: `ContentfulLinkComponent`
   (95 LOC) costs **8,223 B gz** because the fallback reaches Image → `PictureComponent` →
   `inferMimeType`. Two-part fix: (S, non-breaking) a components-free defaults constant for link
   → ~2,000 B (−6.2 kB); (M, behavior change) embedded-component map only via
   `provideContentfulConfig()` → RTE entry 12,670 → ~6,000 B (−6.7 kB), but an app that never
   provides a config silently loses embedded-asset rendering — deliberate call needed.
2. **`BLOCKS`/`INLINES` are runtime TS enums — 2.4 kB gz, S, non-breaking.**
   `rich-text-renderer.util.ts:1` and `rich-text-renderer.component.ts:21` value-import them from
   `@contentful/rich-text-types` (2,403 B gz). Inline the stable CDA string literals (or a local
   `const ... as const`) and switch to `import type`. Invisible in `--external` goldens today.
3. Small floor hygiene (~300 B + 336 B unmin): `RICH_TEXT_RENDERER_ERROR_CODES` is an impure
   `Object.keys().reduce()` root (`rich-text-renderer.errors.ts:23`); `GQL_FRAGMENT_CONTENTFUL_ASSET`
   is a tagged-template root (`gql/asset.fragments.ts`). Literalize both.
4. **Non-size bug found in passing:** `rich-text-renderer.component.ts:82` still ships
   `MARK_TAILWIND_MAP` emitting Tailwind classes (`font-bold`, `italic`, …) into rendered rich
   text — contradicts the no-Tailwind-in-source rule and renders as nothing for consumers without
   those utilities. Leftover from the `useTailwindClasses` drop (`ddadbdb26`).

## D. libs/components — TypeScript

**1, 3 and 4 shipped `beec05f70`** (`STREAM_<PLATFORM>_IMPORTS` / `STREAM_PIP_IMPORTS`,
`GRID_DEBUG_IMPORTS`, `BREADCRUMB_COLLAPSE_IMPORTS`); **2 shipped `2c0d3c9f7`** (scrollable chrome
is opt-in). **5 and 6 are open** - 5 only as a deliberate project, 6 tracked in
`tree-shaking-opportunities.md`.

1. **`STREAM_IMPORTS` bundles 8 video platforms + the whole PiP subsystem — −5.2 kB gz, S,
   soft-breaking.** `stream/stream.imports.ts:39`. Measured: full barrel 36.3 kB → YouTube-only
   31.1 kB; PiP (pip-window/pip-chrome/position/animation + resize-handles +
   window-control-button) is ~4–5 kB gz of that. Fix: `STREAM_<PLATFORM>_IMPORTS` +
   `STREAM_PIP_IMPORTS` with shared consent/error/loading in `STREAM_IMPORTS`, plus a
   `STREAM_ALL_IMPORTS` alias for the soft landing. Same shape as `TABLE_IMPORTS`.
2. **`ScrollableComponent` statically pins every optional behaviour — 13.5 kB gz over the headless
   directive, and it's inherited by tabs/nav-tabs/carousel — M, breaking.**
   `scrollable/scrollable.component.ts:48-63` imports Masks/Buttons/Navigation/Snap/Drag/Darken
   directives; navigation drags `IconButtonComponent` → `SpinnerComponent` →
   `color-interactive-styles`. `ScrollableDirective` alone 9.6 kB vs `SCROLLABLE_IMPORTS` 23.1 kB;
   `TAB_IMPORTS` (27.9 kB) and `CAROUSEL_IMPORTS` (30.5 kB) are ~25–28 % scrollable. Realistic
   recovery: nav chrome ~4–4.5 kB + drag/snap ~1.5 kB per consumer. Fix: move the optional
   directives out of the component `imports` into `SCROLLABLE_NAVIGATION_IMPORTS` /
   `SCROLLABLE_DRAG_IMPORTS` applied on the host (table-features style); tabs re-opts in
   explicitly.
3. **`GridDebugComponent` ships in every production grid — −2.5 kB gz, S.**
   `grid/grid.imports.ts:12`; runtime-gated by a localStorage flag
   (`grid/headless/grid.directive.ts:63-78`), so dead weight in 100 % of prod builds. Fix:
   `GRID_DEBUG_IMPORTS`.
4. **Breadcrumb collapse pulls toggletip → full overlay runtime — 6–8 kB gz, M, breaking.**
   `breadcrumb/breadcrumb.imports.ts:13`: breadcrumb's own code is 13.8 kB min of a 31.4 kB gz
   entry; the collapse affordance pins Toggletip + IconButton + spinner + overlay runtime (21.6 %).
   Fix: `BREADCRUMB_COLLAPSE_IMPORTS`, collapse rendering moves out of the base template.
5. **Table: no barrel problem — the cost is one monolithic component (L, later).** All opt-in
   directives already shake (`TableComponent` alone 20.5 kB vs `TABLE_IMPORTS` 21.4 kB). Inside
   `table.component.ts` (32.7 kB min, ~40 % of the bundle): sticky-column machinery
   (`:447,:515-538,:1566`), autosizing (`:523,:1629-1664`), grouped headers (`:626-651`), skeleton
   rows (pins `SkeletonItemComponent`, `:40,:246,:968`), unconditional expander/detail refs
   (`:686,:1053`). Est. 3–5 kB gz for a plain table via registered-feature decomposition. Only
   worth it as a deliberate project.
6. **RTE still-open items refined** (carried from the previous plan): DOM feature modules behind
   provide fns (~1,100 LOC always retained; invasive — narrows the headless directive's method
   surface); `provideRichTextEditorFloatingToolbar()` (~350 LOC); per-feature label defaults
   (~1 kB literal).
7. Ruled out this round: overlay `defineOverlay` retains no drag-to-dismiss/sheet/fullscreen code
   (verified absent from decompose; strategies cost 0.9–1.7 kB each and shake); `PHONE_COUNTRIES`
   literal is <0.5 kB gz; date-picker stack has no dead weight (only marginal idea: don't pin
   `SegmentedButtonGroupComponent` ≈2 kB when the panel has no toggle); no large keymap/icon/locale
   literals; icon-button→spinner is ~0.7 kB × 8 domains — context for D2, not its own item.

## E. libs/components — CSS

**2 shipped `2c0d3c9f7`** (strategy styles mount on demand); **1 was reverted** on measurement;
**3 is open** and low-value.

1. **slider/range-slider CSS dedupe — implemented, measured, REVERTED (2026-08-01).** The ~2.4 kB
   estimate was raw bytes; gzip already collapses the two near-identical sheets (adding
   `RangeSliderComponent` to a slider-only bundle costs only 1,316 B gz total), and routing the
   sheet through a styles-only component costs ~1 kB gz of style-manager machinery in apps not
   already using it. Best case measured −233 B, typical case a regression. Lesson recorded in §G:
   raw-byte CSS duplication is a poor proxy for gz cost.
2. **Overlay strategy CSS can follow the strategy provider — 1.2–1.6 kB gz, M, non-breaking.**
   `overlay/overlay-container.component.css:363-589` is `.et-overlay.et-with-default-animation`
   split cleanly per strategy (full-screen 431 B, sheets 871 B, dialog 248 B, anchored 360 B gz) —
   and each strategy already has its own shakeable provider file. Fix: `stylesComponent` field on
   the breakpoint config, mounted by the container. Only hand-rolled `containerClass` users are
   affected.
3. **Injection-only candidates** (byte win would require breaking opt-in; do as on-demand mounts):
   choice-field card variant (`choice-field.component.css:235-340`, 2 kB, 66 % of sheet, S);
   carousel autoplay chrome (`carousel.component.css:165-349`, ~1.8–2.5 kB — autoplay is a host
   directive so bytes can't move without a breaking change, S); cascader sheet-mode slice
   (`cascader-panel.component.css:666-717` + keyframes, ~1 kB, S).
4. Checked and cleared: button/icon-button/fab share no dedupeable CSS (token sets genuinely
   differ); scrollable slices all <900 B and fiddly; calendar/match-card have no minority slice;
   query-devtools CSS (4 kB) shakes correctly today — re-verify only if the provider-tuple floor
   ever regresses; core/cdk CSS already in the right shape.

## F. libs/query (current gen)

**All four shipped**: 1 and 2 as `53fcc97ef` (error parsing, retry and bearer multi-tab sync behind
`withX()` features), 3 in core (`RuntimeError` logs the payload directly, no `clone`), 4 as
`03b6aec1a` (`createQueryDevtoolsStats` is installed by `provideQueryDevtools` through the devtools
hook). Baselines below therefore predate all four.

Verified baselines (gz, `--external`): floor 872 B; `createQueryClient + createGetQuery` (qc)
11,442 B; qc + paged stack 13,656 B; secure entry (`createSecureGetQuery +
createBearerAuthProvider`) 14,865 B; `createQueryForm` alone 4,566 B; `createWebSocketClient`
alone 3,321 B.

1. **Error-response normalization pipeline is always retained — 1,373 B gz (12 % of the qc
   entry), M, breaking.** `http/query-error-response.ts:2-8` statically imports the HTML-error
   extractor (`query-error-html-utils.ts`, 10 regexes + `HTML_ENTITIES` table), the
   Symfony/Pagerfanta/class-validator shape detectors (`query-error-response-utils.ts`), and
   `shouldRetryRequest`; `createQueryErrorResponse` is reached from `http-request.ts:361` on every
   request path. HTML-page extraction alone is ~870 B and only fires when a proxy returns an HTML
   body. Fix: pluggable parser via client features (`withHtmlErrorParsing()`,
   `withSymfonyErrors()`, retry via `withDefaultRetry()` — `options.retryFn` already exists), with
   a `withEthleteApiErrors()` preset for the soft landing.
2. **Bearer-auth multi-tab sync + leader election on by default — 1,128 B gz on the secure entry,
   M, breaking.** `auth/bearer-auth-provider.ts:42` statically imports
   `setupLeaderElection`/`setupMultiTabSync`; defaults at `:489`/`:509` are enabled-unless-false,
   so a single-tab app can't opt out at build time. `auth/features/` already has the right pattern
   — move to `withBearerAuthMultiTabSync()`. Bonus: `leader-election.ts` module constants leak
   into the package floor (872 → 838 B when stubbed).
3. **`RuntimeError` deep-clones its payload for a dev-only log — ~373 B gz on every `@ethlete`
   package floor, S, non-breaking.** `libs/core/src/lib/utils/runtime-error.ts:1` imports `clone`
   (with its ~950 min B `clone`+`set` pair) used at `:15` only to snapshot data for a deferred
   `console.error`. Log directly or gate behind `isDevMode()`. Cheapest byte-per-effort item in
   the audit.
4. **Devtools instrumentation ~0.5 kB on every entry, S–M, non-breaking.** The
   `isQueryDevtoolsEnabled()` guard is runtime-only, so meta-object literals,
   `stringifyQueryRoute` etc. stay reachable from `base-query-factory.ts:227`,
   `query-stack.ts:425`, `paged-query-stack.ts:549`, `query-sequence.ts:245`,
   `bearer-auth-provider.ts:14`. Fix: registration through a hook installed by
   `provideQueryDevtools()` (module-level `let register = noop` swap).
5. Clean/ruled out: gql costs +114 B over qc; ws and `query-form-signals` are fully separate;
   JWT/`decryptBearer` doesn't leak into REST entries; error-message factories already shake
   per-factory; query snapshot laziness ~253 B (skip). No large literal tables beyond
   `HTML_ENTITIES`.
6. **Measurement caveat:** variant builds must use `nx build query --skip-nx-cache` — Nx restored
   a cached `dist` for a reverted tree twice during this audit and produced bogus baselines.

## G. Measurement notes

- `tools/treeshake/decompose.mjs` attributes compiled CSS to the component's `.html`/`.ts` row —
  `overlay-container.component.html` "16.9 kB" and `table.component.html` "19.1 kB" are really
  their stylesheets. Worth a note in the treeshake README.
- The `--external` goldens hide third-party retention (floating-ui B1, rich-text-types C2).
  Consider one golden per lib in bundled mode for the third-party surface.
- **Raw-byte CSS duplication is a poor proxy for gz cost** (learned from the reverted E1): gzip
  already collapses near-identical sheets, and the styles-only-component indirection has a ~1 kB gz
  floor (`injectStyleManager` + `createComponent`) in an app not already using the style manager.
  Only _distinct_ CSS slices are worth splitting; Angular also flattens CSS nesting, so a
  multi-element root selector is re-emitted on every nested rule.
