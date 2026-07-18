# Form components — review & backlog

A review of `libs/components/src/lib/forms/` covering the controls built during the
Phase 8–9 roadmap and the pre-existing ones alongside them. Companion to
`FORM_CONTROLS_PLAN.md` (which tracks _what_ shipped); this file tracks _what to
improve next_.

Findings are grouped by area, tagged with a severity, and ordered most-impactful
first within each group. Each entry names the file and the concrete fix. A short
**Cross-cutting** section at the end calls out the few changes that pay off across
many controls — start there if you want the highest leverage.

Severity legend: **bug** (wrong behavior) · **a11y** (accessibility) ·
**consistency** (sibling controls diverge) · **dx** (API/authoring ergonomics) ·
**perf** · **cleanup** (dead code / duplication).

> Nothing here has been changed yet — this is a backlog. Items marked
> _(verified)_ were confirmed against the code during the review; the rest were
> reported by the review pass and are worth a quick confirm before fixing.

---

## Cross-cutting themes (highest leverage)

These recur across most controls; fixing them once removes whole classes of the
individual findings below.

1. **Extract the `FormValueControl`/`FormFieldControl` wiring.** The
   `formField` inject + `registerControl`/`unregisterControl`, the tag-name
   detection that sets `nativeControl`/`focusTarget`, and the `labelId` /
   `describedBy(Id)` / `focused` / `shouldDisplayError` / `controlType` /
   `activate()` members are copy-pasted verbatim across **input, number,
   password, color, textarea** (and echoed in date/time, otp, rating, …). One
   `injectFormFieldControl(...)` helper (or base class) would own the contract in
   a single place. **dx/cleanup**

2. **Extract the form-support wiring.** The four `viewChild` refs +
   `effect(() => support.errorContent.set(...))` block is duplicated verbatim in
   ~9 components (rating, otp, choice-field, all three selection-list groups,
   slider, dropzone). Fold it into `injectFormSupport` or a `wireFormSupport(support)`
   call. **cleanup**

3. **Extract a shared anchored-panel overlay controller.** `select.directive.ts`
   and `cascader.directive.ts` hand-roll ~180 near-identical lines each: the
   disabled/open reconciliation effect, `show/hide/toggle/activate`,
   `resolveAnchorElement`, `handleFrameClick`, `mountOverlay`, the interaction
   listener attach/detach, the `closedByOutsidePointer` flag, and the
   before/after-closed focus restoration. A `createAnchoredPanelController(...)`
   would remove the drift that produced several a11y bugs below (mismatched
   interactive-element guards, missing pane id, un-cancelled focus loops). The
   date-picker inputs have the _same_ shape a third time
   (`createDatePickerInputHost()`). **dx/cleanup**

4. **One hint/error transition state machine.** `form-field/headless/form-support.ts`
   (used by rating/otp/slider/radio/…) and the inline `reduceSupportPresentation`
   in `form-field.component.ts` (the text-field shell) encode the same
   enter/leave/frozen-color logic twice. Consolidate onto one reducer before they
   drift. **cleanup**

5. **Dead pass-through inputs.** `hidden` is declared + `eslint-disable`d +
   forwarded through `hostDirectives` on all five input directives but bound
   nowhere — a schema-hidden field stays visible. `describedById` is an identity
   `computed()` wrapper over a writable signal the form-field already writes.
   Decide `hidden`'s contract (bind it or drop it) and bind `describedBy`
   directly, deleting the wrappers. **bug/cleanup**

---

## Input family (input · number · password · color · masked · textarea)

- **bug — color-input** (`color-input.directive.ts` + template): `readonly` is
  declared and forwarded but never bound, and `<input type="color">` ignores
  `readonly` per spec, so `[readonly]="true"` leaves the picker fully editable
  while every sibling honors it. Gate interaction another way or drop `readonly`
  from the color surface.
- **bug — headless input/textarea** (`input.directive.ts`): the directive
  supports standalone `input[etInput]` (auto-sets `nativeControl` on an
  `INPUT`/`TEXTAREA`) but value-sync lives only in the wrapper template
  (`syncNativeValue`), so a standalone headless input never updates its model on
  keystrokes. Add a host `(input)` handler in the directive (as
  `InputMaskDirective` does).
