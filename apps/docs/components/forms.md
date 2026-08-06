# Forms

Signal-forms-native form controls plus the shared field chrome (labels, hints,
errors, affixes) that wires accessibility for you. This page covers the pieces
every control shares - the field shell, importing, validation, bulk editing and
theming. Each control family has its own guide:

| Guide                                              | Controls                                                                     |
| -------------------------------------------------- | ---------------------------------------------------------------------------- |
| [Text inputs](/components/text-inputs)             | text field, number, password, textarea, color, masked input, OTP, tag, phone |
| [Date & time inputs](/components/date-time-inputs) | date, date range, time, date-time, duration                                  |
| [Choice & rating](/components/choice-inputs)       | checkbox, switch, radio / checkbox / segmented selection lists, rating       |
| [Select](/components/select)                       | single/multi dropdown, searchable combobox, custom values                    |
| [Cascader](/components/cascader)                   | hierarchical multi-level select                                              |
| [Slider](/components/slider)                       | single-value and range sliders                                               |
| [Rich text editor](/components/rich-text-editor)   | Markdown-valued content editor                                               |
| [Dropzone](/components/dropzone)                   | file uploads                                                                 |

::: info Signal forms only
These controls implement Angular's [signal forms](https://angular.dev/guide/forms)
contracts (`FormValueControl` / `FormCheckboxControl`) and bind via `[formField]`
from `@angular/forms/signals`. There is no `ngModel`/`ControlValueAccessor` layer

- the classic stack lives only in the legacy `@ethlete/cdk`. Two-way `[(value)]`
  / `[(checked)]` also works for simple cases.
  :::

```ts
private formModel = signal({ email: '' });

protected demoForm = form(this.formModel, (s) => {
  required(s.email, { message: 'Email is required' });
});
```

## Importing

Each control family ships its own imports array - combine the field shell with
the controls you use. The field-shell array is shared by every text-based
control:

| Array                      | Contains                                                                                |
| -------------------------- | --------------------------------------------------------------------------------------- |
| `FORM_FIELD_IMPORTS`       | `et-form-field`, `et-label`, `et-hint`, `et-counter`, `etInputPrefix` / `etInputSuffix` |
| `INPUT_IMPORTS`            | `et-input`                                                                              |
| `NUMBER_INPUT_IMPORTS`     | `et-number-input`                                                                       |
| `PASSWORD_INPUT_IMPORTS`   | `et-password-input`                                                                     |
| `TEXTAREA_IMPORTS`         | `et-textarea`                                                                           |
| `COLOR_INPUT_IMPORTS`      | `et-color-input`                                                                        |
| `MASKED_INPUT_IMPORTS`     | `etInputMask` (layers onto `et-input`)                                                  |
| `CHECKBOX_IMPORTS`         | `et-checkbox`                                                                           |
| `SWITCH_IMPORTS`           | `et-switch`                                                                             |
| `CHOICE_FIELD_IMPORTS`     | `et-choice-field` + label/hint chrome                                                   |
| `RATING_IMPORTS`           | `et-rating`                                                                             |
| `CHECKBOX_GROUP_IMPORTS`   | `et-checkbox-group`, `et-checkbox-option`, `et-checkbox-group-select-all`               |
| `RADIO_GROUP_IMPORTS`      | `et-radio-group`, `et-radio`                                                            |
| `SEGMENTED_BUTTON_IMPORTS` | `et-segmented-button-group`, `et-segmented-button`                                      |
| `SELECTION_LIST_IMPORTS`   | the headless engine: `etSelectionList`, `etSelectionOption`, `etSelectionListControl`   |
| `DESCRIPTION_IMPORTS`      | `et-description`                                                                        |
| `OTP_INPUT_IMPORTS`        | `et-otp-input`                                                                          |
| `TAG_INPUT_IMPORTS`        | `et-tag-input`                                                                          |
| `PHONE_INPUT_IMPORTS`      | `et-phone-input`                                                                        |
| `DATE_INPUT_IMPORTS`       | `et-date-input`                                                                         |
| `DATE_RANGE_INPUT_IMPORTS` | `et-date-range-input`                                                                   |
| `TIME_INPUT_IMPORTS`       | `et-time-input`                                                                         |
| `DATE_TIME_INPUT_IMPORTS`  | `et-date-time-input`                                                                    |
| `DURATION_INPUT_IMPORTS`   | `et-duration-input`                                                                     |

