# Forms

Signal-forms-native form controls: text, number, textarea and color inputs, checkbox, switch and selection lists, plus the shared field chrome (labels, hints, errors, affixes) that wires accessibility for you. For formatted content see the [rich text editor](/components/rich-text-editor) guide, and for file uploads the [dropzone](/components/dropzone) guide.

::: info Signal forms only
These controls implement Angular's [signal forms](https://angular.dev/guide/forms) contracts (`FormValueControl` / `FormCheckboxControl`) and bind via `[formField]` from `@angular/forms/signals`. There is no `ngModel`/`ControlValueAccessor` layer — the classic stack (and specialized date/number/masked inputs) lives only in the legacy `@ethlete/cdk`. Two-way `[(value)]` / `[(checked)]` also works for simple cases.
:::

```ts
private formModel = signal({ email: '' });

protected demoForm = form(this.formModel, (s) => {
  required(s.email, { message: 'Email is required' });
});
```

## Importing

Each control family ships its own imports array — combine the field shell with the controls you use:

| Array                  | Contains                                                                  |
| ---------------------- | ------------------------------------------------------------------------- |
| `FORM_FIELD_IMPORTS`   | `et-form-field`, `et-label`, `et-hint`, `etInputPrefix` / `etInputSuffix` |
| `INPUT_IMPORTS`        | `et-input`                                                                |
| `NUMBER_INPUT_IMPORTS` | `et-number-input`                                                         |
| `TEXTAREA_IMPORTS`     | `et-textarea`                                                             |
| `COLOR_INPUT_IMPORTS`  | `et-color-input`                                                          |
| `CHECKBOX_IMPORTS`     | `et-checkbox`                                                             |
| `SWITCH_IMPORTS`       | `et-switch`                                                               |
| `CHOICE_FIELD_IMPORTS` | `et-choice-field` + label/hint chrome                                     |
| `RATING_IMPORTS`       | `et-rating`                                                               |
| `OTP_INPUT_IMPORTS`    | `et-otp-input`                                                            |
| `TAG_INPUT_IMPORTS`    | `et-tag-input`                                                            |
| `PHONE_INPUT_IMPORTS`  | `et-phone-input`                                                          |
| `DATE_INPUT_IMPORTS`   | `et-date-input`                                                           |

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

`et-color-input` wraps the native color picker: a swatch plus the picked hex value, with the real `input[type=color]` stretched invisibly over it so clicking anywhere opens the platform picker. The form value is `'#rrggbb' | null` — `null` until something is picked (the swatch shows black).

```html
<et-form-field>
  <et-label>Brand color</et-label>
  <et-color-input [formField]="demoForm.brandColor" />
</et-form-field>
```

Design tokens: `--et-color-input-swatch-size` (default `20px`), `--et-color-input-swatch-radius` (default `4px`).

Try it live in Storybook: `Components/Forms/Color Input`.

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
- `et-switch` — `role="switch"`, `checked` model, no indeterminate.
- Both toggle on click and <kbd>Space</kbd>, and mark themselves touched on blur.
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

Free-text tags as removable [chips](/components/chip) with an inline text field, inside the regular `et-form-field` shell. Value is `string[]`. For tags **with suggestions**, use the [select](/components/select) instead (`multiple` + `etSelectSearch` + `allowCustomValues`).

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

| Input                | Type       | Default | Description                                            |
| -------------------- | ---------- | ------- | ------------------------------------------------------ |
| `defaultCountry`     | `string`   | `'us'`  | ISO alpha-2 country used while the value carries none. |
| `preferredCountries` | `string[]` | `[]`    | Listed on top of the country dropdown.                 |

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

| Input                 | Type                                | Default             | Description                                                                  |
| --------------------- | ----------------------------------- | ------------------- | ---------------------------------------------------------------------------- |
| `valueFormat`         | `string`                            | `DATE_FORMAT` token | date-fns format of the string value (token default: ISO 8601 with offset).   |
| `displayFormat`       | `string`                            | `'P'`               | date-fns format shown in and parsed from the field (locale-aware).           |
| `locale`              | `Locale \| null` (date-fns)         | `DATE_LOCALE` token | Display/parse locale.                                                        |
| `minDate` / `maxDate` | `Date \| null`                      | `null`              | Forwarded to the picker calendar (`min`/`max` are reserved by signal forms). |
| `dateFilter`          | `((date: Date) => boolean) \| null` | `null`              | Forwarded to the picker calendar.                                            |
| `pickerOpen`          | `boolean` (model)                   | `false`             | The picker overlay's open state.                                             |
| `pickerTriggerLabel`  | `string`                            | `'Open calendar'`   | `aria-label` of the suffix calendar button.                                  |

Typed text is parsed **strictly** against `displayFormat` on blur/Enter. Unparseable text stays visible in the field, the `parseError` signal (on the `[etDateInput]` directive) turns on and the value stays `null` — wire it into your schema validation, or rely on the built-in error display (`parseError` counts into the field's error state once touched). Alt+ArrowDown also opens the picker; picking a day writes `format(date, valueFormat)` and closes it.

The wire defaults come from injectable tokens so an app can set them once:

```ts
import { provideDateFormat, provideDateLocale } from '@ethlete/components';
import { de } from 'date-fns/locale';

providers: [provideDateFormat('yyyy-MM-dd'), provideDateLocale(de)];
```

`date-fns` (v4) is a peer dependency of the date controls: `yarn add date-fns`.

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
- The segmented button group renders its options on a tonal track; the filled active pill animates between options on selection.

Checkbox options and radios accept an `et-description` child for secondary text, and the headless layer offers a tri-state "select all" control (`[etSelectionListControl]`).

Try the three group flavors live in Storybook: `Components/Forms/Selection List`.

## Validation & accessibility

The field chrome handles error display and aria wiring uniformly:

- Errors show once a control is **touched and invalid** — each signal-forms `ValidationError` renders as an `et-form-error` in the support region (`aria-live="polite"`), replacing the hint with an animated transition. While erroring, the field forces the app's error color theme (the theme registered with `type: 'error'`).
- `aria-describedby` on the control automatically points at the active error (or hint), `aria-labelledby` at the `et-label`; the label renders a `*` marker when the control is `required`.
- Dev mode throws an actionable error ([`ET2200`](/components/error-codes#form-field-et22xx)) if an `et-form-field` contains no control.

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

An `et-form-field` without a control throws [`ET2200`](/components/error-codes#form-field-et22xx) in dev mode.
