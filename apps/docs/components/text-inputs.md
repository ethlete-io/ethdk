# Text inputs

The text-based form controls: the plain [text field](#text-field) and its
siblings - [number](#number-input), [password](#password-input),
[textarea](#textarea), [color](#color-input), the
[masked-input directive](#masked-input), and the specialized
[OTP](#otp-input), [tag](#tag-input) and [phone](#phone-input) inputs. They all
sit inside the shared [`et-form-field` shell](/components/forms#the-field-shell)
and bind via signal forms - see the [Forms overview](/components/forms) for the
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

## Text field - `et-input` {#text-field}

The form field renders the shell (label, prefix/suffix affixes via
`etInputPrefix` / `etInputSuffix`, hint/error support region); the control
registers itself into it via DI - no manual wiring:

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
box but drops every interactive affordance - no hover/focus border change,
default cursor, full-contrast value - so it reads as view-only content. This is
distinct from **disabled**, which stays dimmed.

## Number input

`et-number-input` is the numeric sibling of `et-input`: same shell, same look,
but its form value is a **`number | null`** instead of a string - an empty or
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
of the tab order and take `incrementLabel` / `decrementLabel` for their
accessible names (defaults
unset → [`INPUT_LABELS`](/components/localization), `'Increment'` / `'Decrement'`). Design token: `--et-number-input-stepper-size`
(default `16px`). See the `Stepper` story.

### Coarse and fine stepping

A step is not always one `step`. The same vocabulary applies to the arrow keys on
the input and to a press on a stepper button:

| Input                      | Steps by     |
| -------------------------- | ------------ |
| Arrow up / down            | `step`       |
| **Shift** + arrow          | `step` × 10  |
| **Alt**/**Option** + arrow | `step` × 0.1 |
| Page up / down             | `step` × 100 |

`Ctrl`/`Cmd` is deliberately unused - it is a browser-zoom shortcut on several
platforms. The page keys are always 100×, whatever else is held.

Arrow-key stepping runs through the component rather than through the native
input's own, so it shares the clamping, the [mixed-state](/components/mixed-state)
handling and the `touched` marking with every other way of stepping.

**Drag a stepper button sideways to scrub the value**, the way Figma and Adobe
tools do. The pointer travels 4px per `step`, sub-step movement accumulates so a
slow drag still moves, and the modifier held at press applies for the whole
gesture. Dragging left decrements whichever button started it. The press that
begins a scrub has already stepped once - that step stands.

Two deliberate limits: the scrub is **fine-pointer only** (a horizontal drag off a
small button on a touch screen is a mis-grab far more often than an edit), and it
**ends at the viewport edge** rather than taking a pointer lock. The whole scrub
marks the control touched **once, at the end** - so dragging past `min` on the way
somewhere valid never flashes a validation error under the pointer.

<StoryEmbed id="components-forms-number-input--coarse-and-fine-stepping" height="260px" />

For a headless stepper of your own, `NumberInputDirective.stepBy(direction, { multiplier })`
is the single entry point all of the above uses, and `numberInputStepMultiplierFrom(event)`
reads the modifier vocabulary off any event carrying `shiftKey` / `altKey`.

## Password input - `et-password-input` {#password-input}

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
  accessible name is state-aware - `revealLabel` (unset → [`INPUT_LABELS.showPassword`](/components/localization), `'Show password'`)
  while hidden, `hideLabel` (default `'Hide password'`) while shown. The revealed
  state is also a two-way `revealed` model. It renders in the field's
  [suffix stack](/components/forms#one-suffix-stack), so a busy spinner or your own `etInputSuffix`
  never displaces it.
- **Caps Lock warning** (opt-in, `capsLockWarning`): a `role="status"` warning
  icon while the field is focused and Caps Lock is on. `capsLockLabel`
  (default `'Caps Lock might be on'`) is both the screen-reader text and the
  icon's tooltip, so the triangle explains itself to sighted users too. The
  hedged wording is deliberate: the state can lag one keystroke behind Caps Lock
  being switched on, so the warning promises less than it knows. The state is
  read off keystrokes and pointer presses, which is the only reliable source
  for it: browsers on macOS report the pre-toggle state on the Caps Lock key's
  own events, so that key clears the warning and the next keystroke re-reads
  it. Switching Caps Lock **off** therefore clears the warning at once, while
  switching it **on** while the field already has focus shows it one keystroke
  later - never the other way round, which would leave a wrong warning up.
- **Strength score**: the directive exposes `strength` - a 0–4 typing-feedback
  score from a pure length + character-class heuristic (deliberately not a
  zxcvbn-style security estimate). Grab it via the `etPasswordInput` export and
  render any meter you like next to the field (see the `Strength Meter` story).

Design token: `--et-password-input-reveal-size` (default `16px`).

## Textarea - `et-textarea` {#textarea}

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

Autosizing is the browser's own `field-sizing: content` where that exists, and a
measured fallback everywhere else - the result is the same either way. The row
bounds resolve from the textarea's line height, so keep the frame's padding on
the frame: padding set directly on `.et-textarea-native` is counted against
`minRows`/`maxRows` rather than added to them.

A textarea is the usual home for an [`<et-counter />`](/components/forms#character-counter) - it picks its limit up from the schema's `maxLength()`.

## Color input

`et-color-input` is a swatch plus the picked hex value, and it opens the SDK's own
color picker. **There is no `<input type="color">` behind it any more** - the
platform picker was replaced in full, so the panel looks and behaves the same on
every browser and can be themed like the rest of the library. The form value is
`'#rrggbb' | null` - `null` until something is picked (the swatch shows black).

```html
<et-form-field>
  <et-label>Brand color</et-label>
  <et-color-input [formField]="demoForm.brandColor" />
</et-form-field>
```

<StoryEmbed id="components-forms-color-input--with-swatches" height="520px" />

The field itself is a single tab stop that opens the panel. `[readonly]` keeps the
field focusable and refuses to open the picker; `[disabled]` disables the trigger.
The picker mounts as an anchored pane from `md` up and as a bottom sheet below it,
the same as the [date and time pickers](/components/date-time-inputs) and the
[cascader](/components/cascader).

### The panel

| Part                           | Notes                                                                                                                                                                                                               |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Saturation and brightness area | Drag it, or tab to the two sliders behind it (`Saturation`, `Brightness`) and use the arrow keys                                                                                                                    |
| Hue track                      | A real range input, so arrow keys, `Home`, `End` and the page keys all work                                                                                                                                         |
| Opacity track                  | Only with `[alpha]` - see below                                                                                                                                                                                     |
| Preset swatches                | Only with `[swatches]` - see below                                                                                                                                                                                  |
| Entry field                    | A small `et-form-field` with the preview swatch in front of the value, and the notation switch and the eyedropper after it. It commits on blur or `Enter`, and an entry it cannot read reverts rather than standing |
| Notation switch                | Only with more than one notation offered - see [notation](#notation-notations)                                                                                                                                      |
| Eyedropper                     | Only where the browser has the [EyeDropper API](https://developer.mozilla.org/docs/Web/API/EyeDropper) (Chromium at the time of writing); hidden everywhere else                                                    |

Every surface is built around a native range input, which is what carries the
keyboard and touch handling. **The surfaces read left to right in every writing
direction** - their gradients are the picture the value is read off, so an RTL page
gets the same area, hue and opacity tracks, unmirrored, and `ArrowRight` still means
"more". Everything around them (the entry field, the swatch row, the advisory) follows
the page direction as usual. Picking commits live - there is no confirm step, and
closing the panel is not a cancel. The panel closes on `Escape`, on a click outside
it, and on a `Tab` past its last control - see
[how a field panel closes](/components/forms#how-a-field-panel-closes).

### Opacity - `[alpha]`

```html
<et-color-input [formField]="demoForm.brandColor" alpha />
```

With `alpha` on, the panel gains an opacity track and the value widens to
`'#rrggbbaa'`. Validate it with `hexColor({ allowAlpha: true })` - the strict
default rejects the eight-digit form.

### Presets - `[swatches]`

```html
<et-color-input [formField]="demoForm.brandColor" [swatches]="['#ff5533', 'rgb(51 187 136)', '#36f']" />
```

Presets take any notation the [color validators](/components/forms#color-validators)
accept and render as canonical hex, so one color given twice in two notations
renders one swatch. An entry that cannot be read is dropped rather than shown as a
broken swatch.

### Notation - `[notations]`

```html
<!-- the default: all three, and the field follows what the user types -->
<et-color-input [formField]="demoForm.brandColor" />

<!-- pinned to hex, for an API that accepts nothing else -->
<et-color-input [formField]="demoForm.brandColor" [notations]="['hex']" />
```

<StoryEmbed id="components-forms-color-input--pinned-notation" height="520px" />

`notations` lists what the panel's entry field offers, in the order its switch
cycles through them: `'hex'`, `'rgb'`, `'hsl'`. Duplicates collapse, an entry the
picker cannot read is dropped, and an empty list falls back to hex.

| Given                  | The panel                                                                                                             |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------- |
| More than one notation | Shows the switch beside the entry field, and an entry in any offered notation switches the display to it              |
| Exactly one notation   | Pins the field to it and shows no switch. An entry in another notation is converted, with an advisory under the field |

The field opens on the notation the bound value is written in, when that one is
offered. The advisory clears on the next entry, on any pick elsewhere in the panel,
and when the panel closes.

**The notation is display only.** Whatever the field shows, the control emits hex -
so a `hexColor()` validator keeps passing, and switching the notation never changes
the form value.

### What the value is

The picker emits lowercase `'#rrggbb'` (or `'#rrggbbaa'`), but it **reads** every
notation the validators accept - `#f00`, `#rrggbbaa`, `rgb()`, `rgba()`, `hsl()` and
`hsla()`. A value that arrived from an API in one of those forms displays correctly
and is not rewritten until the user picks something.

### Design tokens

| Token                            | Default                                                 |
| -------------------------------- | ------------------------------------------------------- |
| `--et-color-input-swatch-size`   | `20px`                                                  |
| `--et-color-input-swatch-radius` | `4px`                                                   |
| `--et-color-picker-area-size`    | `240px` (the panel's width, and the square area's side) |
| `--et-color-picker-font-size`    | `14px`                                                  |
| `--et-color-picker-track-size`   | `12px`                                                  |
| `--et-color-picker-thumb-size`   | `12px`                                                  |

The panel's own strings are localized through `provideColorInputLabels` - see
[localization](/components/localization).

Two colors that have to be readable together belong to
[`colorContrast`](/components/forms#color-contrast-across-two-fields), which measures a field
against another field of the same form.

## Masked input - `[etInputMask]` {#masked-input}

Masking is a directive layered onto the existing text input, not a separate
control - place `etInputMask` on the `et-input` (or a headless `input[etInput]`).
The native element always shows the masked text; the **form value stays raw by
default** (`maskValueMode: 'raw' | 'masked'`).

<StoryEmbed id="components-forms-masked-input--default" height="320px" />

```html
<et-form-field>
  <et-label>Date of birth</et-label>
  <et-input [formField]="demoForm.birthday" etInputMask="00-00-0000" />
</et-form-field>
```

The mask is either a **pattern string** - `0` digit, `9` optional digit, `a`
letter, `*` alphanumeric, `\` escapes the next character, everything else is a
literal - or a `MaskSpec` object. Binding `null` disables the mask entirely
(native input handling stays in charge), so a mask can be applied conditionally.
Three factories ship:

| Factory                       | Behavior                                                                                                                                                                                                                                                    |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `createCurrencyMask(options)` | Right-growing grouped number (`1.234.567,89`), configurable `decimalSeparator` (`','`), `groupSeparator` (`'.'`), `decimals` (`2`), `prefix`/`suffix`, `allowNegative` (`false`). Raw value is the ungrouped amount using the configured decimal separator. |
| `createIbanMask()`            | Uppercases and groups by four; charset/length only - structural validation belongs to the schema/backend.                                                                                                                                                   |
| `createCardMask()`            | Digit-only, grouped by four, capped at 19 digits.                                                                                                                                                                                                           |

Typing behavior: literals render eagerly and the caret glides past them onto the
next slot; backspacing over a literal deletes the content character before it;
pastes are filtered through the mask (`31.12.2024` fills `00-00-0000`). With
`placeholderChar` set (pattern masks only), unfilled slots render as a guide
(`31-1_-____`) while the field is focused. IME composition (CJK, dead keys) is
left alone mid-composition and reconciled on `compositionend`, so the candidate
window is never torn down. Custom masks implement `MaskSpec` (`toRaw`/`toDisplay`
plus optional caret metadata) - see the type's docs.

The directive exposes two signals (via `exportAs: 'etInputMask'`): `rawValue()` -
the unmasked text regardless of `maskValueMode` - and `complete()` - whether
every required slot is filled (`0`/`a`/`*` required, `9` optional; `null` for
masks that don't track completeness, like the factories). Wire `complete()` into
schema validation to require fully-filled masks.

**Custom hosts**: the mask attaches to `et-input` out of the box, but any text
control can host it by providing `INPUT_MASK_HOST` on itself
(`{ provide: INPUT_MASK_HOST, useExisting: MyFieldDirective }`) - the contract is
a `value` model, a `focused` signal, a `nativeControl` element signal and a
`suppressNativeSync()` hook (the mask takes over value-sync), plus an optional
`resumeNativeSync()` for hosts whose mask can toggle back to `null`. The
[date, time, date-time and date range inputs](/components/date-time-inputs) host
a mask this way behind their opt-in `mask` input.

## OTP / PIN input - `et-otp-input` {#otp-input}

Segmented one-time-code entry backed by **one real native input** stretched
invisibly over the segments - that single input is what makes iOS/Android SMS
autofill (`autocomplete="one-time-code"`) and native paste reliable. Value is the
raw string.

```html
<et-otp-input [formField]="demoForm.code" (complete)="verify($event)" length="6">
  <et-label>Verification code</et-label>
</et-otp-input>
```

<StoryEmbed id="components-forms-otp-input--default" height="220px" />

| Input     | Type                                    | Default     | Description                                                                                       |
| --------- | --------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------- |
| `length`  | `number`                                | `6`         | Number of characters/segments.                                                                    |
| `charset` | `'numeric' \| 'alphanumeric' \| RegExp` | `'numeric'` | Accepted characters - everything else is stripped (pastes included).                              |
| `masked`  | `boolean`                               | `false`     | Renders dots instead of characters (PIN entry); the value stays real.                             |
| `color`   | registered color theme name             | -           | Scopes a [color theme](/core/theming) to the input - tints the active segment's border and caret. |

The `complete` output emits the value each time it reaches the full length, no
matter who wrote it - typing, paste, SMS autofill or a programmatic write into
the bound field. Pastes strip separators (`123-456` → `123456`) and truncate.
Editing is append/delete-at-end (the caret is pinned to the end), with the active
segment marked visually. A `charset` RegExp is tested per character, so its `g`
and `y` flags are ignored. Narrowing `charset` or shrinking `length` at runtime
re-sanitizes the value that is already in the field. Tokens: `--et-otp-input-segment-size` (`44px`),
`--et-otp-input-segment-gap` (`8px`), `--et-otp-input-segment-radius` (`8px`).

::: warning Verify autofill on real devices
SMS autofill behavior cannot be emulated headlessly - test `one-time-code` flows
on real iOS Safari and Android Chrome.
:::

## Tag input - `et-tag-input` {#tag-input}

Free-text tags as removable [chips](/components/chip) with an inline text field,
inside the regular `et-form-field` shell. Value is `string[]`. For tags **with
suggestions**, use the [select](/components/select) instead (`multiple` +
`etSelectSearch` + `allowCustomValues`) - its custom-value mode covers the full
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
| `normalizeTag`    | `(raw: string) => string \| null` | trim             | Maps raw text to the stored tag - return `null` to reject.                                                                |
| `maxTags`         | `number \| undefined`             | `undefined`      | Further adds are ignored once reached, and the field locks - unless it still holds text.                                  |

Pending text also commits on blur; <kbd>Backspace</kbd> on the empty field
removes the last tag - and writes nothing at all when there is no tag left to
remove, so a no-op keystroke never dirties the bound field. A paste splits on
separator characters and newlines, spliced into the pending text at the caret
the way the browser would insert it: field text `pre` plus a pasted `one,two`
commits `preone` and `two`. Once `maxTags` is reached the field goes read-only,
but never while it still holds text - text a full input refused stays editable
instead of stranding the keyboard. The chips are pointer-removable (`×`, out of
the tab order) - see the [chip](/components/chip) guide.

An [`<et-counter />`](/components/forms#character-counter) counts tags rather than characters here, since the default measure is the array's length. Note the two limits differ in kind: `maxTags` **refuses** further tags, while a schema `maxLength()` lets them through and reports a validation error - pair the counter with the latter when you want the user to see they've gone over.

## Phone input - `et-phone-input` {#phone-input}

A tel input with a searchable country picker (the [select](/components/select)
headless core composed inside the control). Value is a normalized
`+<dialCode><national digits>` string. **Zero dependencies**: only ISO codes +
dial codes ship - country names come from `Intl.DisplayNames`, flags from
regional-indicator emoji.

```html
<et-form-field>
  <et-label>Phone number</et-label>
  <et-phone-input [formField]="demoForm.phone" [preferredCountries]="['de', 'at', 'ch']" defaultCountry="de" />
</et-form-field>
```

<StoryEmbed id="components-forms-phone-input--default" height="220px" />

| Input                | Type             | Default  | Description                                                                                                                                                                                                                   |
| -------------------- | ---------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `defaultCountry`     | `string`         | `'us'`   | ISO alpha-2 country used while the value carries none. A late change (a locale or geo lookup that resolves after the first render) still applies, as long as the country has not been picked or derived from the value since. |
| `preferredCountries` | `string[]`       | `[]`     | Listed on top of the country dropdown.                                                                                                                                                                                        |
| `countryLabel`       | `string \| null` | `null` ¹ | `aria-label` of the flag/dial-code country trigger.                                                                                                                                                                           |

¹ `null` falls through to [`PHONE_INPUT_LABELS.selectCountry`](/components/localization) (`'Select country'`).

Typing national digits builds the `+dial` value; a national trunk `0` is stripped
(`0171…` with Germany active → `+49171…` - except for countries like Italy where
the `0` is part of the number), and the `00` international call prefix works like
`+` (`0049…` → `+49…`). Typing or pasting a full `+…` number re-derives the
country by longest dial-code match - but a manually picked country survives shared
dial codes (`+1` stays Canada if you chose Canada). Switching countries keeps the
national number. A focused field always shows exactly what you typed, `+` prefix
included; it collapses to the national number when you leave it. The display groups
digits in threes while unfocused (**cosmetic only** - not per-country metadata
formatting; validate on the backend/schema, with `isPlausible` as a cheap
length-window helper).

The country dropdown searches names **and** dial codes (`49` or `+49` finds
Germany) and shows an empty row when nothing matches. Replace the emoji flags
(trigger and option list) with custom art by projecting an
`ng-template[etPhoneInputFlag]` - it receives the country (`iso2`, `dialCode`, and
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

These controls inherit the field shell's label/error/`aria-describedby` wiring -
see [Validation & accessibility](/components/forms#validation-accessibility) in
the overview. Control-specific notes:

- Every control on this page - including `et-tag-input`, `et-phone-input` and
  `et-otp-input` - forwards `aria-label`/`aria-labelledby` onto the native
  element when you omit the `et-label` (a consumer `aria-labelledby` overrides
  the projected label). A placeholder is **not** an accessible name.
- The password reveal toggle exposes `aria-pressed`; the Caps Lock warning is a
  `role="status"`.
- The phone-input's tel field is labelled by the field label (or the control's
  own `aria-label`); the country trigger takes its own `countryLabel`.

## Theming

Public design tokens on this page's controls (override them in your CSS scope):

| Component           | Tokens                                                                                                                         |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `et-number-input`   | `--et-number-input-stepper-size` (`16px`)                                                                                      |
| `et-password-input` | `--et-password-input-reveal-size` (`16px`)                                                                                     |
| `et-color-input`    | `--et-color-input-swatch-size` (`20px`), `--et-color-input-swatch-radius` (`4px`), plus the `--et-color-picker-*` panel tokens |
| `et-otp-input`      | `--et-otp-input-segment-size` (`44px`), `--et-otp-input-segment-gap` (`8px`), `-segment-radius` (`8px`)                        |

The `et-form-field` shell tokens (padding, border, sizes) are documented on the
[Forms overview](/components/forms#theming). All colors resolve through the
app-registered [surface/color theme systems](/core/theming).

## Error codes

The tag input throws in the [`ET27xx`](/components/error-codes#tag-input-et27xx)
range, the phone input in
[`ET28xx`](/components/error-codes#phone-input-et28xx), and an `[etInputMask]`
placed outside an input control throws
[`ET3200`](/components/error-codes#masked-input-et32xx).
