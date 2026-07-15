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

<StoryEmbed id="components-forms-textarea--default" height="360px" />

## Color input

`et-color-input` wraps the native color picker: a swatch plus the picked hex value, with the real `input[type=color]` stretched invisibly over it so clicking anywhere opens the platform picker. The form value is `'#rrggbb' | null` — `null` until something is picked (the swatch shows black).

```html
<et-form-field>
  <et-label>Brand color</et-label>
  <et-color-input [formField]="demoForm.brandColor" />
</et-form-field>
```

Design tokens: `--et-color-input-swatch-size` (default `20px`), `--et-color-input-swatch-radius` (default `4px`).

<StoryEmbed id="components-forms-color-input--default" height="320px" />

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

<StoryEmbed id="components-forms-selection-list-segmented-button-group--default" height="280px" />

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
