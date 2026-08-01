# Tree-shaking: static-analysis inventory (core / components / query)

Read-only research pass, 2026-07-31, branch `next` @ `568e9379c`. No repo files were modified.
Scope: `libs/core`, `libs/components`, `libs/query` (current generation only). `libs/cdk` and
`libs/contentful` were skipped per instruction.

Fix classes used below:

- **NON-BREAKING** - annotation or purely internal restructure, public API identical.
- **INTERNAL** - moves code between files/modules, no API change.
- **BREAKING-components** / **BREAKING-query** - acceptable per the user.
- **BREAKING-core+migration** - needs a codemod (see §5).

---

## 0. How the shipped bundle actually behaves (measured, not assumed)

These five facts decide which fixes are worth anything. Two of them contradict the follow-up note in
`plans/bracket-tree-shaking.md` ("`/*#__PURE__*/`-annotating those factories is the highest-leverage
bundle fix"), so read this section before planning.

**0.1 - The published artifact is ONE module per lib, so `sideEffects: false` cannot help.**
`libs/*/ng-package.json` has a single `entryFile`, and the build emits exactly one FESM file:
`dist/libs/core/fesm2022/ethlete-core.mjs` (434 kB), `dist/libs/components/fesm2022/ethlete-components.mjs`
(4.6 MB). `sideEffects: false` (`libs/core/package.json:5`, `libs/components/package.json:6`,
`libs/query/package.json:5`) only lets a bundler drop _whole modules_; with one module there is nothing
to drop at that granularity. Everything therefore hinges on **statement-level** shaking inside one
giant module - which is exactly why the import floor is ~89 kB gz.

**0.2 - Angular's app build does NOT pure-annotate our top-level calls.**
`node_modules/@angular/build/src/tools/esbuild/javascript-transformer-worker.js:106-108`:

```js
const safeAngularPackage = sideEffectFree && /[\\/]node_modules[\\/]@angular[\\/]/.test(filename);
plugins.push([markTopLevelPure, { topLevelSafeMode: !safeAngularPackage }], …);
```

`@ethlete/*` is not under `node_modules/@angular/`, so `topLevelSafeMode: true`. In that mode
`pure-toplevel-functions.js` **returns early for every CallExpression** and annotates only
`new InjectionToken(...)` (`node_modules/@angular/build/src/tools/babel/plugins/pure-toplevel-functions.js:51,86-90,107-118`).
Consequences:

- All ~78 module-scope `new InjectionToken(...)` in our libs are **already droppable** - no work needed.
- Every module-scope _call_ (`createLabels`, `createRootProvider`, `memoizeSignal`, `createQueryTemplate`, …)
  is retained unless **we** annotate it in source.

**0.3 - `/*#__PURE__*/` survives our publish pipeline, but rollup strips it off destructuring.**
Verified with the repo's own `tsc` + `rollup`:

| source                                     | after tsc            | after rollup (FESM step) |
| ------------------------------------------ | -------------------- | ------------------------ |
| `export const c = /*#__PURE__*/ f('c')`    | annotation preserved | **annotation preserved** |
| `export const [d,e] = /*#__PURE__*/ [...]` | annotation preserved | **annotation dropped**   |
| `export const t = /*#__PURE__*/ new Map()` | preserved            | preserved                |

**0.4 - esbuild cannot drop a destructured declaration, annotated or not.** Isolated experiment
(pure arguments, pure factory, nothing used from the module):

| pattern                                                | esbuild                     | rollup  |
| ------------------------------------------------------ | --------------------------- | ------- |
| `const X = /*#__PURE__*/ f(a)`                         | dropped                     | dropped |
| `const [a,b,c] = /*#__PURE__*/ f()`                    | **kept**                    | dropped |
| `const {a,b} = /*#__PURE__*/ f()`                      | **kept**                    | dropped |
| `const _x = /*#__PURE__*/ f(); const a = _x[0]`        | **kept**                    | dropped |
| `const a = /*#__PURE__*/ f()[0]`                       | **kept**                    | dropped |
| `const _x = /*#__PURE__*/ f(); const a = () => _x.g()` | **dropped when `a` unused** | dropped |
| an unannotated call anywhere in the arguments          | **kept**                    | -       |

Angular apps bundle with esbuild, so the esbuild column is what ships. **The fix is not an annotation
campaign - it is dropping the destructured-tuple idiom.** The only shapes esbuild can drop are
(a) a single binding initialized by an annotated call, and (b) arrow-function/object-literal declarations.
Note the last row: a `const` holding the factory result plus thin arrow wrappers per exported symbol
_is_ fully droppable, and keeps public names identical.

**0.5 - Today there are zero `/*#__PURE__*/` / `@__NO_SIDE_EFFECTS__` annotations in any of the three
libs' sources.** (The single `__PURE__` in the core FESM at line 7113 is rollup's own `Object.freeze`
namespace object.) Module-scope impure statement counts, excluding `*.spec.ts` / `stories/`:

| lib                   | total | of which `new InjectionToken` (already free) | real payload |
| --------------------- | ----: | -------------------------------------------: | -----------: |
| `components`          |   131 |                                           71 |       **60** |
| `core`                |    77 |                                            7 |       **70** |
| `query` (current gen) |    26 |                                            3 |       **23** |

Full machine-generated lists: `impure-components.txt`, `impure-core.txt`, `impure-query.txt` in this
scratchpad (scanner: `scan.py`).

---

## 1. @ethlete/core

Total shipped source 14,258 LOC. Biggest subsystems: `signals` 3,063 · `seo` 1,875 · `utils` 1,802 ·
`animations` 1,397 · `theming` 1,227 · `overlay` 1,064.

### 1.1 The helper factories themselves (the root cause; a core-lib decision)