```ts
import { FORM_FIELD_IMPORTS, INPUT_IMPORTS } from '@ethlete/components';
```

The select, cascader, slider, rich-text-editor and dropzone imports live in their
own guides.

## The field shell

`et-form-field` renders the shell for the text-based controls (label, prefix/suffix
affixes via `etInputPrefix` / `etInputSuffix`, hint/error support region); the
control registers itself into it via DI - no manual wiring:

```html
<et-form-field appearance="box" labelMode="floating-inside">
  <et-label>Email</et-label>
  <span etInputPrefix>@</span>
  <et-input [formField]="demoForm.email" type="email" placeholder="you@example.com" />
  <et-hint>We never share your email.</et-hint>
</et-form-field>
```

<StoryEmbed id="components-forms-input--default" height="320px" />

An affix takes a text glyph or an [`[etIcon]`](/components/icon#inside-sdk-components-the-size-is-already-set) -
the shell sizes a directly-projected icon via `--et-form-field-affix-icon-size` (`16px`), so no
size class is needed.

### One suffix stack

A control's own in-field affordances - the date/time clear button and picker trigger, the phone
input's clear button, the password reveal toggle - render in the same suffix box as your
`etInputSuffix`, in a fixed order:

| Position | What                                                          |
| -------- | ------------------------------------------------------------- |
| 1        | the control's own affordances (clear, picker trigger, reveal) |
| 2        | your `[etInputSuffix]`                                        |
| 3        | the field's busy spinner                                      |

So a pending async validator never displaces a clear button, and your suffix never lands between a
field and the button that clears it. Spacing is `--et-form-field-control-affix-gap` - the same token
the shell uses between the affixes and the control, so it tracks `size` (6/8/10px for `sm`/`md`/`lg`).

Projected affix content and the spinner render at `0.78` opacity so they recede; a control's own
affordances render at full strength, because they are controls rather than decoration.

::: warning Renamed in this release
The clear button and picker trigger used to be per-control classes inside the control's own element.
They are now one shared pair in the field's suffix slot - restyle against the new names:

| Was                                                                                                                                           | Now                        |
| --------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| `.et-date-input-clear`, `.et-date-time-input-clear`, `.et-date-range-input-clear`, `.et-time-input-clear`, `.et-phone-input-clear`            | `.et-input-clear`          |
| `.et-date-input-picker-trigger`, `.et-date-time-input-picker-trigger`, `.et-date-range-input-picker-trigger`, `.et-time-input-picker-trigger` | `.et-input-picker-trigger` |

`.et-password-input-reveal` keeps its name. A selector that reached these through the control
(`et-date-input .et-date-input-clear`) no longer matches - target them under
`.et-form-field-suffix`, or by class alone.
:::

Field shell variants (as `data-*`-reflected inputs on `et-form-field`):

| Input        | Values                                                            | Default         |
| ------------ | ----------------------------------------------------------------- | --------------- |
| `appearance` | `'box' \| 'underline'`                                            | `'box'`         |
| `fill`       | `'transparent' \| 'filled'`                                       | `'transparent'` |
| `labelMode`  | `'static' \| 'inline' \| 'floating-inside' \| 'floating-outside'` | `'static'`      |
| `size`       | `'sm' \| 'md' \| 'lg'`                                            | `'md'`          |

`appearance: 'underline'` is the compact one: it has no box to fill, so its frame is
content-height and the rule sits right under the value (`sm` renders at 27px vs 42px for
`box`). That density also means a smaller tap target - prefer `box`/`filled`, or a larger
`size`, where touch matters more than compactness.

Only `fill: 'filled'` paints a surface behind the control, so only a filled field
raises the surface elevation for its contents (and for overlays anchored inside
it, such as the rich text editor's autocomplete). A `transparent` field stays
flush with its parent surface.

The hover treatment belongs to the **frame and the label** - the two boxes that
activate the control - not to the whole field. The field's box also spans the
label band, the gap and the hint/counter row, so a pointer resting next to the
counter leaves the frame at rest.

Every value control distinguishes **read-only** from **disabled**: a read-only
control (from a `readonly(...)` schema) keeps its normal box and stays focusable
but drops every interactive affordance - no hover/focus change, full-contrast
value - so it reads as view-only content; **disabled** stays dimmed. The choice
controls use `et-choice-field` instead of `et-form-field` - see
[Choice & rating](/components/choice-inputs).

### Character counter

Project an `<et-counter />` to get an `x / N` count at the inline-end of the support region. It takes its limit from the bound field's `maxLength()` - signal forms binds the schema limit into the control, so you don't repeat it:

```ts
const bioForm = form(model, (s) => {
  maxLength(s.bio, 180, { message: 'Keep the bio under 180 characters' });
});
```

```html
<et-form-field>
  <et-label>Bio</et-label>
  <et-textarea [formField]="bioForm.bio" />
  <et-hint>Shown on your profile.</et-hint>
  <et-counter />
</et-form-field>
```

<StoryEmbed id="components-forms-counter--with-hint" height="360px" />

| Input      | Type                         | Notes                                                                                         |
| ---------- | ---------------------------- | --------------------------------------------------------------------------------------------- |
| `max`      | `number \| undefined`        | Wins over the schema's `maxLength()`. Use it for an unvalidated or softer limit.              |
| `lengthOf` | `(value: unknown) => number` | How the value is measured. Defaults to string length / array & set size / stringified length. |

The counter is **persistent** - unlike the hint, it does not swap out when an error appears, so a reader who just crossed the limit sees the message and the count that caused it together. Past the limit it takes `data-over-limit` and the [semantic error color](/core/theming).

"Past the limit" is the control's own `maxLength` validation error, not a second length check, so the count can never turn red while the field reports itself valid. An explicit `[max]` has no validator behind it and is compared against `lengthOf` directly.

Because the default `lengthOf` counts array elements, the same element counts tags in an `et-tag-input`. The controls deliberately do **not** forward `maxLength` to the native `maxlength` attribute: truncating typed input would stop the validator from ever reporting the violation the counter exists to make visible. Set `maxlength` on the control yourself if you want the browser to clamp instead.

Counting is opt-in per control family: a control declaring a `maxLength` input receives the schema limit. The controls built on the shared text-field base (`et-input`, `et-number-input`, `et-password-input`, `et-color-input`, `et-textarea`) and `et-tag-input` do; others fall back to an explicit `[max]`.

### Busy state

A field shows a small spinner after your own suffix, plus `aria-busy`, while an async validator is in flight for the bound field - no wiring needed, for the same reason the counter needs none:

```html
<!-- spinner appears while the handle is being checked -->
<et-input [formField]="handleForm.handle" />
```

Set `[busy]="true"` on `et-form-field` for work the form doesn't know about (a save, a lookup of your own). It's deliberately subtle - a spinner, no text, and nothing blocks.

## Mixed values (bulk editing)

When one form edits several records whose values disagree, every value control
implements the SDK-wide [mixed state contract](/components/mixed-state): set
`[(mixed)]="true"` and the control masks its hidden raw value (nothing reads as
selected, the field renders empty) and exposes `data-mixed` for styling; the
first user commit **replaces** the value and resolves `mixed` to `false`. It is
explicitly controlled - external value writes never resolve it, so set it back to
`false` yourself once external data establishes one value. See the shared guide
for the full contract, wiring recipe, and per-control presentation table.

- **Text-slot controls take a `mixedLabel`** (unset → [`FORM_FIELD_LABELS.mixed`](/components/localization), `'Mixed'`) shown in place
  of the value while mixed: `et-input`, `et-number-input`, `et-password-input`,
  `et-textarea` (placeholder), `et-color-input`, `et-tag-input`,
  `et-phone-input`, and the date/time family (`et-date-input`,
  `et-date-range-input`, `et-time-input`, `et-date-time-input`,
  `et-duration-input`).
- **Controls without a text slot** express it through ARIA/visual masking only -
  no `mixedLabel`: `et-rating` (`aria-valuetext`), and the selection groups
  `et-radio-group`, `et-checkbox-group`, `et-segmented-button-group` (nothing
  `aria-checked`).
- **Boundaries.** `et-checkbox` and `et-switch` carry this concept as their
  platform-named `indeterminate` input rather than `mixed` - both render a
  first-class indeterminate state. `et-checkbox` reflects it as
  `aria-checked="mixed"`, so it is announced; `et-switch` shows it visually
  (thumb parked mid-track, dashed accent) but keeps `aria-checked` boolean, since
  `role="switch"` has no `"mixed"` in ARIA - reach for `et-checkbox` when the
  state itself must reach assistive tech. `et-otp-input` and the rich text
  editors are not bulk-edit fields.

Each control's `Mixed` Storybook story (under its `Components/Forms/…` entry)
demonstrates the masking and the first-commit-replaces behavior.

## Validation & accessibility

The field chrome handles error display and aria wiring uniformly:

- Errors show once a control is **touched and invalid** - each signal-forms
  `ValidationError` renders as an `et-form-error` in the support region
  (`aria-live="polite"`), replacing the hint with an animated transition. While
  erroring, the field forces the app's error color theme (the theme registered
  with `type: 'error'`).
- A **parse error** (unparseable typed text in the date/time/date-time/duration
  inputs) is surfaced the same way once touched: its `parseErrorMessage` renders
  as an error, with matching `aria-invalid` and `aria-describedby` - no more
  silent invalid state.
- `aria-describedby` on the control automatically points at the active error (or
  hint), `aria-labelledby` at the `et-label`; the label renders a `*` marker when
  the control is `required`.
- The `et-label` is **optional**, but every control needs an accessible name.
  When you omit the label, give the control its own `aria-label` or
  `aria-labelledby` (the text-field controls - `et-input`, `et-number-input`,
  `et-password-input`, `et-color-input`, `et-textarea` - forward both onto the
  native element, and a consumer `aria-labelledby` overrides the projected
  label). A placeholder is **not** an accessible name. Without a label, the
  layout no longer reserves the label band in `static` / `floating-outside`
  modes.
- Selection groups use correct roles for their mode: a single-select group is a
  `radiogroup` of `radio`s; a multi-select checkbox group is a `role="group"` of
  `role="checkbox"` items (and the tri-state select-all is a `checkbox`, not an
  `option`).
- A schema-`hidden` field (signal-forms `hidden`) removes the whole
  `et-form-field` from layout and the accessibility tree.
- Dev mode throws an actionable error if an `et-form-field` contains no control
  ([`ET2200`](/components/error-codes#form-field-et22xx)) or a control with no
  accessible name - no `et-label` and no `aria-label`/`aria-labelledby`
  ([`ET2201`](/components/error-codes#form-field-et22xx)).

### Server-side violations

`@ethlete/query` ships a bridge that maps an API error response's violation list
onto a signal form, so backend validation surfaces on the exact fields it belongs
to. Return `mapViolationsToFormErrors` from a `submit()` action - mapped
violations render in each field's error region like any other validation error,
and signal forms clears them automatically when the user edits the field:

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

Violation property paths (e.g. `items[2].name`) resolve against the form's field
tree; anything that doesn't match a field becomes a form-level error on the
submitted field, and a failure without violations degrades to a form-level error
built from the normalized message - a failed submit never disappears silently.
The mapping options (`rewritePath`, `onUnmappedViolation`) and accepted error
shapes are documented in the
[query error guide](/query/errors#mapping-violations-onto-signal-forms).

### Custom error messages

`et-form-error` renders each error's `message` verbatim; a validator without a
`message` renders an empty row. To centralize or localize error texts, provide a
resolver - it sees every `ValidationError` (including the bridge's
`etServerViolation` kind) and returns the text to show, or `null` to fall back to
the error's own message:

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

The field shell declares public design tokens; override them in your CSS scope:

| Component       | Tokens                                                                                                                                                                                                                                                                                                               |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `et-form-field` | `--et-form-field-gap`, `-control-border-radius` / `-border-width` / `-padding-block` / `-padding-inline` / `-font-size` / `-line-height` / `-affix-gap` / `-disabled-opacity` / `-min-height`, `-affix-icon-size`, `-label-font-size`, `-error-font-size`, `-hint-font-size`, `-support-duration`, `-support-offset` |

Per-control tokens live in each control guide:
[text inputs](/components/text-inputs#theming),
[choice & rating](/components/choice-inputs#theming). All colors resolve through
the [surface/color theme systems](/core/theming) (the error state forces the
theme registered with `type: 'error'`).

## Error codes

An `et-form-field` without a control throws
[`ET2200`](/components/error-codes#form-field-et22xx) in dev mode, and a control
with no accessible name throws
[`ET2201`](/components/error-codes#form-field-et22xx). The per-control ranges
(tag, phone, masked, date & time) are documented in their guides and on the
central [error codes](/components/error-codes) page.
