# components-rest — DX scan 2026-10-02

Scope: `libs/components/src/lib/{button,tabs,carousel,scrollable,scrollbar,icon,tree,breadcrumb,pagination,accordion,masonry,picture,query-error,paged-query-trigger,loader,stat-tile,chip,toolbar,kbd,avatar,badge,banner,card,copy-button,description-list,divider,empty-state,focus-ring,progress-steps,skeleton,timeline,testing,internals}`,
`libs/components/src/index.ts` + `ng-package.json` (entry point), and the matching guides in `apps/docs/components/`
(plus `setup.md`, `localization.md`, `error-codes.md`, `index.md`).

Checked and clean: parent-missing dev errors (chip-remove, accordion parts, masonry item, carousel controls,
breadcrumb templates, split-button segments all throw a coded `RuntimeError`); every `*_ERROR_CODES` object is
exported; the guides' input tables match the code for every domain in scope (names and defaults); every e2e
domain in scope has a suite in `apps/storybook-e2e`.

| ID    | Sev    | Kind | Decision | Title                                                                                                |
| ----- | ------ | ---- | -------- | ---------------------------------------------------------------------------------------------------- |
| CR-01 | High   | dx   | yes      | Every tab group persists its selection to sessionStorage by default and overrides `selectedIndex`    |
| CR-02 | High   | dx   | yes      | No public testing entry point: jsdom shims and drivers are lib-internal                              |
| CR-03 | Medium | bug  | no       | `totalPages` of `undefined`/`null` makes pagination write `NaN` into the bound `page`                |
| CR-04 | Medium | dx   | yes      | `<et-carousel>` has no way to bind or observe the active slide                                       |
| CR-05 | Medium | dx   | yes      | Spinner and progress bar invert the determinate flag and differ in `color`                           |
| CR-06 | Medium | dx   | yes      | Tree `value` is `T \| T[] \| null`, so `[(value)]` forces a widened signal type                      |
| CR-07 | Medium | bug  | no       | An initials avatar has no accessible name                                                            |
| CR-08 | Medium | dx   | yes      | `et-kbd` key names are hard-coded English; no `provideKbdLabels`                                     |
| CR-09 | Medium | dx   | yes      | 537 `@internal` members ship as normal public API (no `stripInternal`)                               |
| CR-10 | Low    | dx   | no       | Guides and JSDoc use an `<et-icon>` component that does not exist                                    |
| CR-11 | Low    | dx   | no       | `localization.md` token table misses six `provide*Labels`                                            |
| CR-12 | Low    | dx   | no       | ET3603, ET3702, ET3703 are missing from `error-codes.md`                                             |
| CR-13 | Low    | dx   | yes      | Per-instance label overrides: `labels` input on some components, one-off inputs on others            |
| CR-14 | Low    | dx   | no       | Copy button: a failed copy is silent, and `copied` is a writable public signal                       |
| CR-15 | Low    | dx   | no       | Public input types not exported (`ButtonType`, `FabVariant`, `IconButtonVariant`, pagination `size`) |
| CR-16 | Low    | dx   | no       | `setup.md` semantic-theme list is incomplete; `index.md` does not link Skeleton                      |
| CR-17 | Low    | dx   | yes      | Output names mix verbs, nouns and prefixes across siblings                                           |

## CR-01 Every tab group persists its selection to sessionStorage by default and overrides `selectedIndex`

- Status: fixed: persistence is opt-in (no auto key). Guide updated.
- Review: fixed: dropped `ngOnChanges` + the eslint-disable; with a key set, the stored tab now wins over the initial `selectedIndex` (spec, guide, changeset updated).

- Where: `libs/components/src/lib/tabs/tabs/headless/tab-group.directive.ts:32`, `:96`, `:185-193`;
  `libs/core/src/lib/utils/session-memory.ts:7-31`; guide `apps/docs/components/tabs.md:29`.