- **bug — masked IME** (`input-mask.directive.ts` `handleInput`): the mask
  rewrites `value` + `setSelectionRange` on every `input` with no
  composition guard, cancelling the IME candidate mid-composition for CJK /
  dead-key input. Skip reconciliation while composing; reconcile on
  `compositionend`.
- **bug — number stepper touched** (`number-input.directive.ts` `stepBy`):
  stepping via the ± buttons/auto-repeat mutates `value` but never sets `touched`,
  so validation errors stay hidden until a separate blur. Set `touched` when a
  step changes the value.
- **a11y — password caps-lock** (`password-input.directive.ts` `syncCapsLock`):
  caps-lock is only sampled on key events, so a field focused (click/Tab) while
  caps-lock is already on shows no warning until the next keystroke. Also sample
  `getModifierState` on `focus`.
- **perf/leak — number auto-repeat** (`number-input.component.ts`
  `startStepRepeat`): stop relies on `pointerup`/`pointercancel` on the button,
  which needs the `setPointerCapture` that's wrapped in `try/catch`; if capture
  throws and the pointer releases off the button, the `timer` runs until destroy.
  Add a `(lostpointercapture)` / window `pointerup` fallback.
- **consistency — `textAlign`**: exists on `InputDirective` /
  `NumberInputDirective` but not on password (also a single-line text input) or a
  deliberate decision for color/textarea. Add it or document the omission.
- **dx — password reveal label** (`password-input.component.ts`): the reveal
  toggle keeps one static "Show password" label across both states; it carries
  `aria-pressed` so it's acceptable, but a state-aware Show/Hide label reads
  better. Low priority.
- _Verified sound:_ mask engine caret/round-trip math and the
  currency/IBAN/card transforms; `aria-invalid`/`describedby`/`labelledby` and
  the touched-on-blur pattern across the family; the textarea autosize
  `setStyle` object form.

## Selection family (checkbox · switch · choice-field · selection-list groups · rating · otp)

- **bug — select-all "mixed" lockup** _(verified)_ (`selection-state.ts`):
  `allSelected` evaluates `every(item.checked())` over **all** items (incl.
  disabled), but `toggleAll` only mutates non-disabled items. With a disabled
  **unchecked** item present, `allSelected` can never become true, so
  `shouldCheck` is stuck `true` and the select-all control shows a permanent
  "mixed" that never clears. Evaluate `allSelected`/`toggleAll` over the same
  (enabled) set.
- **a11y — multi-select roles** (`selection-option.directive.ts` +
  `selection-list.directive.ts`): in `multiple` mode the container is
  `role="group"` while items are `role="option"`, but `option` is only valid
  inside a `listbox`/`grid`, so multi-select checkbox-group items are invalid
  ARIA. Render multi-select items as `role="checkbox"` (pairs correctly with
  `group` + `aria-checked`); reserve `option`/`radio` for listbox/radiogroup.
- **a11y — select-all `aria-checked="mixed"`** (`selection-list-control.directive.ts`):
  the select-all control is `role="option"` but binds `aria-checked` incl.
  `"mixed"`; `option` uses `aria-selected` (no mixed state). Make it
  `role="checkbox"`.
- **a11y — dual checked attrs** (`selection-option.directive.ts`): host binds
  both `aria-checked` and `aria-selected` to `checked()` unconditionally, so
  radios get a spurious `aria-selected`. Emit only the attribute for the resolved
  role.
- **bug — otp re-complete** (`otp-input.directive.ts`): `completed` only emits
  when `previous.length < length`, so replacing an already-complete code with
  another complete one (select-all + paste, autofill over a filled field) never
  re-emits. Emit when `sanitized.length === length && sanitized !== previous`.
- **edge — rating stuck click-swallow** (`rating.component.ts`):
  `pointerCommitted` is set on `pointerup` and only cleared by the next
  `handleIconClick`; a pointer sequence that ends without a following `click`
  (drag off-target, cancelled synthetic click) leaves it `true` and swallows the
  next legitimate click once. Reset on `pointercancel`/`pointerleave`.
- **edge — orphaned value on unregister** (`selection-state.ts`):
  `unregisterItem` drops the item from the registry but never reconciles
  `config.value`; destroying a checked option (`@for` churn) strands its value in
  the model (most visible in `multiple` arrays). Recompute value from remaining
  checked items on unregister (guard teardown races).
