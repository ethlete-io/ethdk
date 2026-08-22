# Test-infrastructure programme — dispatch plan

Scope: triage items **Improvements #2, #3, #5** and **Spec-coverage #3, #4, #5, #7, #8, #9**
from `/Users/tom/dev/ethlete-sdk/plans/components-lib-scan-triage.md`.
Source audit: `/Users/tom/dev/ethlete-sdk/plans/components-lib-scan.md` (grep it, never open whole).

Every implementation agent must, before starting:
`export NX_NO_CLOUD=true`, read `AGENTS.md`, the `styleguide`, `rxjs-signals` and
`angular-patterns` skills, and the **Inventory** section below.

---

## 0. Ground rules (apply to every work item)

- **One work item = one commit, path-limited**: `git commit -m "..." -- <paths>`. The paths are
  listed per item under "Commit paths". Never `git add -A`.
- **No production-source changes.** This programme is test-only: spec files plus testing helpers
  that no entry point exports (`libs/components/src/index.ts` and `lib/forms/index.ts` export no
  `testing/` path; `src/test-helpers.ts` is outside the entry graph). If a work item discovers it
  _needs_ a production edit to make something testable, it stops and reports to the coordinator —
  it does not make the edit.
- **Changesets: none.** Per `.agents/skills/changeset/SKILL.md`: "test-only changes don't need a
  changeset", and nothing here is publicly exported. The only exception is the escalation above —
  a production edit approved by the coordinator gets its own changeset in its own item.
- **Docs: none.** Test infra is not public API; `apps/docs` is untouched.
- **Verification, in this order, per item**:
  1. `npx prettier --write <changed files>`
  2. `npx eslint <changed dirs> --fix`
  3. `npx nx lint components` (never `nx lint components --fix`)
  4. `npx vitest run --config vitest.projects.ts --project components`
- **Break-your-own-fix**: each item's "Prove it" names a concrete sabotage and the assertions that
  must fail under it. The implementer performs the sabotage, records the failing assertion names,
  restores, re-runs green, and reports both lists.
- **Comments**: the repo's allowlist applies to testing code too. A helper's public JSDoc (case 4)
  and jsdom-workaround notes naming the concrete jsdom gap (case 3) are the only comments expected.
- **Timers**: `vi.useFakeTimers()` never fakes `window.setTimeout` in this repo — helpers must use
  the bare globals (`setTimeout`, `requestAnimationFrame`) and real flushes (`flushFrames`).
- **Dependency-checks lint**: do not add new package imports to testing files; use only what the
  existing drivers already import (`@angular/core`, `@angular/core/testing`, `@ethlete/core`,
  vitest globals).

---

## 1. Inventory — what already exists; do not duplicate any of it

### `libs/components/src/test-helpers.ts` (side-effect import, ~174 spec files)

Global **inert** jsdom shims, installed once per spec file via `import '../../test-helpers'`:

- `ResizeObserverMock` — never reports. **Load-bearing**: anything using
  `signalElementDimensions` needs it to render.
- `IntersectionObserverMock` — never reports.
- `matchMedia` mock — never matches.
- `AnimationMock` on `Element.prototype.animate` — dispatches a `finish` **event** via
  `queueMicrotask`, resolves `finished`, but **never invokes the `onfinish`/`oncancel`
  properties** (the T1 defect). `cancel()` dispatches `cancel` but the queued auto-finish still
  fires afterwards.

These stay inert. The new fakes are **opt-in, per-test, controllable overlays** that restore
themselves; they never replace the global defaults, because 174 files depend on the inert
behaviour.

### `libs/components/src/lib/testing/` (cross-domain)