- Problem: `sessionMemoryKey` defaults to `null`, and `null` does not turn the feature off. It falls back to
  `createAutoSessionMemoryKey()`, a key built from `location.pathname` plus the element's DOM path. So every
  `<et-tab-group>` writes its index to sessionStorage, and on the next render the restore effect (`:96`) uses
  `stored ?? this.selectedIndex()`: the stored value wins over the bound input.
  `<et-tab-group [(selectedIndex)]="tabFromUrl">` with `?tab=0` after the reader picked tab 2 and reloaded opens
  tab 2 and writes 2 back into the model. The URL state loses. Because the auto key comes from the DOM path, a
  change in sibling count (an `@if` banner above the tabs) changes the key and the memory jumps. You can't opt
  out. The guide says "`sessionMemoryKey` persists the selected tab", which reads as opt-in.
- Fix: make persistence opt-in. Remember only when `sessionMemoryKey` is set, or add an explicit
  `sessionMemory: boolean | string` input whose `false` default stores nothing. An explicitly bound
  `selectedIndex` should beat the stored value on first render, or the guide must say clearly that it does not.
  Add a spec: a bound initial `selectedIndex` plus a stale stored value. Update `tabs.md`.
- Breaking: yes (default behaviour). Decision: yes (opt-in vs opt-out, and which wins).

## CR-02 No public testing entry point: jsdom shims and drivers are lib-internal

- Where: `libs/components/ng-package.json:19` (single entry point); `libs/components/src/test-helpers.ts:1-150`
  (ResizeObserver, IntersectionObserver, matchMedia and `Element.animate` shims);
  `libs/components/src/lib/testing/*`, `tabs/testing/tabs-driver.ts`, `carousel/testing`, `scrollable/testing`,
  `forms/testing/*-driver.ts` (about 30 drivers). None of them are exported from `src/index.ts`.
- Problem: an app's own jsdom spec that renders any component built on `et-scrollable` (tabs, carousel, nav tabs),
  an overlay, or the animation utils fails with raw `ReferenceError: ResizeObserver is not defined` or
  `matchMedia is not a function`. The app has to rediscover and re-write the shims the lib keeps privately. The
  lib already has a full set of drivers (`createTabBarDriver`, select, date-picker, …) that consumers can't
  import. `@ethlete/query` ships `@ethlete/query/testing`, and `docs/query/testing.md` covers it. Components has
  neither the entry point nor a guide.
- Fix: add a secondary entry point `@ethlete/components/testing`. It exports
  `provideComponentsTestingEnvironment()` (or a side-effect `setupComponentsTestEnvironment()`) holding the four
  shims from `test-helpers.ts`, plus the stable drivers (start with control/field/overlay drivers and
  tabs/select/date-picker). Add `apps/docs/components/testing.md`. The entry point must not import the main
  barrel in a way that creates a cycle (see the query-devtools note in AGENTS.md).
- Breaking: no. Decision: yes (new public API surface; which drivers are stable enough to publish).

## CR-03 `totalPages` of `undefined`/`null` makes pagination write `NaN` into the bound `page`

- Status: fixed: `toPageCount` normalizes `totalPages` (non-finite/<=0 → no pages, fractions round up) in the input transform and in `paginate`; `goTo` floors and ignores NaN. Specs failed first.
- Review: ok

- Where: `libs/components/src/lib/pagination/headless/pagination.directive.ts:28`, `:73-79`;
  `libs/components/src/lib/pagination/paginate.ts:24`, `:91`, `:101`.
- Problem: `totalPages = input(1, { transform: numberAttribute })` accepts `unknown`. The usual binding while a
  query loads, `[totalPages]="query.response()?.totalPages"`, passes `undefined` → `NaN`. `paginate` only guards
  `totalPages <= 0` (false for `NaN`). `clamp(1, 1, NaN)` returns `NaN`, `current === totalPages` is never true,
  so next/last render **enabled** with `page: NaN`. Clicking next calls `goTo(NaN + 1)`: `total <= 0` is false,
  and `this.page.set(clamp(NaN, 1, NaN))` writes `NaN` into the consumer's two-way `page` (and on into a query
  form's page field and the request).
- Fix: in `paginate` and `goTo`, treat a non-finite or `< 1` `totalPages` as "no pages":
  `if (!Number.isFinite(totalPages) || totalPages <= 0) return []`. In `goTo`, do the same and `Math.floor` the
  target. Optionally round fractional `totalPages` up. Add `paginate` specs for `NaN`, `0` and `2.5`, and a
  directive spec that `next()` with `undefined` total leaves `page` untouched.
