# Form controls roadmap

Long-running plan for the missing form controls in `@ethlete/components`. This file
is the tracking artifact: update the status table and check off work as it lands.

Decisions baked into this plan (do not re-litigate without a reason):

- **Unified select** replaces the cdk's separate `select` + `combobox`. One headless
  core; typeahead/filtering is opt-in; multi-select (chips in trigger) from day one.
  A native `<select>` wrapper is **explicitly out of scope**.
- **Zero new runtime dependencies**, with one exception: **date-fns 4.1.0 becomes a
  peer dependency** of `@ethlete/components` (already peered by `@ethlete/cdk`).
  No maskito, no libphonenumber.
- **Date value contract mirrors the cdk date input:** form value is a formatted date
  **string**, default format `yyyy-MM-dd'T'HH:mm:ssxxx`, configurable via a
  `provideDateFormat`-style DI token.
- **Custom calendar overlay** (not native pickers) for date controls; range mode is
  part of the calendar core from day one. Slider ships with range (two-thumb) mode
  from day one.
- **Priority:** quick wins first (textarea / number / color), then the select family,
  then date/calendar; small independents slotted in between.

## Status

| Control                         | Phase | Size | Status  | Error block                 |
| ------------------------------- | ----- | ---- | ------- | --------------------------- |
| Textarea                        | 1     | M    | shipped | none needed                 |
| Number input                    | 1     | S    | shipped | shares `forms/input` (none) |
| Color input                     | 1     | S    | shipped | none needed                 |
| Selection groundwork            | 2     | S    | planned | —                           |
| Chip                            | 2     | S    | planned | claim at impl. time         |
| Select — slice 1 (single)       | 3     | L    | planned | 1000–1099 (allocated)       |
| Select — slice 2 (multi)        | 3     | M    | planned | 1000–1099                   |
| Select — slice 3 (search/async) | 3     | M    | planned | 1000–1099                   |
| Rating                          | 4     | M    | planned | claim at impl. time         |
| OTP / PIN input                 | 4     | M    | planned | claim at impl. time         |
| Tag input                       | 5     | M    | planned | claim at impl. time         |
| Phone input                     | 5     | M    | planned | claim at impl. time         |
| Calendar                        | 6     | L    | planned | claim at impl. time         |
| Date input                      | 6     | M    | planned | shares `date-time` block    |
| Date range input                | 7     | M    | planned | shares `date-time` block    |
| Time picker + time input        | 7     | M+S  | planned | shares `date-time` block    |
| Date-time input                 | 7     | M    | planned | shares `date-time` block    |
| Slider (incl. range)            | 8     | L    | planned | claim at impl. time         |
| Masked input                    | 8     | L    | planned | claim at impl. time         |

Error-code note: the allocation table in `docs/COMPONENT-ARCHITECTURE.md` is in
sync (2500–2599 rich-text-editor, 2600–2699 multi-language-rich-text-editor). The
select uses its pre-allocated 1000–1099. The 1100–1199 block was pre-allocated for
a standalone combobox that never shipped (no codes in that range exist in either
lib — the cdk combobox uses index-based codes predating the range system), so it
is free to reclaim: next free blocks are **1100**, then **2700** onward. Each new
domain claims the next free block at implementation time and records it here and
in the docs table.

## Global conventions (apply to every control)

- **Three-tier architecture** per `docs/COMPONENT-ARCHITECTURE.md`: headless
  directives in `<domain>/headless/` (behavior, state, a11y, form integration),
  default styled component at the domain root, `<DOMAIN>_IMPORTS` const, stories
  under `<domain>/stories/`.
- **Form integration:** controls implement `FormValueControl<T>` (signal forms) +
  `FormFieldControl`, self-register via `FORM_FIELD_TOKEN`
  (`forms/form-field/headless/form-field.tokens.ts`), and add a new constant to
  `FORM_FIELD_CONTROL_TYPES`.
- **Styling:** plain CSS wrapped entirely in `@layer components`; colors only via
  surface/color theming tokens (`--et-surface-*`, `--et-theme-color-*`); internal
  config modifiers use `:where()`; interaction states stay bare. Read the `theming`
  skill before styling.