| File                        | Provides                                                                                                                                                                                                                                                                                                             |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `driver-core.ts`            | `tick`, `flushFrames`, `resetOverlays`, `latestPane`, `hostDirective`, `directiveAt`, `hostElement`, `pressKey`, `focusEvent`, `pointerEnter/Event`, `setInputValue`, `focusField`, `typeInField`, **`typeChars`** (char-by-char, Spec-coverage #1 — done), `blurField`, `pointerDownOutside`, `pasteInto`, `textOf` |
| `control-driver.ts`         | `mountControl(component, providers, beforeCreate)`, `createControlDriver` (typed `query`/`queryAll`/`text`/`click`, directive lookup)                                                                                                                                                                                |
| `field-control-driver.ts`   | `createFieldControlDriver` / `mountFieldControl` — text-field plumbing (`type`, `typeChars`, `typeAndBlur`, `focus`, `blur`, `press`)                                                                                                                                                                                |
| `overlay-control-driver.ts` | `createOverlayControlDriver` — **form controls** backed by an overlay (`[role="combobox"]` trigger, `pane()`, `open/close`, `settle`, `escape`, `pointerDownOutside`, `clickInPane`)                                                                                                                                 |
| `aria-structure.ts`         | `expectOwnedAriaRoles`, `expectAriaGrid`, `expectAriaTablist`, `expectUniformCellsPerRow`, `resolveAriaOwner` (Spec-coverage #6 — done)                                                                                                                                                                              |
| `color-themes.ts`           | `TEST_COLOR_THEMES` + `provideColorThemes` wiring                                                                                                                                                                                                                                                                    |
| `expected-console.ts`       | `silenceExpectedConsole(method)` with `onTestFinished` auto-restore — the restore pattern every new fake must copy                                                                                                                                                                                                   |

### `libs/components/src/lib/forms/testing/` (forms domain)

- **16 control drivers**: cascader, checkbox, color-input, date-picker (covers all six date/time
  controls), dropzone, number-input, otp-input, password-input, phone-input, rating, select,
  selection-list, slider, switch, tag-input, textarea.
- **Contract/assertion kits** (item 5 builds _next to_ these, never re-implements):
  - `described-by.ts` — `expectDescribedByResolves` (Spec-coverage #2 — **shipped**, build on it).
  - `mixed-state-contract.ts` — `describeMixedStateContract`, 19 caller specs.
  - `picker-commit-contract.ts` — `describePickerCommitContract` (**shipped** with Fix-now #1;
    the item-5 mention of it is already satisfied).
  - `expanded-contract.ts` — `describeExpandedStateContract` (select + color-input call it).
  - `accessible-name.ts` — `describeAccessibleNameContract` + `resolveAccessibleName`.

### Already-shipped pieces the triage names — extend, never re-create

- `typeChars()` (Spec-coverage #1), `expectDescribedByResolves` (#2), `aria-structure.ts` (#6),
  the palette re-point + `overlay-opener.spec.ts` (most of #7's named cases), `swiss.spec.ts`,
  `table-state-url.spec.ts`, `rich-text-editor-trigger-detection.spec.ts` (three of #5's pure
  functions), `scheduler.component.spec.ts`, `pip-manager.spec.ts` + `stream-player-slot.spec.ts`.
- **Spec-coverage #3 is effectively done**:
  `lib/forms/form-field/headless/text-field-control-inputs.spec.ts` (landed with Fix-now #17)
  loops the five text shells against `TEXT_FIELD_CONTROL_INPUTS`. Item C1 below only extracts it
  into a reusable helper.
- The carousel spec carries the **reference implementations** of `fakeLayout()` and a fireable
  `fakeResizeObserver()` (local, `carousel.component.spec.ts:77-160`) — T2 promotes these.
- `overlay-strategy-controller.spec.ts:12-43` carries the only `FakeMatchMedia` — T3 promotes it.

### Hand-rolled duplication the programme retires (the migration targets)

- Fireable ResizeObserver / IntersectionObserver / layout stubs: **grid 6 files + masonry 1**
  (`grid-item.component`, `grid.component`, `grid-drag.directive`, `grid-item.directive`,
  `grid-resize.directive`, `grid.directive`, `masonry.spec`), **tabs 3 files** (`tab-group`,
  `nav-tabs`, `overlay-nav-tab-link` — plus a `HTMLElement.prototype.scroll` stub),
  **carousel 1**, **scrollable 1**, **table 1** (`table-page-sticky-header` clientWidth). Two
  further copies (`form-field.component.spec.ts`, `menu-selection-groups.component.spec.ts`) have
  no owning work item and are **left alone** (opportunistic cleanup when those domains next open).
- `fixture.nativeElement.querySelector*` hand-rolled query helpers: **58 spec files, 140 call
  sites** (surveyed 2026-08-22). This is the cascade that produced 156 of the 389 spec type
  errors (untyped `nativeElement: any` + a generic call → TS2347 → element type collapses to `{}`
  → TS2339 on every member access). The two calendar files are already fixed by a parallel agent;
  **zero generic-typed call sites remain today**, but every un-narrowed helper is one edit away
  from re-introducing the cascade.

---

## 2. Item 3 — shared jsdom infrastructure (Wave 0, all four parallel)

Four items, four disjoint path sets. T1–T4 have **no dependencies on each other**.

### T1 — Wire `onfinish`/`oncancel` into the `AnimationMock` _(load-bearing prerequisite)_

- **Creates/edits**:
  - `libs/components/src/test-helpers.ts` — the `AnimationMock` block only.
  - `libs/components/src/lib/stream/pip-manager.spec.ts` — add the animated-exit case(s) the mock
    previously made impossible (the scaleFadeIn latch clearing; `anim.onfinish = endExitAnimation`
    at `pip-manager.ts:156` actually running); adjust any existing case the change flips.
- **Design constraints**:
  - Dispatching `finish`/`cancel` must _also_ invoke the `onfinish`/`oncancel` property (real
    `Animation` fires both the event and the handler).
  - Add a settled latch: `cancel()` before the auto-finish microtask must suppress the queued
    finish (today it would double-fire once the properties are wired); `finish()` after `cancel()`
    is a no-op, and vice versa. Update `playState` accordingly (`'finished'` / `'idle'`).
  - Keep: the `queueMicrotask` auto-finish, the `finished` promise resolving, event-listener
    dispatch (`flip-animation.ts:187` listens via `addEventListener('finish')`), the module
    remaining side-effect-only with no exports.
- **Must NOT touch**: the other three shims in `test-helpers.ts`; any production source; any other
  spec. `.onfinish =` appears in production **only** in `lib/stream/` (`pip-manager.ts`,
  `pip-animation.ts` ×4) — the blast radius is stream.
- **Backward compatible**: all 174 importing spec files must stay green except deliberate stream
  re-points (report each one).
- **Prove it**: new pip-manager case(s) assert the exit animation's `onfinish` path completes
  (player re-parented / latch cleared). Sabotage: comment out the `onfinish` invocation in the
  mock → those named assertions fail; restore; full suite green.
- **Commit paths**: `libs/components/src/test-helpers.ts libs/components/src/lib/stream/`

### T2 — `fakeLayout()` + fireable observer fakes

- **Creates**: `libs/components/src/lib/testing/fake-layout.ts` exporting:
  - `fakeLayout(rules)` — generalisation of the carousel's local helper: rules map a selector (or
    predicate) to `{ clientWidth?, clientHeight?, offsetWidth?, offsetHeight?, offsetLeft?,
offsetTop?, rect? }`, patched on the prototypes with a **default fall-through to the original
    descriptor** (the carousel version returns 0/`SLIDE_SIZE` for _everything_ — the shared one
    must scope by rule). Ship a `stackedChildren(selector, size)` preset for the
    index×size `offsetLeft` case.
  - `fakeResizeObserver()` and `fakeIntersectionObserver()` — recording, fireable
    (`fire(target?, entryInit?)`), exposing observed targets.
  - `fakeElementScroll()` — records `scroll`/`scrollTo` calls (jsdom lacks them; the tab specs
    stub this by hand today) and lets a test assert the args.
  - Every installer returns a restore function **and** auto-restores via `onTestFinished` (the
    `expected-console.ts` pattern) — a leaked prototype patch poisons every later spec in the file.
- **Edits**: `libs/components/src/lib/carousel/carousel.component.spec.ts` — delete the local
  `fakeLayout`/`fakeResizeObserver` (lines 77–160) and consume the shared ones. This is the
  same-commit reference migration that proves the API.
- **Must NOT touch**: `src/test-helpers.ts` (T1's file; the inert globals stay); grid, masonry,
  tabs, scrollable, table specs (their domain items migrate them).
- **Backward compatible**: the inert global mocks remain the default for the 174 importers; the
  fakes only take effect in tests that call them.
- **Prove it**: carousel suite green through the shared helpers. Sabotage: make the shared
  `fakeLayout` report 0 for slides → the carousel loop-alignment and `playOnInit` assertions fail
  by name; restore.
- **Commit paths**: `libs/components/src/lib/testing/fake-layout.ts libs/components/src/lib/carousel/carousel.component.spec.ts`

### T3 — `fakeMatchMedia()` + breakpoint control

- **Creates**: `libs/components/src/lib/testing/fake-match-media.ts` exporting:
  - `fakeMatchMedia()` — installs a controllable `window.matchMedia` (promoted from the spec-local
    `FakeMatchMedia`), restore via `onTestFinished`; keeps `setMatches(query, matches)` for parity.
  - `setViewportWidth(px)` (or `fakeBreakpoint('sm')` sugar over it) — evaluates
    `(min-width: …)` / `(max-width: …)` queries against a fake width and notifies listeners, so
    `injectObserveBreakpoint` / overlay strategy switching / the cascader's `isSheet` work without
    the test knowing the exact query strings. Derive thresholds by parsing the query, not by
    hard-coding `DEFAULT_VIEWPORT_CONFIG`.
  - JSDoc the **ordering invariant** (comment case 1): the breakpoint observer root provider
    captures `defaultView.matchMedia` at first inject — install the fake before the first
    `TestBed` inject that touches it, i.e. in `beforeEach` before fixture creation.
- **Edits**: `libs/components/src/lib/overlay/strategies/overlay-strategy-controller.spec.ts` —
  delete the 40-line local class, consume the shared fake (same-commit reference migration).
- **Must NOT touch**: cascader files (C3 owns the bottom-sheet coverage); `src/test-helpers.ts`.
- **Prove it**: controller spec green. Sabotage: stop `setMatches` from notifying listeners → the
  breakpoint-switch assertions ("switches strategy when the query flips") fail; restore.
- **Commit paths**: `libs/components/src/lib/testing/fake-match-media.ts libs/components/src/lib/overlay/strategies/overlay-strategy-controller.spec.ts`

### T4 — `destroyed-mid-gesture` helper + first caller (Spec-coverage #8)

- **Creates**:
  - `libs/components/src/lib/testing/destroyed-mid-gesture.ts` — a recorder that wraps
    `requestAnimationFrame` (bare global — remember the fake-timers pitfall) and spies listener
    registration on given targets; API shape:
    `expectNothingRunsAfterDestroy({ fixture, start, settle? })` → runs the gesture start,
    destroys the fixture, flushes frames, asserts zero new rAF callbacks / listener invocations.
    Must include a self-check path so it cannot pass vacuously (e.g. it throws if the recorder saw
    no activity _before_ destroy either).
  - `libs/components/src/lib/table/table-reorder.directive.spec.ts` — seed file: start an edge
    auto-scroll reorder drag, destroy, assert the rAF loop stops (pins the Fix-now #16 fix; the
    445-line directive currently has zero coverage).
- **Must NOT touch**: notification, scrollable, stream specs (their items add their own callers);
  the table driver (D5 extends this spec file later — same lane).
- **Prove it**: sabotage by re-introducing the leak — locally revert the destroy hook on
  `etTableReorder`'s auto-scroll loop (working tree only, never committed) → the new assertion
  fails; restore. Report the failing assertion name.
- **Commit paths**: `libs/components/src/lib/testing/destroyed-mid-gesture.ts libs/components/src/lib/table/table-reorder.directive.spec.ts`

### T5 — typed fixture query surface in `driver-core.ts` _(Wave 0, parallel with T1–T4)_

Added on a coordinator finding: `ComponentFixture.nativeElement` is `any`, so a generic
`fixture.nativeElement.querySelectorAll<T>(...)` raises TS2347 and collapses every downstream
member access to TS2339 — 156 of the spec suite's 389 type errors came from this one shape in the
two calendar files (already fixed). 58 spec files / 140 call sites still query through un-narrowed
`nativeElement` helpers.

- **Edits**: `libs/components/src/lib/testing/driver-core.ts` — add standalone, fixture-level
  typed queries that narrow `nativeElement` to `HTMLElement` **once, centrally**:
  - `queryAll<E extends Element = HTMLElement>(fixture, selector): E[]`
  - `query<E extends Element = HTMLElement>(fixture, selector): E | null`
  - (`createControlDriver`'s existing `query`/`queryAll` should delegate to these.)
- **Migration**: **not** in this commit. The 140 call sites are migrated by the domain driver
  items (Wave 1) as they touch each spec anyway; files no item owns keep their local helper.
  Every Wave-1 item's definition of done includes "domain specs query through `driver-core`
  `query`/`queryAll` or a driver built on them — no remaining `fixture.nativeElement.querySelector`
  in the domain".
- **Must NOT touch**: any spec file; the other testing files.
- **Prove it**: `npx tsc -p libs/components/tsconfig.spec.json --noEmit 2>&1 | grep -c 'TS2347'`
  stays 0, and a scratch generic call through the new helper compiles where the same call through
  `fixture.nativeElement` does not (demonstrate in the report, don't commit the scratch).
  Sabotage: type the helper's parameter as `any` → show the scratch reproduction of the TS2347 →
  `{}` cascade returns.
- **Commit paths**: `libs/components/src/lib/testing/driver-core.ts`

---

## 3. Items 2 + 5 — drivers and contracts (Wave 1 + independent lanes)

**Design rule for every driver** (this is triage item 2's "one programme, not fifteen bespoke
harnesses"): a domain driver is a thin factory over `mountControl` / `createControlDriver` /
`createFieldControlDriver` / `createOverlayControlDriver` + the T2–T5 fakes. It adds domain
vocabulary (`cellFor`, `pin`, `badges`), never re-implements `tick`/`flushFrames`/`latestPane`/
query plumbing. A driver that seems to need more than that is a finding — report it, don't build it.

**Placement**: cross-domain → `lib/testing/`; forms controls → `lib/forms/testing/`; every other
domain → `lib/<domain>/testing/<domain>-driver.ts` (the audit's "like the forms domain does").
This keeps each parallel agent inside one domain folder.

### Can start immediately (no item-3 dependency)

**D7 — calendar + time-picker drivers** ·
Creates `lib/calendar/testing/calendar-driver.ts`, `lib/time-picker/testing/time-picker-driver.ts`
(`cell(day)`, `focusedCell()`, `bandedCells()`, `column(unit)`, `option(unit, value)`,
`press(key)`); migrates the 4 specs' duplicated `cellFor`/`optionButton`/keydown helpers
(~150 lines) and their `nativeElement` queries; fills the `minuteStep`/`generateSteppedValues`
edge gaps in `time-format.spec.ts` if missing (Spec-coverage #5's time-picker entry).
**Warning**: do NOT point `expectUniformCellsPerRow` at the multi-month calendar — that Medium
(rows with fewer than seven gridcells) is a live, deliberately-open defect; the assertion would
land red. Prove: sabotage the driver's `cell()` selector → named calendar keyboard/banding
assertions fail. Commit paths: `libs/components/src/lib/calendar/ libs/components/src/lib/time-picker/`.

**D8 — bracket driver** · Creates `lib/bracket/testing/bracket-driver.ts`
(`bracketTestDriver({ source, layouts })`, `activeMatchIds()`, `cellFor(matchId)`, `pin(id)`,
`sections()`); deletes the 20-line normalizer + `LAYOUTS` + query helpers re-declared in the 3
bracket specs. Prove: sabotage `cellFor` → pin/highlight assertions fail.
Commit paths: `libs/components/src/lib/bracket/`.

**D9 — scheduler driver** · Creates `lib/scheduler/testing/scheduler-driver.ts` (`badges()`,
`cellFor(date)`, `clickAppointment(id)`, `editSurface()`); routes `scheduler.component.spec.ts` +
`scheduler-edit-surface.directive.spec.ts` through it; extends view-component coverage the audit
lists. Prove: sabotage `editSurface()` lookup → the stacked-surface regression case fails.
Commit paths: `libs/components/src/lib/scheduler/`.

**D11 — RTE driver + multi-language RTE coverage** · Creates
`lib/forms/testing/rich-text-editor-driver.ts` (`type`, `caretAt`, `selectText`, `pressKey`,
`paste`, `value()`); dedupes the two hand-rolled setups
(`rich-text-editor-dom.spec.ts:26-77`, `rich-text-editor.directive.spec.ts:224-244`); adds the
first `multi-language-rich-text-editor` spec (Spec-coverage #9). Prove: sabotage `selectText`
offsets → named serialization/trigger assertions fail.
Commit paths: `libs/components/src/lib/forms/rich-text-editor/ libs/components/src/lib/forms/multi-language-rich-text-editor/ libs/components/src/lib/forms/testing/rich-text-editor-driver.ts`.

**D12 — remaining forms drivers** · Creates `lib/forms/testing/duration-input-driver.ts`,
`input-driver.ts` (et-input/et-form-field shell), `choice-field-driver.ts` (+ segmented-button);
lifts the copy-pasted masked-typing loop onto the date-picker driver as `typeMasked()`
(edits `date-picker-driver.ts` + the two date specs that carry the copy); migrates
`duration-input.directive.spec.ts` off hand-rolled TestBed. Prove: sabotage `typeMasked` caret
handling → the mask suites fail. Commit paths: `libs/components/src/lib/forms/testing/
libs/components/src/lib/forms/duration-input/ libs/components/src/lib/forms/input/
libs/components/src/lib/forms/choice-field/ libs/components/src/lib/forms/date-time/`.
_(Collision note: D12 and D11 both add files under `forms/testing/` — distinct filenames, safe.)_

**D13 — match + standings driver** · Creates `lib/match/testing/` + `lib/standings/testing/`
shared query driver (`card`, `text`, `all`, `cells` are near-identical in both specs); migrates
both specs. Small (S). Coordinator may drop this if capacity is short — lowest value of the set.
Commit paths: `libs/components/src/lib/match/ libs/components/src/lib/standings/`.

**P1 — pure-function specs (Spec-coverage #5 remainder; new files only)** · Creates:
`lib/forms/form-field/headless/form-support-presentation.spec.ts` (all 12
`reduceSupportPresentation` from→to pairs incl. `none`: `renderedState`, `leavingState`, both
`directions`, retained-vs-cleared errors/warnings), `lib/overlay/routing/overlay-router-path.spec.ts`
(`resolvePath` four forms + the `'/'`-is-`'back'` special case + the `(string|number)[]` join),
`lib/internals/sort-by-dom-order.spec.ts`, `lib/internals/typeahead.spec.ts`.
Already covered — do not duplicate: `resolveTriggerMatch`, swiss end-to-end,
`deserializeTableState`/`restoreState`. **Adds files only; edits nothing** → collision-free.
Prove: each spec was watched failing against a hand-broken copy of the pure function (working
tree only). Commit paths: the four new spec files.

**P2 — small zero-coverage surfaces (Spec-coverage #9 remainder)** · First specs for
`floating-action`, `skeleton`, and `filterOverlayPreviewFromQuery` (use `setupQueryTest` /
`@ethlete/query` testing fakes via `mountControl`'s `beforeCreate`, the documented window for it).
No other item touches these three domains, so one grouped item is parallel-safe. New files only.
Commit paths: `libs/components/src/lib/floating-action/ libs/components/src/lib/skeleton/
libs/components/src/lib/filter-overlay/`.

### Blocked on Wave 0

**D1 — overlay driver** _(needs T3)_ · Creates `lib/testing/overlay-driver.ts` —
`createOverlayDriver(fixture)` for **plain** dialogs/sheets/openers/router (what
`overlay-control-driver` deliberately doesn't cover): open via manager or opener, `pane()`,
`backdrop()`, `escape()`, `pointerDownOutside()`, `settle()`, `switchBreakpoint()` (via T3).
Converts the overlay-container spec's re-derived helpers, and demonstrates the Spec-coverage #7
pattern by mounting one currently bare-fixture overlay consumer through it. Prove: sabotage
`settle()` (drop `flushFrames`) → `open()`-dependent assertions fail.
Commit paths: `libs/components/src/lib/testing/overlay-driver.ts libs/components/src/lib/overlay/`.

**D2 — grid + masonry driver** _(needs T2, T5)_ · Creates `lib/grid/testing/grid-driver.ts`
(`createGridHarness({ width, breakpoints })`) + `lib/masonry/testing/masonry-driver.ts`
(`createMasonryHarness({ containerWidth, heights })`); migrates the **7** hand-rolled shim copies
(6 grid specs + masonry) onto T2's fakes and T5's queries; deletes the stale `version: 1`
properties those literals carry while editing those exact lines. Adds the keyboard/gesture cases
the audit says become cheap. Prove: sabotage the harness width → named packing/constraint
assertions fail. Commit paths: `libs/components/src/lib/grid/ libs/components/src/lib/masonry/`.

**D3 — tabs driver + tab-bar keyboard model** _(needs T2, T5)_ · Creates
`lib/tabs/testing/tabs-driver.ts`; migrates the 3 tab specs' ResizeObserver/IntersectionObserver/
`scroll` triple onto T2 (`fakeElementScroll`); adds the missing tab-bar keyboard-model coverage
(96 a11y-critical lines — Spec-coverage #9). Prove: sabotage roving-tabindex lookup in the driver
→ keyboard assertions fail. Commit paths: `libs/components/src/lib/tabs/`.

**D4 — carousel/scrollable/scrollbar drivers** _(needs T2; runs after T2 by definition)_ ·
Creates `lib/carousel/testing/carousel-driver.ts` (slides, dots, controls, `settle()`),
`lib/scrollable/testing/scrollable-driver.ts` (T2 `fakeLayout` + chrome queries),
`lib/scrollbar/testing/scrollbar-driver.ts` (thumb drag as pointer sequence); migrates
`scrollable.component.spec.ts` shims; covers `carousel-loop.ts` / `carousel-slide-progress.ts`
units the audit ranks first. Prove: sabotage the thumb-drag pointer sequence → scrollbar drag
assertions fail. Commit paths: `libs/components/src/lib/carousel/ libs/components/src/lib/scrollable/ libs/components/src/lib/scrollbar/`.

**D5 — table driver** _(needs T2, T4, T5; same lane as T4 — table)_ · Creates
`lib/table/testing/table-driver.ts` (rows/cells/header queries, sort/filter interactions, sticky
layout via T2); migrates `table-page-sticky-header.directive.spec.ts`'s clientWidth stub; extends
T4's `table-reorder.directive.spec.ts` with the pointer-sequence reorder + drop-commit cases
(remaining Spec-coverage #9 table surface). Prove: sabotage the driver's row indexing → reorder
commit assertions fail. Commit paths: `libs/components/src/lib/table/`.

**D6 — stream driver** _(needs T1)_ · Creates `lib/stream/testing/stream-driver.ts` — fakes a
platform player/SDK, exposes "register slot / activate pip / assert player parent"; adds
`stream-manager.ts` unit coverage (`resolveBestSlot`, `unregisterSlot` destroy-or-reassign,
`transferPlayer`); reroutes `pip-manager.spec.ts` / `stream-player-slot.spec.ts` plumbing through
it where it deletes code. Prove: sabotage the fake player's parent tracking → PiP park/exit
assertions fail. Commit paths: `libs/components/src/lib/stream/`.

**D10 — notification driver + swipe coverage** _(needs T4)_ · Creates
`lib/notification/testing/notification-driver.ts` (`createNotificationHarness()` →
`{ open, advance, refs, dismiss }`); adds the first
`notification-swipe-to-dismiss.directive.spec.ts` (279 lines uncovered) with a full swipe
gesture + a T4 destroyed-mid-gesture case. Prove: sabotage the gesture threshold in the driver's
swipe sequence → dismiss assertions fail. Commit paths: `libs/components/src/lib/notification/`.

### C-lane — item 5 contracts (strictly serial: C1 → C2 → C3; shared caller files)

**C1 — tighten `describeMixedStateContract` + extract the wrapper-inputs loop** _(no deps)_ ·
Edits `forms/testing/mixed-state-contract.ts`: the clear case must not pass vacuously (skip
explicitly when no `clear` is provided, fail when `clear` is provided without `emptyValue`), and
the two documented-but-unasserted clauses of its JSDoc contract get real assertions
(Spec-coverage #4's third bullet). Creates `forms/testing/wrapper-inputs.ts` —
`expectWrapperExposesBaseInputs(wrapper, base)` extracted from
`text-field-control-inputs.spec.ts`, which becomes its first caller (closes Spec-coverage #3's
reusable form). Expect harness edits in a handful of the 19 caller specs. Prove: re-loosen the
contract → list which caller assertions were previously passing vacuously (the whole point).
Commit paths: `libs/components/src/lib/forms/testing/mixed-state-contract.ts
libs/components/src/lib/forms/testing/wrapper-inputs.ts
libs/components/src/lib/forms/form-field/headless/text-field-control-inputs.spec.ts` + the
touched caller specs (list them in the commit).

**C2 — `describeOverlayControlContract`** _(after C1; overlay-control-driver already exists)_ ·
Creates `forms/testing/overlay-control-contract.ts`: touched-on-blur-but-NOT-on-panel-open,
Escape-then-close, outside-pointer close, focus return — and **reuses**
`describeExpandedStateContract` for the expanded half rather than duplicating it. Wire into the
select and cascader specs (pinning the two panels to one behaviour).
**Known red**: the cascader's premature-`touched`-on-open Medium is a live, deliberately-open
defect (triage #14 "left open"). Land that expectation as an explicitly-marked expected failure
(`it.fails` with a comment linking the triage entry — comment case 3) and report it; the
production fix is a separate, out-of-programme item (it needs a changeset). Prove: sabotage the
contract's blur step → the select `touched` assertions fail.
Commit paths: `libs/components/src/lib/forms/testing/overlay-control-contract.ts
libs/components/src/lib/forms/select/ libs/components/src/lib/forms/cascader/`.

**C3 — cascader bottom-sheet coverage** _(after T3 and C2 — same cascader files)_ ·
Extends `forms/testing/cascader-driver.ts` with a `{ sheet: true }` mount option built on T3
(`setViewportWidth` below `sm` before mount — respect the install-before-first-inject invariant);
first coverage of the whole sheet presentation: `goBack()`, the Back bar, title cross-slide,
sheet column area. Prove: sabotage the viewport width (leave it desktop) → every sheet assertion
fails, demonstrating nothing else was forcing `isSheet`.
Commit paths: `libs/components/src/lib/forms/testing/cascader-driver.ts
libs/components/src/lib/forms/cascader/`.

---

## 4. Migration policy

**Reference caller in the same commit; fleet migration in the owning domain's Wave-1 item; files
no item owns are left alone.** Justification: each helper is proven against one real caller the
moment it lands, while the multi-file migrations ride the domain items that must edit those exact
spec files anyway — so no spec file is touched by two parallel commits.

Concrete expected reach:

| New piece                            | Same-commit migration                                           | Follow-up migrations (owning item)                                      | Left alone                                                                |
| ------------------------------------ | --------------------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| T1 AnimationMock wiring              | 0 files (global behaviour) — ~7 stream cases watched/re-pointed | —                                                                       | —                                                                         |
| T2 `fakeLayout` + observers + scroll | carousel spec (1)                                               | grid+masonry 7 (D2), tabs 3 (D3), scrollable 1 (D4), table 1 (D5)       | `form-field.component.spec.ts`, `menu-selection-groups.component.spec.ts` |
| T3 `fakeMatchMedia`                  | overlay-strategy-controller spec (1)                            | new consumers D1, C3                                                    | —                                                                         |
| T4 gesture helper                    | table-reorder seed spec (new)                                   | notification (D10); scrollable/stream opportunistic                     | —                                                                         |
| T5 typed queries                     | 0 (helper only)                                                 | the 58 files / 140 call sites, migrated per domain as D1–D13 touch them | files in domains with no work item                                        |
| C1 contract tightening               | its 19 callers in one commit (that's the item)                  | —                                                                       | —                                                                         |

## 5. Non-goals — deliberately out of scope

- **No production/source changes**: no behaviour fixes (cascader `touched`, multi-month gridcell
  count, `registerSingleton` clobbering), no new public API, no `@ethlete/query` testing changes.
  Where a contract exposes a live defect, it lands as a marked expected failure + a report.
- **No cdk work.** `libs/cdk` gets nothing from this programme.
- **No changesets, no docs** (test-only; nothing publicly exported — see Ground rules).
- **No spec-typecheck target / 389-error burn-down** (triage Spec-coverage #10 — done/tracked
  separately). T5 removes the largest error _class_; it does not chase the remainder.
- **No runtime migration**: jsdom + the inert global shims stay; no Vitest browser mode, no
  Playwright/Storybook harness for these specs.
- **No "takeUntilDestroyed last" lint rule** (eslint-plugin work, Fix-now #16's open half).
- **Not fifteen bespoke harnesses**: any driver that cannot be a thin layer over
  `driver-core`/`control-driver` + the shared fakes is escalated, not built.
- **Not migrating all 174 `test-helpers` importers or all 58 query-helper files** — only files an
  item already owns.
- **No `FormSupportStylesComponent`**, stylesheet splits, bundle-size or keyboard-reachability
  work (triage Improvements #1, #4, #7, #8 — separate programmes).

## 6. Risks

1. **T1 is the one change with global reach.** Only `lib/stream/` assigns `.onfinish`/`.oncancel`
   in production, so the expected blast radius is the 7 existing stream cases
   (`pip-manager.spec.ts` ×4, `stream-player-slot.spec.ts` ×3): they were written under a mock
   where exit animations never invoked their handler, and the pip-manager park/strand cases in
   particular may flip once `endExitAnimation` actually runs mid-test. **Coordinator expectation:
   0–7 stream assertions re-pointed in T1's commit, each one listed in the report.** Policy: a
   flipped spec that asserted mock-artifact behaviour is fixed in place; a flip that reveals a
   real production bug stops the item and comes back as a finding.
2. **Double-fire hazard inside T1 itself**: the current mock's constructor microtask always
   dispatches `finish`, even after `cancel()`. Wiring the properties without the settled latch
   would fire `oncancel` then `onfinish` on the same animation — a failure mode no real browser
   has. The latch is part of the item's definition of done.
3. **Prototype-patching fakes leaking across tests** (T2): a missed restore turns unrelated specs
   red non-deterministically. Mandated `onTestFinished` auto-restore + rule-scoped (not blanket)
   patches; if the suite goes flaky after T2, suspect a restore path first.
4. **matchMedia capture ordering** (T3/C3): the breakpoint-observer root provider binds
   `window.matchMedia` at first inject; a fake installed after fixture creation silently does
   nothing and every sheet/breakpoint assertion passes-or-fails for the wrong reason. C3's
   sabotage step exists precisely to prove the fake is load-bearing.
5. **Contract items make green specs red on purpose**: C1's tightening exposes callers whose
   clear case passed vacuously (expected: a handful of the 19); C2's cascader `touched` clause
   fails against a known-open defect and must land as a marked expected failure, not a skip-and-
   forget. Budget review time for these, they are the deliverables working.
6. **D7 trap**: pointing `expectUniformCellsPerRow` at the multi-month calendar lands an
   immediate red against a deliberately-open Medium. The plan forbids it; reviewers should check.
7. **Parallel-agent collisions**: the danger files are `carousel.component.spec.ts` (T2 then D4),
   `table-reorder.directive.spec.ts` (T4 then D5), select/cascader specs (C1 → C2 → C3),
   `forms/testing/` (D11/D12/C-lane — distinct filenames only). The lane ordering above is the
   mitigation; the coordinator must not dispatch two items of one lane concurrently.
8. **Fake-timers pitfall**: any helper that reaches for `vi.useFakeTimers()` to "flush" will pass
   locally and hang on `window.setTimeout`-based code — this repo's fake timers never cover the
   window-bound globals. Helpers use bare globals + `flushFrames`; reviewers should reject
   `useFakeTimers` in the new infra files.

## 7. Dispatch order (recommended)

- **Wave 0 (parallel, immediately)**: T1, T2, T3, T4, T5.
- **Also immediately (no deps, parallel)**: D7, D8, D9, D11, D12, P1, P2, C1 — dispatch as
  capacity allows; D13 last / droppable.
- **As Wave 0 lands**: T2 → D2, D3, D4 · T3 → D1 · T2+T4+T5 → D5 · T1 → D6 · T4 → D10 ·
  C1 → C2 · T3+C2 → C3.
- **Highest-leverage first** if serialized: T1 (unblocks every animation-completion path),
  T5 + T2 (every layout domain), T3, C1, then drivers by value: D2, D3, D6, D5, D1, D4, D10,
  D7, D11, D12, D9, D8, P1, P2, D13.

Work-item count: **23** — 5 infra (T1–T5), 13 domain drivers/coverage (D1–D13, D13 droppable),
3 contracts (C1–C3), 2 standalone spec packs (P1, P2).