- **[BREAKING-core+migration] `libs/core/src/lib/utils/angular/di.ts:69,77,89,102` + `libs/core/src/lib/providers/labels.ts:53`** -
  `createProvider` / `createRootProvider` / `createStaticProvider` / `createStaticRootProvider` /
  `createLabels` all `return [provide, injectFn, token] as const`. Every one of the ~70 call sites
  across the three libs therefore _must_ destructure, which per §0.4 makes the declaration
  undroppable in esbuild and per §0.3 loses any annotation in rollup. The bodies are already pure
  (just `new InjectionToken` + closures) - **purity is not the problem, the tuple return is.**
  Suggested fix, in order of preference:
  1. **Lazy descriptor (recommended, non-breaking at consumer call sites).** Add
     `defineProvider(...)`/`defineLabels(...)` that return a **plain object literal** descriptor
     (pure, droppable) and create the `InjectionToken` lazily on first `inject`/`provide`
     (`desc.token ??= new InjectionToken(...)`, cached on the descriptor). Call sites become
     `const x = defineLabels(...)` (droppable object literal) + `export const injectXLabels = () => injectLabels(x)`
     and `export const provideXLabels = (v) => provideLabels(x, v)` - arrow declarations, individually
     droppable, **same exported names**. Only the third tuple element (the exported token const) cannot
     survive as a value export (member access ⇒ retention, §0.4); it would become a function or drop.
  2. **Object return + annotated single binding**: `export const X_LABELS = /*#__PURE__*/ createLabels(...)`,
     consumers use `X_LABELS.inject()`. Droppable, but renames every public `injectX`/`provideX`.
  3. Keep the tuple and annotate: **does not work** (§0.3/0.4). Do not plan around this.
     Size: helper change ~60 LOC in core; call-site rewrite is mechanical across ~70 sites (see §5 for
     the codemod), and unlocks most of the 39 kB the floor grew by since the table plan.

### 1.2 Impure top-level initializers in core (70 real ones)

- **[NON-BREAKING] `libs/core/src/lib/signals/media-queries.ts:14,17,20,23,26,29,57,77,80,83,93,96,99,109,114,117,120`** -
  17 × `const x = memoizeSignal(...)`. `memoizeSignal` allocates a `new WeakMap()` per call
  (`libs/core/src/lib/signals/signal-data-utils.ts:136-150`), so each is genuinely impure and all 17 are
  retained together: `injectIsXs()` costs the whole file, plus `injectBreakpointObserver` →
  `@angular/cdk/layout`, plus (`:117`) the ResizeObserver element-dimensions subsystem and (`:120`)
  `injectRenderer` (239 LOC). Fix: `/*#__PURE__*/` on each call (single bindings - these are _not_
  destructured, so annotation alone works here), or move the WeakMap creation inside the returned
  closure and mark `memoizeSignal` `@__NO_SIDE_EFFECTS__`. ~400 LOC + CDK layout.
- **[NON-BREAKING] `libs/core/src/lib/signals/router.ts:54,68,83,118,162,274,305`** - 7 × `memoizeSignal`;
  `injectUrl()` retains all router signals (357 LOC) + `@angular/router` symbols. Same fix.
- **[NON-BREAKING] `libs/core/src/lib/signals/document-visibility.ts:15`** - 1 × `memoizeSignal`.
- **[BREAKING-core+migration] 15 × `createRootProvider`**: `providers/style-manager.ts:18`,
  `providers/focus-visible-tracker.ts:4`, `providers/renderer.ts:4`, `providers/angular-root-element.ts:4`,
  `providers/breakpoint-observer.ts:51`, `providers/locale.ts:4`, `signals/recipes/scroll-restoration.ts:116`,
  `theming/surface-context-tracker.ts:31`, `unsaved-changes/unsaved-changes-coordinator.ts:48`,
  `seo/{structured-data,favicon,title,link,meta}-binding.ts:30,87,52,73,149`, `overlay/overlay-runtime.ts:32`.
  Heaviest closures: `overlay/overlay-runtime.ts:32` (397 LOC + `overlay-position.ts` 273 LOC + `@floating-ui/dom`
  - `ANIMATED_LIFECYCLE_TOKEN` ⇒ `AnimatedLifecycleDirective` 464 LOC ⇒ `AnimatableDirective`), and
    `seo/title-binding.ts:52` (pulls `injectIsRouterInitialized` ⇒ all of `signals/router.ts` + `@angular/router`).
    Fix per §1.1.
- **[BREAKING-core+migration] 5 × `createStaticRootProvider`** (`providers/breakpoint-observer.ts:39`,
  `seo/structured-data-binding.ts:23`, `seo/title-binding.ts:43`, `seo/link-binding.ts:66`,
  `seo/meta-binding.ts:141`), **6 × `createStaticProvider`** (`theming/surface-theme.util.ts:63,67`,
  `theming/color-theme.util.ts:77,80`, `theming/theme.util.ts:49,52`), **1 × `createProvider`**
  (`providers/boundary-element.ts:4`). Same fix.
