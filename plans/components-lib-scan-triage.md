# Components lib scan — triage

Triage date: 2026-08-22. Source: `plans/components-lib-scan.md` (22 batches, 66 High / 148 Medium / 219 Low + per-domain
improvement lists). Items reference findings by **domain + short label**; bodies stay in the scan.
Effort: **S** ≈ half a day, **M** ≈ 1–2 days, **L** ≈ several days. _Fix now_ order: silent data
corruption > crash on documented usage > a11y promise broken at a shipped default > stuck-forever UI

> leak; within a tier, by how ordinary the trigger is. Shared root cause or file ⇒ one change.

## Fix now

### 1. Date/time picker commit contract — one shared core for the two bases · L · **DONE 2026-08-22**

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

Done: `internals/picker-input-commit.ts` (`resolvePickerCommit`) is the one core both bases now
route every commit through - it applies the `interactive()` gate, the "nothing was typed" guard
(which no longer swallows an erase, because `parseError` forces the commit past it) and the
empty/parse-error/success split. The three single controls kept only `parseCommitText()` +
`writeCommitted()`; the range base kept `parseSideCommit()`. `clearValue()`/`clearRange()` call a
new `resetText()` on the field, which blanks the mask host's `value` as well as the element.
Contract kit `forms/testing/picker-commit-contract.ts` runs from all six specs; each of its three
tests was verified to fail without the fix. Still open: the two abstract Angular bases remain
separate classes (the DX item asked to fold them entirely - only the commit logic is shared so
far), and the mask's optional `mixed` member is still unimplemented for this family (date-time
Medium, separate).

### 2. Container `keydown` handlers that ignore `event.target` · S · **DONE 2026-08-22**

`grid/grid-item.component.ts:53` (`applyKeyboardShortcut`) and
`calendar/headless/calendar.directive.ts:690-705` claim every arrow/modifier key that bubbles out of
projected content. Same one-line class of fix (bail when the target is a form field /
contenteditable). While in the grid file, make the move/resize branches mutually exclusive.
Resolves: grid High "Shift+Arrow inside a text field resizes the widget", grid High
"Ctrl/Cmd+Backspace deletes the whole widget" (and persists it), grid Medium "Ctrl+Shift+Arrow moves
_and_ resizes", calendar Low "handleKeydown claims every key with no target check".
Done: `internals/form-input-target.ts` guards both handlers; the grid branches are exclusive now.

### 3. Phone input: character-by-character international entry corrupts the value · M · **DONE 2026-08-22**

`forms/phone-input/headless/phone-input-field.directive.ts:36-54` rewrites the element to the
national interpretation mid-entry, so each subsequent keystroke re-prepends the dial code.
Resolves: phone-input High "typing `+…` one character at a time corrupts the value".
Needs the `typeChars()` driver from _Spec-coverage_ #1 to be regression-guarded at all.

