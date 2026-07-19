# Todo cleanup plan

Working plan for the items collected in `todo.md`. Every todo item is mapped to
a work package below; the quick wins are batched so they can ship together.
This file is the tracking artifact: check off work as it lands and update the
status table. When a package ships, remove the corresponding lines from
`todo.md`.

File paths were verified against the current code (2026-07-19); line numbers
are approximate anchors, not gospel.

## Status

| Pkg | Item                                       | Todo #           | Size | Status  |
| --- | ------------------------------------------ | ---------------- | ---- | ------- |
| QW  | Quick wins batch (CSS/state gates)         | 1, 9, 15, 16, 23 | S    | shipped |
| A   | Focus & keyboard fixes                     | 3, 11, 12        | S–M  | shipped |
| B   | Cascader polish                            | 7, 13, 14        | M    | shipped |
| C   | Cascader deep-nesting UX                   | 8                | L    | idea    |
| D   | Grid drag: touch support + placement feel  | 4, 25            | M    | shipped |
| E   | Overlay rendering fixes                    | 22               | S–M  | shipped |
| F   | Overlay color-theme resolution bug         | 6                | M    | shipped |
| G   | Theme generators: default-theme option     | 5                | M    | open    |
| H   | Select behavior: max selection, v2 adapter | 10, 20           | M    | shipped |
| I   | Select virtual scroll                      | 21               | L    | open    |
| J   | Masked modes: date range, duration, time   | 17, 19, 24       | M    | shipped |
| K   | Date-time input default time on date pick  | 18               | S    | shipped |
| L   | Selection indicators move to the right     | 2                | M    | open    |

Suggested order: QW → A → E/F (user-facing bugs) → B → D → H → J → K → L →
G → I → C. C needs a design decision before any code.

---

## QW. Quick wins batch (S) — shipped

Five isolated fixes, each one file, no API changes. Shipped as one change;
readonly-hover and divider fixes ride the unreleased `forms-readonly-clearable`
/ `select-option-group` changesets, the rest is `calendar-select-hover-polish`.

- [x] **Readonly choice-field hover leak** (todo 9). The controls themselves
      already gate hover on `:not([data-readonly])`
      (`checkbox.component.css`, `radio.component.css`, `switch.component.css`),
      but `choice-field.component.css` (~line 106) hovers the label area via
      `:has(.et-choice-field-control:hover)` without a readonly gate — that's
      the leak.
- [x] **Disabled calendar day hover** (todo 15). Day-cell hover rule in
      `calendar/calendar.component.css` (~line 116) lacks a
      `:not([data-disabled])` gate; disabled styling lives separately at
      ~line 156.
- [x] **Date range end-hover fills only half** (todo 16). The range band
      `&::before` in `calendar/calendar.component.css` (~lines 82–99) clips the
      candidate end date to a half fill via the `[data-band='end']` variant.
      Expected: full fill with fully rounded edges, like a selected date.
- [x] **Option-group divider survives filtering** (todo 23). The hairline in
      `select/select-option-group.component.css` uses
      `& + et-select-option-group …` — an adjacent-sibling selector that still
      counts groups hidden by search (`[data-hidden]` via
      `select-option-group.directive.ts`). Gate the divider on the previous
      sibling being visible (e.g. `:not([data-hidden]) + …`) or move the
      divider logic off sibling combinators.
- [x] **Duplicate async-select spinner** (todo 1). `select.component.html`
      renders `et-select-trigger-spinner` (~line 41) and
      `et-select-state-spinner` (~line 111) from the same `select.loading()`.
      Hide the trigger spinner while the panel is open (the dropdown spinner is
      the meaningful one then).
- [x] Verify each in Storybook (`verify-in-storybook`), changeset, docs check
      (behavioral defaults unchanged → no docs edits needed).

## A. Focus & keyboard fixes (S–M) — shipped

Three focus-management bugs, all in select/cascader headless directives.