- **[NON-BREAKING] `libs/core/src/lib/seo/link-binding.ts:242,263,265` and `seo/meta-binding.ts:308,322`** -
  5 × `createPropertyBinding(...)` (impl `seo/head-binding.ts:42-54`, pure). Single bindings ⇒ a plain
  `/*#__PURE__*/` fixes them. Today `applyCanonicalBinding` retains `applyPrev/NextBinding` and the whole
  302-LOC link module (and meta's 555 LOC).
- **[NON-BREAKING] module-scope `Symbol(...)`** - `signals/router.ts:16`,
  `signals/recipes/scroll-restoration.ts:86,87,88`, `theming/provide-color.directive.ts:48`,
  `theming/provide-surface.directive.ts:26`. Annotate (`/*#__PURE__*/ Symbol(...)` is honored) or move
  into the consuming closure. Tiny individually, but each pins its module's neighbours.
- **[NON-BREAKING] module-scope `new Set/Map`** - `signals/breakpoint-input.ts:23`, `utils/markdown.ts:74`
  (in the largest core file, 608 LOC), `seo/link-binding.ts:52`, `seo/meta-binding.ts:58`,
  `utils/angular/component-id.ts:1`, `animations/*`. Annotate.
- **[NON-BREAKING] `libs/core/src/lib/providers/angular-root-element.ts:4`** - the only provider call site
  that omits `{ name }`, so it evaluates `createComponentId('provider')` at import time, which **mutates
  the module-level `componentIds` Map** (`utils/angular/component-id.ts:1-8`). Give it a static name;
  removes a genuine import-time mutation.

### 1.3 Static retention chains inside core

- **[INTERNAL] `libs/core/src/lib/animations/animated-lifecycle.directive.ts:39`** - `hostDirectives: [AnimatableDirective]`;
  and `overlay/overlay-runtime.ts:13` imports `ANIMATED_LIFECYCLE_TOKEN` from `../animations`, so **any
  overlay usage retains 464 + 190 LOC of animation directives**. Consider splitting the token into its own
  module (token file that does not import the directive) so the overlay runtime references only the token.
- **[INTERNAL] `libs/core/src/lib/theming/auto-surface.directive.ts:19`** - `hostDirectives: [ProvideSurfaceDirective]`
  ⇒ `surface-theme.util` + `surface-context-tracker`. Intrinsic to the feature; note only.
- **[INTERNAL] `libs/core/src/lib/utils/logger.ts:1`** - a 1-export util inside the `utils` barrel imports
  `injectQueryParam` from `../signals`, creating a `utils ↔ signals` cycle. Deep-import the specific module.
- **[INTERNAL] `libs/core/src/lib/unsaved-changes/unsaved-changes-tab.ts:13`** - imports `injectFaviconStore`,
  `injectTitleStore` from `../seo`, so unsaved-changes drags the 1,875-LOC SEO subsystem + router signals.
- **[INTERNAL] `libs/core/src/lib/signals/render-utils.ts:2`** - `nextFrame` from `../animations` starts a
  4-hop chain `signals → animations → theming → providers` (`animations/animated-overlay.directive.ts:40`
  imports `ProvideColorDirective`). Six `signals` files sit on it. Deep-import `../animations/next-frame`.
- **[INTERNAL] `libs/core/src/lib/overlay/overlay-runtime.types.ts:3`** - value-syntax import of
  `AnimatedLifecycleDirective` used only in type position. TS elides it today; under
  `verbatimModuleSyntax`/isolated transpile it becomes a live edge. Make it `import type`.
- **[INTERNAL] `libs/core/src/lib/theming/theme.util.ts`** - dead file (not in `theming/index.ts`, imported by
  nothing) that still contains 2 impure `createStaticProvider` calls (`:49,:52`) and duplicates
  `color-theme.util.ts:77,80`. Also dead: `theming/colored-styles.component.ts:9`,
  `theming/surfaced-styles.component.ts:9`. Delete (~250 LOC).

### 1.4 Barrel hygiene / side effects - core

- **No genuine import-time side effects**: no side-effect-only imports, no prototype patching, no
  module-scope DOM access, no CSS-from-TS. `sideEffects: false` is _behaviourally_ accurate but
  (per §0.1) buys nothing for a FESM.
- Module-level mutable singletons worth knowing about (not bundle size, but correctness/HMR):
  `unsaved-changes/unsaved-changes-tab.ts:101` (`BADGE_HOLDERS`, deliberately app-wide),
  `signals/recipes/css-vars.ts:6,39` (one-shot latches - a second Angular app in the same bundle silently
  gets no CSS vars), `theming/surface-context-tracker.ts:29`, `utils/angular/component-id.ts:1,10`.

---

## 2. @ethlete/components

Total shipped source ~94k LOC + 19k LOC CSS. Biggest: `forms` 28,847 + 8,743 css · `bracket` 7,023 ·
`table` 6,473 + 1,011 css · `stream` 6,357 · `overlay` 6,123 + 877 css · `grid` 3,432 · `menu` 2,237.

### 2.1 Import-floor retention: what every consumer pays for importing anything

Each item is an impure module-scope statement (§0.4) whose closure references components/features.
These are the "floor" - a `<et-button>`-only app ships all of them.

- **[BREAKING-components] `libs/components/src/lib/overlay/overlay-manager.ts:41`** - `createRootProvider`
  factory references `OverlayContainerComponent` at `:128` ⇒ the container component (289 LOC TS + **610 LOC CSS**)
  and `createOverlayStrategyController` are in every bundle. Fix: §1.1 shape (then it drops unless
  `injectOverlayManager` is actually used).
- **[BREAKING-components] 7 × overlay strategies, all impure top-level `createRootProvider` + `createStaticRootProvider`**:
  `overlay/strategies/dialog.strategy.ts:19` (+`:5`), `bottom-sheet.strategy.ts:23` (+`:6`),
  `top-sheet.strategy.ts:23`, `left-sheet.strategy.ts:23`, `right-sheet.strategy.ts:23`,
  `anchored-dialog.strategy.ts:47` (+`:30`), `full-screen.strategy.ts:30` (+`:14`). The whole
  `overlay/strategies` folder (2,735 LOC) ships unconditionally; `full-screen.strategy.ts` additionally
  pins `fullscreen-animation.ts` (738 LOC) → `OverlayOriginCloneComponent`. The _value-shaped_ entry points
  (`dialogOverlayStrategy()` etc.) are already fine - only the provider tuples are the problem.
- **[BREAKING-components] `libs/components/src/lib/notification/notification-manager.ts:43`** - factory
  calls `createComponent(NotificationStackComponent)` at `:90` ⇒ the entire notification UI
  (1,532 LOC TS + 336 LOC CSS) is in every bundle. Same fix; highest single win in this list.
- **[BREAKING-components] `libs/components/src/lib/stream/pip-chrome-manager.ts:17` + `stream/stream-config.ts:101-111`** -
  the manager's factory calls `injectStreamConfig()`, whose default value object statically names
  `StreamPlayerLoadingComponent`, `StreamPlayerErrorComponent`, `StreamPipChromeComponent`
  (`stream-config.ts:104-106`). Plus `stream/stream-manager.ts:15`, `stream/pip-manager.ts:8`,
  `stream/stream-script-loader.ts:6`, `stream/consent/stream-consent-config.ts:15`. So a non-stream app
  ships the stream managers and 3 stream components. Fix: provider shape (§1.1) **and** turn the
  component defaults into a lazily-resolved fallback (`config.loadingComponent ?? (await/injected default)`,
  or resolve the default at the call site inside the stream component that actually renders it, the way
  `bracket-components.ts` does).
- **[BREAKING-components] `libs/components/src/lib/query-error/query-error-labels.ts:59`** - `createLabels`
  whose default resolver (`:47`, `:30-40`) references `parseHttpErrorCodeToTitle{En,De}` /
  `…Message{En,De}` from `@ethlete/query` ⇒ **both HTTP status tables (~386 LOC in `libs/query/src/lib/pipes`)
  ship with any `@ethlete/components` import**. Fix: provider shape (§1.1) drops it entirely; or make the
  locale tables lazily referenced.
- **[BREAKING-components] 22 × `createLabels`** - `pagination/pagination-labels.ts:80`,
  `calendar/calendar-labels.ts:52`, `forms/date-time/date-time-labels.ts:70`, `forms/input/input-labels.ts:38`,
  `forms/cascader/cascader-labels.ts:40`, `forms/slider/slider-labels.ts:28`,
  `forms/form-field/form-field-labels.ts:35`, `forms/phone-input/phone-input-labels.ts:31`,
  `forms/dropzone/dropzone-labels.ts:43`, `forms/rich-text-editor/rich-text-editor-labels.ts:230`,
  `forms/select/select-labels.ts:37`, `time-picker/time-picker-labels.ts:31`, `match/match-labels.ts:133`,
  `notification/notification-labels.ts:22`, `standings/standings-labels.ts:71`, `chip/chip-labels.ts:22`,
  `stream/stream-labels.ts:75`, `carousel/carousel-labels.ts:44`, `table/headless/table-labels.ts:135`,
  `loader/loader-labels.ts:32`, `query-error/query-error-labels.ts:59`, `breadcrumb/breadcrumb-labels.ts:29`,
  `bracket/bracket-labels.ts:51`, `filter-overlay/filter-overlay-labels.ts`, `grid/grid-labels.ts:35`.
  Each retains its full default-strings object (30-260 LOC of literals; RTE's is 231 LOC, match's 133).
  Individually cheap, collectively the single largest count. Fix: §1.1 (mechanical, one codemod).
- **[BREAKING-components] remaining provider tuples**: `tabs/nav-tabs/headless/nav-tabs-registry.ts:21`,
  `forms/form-field/headless/form-support.ts:177`,
  `forms/rich-text-editor/headless/internals/rich-text-editor-dom.ts:155`,
  `forms/rich-text-editor/rich-text-editor-tools.ts:73`, `notification/notification-config.ts:145`,
  `breadcrumb/breadcrumb-manager.ts:16`, `overlay/overlay-scroll-blocker.ts:16`,
  `overlay/sidebar/sidebar-overlay.ts:52` (factory references `OverlaySidebarPageComponent` at `:98`),
  `overlay/routing/overlay-router.ts:125` (832 LOC routing subsystem), `grid/headless/grid-config.ts:13`,
  `picture/picture-config.ts:15`, `bracket/bracket.config.ts:125`.
- **[NON-BREAKING] misc annotatable statements**: `forms/date-time/internals/display-format-mask.ts:21`,
  `forms/phone-input/headless/phone-countries.ts:237`, `forms/rich-text-editor/rich-text-editor.component.ts:58`,
  `forms/rich-text-editor/headless/internals/rich-text-editor-dom-{blockquote,code-block}.ts:4`,
  `overlay/strategies/overlay-strategy-config-merger.ts:5`, `bracket/bracket-grid.ts:14` (`Object.keys`),
  `bracket/linked/swiss.ts:67` (`new Map` factorial cache), `time-picker/headless/internals/time-format.ts:17`
  (`new Date` probe), `forms/select/headless/select-option.directive.ts:22` +
  `forms/selection-list/headless/selection-option.directive.ts:22` (`Symbol`).

### 2.2 Cross-feature retention chains

- **[BREAKING-components] `libs/components/src/lib/forms/rich-text-editor/rich-text-editor.component.ts:77`** -
  `imports: [...BUTTON_IMPORTS, IconDirective, ...MENU_IMPORTS, NgComponentOutlet]`. The **entire menu
  system (2,237 LOC + 473 css)** is there for one tool: the `heading` block-style menu. RTE is the
  biggest feature in the lib (8,825 LOC) and already has a good opt-in seam for table/align/image
  (`RICH_TEXT_EDITOR_TOOL` multi-provider, `rich-text-editor-tools.ts:262`). Fix: move the heading menu
  behind the same seam (`provideRichTextEditorHeadingTool()`), or into a `RICH_TEXT_EDITOR_HEADING_IMPORTS`
  component. ~2.2k LOC off every RTE consumer that doesn't want headings; also removes RTE → menu for the
  align/table tools which import `MENU_IMPORTS` themselves (`tools/rich-text-editor-align-tool.component.ts:15`,
  `tools/rich-text-editor-table-tool.component.ts:5`).
- **[INTERNAL] `libs/components/src/lib/bracket/bracket-components.ts:8-12,43-55`** - the default cards
  (`BracketDefaultMatchComponent`, `…FinalMatch`, `…RoundHeader`, `…Continue`; 429 LOC + CSS) are the last
  `??` fallback, and the match cards pull the `match` domain (1,173 LOC + 651 css) via
  `bracket → match` (5 edges). Referenced from a function, so only bracket consumers pay - but _all_ of
  them do, including ones that always pass their own cards. Fix: make the defaults a value object the
  consumer opts into (`bracketDefaultCards()`), exactly like the new layouts; throw `ET34xx` when neither
  a card nor the defaults are registered.
- **[INTERNAL] known, from `plans/bracket-tree-shaking.md`** - rounds-list-only consumers pay **~3.9 kB**
  because the layout value they must register carries `createGrid`/`drawEdges` the list never calls
  (`bracket/bracket-layout.ts`, `bracket/layouts/*`). Fix: a list-only layout variant (or split the
  layout value into `{ list, grid }` slices resolved independently). ~4 kB gz for list-only apps.
- **[INTERNAL] `libs/components/src/lib/table/table.component.ts:36-40`** - the base table statically
  imports `SkeletonItemComponent` and 2 icons; `table/table-cell-error-mark.component.ts:6` pulls
  `TooltipDirective`; `table-column-menu-trigger.component.ts:11-12` and `table-column-chooser.component.ts:15`
  pull the menu system. The latter two are already inside opt-in feature imports
  (`TABLE_COLUMN_MENU_IMPORTS`, `TABLE_COLUMN_CHOOSER_IMPORTS`) - correct. Only the base's skeleton edge
  is worth a look (loading state could be a lead-column/seam contribution).
- **[INTERNAL] `libs/components/src/lib/forms/form-field/headless/anchored-panel-controller.ts:5-9`** -
  form-field's headless barrel reaches `overlay/overlay-template-host.component`, `overlay-manager`,
  `overlay-config`. Harmless _once_ the overlay provider tuples are fixed (§2.1) - until then it is one of
  the paths that makes overlay unavoidable. Worth a deep-import + module split so a plain
  `<et-input>` never mentions overlay.
- **[INTERNAL] `libs/components/src/lib/forms/date-time/date-input/date-input.component.ts:2`,
  `date-time-input/date-time-input.component.ts:12,14`, `time-input/time-input.component.ts:11`** -
  `CALENDAR_IMPORTS` (1,843 LOC + 508 css) / `TIME_PICKER_IMPORTS` are statically in the input components.
  Intrinsic (the picker panel is the feature), but note `date-fns` rides along into any date input.
- **[INTERNAL] `libs/components/src/lib/standings/*` → `match` (3 edges), `forms/tag-input` + `forms/select` → `chip`,
  `forms/*` → `loader` (5 edges, `SpinnerComponent`)** - small, intrinsic; listed for completeness.

### 2.3 Opt-in candidates (established patterns already exist)

Existing patterns to copy: styles-only components mounted via `injectStyleManager().mount(...)` - 10 in
components (`focus-ring`, `stream-player-slot`, `masonry`, `carousel-transition`, `button-properties`,
`table-{virtual-scroll,inline-edit,detail}`, `bracket-swiss`, `floating-action`) - per-feature
`*_IMPORTS` (13 for table alone, `table/table.imports.ts:30-101`), and value-object registries
(`bracket/layouts/*`, `RICH_TEXT_EDITOR_TOOL`).

- **[INTERNAL] `libs/components/src/lib/forms/form-field/form-field.component.css` (757 LOC)** - named in
  CLAUDE.md as the next styles-split candidate. Every input in the library instantiates form-field, so
  the split must be by _feature within_ form-field (support/hint/error chrome, the text-field shell,
  prefix/suffix, the busy/spinner state) rather than by consumer. Split into styles-only components
  mounted from the directives that actually enable each shell.
- **[INTERNAL] `libs/components/src/lib/query-devtools/` (1,333 LOC TS + 948 LOC CSS)** - the single
  largest stylesheet in the lib. Already gated behind `QUERY_DEVTOOLS_IMPORTS`
  (`query-devtools/query-devtools.imports.ts:3`) and `provideQueryDevtools()`, so it is opt-in _if_ no
  impure statement references it - verify after §2.1 lands; nothing found referencing it today.
- **[INTERNAL] `libs/components/src/lib/forms/rich-text-editor/` (8,825 LOC + 1,157 css)** - tools are
  partly split (align/table/image are providers, 2,307 LOC in `tools/`), but the _core_ still carries the
  floating toolbar, link editor, image editor, token palette/popup and the 13-entry
  `RICH_TEXT_EDITOR_TOOL_BUTTONS` map (`rich-text-editor-tools.ts:106-194`) referencing 13 directive
  methods. Candidates: heading menu (§2.2), floating toolbar as `RICH_TEXT_EDITOR_FLOATING_IMPORTS`,
  token palette/popup already have their own `*_IMPORTS`.
- **[INTERNAL] `libs/components/src/lib/overlay/routing/` (832 LOC) and `overlay/sidebar/` (213 LOC)** -
  distinct opt-in features today reachable only through impure provider tuples
  (`overlay/routing/overlay-router.ts:125`, `overlay/sidebar/sidebar-overlay.ts:52`). Free win once §2.1 lands.
- **[INTERNAL] `libs/components/src/lib/grid/` (3,432 LOC, 1,002-LOC `grid.directive.ts`)** - the biggest
  feature with **no** `*_IMPORTS` split and a registry-shaped config (`grid/headless/grid-config.ts:9`
  `registrations: []`) that is already correctly empty by default. Worth auditing for a
  `GRID_*_IMPORTS` split (data/actions/skeleton) after the floor work.
- **[INTERNAL] `libs/components/src/lib/stream/` (6,357 LOC)** - pip / consent / chrome are already
  separable subtrees; see §2.1 for the config-default fix that makes them actually optional.

### 2.4 Barrel hygiene - components

- `libs/components/src/index.ts` is a flat 32-line `export *` wall; each domain barrel likewise. Given
  §0.1 this costs nothing at publish time, but two things matter:
  - **[INTERNAL]** deep-import from barrels in _runtime_ code where a barrel would otherwise widen the
    graph for monorepo consumers using tsconfig paths (`table/*` already deep-imports icons -
    `table/table.component.ts:36-40` - good; `forms/*` mostly imports domain barrels).
  - **[NON-BREAKING]** the components `sideEffects: false` claim is false in the strict sense (131 impure
    statements). It is what makes any shaking work at all, so keep it - but the ~60 payload statements
    must be fixed in source, not by flipping the flag.
- No side-effect-only imports, no prototype patching, no CSS-from-TS anywhere in `libs/components/src`.

---

## 3. @ethlete/query

### 3.1 The legacy / current-generation boundary I drew

Classified **legacy** (excluded from the analysis below):

- **`libs/query/src/lib/legacy/**` (60 files, 7,154 LOC)** - the class-based `V2QueryClient`, its
  devtools component, directives, entity store, infinite-query, interop layer. Confirmed by
  `apps/docs/query/legacy.md:1-8` ("maintenance mode") and `apps/docs/query/index.md:5` ("Two generations").
- **`libs/query/src/lib/query-form/` (4 files, 1,049 LOC)** - the reactive-forms `QueryForm`, superseded by
  `query-form-signals` (`apps/docs/query/query-forms.md:8-16`, `apps/docs/query/index.md:44`). Still
  exported and supported, so it is "previous generation" rather than dead; I analysed only whether
  current-gen code drags it (it doesn't - see 3.3).
- Also legacy-adjacent: `libs/query/src/lib/http/validate-with-query.ts` ↔
  `libs/query/src/lib/legacy/validate-with-v2-query.ts`, and the `*-from-v2-query` bridges in
  `libs/components` (`forms/select/select-options-from-v2-query.ts`, `table/headless/table-rows-from-v2-query.ts`,
  `query-error/query-error-legacy.ts`).

Classified **current generation** (analysed): `lib/http/**` (7,216 LOC incl. `persistence/` 739 and
`sync/` 472), `lib/auth/**` (2,274), `lib/gql/**` (423), `lib/ws/**` (282 + socket.io-client),
`lib/devtools/**` (219), `lib/pipes/**` (386), `lib/query-form-signals/**` (770).

### 3.2 Findings

- **[BREAKING-query] `libs/query/src/lib/http/query-creator-templates.ts:33,36,39,42,45,48,51,54,57,60`** -
  10 module-scope `createQueryTemplate(...)` / `createSecureQueryTemplate(...)` calls. Using only
  `createGetQuery` retains all ten, hence the whole secure chain (`secure-query-creator.ts` →
  `secure-query.ts` → `secure-query-execute.ts` → `secure-query-execute-factory.ts`) in apps with no secure
  queries. Fix: single-binding + `/*#__PURE__*/` (these are _not_ destructured, so a plain annotation
  works - the cheapest win in the lib), or arrow wrappers. ~600 LOC.
- **[BREAKING-query] `libs/query/src/lib/gql/gql-query-creator-templates.ts:39,42,45,48,51,54,57,60`** -
  same, 8 calls; retains the secure-gql chain whenever any gql template is used. Same fix.
- **[BREAKING-query] `libs/query/src/lib/http/query-client.ts:6,8,11,13,14` (used at `:234,237,240,255,262`)** -
  `createQueryClient` **unconditionally value-imports** the persistence engine + IndexedDB adapter
  (`persistence/`, 739 LOC) and the sync engine + transport + key-lock manager (`sync/`, 472 LOC);
  both default to on (`:226`, `:248`) and are only _runtime_-gated by `isBrowser && config`. So every
  consumer ships 1,211 LOC of storage/BroadcastChannel machinery. Fix: make them opt-in features
  (`withQueryPersistence()`, `withMultiTabSync()`) injected as values into the client config - the
  established `withX` shape - keeping default-on behaviour only when the feature is passed. This is a
  documented default-behaviour change (`apps/docs/query/persistence.md`, `multi-tab.md` both say
  "on by default").
- **[INTERNAL] `libs/query/src/lib/gql/gql-query.ts:1`, `gql-query-creator.ts:8`, `gql-query-execute.ts:1-15`** -
  import the **whole `../http` barrel**, while `http/base-query-factory.ts:8` imports a value from `../gql`
  (`isCreateGqlQueryOptions`). That `http ↔ gql` cycle drags all 42 http modules into the graph of anything
  that creates a query. Fix: deep-import, and move `isCreateGqlQueryOptions` into a shared leaf module.
- **[INTERNAL] `libs/query/src/lib/http/query-repository.ts:5` and `http/http-request.ts:4`** - value imports
  of `buildRoute` / `buildTimestampFromSeconds` **from the legacy barrel** (`../legacy`, which re-exports the
  V2 devtools component, directives, entity store…). Two pure helpers pull a 7,154-LOC tree into the graph.
  Same in `auth/bearer-auth-provider.ts:29` and `auth/bearer-auth-query-builders.ts:6` (`decryptBearer`;
  and `legacy/auth/auth-provider.utils.ts:3-5` value-imports the three V2 provider classes for `instanceof`).
  Fix: move those helpers into a current-gen leaf module and have legacy import _them_. Highest-leverage
  INTERNAL change in query.
- **[INTERNAL] `libs/query/src/lib/auth/bearer-auth-provider.ts:15-28`** - full-barrel value import of
  `../http`, so touching auth pulls all of http including persistence/sync/the gql cycle. Deep-import.
- **[NON-BREAKING] `libs/query/src/lib/devtools/query-devtools-registry.ts:79,88,93,98,139`** - module-level
  global registry (`let devtoolsEnabled = false`, `entries = signal([])`, `idCounters = new Map()`) that
  every query, stack, sequence, socket and the auth provider write through (`http/base-query-factory.ts:2-7`,
  `http/query-stack.ts:13`, `http/query-sequence.ts:4`, `http/paged-query-stack.ts:3`, `ws/web-socket-client.ts:14`,
  `auth/bearer-auth-provider.ts:14`). Correctly no-oped in production (`:121` early return) and only 219 LOC,
  but always in the bundle and impure at import. Fix: annotate the three statements; optionally make the
  registry an injected value so a devtools-free app drops the module entirely. The heavy devtools _UI_ is not
  here (it is the legacy component + `libs/components/query-devtools`).
- **Confirmed healthy - features are value-shaped.** `createQueryFeature` is an identity cast
  (`http/query-features.ts:83-88`); every `withX` returns a fresh `{ type, fn }` (`:99,163,322,474`);
  dispatch iterates the array (`base-query-factory.ts:84-91`) with no switch/registry naming all features.
  The only all-features artifact is the string map `QueryFeatureType` (`:57-66`) - harmless. Caveat: all
  features live in one 496-LOC module, so any one feature brings that module's shared imports
  (`nestedEffect` `:29`, rxjs `filter` `:5`, `sync/query-key-lock-manager` `:19`).
- **Confirmed healthy - no unwanted domain drag from the client**: `ws` (+ socket.io-client) and
  `query-form-signals` are reachable _only_ from the root barrel (`libs/query/src/index.ts:8,9`); `auth`
  is type-only from http (`secure-query-creator.ts:1`, `secure-query-execute-factory.ts:4`,
  `query-creator-templates.ts:1`); `query-form-signals` only deep-imports the dependency-free
  `query-form/query-form.utils` (`query-form-signals.ts:16`, `query-form-signals.fields.ts:10`), so the
  742-LOC legacy `QueryForm` is not dragged in.
- **No import-time side effects** anywhere in current-gen query: no side-effect-only imports, no prototype
  patching, no module-scope DOM access (every `indexedDB`/`BroadcastChannel`/`navigator` touch is inside a
  factory: `query-client.ts:274-282`, `persistence/query-persistence-indexed-db.ts:58`,
  `sync/query-sync-transport.ts:30`, `sync/query-key-lock-manager.ts:56`, `auth/internal/leader-election.ts:54`).
- **[NON-BREAKING] minor annotatables**: `http/query-features.ts:25` (`Symbol`), `http/query-context.ts:10`
  (`new InjectionToken` - already free per §0.2), `sync/query-key-lock-manager.ts:52,53` (two module-lifetime
  signals), `auth/utils/token-encryption.ts:14` (`let cachedKey` cross-instance cache),
  `http/query-error-html-utils.ts:12-32` + `gql/gql-transformer.ts:3` (11 top-level regex literals - pure
  in effect, but `new RegExp`-free literals are already droppable; no action).

---

## 4. Cross-cutting: publish-pipeline options

- **[INTERNAL, repo-level] Run the linker + optimizer passes ourselves.** `plans/table-tree-shaking.md`
  already documents that a consumer _not_ using `@angular/build` gets no shaking from our FESM. Combined
  with §0.2 (Angular's own pass skips non-`@angular` packages for call expressions), there is a case for
  running `@angular/compiler-cli/linker/babel` + `adjust-static-class-members` + `elide-angular-metadata`
  - `pure-toplevel-functions` (**with `topLevelSafeMode: false`**, which is legitimate for us because we
    control the source) as a post-`ng-packagr` step. That single pipeline change would annotate _all_ our
    top-level calls at publish time - but it still would not fix the destructured declarations (§0.4), so it
    complements, not replaces, the §1.1 work.
- **[INTERNAL] Secondary entry points** (`@ethlete/components/table`) would restore module-granularity
  `sideEffects: false` and make §0.1 moot. Large API/docs change (docs say "everything from the single
  package entry"), and orthogonal to the statement-level fixes; mentioned for completeness only.
- **Measurement**: reuse the harness described in `plans/table-tree-shaking.md` ("How to measure") and
  `plans/bracket-tree-shaking.md`; the import floor (`provideBracketConfig`-only entry, 91.5 kB gz at
  `568e9379c`) is the number to watch for §1.1/§2.1.

---

## 5. Migration tooling for @ethlete/core (what already exists)

The repo already has a mature Nx-generator migration story - no new infrastructure is needed:

- **Per-lib generators, declared in each `package.json`**: `libs/core/package.json:23`,
  `libs/components/package.json:29`, `libs/query/package.json:26` all carry
  `"generators": "./generators/generators.json"`, and `ng-package.json` ships
  `generators/generators.json` + the compiled `generators/dist/**/*.js` as assets
  (`libs/core/ng-package.json:6-16`). So `yarn nx g @ethlete/core:<name>` works from a consumer workspace.
- **Existing generators**: `@ethlete/core:migrate-to-v5` (`libs/core/generators/migrate-to-v5/`, ~7k LOC
  incl. specs: `viewport-service.ts` 2,167, `router-state-service.ts` 1,403, `color-naming.ts` 205,
  **`create-provider.ts` 184 - already rewrites `createProvider` import/usage patterns**),
  `@ethlete/core:tailwind-4-{color,surface}-theme`, `@ethlete/components:icons`,
  `@ethlete/query:{prep-for-query-v3,migrate-to-query-v3}` (~5k LOC).
- **Two implementation styles to choose from**: raw `typescript` AST + `Tree` (core's
  `create-provider.ts:1-2`) or `ts-morph` (a `peerDependency` of core, `libs/core/package.json:19`).
  `@nx/devkit` is an optional peer (`libs/components/package.json:21-25`).
- **The "AI-assisted" precedent is `migrate-to-query-v3`**: it rewrites what it can and writes
  **`query-v3-migration-tasks.md`** - a task list with stable ids for everything it could not finish
  (`apps/docs/query/migrating-from-v2.md:12-16`), plus `--projects` / `--include` scoping
  (`migration-scope.ts`) and a `module-graph.ts` for ordering. That is the model to copy for a
  core provider-shape migration.
- **No `ng-update` / Angular `migrations.json` anywhere** - the repo intentionally uses Nx generators, not
  Angular schematics (`@angular-devkit/schematics` is only a root devDependency, `package.json:46`).

**Options for the core-breaking part of §1.1**, in increasing consumer cost:

1. **Additive, zero migration (recommended first step).** Add the new `defineProvider`/`defineLabels`
   descriptor helpers next to the existing tuple factories, port all _internal_ call sites in
   `core`/`components`/`query` to them, and leave `createProvider` & co. exported and unchanged (marked
   `@deprecated`). Consumers who wrote their own `createLabels` call keep working, just not tree-shakeable;
   they migrate when they want the bytes. **Non-breaking; captures ~all of the internal win.**
2. **Deprecate + generator.** As above, plus a `@ethlete/core:migrate-provider-shape` generator that
   rewrites `export const [provideX, injectX, X_TOKEN] = createY(...)` into the descriptor + wrapper form
   (a purely local, high-confidence AST transform - much simpler than `create-provider.ts` already is),
   and emits a `provider-shape-migration-tasks.md` for the cases it cannot type (exported tokens).
3. **Remove the tuple factories** in the next core major, generator required (option 2's generator plus a
   codemod for token exports). Only worth it if the deprecated path proves confusing.

---

## 6. Ranked shortlist (highest leverage first)

1. **Kill the destructured-tuple provider idiom** (`libs/core/src/lib/utils/angular/di.ts:69,77,89,102`,
   `libs/core/src/lib/providers/labels.ts:53` + ~70 call sites). This is _the_ import-floor fix: it is what
   makes ~60 statements in components, ~40 in core and the query templates droppable at all. Do it
   additively (§5 option 1) so core stays non-breaking. Expected: most of the 39 kB the floor gained since
   the table plan (89 → 50 kB was the historical floor).
2. **Notification manager** (`libs/components/src/lib/notification/notification-manager.ts:43` → `:90`) -
   biggest single feature (1,532 LOC + 336 css) pinned by one impure statement. Falls out of #1.
3. **Overlay manager + 7 strategies + container**
   (`overlay/overlay-manager.ts:41`, `overlay/strategies/*.strategy.ts` 8 statements,
   `overlay-container.component.css` 610 LOC, `fullscreen-animation.ts` 738 LOC) - ~3.5k LOC + 610 CSS lines
   off every non-overlay consumer. Falls out of #1.
4. **Query creator templates** (`libs/query/src/lib/http/query-creator-templates.ts:33-60`,
   `gql/gql-query-creator-templates.ts:39-60`) - 18 single-binding calls, so a **plain `/*#__PURE__*/`
   campaign works here today** with no shape change; drops the whole secure/secure-gql chain for apps that
   don't use it. Cheapest real win in the repo.
5. **`memoizeSignal` + `createPropertyBinding` annotations in core**
   (`signals/media-queries.ts` 17, `signals/router.ts` 7, `signals/document-visibility.ts` 1,
   `seo/{link,meta}-binding.ts` 5) - 30 single-binding calls, NON-BREAKING annotation only; unbundles
   `@angular/cdk/layout`, `@angular/router` and the 302/555-LOC SEO modules from small utility imports.
6. **query: persistence + sync become opt-in features**
   (`libs/query/src/lib/http/query-client.ts:6,8,11,13,14`) - 1,211 LOC shipped to every consumer;
   the only default-behaviour change on the list, so it needs a docs + changeset story.
7. **query: cut the current-gen → legacy-barrel value imports**
   (`http/query-repository.ts:5`, `http/http-request.ts:4`, `auth/bearer-auth-provider.ts:29`,
   `auth/bearer-auth-query-builders.ts:6`) and the `http ↔ gql` barrel cycle (`gql/gql-query.ts:1`,
   `http/base-query-factory.ts:8`). Pure INTERNAL moves; removes a 7,154-LOC tree and 42 modules from
   every query app's graph.
8. **RTE heading menu behind the existing tool seam**
   (`forms/rich-text-editor/rich-text-editor.component.ts:77` → `MENU_IMPORTS`) - 2,237 LOC + 473 css off
   RTE consumers, reusing the `RICH_TEXT_EDITOR_TOOL` pattern that already exists in the same file.
9. **stream config's default components** (`stream/stream-config.ts:104-106` +
   `stream/pip-chrome-manager.ts:17`) - 3 components + 4 managers currently in the floor; needs the
   lazy-default treatment alongside #1.
10. **form-field stylesheet split** (`forms/form-field/form-field.component.css`, 757 LOC) - the
    CLAUDE.md-nominated candidate; split per _shell feature_ (support/hint/error, text-field shell,
    prefix/suffix, busy) into styles-only components mounted from the directives that enable them.
    Adjacent, smaller: bracket list-only layout split (~4 kB for list-only consumers,
    `plans/bracket-tree-shaking.md`), bracket default cards as an opt-in value
    (`bracket/bracket-components.ts:43-55`, 429 LOC + the `match` domain).