Done: `phone-input-field.directive.ts` no longer rewrites the element while focused - the field
shows what the user typed and normalizes to the grouped national form on blur, so every keystroke
re-reads a faithful record of the entry. `typeChars()` landed in `testing/driver-core.ts` and on
`createFieldControlDriver` (_Spec-coverage_ #1); the existing phone typing tests were re-run
through it and all pass, so no further mid-entry defect is hiding in that domain. The paste test
deliberately stays on the single-event `type()`.

### 4. Support-region ids: `aria-describedby` pointing at nothing · M · **DONE 2026-08-22**

One root cause — `form-field/headless/form-support.ts` never returns the support ids (nor
`directions`) that `reduceSupportPresentation` already computes — with seven affected templates.
Fix in `form-support.ts` + bind `[id]` in the group/rating/otp/slider/dropzone templates (ideally by
extracting one shared support-region partial). **Why:** the error a required radio group shows on
screen is never spoken — four to seven controls fixed at once.
Resolves: selection-controls High "hint/error/warning under the four group controls is never
announced", otp-input High "`aria-describedby` points at a non-existent element", selection-controls
Medium "the severity-direction half of the state machine is dead for every group"; realises
selection-controls DX "give `injectFormSupport` the ids and directions it already computes".

Done (the two Highs): `injectFormSupport` now returns `errorId`/`warningId`/`hintId`, and all eight
templates that render their own support region bind `[id]` (`choice-field` already did). No docs
change - `forms.md:319` already promised this. New shared assertion
`forms/testing/described-by.ts` (`expectDescribedByResolves`, _Spec-coverage_ #2) with
`form-field/support-region-ids.spec.ts` covering all eight in one mount, hint path and error path;
both fail without the `[id]` bindings.

Still open (the Medium, deliberately): `directions` is still not exposed and the eight templates
still bind no `data-direction`/`data-state`. Only `form-field.component.css` has the rules that
animate on them, so binding them elsewhere would be inert markup - making that half live means
adding the enter/leave animation CSS to eight components, which is a design decision, not an id
fix. Note also that `form-field.component.ts` keeps its own copy of the presentation state machine
rather than using `injectFormSupport`; folding the two is what the DX item really asks for.

### 5. Controls that cannot be given an accessible name · L · **DONE 2026-08-22**

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

Done: one new base, `form-field/headless/accessible-name-control.directive.ts`
(`AccessibleNameControlDirective` + the exported `ACCESSIBLE_NAME_INPUTS`, which
`TEXT_FIELD_CONTROL_INPUTS` now spreads), owns `aria-label`/`aria-labelledby`, `labelId` and
`hasCustomAccessibleName`. Fifteen control directives extend it — the two picker bases (six
date/time controls), phone, tag, otp, cascader, rich-text-editor, dropzone, checkbox, switch,
rating — and `text-field-control`, `duration-input`, `selection-list` and `select` dropped their
four copies of the same members for it. Each control now renders the name on the element that
carries its role (picker/phone/tag fields, the otp input, the select + cascader triggers, the
select's inline search, the RTE editable, the dropzone trigger, the checkbox/switch/rating hosts);
the ranges name their existing `role="group"` host and moved `startAriaLabel`/`endAriaLabel` onto
the base so naming both sides counts as a name. Also in scope from the Resolves list: the RTE
editable binds `aria-required`, `et-segmented-button` renders the label span its `aria-labelledby`
names, and `et-description` gets an id that an option binds as `aria-describedby`. Contract kit
`forms/testing/accessible-name.ts` (`describeAccessibleNameContract` + `resolveAccessibleName`) runs
21 controls × 2 from `form-field/accessible-name.spec.ts`; `selection-list/option-aria.spec.ts` and
`rich-text-editor/rich-text-editor.component.spec.ts` cover the other three. All were verified to
fail without the fix.

Still open on purpose: the slider and range slider (their name lives per thumb via
`etSliderThumb label`, which already satisfies the guard, and a control-level name has no element to
land on); `et-multi-language-rich-text-editor` (its directive is not a `FormFieldControl` — the
inner editor registers, so forwarding a name needs a wrapper input, not this base); and the rest of
the batch-07 DX item — phone/otp/tag still hand-roll `hidden`, `warnings`, `maxLength` and
`pending`, since folding them into `TextFieldControlDirective` means re-parenting three controls
with their own `shouldDisplayError`/`focus` semantics, not adding a naming base.

### 6. Selection groups: clicking the group caption mutates the form value · S · **DONE 2026-08-22**

`selection-list/headless/selection-list.directive.ts:115-125` selects the first option from
`activate()`, and `LabelDirective` calls `activate()` on every caption click. Every sibling
group-shaped control only focuses.
Resolves: selection-controls High "clicking a group's `<et-label>` selects/toggles option one",
selection-controls Medium "the `activate()`/`focus()` split is never used for the group case".
Prefer the DX framing: have `LabelDirective` fall back to `focus()` for group controls, so the next
group-shaped control is safe by default.
Done: `SelectionListDirective.activate()` now delegates to `focus()`, matching every sibling group
control. The label-level "safe by default" fallback would need a group marker on the control
contract - left for the _Improvements_ contract work.

### 7. Command palette / overlay Escape, and the strategies reduce crash · M · **DONE 2026-08-22**

Two independent overlay-runtime defects worth landing together because both are in the escape/config
resolution path and both are cheap: the capture-phase document `keydown` in
`libs/core/.../overlay-runtime.ts:363-381` ignores `defaultPrevented` (so the palette's
"clear-then-close" is dead code), and `getHighestMatchedStrategy` reduces with no initial value.
Resolves: command-palette High "Escape closes even with a non-empty query" (+ its Low "the Escape
handler is unreachable dead code"), overlay High "an all-breakpoints `strategies` array crashes
`open()`"; the overlay DX item "give `strategies` a base-case type or a dev error" is the durable fix.
Note the palette spec at `command-palette.component.spec.ts:188` asserts the broken behaviour and
must be re-pointed through `injectCommandPalette().open()`.
Done: the runtime's document `keydown` moved to the bubble phase and now skips `defaultPrevented`,
so the palette's existing clear-then-close works; the old palette spec was replaced by two specs that
open through `injectCommandPalette().open()`. `getHighestMatchedStrategy` seeds its reduce with the
smallest entry (plus a dev-mode warning naming the missing base entry) and an empty `strategies`
array now throws `ET1210` instead of a bare `TypeError`. Left open on purpose: the DX proposal to
change the public shape to `{ base, breakpoints? }` - it is a breaking API change and the fallback
plus warning already closes the crash; and the shortcut directive's "second palette on `mod+k`"
High, which is a separate defect in `command-palette-shortcut.directive.ts`.

### 8. Bracket: `swissColors` is an attribute-injection sink, and swiss never renders · M · **DONE 2026-08-22**

`drawing/draw-man-swiss.ts:146` / `drawing/path.ts:10` interpolate a public input into an SVG string
that reaches the DOM through `bypassSecurityTrustHtml` — runtime-verified to produce a real `onload`
attribute. Escape/validate at the writers (S), then fix the group lookup so swiss works against real data (M).
It is the only XSS-shaped finding in the scan, and swiss is currently unusable against a real feed.
Resolves: bracket High "`swissColors` interpolated into a `bypassSecurityTrustHtml` string", bracket
High "swiss throws ET3408 for any source with participant ids" (+ Medium "ET3409 only when round
headers are on").
Done: a new `escapeSvgAttributeValue` runs on every colour written by `path()`, the group border rect
and the gradient stops; the group lookup subtracts the current match's own result, so a match lands in
the record its participants entered the round with; and a round's theoretically-available groups that
end up with no match are dropped, which makes `ET3409` unreachable and the header/no-header paths
identical. New `swiss.spec.ts` covers grouping, both header modes and the escaping. Left open on
purpose: the Medium "swiss elimination flags fire one loss early" (`isEliminationMatch = lossesTilNow >= 2`)
and the DX ask for a better `ET3408` message — both are separate findings and the flags are public data
nothing reads, so changing them is its own change.

### 9. Tooltip / toggletip: clobbered attributes and snapshot content · S · **DONE 2026-08-22**

Three separate one-to-few-line defects in two sibling directives: `syncHostDescription` overwrites a
consumer's `aria-describedby` instead of appending; `etToggletipTrigger` blanket-assigns
`toggletip.disabled`; and both mount content as a captured local instead of the signal.
Resolves: menu-batch High "`[etTooltip]` destroys an existing `aria-describedby`", High
"`etToggletipTrigger` overwrites `etToggletipDisabled`", Medium "content changed while open keeps
rendering the old value"; realises the DX item "make the content bindings reactive".
Done: describedby appends via a tracked applied id; the trigger writes an internal `triggerInactive`
signal that composes with `disabled`; the content bindings read the signal. Still open from the
content Medium: the toggletip's `ariaLabel`/`ariaLabelledBy`/`ariaDescribedBy` overlay config is
read once at mount and cannot refresh.

### 10. Stuck-forever UI states — five unrelated one-liners, one sweep · S · **DONE 2026-08-22**

Each has a permanently-wrong end state and a different owner file, so batch them as one "unstick"
change set: `focus-ring.directive.ts` needs a `blur` reset (focus-ring High "stuck
`et-focus-ring--active`", visible today on `et-checkbox`); `toolbar.directive.ts` needs
`stopPropagation` (toolbar High "nested toolbar's arrow keys steal focus outward");
`BreadcrumbSeoDirective` needs `{ optional: true }` + a route to the inner token (breadcrumb High
"`etBreadcrumbSeo` on the outlet throws NG0201"); `picture.component` must not sit in `loading`
forever with `sources` and no `defaultSrc` (picture High); `resolveFilterOverlaySubmitButton` must
distinguish "skipped" from "not started yet" (filter-overlay High "submit stuck on Loading results…").
Done: all five landed, each with a pinning spec; the SEO directive falls back to the breadcrumb
manager and a new ET3702 dev error names the misuse. The submit resolver treats a null count with
nothing in flight as submittable (the old spec asserted the stuck state and was re-pointed).

### 11. Table: two supported configurations that fail silently or crash · M · **DONE 2026-08-22**

Both in `table.component.ts`, both documented as supported: a hand-rolled `rowsSource` with `setSort`
but no `sort` leaves the header permanently stuck (never reaching descending), and `restoreState`
throws on a hand-edited stored/linked state that `deserializeTableState` promises to degrade
gracefully. Fix the mirror-write, guard the restore, add the dev error the DX item asks for.
Resolves: table High "partial `rowsSource` stalls sort/filter", High "stored state crashes
`restoreState`".

Done: `applySort`/`setFilterValues` now call the source's setter _and_ write the table's own signal
unless the source publishes the matching one, so a setter-only source cycles a header normally. A new
`isRestorableTableState` (in `table-state-url.ts`) validates every column entry; `deserializeTableState`
and `restoreState` both apply it, so a hand-edited stored state or link degrades to "no restore".
New dev error ET3510 fires when a source publishes `sort`/`filters` without its setter _and_ a column
declares the matching control. Deliberately left open: the DX item's other half - narrowing
`TableRowsSource` so the pair is expressible in the type - would be a breaking type change, and no
error fires for the now-working setter-only shape, which would be user-hostile boilerplate.

### 12. Scheduler: an ordinary immutable `appointments` update breaks the edit surface · M · **DONE 2026-08-22**

One root cause (an `effect` that opens the surface keyed on object identity, plus a `linkedSignal`
draft sourced from the same array), two user-visible failures. Fix as the scheduler DX item "give the
two effects an explicit imperative API" — `openEditSurface(id)` + an id-keyed guard closes both, plus
the missing "select without opening" capability.
Resolves: scheduler High "immutable update opens a second stacked surface", High "the same update
discards the user's draft".

Done: `scheduler.component.ts` keeps a `handledSelectionId` and the auto-open effect compares that
id against `selectedAppointment().id`, so a fresh `Appointment` object for the same selection no
longer re-opens. The private opener became public `openEditSurface(id)`, joined by
`closeEditSurface()` (holds the `OverlayRef`) and `selectAppointment(id)`, which arms the same guard
to give the missing "select without opening" capability. In the headless directive `draft` is now
`linkedSignal({ source: currentAppointmentId, computation: untracked(currentAppointment) })`, so it
resets on navigation only - a background `appointments` replacement leaves the user's typing alone.
New `scheduler.component.spec.ts` (5 cases, the first for this file) plus one case in
`scheduler-edit-surface.directive.spec.ts`; both were verified to fail with the fix backed out (the
stacked-surface case reproduces the scan's `2`). Docs: edit-surface section gained the method table
and the "keyed on the selected id" note; the navigation section now says navigating is the only
thing that resets the draft. Still open: no shared contract kit - the identity-keyed-reset defect
class has only this one occurrence today, so a kit would have a single caller; and the auto-open on
`selectedAppointmentId` stays the documented default rather than becoming an opt-in input, which
would be an API change rather than a fix.

### 13. Stream: leaving PiP strands the player, and late consent registers the wrong id · M · **DONE 2026-08-22**

`pip-manager.ts:183-185` is the one `pipDeactivate` branch that forgets the `animatingOutIds` latch,
so the video disappears from the page for good — reachable through the documented
`{ skipAnimation: true }` _and_ through the default path whenever a rect measures empty (hidden tab).
Ship the DX framing: one exit path with the latch set unconditionally. Pair with passing the live
`playerId` signal into the deferred player creation.
Resolves: stream High "leaving PiP strands the player in the hidden container", stream High "consent
accepted after an id change registers the old id".

Done: `pip-manager.ts` funnels all three `pipDeactivate` branches through one `endPip()` (empty
`pips` + clear `isInPip`) and one `beginExitAnimation()` that returns its own clearer, so a branch
can no longer forget half the bookkeeping. The `animatingOutIds` mirror set is gone:
`parkPlayerElement` now refuses whenever the player has already left PiP (`isPlayerInPip`), which
covers the plain branch, `{ skipAnimation: true }` and the empty-rect/hidden-tab default alike, and
cannot get stuck set. `stream-player-slot.ts`'s `createAndRegisterPlayer()` reads
`options.playerId()` at call time instead of taking a captured string, fixing both the
`consentComponent` and the bare-`ConsentHandler` path. New `pip-manager.spec.ts` (4 cases) and
`stream-player-slot.spec.ts` (3 cases); the two strand cases and the two consent cases were each
verified to fail with the respective fix backed out. Docs: the consent section gained the
"rebinding while the gate is up" guarantee; the PiP section already described the fixed behaviour.
Still open: no stream test driver (DX #3) - the two specs hand-roll their fakes, and one shared
driver only pays off once the rest of the domain's spec-coverage table is attempted; the missing
`.et-stream-manager` / PiP-window CSS (the other stream High) is a separate shipping-decision item,
not a bug fix; and `anim.onfinish` still never fires under the jsdom animation mock, so the
scaleFadeIn latch clears only in a real browser - fixing the shared mock would touch every
animation spec in the lib and belongs with the "destroyed mid-gesture" helper from item #16.

### 14. Cascader: out-of-order level responses drop columns; Space stops activating nodes · M · **DONE 2026-08-22**

Both in `forms/cascader/headless/cascader.directive.ts`: `setColumn` truncates the tail on every
write (so a slow root drops an already-loaded child column — exactly what `cascaderFromQuery`
produces), and the single-character search branch swallows `' '`. Also clear `path` when the value no
longer matches its tail, so the trigger stops showing a stale breadcrumb for a new value.
Resolves: cascader High ×3 — "out-of-order level responses destroy the deeper columns", "Space types
into the search box instead of activating the node", "single mode keeps the previous value's
breadcrumb".
Done: `setColumn` writes in place (`truncateColumns` stays the only truncation), the node keydown
handler exempts `' '` from the single-character search/typeahead routing, and the value effect drops
`path` whenever the value stops matching its tail. Left open: the medium/low cascader findings from
the same section (premature `touched` on open, the missing `aria-label`/`ariaLabelledby` inputs, the
`minQueryLength` "No matches" row, the dead `CascaderNodeSignal` export) — separate defects with
their own API surface, not part of this item.

### 15. Tabs: insertion order vs template index desync · S · **DONE 2026-08-22**

`tab-bar.directive.ts:82-84` registers triggers in creation order while everything else indexes by
`$index`, so inserting a tab anywhere but the end permanently mismatches `aria-selected`, the roving
tab stop, `aria-labelledby` and the visible panel. Fix per the DX item: reuse `sortByDomOrder`, which
masonry and the accordion already use for this. (The durable fix — the Features item "key selection
off tab identity, not an index" — is _Improvements_ material; do the sort first.)
Resolves: tabs High "a tab inserted before the selected one desyncs selection from the panel".
Done: `triggers` is a `sortByDomOrder` computed over the raw registrations, mirroring masonry.

### 16. Gesture and stream teardown leaks · S · **DONE 2026-08-22** (instances only)

Three instances of one shape: `etTableReorder`'s edge-auto-scroll `rAF` loop has no destroy hook and
re-queues forever on a detached table (table High); `ScrollableNavigationComponent` puts
`takeUntilDestroyed()` _first_ in a pipe that `switchMap`s into `fromEvent`, so the scroll listener
outlives the component (scrollable High); three `timer(...).subscribe()` calls in
`pip-window-position.ts` have no teardown (stream Medium). Add the lint rule the carousel/scrollable
batch suggests ("`takeUntilDestroyed` last") rather than only fixing the instances.
Done: the three instances are fixed. Still open: the "`takeUntilDestroyed` last" lint rule
(eslint-plugin work) and the shared "destroyed mid-gesture" spec helper from _Spec-coverage_ #8.

### 17. `[warnings]` is a hard NG0303 on every text control but `et-input` · S · **DONE 2026-08-22**

The base declares it; three of four `hostDirectives` input lists dropped it.
Resolves: form-field High "`[warnings]` only exists on `et-input`". Land with the DX fix that
prevents recurrence — export `TEXT_FIELD_CONTROL_INPUTS` and spread it — plus the one-loop spec from
_Spec-coverage_ #3.
Done: the five shell wrappers (color-input dropped it too) spread the exported list; the loop spec
is `text-field-control-inputs.spec.ts`; the production build statically expands the spread.

## Fix soon

Real defects, but each is narrower: a rarer configuration, a cosmetic-only consequence, or a
single-domain reach.

- **Menu `autoFocus` does nothing on a programmatic open** — an open menu with no keyboard entry
  point (menu High). Fix with the DX item "`show({ focus })` instead of overloading `openSource`". S
  — **DONE 2026-08-22**

  Done: `show()`, `toggle()` and `openAt()` now take one `MenuShowOptions` object (`{ source, focus }`)
  instead of positional `(source, initialFocus)`, and `applyInitialFocus` no longer reads `openSource`
  at all: focus is `options.focus ?? (source === 'hover' ? false : autoFocus())`. So `show()`, a write
  to `[(open)]` and a trigger click all focus the same way, hover-opened submenus still keep their
  hands off focus, and `focus: false | 'first' | 'last'` says what it means per call. Breaking:
  the positional signatures are gone (no call sites in `ea-frontend`). Left open on purpose: the
  scan's related Medium — "a panel with `autoFocus` off should still stay focusable" — is a separate
  question about the panel's `tabindex`, not about who decides to focus.

- **Notification pause/resume is not ref-counted** — a focused toast dismisses itself on
  `mouseleave`; a click on a hovered toast re-arms it (notification High ×2). Fix as the Features item
  "a pause _reason_ set on the ref". Note `notification.component.spec.ts:93-101` locks in the bug. S
  — **DONE 2026-08-22**

  Done: `pauseTimer(reason)` / `resumeTimer(reason)` keep a `Set<NotificationPauseReason>` on the ref
  (`'hover' | 'focus' | 'gesture' | 'api' | (string & {})`, the shape
  `CarouselAutoplayPauseReason` set), and the countdown only restarts once the set is empty. The
  component's four host listeners pass `'hover'`/`'focus'`, the swipe directive passes `'gesture'`.
  `startTimer` also respects the set now, so `update()` under the pointer re-arms the duration without
  un-holding it. The old spec that asserted `pauseTimerCalls === 2 && resumeTimerCalls === 2` is gone;
  it is now a reason-wiring test plus four behavioural ones, three of which fail without the fix.
  Not breaking - the reason is optional and defaults to `'api'`. Left open on purpose: `focusout`
  still fires when focus merely moves between two elements _inside_ the toast, so the hold is dropped
  and retaken within the same tick (harmless - `Date.now()` has not moved - but a `relatedTarget`
  check would be the honest fix, and that is a separate change to the component's listeners). Also
  untouched: the notification Medium `maxVisible: 0`, and the swipe directive's zero test coverage.

- **Carousel, three Highs, one PR:** `playOnInit="false"` read in the constructor; the loop alignment
  latch consumed by a failed measurement (opens on a clone forever); play/pause ARIA contradicting the
  rendered icon whenever autoplay is paused for any reason but `stop()` — permanent under reduced
  motion. The first two need the `fakeLayout` helper to guard. M — **DONE 2026-08-22**

  Done: `isStopped` is a `linkedSignal` off `playOnInit` instead of a constructor read, so the binding
  is honoured whenever it arrives. `carousel-loop.ts` latches `alignedShape` only after a successful
  `scrollTo` and tracks the container's `scrollableDimensions()`, which is what brings the effect back
  when a carousel inside a hidden tab panel or a collapsed accordion finally gets layout (the latch
  move alone is not enough — nothing else that effect reads changes then). `CarouselPlayToggle`'s
  `isPlaying` is now `autoplay.isPlaying()`, and `CarouselAutoplayDirective.toggle()` follows the same
  signal, so the icon, the label, `aria-pressed` and what pressing the button does all agree. A local
  `fakeLayout()` plus a fireable ResizeObserver live in `carousel.component.spec.ts`; all four
  assertions were verified to fail without their fix.

  Left open deliberately: the helpers stayed local rather than going into `test-helpers.ts` — the
  shared fakes are _Spec-coverage_ #3, a programme of their own. `pauseOnHover`/`pauseOnFocus`/
  `pauseOnOffScreen` are still missing from the docs input table (carousel Low, separate finding);
  only `playOnInit` was added, since only its behaviour changed. Nothing surfaces `pauseReason()` on
  the host yet (carousel UI/UX #2), so a reduced-motion reader still gets a control that is honest but
  inert.

- **Calendar: both shipped range strategies band an untouched calendar** (calendar High) and
  **`minuteStep="0"` throws `RangeError` inside a computed** (time-picker High). Fix the second with
  one shared `positiveIntegerAttribute`, per the calendar DX item. S each — **DONE 2026-08-22**
  (`minuteStep` half only). `internals/number-attributes.ts` holds the shared
  `positiveIntegerAttribute`; `TimePickerDirective.minuteStep`/`secondStep`, the same pair on the
  four date-time wrapper components, and `CalendarDirective.monthsShown` (whose inline clamp it
  replaces) all use it, so `0`, a negative, a fraction and `NaN` all land on `1`. **Both halves DONE
  2026-08-22.** The range-strategy half is a gate on the preview _anchor_, not on the strategies: a
  strategy may band whenever the reader has actually pointed at or keyboard-focused a cell — no pick
  required, since `createFixedLengthRangeStrategy` never has an open endpoint and the week strategy
  bands from the first hover on purpose. `CalendarDirective.focusedGrid` (`@internal`) holds the grid
  DOM focus sits in, claimed on `focusin` and released on `focusout`/destroy by
  `CalendarGridDirective` (whose `focusIsInside` is now a computed over it, so the cell focus-pull and
  the preview read one truth); `previewRange` falls back to `focusedDate()` only while that is set,
  and returns nothing at all outside `selectionView()`, which also kills the phantom band a
  drilled-out coarse grid used to paint. Left open: nothing surfaces "has the reader interacted" as
  public API, and `hoveredDate` is still only cleared by `pointerleave` and a completed pick — a
  programmatic `view.set()` while the pointer rests on a cell keeps the hover anchor alive, which the
  new `selectionView()` check now hides rather than fixes.
- **`[etScrollableActiveChild]` registers nothing** — a documented, story-demonstrated,
  recipe-endorsed directive that does not exist at runtime (scrollable High). Wire it, or delete it
  plus three doc pages. M — **DONE 2026-08-22**. Wired, not deleted: the mechanism was already there
  (`unregisterActiveChild`, `getActiveChildren`, and `signalElementScrollState`'s
  `initialScrollPosition`), so it needed a `registerActiveChild` call and one computed, no new public
  API. The directive registers its ref in DOM order; `ScrollableDirective` feeds the first enabled
  one to the container's `initialScrollPosition`, and holds back offsetless coordinates so the
  one-shot effect isn't spent before the track can scroll. `apps/docs/components/scrollable.md` gains
  an "Active child" section and `sport-recipes.md` links it. Left open on purpose: the scroll stays a
  one-time **initial** position, as in the cdk — making it live would need a re-scroll policy (what
  happens mid-drag, mid-scroll, with mandatory snap) and a public opt-out input, which is a design
  question, not a fix. `disableActiveElementScrolling` was not ported for the same reason: binding
  the marker to `false` covers it without new API.
- **Masonry never reveals items whose border box exceeds the assigned width** (no global
  border-box reset) and **`items()` goes stale on a DOM reorder** (grid batch High ×2). S / M —
  **DONE 2026-08-22**. Reveal: `.et-masonry-item` declares `box-sizing: border-box` (from
  `@layer components`, so it beats an app's `@layer base` reset), and the item's measurement
  handshake no longer depends on it - `isMeasured()` also latches on the first report that arrives
  after the assigned width changed, so a box that can never match one stops bricking the masonry
  instead of leaving a blank block at `opacity: 0` forever. Reorder: `items()` reads a `childList`
  `signalElementMutations` (the only thing that can see a `@for` moving nodes) behind an
  order-equality, and the frozen column assignments now record the reading order they were made for
  and are dropped when it changes, so a re-sorted feed re-packs greedily instead of keeping every
  card in the column it happened to be in. Measured in Chromium: with content-box cards, 0/18 items
  positioned and `isSettled()` false before, 18/18 and settled after; after reversing 18 nodes the
  new first card went from `blockOffset: 2185px` (container height byte-identical at 2727.89px) to
  column 0 / `0px` / 2819.97px. Left open on purpose: the container is still measured with
  `clientWidth`, so horizontal padding on the masonry host still overflows (a separate scan finding,
  and the docs still carry it as a constraint), and the `MutationObserver` is `subtree: true`, which
  costs a signal write on unrelated DOM churn inside cards - the order equality keeps it from
  re-laying out, but a narrower observer would need items to be direct children, which nothing
  enforces.
- **Tree: collapsing a branch programmatically drops focus to `<body>`** (tree High). S —
  **DONE 2026-08-22**. `TreeDirective` snapshots the focused row's `path` (written by `focusNode()`
  and the row's `focusin`), so `collapse()`/`collapseAll()` hand focus to the nearest surviving
  ancestor before the rows below are destroyed, and `activeNode()` falls back to that ancestor
  instead of `rows[0]` for any path - including an outside `[(expandedValues)]` write. DOM focus
  only moves when the tree held it. Left open: an outside write cannot restore DOM focus (the row is
  already gone by the time we could react), only the tab stop; that would need an effect and was out
  of scope for an S.
- **Bracket: a pinned journey breaks on any `source` change** — the whole bracket dims with nothing
  highlighted (bracket High). M — **DONE 2026-08-22**. The highlight holds the pin as an _id_ and
  resolves it per render, so an id no source knows yet marks (and dims) nothing and lights up on its
  own once a source containing it arrives; the component re-applies the marks from an
  `afterRenderEffect` keyed on `bracketGrid()` (an `effect` runs before the view refresh and marked
  the old grid), and that path always clears before re-marking, so cells re-used by `@for` cannot
  keep a mark for a match they no longer hold. Left open: the controller is still torn down and
  rebuilt on any `settings()` change (it reads the whole computed for one boolean) - wasteful but
  harmless, and the rebuild is what keeps the connector paths marked through a layout change, so
  narrowing it needs its own change. Docs: the "Participant focus" section now states what a pin
  does across a source change.
- **Grid items are focusable with `outline: none` and no replacement** (grid High), and **the chip
  docs' own quick-start is keyboard-unremovable** (chip High). S each — **DONE 2026-08-22**. The grid
  item keeps `outline: none` for a pointer press but draws a `:focus-visible` ring
  (`--et-theme-color-primary-solid`, inset 2px); verified headlessly: `solid 2px rgb(0, 255, 161)`
  at `offset=-2px` on keyboard focus, `outline: none` and `:focus-visible` false after a pointer-only
  click. `ChipRemoveDirective` stops hardcoding `tabindex="-1"`: a `<button>` remove control keeps its
  natural tab order (any other host gets `0`), drops to `-1` while the chip is disabled or not
  removable, and drops to `-1` wherever a widget provides the new `CHIP_REMOVE_TAB_STOP` as `false` —
  which `et-select` and `et-tag-input` now do, so their chips stay out of the tab order. The remove
  button also gained a `:focus-visible` ring. Driving the docs' own quick-start story: Tab lands on
  the remove button (ring shown), Enter removes the chip (4 → 3). Left open: the chip **host** still
  never becomes a tab stop, so `Backspace`/`Delete` on the chip itself remains programmatic-focus-only.
  Making the host focusable would collide with `etSelectionOption`'s roving tabindex on filter chips
  and doubles the tab stops per chip, which is a design call rather than an S; the docs now state that
  limit. `.et-grid-item` styles are also still unlayered inline `styles`, so a consumer rule at equal
  specificity (e.g. ea-frontend's edit-mode dotted outline) can still beat the ring; wrapping that
  sheet in `@layer components` touches every grid rule and is its own item.
- **Pagination: `hidePreviousNext` ignored in compact mode; static `id` on the jump input; a
  documented 44px coarse-pointer target that no rule implements** (pagination High ×3). S —
  **DONE 2026-08-22**. `compactControls()` forwards `hidePreviousNext` to `paginate()`, so the compact
  pager collapses to its readout alone; the jump input takes a `createComponentId()` id that both the
  `<label for>` and the `[id]` bind to; a `@media (pointer: coarse)` rule raises
  `--et-pagination-item-size` to 44px (and `--et-page-size-select-height` with it, so the two stay
  level), held at `:where()` zero specificity so the `sm` and compact rules still win. Verified in
  headless Chromium with `hasTouch`: 36→44px on the default density, 34px unchanged when compact.
  Left open: the compact pager (34px) and `size="sm"` (28px) still sit below 44px on touch. Both
  floors are deliberate - the compact chevrons exist to sit level with a small page-size select, and
  `sm` is documented as below the comfortable touch size - so raising them is a design call, not this
  fix; the docs now state the carve-out instead of promising 44px everywhere.
- **Split button silently accepts a second action and can end up with none** (button Medium). S —
  **DONE 2026-08-22**. `SplitButtonDirective` keeps a list per segment kind, so `registeredAction`/
  `registeredTrigger` resolve to the first registration and survive the removal of a duplicate; the
  existing `afterNextRender` dev check now also throws `ET2304`/`ET2305` on more than one. Both
  signals turned from writable into computeds - the sub-directives call the new `@internal`
  `registerAction`/`registerTrigger`. Left open: the same clobbering shape exists in the shared
  `registerSingleton` helper (select/cascader/date-picker triggers); changing that reaches ten
  domains and is its own item.
- **`et-otp-input`: a `g`-flagged charset drops every other character; shrinking `length` leaves an
  over-long value; `complete` never fires for a programmatic value** (otp Medium ×3). S —
  **DONE 2026-08-22**. `charPattern` strips `g`/`y` off a consumer's RegExp, and one constructor
  effect now owns both re-sanitizing `value` against the current `length`/`charset` and emitting
  `complete`, so the `input` handler is no longer the only path that can complete. Left open: a
  runtime `length` shrink that lands the value exactly on the new length emits `complete` (it did
  reach the full length) — suppressing that needs a "who wrote this" distinction the model signal
  does not carry, and `length` rarely changes after mount. The caret/`data-readonly`/`hidden`
  items from the same batch are separate entries.
- **Tag input: `removeLast()` on an empty value emits a new array**, writing spuriously into the form
  model on a no-op keystroke; **paste discards the pending text**; **a full input holding rejected
  text is a keyboard dead end** (tag-input Medium ×3). S / M — **DONE 2026-08-22**. `removeAt` now
  returns early for an out-of-range index (so the model keeps the same array identity), `handlePaste`
  splices the clipboard text into the field's pending text at the caret before splitting, and the
  field's `readOnly` is `isFull() && !pendingText()` — a full field holding text stays editable and
  locks again once emptied. Left open: `select-search.directive.ts`'s `handlePaste` has the identical
  discard-the-query bug for `allowCustomValues` multi-selects (its own finding, and the query lives
  in a signal there, so it is a different edit); the chips are still not keyboard-reachable, which is
  the roving-tabindex enhancement, not this fix.
- **`phone-input` `defaultCountry` applies only on the first computation** — a geo/locale default
  that resolves late never lands (phone Medium). S — **DONE 2026-08-22**. `country`'s `linkedSignal`
  now carries `defaultCountry` in its _source_, so a change re-runs the computation, and the new
  default is adopted only while the previous value still equals the previous default — a country the
  user picked or one derived from the value survives. Left open: a manual pick of exactly the current
  default is indistinguishable from the untouched default, so it would be overwritten by a later one;
  telling them apart needs a separate "picked" flag and was not worth the state.
- **Table: `etTableCsvExport` config makes every later `export({ file })` throw ET3507**; **a
  cancelled resize leaves a width override**; **selection/expansion state writes
  `"[object Object]"` without a `rowKey`** (table Medium ×3). S each — **DONE 2026-08-22**.
  Done: `mergeTableCsvExportOptions` (headless) merges a call's overrides so that `file` and the
  build options (`rows`/`columns`/`header`/`delimiter`/`formulaGuard`/`bom`) drop each other across
  the config/call boundary — `ET3507` now only fires for both in one call; `etTableResize` records
  whether the column had a width override when the drag began and `cancel()` resets instead of
  writing the rendered width back; the selection and expansion state slices read and write nothing
  unless the table has a `rowKey` (new `hasRowKey()` on `TableFeatureHost`). New specs:
  `table-csv-export.directive.spec.ts`, `table-resize.directive.spec.ts`, plus state cases in the
  selection/expansion specs. Left open: the ET3507 message still does not name the config as the
  source of an option (table DX #3) — with the merge fixed the assert can only ever see one call's
  own options, so there is nothing left to blame elsewhere; and RTL resize (a separate Medium) is
  untouched.
- **Overlay: container elevation ignores the strategy's `hasBackdrop`; `documentClass`/`bodyClass`
  are not ref-counted; a destroyed query-param opener orphans an open overlay** (overlay Medium ×3).
  Fix the first two via the DX item "one `resolveHasBackdrop`, one `resolveOrigin`". S / M · **DONE 2026-08-22**
  Done: one exported `resolveOverlayHasBackdrop(config, strategyConfig?)` (new `overlay-has-backdrop.ts`)
  now backs the controller and both manager paths, and the container elevates against the resolved value
  the overlay mounted with, handed to it through the new internal `OVERLAY_HAS_BACKDROP` provider (a
  strategy's own `hasBackdrop` never reaches `overlayRef.config`, and the container is constructed before
  its inputs are set, so DI is the only route). `documentClass`/`bodyClass` are reference counted per
  element in the controller, on attach, on a breakpoint switch and on close. A destroyed query-param
  opener now closes the overlay before clearing the param. New specs: `overlay-opener.spec.ts` (the
  domain's largest untested surface got its first coverage), plus elevation cases in the container spec
  and shared-class cases in the controller spec. Left open: the `resolveOrigin` half of the DX item (the
  two manager paths still resolve `origin` differently - it is a readability asymmetry, not a bug, and
  unifying it changes the no-strategies path's focused-element fallback, which `overlays.md:59` documents
  as deliberate); the elevation is still decided once at mount, so a breakpoint switch that adds or
  removes the backdrop does not re-elevate the pane; and `OverlayBreakpointConfig.hasBackdrop`'s wrong
  JSDoc (its own Medium bullet) is untouched.
- **ARIA structure claims that do not hold — `role="grid"`/`tablist` with unowned or nested children**
  in calendar (High), scheduler (High: no `grid` owner at all), table page-sticky (Medium) and tabs
  (Medium). One shape, four domains; cheap (`role="presentation"` on layout wrappers) but needs the
  a11y-tree assertions from _Spec-coverage_ #6 or it regresses. M · **DONE 2026-08-22**
  Done: _Spec-coverage_ #6 landed first as `testing/aria-structure.ts` (`expectOwnedAriaRoles`,
  `expectAriaGrid`, `expectAriaTablist`, `expectUniformCellsPerRow`, `resolveAriaOwner` — the walk
  skips only `presentation`/`none`, so a role-less wrapper fails), then the four fixes: the calendar's
  weeks viewport and month wrappers are `presentation` and the nested `.et-calendar-month` rowgroup is
  gone; both scheduler grid views carry `role="grid"` on their host, the time grid's body row is a
  `row` and its day/gutter tracks are `presentation`; the table's page-sticky strip and scroller are
  `presentation`; and the tab bars' scrollable host, wrapper and container are `presentation` so the
  tablist owns its tabs (`scrollableRole="presentation"` plus a `role="presentation"` wrapper in
  `et-scrollable`). Left open: the multi-month calendar rows that carry fewer than seven gridcells
  (its own Medium — `expectUniformCellsPerRow` is in the kit but not pointed at that case yet); the
  scheduler grids still have no `aria-label` and no roving tabindex (both separate items); the dead
  `role`/`aria-orientation` host bindings on `TabBarDirective` under `et-tab-group` (separate tabs
  Medium); and the `menu`→owned-roles half of #6, which no fix here needed.
- **`et-color-input` never reports `expanded`**, so the field drops its open-popup styling
  (color-input Medium); **the picker's thumbs use logical offsets against physical gradients**, so it
  is wrong in RTL (color-input High). S / M
- **Dropzone: single-mode replace never fires the configured `delete`** (orphaned server file);
  **`clear()` ignores `disabled`/`readonly`**; **`DROPZONE_LABELS.uploading` is never read** (dropzone
  High + Medium ×2). S each · **DONE 2026-08-22**
  Done: `selectFiles`'s single-mode branch now deletes what it replaces through the same
  `deletableValueOf()` helper `removeEntry` uses (so `includeExisting` and the still-uploading
  exemption apply identically), `clear()` gained the `interactive()` guard the other three mutators
  had, and `liveStatusMessage` reads `DROPZONE_LABELS.uploading`. Left open: `clear()` still fires no
  deletes at all - it is a bulk reset a custom UI drives, and whether wiping a field should delete
  every file server-side is a product call, not a bug; and no per-instance `uploadingLabel` input was
  added (the domain token is the only override, matching how the live region is documented).
- **Slider: a tick press does not commit the tick's value without `snapToMarks`** (slider High) —
  documented as always doing so. S · **DONE 2026-08-22**
  Done: the code was the wrong half - `SLIDER_MARK_VALUE_ATTRIBUTE`'s JSDoc, the track's own comment
  and the existing spec name all state the tick press commits that exact value; only the commit path
  dropped it. Both hosts' private `snapValue` now leaves a value that equals one of the rendered marks
  alone instead of pulling it onto the `step` grid (so the display no longer re-snaps it either), and
  the range slider's `constrainAndSnap` skips its second snap when the sibling limit did not move the
  value. No public API change - `snapValue`/`constrainAndSnap` are private and `commitThumbValue`'s
  signature is untouched. New specs: an off-grid tick press in `slider.directive.spec.ts` (value plus
  `aria-valuenow`) and in `range-slider.directive.spec.ts`, plus a bare-track press that must still
  snap. Left open: the keyboard still steps the `step` grid from an off-grid mark (arrow-right from 25
  with `step: 10` lands on 40, not 35) - a mark-aware keyboard model without `snapToMarks` would make
  the marks a second grid, which is what `snapToMarks` is for; and `thumbValueText` still announces a
  mark's label only while snapping, even though a thumb can now sit exactly on a labelled off-grid
  mark - `slider.md` documents the label-as-`aria-valuetext` rule as a `snapToMarks` feature.
- **RTE: `pruneEmptyInline` skips `u`/`code`**, leaking raw HTML into the Markdown value (rte High);
  **the trigger popup opens before an existing trigger char and leaves the literal text** (rte High);
  **tools commit without a history boundary**, so the next keystroke swallows them (rte Medium). S / M
  · **DONE 2026-08-22**
  Done: `INLINE_TAGS` is now the single list `pruneEmptyInline` and the directive's serialization
  sweep both iterate (they had hardcoded three of five tags). `pruneEmptyInline` skips a `<code>`
  inside a `<pre>`: that is an emptied fenced code block, and removing it from the live DOM would
  leave the bare `<pre>` the editor never builds itself (the serialization sweep needs no such
  guard - `htmlToMarkdown` emits the same fence either way).
  `resolveTriggerMatch` returns `null` at `caretOffset === 0`
  (`lastIndexOf` clamps a negative `fromIndex` to 0, which is what matched a trigger char the caret
  stood in front of); the char is still only ever consumed by the insert's replacement range, so a
  future autoformat rule may reserve `#`/`@` without fighting this. The table tool's `insert`/`mutate`
  and the align tool's `select` now pass `{ boundary: true }`. Left open: the triggers directive's
  own `syncFromDom()` calls (`insertItem`'s trailing nbsp, `deletePrecedingChip`) still omit the
  boundary - that is a separate _rte Medium_ finding, not listed here, and it sits on the chip
  insert path rather than the toolbar tools. Also left: the stale "three inline tags" wording was
  corrected, but nothing was done about the other rte findings in the same batch.
- **Smaller singletons:** the copy-button subscription is not lifecycle-bound (dev warning only);
  `maxVisible: 0` shows every notification instead of none; the standings overlapping-zones guard only
  ever checks the first render. S each · **DONE 2026-08-22**
  Done: `requestCopy()`'s clipboard pipe ends in `takeUntilDestroyed(this.destroyRef)`, so a copy that
  settles after the host is gone no longer sets `copied` or trips NG0953. The notification manager reads
  `maxVisible` once through `Math.max(1, Math.floor(...))` (the `maxVisibleColumns` precedent) and both
  the `slice` cap and the `open()` dismiss use that value. The standings guard is now
  `effect(() => this.assertZonesDoNotOverlap(this.zones()))` instead of `afterNextRender`, matching the
  RTE trigger-uniqueness guard, so zones assembled or swapped after mount are checked too. Left open:
  the scan's `maxVisible: 0` claim does not reproduce - `open()` already dismisses the oldest whenever
  `active.length >= maxVisible`, so with `0` at most one notification is ever active and `slice(-0)`
  has nothing extra to show; the reachable misbehaviour is a negative cap (hides live toasts entirely)
  and a fractional one (parks an undismissed toast out of sight), which is what the specs pin. Nothing
  validates `maxVisible` loudly - a dev-mode error was the scan's alternative, and silently clamping
  matches how the cascader treats the same input. The standings check now runs during change detection
  rather than after render, which is fine for a pure input check but would not suit a guard that needs
  the DOM.

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
   **DONE 2026-08-22** with item #3 - `typeChars()` is in `driver-core.ts` and exposed on
   `createFieldControlDriver`, so every text-control driver has it.
2. **`aria-describedby` resolution as a shared assertion** (`expectDescribedByResolves`). Would have
   caught otp, rating, slider, dropzone and the three selection groups in one pass, and keeps catching
   the next one.
   **DONE 2026-08-22** with item #4 - `forms/testing/described-by.ts`.
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
   **DONE 2026-08-22** with the "ARIA structure claims" fix — `libs/components/src/lib/testing/aria-structure.ts`,
   used by the calendar, scheduler, table page-sticky and both tab-bar specs. `menu`→owned roles is
   covered by the same ownership walk but has no caller yet.
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
    run at all. **Chased and confirmed 2026-08-22**: `tsc -p libs/components/tsconfig.spec.json
--noEmit` reports 431 errors across 68 spec files, there is no `typecheck` target, and no CI
    step runs it — see the scan's "Cross-cutting: spec files are never type-checked" section.
    Adding that target (after a burn-down) belongs at the top of any spec-infrastructure work.