- [x] **Phone prefix pick should focus the input** (todo 3). No select API
      change needed: `handleCountryChange` in `phone-input.component.ts` calls
      `phone.activate()` right after `selectCountry()` — focus moves to the
      number field before the picker closes, so the select's close refocus
      (which only fires when focus fell to `<body>`) leaves it there. Escape
      still refocuses the toggle. Changeset `phone-prefix-focus`.
- [x] **Cascader search clear steals focus** (todo 11). The node directive's
      pull-focus effect re-ran when the columns re-rendered after the query
      emptied. It now only takes focus from the search input on an explicit
      `focusPulse` bump (ArrowDown from the input), never on a mere re-render.
      Rides the unreleased `cascader-flat-search` changeset.
- [x] **Cascader search roving focus doesn't wrap** (todo 12). ArrowDown on
      the last search result now cycles back to the search input, mirroring
      ArrowUp above the first one.
- [x] Keyboard-only verification in Storybook for all three (8 checks incl.
      Escape and ArrowDown-into-tree regressions); unit suite green.

## B. Cascader polish (M) — shipped

- [x] **Directional section animations** (todo 7) + **search-mode resize
      animates** (todo 13). One solution for both, as predicted: core's
      `injectAnimatedBlockSize` gained an `axes` option (`'block' | 'inline'`,
      static or signal) and the cascader panel opts into
      `['block', 'inline']` outside sheet mode
      (`cascader-panel.component.ts`), so drilling grows the panel's trailing
      edge outward, going back sweeps it back in, and the columns ⇄ search
      results swap animates width + height. Two prerequisites:
      `.et-cascader-panel-body` is `inline-size: max-content` in the anchored
      presentation (a block child would mirror the host's animated width back
      into the ResizeObserver — feedback loop), and sheet mode stays
      block-only (its width follows the pane). Desktop column entry is now a
      directional slide (`et-cascader-column-grow-in`). Changeset
      `animated-size-inline-axis` (core minor); cascader side rides the
      pending cascader changesets. Docs: `axes` in
      `apps/docs/core/element-signals.md`.
- [x] **Error UI improvements** (todo 14). The error theme scope
      (`etProvideColor`) sat on the whole state row, so the Retry text button
      rendered as more red text. The scope now sits on the message span only
      (`.et-cascader-state-error-message`) — Retry keeps the ambient color and
      reads as an action; error text downsized to 12px matching select/menu.
      Both error sites (column + search results) share the fix.

## C. Cascader deep-nesting UX (L, idea — design first)

Todo 8: a cascader with ~6 levels needs testing and probably a UX answer
before code: horizontal scrolling (tedious on desktop, could be helped by
drag-scroll), or collapsing older sections into a breadcrumb/tab row after ~3
columns. **Decide the interaction model first**, then implement. Not
scheduled until that decision exists.

## D. Grid drag: touch + placement feel (M) — shipped

- [x] **Touch drag** (todo 4). Root cause as suspected: no `touch-action` on
      the drag surface, so the browser claimed touch pointermoves for
      scrolling (pointercancel before the commit threshold).
      `DragHandleDirective` now binds `touch-action: none` while enabled
      (`drag-handle.directive.ts`), and `GridDragDirective` re-states it with
      read-only awareness (`'auto'` when the grid is read-only, so static
      dashboards still scroll). Gotcha: a `null` style binding on the outer
      directive CLEARS the host directive's binding rather than delegating —
      both states must bind concrete values. Verified via CDP touch events in
      headless Chromium (drag commits a layout change; read-only grid
      scrolls). Changeset `grid-touch-drag` (core + components patch); docs
      note in `apps/docs/core/drag-resize.md`.
- [x] **Repositioning feel** (todo 25). The dead zone: colliders were pushed
      below the moved item and the closing compaction pulled the moved item
      straight back into its vacated origin — a no-op until the drag cleared
      the collider's full height. `resolveCollisions()` now has an
      escape-upward pre-pass (layout-engine.ts): when an item moves DOWN,
      each direct collider first tries the topmost free spot above the moved
      item (typically the vacated origin) before falling through to
      push-down. `moveItem()` passes `originPosition` so keyboard moves get
      the same swap. Existing 154 grid specs locked current behavior and all
      pass; 5 new layout-engine specs incl. the exact dashboard scenario.
      Changeset `grid-drag-swap-feel`; grid.md interaction bullet updated.