- Breaking: no. Decision: no.

## CR-04 `<et-carousel>` has no way to bind or observe the active slide

- Status: fixed: `activeIndex` is now a two-way `model(0)` on `CarouselDirective`, forwarded by `et-carousel`; setting it scrolls like `goTo()`, out-of-range snaps back. The old derived signal is `@internal currentIndex`. `carousel` member documented, `@internal` dropped. Scenario added.
- Review: fixed: trimmed the `currentIndex` JSDoc and a stale `activeIndex` reference on `activeDomIndex`.

- Where: `libs/components/src/lib/carousel/carousel.component.ts:103` (`/** @internal … handy for a consumer reaching in with viewChild */ public carousel`),
  `libs/components/src/lib/carousel/headless/carousel.directive.ts:296` (`activeIndex` is a read-only `computed`);
  guide `apps/docs/components/carousel.md:324-350` (only the headless form shows reading `activeIndex()`).
- Problem: a consumer who wants "Slide 3 of 7" outside the carousel, deep-linking to a slide, or analytics on slide
  change has no input, model or output on `<et-carousel>`. The only route is `viewChild(CarouselComponent).carousel.activeIndex()`,
  and that member is marked `@internal`. Tabs, the closest sibling, expose `[(selectedIndex)]`.
- Fix: add `activeIndex = model<number>()` (or an `activeIndexChange` output plus `goTo` on the component) to
  `CarouselDirective`, and forward it through the `hostDirectives` inputs/outputs of `et-carousel`. Drop the
  `@internal` on `carousel` or replace it with documented `exportAs`. Document it in the Inputs table.
- Breaking: no. Decision: yes (model vs output, and whether a programmatic set animates).

## CR-05 Spinner and progress bar invert the determinate flag and differ in `color`

- Where: `libs/components/src/lib/loader/spinner/spinner.component.ts:139` (`determinate`, default `false`),
  `:105` (`color` via `ProvideColorDirective`); `libs/components/src/lib/loader/progress-bar/progress-bar.component.ts:46`
  (`indeterminate`, default `false`, no `color`); `libs/components/src/lib/loader/index.ts` (no `LOADER_IMPORTS`).
- Problem: two sibling indicators with the same `value` input need opposite flags for the same state:
  `<et-spinner determinate [value]="40">` vs `<et-progress-bar [value]="40">`, and `<et-spinner>` vs
  `<et-progress-bar indeterminate>`. A consumer switching one for the other gets the wrong mode silently. Only
  the spinner takes `color`. It is the only multi-component domain in scope without an `*_IMPORTS` array.
- Fix: pick one shape for both. Suggested: `mode: 'determinate' | 'indeterminate'`, or "determinate when `value` is
  bound, else indeterminate", the `progress` convention `ButtonDirective` already uses
  (`button/headless/button.directive.ts`). Give the progress bar the same `color` host directive, and add
  `LOADER_IMPORTS`. Update `loader.md`.
- Breaking: yes. Decision: yes (which shape).

## CR-06 Tree `value` is `T | T[] | null`, so `[(value)]` forces a widened signal type

- Where: `libs/components/src/lib/tree/headless/tree.directive.ts:95-98`; the story has to work around it at
  `libs/components/src/lib/tree/stories/tree-storybook.component.ts:144` (`signal<string | string[] | null>`), and
  so does the spec at `tree/tree.component.spec.ts:52`.
- Problem: in single mode a consumer writes `selected = signal<string | null>(null)` and
  `<et-tree [(value)]="selected">`. Under strict templates the model's `string | string[] | null` cannot be
  written into `WritableSignal<string | null>`, so the binding does not compile. The app then has to widen the
  signal and narrow with `Array.isArray` everywhere it reads it. The union also accepts invalid states (an array
  in single mode).
- Fix: either split into `value` (single, `T | null`) and `values` (multiple, `readonly T[]`), with the one in use
  following `selectionMode`, or add a generic mode parameter so the model type follows `selectionMode`. Apply the
  same rule as select/cascader (the `select.md` scope) so the libs agree.