- **consistency — Space activation phase**: checkbox toggles on `keyup.space`
  while switch and every selection option toggle on `keydown.space`. Pick one
  phase across the family.
- **a11y/cleanup — dead `labelId`**: each option stamps a `labelId` on its label
  span but the host never binds `aria-labelledby` to it; naming relies implicitly
  on name-from-contents. Bind it or remove the machinery. Same for the unused
  `SelectionListControlDirective.labelId` and the never-populated
  `SelectionListItem.id`/`label`.
- _Verified sound:_ single-select paths (radiogroup+radio, segmented group) are
  ARIA-correct; roving tabindex, arrow roving+select, and OTP caret-pin/sanitize
  all sound.

## Overlay compositions (select · cascader · tag-input · phone-input)

- **a11y/bug — cascader `aria-controls=""`** (`cascader-trigger.directive.ts`):
  `controlledId()` reads the pane element's `.id`, but the overlay runtime never
  assigns one, so `aria-controls=""` while open. Give the tree/panel a stable id
  and point at it (as `SelectListboxDirective` does).
- **bug — cascader programmatic value → no breadcrumb** _(verified)_
  (`cascader.directive.ts`): `path` (which drives `displayValue`) is only set
  inside `commit()`; the value effect only _clears_ it. Setting `value` from
  outside (form patch, restore) leaves the trigger showing the placeholder
  despite having a value. Resolve the path from the value on external set (walk
  the data source), or document the limitation prominently.
- **a11y — non-option content inside listbox** (`select.component.html` +
  `select-panel.component.ts`): `et-select-panel` is `role="listbox"`, but the
  loading/empty divs, the `role="alert"` error, and the load-more/add-new
  `<button>`s all render inside it — a listbox must contain only options/groups.
  Render state rows and action buttons as siblings of the listbox element.
- **a11y — phone country trigger has no name** (`phone-input.component.html`):
  its only content is the `aria-hidden` flag + `+49` text and the form-field
  token is nulled, so a screen reader announces just "+49, combobox". Add
  `aria-label="Select country"` to the trigger.
- **bug/edge — cascader focus loop not cancelled** (`cascader.directive.ts`
  `focusFirstOfColumn`): the rAF loop polls up to 20 frames and calls
  `focusNode(...)` with no overlay/mount guard, so a panel closed mid-load can
  still yank focus into a node animating away. Bail if the overlay is gone.
- **a11y — cascader has no typeahead** (`cascader.directive.ts`
  `handleNodeKeydown`): select has full type-to-search; the tree only handles
  arrows/Home/End, so long columns can't be navigated by name. Reuse
  `createTypeahead()` per focused column.
- **consistency — frame-click interactive guards diverge**: select uses
  `INTERACTIVE_TAGS` (+ `isContentEditable`); cascader inlines
  `['BUTTON','A','INPUT','TEXTAREA']`, missing `SELECT` and contenteditable, so a
  native `<select>` affix wrongly toggles the cascader. Share one guard.
- **consistency — bottom-sheet on mobile**: cascader swaps to
  `injectBottomSheetStrategy()` below `md`; select mounts anchored at every
  breakpoint. If bottom-sheet is the house style for these panels, select is
  inconsistent — align it or document why.
- **perf — select `labelCache` unbounded** (`select.directive.ts`): every
  registered option's `value→label` is written forever and never pruned; with
  `filterMode="external"` (async) the list churns, so it grows per option ever
  seen. Only selected/custom values need caching — cache lazily or prune to the
  current value set.
- **cleanup — panel surface boilerplate**: `select-panel` and `cascader-panel`
  both re-sync color from `COLOR_PROVIDER` and wire `injectAnimatedBlockSize`
  around an identical body template. Extract `injectOverlaySurfaceContext()` or a
  base panel.
- **cleanup — singleton registration pattern** repeated across ~10
  trigger/surface/search/value/state sub-directives (`set(this)` +
  `onDestroy(clear)` + dev-mode parent assertion). `assertInsideSelect` already
  factors the assertion; add a `registerSingleton(signal, this, destroyRef)` for
  the other half.
- **a11y (minor) — cascader tree ownership**: columns (`role="group"`) are flat
  siblings under `role="tree"`, related only via `aria-level`, not `aria-owns`.
  Defensible as a "columnar tree" but consider `aria-owns` or documenting the
  deviation.
