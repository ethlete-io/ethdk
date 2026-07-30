# Text inputs

The text-based form controls: the plain [text field](#text-field) and its
siblings — [number](#number-input), [password](#password-input),
[textarea](#textarea), [color](#color-input), the
[masked-input directive](#masked-input), and the specialized
[OTP](#otp-input), [tag](#tag-input) and [phone](#phone-input) inputs. They all
sit inside the shared [`et-form-field` shell](/components/forms#the-field-shell)
and bind via signal forms — see the [Forms overview](/components/forms) for the
field chrome, validation, mixed-state and theming contracts they inherit.

Each control ships its own imports array; combine the field shell with the
control you use:

```ts
import { FORM_FIELD_IMPORTS, INPUT_IMPORTS } from '@ethlete/components';
```

| Array                    | Contains                               |
| ------------------------ | -------------------------------------- |
| `INPUT_IMPORTS`          | `et-input`                             |
| `NUMBER_INPUT_IMPORTS`   | `et-number-input`                      |
| `PASSWORD_INPUT_IMPORTS` | `et-password-input`                    |
| `TEXTAREA_IMPORTS`       | `et-textarea`                          |
| `COLOR_INPUT_IMPORTS`    | `et-color-input`                       |
| `MASKED_INPUT_IMPORTS`   | `etInputMask` (layers onto `et-input`) |
| `OTP_INPUT_IMPORTS`      | `et-otp-input`                         |
| `TAG_INPUT_IMPORTS`      | `et-tag-input`                         |
| `PHONE_INPUT_IMPORTS`    | `et-phone-input`                       |

## Text field — `et-input` {#text-field}

The form field renders the shell (label, prefix/suffix affixes via
`etInputPrefix` / `etInputSuffix`, hint/error support region); the control
registers itself into it via DI — no manual wiring:

```html
<et-form-field appearance="box" labelMode="floating-inside">
  <et-label>Email</et-label>
  <span etInputPrefix>@</span>
  <et-input [formField]="demoForm.email" type="email" placeholder="you@example.com" />
  <et-hint>We never share your email.</et-hint>
</et-form-field>
```

<StoryEmbed id="components-forms-input--default" height="320px" />

`et-input` supports `type: 'text' | 'email' | 'password' | 'tel' | 'url' | 'search'`,
`placeholder`, `autocomplete`, `textAlign`, and the shared control state
(`disabled`, `readonly`, `invalid`, `required`, …). For numbers use
[`et-number-input`](#number-input), for plain multi-line text use
[`et-textarea`](#textarea), and for formatted content the
[rich text editor](/components/rich-text-editor).

A **read-only** text field (set `readonly` in the field schema) keeps its normal
box but drops every interactive affordance — no hover/focus border change,
default cursor, full-contrast value — so it reads as view-only content. This is
distinct from **disabled**, which stays dimmed.

## Number input

`et-number-input` is the numeric sibling of `et-input`: same shell, same look,
but its form value is a **`number | null`** instead of a string — an empty or
unparseable input reads as `null`, never `NaN` or `''`. It accepts `min`, `max`,
`step`, `placeholder`, `autocomplete`, `textAlign`, and the shared control state.
The native spin buttons are hidden.

```html
<et-form-field>
  <et-label>Amount</et-label>
  <et-number-input [formField]="demoForm.amount" [min]="0" [step]="0.5" />
  <span etInputSuffix>kg</span>
</et-form-field>
```

Set `stepper` to render −/+ buttons with press-and-hold auto-repeat: each press
changes the value by `step` (an empty value starts from `0`), clamped to
`min`/`max`, and the exhausted button disables at a bound. The buttons stay out
of the tab order (the native input already steps with the arrow keys) and take
`incrementLabel` / `decrementLabel` for their accessible names (defaults
unset → [`INPUT_LABELS`](/components/localization), `'Increment'` / `'Decrement'`). Design token: `--et-number-input-stepper-size`
(default `16px`). See the `Stepper` story.

## Password input — `et-password-input` {#password-input}

The password sibling of `et-input` with the affordances people expect. The form
value is a plain `string`; `autocomplete` defaults to `'current-password'` (set
`'new-password'` on registration forms).

```html
<et-form-field>
  <et-label>Password</et-label>
  <et-password-input #pw="etPasswordInput" [formField]="demoForm.password" capsLockWarning />
</et-form-field>
```

- **Reveal toggle** (on by default, `revealable`): an eye button switching the
  native `type` between `password`/`text`, exposed as `aria-pressed`. Its
  accessible name is state-aware — `revealLabel` (unset → [`INPUT_LABELS.showPassword`](/components/localization), `'Show password'`)
  while hidden, `hideLabel` (default `'Hide password'`) while shown. The revealed
  state is also a two-way `revealed` model.
- **Caps Lock warning** (opt-in, `capsLockWarning`): a `role="status"` warning
  icon while the field is focused and Caps Lock is on, with `capsLockLabel`
  (default `'Caps Lock is on'`) as screen-reader text.
- **Strength score**: the directive exposes `strength` — a 0–4 typing-feedback
  score from a pure length + character-class heuristic (deliberately not a
  zxcvbn-style security estimate). Grab it via the `etPasswordInput` export and
  render any meter you like next to the field (see the `Strength Meter` story).

Design token: `--et-password-input-reveal-size` (default `16px`).

## Textarea — `et-textarea` {#textarea}

Multi-line plain text with **autosize on by default**: the field grows with its
content and shrinks back, clamped by `minRows` (defaults to `rows`, default 3)
and `maxRows` (unbounded when unset). Beyond `maxRows` the content scrolls. With
`autosize` off the native resize handle takes over, controlled by
`resize: 'none' | 'vertical'` (an autosizing textarea is never manually
resizable).

```html
<et-form-field>
  <et-label>Message</et-label>
  <et-textarea [formField]="demoForm.message" [maxRows]="8" placeholder="Write something…" />
</et-form-field>
```

A textarea is the usual home for an [`<et-counter />`](/components/forms#character-counter) — it picks its limit up from the schema's `maxLength()`.

## Color input

`et-color-input` wraps the native color picker: a swatch plus the picked hex
value, with the real `input[type=color]` stretched invisibly over it so clicking
anywhere opens the platform picker. The form value is `'#rrggbb' | null` — `null`
until something is picked (the swatch shows black). `[readonly]` is honored (the
native `<input type="color">` ignores the attribute, so the control blocks the
picker-opening interactions itself while keeping the field focusable).

```html
<et-form-field>
  <et-label>Brand color</et-label>
  <et-color-input [formField]="demoForm.brandColor" />
</et-form-field>
```

Design tokens: `--et-color-input-swatch-size` (default `20px`),
`--et-color-input-swatch-radius` (default `4px`).

## Masked input — `[etInputMask]` {#masked-input}

Masking is a directive layered onto the existing text input, not a separate
control — place `etInputMask` on the `et-input` (or a headless `input[etInput]`).
The native element always shows the masked text; the **form value stays raw by
default** (`maskValueMode: 'raw' | 'masked'`).

<StoryEmbed id="components-forms-masked-input--default" height="320px" />

```html
<et-form-field>
  <et-label>Date of birth</et-label>
  <et-input [formField]="demoForm.birthday" etInputMask="00-00-0000" />
</et-form-field>
```

The mask is either a **pattern string** — `0` digit, `9` optional digit, `a`
letter, `*` alphanumeric, `\` escapes the next character, everything else is a
literal — or a `MaskSpec` object. Binding `null` disables the mask entirely
(native input handling stays in charge), so a mask can be applied conditionally.
Three factories ship:

| Factory                       | Behavior                                                                                                                                                                                                                                                    |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `createCurrencyMask(options)` | Right-growing grouped number (`1.234.567,89`), configurable `decimalSeparator` (`','`), `groupSeparator` (`'.'`), `decimals` (`2`), `prefix`/`suffix`, `allowNegative` (`false`). Raw value is the ungrouped amount using the configured decimal separator. |
| `createIbanMask()`            | Uppercases and groups by four; charset/length only — structural validation belongs to the schema/backend.                                                                                                                                                   |
| `createCardMask()`            | Digit-only, grouped by four, capped at 19 digits.                                                                                                                                                                                                           |

Typing behavior: literals render eagerly and the caret glides past them onto the
next slot; backspacing over a literal deletes the content character before it;
pastes are filtered through the mask (`31.12.2024` fills `00-00-0000`). With
`placeholderChar` set (pattern masks only), unfilled slots render as a guide
(`31-1_-____`) while the field is focused. IME composition (CJK, dead keys) is
left alone mid-composition and reconciled on `compositionend`, so the candidate
window is never torn down. Custom masks implement `MaskSpec` (`toRaw`/`toDisplay`
plus optional caret metadata) — see the type's docs.

The directive exposes two signals (via `exportAs: 'etInputMask'`): `rawValue()` —
the unmasked text regardless of `maskValueMode` — and `complete()` — whether
every required slot is filled (`0`/`a`/`*` required, `9` optional; `null` for
masks that don't track completeness, like the factories). Wire `complete()` into
schema validation to require fully-filled masks.

**Custom hosts**: the mask attaches to `et-input` out of the box, but any text
control can host it by providing `INPUT_MASK_HOST` on itself
(`{ provide: INPUT_MASK_HOST, useExisting: MyFieldDirective }`) — the contract is
a `value` model, a `focused` signal, a `nativeControl` element signal and a
`suppressNativeSync()` hook (the mask takes over value-sync), plus an optional
`resumeNativeSync()` for hosts whose mask can toggle back to `null`. The
[date, time, date-time and date range inputs](/components/date-time-inputs) host
a mask this way behind their opt-in `mask` input.

## OTP / PIN input — `et-otp-input` {#otp-input}

Segmented one-time-code entry backed by **one real native input** stretched
invisibly over the segments — that single input is what makes iOS/Android SMS
autofill (`autocomplete="one-time-code"`) and native paste reliable. Value is the
raw string.

```html
<et-otp-input [formField]="demoForm.code" (complete)="verify($event)" length="6">
  <et-label>Verification code</et-label>
</et-otp-input>
```

<StoryEmbed id="components-forms-otp-input--default" height="220px" />

| Input     | Type                                    | Default     | Description                                                           |
| --------- | --------------------------------------- | ----------- | --------------------------------------------------------------------- |
| `length`  | `number`                                | `6`         | Number of characters/segments.                                        |
| `charset` | `'numeric' \| 'alphanumeric' \| RegExp` | `'numeric'` | Accepted characters — everything else is stripped (pastes included).  |
| `masked`  | `boolean`                               | `false`     | Renders dots instead of characters (PIN entry); the value stays real. |

The `complete` output emits the value each time it reaches the full length.
Pastes strip separators (`123-456` → `123456`) and truncate. Editing is
append/delete-at-end (the caret is pinned to the end), with the active segment
marked visually. Tokens: `--et-otp-input-segment-size` (`44px`),
`--et-otp-input-segment-gap` (`8px`), `--et-otp-input-segment-radius` (`8px`).

::: warning Verify autofill on real devices
SMS autofill behavior cannot be emulated headlessly — test `one-time-code` flows
on real iOS Safari and Android Chrome.
:::

## Tag input — `et-tag-input` {#tag-input}

Free-text tags as removable [chips](/components/chip) with an inline text field,
inside the regular `et-form-field` shell. Value is `string[]`. For tags **with
suggestions**, use the [select](/components/select) instead (`multiple` +
`etSelectSearch` + `allowCustomValues`) — its custom-value mode covers the full
tag-input ergonomics on top of an option list: a "Create …" row, separator commit
(`customValueSeparators`), paste splitting, commit-on-close
(`commitCustomValueOnClose`), `normalizeCustomValue` and `maxSelection`. The tag
input remains the deliberately minimal variant for pure free-text entry with no
panel at all.

```html
<et-form-field>
  <et-label>Tags</et-label>
  <et-tag-input [formField]="demoForm.tags" placeholder="Add a tag…" />
</et-form-field>
```

| Input             | Type                              | Default          | Description                                                                                                               |
| ----------------- | --------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `separators`      | `string[]`                        | `['Enter', ',']` | What commits the pending text: multi-character entries are key names, single characters commit as typed and split pastes. |
| `allowDuplicates` | `boolean`                         | `false`          | Rejected duplicates keep the text in the field for editing.                                                               |
| `normalizeTag`    | `(raw: string) => string \| null` | trim             | Maps raw text to the stored tag — return `null` to reject.                                                                |
| `maxTags`         | `number \| undefined`             | `undefined`      | Further adds are ignored once reached.                                                                                    |

Pending text also commits on blur; <kbd>Backspace</kbd> on the empty field
removes the last tag; pastes split on separator characters and newlines. The
chips are pointer-removable (`×`, out of the tab order) — see the
[chip](/components/chip) guide.

An [`<et-counter />`](/components/forms#character-counter) counts tags rather than characters here, since the default measure is the array's length. Note the two limits differ in kind: `maxTags` **refuses** further tags, while a schema `maxLength()` lets them through and reports a validation error — pair the counter with the latter when you want the user to see they've gone over.

## Phone input — `et-phone-input` {#phone-input}

A tel input with a searchable country picker (the [select](/components/select)
headless core composed inside the control). Value is a normalized
`+<dialCode><national digits>` string. **Zero dependencies**: only ISO codes +
dial codes ship — country names come from `Intl.DisplayNames`, flags from
regional-indicator emoji.

```html
<et-form-field>
  <et-label>Phone number</et-label>
  <et-phone-input [formField]="demoForm.phone" [preferredCountries]="['de', 'at', 'ch']" defaultCountry="de" />
</et-form-field>
```

<StoryEmbed id="components-forms-phone-input--default" height="220px" />

| Input                | Type             | Default  | Description                                            |
| -------------------- | ---------------- | -------- | ------------------------------------------------------ |
| `defaultCountry`     | `string`         | `'us'`   | ISO alpha-2 country used while the value carries none. |
| `preferredCountries` | `string[]`       | `[]`     | Listed on top of the country dropdown.                 |
| `countryLabel`       | `string \| null` | `null` ¹ | `aria-label` of the flag/dial-code country trigger.    |

¹ `null` falls through to [`PHONE_INPUT_LABELS.selectCountry`](/components/localization) (`'Select country'`).

Typing national digits builds the `+dial` value; a national trunk `0` is stripped
(`0171…` with Germany active → `+49171…` — except for countries like Italy where
the `0` is part of the number), and the `00` international call prefix works like
`+` (`0049…` → `+49…`). Typing or pasting a full `+…` number re-derives the
country by longest dial-code match — but a manually picked country survives shared
dial codes (`+1` stays Canada if you chose Canada). Switching countries keeps the
national number. The display groups digits in threes while unfocused (**cosmetic
only** — not per-country metadata formatting; validate on the backend/schema, with
`isPlausible` as a cheap length-window helper).

The country dropdown searches names **and** dial codes (`49` or `+49` finds
Germany) and shows an empty row when nothing matches. Replace the emoji flags
(trigger and option list) with custom art by projecting an
`ng-template[etPhoneInputFlag]` — it receives the country (`iso2`, `dialCode`, and
the default emoji `flag`) as context:

```html
<et-phone-input [formField]="demoForm.phone">
  <ng-template etPhoneInputFlag let-country>
    <img [src]="'/flags/' + country.iso2 + '.svg'" alt="" />
  </ng-template>
</et-phone-input>
```

## Bulk editing

Every control on this page implements the SDK-wide
[mixed state contract](/components/mixed-state) for editing several records at
once. The text-slot controls (`et-input`, `et-number-input`,
`et-password-input`, `et-textarea`, `et-color-input`, `et-tag-input`,
`et-phone-input`) take a `mixedLabel` (unset → [`FORM_FIELD_LABELS.mixed`](/components/localization)) shown in place of the
value while mixed; `et-otp-input` is not a bulk-edit field. See the
[Forms overview](/components/forms#mixed-values-bulk-editing) for the shared
wiring recipe.

## Accessibility

These controls inherit the field shell's label/error/`aria-describedby` wiring —
see [Validation & accessibility](/components/forms#validation-accessibility) in
the overview. Control-specific notes:

- The text-field controls (`et-input`, `et-number-input`, `et-password-input`,
  `et-color-input`, `et-textarea`) forward `aria-label`/`aria-labelledby` onto
  the native element when you omit the `et-label` (a consumer `aria-labelledby`
  overrides the projected label). A placeholder is **not** an accessible name.
- The password reveal toggle exposes `aria-pressed`; the Caps Lock warning is a
  `role="status"`.
- The phone-input host is labelled by the field label; the country trigger takes
  its own `countryLabel` `aria-label`.

## Theming

Public design tokens on this page's controls (override them in your CSS scope):

| Component           | Tokens                                                                                                  |
| ------------------- | ------------------------------------------------------------------------------------------------------- |
| `et-number-input`   | `--et-number-input-stepper-size` (`16px`)                                                               |
| `et-password-input` | `--et-password-input-reveal-size` (`16px`)                                                              |
| `et-color-input`    | `--et-color-input-swatch-size` (`20px`), `--et-color-input-swatch-radius` (`4px`)                       |
| `et-otp-input`      | `--et-otp-input-segment-size` (`44px`), `--et-otp-input-segment-gap` (`8px`), `-segment-radius` (`8px`) |

The `et-form-field` shell tokens (padding, border, sizes) are documented on the
[Forms overview](/components/forms#theming). All colors resolve through the
app-registered [surface/color theme systems](/core/theming).

## Error codes

The tag input throws in the [`ET27xx`](/components/error-codes#tag-input-et27xx)
range, the phone input in
[`ET28xx`](/components/error-codes#phone-input-et28xx), and an `[etInputMask]`
placed outside an input control throws
[`ET3200`](/components/error-codes#masked-input-et32xx).