- **Overlay-based controls** mount popups the way `MenuDirective` does:
  `injectOverlayManager()` + `anchoredOverlayStrategy` (placement, `mirrorWidth`,
  outside-close, bottom-sheet breakpoints for free).
- **Definition of done per control:** headless + styled tiers · directive specs ·
  Storybook stories · docs update (`apps/docs/components/`) · changeset · status
  table row updated.

## Phase plan

| Phase | Contents                                                                                        | Size | Dependencies                       |
| ----- | ----------------------------------------------------------------------------------------------- | ---- | ---------------------------------- |
| 1     | Quick wins: textarea, number input, color input, masking prep                                   | M    | none                               |
| 2     | Select groundwork: selection-state extraction, typeahead lift, overlay focus spike, chip domain | S+S  | none — highest-risk refactor first |
| 3     | Unified select, three shippable slices                                                          | XL   | phase 2                            |
| 4     | Rating, OTP input                                                                               | M    | none — parallel with 3             |
| 5     | Tag input, phone input                                                                          | L    | phase 3                            |
| 6     | Date foundation: date-fns peer dep, format tokens, calendar, date input                         | L–XL | none (independent of select)       |
| 7     | Date/time completion: range input, time picker/input, date-time input                           | L    | phase 6                            |
| 8     | Slider (range from day one), masked input                                                       | XL   | slider: none; masked: phase 1 prep |

---

## Phase 1 — Quick wins (input family)

### Textarea — `forms/textarea/` (M)

Separate domain with its own headless directive, **not** an `et-input` extension:
the native element differs (`<textarea>` vs `<input>`), `type`/`textAlign` don't
apply, and autosize adds element-specific state. The ~25 lines of `FormFieldControl`
boilerplate duplication is the established pattern (switch and checkbox carry it).

```
forms/textarea/
  headless/
    textarea.directive.ts            TextareaDirective  [etTextarea]
    internals/textarea-autosize.ts   pure sizing helper (unit-testable)
  textarea.component.ts/.html/.css   et-textarea
  textarea.imports.ts / stories/ / index.ts
```

- `TextareaDirective implements FormValueControl<string>, FormFieldControl` —
  models `value`, `touched`; inputs: the standard `InputDirective` set
  (`disabled`, `readonly`, `invalid`, `errors`, `required`, `name`, `placeholder`,
  `autocomplete`) plus `rows` (default 3), `autosize` (default true), `minRows`,
  `maxRows`, `resize: 'none' | 'vertical'` (only when autosize is off).
- Autosize: JS measurement (reset height → `scrollHeight`, clamp via line-height ×
  min/maxRows) driven by an effect on `value` + `signalElementDimensions` — the
  signals-first equivalent of the cdk `AutosizeTextareaDirective`. CSS
  `field-sizing: content` is noted as a future progressive enhancement only.
- New `FORM_FIELD_CONTROL_TYPES` entry `textarea`; reuses form-field chrome and
  prefix/suffix partials as-is.

### Number input — `forms/input/` sibling (S)

Lives inside the existing `forms/input/` domain (shares 100% of the visual layer)
but as its own directive pair, because the value contract differs:
`FormValueControl<number | null>` vs `FormValueControl<string>`.

- `headless/number-input.directive.ts` — `NumberInputDirective [etNumberInput]`;
  models `value: number | null`, `touched`; inputs: standard set + `min`, `max`,
  `step`, `placeholder`, `autocomplete`, `textAlign`.
- Sync via `input.valueAsNumber`, `NaN → null` (same contract as the cdk).
- `et-number-input` Tier 3 reuses `input.component.css` classes. New control type
  constant so form-field CSS can hide native spinners. No stepper buttons in v1 —
  custom steppers can become a form-field suffix partial later.

### Color input — `forms/color-input/` (S)

Native `input[type=color]` based (a full custom color picker is out of scope, same
as cdk).

- `ColorInputDirective [etColorInput]` — `value: string | null` (`#rrggbb`, empty →
  `null`), `touched`, standard inputs, `activate()` focuses/clicks the native input.
- Tier 3: swatch (background = value) + hex label, native input visually hidden but
  focusable on top (`FocusRingDirective`). Tokens: `--et-color-input-swatch-size`,
  `--et-color-input-swatch-radius`.