- _Verified sound:_ select virtual-focus + `activeItem` reference model, the
  `boundValue` lazy-required guard, `panelFilterQuery` freeze-during-leave, and
  `closedByOutsidePointer` focus restoration.

## Date & time (date · date-range · time · date-time · duration) + form-field chrome

- **bug — typed dates leak current time-of-day** _(verified)_
  (`date-input.directive.ts`, `date-range-input.directive.ts`,
  `date-time-parse.ts`): typed commits parse a date-only format (`'P'`) with no
  `referenceDate`, so date-fns fills H/M/S from `new Date()` — the wire value
  carries the current clock time, while the same day picked in the calendar is
  `startOfDay` (midnight). Two entry paths → different wire values for one day,
  hidden because `displayValue` re-formats to `'P'`. Only bites value formats
  that carry time. Pass `referenceDate: startOfDay(new Date())` (or `startOfDay`
  the result) on the date-only paths.
- **a11y — parse error is silent** (`form-field.directive.ts` vs each input's
  `shouldDisplayError`): `aria-invalid` binds to the control's
  `shouldDisplayError()` (includes `parseError`), but the form-field's message +
  `describedById` use `touched() && invalid()` (no `parseError`). Typing garbage
  and blurring yields `aria-invalid=true` with no `aria-describedby` and no error
  text. Surface parse errors as a real message, or gate `aria-invalid` the same
  way the message is gated.
- **bug — duration keeps stale value on parse error**
  (`duration-input.directive.ts`): date/time/date-time null the value on an
  unparseable commit; duration only sets `parseError=true`, leaving the old
  milliseconds in `value` under unparseable text. Set `value` to `null` on the
  parse-error branch.
- **a11y — picker dialog not a dialog** (`date-picker-trigger.directive.ts` +
  panel/overlay host): the trigger advertises `aria-haspopup="dialog"` but the
  mounted container has no `role="dialog"` and no accessible name — SR users are
  promised a dialog and land in an unnamed generic. Add `role="dialog"` +
  `aria-label` on the panel/surface.
- **consistency/a11y — range fields have no `aria-labelledby`**
  (`date-range-input-field.directive.ts`): the other three fields associate
  `<et-label>` via `aria-labelledby`; the range fields rely only on hardcoded
  start/end aria-labels, and `DateRangeInputDirective.labelId` is computed but
  unused. Group-level `aria-labelledby` on the host softens this, but the
  headless directive alone has no per-field name.
- **consistency — lenient parse ignores `displayFormat`** (`date-time-parse.ts`):
  the strict pass honors `displayFormat`, but the lenient split hardcodes `'P'`/`'p'`,
  so a custom `displayFormat` gets lenient parsing that disagrees with what's
  displayed.
- **dx/cleanup — date-picker input host duplicated 3–4×**: `pickerOpen`/
  `interactive`, `openPicker`/`closePicker`/`togglePicker`/`activate`,
  `resolveAnchorElement`, the `createDatePickerOverlay({...})` block, and the
  `effectiveValueFormat`/`effectiveLocale`/`describedById`/`labelId`/`hasValue`/
  `shouldDisplayError` computeds are byte-identical across date/time/date-time.
  Extract `createDatePickerInputHost()` (see Cross-cutting #3).
- _Verified sound:_ `minDate`/`maxDate` reserved-name handling, overlay
  subscription teardown, the panes `ResizeObserver` teardown, calendar
  roving-tabindex focus model, and `aria-disabled` (not `disabled`) on calendar
  cells so keyboard nav still reaches them.

---

## Suggested sequencing

1. **The four confirmed bugs first** (small, user-visible): select-all "mixed"
   lockup, cascader programmatic-value breadcrumb, typed-date time leak, duration
   stale-value-on-error.
2. **The a11y batch** (roles/names): multi-select roles + select-all checkbox,
   listbox-only content, cascader `aria-controls` + picker `role="dialog"`, phone
   country name, silent parse error.
3. **The cross-cutting extractions** (dx/cleanup): form-field-control wiring,
   form-support wiring, anchored-panel controller, date-picker input host. These
   are the biggest long-term win and retire many of the consistency findings, but
   they're refactors — do them behind the green test suite, one control migrated
   at a time.
