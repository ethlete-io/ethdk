# Bundle-size & stylesheet-architecture programme — dispatch plan

Branch `next`. Scope: triage items 1, 4, 6, 7 from `plans/components-lib-scan-triage.md`
(§ "Improvements worth scheduling"); audit bodies in `plans/components-lib-scan.md` (grep it,
never open whole). Every shell: `export NX_NO_CLOUD=true`.

---

## 0. The entry-point finding (read this before dispatching anything)

**`@ethlete/components` has exactly ONE entry point.** Evidence:

- `libs/components/ng-package.json` is the only `ng-package.json` under `libs/components`
  (verified with `find`), and declares a single `lib.entryFile: "src/index.ts"`.
- The built package is a single FESM: `dist/libs/components/fesm2022/ethlete-components.mjs`.
- AGENTS.md ("query-devtools: why three entry points"): ng-packagr flattens each entry point into
  one FESM and **rewrites a same-entry-point `@defer` dynamic import into
  `Promise.resolve().then(...)`** — only a _cross-entry-point_ defer emits a real `import(...)`.
- The audit itself already concedes this for a sibling case: scan line 1545 ("ng-packagr
  flattening means a same-entry-point `@defer` cannot split it").

Consumer-side `@defer` does not rescue it either: the whole lib is one module to the app bundler,
so a deferred component whose import chain is `@ethlete/components` lands in the same shared chunk.

### Verdicts on item 7's proposals

| Proposal                                             | Verdict                                                                                                                                                                                                                                                                      |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@defer` the color picker panel (scan :6793)         | **DEAD as stated.** Same entry point → no split. The only bundle-level fix is a secondary entry point (see design decision D4). An `@if`-gated lazy _instantiation_ saves runtime/injection cost only — do not claim bytes for it. Not scheduled.                            |
| `@defer` the scheduler edit surface (scan :3040)     | **DEAD as a defer.** Real bytes are reachable via an _import-graph opt-in_ (RTE-tools-style registration seam: read-only apps never import the edit surface). That is **breaking** for the zero-config path → escalated as design decision D2, not dispatched until decided. |
| Stream PiP opt-in **by import graph** (scan :2298)   | **Viable without entry points** — it is a registration seam, not a defer: remove the static imports in `stream-config.ts` / `stream-player-slot.ts`, register the chrome via a provider PiP users add. Breaking → design decision D3 + measurement gate.                     |
| Pack `PHONE_COUNTRIES`                               | **Do not schedule.** `tools/treeshake/README.md` § "Settled — do not re-open" lists `PHONE_COUNTRIES` as measured-and-rejected (gzip already collapses 220 similar literals).                                                                                                |
| Name the six `SELECT_IMPORTS` the phone input uses   | **Viable, non-breaking, mechanical** → W15. (Distinct from the rejected `FORM_FIELD_IMPORTS` barrel split: this changes one internal call site, no public barrel.)                                                                                                           |
| Gate floating-ui `size`/`arrow`/`hide` middleware    | **MEASURED / REJECTED** → W17. A runtime predicate does not remove the static extras registrar or its floating-ui imports from the generic anchored strategy's bundle; `MENU_IMPORTS` also opts into `autoResize` and arrows already.                                        |
| RTE opt-in tool icons onto providers                 | **Viable, mechanical, precedented** (scan :1539 — the image/table/align/heading tools already do it) → W16.                                                                                                                                                                  |
| Goldens for date-time, table imports, stream barrels | Table goldens **already exist** (`table`, `table-row-expansion`, `table-group-headers`, `table-skeleton`, `table-sticky-columns` in `tools/treeshake/goldens.json`). Date-time and stream goldens are missing → W0.                                                          |

---

## 0b. A styles-only split COSTS bytes (measured 2026-08-28, user accepted the trade)

Every item below that promises "Bytes: ~0 by design" for a styles-only split is **wrong**. A new
`@Component` costs **~40–150 B gz** in per-component metadata (`ɵfac`, `ɵcmp`, selector,
encapsulation scaffolding), and that tax is larger than the duplicated CSS it removes (~30–40 B gz,
because gzip already collapses near-identical CSS).

Measured evidence:

- W2 landed at **+683 B gz** on the `table` golden. Merging its two new components into one
  recovered only **41–54 B**. Residual vs pre-W2: `table` **+642**, `table-group-headers` **+621**,
  `table-sticky-columns` **+661**, `table-skeleton` **+467**, `table-row-expansion` **+301**.
- Adding a _third_ component purely to de-duplicate the shared `.et-table-row--box` rule made the
  golden **+37 B worse** — the clean proof that the cost is the component, not the CSS.
- W4 and W6 show the same shape: `date-input` **+141**, `date-time-input` **+145**,
  `query-devtools-panel` **+155**, `menu-anchored-deps` **+137**, all offset in the same
  re-baseline by `rich-text-editor-full-tools` **−310**, a genuine dedupe win.

**The rule.** A styles-only split buys **style injection and style recalculation**, never transfer
bytes — unless the slice sits behind a separate imports barrel (W13's `OVERLAY_CONTENT_IMPORTS` is
the one shape in this plan that does). Item-6 dedupes that add no component (W9, W12) and item-7
import-graph work (W15, W16, W11) is unaffected.

**Decision (user, 2026-08-28): accept the trade.** W2 stays. W5, W7 and W18 ship as specced. Each
commit body must state that the payoff is injection/recalc and name the measured golden delta —
never claim a byte win. Update the golden when it moves; do not rescope to chase zero.

---

## 1. How `tools/treeshake` goldens work (recipe for every agent)

Read `tools/treeshake/README.md` in full before touching bytes. The essentials:

- **What is measured:** each entry in `tools/treeshake/goldens.json` is a snippet of consumer code.
  The harness links the published FESMs (`dist/libs/*/fesm2022/*.mjs`) with Angular's linker +
  optimizer passes (exactly what an app build does), writes a `sideEffects: false` shim, bundles
  with esbuild (`minify`, `treeShaking`, prod defines), gzips at level 9, and compares against the
  checked-in `gzip` byte count. Default mode is `--external` (only `@ethlete` code counts);
  `"thirdParty": true` entries also bundle non-framework deps (that is the ONLY mode in which
  floating-ui / date-fns retention is visible).
- **Run the guard:** `NX_NO_CLOUD=true npx nx run treeshake:bundle-goldens` (builds `core`,
  `query`, `components`, `query-devtools`, `contentful` first — self-contained). Tolerance: 2 % or
  512 B, whichever is larger.
- **Add a new golden:** add an entry to `tools/treeshake/goldens.json` with `"gzip": 0`
  (an unknown export is a hard esbuild error, so typos fail loudly), then run
  `NX_NO_CLOUD=true npx nx run treeshake:bundle-goldens:update` — a `0` entry is _recorded_, not
  failed — and commit the rewritten `goldens.json` as a deliberate change.
- **Accept a legitimate change:** re-run `:update`, commit the diff, and state in the commit/PR why
  the number moved. Never `--update` to silence an unexplained regression.
- **Ad-hoc before/after:** `node tools/treeshake/measure-bundle.mjs --external --entries
<scratchpad>/entries.json --json`; attribute bytes with `decompose.mjs`; prove a symbol is gone
  with `dump-bundle.mjs` + `grep -c`. Always rebuild with
  `npx nx build core query components --skip-nx-cache` first (Nx has served stale dist three times).
- **Hard-won calibration (do not relitigate):** the ~90 kB gz import floor from tuple-destructured
  providers is real and `@__PURE__` does NOT fix it; a registration seam costs 10–30 % of the slice
  it frees (+844 B for the RTE DOM-feature split); **gzip already dedupes near-identical CSS**, so
  raw duplicated lines are a poor byte proxy (the slider dedupe and the table sticky-CSS
  styles-component were both measured and rejected — sticky: 955 B worse for pinning tables vs
  113 B saved for the rest). Consequence for this whole programme: **CSS moves are justified by
  drift-elimination and injection/recalc cost, never by gz transfer, unless the slice is gated by a
  separate imports barrel** (then bytes are real and must be measured).

**goldens.json is a serialization point.** `:update` rewrites the whole file. Any two work items
that commit `goldens.json` must not run concurrently; the coordinator dispatches those commits one
at a time (each agent re-runs `:update` on a fresh rebase before committing).

---

## 2. Shared verification recipe (referenced by every item)

Per item, in order, before the commit:

1. `npx prettier --write <changed files>`
2. `npx eslint <changed dirs> --fix`
3. `npx nx lint components` — **never** `nx lint components --fix`
4. `npx vitest run --config vitest.projects.ts --project components`
5. `NX_NO_CLOUD=true npx nx run treeshake:bundle-goldens` (+ `:update` and commit `goldens.json`
   only when the item legitimately moves a number — serialize, see above)
6. **Storybook proof** (the `verify-in-storybook` skill, `.agents/skills/verify-in-storybook/`):
   - `curl -s -o /dev/null -w "%{http_code}" http://localhost:4400/` → if not 200, start
     `npm run storybook` in the background and poll.
   - Enumerate exact story ids from `http://localhost:4400/index.json` (ids derive from title +
     export, e.g. `Components/Forms/Slider` + `Marks` → `components-forms-slider--marks`).
   - Drive `http://localhost:4400/iframe.html?id=<id>&viewMode=story` with Playwright (repo
     `node_modules`, CommonJS import shape, `domcontentloaded`, never `networkidle`).
   - **CSS-parity method for pure style moves:** BEFORE editing, run a snapshot script that
     records `getComputedStyle` of the item's key selectors across its stories into a scratchpad
     JSON; apply the change; wait for rebuild; re-run; diff must be empty (animation timing values
     included). Also run once with `page.emulateMedia({ reducedMotion: 'reduce' })` — every moved
     block carries its own reduced-motion override and this is where a lost tie shows up.
   - **Injection proof for on-demand mounts:** in a story _without_ the feature, assert the moved
     rules are absent from `document.styleSheets`
     (`[...document.styleSheets].flatMap(s => [...s.cssRules]).some(r => r.cssText.includes('<marker selector>'))`
     → false); in a story _with_ it → true, and exactly once (style-manager de-dupe).

Because agents run in parallel against one working tree, a broken intermediate state from another
agent can break the shared Storybook dev server. **Run each implementation agent in an isolated git
worktree with its own Storybook port** (`npx nx run storybook:storybook --port <free>` — the Nx
project is named `storybook`; `playground:*` targets exit 0 doing nothing), or have the coordinator
hand out the :4400 verification slot serially.

Repo rules that bind every item: comment policy (AGENTS.md — near-zero comments), `@layer
components { … }` wrap on every component CSS file, `:where()` for config modifiers / bare
interaction states, tokens only (theming skill) — no hardcoded colors, styles-only components per
AGENTS.md "Splitting a large stylesheet". Changeset per published-package change
(`.agents/skills/changeset/` — one sentence, ≤ 40 words, write the file directly). Docs guide update
in the same commit for any public API/behavior change (`.agents/skills/docs/`). One work item = one
commit, path-limited: `git commit -m "..." -- <paths>`.

---

## 3. Work items

Legend: **Bytes** = expected gz effect and how measured. **Order** = prerequisites.
All changesets are `@ethlete/components: patch` unless stated. "Must NOT touch" includes, for every
item, `goldens.json` unless the item explicitly says it updates it (then serialized).

### W0 — Golden expansion (land FIRST)

- **Edits:** `tools/treeshake/goldens.json` only.
- **Adds entries** (all `"gzip": 0`, then `:update`):
  - `date-input`, `date-time-input`, `duration-input` (scan :1880 names the imports:
    `DATE_INPUT_IMPORTS`, `DATE_TIME_INPUT_IMPORTS`, duration equivalent — verify export names
    against `libs/components/src/index.ts`).
  - `phone-input` (baseline for W15).
  - `stream-youtube-slot` (the one-YouTube-slot entry that should shed PiP in W11) and
    `stream-all` (`STREAM_ALL_IMPORTS` — scan :2298 #4 asks whether it pins all eight platforms).
  - `menu-anchored-deps` with `"thirdParty": true` (e.g. `MENU_IMPORTS`) — guards the menu's
    floating-ui dependency surface. W17 later proved it cannot represent a plain anchored consumer.
  - `scrollable` (`SCROLLABLE_IMPORTS` base entry, baseline for W3).
- **Must NOT touch:** anything under `libs/`.
- **Bytes:** none — this is the measurement baseline. No changeset (tools-only).
- **Verify:** `npx nx run treeshake:bundle-goldens` green twice in a row (determinism).

### W1 — `FormSupportStylesComponent` + one support-region partial (triage item 1)

- **Creates:** `libs/components/src/lib/forms/form-field/form-support-styles.component.{ts,css}`
  (styles-only; carries the six `@property` registrations, the
  `-support`/`-support-stack`/`-support-content`/`-errors`/`-warnings`/`-hint` rules,
  `[data-can-animate]` transitions, reduced-motion override, on a `--et-form-support-*` /
  generic `.et-form-support-*` class layer), and one shared support-region template partial
  (component or `ng-template` partial under `forms/form-field/partials/`) that binds the
  `errorId`/`warningId`/`hintId` the headless `injectFormSupport` already returns.
- **Mounts:** from `formSupportFactory`
  (`forms/form-field/headless/form-support.ts:31`) via `injectStyleManager().mount(...)` — every
  affected control already calls it, and the style manager de-dupes per type.
- **Edits (delete the local copies, adopt the shared classes/partial):**
  `selection-list/checkbox-group/checkbox-group.component.{css,html}` (`:2-38,131-207`),
  `selection-list/radio-group/radio-group.component.{css,html}` (`:2-38,123-199`),
  `selection-list/segmented-button-group/segmented-button-group.component.{css,html}`
  (`:155-231`), `rating/rating.component.{css,html}` (`:14-49,180-252`),
  `choice-field/choice-field.component.{css,html}` (`:8-42,154-231`),
  `forms/slider/slider.component.css` + `range-slider.component.css` (the duplicated ~80-line
  support section and the shared `@property` block), `forms/dropzone/dropzone.component.css`,
  `forms/otp-input/otp-input.component.css` (`:166-260`), and
  `forms/form-field/form-field.component.{css,html,ts}`.
- **Second stage, same commit or a follow-up commit in the same item:** fold
  `form-field.component.ts`'s private copy of the presentation state machine into
  `injectFormSupport` (triage Fix-now #4 "Still open" names this as the real DX ask).
- **Explicitly NOT in scope (design decision D1):** making the severity-_direction_ half live for
  the eight group controls (enter/leave animation CSS per component). The shared component must
  reproduce **current rendered behavior per control exactly** — where a control today has no exit
  animation, it still has none after this change.
- **Must NOT touch:** `forms/phone-input/**`, `forms/date-time/**`, anything outside the files
  above; no goldens update expected.
- **Bytes:** ~0 gz (gzip already deduped the copies — that is the settled fact). The wins are
  drift-elimination (this duplication produced two shipped bugs) and injection: one `<style>`
  instead of ~9 near-copies in every document. Guard: `form-field-input` and `select` goldens stay
  within tolerance.
- **Verify:** shared recipe + CSS-parity snapshots across:
  `components-forms-selection-list-checkbox-group--*`, `…-radio-group--*`,
  `…-segmented-button-group--*`, `components-forms-rating--default`,
  `components-forms-slider--default` / `--marks`, `components-forms-range-slider--default`,
  `components-forms-dropzone--default` / `--failing-uploads`,
  `components-forms-otp-input--default`, `components-forms-input--*` (form-field itself), and the
  `components-forms-control-states--*` stories. Drive an error state (touch + submit or the
  story's control) and assert: support text renders, `aria-describedby` resolves
  (`document.getElementById(...)` non-null — the shipped fix must not regress), transition runs
  under normal motion, doesn't under reduced motion. Existing specs
  `form-field/support-region-ids.spec.ts` must stay green.
- **Docs:** `apps/docs/components/forms.md` theming/token table if `--et-form-support-*` tokens
  become public. Changeset: patch.
- **Order:** after W0; **before W18 (dropzone)** and before any future slider/otp sheet work — it
  moves that CSS.

### W2 — Table sheet: card-rows + row-link slices on demand (item 4, sticky EXCLUDED)

- **Sticky columns is settled-rejected** (`tools/treeshake/README.md` § "What a split costs":
  measured 955 B worse). Despite the scan calling it "the cleanest win", do NOT do it. This item is
  the AGENTS.md-blessed "mount on demand from an effect" variant only (injection/recalc, not bytes).
- **Edits:** `libs/components/src/lib/table/table.component.css` (remove card rows `:717-898`,
  row links/row box `:624-716`), `table.component.ts` (two `effect`-guarded
  `injectStyleManager().mount(...)` calls keyed on `appearance() === 'cards'` / `rowLink` presence,
  exactly like the detail-row animation precedent), two new styles-only components in
  `libs/components/src/lib/table/`.
- **Must NOT touch:** `table-sticky-columns.*`, `table.imports.ts`, goldens.
- **Bytes:** ~0 by design; all six `table*` goldens must stay within tolerance (the styles
  components are statically referenced by `table.component.ts`, so nothing shakes out — that is
  expected and fine).
- **Verify:** CSS parity on `components-data-display-table--default`, `--appearance` (cards),
  `--density`; injection proof: default story has no `.et-table` card-row rules in
  `document.styleSheets`, appearance story has them once. Watch cascade: card rules override base
  row rules — after the move they inject _later_; assert base-table computed styles unchanged in
  the default story.
- **Docs:** none (internal). Changeset: patch. **Order:** independent (after W0).

### W3 — Scrollable sheet split (item 4 — the one with real bytes)

- **Edits:** `libs/components/src/lib/scrollable/scrollable.component.css` (472 lines): move the
  buttons/sticky-position rules (`142-160, 224-242, 301-303, 317-345 partial, 388-408`),
  navigation/dots (`350-359, 275-282`), footer (`410-429`) and darken (`373-386`) onto the chrome
  components that already carry `styles:` blocks (`scrollable-buttons.component.ts`,
  `scrollable-navigation.component.ts`, darken directive gets a styles-only component). Move mask
  rules (`125-140, 207-222, 294-308, 431-470`) onto `ScrollableMasksComponent` (already `@if
(renderMasks())`-gated in the template).
- **Why bytes are real here:** navigation/darken are separate barrels
  (`SCROLLABLE_NAVIGATION_IMPORTS`, `SCROLLABLE_DARKEN_IMPORTS` in `scrollable.imports.ts`) — an
  app that never imports them genuinely drops the CSS.
- **Must NOT touch:** `tabs/**` (tab-group consumes scrollable — W8's domain), carousel.
- **Bytes:** measure `scrollable` golden (W0) before/after; expect a real (if small) drop; update
  the golden (serialized). Abort criterion: if the base-entry win is < ~300 B gz AND the moved
  rules would change cascade outcomes, do only the masks move and record the rest in
  `tools/treeshake/README.md` § Settled.
- **Verify:** CSS parity across `components-layout-scrollable--default`, `--with-navigation`,
  `--sticky-buttons`, `--footer-buttons`, `--darken-non-intersecting`, `--border-mask`,
  `--vertical`. Cascade risk is highest here (position rules interact with base track rules) —
  snapshot button/dot/footer geometry (`getBoundingClientRect`) too, not just colors.
- **Docs:** none. Changeset: patch. **Order:** after W0; goldens commit serialized.

### W4 — Floating panels: shared animation base + tooltip/toggletip dedupe + menu search split (items 6 + 4)

One item because all three sheets (`tooltip.component.css`, `toggletip.component.css`,
`menu.component.css`) would otherwise be touched by two parallel items.

- **Edits:** create a shared floating-panel animation/base stylesheet (styles-only component or a
  shared `.et-floating-panel` class layer) covering the enter/leave × four placements blocks +
  reduced-motion (scan :3530 — tooltip 183 and toggletip 205 lines differ only in prefix and two
  timing values; `menu.component.css:344-410` is a third copy; per-component timing stays as local
  token overrides). Then split `menu.component.css` (411 lines): search header (`173-229` +
  `--et-menu-search-height`) mounted from `MenuSearchDirective` via `injectStyleManager()`;
  scroll-fade block (`86-118, 251-271`) mounted from whatever owns the scroll state.
- **Scope guard:** `MenuSearchDirective` is inside `MENU_IMPORTS` (`menu/menu.imports.ts`), so the
  search split is **injection-only** as scoped. Removing it from the barrel would be breaking →
  design decision D5, not done here.
- **Must NOT touch:** `forms/select/**`, `forms/cascader/**` (W5 adopts the shared base later),
  overlay container (W13).
- **Bytes:** ~0; `overlay-dialog` and `select` goldens within tolerance.
- **Verify:** CSS parity + animation assertions on `components-feedback-tooltip--default/right/
bottom`, `components-feedback-toggletip--default/right/bottom`,
  `components-overlays-menu--default`, `components-overlays-menu-with-search--*` (enumerate exact
  ids from index.json). For animations: open/close each, read `getComputedStyle().animationName /
transitionDuration` mid-flight, and re-check under reduced motion. Injection proof for the menu
  search styles in `--default` (absent) vs the search story (present).
- **Docs:** none. Changeset: patch. **Order:** after W0; **before W5**.

### W5 — Select/cascader panels (items 4 + 6)

- **Edits:** `forms/select/.../select-panel.component.css` — move the async/action slice
  (`:119-264`: busy bar + `et-select-busy-sweep`, state rows, load-more, add-new) into a
  styles-only component mounted from `SelectDirective` the first time
  `loading()/error()/hasMoreItems()/allowAddNew()/asyncOptions()` turns on.
  `forms/cascader/.../cascader-panel.component.css` — move sheet chrome (`:108-215` + `[data-sheet]`
  `:368-446`) into the **already-existing** `CascaderSheetStylesComponent` (mounted on demand below
  `md`), and the breadcrumb block (`:217-294`) into a new `CascaderBreadcrumbStylesComponent`
  mounted where the template already gates the row. Both panels adopt W4's shared enter/leave
  animation base (their two blocks, `select-panel:14-65` / `cascader-panel:22-75`, are the same
  structure).
- **Must NOT touch:** tooltip/toggletip/menu (W4), phone-input (W15 — it consumes select but no
  shared files change there).
- **Bytes:** the animation dedupe is ~0; the two styles-component mounts each cost ~40–150 B gz
  (§0b). Expect the `select` golden to MOVE upward — measure it, re-baseline it under the lock, and
  state the delta in the commit. The payoff is injection/recalc, not bytes.
- **Verify:** CSS parity on `components-forms-select--default/--searchable/--multiple` and
  `components-forms-cascader--default/--async-levels/--multiple`; drive an async select story
  through loading→loaded and assert busy-bar styles arrive _before_ first paint of the busy bar
  (FOUC check: assert the busy element's computed background on the very frame it appears — mount
  from the same reactive read that renders it, not a later effect). For the sheet: emulate a narrow
  viewport (`page.setViewportSize`) and check Back bar / title slide styles. Breadcrumb: drive a
  deep drill past `maxVisibleColumns`.
- **Docs:** none. Changeset: patch. **Order:** after W4.

### W6 — Calendar slices (item 4)

- **Edits:** `calendar/calendar.component.css` (508 lines): coarse-grid rules
  (`196-212, 419-438`) → styles-only component mounted from an `effect` when drilling is possible
  (mount when the calendar _can_ leave `selectionView()`, not when it first does — avoids a flash
  of unstyled coarse grid on first drill-out); comparison-band (`304-337`) and week-numbers
  (`154-173, 251-263`) → styles-only components mounted when `comparisonStart` / `weekNumbers` are
  set.
- **Must NOT touch:** scheduler (W7), date-time inputs (W9), time-picker.
- **Bytes:** ~0 (all input-driven, statically referenced); goldens within tolerance (date goldens
  from W0 become the guard).
- **Verify:** CSS parity on `components-date-time-calendar--default/--comparison-range/
--week-range/--two-months`; interaction: click the header to drill out on `--default` and assert
  coarse cells are styled on the first rendered frame; injection proof in `--default` (no
  comparison/week rules) vs the feature stories.
- **Docs:** none. Changeset: patch. **Order:** independent (after W0).

### W7 — Scheduler drag rules (item 4; edit-surface part GATED on D2)

- **Edits (mechanical now):** `scheduler/scheduler-time-grid-view.component.css` (270 lines): the
  `[data-draggable]`/`[data-dragging]` + resize-handle blocks (`:114-132, :236-269`) → styles-only
  component mounted by `SchedulerAppointmentDragDirective` (the `ButtonPropertiesStylesComponent`
  shape). Optionally the all-day lane rules (`:91-132`) behind `allDayRowCount() !== 0` (effect
  mount, injection-only).
- **NOT dispatched:** the edit-surface import-graph opt-in (design decision D2). If approved it
  becomes its own item: registration seam + `SCHEDULER_EDIT_IMPORTS`, dev error on selecting with
  no surface registered, **breaking**, `scheduler.md` update, ea-frontend grep
  (`et-scheduler|SCHEDULER_IMPORTS|SchedulerEditSurface|openEditSurface`).
- **Bytes:** drag CSS is a real (small) win only if the drag directive is imported separately —
  check `scheduler.imports.ts`; if it is inside the base barrel, it is injection-only and the new
  component costs ~40–150 B gz (§0b). State which, with the measured delta, in the commit.
- **Verify:** CSS parity + a real drag on `components-date-time-scheduler--week`; the
  `--without-appointment-drag` story proves the injection split (rules absent).
- **Docs:** none for the CSS move. Changeset: patch. **Order:** independent (after W0).

### W8 — Tabs: shared underline styles (item 6)

- **Edits:** `tabs/tabs/tab-group.component.ts` (styles `:110-348`),
  `tabs/nav-tabs/nav-tabs.component.ts` (`:53-135`) + `nav-tab-link-styles.component.css` → one
  shared styles-only component (`TabScaleStylesComponent` at `tabs/tab-scale-styles.component.ts`
  is the in-domain precedent): underline geometry, `[data-variant='primary']` offsets, divider
  `::after`, hover/focus/active tints, parameterized by the class prefix or a shared class both
  hosts add.
- **Must NOT touch:** `scrollable/**` (W3).
- **Bytes:** ~0 (gzip dedupe). Drift win.
- **Verify:** CSS parity on `components-navigation-tabs-tabs--default/--vertical` and
  `components-navigation-tabs-nav-tabs--default/--vertical`; hover a trigger via Playwright
  `hover()` and compare tint values before/after.
- **Docs:** none. Changeset: patch. **Order:** independent.

### W9 — One range-shell stylesheet for the date/time range inputs (item 6)

- **LANDED** as `d64f32a9b` + `c5566e77f`. The plan said four files; only **three** carry the
  shell (`date-range-input`, `time-range-input`, `date-time-range-input` — the tree was grepped for
  the shell's signature properties). Thresholds are `13em` / `11em` / **`22em`**, not just the two
  the plan named. Each `@container` block stayed per-file: a container-query condition cannot read a
  custom property. `range-input-shell.css` must be listed **before** the control's own sheet in
  `styleUrls` — the shell's `flex` shorthand ties on specificity with the `@container` override, so
  source order decides, and reversing it un-stacks the narrow layout silently. jsdom has no
  container queries, so no spec can guard that; it is recorded as a comment in the shell.
- **Must NOT touch:** the picker-input directives (recent Fix-now #1 work), calendar (W6).
- **Bytes:** ~0; `date-input`/`date-time-input` goldens (W0) within tolerance.
- **Verify:** CSS parity on `components-forms-date-range-input--*`,
  `components-forms-time-range-input--*`, `components-forms-date-time-range-input--*` at a wide
  viewport AND below each stacking threshold (set viewport to force the stacked layout; assert the
  two thresholds still differ per control).
- **Docs:** none. Changeset: patch. **Order:** independent.

### W10 — Stream CSS dedupe (item 6)

- **Edits:** delete the duplicated `et-pip-player` block from `stream/pip/pip-chrome.component.css:91-105`
  (single home: `pip/pip-player.component.css:2-17`) — but confirm the chrome can render a
  pip-player _before_ the player component's styles inject (if the chrome can appear first, the
  rules must live in a shared styles-only component both mount instead). Collapse the three
  ~110-line overlay-card sheets (`consent/stream-consent.component.ts:39-152`,
  `error/stream-player-error.component.ts:35-149`, `pip/pip-slot-placeholder.component.ts:35-119`)
  into one `stream-overlay-card` styles-only component parameterized by tokens.
- **Must NOT touch:** `stream-config.ts`, `stream-player-slot.ts`, `stream.imports.ts` (W11's
  files).
- **Bytes:** ~0. Drift win. `stream-*` goldens (W0) within tolerance.
- **Verify:** CSS parity on `components-media-stream-youtube--*` (consent gate, error state, PiP
  placeholder — enumerate ids); enter/leave PiP and compare the pip-player computed layout.
- **Docs:** none. Changeset: patch. **Order:** after W0; **before W11** (same domain, serialized).

### W11 — Stream PiP opt-in by import graph (item 7) — GATED on D3 + measurement

- **Do not dispatch until D3 is decided.** Then: measurement first —
  `dump-bundle.mjs` on the `stream-youtube-slot` entry, `grep -c PipWindowComponent` /
  `pip-window-position` to prove retention; `measure-bundle.mjs` before/after a prototype seam.
  Abort if the win minus the seam cost (~10–30 %) is not clearly worth a breaking change.
- **Edits (if approved):** `stream/stream-config.ts` (drop the static
  `DEFAULT_PIP_CHROME_CONFIG` import), `stream/stream-player-slot.ts` (stop statically calling
  `injectPipChromeManager()`/`injectPipManager()`), new `provideStreamPip()` registration,
  `stream.imports.ts`, `apps/docs/components/stream.md`.
- **Breaking:** PiP users must add the provider. No Nx migration — fix
  `/Users/tom/dev/ea-frontend` directly; grep it for
  `STREAM_PIP_IMPORTS|injectPipManager|PipChrome|et-pip|provideStream`.
- **Tension to respect:** README's Settled list rejects "stream-manager **barrel splits**" — this
  is a different mechanism (registration seam), but the burden of proof is on the measurement.
- **Bytes:** target ≈ the ~1.5k-line PiP slice out of `stream-youtube-slot`; update that golden +
  add a `stream-with-pip` golden so the opted-in cost is guarded too (both sides, RTE precedent).
- **Verify:** Storybook stream stories still enter/leave PiP with the provider on; a slot without
  it renders and plays with no PiP affordance and no console error; `pip-manager.spec.ts` /
  `stream-player-slot.spec.ts` green. Changeset: **major** (or minor if additive default-off shape
  is chosen in D3).

### W12 — Button/fab/icon-button opacity-ramp recipe (item 6)

- **Edits:** `button/button.component.css`, `button/fab.component.css`,
  `button/icon-button.component.css` — replace the three hand-duplicated per-variant
  hover/focus/active `--et-theme-color-primary-opacity` escalations with one shared token recipe
  (`--et-button-variant-opacity-*` set computed once — a shared styles-only component or a shared
  block in the base button sheet all three already load via `ButtonStylesDirective`).
- **Constraint:** interaction states stay bare (`:hover`, `:focus-visible`, `:active` escalate);
  variant modifiers stay `:where()`-wrapped (AGENTS.md).
- **Bytes:** ~0. Drift win.
- **Verify:** For every variant × {button, fab, icon-button} story
  (`components-actions-button-*--*`): Playwright `hover()` + `focus()` + mousedown, read the
  resolved background `color-mix`/opacity value, diff against pre-change snapshot.
- **Docs:** `button.md` token table only if new public tokens appear. Changeset: patch.
  **Order:** independent.

### W13 — Overlay container chrome + class-list normalizers (items 4 + 6)

- **Edits:** `overlay/overlay-container.component.{html,css,ts}` — arrow rules → the
  `stylesComponent` mechanism the strategies already use (arrow is per-strategy opt-in);
  header/body/footer/main content chrome (`:248-365`, ~120 lines) → styles-only component mounted
  from `OverlayMainDirective` (real bytes: `OVERLAY_CONTENT_IMPORTS` is a separate barrel);
  drag-handle node `@if`-gated on the same signal as `renderArrow`, its five tokens moved to
  `sheet-styles.component.css`. Collapse the three normalizers (`overlay-manager.ts:26-32`,
  `overlay-config-merger.ts:6-12`, `strategies/overlay-strategy-controller.ts:47-51`) into one
  helper.
- **Must NOT touch:** `strategies/anchored.strategy.ts` (the later W17 experiment, now rejected),
  tooltip/menu (W4).
- **Bytes:** small real win on `overlay-dialog` golden for apps not using content chrome — but the
  golden entry _does_ import `OVERLAY_IMPORTS`; measure with an ad-hoc minimal entry
  (`defineOverlay` + dialog strategy only) before/after; update `overlay-dialog` golden if it moves
  (serialized).
- **Verify:** CSS parity on `components-overlays-overlay--default/--right-to-left`, a bottom-sheet
  story (drag handle present + styled), a dialog (no drag-handle node in DOM at all now — assert
  absence), an anchored overlay with arrow on (menu story). Unit: normalizer helper spec.
- **Docs:** `overlays.md` only if any config surface changes (target: none). Changeset: patch.
  **Order:** after W0.

### W14 — Color-input parser collapse (item 6; the defer is dead, see §0)

- **Edits:** the duplicate `parseColor` in color-input (scan :6637: duplicates
  `headless/internals/color-convert.ts:27-138` `parseColorToRgb` almost line for line, minus
  `hsl()`) → delete, use `parseColorToRgb`. Note: this _adds_ hsl handling on the second path —
  confirm against the documented notation behavior and pin with a spec; if the divergence is
  deliberate, keep a thin wrapper that rejects hsl explicitly rather than re-implementing parsing.
- **Must NOT touch:** `color-picker-panel.*` beyond the import swap (no defer work — record in the
  commit body that the @defer proposal is void per the entry-point finding).
- **Bytes:** tiny real win (one parser). No golden move expected.
- **Verify:** `components-forms-color-input--default/--with-alpha/--pinned-notation/--mixed`:
  type hex/rgb(/hsl) values, assert committed value + swatch color; unit specs for the parser
  boundary. RTL pinning from the recent fix must stay (`--et-color-input` picker pinned LTR).
- **Docs:** `forms.md`/color-input section only if accepted notations change. Changeset: patch.
  **Order:** independent.

### W15 — Phone input: name the six select imports (item 7)

- **Edits:** `forms/phone-input/phone-input.component.ts:26` — replace the `...SELECT_IMPORTS`
  spread with the six symbols actually used (`etSelect`, `etSelectTrigger`, `etSelectSurface`,
  `et-select-panel`, `et-select-option`, `etSelectSearch` — verify against the template).
- **Must NOT touch:** `select.imports.ts`, `PHONE_COUNTRIES` (settled — do not re-open).
- **Bytes:** real — the `phone-input` golden (W0) should drop (SelectComponent, virtual options,
  state slots shake out). Prove with `dump-bundle.mjs` + `grep -c SelectVirtualOption`. Update the
  golden (serialized).
- **Verify:** `components-forms-phone-input--default/--prefilled/--mixed`: open the country panel,
  search, pick a country, type a number, assert value + flag; the `select` golden unchanged.
- **Docs:** none. Changeset: patch. **Order:** after W0.

### W16 — RTE: move opt-in tool icons onto their providers (item 7)

- **Edits:** `forms/rich-text-editor/rich-text-editor.component.ts:75-88` — drop `LINK_ICON`,
  `QUOTE_ICON`, `CODE_BLOCK_ICON` from the eager registration; register each from its provider's
  control component (the in-file precedent: `tools/rich-text-editor-image-tool.component.ts:11-13`
  and the table/align/heading tools).
- **Bytes:** real — `rich-text-editor` golden should drop a little;
  `rich-text-editor-full-tools` stays ~flat. Update goldens (serialized).
- **Verify:** `components-forms-rich-text-editor--minimal` (no missing-icon dev errors, toolbar
  renders), `--with-markdown` / full-tools story (link, quote, code-block buttons show their
  icons). Vitest RTE suites green.
- **Docs:** none (behavior identical when the tool is provided). Changeset: patch.
  **Order:** independent.

### W17 — Gate floating-ui `size`/`arrow`/`hide` middleware — MEASURED / REJECTED

- **Decision (2026-09-03): do not ship the runtime gate.** Fresh uncached `core`, `query` and
  `components` builds followed by `measure-bundle.mjs --third-party` measured the attempted
  predicate `options.autoResize || options.autoHide || options.arrow || options.minAvailableSpace`:

  | consumer                                   |   before | attempted gate | delta |
  | ------------------------------------------ | -------: | -------------: | ----: |
  | `MENU_IMPORTS` (`menu-anchored-deps`)      | 47,372 B |       47,393 B | +21 B |
  | `anchoredOverlayStrategy()`                | 13,151 B |       13,166 B | +15 B |
  | `anchoredOverlayStrategy({ arrow: true })` | 13,156 B |       13,171 B | +15 B |

- **Why it cannot pay off:** the generic strategy still statically references
  `enableAnchoredOverlayPositionExtras()`. A runtime branch does not remove that registrar or its
  static `size` / `arrow` / `hide` imports, and esbuild does not specialize this exported function
  per call site. `MENU_IMPORTS` is not a plain-popover baseline anyway: menus set `autoResize: true`
  and root menus render arrows by default, so they genuinely require the extras.
- **Correctness problems in the proposed predicate:** `arrow` is not part of the exported
  `AnchoredPositionOptions`, so adding it solely for the test widens public API. More importantly,
  the predicate omits `autoCloseIfReferenceHidden`, while core's anchored positioner uses the
  optional `hide` middleware for that feature and documents it as requiring the extras. Shipping
  the predicate as written could therefore emit the missing-middleware dev error and lose hidden
  reference handling for a valid consumer.
- **Verification of the discarded experiment:** the focused gate specs passed; Storybook kept the
  edge-constrained menu inside the viewport (`top-start`), positioned tooltip and toggletip arrows,
  and capped a searchable select near the viewport bottom to `167px`. Those checks prove behavior
  for the opted-in examples, not a bundle win, so neither the code nor an arrow golden was retained.
- A real byte split would require a separate import-graph seam or feature-specific strategy API,
  with its own API and correctness design. It is not scheduled here.

### W18 — Dropzone shape split (item 4)

- **Edits:** `forms/dropzone/dropzone.component.css` (507 lines minus what W1 removed): readonly
  block (`:468-506`), multiple-mode list (`:243-291` — belongs on the stamped `et-dropzone-item`
  child, the table-expander-cell precedent), single-file preview band (`:171-241`); move the four
  eager icons (`dropzone.component.ts:54`) onto the child components that render them (retry/remove
  buttons), per the `et-tree-marker` model.
- **Bytes:** each new styles component costs ~40–150 B gz (§0b); the icon moves are a real win.
  Measure the net on the `dropzone` golden and state it. The CSS payoff is injection, not bytes.
- **Verify:** CSS parity on `components-forms-dropzone--default/--multiple/--readonly/
--readonly-single/--existing-media/--failing-uploads`; icon proof: readonly story registers no
  `et-rotate-right`/`et-times`.
- **Docs:** none. Changeset: patch. **Order:** **after W1** (W1 moves the support block first).

---

## 4. Strict ordering & parallel groups

```
W0 (goldens baseline — alone, first)
│
├─ parallel batch 1 (domain-disjoint):
│    W1 (form-field + 8 controls)   W2 (table)      W3 (scrollable)
│    W4 (tooltip/toggletip/menu)    W6 (calendar)   W7 (scheduler CSS)
│    W8 (tabs)                      W9 (date/time range shells)
│    W10 (stream CSS)               W12 (buttons)   W13 (overlay container)
│    W14 (color-input)              W15 (phone)     W16 (RTE icons)
│
├─ parallel batch 2 (each gated on its arrow):
│    W4 → W5 (select/cascader panels)
│    W1 → W18 (dropzone)
│    W13 (overlay strategies; W17 measured/rejected)
│    W10 → [D3 decision + measurement] → W11 (stream PiP seam)
│    [D2 decision] → scheduler edit-surface item (not yet specced for dispatch)
│
└─ serialization lock: goldens.json — only one of {W0, W3, W11, W13, W15, W16}
   may commit it at a time; each re-runs `:update` on a fresh rebase first.
```

Domain-collision resolutions baked in: **slider/otp** CSS only in W1 (their residual opt-in slices
are not scheduled); **menu** only in W4; **select/cascader panel animations** in W5 (after W4
creates the base); **stream** serialized W10→W11; **overlay** ended at W13 after W17 was rejected; **scheduler**
CSS now, edit surface later.

---

## 5. Design decisions escalated to the user (NOT taken by this plan)

- **D1 — Make the severity-direction half of the support state machine live** (enter/leave CSS on
  eight group controls). It fixes a shipped inconsistency (form-field animates transitions the
  groups silently skip) at the cost of choosing an animation design per control and re-verifying
  reduced-motion across eight domains. W1 deliberately preserves today's per-control behavior.
- **D2 — Scheduler edit surface becomes import-graph opt-in.** Real bytes (five form-control
  families out of a read-only month grid) but breaks the documented zero-config path — every
  scheduler consumer that edits must add an import/provider. Defer is not an alternative (§0).
- **D3 — Stream PiP behind `provideStreamPip()`.** ~1.5k lines out of every single-slot consumer,
  but breaking for PiP users and adjacent to a settled rejection ("stream-manager barrel splits");
  it proceeds only if the W11 measurement clearly beats the seam cost.
- **D4 — Secondary entry points for `@ethlete/components`.** The only mechanism that would ever
  make "defer the color picker / edit surface" save bytes (query-devtools precedent), but the
  picker pulls form-field/input from the main entry, so it forces a circular-entry-point
  restructuring of the forms stack. Large, breaking, and it changes every consumer's import paths.
  Recommendation: don't — but it is the honest price tag next to those two dead proposals.
- **D5 — Drop `MenuSearchDirective` (and the spinner/scrollbar statics) from `MENU_IMPORTS`.**
  Turns W4's injection-only menu split into real bytes; breaking for every menu-with-search
  consumer (must import a `MENU_SEARCH_IMPORTS`). ea-frontend grep: `etMenuSearch|MENU_IMPORTS`.
- **Deliberately NOT scheduled** (record, don't relitigate): table sticky-columns CSS split
  (settled, measured worse), slider sheet dedupe (settled — gzip), `PHONE_COUNTRIES` packing
  (settled), notification position-matrix split (six seams for "smaller than the swipe split"),
  notification swipe-directive unbundling (behavior/API change, own initiative if wanted),
  tree multiple-mode checkbox split (~40 lines vs seam cost), color-picker `@defer` (§0).

## 6. Breaking-change inventory

Only D2/D3/D5 (if approved) are breaking; every dispatched W-item is patch-level and
behavior-preserving. No Nx migrations — the only consumer is `/Users/tom/dev/ea-frontend`; fix its
call sites directly. Greps per decision are listed inline above. Name any approved one as
**major** in its changeset even in prerelease.

## 7. Risks

1. **Cascade order flips inside `@layer components`.** All component CSS shares one layer, so
   equal-specificity ties are decided by _injection order_ — and every moved slice changes when it
   injects (styles-only components inject at mount, per-component sheets at first instantiation).
   A feature rule that used to lose a tie to a later base rule in the same file can start winning.
   Mitigations: moved slices may only contain selectors keyed on feature attributes/classes that
   don't tie with base rules; keep base modifiers at `:where()` weight; the CSS-parity snapshot
   (both feature-on and feature-off stories) is the gate, not eyeballing.
2. **`@property` registrations travel with their blocks.** A control whose sheet no longer
   registers `--et-form-support-*` (W1) animates nothing until the shared component mounts;
   mounting from `formSupportFactory` closes that, but any control that renders support without
   calling it would silently lose transitions. Grep for stragglers before deleting a block.
3. **FOUC on on-demand mounts** (W2 cards, W5 busy bar/sheet, W6 coarse grid): mounting from an
   effect that runs _after_ the feature's first render paints one unstyled frame. Mount from the
   same reactive read that renders the feature, or eagerly when the capability is enabled — and
   assert first-frame computed styles in verification.
4. **Reduced-motion overrides orphaned from their animations.** Every moved animation block must
   carry its own `prefers-reduced-motion` override; a shared base + per-component override across
   two style tags reintroduces order-dependence. Verify with `emulateMedia`.
5. **Parallel agents vs one Storybook.** The dev server rebuilds on every working-tree change and
   breaks on deleted files; another agent's intermediate state can invalidate a verification run.
   Use isolated worktrees + own ports, or serialize the :4400 slot.
6. **goldens.json write races** — serialized by §4's lock; a stale `:update` silently re-baselines
   another item's regression, so always rebase + rebuild (`--skip-nx-cache`) before updating.
7. **Style-manager unmount semantics.** Angular unloads component styles with their last instance;
   a mounted styles component's lifetime is the style manager's business — no item may rely on
   unmount, and none should toggle mounts per interaction (mount once, latch).
8. **W14 changes parser behavior** (the duplicate handled no `hsl()`): the collapse is only a
   dedupe if the accepted-notation surface is pinned by a spec first.