## E. Overlay rendering fixes (S–M) — shipped

- [x] **macOS overscroll shows through** (todo 22). Root cause was the select
      panel, not the overlay container: `.et-select-panel` was both the painted
      chrome _and_ the scroller, and macOS rubber-band overscroll drags a
      scroller's own background along with the content (it is painted into the
      scrolling contents layer), exposing the page while the border stays put.
      Fixed by moving scrolling onto a new inner `.et-select-panel-scroller`
      (chrome stays on the non-scrolling host) — the same chrome/scroller split
      cascader and menu already had, which is why they were unaffected.
      Padding token re-published as an inheriting alias (`inherits: false`
      registration). Resize animation, sticky phone search, keyboard
      scroll-into-view all re-verified. Changeset `select-panel-overscroll`.

## F. Overlay color-theme resolution bug (M) — shipped

Todo 6: `ProvideColorDirective` added via `hostDirectives` on the app
component with `.forceColor()` doesn't propagate to overlays.

- [x] Root cause: `OverlayContainerComponent`'s `parentColorProvider` is
      injected with `skipSelf`, but a pane mounted without
      `config.viewContainerRef`/`config.injector` (e.g. opener created in a
      service) has the environment injector as its DI parent — the app-root
      element provider is unreachable, so no `syncWithProvider()` ran.
      Fixed with a lazy fallback: `resolveAppRootColorProvider(appRef)`
      (`libs/core/src/lib/theming/provide-color.directive.ts`, `@internal`)
      looks up `COLOR_PROVIDER` on `ApplicationRef.components` injectors, and
      the container syncs with `parentColorProvider ?? appRootProvider`
      (`overlay-container.component.ts`). Covered by
      `overlay-container.component.spec.ts` (bootstraps a real root via
      `ApplicationRef.bootstrap`; DI-reachable provider still wins). Docs:
      "Color theme context" section in `apps/docs/components/overlays.md`.
      Changeset `overlay-app-root-color` (core + components, patch). Note:
      the surface side (`parentSurfaceProvider ?? 'dark'`) has the same DI
      hole but its `'dark'` default is deliberate — left untouched.

## G. Theme generators: default-theme option (M)

Todo 5: `libs/core/generators/tailwind-4-color-theme/generator.ts` and
`tailwind-4-surface-theme/generator.ts` need a way to mark a specific theme as
the default at generation time. Driving use case: a monorepo sharing one theme
definition set while apps need different defaults. Design note: default
selection likely belongs at the _consuming app's_ generation invocation (an
option/flag), not in the shared theme definitions. Generator change → update
theming docs + the `theming` skill if the output shape changes.

## H. Select behavior (M)

- [x] **Max selection disables remaining options** (todo 20). New
      `isDisabled` computed on `SelectOptionDirective` combines the option's
      own `disabled` input with `select.isFull() && !selected()`; it drives
      the host `aria-disabled` (existing CSS keys off it), the registered
      list item's `disabled` (so keyboard nav/typeahead skip full options
      like any disabled option), and the click/hover guards. Selected options
      stay enabled for deselection. Spec added in
      `select.directive.spec.ts`; verified in the
      `components-forms-select--max-selection` story (composes with a
      per-option `disabled` too). Rides the unreleased
      `select-custom-values-convergence` changeset (note updated); select.md
      `maxSelection` bullet updated.
- [x] **Legacy v2 query adapter for async selects** (todo 10). New
      `selectOptionsFromV2Query` in
      `select/select-options-from-v2-query.ts` — the `V2QueryClient` twin of
      `selectOptionsFromQuery`, returning the same
      `SelectOptionsFromQuery<TOption>` signal bundle. Accepts both
      `V2QueryCreator` and `createLegacyQueryCreator` interop wrappers
      (`args` builds the `prepare()` args, so `mock`/`config` extras pass
      through). Internally uses the legacy container idiom: `queryComputed`
      re-prepares per debounced query and releases the previous instance;
      two `queryStateSignal`s split live state (loading/error) from settled
      state (`cacheResponse: true`) so previous options stay rendered while
      the next request loads — mirroring the current system's `response()`.
      Spec drives a real `V2QueryClient` in mock mode (note: each async hop
      needs its own `TestBed.tick()` — `toObservable` effects don't chain in
      one flush). Changeset `select-v2-query-adapter` (minor); select.md
      async-options section extended.