### Prep work (S, lands with phase 1) — done

- ~~Expose a public `InputDirective.nativeControl: Signal<HTMLInputElement | null>`~~
  Done — all input-family directives expose `nativeControl` (auto-initialized when
  the directive sits on the native element, otherwise set by the Tier 3 component).
- ~~Sync the error-code table in `docs/COMPONENT-ARCHITECTURE.md` (2500/2600 blocks).~~ Done.

**Phase 1 shipped.** Notes for later phases: jsdom specs get a shared
`ResizeObserver` mock via `src/test-helpers.ts`; the custom renderer from
`injectRenderer()` takes a style object (`setStyle(el, { blockSize: '0' })`), not
prop/value pairs; new text-shell control types must be added to
`usesTextFieldShell` in `form-field.directive.ts`.

---

## Phase 2 — Select groundwork

Three small refactors + one new domain unlock the whole selection family. Do the
extraction first and alone: it is the highest-risk step and the existing
radio/checkbox/segmented specs are the safety net.

1. **Extract `createSelectionState<T>()`** from `SelectionListDirective`
   (`forms/selection-list/headless/selection-list.directive.ts`). The directive
   couples (a) item registry + value↔items sync + select/toggleAll logic,
   (b) `FormFieldControl` registration, and (c) a roving-tabindex focus model.
   (a) and (b) are exactly what the select needs; (c) is wrong for the combobox
   ARIA pattern (focus stays on the trigger/input, options get _virtual_ focus via
   `aria-activedescendant`). Extract (a) into an internal factory
   (`headless/internals/selection-state.ts`); `SelectionListDirective` becomes a
   thin wrapper (state + form-field registration + roving focus). Existing groups
   must be behaviorally untouched.
2. **Widen `SelectionListItem`** (`selection-list.tokens.ts`) with optional
   `id: Signal<string>` (for `aria-activedescendant`) and `label: Signal<string>`
   (for typeahead + chip/trigger display).
3. **Lift `createMenuTypeahead`** (`menu/headless/internals/menu-typeahead.ts`) to a
   shared internal — it is domain-free already; re-export from menu for compat.
4. **Overlay focus spike:** confirm the anchored non-modal strategy can open
   _without_ moving DOM focus off the trigger (`autoFocus: false` +
   `restoreFocus` must not fight the trigger). If not honored on the anchored
   path, land a small overlay fix before select slice 1.

### Chip — new top-level domain `lib/chip/` (S)

Usable outside forms (hence top-level). Consumed by the select multi trigger and
the tag input.

```
lib/chip/
  headless/chip.directive.ts         [etChip]        disabled, removable, remove output, Backspace/Delete
  headless/chip-remove.directive.ts  [etChipRemove]  remove button wiring + aria-label
  chip.component.ts/.html/.css       et-chip         tokens --et-chip-*
  chip.imports.ts / stories/ / index.ts
```

---

## Phase 3 — Unified select — `forms/select/` (XL, three shippable slices)

One headless core; plain dropdown, searchable combobox, and multi-select are the
same directive graph. Search/filtering is opt-in by _placing the search directive_,
exactly like `MenuSearchDirective` opts a menu into search.

```
forms/select/
  headless/
    select.directive.ts              [etSelect] root — state, overlay mounting, FormFieldControl
    select-trigger.directive.ts      [etSelectTrigger]
    select-search.directive.ts       input[etSelectSearch] — combobox opt-in
    select-option.directive.ts       [etSelectOption]
    select-listbox.directive.ts      [etSelectListbox] — role=listbox surface content
    select-surface.directive.ts      ng-template[etSelectSurface]
    select-value.directive.ts        [etSelectValue] — selected-value/chips render context
    select.tokens.ts                 SELECT_TOKEN, SelectItem
    internals/                       active-descendant manager, filter logic
  select-errors.ts                   SELECT_ERROR_CODES — 1000–1099
  select.component.ts/.html/.css     et-select (single + multi, chips, search)
  select-option.component.ts/.css    styled option (check icon, states)
  select-async-states.component.*    default loading / error / empty / load-more panels
  select-options-from-query.ts       @ethlete/query convenience factory (tree-shakeable)
  select.imports.ts / stories/ / index.ts
```

