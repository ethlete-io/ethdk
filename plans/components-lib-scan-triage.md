# Components lib scan — triage

Triage date: 2026-08-22. Source: `plans/components-lib-scan.md` (22 batches, 66 High / 148 Medium / 219 Low + per-domain
improvement lists). Items reference findings by **domain + short label**; bodies stay in the scan.
Effort: **S** ≈ half a day, **M** ≈ 1–2 days, **L** ≈ several days. _Fix now_ order: silent data
corruption > crash on documented usage > a11y promise broken at a shipped default > stuck-forever UI

> leak; within a tier, by how ordinary the trigger is. Shared root cause or file ⇒ one change.

## Fix now

### 1. Date/time picker commit contract — one shared core for the two bases · L

The four date-time Highs and one Medium are one behaviour implemented twice, in
`forms/date-time/internals/date-picker-input.directive.ts` and
`internals/date-range-picker-input.directive.ts` (+ the per-control `commitInput`s in
`date-input`, `time-input`, `date-time-input`). Fix as one `createPickerInputCore()`: add the
"nothing was typed" guard where it is missing, reset `parseError` on an erase, make `clearValue()`
reset the mask host, and gate every commit on `interactive()`.
**Why first:** with the shipped `DATE_FORMAT` + `'P'` display default, tabbing through a form silently
destroys the time component of the value that gets submitted.
Resolves: date-time High "unedited focus+blur rewrites the wire value", High "erasing unparseable
text latches parseError", High "clear button vs attached mask", Medium "readonly control still
commits on blur"; realises date-time DX "fold the two abstract bases into one core".

### 2. Container `keydown` handlers that ignore `event.target` · S

`grid/grid-item.component.ts:53` (`applyKeyboardShortcut`) and
`calendar/headless/calendar.directive.ts:690-705` claim every arrow/modifier key that bubbles out of
projected content. Same one-line class of fix (bail when the target is a form field /
contenteditable). While in the grid file, make the move/resize branches mutually exclusive.
Resolves: grid High "Shift+Arrow inside a text field resizes the widget", grid High
"Ctrl/Cmd+Backspace deletes the whole widget" (and persists it), grid Medium "Ctrl+Shift+Arrow moves
_and_ resizes", calendar Low "handleKeydown claims every key with no target check".

### 3. Phone input: character-by-character international entry corrupts the value · M

`forms/phone-input/headless/phone-input-field.directive.ts:36-54` rewrites the element to the
national interpretation mid-entry, so each subsequent keystroke re-prepends the dial code.
Resolves: phone-input High "typing `+…` one character at a time corrupts the value".
Needs the `typeChars()` driver from _Spec-coverage_ #1 to be regression-guarded at all.

### 4. Support-region ids: `aria-describedby` pointing at nothing · M

One root cause — `form-field/headless/form-support.ts` never returns the support ids (nor
`directions`) that `reduceSupportPresentation` already computes — with seven affected templates.
Fix in `form-support.ts` + bind `[id]` in the group/rating/otp/slider/dropzone templates (ideally by
extracting one shared support-region partial). **Why:** the error a required radio group shows on
screen is never spoken — four to seven controls fixed at once.
Resolves: selection-controls High "hint/error/warning under the four group controls is never
announced", otp-input High "`aria-describedby` points at a non-existent element", selection-controls
Medium "the severity-direction half of the state machine is dead for every group"; realises
selection-controls DX "give `injectFormSupport` the ids and directions it already computes".

### 5. Controls that cannot be given an accessible name · L

The same omission repeated across every control that hand-rolls `FormValueControl` instead of
extending `TextFieldControlDirective`: no `aria-label` / `aria-labelledby` inputs and no
`hasCustomAccessibleName`, so a correctly-labelled control throws ET2201 in dev and ships unnamed in
prod. `duration-input` shows the whole pattern.
Resolves: date-time High "six of seven controls cannot be given an accessible name", phone/tag High
"`aria-label` never reaches the native input", cascader Medium "no `aria-label`/`aria-labelledby`",
rich-text-editor High "a required editor never announces `aria-required`", selection-controls High
"`et-segmented-button`'s `aria-labelledby` is a dangling IDREF", selection-controls High
"`<et-description>` inside an option reaches no AT".
Land it as the batch-07 DX item "make these extend `TextFieldControlDirective`" — that single change
also closes phone/otp/tag's missing `hidden`, `warnings`, `maxLength` and `pending`.

