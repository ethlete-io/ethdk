# Forms

Signal-forms-native form controls: text, number, textarea and color inputs, checkbox, switch and selection lists, plus the shared field chrome (labels, hints, errors, affixes) that wires accessibility for you. Editing many records at once? The value controls share a [mixed state contract](/components/mixed-state) for bulk editors. For formatted content see the [rich text editor](/components/rich-text-editor) guide, and for file uploads the [dropzone](/components/dropzone) guide.

::: info Signal forms only
These controls implement Angular's [signal forms](https://angular.dev/guide/forms) contracts (`FormValueControl` / `FormCheckboxControl`) and bind via `[formField]` from `@angular/forms/signals`. There is no `ngModel`/`ControlValueAccessor` layer — the classic stack lives only in the legacy `@ethlete/cdk`. Two-way `[(value)]` / `[(checked)]` also works for simple cases.
:::

```ts
private formModel = signal({ email: '' });

protected demoForm = form(this.formModel, (s) => {
  required(s.email, { message: 'Email is required' });
});
```

## Importing

Each control family ships its own imports array — combine the field shell with the controls you use:

| Array                      | Contains                                                                  |
| -------------------------- | ------------------------------------------------------------------------- |
| `FORM_FIELD_IMPORTS`       | `et-form-field`, `et-label`, `et-hint`, `etInputPrefix` / `etInputSuffix` |
| `INPUT_IMPORTS`            | `et-input`                                                                |
| `NUMBER_INPUT_IMPORTS`     | `et-number-input`                                                         |
| `PASSWORD_INPUT_IMPORTS`   | `et-password-input`                                                       |
| `TEXTAREA_IMPORTS`         | `et-textarea`                                                             |
| `COLOR_INPUT_IMPORTS`      | `et-color-input`                                                          |
| `MASKED_INPUT_IMPORTS`     | `etInputMask` (layers onto `et-input`)                                    |
| `CHECKBOX_IMPORTS`         | `et-checkbox`                                                             |
| `SWITCH_IMPORTS`           | `et-switch`                                                               |
| `CHOICE_FIELD_IMPORTS`     | `et-choice-field` + label/hint chrome                                     |
| `RATING_IMPORTS`           | `et-rating`                                                               |
| `OTP_INPUT_IMPORTS`        | `et-otp-input`                                                            |
| `TAG_INPUT_IMPORTS`        | `et-tag-input`                                                            |
| `PHONE_INPUT_IMPORTS`      | `et-phone-input`                                                          |
| `DATE_INPUT_IMPORTS`       | `et-date-input`                                                           |
| `DATE_RANGE_INPUT_IMPORTS` | `et-date-range-input`                                                     |
| `TIME_INPUT_IMPORTS`       | `et-time-input`                                                           |
| `DATE_TIME_INPUT_IMPORTS`  | `et-date-time-input`                                                      |
| `DURATION_INPUT_IMPORTS`   | `et-duration-input`                                                       |

```ts
import { FORM_FIELD_IMPORTS, INPUT_IMPORTS } from '@ethlete/components';
```

The selection-list groups have no aggregate array — import the components directly (`CheckboxGroupComponent` + `CheckboxOptionComponent`, `RadioGroupComponent` + `RadioComponent`, `SegmentedButtonGroupComponent` + `SegmentedButtonComponent`), and the same goes for `DescriptionComponent` (`et-description`). The rich text editor imports (`RICH_TEXT_EDITOR_IMPORTS`, `MULTI_LANGUAGE_RICH_TEXT_EDITOR_IMPORTS`) live in the [rich text editor](/components/rich-text-editor) guide.

## Text fields — `et-form-field` + `et-input`

The form field renders the shell (label, prefix/suffix affixes via `etInputPrefix` / `etInputSuffix`, hint/error support region); the control registers itself into it via DI — no manual wiring:

```html
<et-form-field appearance="box" labelMode="floating-inside">
  <et-label>Email</et-label>
  <span etInputPrefix>@</span>
  <et-input [formField]="demoForm.email" type="email" placeholder="you@example.com" />
  <et-hint>We never share your email.</et-hint>
</et-form-field>
```

<StoryEmbed id="components-forms-input--default" height="320px" />

Field shell variants (as `data-*`-reflected inputs on `et-form-field`):

| Input        | Values                                                            | Default         |
| ------------ | ----------------------------------------------------------------- | --------------- |
| `appearance` | `'box' \| 'underline'`                                            | `'box'`         |
| `fill`       | `'transparent' \| 'filled'`                                       | `'transparent'` |
| `labelMode`  | `'static' \| 'inline' \| 'floating-inside' \| 'floating-outside'` | `'static'`      |
| `size`       | `'sm' \| 'md' \| 'lg'`                                            | `'md'`          |