### Headless API surface

- **`SelectDirective`** (`[etSelect]`, exportAs `etSelect`) — `FormValueControl` +
  `FormFieldControl`:
  - Models/inputs: `value: unknown | unknown[] | null`, `open`, `multiple`
    (default false), `placeholder`, plus the standard form-field contract set.
  - Filtering: `filterMode: 'none' | 'internal' | 'external'` — `internal` filters
    registered options against the query (client-side data); `external` means the
    consumer reacts to `queryChange` (drives `@for` / a query) and the select never
    hides options itself.
  - Async states as **inputs**, not templates: `loading`, `error`, `hasMoreItems`.
    Outputs: `queryChange` (debounced), `loadMoreRequested`.
  - `allowCustomValues` (default false) — Enter on a non-matching query commits the
    raw string (subsumes half of tag-input use cases).
  - Computeds: `selectedItems` (with `label`, `value`, `deselect()`),
    `visibleItems`, `activeItem` (virtual focus), `listboxId`.
  - Internally: `createSelectionState()` from phase 2 + overlay mounting copied
    from `MenuDirective.mountOverlay` (`anchoredOverlayStrategy({ mirrorWidth: true })`).
  - Dev-only `RuntimeError`s: `MISSING_TRIGGER`, `MISSING_SURFACE`, ….
- **`SelectTriggerDirective`** — `role="combobox"`, `aria-haspopup="listbox"`,
  `aria-expanded`, `aria-controls`, `aria-activedescendant`; ArrowDown/Up/Enter/
  Space open, Escape closes; printable chars run closed-typeahead (single select)
  or forward to the search input.
- **`SelectSearchDirective`** — modeled 1:1 on `MenuSearchDirective`: `query`
  model, forwards Arrow/Escape/Tab/Enter to the select. Works inline in the trigger
  (classic combobox) **and** inside the panel (searchable dropdown); ARIA wiring
  adapts via registration.
- **`SelectOptionDirective`** — `value` (required), `label` (falls back to
  `textContent`), `disabled`; `role="option"`, `aria-selected`, stable `id`,
  `data-active` for virtual focus. **No roving tabindex** — options are never
  tabbable.
- **Tier 3 `et-select`** — hostDirectives-applies `SelectDirective` forwarding all
  inputs; trigger with chips (multi, via `et-chip`), clear button, arrow icon;
  default async-state panels each overridable by projected
  `ng-template[etSelectLoading]`-style directives (modern replacement for the cdk's
  six `COMBOBOX_*_TEMPLATE` content-children). Registers
  `FORM_FIELD_CONTROL_TYPES.SELECT`.
- **`selectOptionsFromQuery(...)`** — own module (precedent:
  `rich-text-editor-trigger-with-query.ts`); takes a query creator + reactive args +
  `toOptions` mapper (+ `debounceTime`, `minQueryLength`), returns
  `{ options, loading, error, hasMore, connect(select) }`. `@ethlete/query` is
  already a peer dep — zero new cost, tree-shakes away.

Dropped from the cdk feature set: `SelectionModel`, `bindLabel/bindValue/bindKey`
property paths (signals + `@for` over consumer data make them obsolete; the query
factory covers mapping). Virtualization is out of scope — async search + load-more
is the supported path for large lists.

### Slices

1. **Slice 1 (L):** single select end-to-end — trigger, listbox, options,
   keyboard + typeahead, a11y, `et-select`, form-field integration.
2. **Slice 2 (M):** multi-select + chips in trigger + `SelectValueDirective`.
3. **Slice 3 (M):** search directive (internal + external filtering), async
   states, `selectOptionsFromQuery`, load-more.

Each slice ships stories + docs + changeset on its own.

---

## Phase 4 — Small independents (parallel with phase 3)

### Rating — `forms/rating/` (M)

- `RatingDirective [etRating]` — `FormValueControl<number | null>`; inputs `max`
  (default 5), `allowHalf` (default false), `readonly` + standard set.
- A11y: single `role="slider"` host (simplest correct pattern with half steps),
  `aria-valuetext` "3.5 of 5", arrows ±step, Home/End; click/hover half-detection
  via pointer x. State: `hoverValue` (preview), `displayValue = hoverValue ?? value`.