- Breaking: yes. Decision: yes (API shape, shared with select).

## CR-07 An initials avatar has no accessible name

- Status: fixed: rendered initials get `role="img"` + `aria-label` = `name` (also after an image failure); explicit initials without a name and projected content stay unnamed. Specs failed first.
- Review: ok

- Where: `libs/components/src/lib/avatar/avatar.component.ts:48-50` (template), host at `:60-64` (no role, no
  aria); guide `apps/docs/components/avatar.md:68`.
- Problem: `<et-avatar name="Jane Doe" />` without `src` renders `<span class="et-avatar-initials">JD</span>` with
  no role and no label. A screen reader reads "J D", or "JD" as a word, and the name is lost. With `src` the
  `<img alt>` carries the name, so the meaning changes depending on whether the image loaded (`markImageFailed`
  also falls back to initials). The guide implies that `name` names the avatar.
- Fix: when initials render, set `role="img"` and `aria-label="name()"` on the host, or render a visually hidden
  `name()` with the initials `aria-hidden`. Leave the host unnamed when only projected content shows (current
  documented behaviour). Add a spec for each of the three fallbacks.
- Breaking: no. Decision: no.

## CR-08 `et-kbd` key names are hard-coded English; no `provideKbdLabels`

- Status: fixed: `KBD_LABELS` / `provideKbdLabels` / `injectKbdLabels` / `DEFAULT_KBD_LABELS` (per key: `apple`/`other` label + name; `plus` for `+`). `kbdKeyLabel`/`kbdKeyName` take `platform` or `{ platform, labels }`. Guide + localization table updated.
- Review: ok

- Where: `libs/components/src/lib/kbd/kbd-keys.ts:39-48` (labels `Ctrl`/`Del`/`Esc`, spoken names `Command`,
  `Control`, `Option`, …), `libs/components/src/lib/kbd/kbd.component.ts:22` (visually hidden spoken label).
- Problem: this is the only text-bearing component in scope without a labels token (all 35 others have
  `provide*Labels`). A German app shows `Ctrl` and `Del` where German keyboards print `Strg` and `Entf`, and screen
  readers announce "Control Shift K" in English inside German text.
- Fix: add `KBD_LABELS` / `provideKbdLabels` (printed label and spoken name per key and platform), merged over
  the current table, and list it in `localization.md`.
- Breaking: no. Decision: yes (new API; how much of the key table is overridable).

## CR-09 537 `@internal` members ship as normal public API (no `stripInternal`)

- Where: `libs/components/tsconfig.lib.prod.json` (no `stripInternal`); for example
  `carousel/carousel.component.ts:103`, `tabs/tabs/headless/tab-group.directive.ts` (`panels`,
  `managesPanelsInternally`, `registerPanel`), `button/headless/button.directive.ts` (`registerLoadingSource`).
  `grep -rn "@internal" libs/components/src/lib | wc -l` → 537.
- Problem: consumers see every `@internal` member in autocomplete and in the generated `.d.ts`, with nothing to
  set them apart from real API. Some read like API (`TabGroupDirective.restoredSessionMemoryKey`,
  `CarouselComponent.carousel`). Code written against them breaks without notice.
- Fix: decide per member whether it is truly internal. If so, turn on `stripInternal` for the prod build (check
  that no exported template or `exportAs` in a consumer needs a stripped member) or make the member `protected`.
  Members a consumer is meant to reach (CR-04) lose the tag.
- Breaking: yes (removes members from `.d.ts`). Decision: yes.

## CR-10 Guides and JSDoc use an `<et-icon>` component that does not exist

- Status: fixed: avatar JSDoc/guide and accordion JSDoc/guide use `<i etIcon="…">`.
- Review: ok

- Where: `apps/docs/components/avatar.md:13` and `:68`, `libs/components/src/lib/avatar/avatar.component.ts:41`
  (`<et-icon [definition]="USER_ICON" />`); `apps/docs/components/accordion.md:96` and
  `libs/components/src/lib/accordion/headless/accordion-templates.directive.ts:40` (`<et-icon name="warning" />`).