## I. Select virtual scroll (L)

Todo 21: not a bug — no virtualization exists. The panel `@for`s over
`select.visibleItems()` (`select.component.html` ~line 87); the 2000-item
story renders all 2000 nodes. Real feature work: virtualization must play
nice with roving focus/active descendant, option groups, search filtering,
and custom option templates. Scope separately; consider whether cascader
columns share the solution before committing to an approach.

## J. Masked modes: date range, duration, time (M)

Todos 17, 19, 24. The mask host contract exists
(`masked-input/headless/input-mask-host.ts`, `INPUT_MASK_HOST`) and
date/time/date-time field directives already implement it.

- [x] **Date range** (todo 17): `DateRangeInputDirective` gained the same
      opt-in `mask` input + `maskPattern` computed (and dev warning) as the
      single date input; `DateRangeInputFieldDirective` implements
      `INPUT_MASK_HOST` per side (the shared `DatePickerInputFieldDirective`
      base doesn't cover it) — `value` linkedSignal from the side's
      parse-error/display state, `focused` from `focusedSide() === side`,
      commits read the mask's value instead of element text. Both fields in
      the component template carry `[etInputMask]="rangeInput.maskPattern()"`.
      New `Masked` story + 7-spec block mirroring the date input's; verified
      headlessly (guide per focused side, auto separators, paste filtering,
      per-side parse errors). Rides the unreleased `date-input-guide-masks`
      changeset (note updated); forms.md date-range section extended.
- [x] **Duration** (todo 19): closed as won't-do — deliberate exclusion
      decided in `FORMS_OPPORTUNITIES_PLAN.md` and documented in forms.md:
      the first segment is unbounded (`100:00`) so fixed slots would block
      valid entries, and the lenient parse is right-anchored (`130` → `01:30`)
      while a mask fills left-to-right, silently changing entry semantics.
- [x] **Time** (todo 24): nothing was missing — the opt-in `mask` shipped for
      time (and date-time) with the guide-masks slice
      (`time-input-field.directive.ts` hosts it; template wires
      `[etInputMask]="timeInput.maskPattern()"`). Covered by the unreleased
      `date-input-guide-masks` changeset and the forms.md time-input table.
- [x] Masks stay opt-in (decision baked into `FORMS_OPPORTUNITIES_PLAN.md` —
      lenient parsers remain the default). forms.md masked-input +
      date/time/date-time/date-range sections all reflect the final state.

## K. Date-time input: default time on date pick (S)

Todo 18 — shipped. Source confirmed: the headless `selectDate()` already
committed midnight; the default component's `completeDatePick()` deliberately
overrode a first pick with the time picker's "now"-anchored `anchorTime()`.
Decision: midnight (matches the headless semantics, typed bare dates, and the
todo's expectation). `completeDatePick` removed — the template calls
`dateTimeInput.selectDate($event)` directly; the time columns follow the
committed value (midnight) afterwards, so no anchor inconsistency remains.
Verified in `components-forms-date-time-input--default` (commits
`T00:00:00`, columns select 12/00/AM). Rides the unreleased
`components-date-time-input` changeset (note updated); forms.md picker
paragraph rewritten.

## L. Selection indicators move to the right (M)

Todo 2: checkmarks (select options), radio dots, checkboxes, switches and
custom icons currently render on the left
(`select-option.component.html/.css`, `choice-field.component.css`
`.et-choice-field-control-slot`, plus the control CSS files). Moving them
right is a visual-direction decision that touches every choice control at
once — do it as one coherent pass, verify all affected stories, and screenshot
before/after. Check RTL implications (logical properties, not physical).