- Tier 3: icons via `lib/icon`, half fill via `clip-path`/gradient; icon
  customizable through an `ng-template` slot; tokens `--et-rating-icon-size/-gap`.

### OTP / PIN input — `forms/otp-input/` (M)

- DOM strategy: **one real native input** (visually transparent,
  `autocomplete="one-time-code"`, `inputmode` per charset) stretched over
  presentational segments — single input = reliable iOS/Android SMS autofill and
  trivial paste; segments render chars + caret indicator from `selectionStart`.
- `OtpInputDirective [etOtpInput]` — `FormValueControl<string>`; inputs `length`
  (default 6), `charset: 'numeric' | 'alphanumeric' | RegExp`, `masked` (PIN dots);
  output `completed`. Paste strips separators, validates charset, truncates.
- Tokens: `--et-otp-input-segment-size/-gap/-radius`.

---

## Phase 5 — Select compositions

### Tag input — `forms/tag-input/` (M)

```
forms/tag-input/
  headless/tag-input.directive.ts        [etTagInput]       FormValueControl<string[]>
  headless/tag-input-field.directive.ts  input[etTagInputField]
  tag-input.component.ts/.html/.css      et-tag-input — chips + inline input, wraps
  tag-input.imports.ts / stories/ / index.ts
```

- `TagInputDirective`: `value: string[]`, `separators` (default `['Enter', ',']`),
  `allowDuplicates` (default false), `normalizeTag: (raw) => string | null`,
  `maxTags`; API `add`/`remove`/`tags`. Paste splits on separators.
- `TagInputFieldDirective`: commits on separator keys/blur; Backspace on empty
  input activates/removes the last chip; ArrowLeft/Right move virtual focus across
  chips (chips are not tab stops).
- No option registry needed — values are the source of truth
  (`createSelectionState` not used here).
- **Combobox suggestions are a documented composition, not a third control:**
  free-text only = `et-tag-input` standalone; with suggestions = multi `[etSelect]`
  - `allowCustomValues` + `etSelectSearch` (its Tier 3 already renders chips).
    A story demonstrates each.

### Phone input — `forms/phone-input/` (M)

```
forms/phone-input/
  headless/phone-input.directive.ts        [etPhoneInput]        FormValueControl<string>
  headless/phone-input-field.directive.ts  input[etPhoneInputField] type=tel
  headless/phone-countries.ts              static { iso2, dialCode }[] (~250 tiny entries)
  phone-input.component.ts/.html/.css      et-phone-input — country select in prefix + tel input
  phone-input.imports.ts / stories/ / index.ts
```

- **Zero-dep country data:** only ISO alpha-2 + dial code ship; display names come
  from `Intl.DisplayNames(locale, { type: 'region' })`, flags from
  regional-indicator emoji computed off the ISO code.
- `PhoneInputDirective`: `value` (normalized `+<dial><national digits>`), `country`
  model (ISO2), `defaultCountry`, `preferredCountries`; computeds `dialCode`,
  `nationalNumber`, `formattedNational` (**cosmetic generic digit grouping only** —
  documented loudly as not metadata-driven; validation belongs to the
  backend/schema; only an `isPlausible` length-window helper ships). Typing
  `+<digits>` auto-switches `country` by longest-dial-code match.
- Country selector = the select reused wholesale: `[etSelect]` + `etSelectSearch`
  (`filterMode="internal"`) in the form-field prefix slot. First proof the select
  core composes inside another control — schedule after select slice 3.

---

## Phase 6 — Date foundation

Boundary rule for the whole date system: **the calendar and time picker operate on
`Date` objects only**; string↔`Date` conversion happens exclusively in the input
directives. This keeps the calendar reusable and format-agnostic.

- Add `date-fns: 4.1.0` to `libs/components/package.json` peerDependencies.
- `forms/date-time/date-time-formats.ts`: `DATE_FORMAT` / `TIME_FORMAT` /
  `DATE_LOCALE` tokens with `provideDateFormat` / `provideTimeFormat` /
  `provideDateLocale`; defaults `yyyy-MM-dd'T'HH:mm:ssxxx` and `HH:mm`.
  `internals/date-value.ts`: pure `parseDateValue` / `formatDateValue`
  (date-fns `parse`/`format`/`isValid`).