- Problem: the only icon API is the directive `[etIcon]` (`icon/headless/icon.directive.ts:21`), used as
  `<i etIcon="…"></i>`. Copying either example fails to compile with "'et-icon' is not a known element".
- Fix: replace with `<i etIcon="…"></i>` (and `label` for the accessible-name case at `avatar.md:68`).
- Breaking: no. Decision: no.

## CR-11 `localization.md` token table misses six `provide*Labels`

- Status: fixed: the six rows (plus `KBD_LABELS`) added to `localization.md`.
- Review: ok

- Where: `apps/docs/components/localization.md:112-142`. Missing: `BANNER_LABELS` (`banner/banner-labels.ts:24`),
  `MATCH_LABELS` (`match/match-labels.ts:140`), `STANDINGS_LABELS` (`standings/standings-labels.ts:97`),
  `SCHEDULER_LABELS` (`scheduler/scheduler-labels.ts:100`), `COMMAND_PALETTE_LABELS`
  (`command-palette/command-palette-labels.ts:48`), `BRACKET_LABELS` (`bracket/bracket-labels.ts:97`).
- Problem: `setup.md` sends app developers to this table for "the full list". Six domains stay English unless the
  developer finds the provider on their own.
- Fix: add the six rows. Optionally add a docs check that compares `export const provide*Labels` in the lib with the table.
- Breaking: no. Decision: no.

## CR-12 ET3603, ET3702, ET3703 are missing from `error-codes.md`

