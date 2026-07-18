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
| B   | Cascader polish                            | 7, 13, 14        | M    | open    |
| C   | Cascader deep-nesting UX                   | 8                | L    | idea    |
| D   | Grid drag: touch support + placement feel  | 4, 25            | M    | open    |
| E   | Overlay rendering fixes                    | 22               | S–M  | shipped |
| F   | Overlay color-theme resolution bug         | 6                | M    | open    |
| G   | Theme generators: default-theme option     | 5                | M    | open    |
| H   | Select behavior: max selection, v2 adapter | 10, 20           | M    | open    |
| I   | Select virtual scroll                      | 21               | L    | open    |
| J   | Masked modes: date range, duration, time   | 17, 19, 24       | M    | open    |
| K   | Date-time input default time on date pick  | 18               | S    | open    |
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

## B. Cascader polish (M)

- [ ] **Directional section animations** (todo 7). In the non-bottom-sheet UI,
      each added/removed column should grow/shrink in the logical navigation
      direction. Build on the existing `--et-cascader-column-inline-size`
      `@property` + transitions in `cascader/cascader-panel.component.css`.
- [ ] **Search-mode resize animates** (todo 13). Entering search mode from an
      existing multi-part selection resizes the overlay (width and height)
      without animation. Tie into the same size-transition mechanism as the
      column animations — likely one solution for both.
- [ ] **Error UI improvements** (todo 14). Vague by design — audit the error
      state in stories first, then scope. At minimum align it with the select
      error presentation.

## C. Cascader deep-nesting UX (L, idea — design first)

Todo 8: a cascader with ~6 levels needs testing and probably a UX answer
before code: horizontal scrolling (tedious on desktop, could be helped by
drag-scroll), or collapsing older sections into a breadcrumb/tab row after ~3
columns. **Decide the interaction model first**, then implement. Not
scheduled until that decision exists.

## D. Grid drag: touch + placement feel (M)

- [ ] **Touch drag** (todo 4). Resize works on touch because
      `libs/core/src/lib/resize-handles/resize-handles.component.ts` sets
      `touch-action: none`; the drag surface never does —
      `grid/grid-item.component.ts` inline styles and
      `libs/core/src/lib/drag-handle/drag-handle.directive.ts` set no
      `touch-action`, so the browser swallows touch pointermoves for
      scrolling. Set `touch-action: none` on the drag handle host (core fix —
      benefits every consumer of the directive). Verify via the mobile
      emulator skill.
- [ ] **Repositioning feel** (todo 25). Dragging the top-left chart widget
      down requires dragging past the smaller text widget before anything
      moves — the collision/placement pass in
      `grid/headless/internals/layout-engine.ts` (`resolveCollisions()`,
      `compactLayout()`) doesn't consider a swap when the target column has
      less occupied space. Investigate a midpoint-overlap or swap heuristic;
      this is algorithm tuning, so lock in current behavior with layout-engine
      specs first.

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

## F. Overlay color-theme resolution bug (M)

Todo 6: `ProvideColorDirective` added via `hostDirectives` on the app
component with `.forceColor()` doesn't propagate to overlays.
`overlay-container.component.ts` applies `ProvideColorDirective` itself and
the cross-portal `syncWithProvider()` mechanism exists
(`libs/core/src/lib/theming/provide-color.directive.ts`) — the bug is in how
the overlay resolves _which_ provider to sync with (DI can't cross the portal
boundary, which is exactly what sync is for). Reproduce in a story with a
host-directive-provided forced color, then fix resolution. Touches
`libs/core` — needs changesets for both `core` and `components` if both move.

## G. Theme generators: default-theme option (M)

Todo 5: `libs/core/generators/tailwind-4-color-theme/generator.ts` and
`tailwind-4-surface-theme/generator.ts` need a way to mark a specific theme as
the default at generation time. Driving use case: a monorepo sharing one theme
definition set while apps need different defaults. Design note: default
selection likely belongs at the _consuming app's_ generation invocation (an
option/flag), not in the shared theme definitions. Generator change → update
theming docs + the `theming` skill if the output shape changes.

## H. Select behavior (M)

- [ ] **Max selection disables remaining options** (todo 20).
      `select/headless/select.directive.ts` has `maxSelection` and an `isFull`
      computed that silently ignores further adds. Surface it: unselected
      options render disabled while full (`select-option.directive.ts` —
      combine with the option's own `disabled` input, don't overwrite it).
      Decide whether search/keyboard nav skips them (consistent with disabled
      options today).
- [ ] **Legacy v2 query adapter for async selects** (todo 10). The async
      select speaks the current query system; provide an adapter for the
      legacy v2 query client so older apps can adopt the new select. Read the
      `query` skill first; home is probably alongside the existing adapter in
      the select's query integration.

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

- [ ] **Date range** (todo 17): adopt in
      `date-range-input/headless/date-range-input-field.directive.ts` — two
      fields, each masked like the single date input.
- [ ] **Duration** (todo 19): adopt in
      `duration-input/headless/duration-input-field.directive.ts`.
- [ ] **Time** (todo 24): `time-input-field.directive.ts` already implements
      the host contract — first confirm what's actually missing (probably the
      opt-in guide-mask preset, not the plumbing).
- [ ] Masks stay opt-in (decision baked into `FORMS_OPPORTUNITIES_PLAN.md` —
      lenient parsers remain the default). Docs: extend the masked-input
      sections in `apps/docs/components/`.

## K. Date-time input: default time on date pick (S)

Todo 18: picking a date auto-selects the current wall-clock time.
`date-time-input/headless/date-time-input.directive.ts` `selectDate()`
defaults a null value to `startOfDay(day)` — so the observed behavior likely
comes from the embedded time-picker's initial selection instead. Confirm the
source, then decide the intended default (midnight vs. current time vs.
leaving time empty until chosen) — this is a behavior decision worth a
sentence in the docs either way.

## L. Selection indicators move to the right (M)

Todo 2: checkmarks (select options), radio dots, checkboxes, switches and
custom icons currently render on the left
(`select-option.component.html/.css`, `choice-field.component.css`
`.et-choice-field-control-slot`, plus the control CSS files). Moving them
right is a visual-direction decision that touches every choice control at
once — do it as one coherent pass, verify all affected stories, and screenshot
before/after. Check RTL implications (logical properties, not physical).