### Calendar — new top-level domain `lib/calendar/` (L)

Top-level because it is usable inline, outside forms.

```
lib/calendar/
  headless/
    calendar.directive.ts            [etCalendar]
    calendar-grid.directive.ts       grid + roving focus + ARIA grid pattern
    internals/calendar-month.ts      pure month-grid generation — unit tested
    internals/calendar-keyboard.ts   arrow/PageUp/Home key math on Dates
  calendar.component.ts/.html/.css   et-calendar (header nav + weekday row + grid)
  calendar-errors.ts
  calendar.imports.ts / stories/ / index.ts
```

- `CalendarDirective` — **range-capable from day one** (retrofitting range onto a
  single-only grid is the known failure mode):
  - Inputs: `mode: 'single' | 'range'`, `min`, `max`, `dateFilter`,
    `firstDayOfWeek`, `locale` (date-fns `Locale` via `provideDateLocale`).
  - Models: `value: Date | null`, `rangeValue: { start; end }`, `activeMonth`.
  - State: `weeks: Signal<CalendarCell[][]>` with per-cell flags (`disabled`,
    `today`, `selected`, `rangeStart/End`, `inRange`, `inHoverPreview`,
    `outsideMonth`); `focusedDate` (roving tabindex), `hoveredDate` (range preview).
  - Methods: `selectDate` (range: first click = start, second = end, third
    restarts), `nextMonth/prevMonth/nextYear/prevYear`, `canGoPrev/canGoNext`.
  - Keyboard (ARIA grid): arrows ±1/±7 days, PageUp/Down ±month, Shift+PageUp/Down
    ±year, Home/End week bounds, Enter/Space select; focus moves `activeMonth`.
- `et-calendar` Tier 3: header (month/year label, prev/next buttons), tokens
  `--et-calendar-cell-size` etc., range highlight styling included from the start.

### Date input — `forms/date-time/date-input/` (M)

- `DateInputDirective` — `FormValueControl<string | null>`; inputs: standard set +
  `valueFormat` (defaults to token), `displayFormat` (locale-aware, e.g. `'P'`),
  `min`/`max`/`dateFilter` forwarded to the calendar.
- Typed entry: free text, strict parse on blur/Enter against `displayFormat`;
  unparseable text keeps the raw string visible, exposes a `parseError` signal
  (shipped validator helper), value stays `null`.
- Picker: `pickerOpen` model + a self-registering `DatePickerTriggerDirective` for
  the suffix calendar button; overlay hosts `et-calendar` in single mode; selecting
  writes `format(date, valueFormat)`.

---

## Phase 7 — Date/time completion

- **`et-date-range-input`** (M) — one registered `FormFieldControl` containing two
  native text inputs (start / separator / end) sharing one range-mode calendar
  overlay; the focused field determines which end a typed entry edits. Value shape
  `{ start: string | null; end: string | null }`. **Spike first:** how signal-forms
  validation errors map per sub-field inside a single form-field error area, and
  whether form-field `focused`/`hasValue` computeds tolerate two native inputs.
- **`et-time-picker`** (M) — inline-capable column-list UI (hours / minutes /
  optional seconds derived from format), `minuteStep` (default 5), roving focus per
  column, scroll-snap + type-to-jump. Model: `Date | null` (time-of-day on a Date).
- **`et-time-input`** (S) — `FormValueControl<string | null>`, `HH:mm` default;
  lenient typed parse (`930` → `09:30`) + time-picker overlay.
- **`et-date-time-input`** (M) — single input, combined display format; overlay
  hosts calendar + time picker (side-by-side desktop, tabbed in bottom sheet).

---

## Phase 8 — Interaction-heavy independents

### Slider — `forms/slider/` (L)

```
forms/slider/
  headless/
    slider.directive.ts          [etSlider]       FormValueControl<number>
    range-slider.directive.ts    [etRangeSlider]  FormValueControl<[number, number]>
    slider-thumb.directive.ts    self-registers with whichever parent exists
    internals/slider-engine.ts   pure math: value↔percent, step snap, clamp, nearest-thumb
  slider.component.* / range-slider.component.*
  slider-errors.ts / slider.imports.ts / stories/ / index.ts
```