Only `fill: 'filled'` paints a surface behind the control, so only a filled field raises the surface elevation for its contents (and for overlays anchored inside it, such as the rich text editor's autocomplete). A `transparent` field stays flush with its parent surface.

`et-input` supports `type: 'text' | 'email' | 'password' | 'tel' | 'url' | 'search'`, `placeholder`, `autocomplete`, `textAlign`, and the shared control state (`disabled`, `readonly`, `invalid`, `required`, …). For numbers use [`et-number-input`](#number-input), for plain multi-line text use [`et-textarea`](#textarea-et-textarea), and for formatted content the [rich text editor](/components/rich-text-editor).

A **read-only** text field (set `readonly` in the field schema) keeps its normal box but drops every interactive affordance — no hover/focus border change, default cursor, full-contrast value — so it reads as view-only content. This is distinct from **disabled**, which stays dimmed.

## Number input

`et-number-input` is the numeric sibling of `et-input`: same shell, same look, but its form value is a **`number | null`** instead of a string — an empty or unparseable input reads as `null`, never `NaN` or `''`. It accepts `min`, `max`, `step`, `placeholder`, `autocomplete`, `textAlign`, and the shared control state. The native spin buttons are hidden.

```html
<et-form-field>
  <et-label>Amount</et-label>
  <et-number-input [formField]="demoForm.amount" [min]="0" [step]="0.5" />
  <span etInputSuffix>kg</span>
</et-form-field>
```

Set `stepper` to render −/+ buttons with press-and-hold auto-repeat: each press changes the value by `step` (an empty value starts from `0`), clamped to `min`/`max`, and the exhausted button disables at a bound. The buttons stay out of the tab order (the native input already steps with the arrow keys) and take `incrementLabel` / `decrementLabel` for their accessible names (defaults `'Increment'` / `'Decrement'`). Design token: `--et-number-input-stepper-size` (default `16px`).

## Password input — `et-password-input`

The password sibling of `et-input` with the affordances people expect. The form value is a plain `string`; `autocomplete` defaults to `'current-password'` (set `'new-password'` on registration forms).

```html
<et-form-field>
  <et-label>Password</et-label>
  <et-password-input #pw="etPasswordInput" [formField]="demoForm.password" [capsLockWarning]="true" />
</et-form-field>
```

- **Reveal toggle** (on by default, `revealable`): an eye button switching the native `type` between `password`/`text`, exposed as `aria-pressed`. Its accessible name is state-aware — `revealLabel` (default `'Show password'`) while hidden, `hideLabel` (default `'Hide password'`) while shown. The revealed state is also a two-way `revealed` model.
- **Caps Lock warning** (opt-in, `capsLockWarning`): a `role="status"` warning icon while the field is focused and Caps Lock is on, with `capsLockLabel` (default `'Caps Lock is on'`) as screen-reader text.
- **Strength score**: the directive exposes `strength` — a 0–4 typing-feedback score from a pure length + character-class heuristic (deliberately not a zxcvbn-style security estimate). Grab it via the `etPasswordInput` export and render any meter you like next to the field (see the `Strength Meter` story).

Design token: `--et-password-input-reveal-size` (default `16px`).

Try it live in Storybook: `Components/Forms/Password Input`.

## Textarea — `et-textarea`

Multi-line plain text with **autosize on by default**: the field grows with its content and shrinks back, clamped by `minRows` (defaults to `rows`, default 3) and `maxRows` (unbounded when unset). Beyond `maxRows` the content scrolls. With `autosize` off the native resize handle takes over, controlled by `resize: 'none' | 'vertical'` (an autosizing textarea is never manually resizable).

```html
<et-form-field>
  <et-label>Message</et-label>
  <et-textarea [formField]="demoForm.message" [maxRows]="8" placeholder="Write something…" />
</et-form-field>
```

Try it live in Storybook: `Components/Forms/Textarea`.

## Color input

`et-color-input` wraps the native color picker: a swatch plus the picked hex value, with the real `input[type=color]` stretched invisibly over it so clicking anywhere opens the platform picker. The form value is `'#rrggbb' | null` — `null` until something is picked (the swatch shows black). `[readonly]` is honored (the native `<input type="color">` ignores the attribute, so the control blocks the picker-opening interactions itself while keeping the field focusable).

```html
<et-form-field>
  <et-label>Brand color</et-label>
  <et-color-input [formField]="demoForm.brandColor" />
</et-form-field>
```

Design tokens: `--et-color-input-swatch-size` (default `20px`), `--et-color-input-swatch-radius` (default `4px`).

Try it live in Storybook: `Components/Forms/Color Input`.

## Masked input — `[etInputMask]`

Masking is a directive layered onto the existing text input, not a separate control — place `etInputMask` on the `et-input` (or a headless `input[etInput]`). The native element always shows the masked text; the **form value stays raw by default** (`maskValueMode: 'raw' | 'masked'`).

<StoryEmbed id="components-forms-masked-input--default" height="320px" />

```html
<et-form-field>
  <et-label>Date of birth</et-label>
  <et-input [formField]="demoForm.birthday" etInputMask="00-00-0000" />
</et-form-field>
```

The mask is either a **pattern string** — `0` digit, `9` optional digit, `a` letter, `*` alphanumeric, `\` escapes the next character, everything else is a literal — or a `MaskSpec` object. Binding `null` disables the mask entirely (native input handling stays in charge), so a mask can be applied conditionally. Three factories ship:

| Factory                       | Behavior                                                                                                                                                                                                                                                    |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `createCurrencyMask(options)` | Right-growing grouped number (`1.234.567,89`), configurable `decimalSeparator` (`','`), `groupSeparator` (`'.'`), `decimals` (`2`), `prefix`/`suffix`, `allowNegative` (`false`). Raw value is the ungrouped amount using the configured decimal separator. |
| `createIbanMask()`            | Uppercases and groups by four; charset/length only — structural validation belongs to the schema/backend.                                                                                                                                                   |
| `createCardMask()`            | Digit-only, grouped by four, capped at 19 digits.                                                                                                                                                                                                           |

Typing behavior: literals render eagerly and the caret glides past them onto the next slot; backspacing over a literal deletes the content character before it; pastes are filtered through the mask (`31.12.2024` fills `00-00-0000`). With `placeholderChar` set (pattern masks only), unfilled slots render as a guide (`31-1_-____`) while the field is focused. IME composition (CJK, dead keys) is left alone mid-composition and reconciled on `compositionend`, so the candidate window is never torn down. Custom masks implement `MaskSpec` (`toRaw`/`toDisplay` plus optional caret metadata) — see the type's docs.

The directive exposes two signals (via `exportAs: 'etInputMask'`): `rawValue()` — the unmasked text regardless of `maskValueMode` — and `complete()` — whether every required slot is filled (`0`/`a`/`*` required, `9` optional; `null` for masks that don't track completeness, like the factories). Wire `complete()` into schema validation to require fully-filled masks.

**Custom hosts**: the mask attaches to `et-input` out of the box, but any text control can host it by providing `INPUT_MASK_HOST` on itself (`{ provide: INPUT_MASK_HOST, useExisting: MyFieldDirective }`) — the contract is a `value` model, a `focused` signal, a `nativeControl` element signal and a `suppressNativeSync()` hook (the mask takes over value-sync), plus an optional `resumeNativeSync()` for hosts whose mask can toggle back to `null`. The [date](#date-input-—-et-date-input), [time](#time-input-—-et-time-input), [date-time](#date-time-input-—-et-date-time-input) and [date range](#date-range-input-—-et-date-range-input) inputs host a mask this way behind their opt-in `mask` input.

Try it live in Storybook: `Components/Forms/Masked input`.

## Checkbox & switch — `et-choice-field`

Boolean controls pair with a label inside `et-choice-field` (instead of `et-form-field`):

```html
<et-choice-field>
  <et-checkbox [formField]="demoForm.acceptTerms" />
  <et-label>I accept the terms and conditions</et-label>
</et-choice-field>

<et-choice-field>
  <et-switch [formField]="demoForm.notifications" />
  <et-label>Email notifications</et-label>
</et-choice-field>
```

- `et-checkbox` — `role="checkbox"`, `checked` + `indeterminate` models (`aria-checked="mixed"` when indeterminate; toggling an indeterminate checkbox resolves to checked).
- `et-switch` — `role="switch"`, `checked` + `indeterminate` models (toggling an indeterminate switch resolves to checked). Because `role="switch"` cannot carry `aria-checked="mixed"`, the indeterminate state is presentational only — the thumb parks mid-track behind `data-indeterminate` while `aria-checked` stays boolean.
- Both toggle on click and <kbd>Space</kbd>, and mark themselves touched on blur.
- Both honor `readonly` (e.g. from a `readonly(...)` schema): the control keeps its normal look and stays focusable (`aria-readonly`), it just cannot be toggled — distinct from the dimmed `disabled` state.
- `et-choice-field` accepts `size: 'sm' | 'md' | 'lg'` (default `'md'`), scaling the control and label together.

## Rating — `et-rating`

A star rating implementing the slider pattern (`role="slider"`, one keyboard stop). Value is `number | null` — `null` means no rating.

```html
<et-rating [formField]="demoForm.stars" [max]="5" [allowHalf]="true">
  <et-label>Rating</et-label>
  <et-hint>Optional</et-hint>
</et-rating>
```

<StoryEmbed id="components-forms-rating--default" height="220px" />

| Input       | Type                  | Default | Description                                                                              |
| ----------- | --------------------- | ------- | ---------------------------------------------------------------------------------------- |
| `max`       | `number \| undefined` | `5`     | Number of steps. Reserved by signal forms — a schema `max(...)` validator binds into it. |
| `allowHalf` | `boolean`             | `false` | Half-star steps for pointer, keyboard and rendering.                                     |
| `readonly`  | `boolean`             | `false` | Display-only (still focusable, e.g. for review averages).                                |

Interaction: hovering previews without committing, clicking commits (clicking the current value **clears** to `null`), and **dragging/swiping across the stars** (mouse or touch) previews continuously and commits on release — vertical page scrolling stays untouched (`touch-action: pan-y`). Arrows step by `1` (or `0.5`), <kbd>Home</kbd>/<kbd>End</kbd> jump to first/last step, <kbd>Backspace</kbd>/<kbd>Delete</kbd> clear — arrowing below the first step also clears. The host exposes `aria-valuemin="0"`/`aria-valuemax`/`aria-valuenow` and an `aria-valuetext` like `3.5 of 5`.

The default stars fill as **one continuous motion** — a single clipped overlay row sweeps across the icons with the theme's primary color. Custom icons via an `ng-template[etRatingIcon]` (context: the state `'full' | 'half' | 'empty'` and the 1-based `index`) render per-step instead and don't take part in the sweep. Tokens: `--et-rating-icon-size` (`24px`), `--et-rating-gap` (`4px`).

## OTP / PIN input — `et-otp-input`

Segmented one-time-code entry backed by **one real native input** stretched invisibly over the segments — that single input is what makes iOS/Android SMS autofill (`autocomplete="one-time-code"`) and native paste reliable. Value is the raw string.

```html
<et-otp-input [formField]="demoForm.code" [length]="6" (completed)="verify($event)">
  <et-label>Verification code</et-label>
</et-otp-input>
```

Try it live in Storybook: `Components/Forms/OTP Input`.

| Input     | Type                                    | Default     | Description                                                           |
| --------- | --------------------------------------- | ----------- | --------------------------------------------------------------------- |
| `length`  | `number`                                | `6`         | Number of characters/segments.                                        |
| `charset` | `'numeric' \| 'alphanumeric' \| RegExp` | `'numeric'` | Accepted characters — everything else is stripped (pastes included).  |
| `masked`  | `boolean`                               | `false`     | Renders dots instead of characters (PIN entry); the value stays real. |

The `completed` output emits the value each time it reaches the full length. Pastes strip separators (`123-456` → `123456`) and truncate. Editing is append/delete-at-end (the caret is pinned to the end), with the active segment marked visually. Tokens: `--et-otp-input-segment-size` (`44px`), `--et-otp-input-segment-gap` (`8px`), `--et-otp-input-segment-radius` (`8px`).

::: warning Verify autofill on real devices
SMS autofill behavior cannot be emulated headlessly — test `one-time-code` flows on real iOS Safari and Android Chrome.
:::

## Tag input — `et-tag-input`

Free-text tags as removable [chips](/components/chip) with an inline text field, inside the regular `et-form-field` shell. Value is `string[]`. For tags **with suggestions**, use the [select](/components/select) instead (`multiple` + `etSelectSearch` + `allowCustomValues`) — its custom-value mode covers the full tag-input ergonomics on top of an option list: a "Create …" row, separator commit (`customValueSeparators`), paste splitting, commit-on-close (`commitCustomValueOnClose`), `normalizeCustomValue` and `maxSelection`. The tag input remains the deliberately minimal variant for pure free-text entry with no panel at all.

```html
<et-form-field>
  <et-label>Tags</et-label>
  <et-tag-input [formField]="demoForm.tags" placeholder="Add a tag…" />
</et-form-field>
```

Try it live in Storybook: `Components/Forms/Tag Input`.

| Input             | Type                              | Default          | Description                                                                                                               |
| ----------------- | --------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `separators`      | `string[]`                        | `['Enter', ',']` | What commits the pending text: multi-character entries are key names, single characters commit as typed and split pastes. |
| `allowDuplicates` | `boolean`                         | `false`          | Rejected duplicates keep the text in the field for editing.                                                               |
| `normalizeTag`    | `(raw: string) => string \| null` | trim             | Maps raw text to the stored tag — return `null` to reject.                                                                |
| `maxTags`         | `number \| undefined`             | `undefined`      | Further adds are ignored once reached.                                                                                    |

Pending text also commits on blur; <kbd>Backspace</kbd> on the empty field removes the last tag; pastes split on separator characters and newlines. The chips are pointer-removable (`×`, out of the tab order) — see the [chip](/components/chip) guide.

## Phone input — `et-phone-input`

A tel input with a searchable country picker (the [select](/components/select) headless core composed inside the control). Value is a normalized `+<dialCode><national digits>` string. **Zero dependencies**: only ISO codes + dial codes ship — country names come from `Intl.DisplayNames`, flags from regional-indicator emoji.

```html
<et-form-field>
  <et-label>Phone number</et-label>
  <et-phone-input [formField]="demoForm.phone" [preferredCountries]="['de', 'at', 'ch']" defaultCountry="de" />
</et-form-field>
```

<StoryEmbed id="components-forms-phone-input--default" height="220px" />

| Input                | Type       | Default            | Description                                            |
| -------------------- | ---------- | ------------------ | ------------------------------------------------------ |
| `defaultCountry`     | `string`   | `'us'`             | ISO alpha-2 country used while the value carries none. |
| `preferredCountries` | `string[]` | `[]`               | Listed on top of the country dropdown.                 |
| `countryLabel`       | `string`   | `'Select country'` | `aria-label` of the flag/dial-code country trigger.    |

Typing national digits builds the `+dial` value; a national trunk `0` is stripped (`0171…` with Germany active → `+49171…` — except for countries like Italy where the `0` is part of the number), and the `00` international call prefix works like `+` (`0049…` → `+49…`). Typing or pasting a full `+…` number re-derives the country by longest dial-code match — but a manually picked country survives shared dial codes (`+1` stays Canada if you chose Canada). Switching countries keeps the national number. The display groups digits in threes while unfocused (**cosmetic only** — not per-country metadata formatting; validate on the backend/schema, with `isPlausible` as a cheap length-window helper).

The country dropdown searches names **and** dial codes (`49` or `+49` finds Germany) and shows an empty row when nothing matches. Replace the emoji flags (trigger and option list) with custom art by projecting an `ng-template[etPhoneInputFlag]` — it receives the country (`iso2`, `dialCode`, and the default emoji `flag`) as context:

```html
<et-phone-input [formField]="demoForm.phone">
  <ng-template etPhoneInputFlag let-country>
    <img [src]="'/flags/' + country.iso2 + '.svg'" alt="" />
  </ng-template>
</et-phone-input>
```

## Date input — `et-date-input`

A date form control with a **string value** in a configurable wire format, combining typed entry with an anchored [calendar](/components/calendar) picker. String↔`Date` conversion happens only in the control — the calendar itself operates on `Date` objects.

```html
<et-form-field>
  <et-label>Date</et-label>
  <et-date-input [formField]="demoForm.date" valueFormat="yyyy-MM-dd" />
</et-form-field>
```

<StoryEmbed id="components-forms-date-input--default" height="560px" />

| Input                 | Type                                | Default                       | Description                                                                  |
| --------------------- | ----------------------------------- | ----------------------------- | ---------------------------------------------------------------------------- |
| `valueFormat`         | `string`                            | `DATE_FORMAT` token           | date-fns format of the string value (token default: ISO 8601 with offset).   |
| `displayFormat`       | `string`                            | `'P'`                         | date-fns format shown in and parsed from the field (locale-aware).           |
| `locale`              | `Locale \| null` (date-fns)         | `DATE_LOCALE` token           | Display/parse locale.                                                        |
| `minDate` / `maxDate` | `Date \| null`                      | `null`                        | Forwarded to the picker calendar (`min`/`max` are reserved by signal forms). |
| `dateFilter`          | `((date: Date) => boolean) \| null` | `null`                        | Forwarded to the picker calendar.                                            |
| `pickerOpen`          | `boolean` (model)                   | `false`                       | The picker overlay's open state.                                             |
| `pickerTriggerLabel`  | `string`                            | `'Open calendar'`             | `aria-label` of the suffix calendar button.                                  |
| `parseErrorMessage`   | `string`                            | `'Please enter a valid date'` | Message shown below the field when typed text can't be parsed.               |
| `clearable`           | `boolean`                           | `true`                        | Clear (×) button while the focused field has a value (label: `clearLabel`).  |
| `mask`                | `boolean`                           | `false`                       | Opt-in typing mask derived from a fixed-width numeric `displayFormat`.       |

Typed text is parsed **strictly** against `displayFormat` on blur/Enter. Unparseable text stays visible in the field, the `parseError` signal (on the `[etDateInput]` directive) turns on and the value is cleared to `null` — wire it into your schema validation, or rely on the built-in error display: once the field is touched, a parse error is announced as a real message (`parseErrorMessage`) with matching `aria-invalid`/`aria-describedby`. Alt+ArrowDown also opens the picker; picking a day writes `format(date, valueFormat)` and closes it. The picker overlay is a named `role="dialog"`.

**Opt-in typing mask**: with `mask` set, a fixed-width numeric `displayFormat` (`dd.MM.yyyy`, `MM/dd/yyyy`, …) drives a live [input mask](#masked-input-—-etinputmask) — guide placeholders (`__.__.____`) while focused, auto-inserted separators, filtered pastes, and a numeric soft keyboard (`inputmode="numeric"`). The mask only shapes typing; committing still goes through the same blur/Enter parse, so behavior like clearing on empty text is unchanged. Formats the mask cannot represent — locale formats like the default `P`/`p`/`Pp`, variable-width tokens (`d.M.yyyy`), text tokens (`MMM`, am/pm markers) — are refused with a dev-mode warning and typing stays unmasked. The same input ships on the time, date-time and date range inputs; the duration input deliberately has none (see below).

<StoryEmbed id="components-forms-date-input--masked" height="360px" />

On viewports below the `md` breakpoint (768px) the picker opens as a **bottom sheet** (backdrop, drag-to-dismiss, touch-sized cells) instead of an anchored panel — this applies to all date & time picker overlays (date, date range, time).

While the focused field holds a value (or pending text), a pointer-only **clear (×) button** renders before the picker trigger — one click resets the value, text and parse state, mirroring the [select](/components/select)'s clear affordance. Disable it with `clearable="false"`; the accessible name comes from `clearLabel`. The same affordance ships on the time, date-time, duration and [phone](#phone-input-—-et-phone-input) inputs (keyboard users clear by erasing the text).

The wire defaults come from injectable tokens so an app can set them once:

```ts
import { provideDateFormat, provideDateLocale } from '@ethlete/components';
import { de } from 'date-fns/locale';

providers: [provideDateFormat('yyyy-MM-dd'), provideDateLocale(de)];
```

`date-fns` (v4) is a peer dependency of the date controls: `yarn add date-fns`.

## Date range input — `et-date-range-input`

One registered form control containing two text inputs (start – end) that share a single range-mode [calendar](/components/calendar) picker. The value shape is `{ start: string | null; end: string | null }` in `valueFormat`; each side commits exactly like the single date input (strict `displayFormat` parse on blur/Enter, per-side `startParseError` / `endParseError` signals, unparseable text stays visible).

```html
<et-form-field>
  <et-label>Date range</et-label>
  <et-date-range-input [formField]="demoForm.range" valueFormat="yyyy-MM-dd" />
</et-form-field>
```

Options mirror the date input (`valueFormat`, `displayFormat`, `locale`, `mask`, `minDate`/`maxDate`/`dateFilter`, `pickerOpen`), with `startPlaceholder`/`endPlaceholder` and per-field `startAriaLabel`/`endAriaLabel` (defaults `'Start date'`/`'End date'`; the host is a `role="group"` labelled by the field label). The [opt-in typing mask](#date-input-—-et-date-input) applies to both fields — each side is its own mask host, so the guide only shows on the focused side. In the picker, the first click starts the range and a completed range closes it; a partial pick keeps it open.

<StoryEmbed id="components-forms-date-range-input--masked" height="360px" />

**Validation:** signal forms attaches child-path errors (e.g. `required(s.range.start)`) to the sub-fields — they flip the control's invalid state, but their messages don't reach the field's single error area. Validate on the range path for messages you want displayed:

```ts
validate(s.range, ({ value }) => {
  const { start, end } = value();

  return start !== null && end !== null && start > end
    ? { kind: 'range-order', message: 'The start date must be before the end date' }
    : null;
});
```

Try it live in Storybook: `Components/Forms/Date Range Input`.

## Time input — `et-time-input`

A time form control with a **string value** in a configurable wire format (default `HH:mm`), combining lenient typed entry with an anchored [time picker](/components/time-picker) overlay. String↔`Date` conversion happens only in the control — the picker itself operates on `Date` objects.

```html
<et-form-field>
  <et-label>Time</et-label>
  <et-time-input [formField]="demoForm.time" />
</et-form-field>
```

| Input                       | Type                        | Default              | Description                                                                                                               |
| --------------------------- | --------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `valueFormat`               | `string`                    | `TIME_FORMAT` token  | date-fns format of the string value (token default: `HH:mm`).                                                             |
| `displayFormat`             | `string`                    | `'p'`                | date-fns format shown in and parsed from the field (locale-aware).                                                        |
| `locale`                    | `Locale \| null` (date-fns) | `DATE_LOCALE` token  | Display/parse locale (also decides the picker's 12/24-hour layout).                                                       |
| `minuteStep` / `secondStep` | `number`                    | `5` / `1`            | Forwarded to the picker columns.                                                                                          |
| `pickerOpen`                | `boolean` (model)           | `false`              | The picker overlay's open state.                                                                                          |
| `pickerTriggerLabel`        | `string`                    | `'Open time picker'` | `aria-label` of the suffix clock button.                                                                                  |
| `mask`                      | `boolean`                   | `false`              | Opt-in typing mask — see the [date input](#date-input-—-et-date-input); needs a fixed-width `displayFormat` like `HH:mm`. |

Typed text is parsed against `displayFormat` first, then **leniently**: bare digit runs (`930` → 09:30, `0930`, `93015`), loose separators (`9.30`, `9 30`) and meridiem suffixes (`930pm`, `9 a.m.`) all commit, and 24-hour entry is accepted even under a 12-hour display format. Unparseable text behaves exactly like the date input (`parseError` signal, value stays `null`). Alt+ArrowDown opens the picker; picking parts writes `format(time, valueFormat)` and — unlike the calendar picker — **keeps the overlay open**, since a time takes one pick per column. Below the `md` breakpoint the picker opens as a bottom sheet, like the date pickers.

The wire defaults share the date tokens (`provideTimeFormat('HH:mm:ss')`, `provideDateLocale(de)`).

Try it live in Storybook: `Components/Forms/Time Input`.

## Date-time input — `et-date-time-input`

A combined date & time form control with a **string value** in a configurable wire format (default: the `DATE_FORMAT` token, ISO 8601 with offset — it already carries the time). One field, one combined display format; the anchored picker overlay hosts a [calendar](/components/calendar) and a [time picker](/components/time-picker) **side by side** and stays open across picks (pick a day, then a time). Below the `md` breakpoint the picker opens as a bottom sheet with **Date / Time tabs** switching between the two panes.

```html
<et-form-field>
  <et-label>Kick-off</et-label>
  <et-date-time-input [formField]="demoForm.kickOff" />
</et-form-field>
```

| Input                           | Type                                | Default                     | Description                                                                                                                          |
| ------------------------------- | ----------------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `valueFormat`                   | `string`                            | `DATE_FORMAT` token         | date-fns format of the string value (token default: ISO 8601 with offset).                                                           |
| `displayFormat`                 | `string`                            | `'Pp'`                      | Combined date-fns format shown in and parsed from the field (locale-aware).                                                          |
| `locale`                        | `Locale \| null` (date-fns)         | `DATE_LOCALE` token         | Display/parse locale (also decides the time picker's 12/24-hour layout).                                                             |
| `minDate` / `maxDate`           | `Date \| null`                      | `null`                      | Forwarded to the picker calendar (`min`/`max` are reserved by signal forms).                                                         |
| `dateFilter`                    | `((date: Date) => boolean) \| null` | `null`                      | Forwarded to the picker calendar.                                                                                                    |
| `minuteStep` / `secondStep`     | `number`                            | `5` / `1`                   | Forwarded to the time picker columns.                                                                                                |
| `pickerOpen`                    | `boolean` (model)                   | `false`                     | The picker overlay's open state.                                                                                                     |
| `pickerTriggerLabel`            | `string`                            | `'Open date & time picker'` | `aria-label` of the suffix calendar button.                                                                                          |
| `dateTabLabel` / `timeTabLabel` | `string`                            | `'Date'` / `'Time'`         | Labels of the pane tabs in the bottom sheet.                                                                                         |
| `mask`                          | `boolean`                           | `false`                     | Opt-in typing mask — see the [date input](#date-input-—-et-date-input); needs a fixed-width `displayFormat` like `dd.MM.yyyy HH:mm`. |

Typed text is parsed **strictly** against `displayFormat` first, then leniently: the entry split into a date and a time at any separator (the date against the locale's short `P` format, the time with the time input's lenient rules — `7/16/2026 930pm` commits), and a **bare date commits at midnight**. Unparseable text behaves exactly like the date input (`parseError` signal, value stays `null`).

In the picker, selections **merge**: picking a day keeps the committed time of day, picking a time keeps the committed day — and neither closes the overlay (close it via Escape, an outside click or the trigger). While the value is still empty, a first day pick commits the day **at midnight** (like a typed bare date) — the time never defaults to the current wall-clock time; a first time pick completes with today as the day. Alt+ArrowDown opens the picker from the field.

Try it live in Storybook: `Components/Forms/Date Time Input`.

## Duration input — `et-duration-input`

A duration form control whose value is a **total elapsed time in milliseconds** (`number | null`) — not a `Date`. A duration is a distinct scalar quantity (split times, race durations, effort windows), so it stays out of the calendar/time `Date` system and owns its own value contract.

```html
<et-form-field>
  <et-label>Lap time</et-label>
  <et-duration-input [formField]="demoForm.lap" durationFormat="mm:ss" />
</et-form-field>
```

| Input            | Type     | Default   | Description                                                        |
| ---------------- | -------- | --------- | ------------------------------------------------------------------ |
| `durationFormat` | `string` | `'mm:ss'` | Segment layout — runs of `h`/`m`/`s`/`S` (millis) plus separators. |
| `placeholder`    | `string` | `''`      | Shown on the empty field.                                          |

The format is any arrangement of unit-token runs and separators: `mm:ss`, `hh:mm:ss`, `hh:mm:ss.SSS`, `h m`. Typed text commits on blur/Enter with a **lenient parse**: a bare digit run fills from the smallest unit up (`130` → `01:30`, `90` → `01:30` under `mm:ss`), and separator entry maps left-to-right (`1:30`, `1:02:03`). Milliseconds are literal and need the decimal separator (`1:30.500`). Unparseable text is kept visible with a `parseError` (value stays `null`), exactly like the date/time inputs. The largest unit is unbounded (`100:00` is a valid `mm:ss` value); validation of any upper bound belongs to the schema.

Unlike the date/time inputs, the duration input has **no opt-in typing mask** — and that's deliberate: its first segment is unbounded, so a fixed slot layout would block valid entries (`100:00`), and its lenient parse fills from the _smallest_ unit up (`130` → `01:30`) while a mask fills slots left-to-right (`130` → `13:0…`), silently changing what an established entry habit means.

Try it live in Storybook: `Components/Forms/Duration Input`.

## Selection lists

Three group flavors over one selection engine — options are projected children, keyboard navigation is roving-tabindex with wrapping arrows:

| Group                       | Options               | Mode     | Value        |
| --------------------------- | --------------------- | -------- | ------------ |
| `et-checkbox-group`         | `et-checkbox-option`  | multiple | array        |
| `et-radio-group`            | `et-radio`            | single   | single value |
| `et-segmented-button-group` | `et-segmented-button` | single   | single value |

```html
<et-radio-group [formField]="demoForm.color">
  <et-label>Favorite color</et-label>
  @for (option of options(); track option.value) {
  <et-radio [value]="option.value">{{ option.label }}</et-radio>
  }
  <et-hint>Pick one.</et-hint>
</et-radio-group>
```

- The group label is a projected `et-label` — it renders the `*` marker when the group is `required` and wires `aria-labelledby`. A plain `<span class="et-<group>-label">` also works for text-only labels.
- All three groups accept `size: 'sm' | 'md' | 'lg'` (default `'md'`), matching the `et-form-field` size scale.
- All three groups honor `readonly`: options keep their normal focusable look, arrow keys still move focus (without the radio pattern's select-while-roving), but nothing can be (de)selected — distinct from the dimmed `disabled` state.
- The segmented button group renders its options on a tonal track; the filled active pill animates between options on selection.

Checkbox options and radios accept an `et-description` child for secondary text, and the headless layer offers a tri-state "select all" control (`[etSelectionListControl]`).

Try the three group flavors live in Storybook: `Components/Forms/Selection List`.

## Mixed values (bulk editing)

When one form edits several records whose values disagree, every value control on this page implements the SDK-wide [mixed state contract](/components/mixed-state): set `[(mixed)]="true"` and the control masks its hidden raw value (nothing reads as selected, the field renders empty) and exposes `data-mixed` for styling; the first user commit **replaces** the value and resolves `mixed` to `false`. It is explicitly controlled — external value writes never resolve it, so set it back to `false` yourself once external data establishes one value. See the shared guide for the full contract, wiring recipe, and per-control presentation table.

- **Text-slot controls take a `mixedLabel`** (default `'Mixed'`) shown in place of the value while mixed: `et-input`, `et-number-input`, `et-password-input`, `et-textarea` (placeholder), `et-color-input`, `et-tag-input`, `et-phone-input`, and the date/time family (`et-date-input`, `et-date-range-input`, `et-time-input`, `et-date-time-input`, `et-duration-input`).
- **Controls without a text slot** express it through ARIA/visual masking only — no `mixedLabel`: `et-rating` (`aria-valuetext`), and the selection groups `et-radio-group`, `et-checkbox-group`, `et-segmented-button-group` (nothing `aria-checked`).
- **Boundaries.** `et-checkbox` and `et-switch` carry this concept as their platform-named `indeterminate` input (see above) rather than `mixed`. `et-checkbox` reflects it as `aria-checked="mixed"`; `et-switch` can't (`role="switch"` is strictly two-state in ARIA) so its indeterminate state is presentational only and unannounced — prefer `et-checkbox` when the mixed state must reach assistive tech. `et-otp-input` and the rich text editors are not bulk-edit fields.

Each control's `Mixed` Storybook story (under its `Components/Forms/…` entry) demonstrates the masking and the first-commit-replaces behavior.

## Validation & accessibility

The field chrome handles error display and aria wiring uniformly:

- Errors show once a control is **touched and invalid** — each signal-forms `ValidationError` renders as an `et-form-error` in the support region (`aria-live="polite"`), replacing the hint with an animated transition. While erroring, the field forces the app's error color theme (the theme registered with `type: 'error'`).
- A **parse error** (unparseable typed text in the date/time/date-time/duration inputs) is surfaced the same way once touched: its `parseErrorMessage` renders as an error, with matching `aria-invalid` and `aria-describedby` — no more silent invalid state.
- `aria-describedby` on the control automatically points at the active error (or hint), `aria-labelledby` at the `et-label`; the label renders a `*` marker when the control is `required`.
- Selection groups use correct roles for their mode: a single-select group is a `radiogroup` of `radio`s; a multi-select checkbox group is a `role="group"` of `role="checkbox"` items (and the tri-state select-all is a `checkbox`, not an `option`).
- A schema-`hidden` field (signal-forms `hidden`) removes the whole `et-form-field` from layout and the accessibility tree.
- Dev mode throws an actionable error ([`ET2200`](/components/error-codes#form-field-et22xx)) if an `et-form-field` contains no control.

### Server-side violations

`@ethlete/query` ships a bridge that maps an API error response's violation list onto a signal form, so backend validation surfaces on the exact fields it belongs to. Return `mapViolationsToFormErrors` from a `submit()` action — mapped violations render in each field's error region like any other validation error, and signal forms clears them automatically when the user edits the field:

```ts
import { submit } from '@angular/forms/signals';
import { executeUntilSettled, mapViolationsToFormErrors } from '@ethlete/query';

protected async save() {
  await submit(this.form, async (field) => {
    const snapshot = await executeUntilSettled(this.createUserQuery, { args: { body: field().value() } });
    const error = snapshot.error();

    if (!error) return;

    return mapViolationsToFormErrors({ fieldTree: field, error });
  });
}
```

Violation property paths (e.g. `items[2].name`) resolve against the form's field tree; anything that doesn't match a field becomes a form-level error on the submitted field, and a failure without violations degrades to a form-level error built from the normalized message — a failed submit never disappears silently. The mapping options (`rewritePath`, `onUnmappedViolation`) and accepted error shapes are documented in the [query error guide](/query/errors#mapping-violations-onto-signal-forms).

### Custom error messages

`et-form-error` renders each error's `message` verbatim; a validator without a `message` renders an empty row. To centralize or localize error texts, provide a resolver — it sees every `ValidationError` (including the bridge's `etServerViolation` kind) and returns the text to show, or `null` to fall back to the error's own message:

```ts
import { provideFormErrorMessageResolver } from '@ethlete/components';

provideFormErrorMessageResolver((error) => {
  switch (error.kind) {
    case 'required':
      return 'This field is required';
    case 'minLength':
      return 'Too short';
    default:
      return null;
  }
});
```

## Theming

Every control family declares public design tokens; override them in your CSS scope:

| Component                                           | Tokens                                                                                                                                                                                                                                                                                           |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `et-form-field`                                     | `--et-form-field-gap`, `-control-border-radius` / `-border-width` / `-padding-block` / `-padding-inline` / `-font-size` / `-line-height` / `-affix-gap` / `-disabled-opacity` / `-min-height`, `-label-font-size`, `-error-font-size`, `-hint-font-size`, `-support-duration`, `-support-offset` |
| `et-checkbox`                                       | `--et-checkbox-size`, `-border-radius`, `-border-width`, `-transition-duration`, `-opacity-disabled`                                                                                                                                                                                             |
| `et-switch`                                         | `--et-switch-track-width`, `-track-height`, `-thumb-size`, `-thumb-offset`, `-transition-duration`, `-opacity-disabled`                                                                                                                                                                          |
| `et-choice-field`                                   | `--et-choice-field-gap`, `-support-duration`, `-support-offset`, `-label-font-size`, `-error-font-size`, `-hint-font-size`                                                                                                                                                                       |
| `et-radio-group` / `et-radio`                       | `--et-radio-group-*` (gap, label/error/hint sizes, support), `--et-radio-size`, `-dot-size`, `-border-width`, `-transition-duration`, `-opacity-disabled`, `-gap`                                                                                                                                |
| `et-checkbox-group` / `et-checkbox-option`          | `--et-checkbox-group-*` (gap, label/error/hint sizes, support), `--et-checkbox-option-size`, `-border-width`, `-border-radius`, `-transition-duration`, `-opacity-disabled`, `-gap`                                                                                                              |
| `et-segmented-button-group` / `et-segmented-button` | `--et-segmented-button-group-*` (gap, label/error/hint sizes, support, `-track-padding`, `-track-radius`), `--et-segmented-button-padding-x` / `-padding-y`, `-border-radius`, `-transition-duration`, `-opacity-disabled`                                                                       |

All colors resolve through the [surface/color theme systems](/core/theming) (the error state forces the theme registered with `type: 'error'`). The rich text editor's tokens are documented in its [own guide](/components/rich-text-editor#theming).

## Error codes

An `et-form-field` without a control throws [`ET2200`](/components/error-codes#form-field-et22xx) in dev mode, and an `[etInputMask]` placed outside an input control throws [`ET3200`](/components/error-codes#masked-input-et32xx).