### 6. Selection groups: clicking the group caption mutates the form value · S

`selection-list/headless/selection-list.directive.ts:115-125` selects the first option from
`activate()`, and `LabelDirective` calls `activate()` on every caption click. Every sibling
group-shaped control only focuses.
Resolves: selection-controls High "clicking a group's `<et-label>` selects/toggles option one",
selection-controls Medium "the `activate()`/`focus()` split is never used for the group case".
Prefer the DX framing: have `LabelDirective` fall back to `focus()` for group controls, so the next
group-shaped control is safe by default.

### 7. Command palette / overlay Escape, and the strategies reduce crash · M

Two independent overlay-runtime defects worth landing together because both are in the escape/config
resolution path and both are cheap: the capture-phase document `keydown` in
`libs/core/.../overlay-runtime.ts:363-381` ignores `defaultPrevented` (so the palette's
"clear-then-close" is dead code), and `getHighestMatchedStrategy` reduces with no initial value.
Resolves: command-palette High "Escape closes even with a non-empty query" (+ its Low "the Escape
handler is unreachable dead code"), overlay High "an all-breakpoints `strategies` array crashes
`open()`"; the overlay DX item "give `strategies` a base-case type or a dev error" is the durable fix.
Note the palette spec at `command-palette.component.spec.ts:188` asserts the broken behaviour and
must be re-pointed through `injectCommandPalette().open()`.

### 8. Bracket: `swissColors` is an attribute-injection sink, and swiss never renders · M

`drawing/draw-man-swiss.ts:146` / `drawing/path.ts:10` interpolate a public input into an SVG string
that reaches the DOM through `bypassSecurityTrustHtml` — runtime-verified to produce a real `onload`
attribute. Escape/validate at the writers (S), then fix the group lookup so swiss works against real data (M).
It is the only XSS-shaped finding in the scan, and swiss is currently unusable against a real feed.
Resolves: bracket High "`swissColors` interpolated into a `bypassSecurityTrustHtml` string", bracket
High "swiss throws ET3408 for any source with participant ids" (+ Medium "ET3409 only when round
headers are on").

### 9. Tooltip / toggletip: clobbered attributes and snapshot content · S

Three separate one-to-few-line defects in two sibling directives: `syncHostDescription` overwrites a
consumer's `aria-describedby` instead of appending; `etToggletipTrigger` blanket-assigns
`toggletip.disabled`; and both mount content as a captured local instead of the signal.
Resolves: menu-batch High "`[etTooltip]` destroys an existing `aria-describedby`", High
"`etToggletipTrigger` overwrites `etToggletipDisabled`", Medium "content changed while open keeps
rendering the old value"; realises the DX item "make the content bindings reactive".

### 10. Stuck-forever UI states — five unrelated one-liners, one sweep · S

Each has a permanently-wrong end state and a different owner file, so batch them as one "unstick"
change set: `focus-ring.directive.ts` needs a `blur` reset (focus-ring High "stuck
`et-focus-ring--active`", visible today on `et-checkbox`); `toolbar.directive.ts` needs
`stopPropagation` (toolbar High "nested toolbar's arrow keys steal focus outward");
`BreadcrumbSeoDirective` needs `{ optional: true }` + a route to the inner token (breadcrumb High
"`etBreadcrumbSeo` on the outlet throws NG0201"); `picture.component` must not sit in `loading`
forever with `sources` and no `defaultSrc` (picture High); `resolveFilterOverlaySubmitButton` must
distinguish "skipped" from "not started yet" (filter-overlay High "submit stuck on Loading results…").

### 11. Table: two supported configurations that fail silently or crash · M

Both in `table.component.ts`, both documented as supported: a hand-rolled `rowsSource` with `setSort`
but no `sort` leaves the header permanently stuck (never reaching descending), and `restoreState`
throws on a hand-edited stored/linked state that `deserializeTableState` promises to degrade
gracefully. Fix the mirror-write, guard the restore, add the dev error the DX item asks for.
Resolves: table High "partial `rowsSource` stalls sort/filter", High "stored state crashes
`restoreState`".

### 12. Scheduler: an ordinary immutable `appointments` update breaks the edit surface · M

One root cause (an `effect` that opens the surface keyed on object identity, plus a `linkedSignal`
draft sourced from the same array), two user-visible failures. Fix as the scheduler DX item "give the
two effects an explicit imperative API" — `openEditSurface(id)` + an id-keyed guard closes both, plus
the missing "select without opening" capability.
Resolves: scheduler High "immutable update opens a second stacked surface", High "the same update
discards the user's draft".

### 13. Stream: leaving PiP strands the player, and late consent registers the wrong id · M

`pip-manager.ts:183-185` is the one `pipDeactivate` branch that forgets the `animatingOutIds` latch,
so the video disappears from the page for good — reachable through the documented
`{ skipAnimation: true }` _and_ through the default path whenever a rect measures empty (hidden tab).
Ship the DX framing: one exit path with the latch set unconditionally. Pair with passing the live
`playerId` signal into the deferred player creation.
Resolves: stream High "leaving PiP strands the player in the hidden container", stream High "consent
accepted after an id change registers the old id".

### 14. Cascader: out-of-order level responses drop columns; Space stops activating nodes · M

Both in `forms/cascader/headless/cascader.directive.ts`: `setColumn` truncates the tail on every
write (so a slow root drops an already-loaded child column — exactly what `cascaderFromQuery`
produces), and the single-character search branch swallows `' '`. Also clear `path` when the value no
longer matches its tail, so the trigger stops showing a stale breadcrumb for a new value.
Resolves: cascader High ×3 — "out-of-order level responses destroy the deeper columns", "Space types
into the search box instead of activating the node", "single mode keeps the previous value's
breadcrumb".

### 15. Tabs: insertion order vs template index desync · S

`tab-bar.directive.ts:82-84` registers triggers in creation order while everything else indexes by
`$index`, so inserting a tab anywhere but the end permanently mismatches `aria-selected`, the roving
tab stop, `aria-labelledby` and the visible panel. Fix per the DX item: reuse `sortByDomOrder`, which
masonry and the accordion already use for this. (The durable fix — the Features item "key selection
off tab identity, not an index" — is _Improvements_ material; do the sort first.)
Resolves: tabs High "a tab inserted before the selected one desyncs selection from the panel".

### 16. Gesture and stream teardown leaks · S

Three instances of one shape: `etTableReorder`'s edge-auto-scroll `rAF` loop has no destroy hook and
re-queues forever on a detached table (table High); `ScrollableNavigationComponent` puts
`takeUntilDestroyed()` _first_ in a pipe that `switchMap`s into `fromEvent`, so the scroll listener
outlives the component (scrollable High); three `timer(...).subscribe()` calls in
`pip-window-position.ts` have no teardown (stream Medium). Add the lint rule the carousel/scrollable
batch suggests ("`takeUntilDestroyed` last") rather than only fixing the instances.

### 17. `[warnings]` is a hard NG0303 on every text control but `et-input` · S

The base declares it; three of four `hostDirectives` input lists dropped it.
Resolves: form-field High "`[warnings]` only exists on `et-input`". Land with the DX fix that
prevents recurrence — export `TEXT_FIELD_CONTROL_INPUTS` and spread it — plus the one-loop spec from
_Spec-coverage_ #3.

## Fix soon

Real defects, but each is narrower: a rarer configuration, a cosmetic-only consequence, or a
single-domain reach.

- **Menu `autoFocus` does nothing on a programmatic open** — an open menu with no keyboard entry
  point (menu High). Fix with the DX item "`show({ focus })` instead of overloading `openSource`". S
- **Notification pause/resume is not ref-counted** — a focused toast dismisses itself on
  `mouseleave`; a click on a hovered toast re-arms it (notification High ×2). Fix as the Features item
  "a pause _reason_ set on the ref". Note `notification.component.spec.ts:93-101` locks in the bug. S
- **Carousel, three Highs, one PR:** `playOnInit="false"` read in the constructor; the loop alignment
  latch consumed by a failed measurement (opens on a clone forever); play/pause ARIA contradicting the
  rendered icon whenever autoplay is paused for any reason but `stop()` — permanent under reduced
  motion. The first two need the `fakeLayout` helper to guard. M
- **Calendar: both shipped range strategies band an untouched calendar** (calendar High) and
  **`minuteStep="0"` throws `RangeError` inside a computed** (time-picker High). Fix the second with
  one shared `positiveIntegerAttribute`, per the calendar DX item. S each
- **`[etScrollableActiveChild]` registers nothing** — a documented, story-demonstrated,
  recipe-endorsed directive that does not exist at runtime (scrollable High). Wire it, or delete it
  plus three doc pages. M
- **Masonry never reveals items whose border box exceeds the assigned width** (no global
  border-box reset) and **`items()` goes stale on a DOM reorder** (grid batch High ×2). S / M
- **Tree: collapsing a branch programmatically drops focus to `<body>`** (tree High). S
- **Bracket: a pinned journey breaks on any `source` change** — the whole bracket dims with nothing
  highlighted (bracket High). M
- **Grid items are focusable with `outline: none` and no replacement** (grid High), and **the chip
  docs' own quick-start is keyboard-unremovable** (chip High). S each
- **Pagination: `hidePreviousNext` ignored in compact mode; static `id` on the jump input; a
  documented 44px coarse-pointer target that no rule implements** (pagination High ×3). S
- **Split button silently accepts a second action and can end up with none** (button Medium). S
- **`et-otp-input`: a `g`-flagged charset drops every other character; shrinking `length` leaves an
  over-long value; `complete` never fires for a programmatic value** (otp Medium ×3). S
- **Tag input: `removeLast()` on an empty value emits a new array**, writing spuriously into the form
  model on a no-op keystroke; **paste discards the pending text**; **a full input holding rejected
  text is a keyboard dead end** (tag-input Medium ×3). S / M
- **`phone-input` `defaultCountry` applies only on the first computation** — a geo/locale default
  that resolves late never lands (phone Medium). S
- **Table: `etTableCsvExport` config makes every later `export({ file })` throw ET3507**; **a
  cancelled resize leaves a width override**; **selection/expansion state writes
  `"[object Object]"` without a `rowKey`** (table Medium ×3). S each
- **Overlay: container elevation ignores the strategy's `hasBackdrop`; `documentClass`/`bodyClass`
  are not ref-counted; a destroyed query-param opener orphans an open overlay** (overlay Medium ×3).
  Fix the first two via the DX item "one `resolveHasBackdrop`, one `resolveOrigin`". S / M
- **ARIA structure claims that do not hold — `role="grid"`/`tablist` with unowned or nested children**
  in calendar (High), scheduler (High: no `grid` owner at all), table page-sticky (Medium) and tabs
  (Medium). One shape, four domains; cheap (`role="presentation"` on layout wrappers) but needs the
  a11y-tree assertions from _Spec-coverage_ #6 or it regresses. M
- **`et-color-input` never reports `expanded`**, so the field drops its open-popup styling
  (color-input Medium); **the picker's thumbs use logical offsets against physical gradients**, so it
  is wrong in RTL (color-input High). S / M
- **Dropzone: single-mode replace never fires the configured `delete`** (orphaned server file);
  **`clear()` ignores `disabled`/`readonly`**; **`DROPZONE_LABELS.uploading` is never read** (dropzone
  High + Medium ×2). S each
- **Slider: a tick press does not commit the tick's value without `snapToMarks`** (slider High) —
  documented as always doing so. S
- **RTE: `pruneEmptyInline` skips `u`/`code`**, leaking raw HTML into the Markdown value (rte High);
  **the trigger popup opens before an existing trigger char and leaves the literal text** (rte High);
  **tools commit without a history boundary**, so the next keystroke swallows them (rte Medium). S / M
- **Smaller singletons:** the copy-button subscription is not lifecycle-bound (dev warning only);
  `maxVisible: 0` shows every notification instead of none; the standings overlapping-zones guard only
  ever checks the first render. S each

## Improvements worth scheduling

Deduplicated across all 22 batches; several batches independently proposed the same work.

1. **One `FormSupportStylesComponent` + one support-region partial.** The ~90-line support block
   (`@property`s, error/warning/hint, `[data-can-animate]`, reduced-motion) is duplicated near-verbatim
   in checkbox-group, radio-group, segmented-button-group, rating, choice-field, slider, dropzone and
   otp — eight-plus copies, and the drift is what produced _Fix now_ #4 and the missing exit animation.
   Proposed independently by the selection-controls, slider/dropzone/color and phone/otp/tag batches. L
2. **Cross-domain test drivers.** Twelve batches ask for one: overlay (plain dialogs/openers, not just
   overlay-backed form controls), table, bracket, scheduler, stream, carousel/scrollable/scrollbar,
   calendar/time-picker, grid/masonry, tabs, notification, RTE, `et-input`/`et-form-field`,
   duration-input, choice-field/segmented-button, match/standings. One programme over
   `testing/driver-core.ts` with the shared fakes below — not fifteen bespoke harnesses. L
3. **Shared jsdom test infrastructure.** `FakeMatchMedia` (currently a 40-line copy inside
   `overlay-strategy-controller.spec.ts`), a `fakeLayout()` helper (the carousel/scrollable batch calls
   it the highest-leverage single piece), the `ResizeObserver`/`IntersectionObserver`/`clientWidth`
   shims that six grid/masonry specs and three tab specs each hand-roll, a breakpoint fake (nothing can
   currently test the cascader bottom sheet at all), and **wiring `onfinish`/`oncancel` into
   `test-helpers.ts`'s `AnimationMock`** — a hard prerequisite for testing any animated PiP path. M
4. **Stylesheet splits, ranked by bytes × reach.** Worth doing: `table.component.css` (1166 lines,
   ~40 % minority features — sticky columns is the clean win), `scrollable.component.css` (472, ~half
   opt-in chrome), `menu` (search header + scroll fade), `overlay-container` (arrow + content chrome),
   `select-panel`/`cascader-panel` (async slice, sheet chrome, breadcrumb), the two slider sheets
   (~50 % duplicated), `dropzone`, `calendar` coarse-grid/comparison/week-numbers, `notification`
   position matrix, `scheduler` drag rules, `tree` multiple-mode checkbox, `otp` support block.
   AGENTS.md names `form-field` as next; the table sheet is larger. L
5. **Shared behaviour contracts, next to `mixed-state-contract.ts`.** `describePickerCommitContract`
   (would have caught all four date-time Highs), `describeOverlayControlContract` (would have caught
   the cascader `touched` divergence), an `aria-describedby`-resolves assertion (four to seven
   controls at once), and a "wrapper exposes its base's inputs" loop. Proposed by the date-time,
   select/cascader, selection-controls, form-field and phone/otp/tag batches. M
6. **Duplicated CSS/logic pairs worth collapsing:** tooltip + toggletip + menu animation blocks (three
   copies of one structure), `et-tab-group` vs `et-nav-tabs` (~120 lines), the two date/time range
   shells (byte-identical bar a threshold), `et-pip-player` rules in two sheets, the three stream
   overlay cards, `select`/`cascader` panel animations, the button/fab/icon-button opacity ramps, the
   three class-list normalizers in overlay, the two color parsers in color-input. M
7. **Bundle-size wins, each behind a treeshake golden.** `@defer` the color picker panel; make the
   stream PiP slice opt-in by import graph (~1.5k lines reachable today from one YouTube slot); defer
   the scheduler edit surface (it drags five form-control families into a read-only month grid); pack
   `PHONE_COUNTRIES` and name the six `SELECT_IMPORTS` the phone input actually uses; gate floating-ui's
   `size`/`arrow`/`hide` middleware on the features being on; move RTE opt-in tool icons onto their
   providers. Add goldens for date-time, table imports and the stream barrels — the repo already has a
   measured ~90 kB floor from this exact tuple-of-providers shape. L
8. **Keyboard reachability for pointer-only affordances.** Recurring across domains: overlay
   drag/snap points, PiP move/resize, the select's load-more row, the date/time clear buttons, the
   table header (arrow-key plane), the bracket grid (pin), the scheduler (no model beyond Tab), grid
   items, carousel track, time-picker column-to-column, tag-input chips, cascader panel buttons. Pick
   the ones where the feature is otherwise unreachable (select load-more, PiP, bracket pin,
   time-picker columns) rather than the ones with a documented alternative. L
9. **Missing peer-library staples, ranked.** A confirm/alert dialog primitive (the overlay docs tell
   consumers to hand-write one); `compareWith` on `et-select`; runtime column pinning + multi-sort
   priority + a global quick filter on the table; date-range presets and range-order/min-max
   validators the docs make every consumer copy-paste; business hours + a "now" line on the scheduler;
   an RTE read-only viewer; `Home`/`End` + typeahead on selection groups; select-all on multi
   selects (the machinery exists and is unused). L
10. **Error-message and dev-guard quality pass.** Messages that name an API that does not exist
    (`registerScrollContainer`, `hostDirectives: [StreamPipChromeComponent]`,
    `et-filter-overlay-submit-label`, `exportTableToCsv`, the four-of-six picker host names), guards
    that fire once per element after render instead of once at construction, and the missing duplicate
    registration guards (split button, `etRatingIcon`, range fields). Cheap, and each one currently
    costs somebody a debugging session. M
11. **Comment-policy cleanup where it is dense** (table — 34 % of non-spec TS — plus carousel, grid,
    bracket, calendar, scheduler, selection-controls). Not urgent, except the comments the scan proved
    _wrong_: the table keyboard-nav comment, the cascader column comment, `pruneEmptyInline`'s "three
    inline tags", the control-suffix spec comment. Fix those with whatever change touches the file. M
12. **Docs corrections** (~40 across batches): option tables omitting real inputs (select, cascader,
    date-time, otp, tag, dropzone, slider), token tables missing live tokens, the bracket migration row
    pointing at an unexported symbol, `match.md`'s `NormalizedMatch` snippet, and the pages that state
    the opposite of the code. Part of whichever fix touches the API, per AGENTS.md. M

## Explicitly deprioritized

- **Comment-volume findings in match/standings and table** — the scan itself says these read as a
  uniform, deliberate house style; churning them has no consumer effect.
- **Dead exports and unused public members** (`CascaderNodeSignal`, `TableRowKey`, `GridItemRef`,
  `configComponent`, `YoutubePlayerSlotDirective`, `linked/logging.ts`, `gridDebug`,
  `NavTabsDirective.navigationVersion`, `TabTriggerDirective`, three RTE computeds) — remove
  opportunistically; none of them misbehaves.
- **Unreachable branches and dead guards** (overlay `MISSING_ANIMATION_ORIGIN`, bracket
  `core/round.ts:205`, pagination `widestStatus('range')`, `effectiveDisabled`'s first `??` branch,
  `FORM_FIELD_CONTROL_TYPES.RADIO`/`SEGMENTED_BUTTON`) — cosmetic.
- **Module-level latches flagged by convention** (`factorialCache`, `warnedAboutMissingDateLocale`,
  `BrandLoaderComponent.nextId`, `localReadingIdCounter`) — only `localReadingIdCounter` has a real
  (SSR hydration) consequence, and no SSR harness exists to verify it.
- **Import-path tidiness** (self-referential `'../../forms/<own-dir>/…'` paths in slider, rating,
  dropzone, radio-group, phone-input) and **`text-sm`/`text-xs` in story files emitting nothing** (five
  batches) — lint-fixable noise and story-only; fix in passing.
- **Hardcoded shadow colours** (table, RTE, notification, overlay dividers, scheduler) — the scan
  establishes that shadows-as-literals are the lib-wide convention; only the _non-shadow_ hardcoded
  colours (dropzone preview band, window-control close, grid-debug) are worth touching, and only the
  first two are shipped UI.
- **`aria-grabbed` on grid drag** — deprecated in ARIA 1.1 with no AT support; remove rather than fix,
  and only when the grid domain is next open.
- **Two nested live regions in notification** — the docs present it as the design; needs a real
  screen-reader session to judge, not a code change.
- **Three "real but unreachable in practice" findings:** description-list's
  multiple-`<dd>`-per-`<dt>` grid swap (no example or story uses it — a docs sentence suffices),
  `picture.utils.ts`'s mixed `data:` + URL `srcset` short-circuit (arguably invalid markup, never
  observed), and `kbd` keeping only the last of two non-modifier keys (a hand-authoring typo).

## Spec-coverage priorities

Ranked by (bugs this class of test would have caught) × (cost once the infrastructure exists).

1. **A character-by-character `typeChars()` in `driver-core.ts`.** `typeInField` sets the whole value
   in one event, which is exactly why the phone-input High is invisible to a 261-line suite. Re-run
   the existing phone tests through it. Cheapest highest-value item in the scan.
2. **`aria-describedby` resolution as a shared assertion** (`expectDescribedByResolves`). Would have
   caught otp, rating, slider, dropzone and the three selection groups in one pass, and keeps catching
   the next one.
3. **A "wrapper exposes its base's inputs" loop** over the five text-control components. One test,
   catches the `[warnings]` High and every future recurrence.
4. **The three shared contract suites** — `describePickerCommitContract` (all four date-time Highs),
   `describeOverlayControlContract` (the cascader `touched` divergence, pinning select and cascader to
   one behaviour), and tightening `describeMixedStateContract` so its clear case cannot pass vacuously
   and its two documented-but-unasserted clauses are actually asserted.
5. **Pure functions that hold a confirmed High and need no DOM:** `resolveTriggerMatch` (RTE, ~40
   lines, three-line test), `generateSteppedValues` / the `minuteStep` edges (time-picker),
   `generateBracketRoundSwissGroupMaps` + `createSwissGrid` end to end (bracket), `deserializeTableState`
   → `restoreState` with a junk entry (table), `reduceSupportPresentation`'s 12 state pairs
   (form-field — ~110 shared lines, zero tests), `resolvePath` + direction resolution (overlay router),
   `sortByDomOrder` and `createTypeahead` (internals, five-plus consumers each, no direct spec).
6. **A11y-structure assertions per domain** — walk `grid`→`rowgroup`→`row`→`gridcell` (calendar,
   scheduler, table's two layouts), `menu`→owned roles, `tablist`→`tab`, and a uniform cell count per
   row. Would have caught four Mediums and one High, and guards the docs' explicit claims.
7. **Overlay-mounted specs instead of bare-component specs.** The palette's Escape, its
   `aria-controls`/`aria-expanded` mismatch and its double-open are all invisible to a bare fixture —
   and one existing spec is green on broken behaviour because of it. Same argument for
   `overlay-opener.ts` (282 lines, zero specs, and the API the docs push everyone toward).
8. **"Destroyed mid-gesture" as a shared helper.** Start a gesture, `fixture.destroy()`, assert
   nothing further runs. Pins the table reorder rAF leak plus drag-scroll and resize, and generalises
   to the scrollable/PiP/notification teardown cases; pair it with the "`takeUntilDestroyed` last"
   lint rule.
9. **The largest zero-coverage surfaces, in value order:** `table-reorder.directive.ts` (445 lines,
   holds the confirmed leak), `stream-manager.ts` + `pip-manager.ts` (both Highs live there, both plain
   factories over a fake element), `scheduler.component.ts`'s two overlay-opening effects (both Highs,
   one spec each), the tab-bar keyboard model (96 a11y-critical lines the docs sell in full),
   `notification-swipe-to-dismiss.directive.ts` (279 lines), `floating-action`,
   `filterOverlayPreviewFromQuery`, `multi-language-rich-text-editor`, `skeleton` (last four: no spec
   file at all).
10. **Specs that currently assert the wrong thing** — fix these while fixing their defects:
    `command-palette.component.spec.ts:188` (Escape), `notification.component.spec.ts:93-101`
    (unbalanced pause/resume), `table-page-sticky-header.directive.spec.ts:60-63` (locks in the broken
    grid structure), `masonry.spec.ts:198` (cannot fail), `grid-item.component.spec.ts:143`
    (`toBeGreaterThanOrEqual` passes on no-op) and `:26` plus three others carrying a `version: 1`
    property the type does not have — which means those files are not being type-checked by the vitest
    run at all. That last one is worth chasing on its own.