- Status: left: the rows belong in `error-codes.md`, excluded for this pass; no check added (it would fail on the other domains' missing codes).

- Where: `libs/components/src/lib/accordion/accordion-errors.ts` (`OPEN_ALL_WITH_AUTO_CLOSE_OTHERS: 3603`, thrown at
  `accordion/headless/accordion-group.directive.ts:116`); `libs/components/src/lib/breadcrumb/breadcrumb-errors.ts`
  (`SEO_OUTSIDE_BREADCRUMB: 3702`, `OUTLET_UNSUPPORTED_CONTENT: 3703`); doc tables at
  `apps/docs/components/error-codes.md:364-381`.
- Problem: the page says "search this page for the code you see in the console", and these three codes return
  nothing. The same scan found select ET1006-1008 and ET1010-1013, multi-language RTE ET2600/2601, phone ET2801
  and scheduler ET4504 undocumented too (out of this scope; relay to those domains).
- Fix: add the rows. Better still, add a check (spec or docs lint) that every `*_ERROR_CODES` value appears as
  `ET####` in `apps/docs`.
- Breaking: no. Decision: no.

## CR-13 Per-instance label overrides: `labels` input on some components, one-off inputs on others

- Status: fixed: tree `loadingLabel`/`emptyLabel`/`retryLabel` → `labels: Partial<TreeLabels>`; skeleton `loadingAllyText` → `labels: Partial<LoaderLabels>`; bracket-skeleton keeps its own `loadingAllyText` and forwards it as `labels`. Pagination `ariaLabel` kept (landmark name, not a translation). Rule written into the component-architecture skill.
- Review: ok

- Where: `labels: Partial<…Labels>` input on carousel (`carousel/headless/carousel.directive.ts`), breadcrumb,
  pagination (`pagination/headless/pagination.directive.ts`), query-error. One-off string inputs instead on tree
  (`tree/tree.component.ts:49-55` `loadingLabel`/`emptyLabel`/`retryLabel`), skeleton
  (`skeleton/skeleton.component.ts:39` `loadingAllyText`, a misspelling of "a11y" with no match anywhere else), and
  pagination's `ariaLabel` next to its own `labels`.
- Problem: a developer who learned `[labels]="{ … }"` on pagination tries it on the tree and finds no such input.
  `loadingAllyText` can't be guessed.
- Fix: settle on `labels: Partial<XLabels>` for per-instance overrides everywhere. Rename `loadingAllyText` →
  `labels.loadingContent`, or at least `loadingLabel`. Keep `aria-label` passthrough as the native attribute.
- Breaking: yes. Decision: yes.

## CR-14 Copy button: a failed copy is silent, and `copied` is a writable public signal

- Status: fixed: `copyFail` output, `copyFailed()` signal, `data-copy-failed`, `copyFailed` label in the live region; `copied` is a read-only computed.
- Review: ok

- Where: `libs/components/src/lib/copy-button/copy-button.directive.ts:67`, `:70`, `:114`.
- Problem: when `copyToClipboard` resolves `false` (insecure context, denied permission, SSR), nothing happens:
  no output, no `data-` state, no live-region text. The reader clicks and gets no feedback. `copied` is
  `signal(false)`, so templates can `.set()` it.
- Fix: add `copyError = output<void>()` and a `data-copy-failed` state (and a `copyFailed` label in
  `COPY_BUTTON_LABELS` for the live region). Expose `copied` as `asReadonly()`.
- Breaking: no (readonly change is type-only). Decision: no.

## CR-15 Public input types not exported

- Status: fixed: `ButtonType` exported; fab/icon-button use `ButtonVariant`; `PAGINATION_SIZES`/`PaginationSize` added.
- Review: ok

- Where: `libs/components/src/lib/button/headless/button.directive.ts:22` (`type ButtonType`, while
  `BUTTON_TYPES` is exported); `button/fab.component.ts:17` (`FabVariant`), `button/icon-button.component.ts:9`
  (`IconButtonVariant`). Both are aliases of `ButtonVariant`. `pagination/pagination.component.ts:90` and
  `pagination/page-size-select.component.ts:59` use an inline `'sm' | 'md'` with no `PaginationSize` / `PAGINATION_SIZES`.
- Problem: a wrapper component that forwards `type` or `size` has to write the union by hand. Every other size or
  variant in scope has an exported `X_SIZES` const and `XSize` type.
- Fix: export `ButtonType`. Use `ButtonVariant` directly in fab and icon-button. Add `PAGINATION_SIZES`/`PaginationSize`.
- Breaking: no. Decision: no.

## CR-16 `setup.md` semantic-theme list is incomplete; `index.md` does not link Skeleton

- Status: fixed: setup.md names stat-tile and banner semantic types; index.md links Skeleton.
- Review: ok

- Where: `apps/docs/components/setup.md` ("A color theme with `type: 'error'`" bullet) names form-field, select,
  cascader and progress-steps only. `stat-tile/stat-tile.component.ts:91` reads `success`/`error` for any delta,
  and banner, table, menu and alert-dialog also call `injectSemanticColorTheme`. `apps/docs/components/index.md`
  (Guides list) has no Skeleton entry, though `skeleton.md` exists and is in the sidebar.
- Problem: an app with no `success` theme throws "No color theme with type "success" found" the first time a
  stat tile shows a good delta. Setup does not warn about this.
- Fix: add "`success`/`error` for `et-stat-tile` deltas and `et-banner` types" to the bullet. Add the Skeleton
  link to `index.md`.
- Breaking: no. Decision: no.

## CR-17 Output names mix verbs, nouns and prefixes across siblings

- Status: fixed: output naming rule (`<subject?><verb>`, present tense, no abbreviations, `Request` only beside a same-named method) added to the component-architecture skill; renamed `imgLoad`/`imgError` → `imageLoad`/`imageError`, `copySuccess` → `copySucceed` (new `copyFail`). `retryRequest` conforms (`retry()` is the method). Semantic-kind naming (`type`/`kind`/`state`) left as is.
- Review: ok

- Where: `chip/headless/chip.directive.ts:36` (`remove`), `banner/banner.component.ts:72` (`dismiss`),
  `query-error/headless/query-error.directive.ts:63` (`retryRequest`), `copy-button/copy-button.directive.ts:67`
  (`copySuccess`), `picture/picture.component.ts:125` (`imgLoad`/`imgError`), `tree/headless/tree.directive.ts:121`
  (`nodeActivate`).
- Problem: there is no single rule a consumer can guess output names from: imperative verb vs past event vs
  noun-verb, and `img` abbreviated where everything else is spelled out. Related: semantic kind is `type`
  (banner), `kind` (window-control-button), or `state` (progress-step).
- Fix: write one rule into the `component-architecture` skill (for example, "outputs are `<noun?><PastVerb>` or
  `<verb>Request`") and rename at the next breaking window.
- Breaking: yes. Decision: yes.