- Shared pure engine, two thin directives (two distinct value shapes — same
  reasoning as number vs text input). Inputs: `min`, `max`, `step`, `disabled`;
  range adds `minDistance`.
- Pointer Events + `setPointerCapture` (replaces the cdk mouse/touch RxJS tangle);
  track click moves the nearest thumb.
- A11y: each thumb `role="slider"` with `aria-valuemin/max/now/text`; in range mode
  each thumb's bounds reflect the other; arrows ±step, PageUp/Down ±10×step,
  Home/End. **RTL in v1** (logical positioning + direction-aware keys). Vertical
  orientation and tick labels deferred.
- Tier 3: track/fill/thumb with private `--_et-slider-*` vars set from JS; optional
  thumb value label via `ng-template` slot (cdk `thumb-content-template`
  equivalent). Implements `FormFieldControl` (label/error wiring) like
  switch/checkbox, but has no text-box chrome.

### Masked input — `forms/masked-input/` (L)

```
forms/masked-input/
  headless/
    input-mask.directive.ts      [etInputMask] — layers onto the existing et-input
    internals/mask-engine.ts     pure: applyMask(prevMasked, rawInput, caret, spec)
    internals/masks.ts           grammar: 0=digit, 9=opt digit, a=letter, *=alnum, \ escapes
  masks/currency-mask.ts / iban-mask.ts / card-mask.ts
  masked-input-errors.ts / masked-input.imports.ts / stories/ / index.ts
```

- **Layered on `et-input`, not a new control:** injects `InputDirective`, attaches
  via the public `nativeControl` signal (phase 1 prep), intercepts
  input/paste/keydown, writes through.
- API: `mask: string | MaskSpec`, `maskValueMode: 'raw' | 'masked'` (default
  `'raw'` — form value is unmasked), `placeholderChar`.
- Caret handling: engine computes caret from a diff of (old masked, new raw, caret
  before input) — the engine is pure functions with exhaustive unit tests (the real
  cost of this control). Grammar is deliberately small; IMask-level dynamic blocks
  are out of scope. Currency preset (grouping, decimals, prefix/suffix) covers
  locale-formatted numbers the native `et-number-input` can't.

---

## Docs plan

New VitePress pages as domains ship: `apps/docs/components/select.md`,
`calendar.md`, `date-time.md`, `slider.md` (+ sidebar entries). Smaller controls
(textarea, number, color, rating, OTP, tag, phone, masked) extend
`apps/docs/components/forms.md`. `error-codes.md` updated with every block claim.
Docs and changeset land **with** each control, not as follow-ups.

## Risks / open questions

1. **Selection-state extraction** (phase 2) must not regress radio / checkbox /
   segmented groups — their directive specs are the safety net. Do it first, alone.
2. **Overlay focus:** anchored non-modal path must honor `autoFocus: false` without
   `restoreFocus` fighting the trigger; fix in overlay before select slice 1 if not.
3. **External filtering churn:** with `filterMode="external"`, `@for` recreates
   option directives per keystroke; the active-descendant manager must reconcile
   the active item by value/DOM order (menu's `sortByDomOrder` is the precedent).
4. **Signal-forms typing** for `unknown | unknown[]` select values — may need a
   generic `SelectDirective<T>` and documented casts (precedent:
   `SelectionListDirectiveBase<TValue>`).
5. **Date range** `{ start, end }` value: per-sub-field error mapping and
   form-field single-control assumptions need a spike before phase 7.
6. **Locale:** `provideDateLocale` default (date-fns built-in / en-US) must be
   decided in phase 6 — it shapes every display-format default.
7. **Timezones:** default format includes `xxx` offset → values are local-time
   serializations. Document explicitly; no TZ conversion features planned.
8. **OTP autofill** must be verified on real iOS Safari / Android Chrome — not
   emulatable headlessly.
9. **Chips-in-trigger overflow:** wrap by default (grows field height);
   `--et-select-trigger-max-block-size` + "+N more" collapse as a follow-up.
10. **Error-code table drift:** re-check `docs/COMPONENT-ARCHITECTURE.md` before
    each block claim; source is ahead of the table today (2500/2600 in use).
