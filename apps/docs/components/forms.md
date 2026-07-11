# Forms

Signal-forms-native form controls: input, checkbox, switch, selection lists and a rich text editor, plus the shared field chrome (labels, hints, errors, affixes) that wires accessibility for you.

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

| Array                      | Contains                                                                  |
| -------------------------- | ------------------------------------------------------------------------- |
| `FORM_FIELD_IMPORTS`       | `et-form-field`, `et-label`, `et-hint`, `etInputPrefix` / `etInputSuffix` |
| `INPUT_IMPORTS`            | `et-input`                                                                |
| `CHECKBOX_IMPORTS`         | `et-checkbox`                                                             |
| `SWITCH_IMPORTS`           | `et-switch`                                                               |
| `CHOICE_FIELD_IMPORTS`     | `et-choice-field` + label/hint chrome                                     |
| `RICH_TEXT_EDITOR_IMPORTS` | `et-rich-text-editor`                                                     |

The selection-list groups have no aggregate array — import the components directly (`CheckboxGroupComponent` + `CheckboxOptionComponent`, `RadioGroupComponent` + `RadioComponent`, `SegmentedButtonGroupComponent` + `SegmentedButtonComponent`), and the same goes for `DescriptionComponent` (`et-description`).

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

`et-input` supports `type: 'text' | 'email' | 'password' | 'tel' | 'url' | 'search'`, `placeholder`, `autocomplete`, `textAlign`, and the shared control state (`disabled`, `readonly`, `invalid`, `required`, …). There is no textarea — multi-line content is the rich text editor's job.

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

<StoryEmbed id="components-forms-switch--default" height="260px" />

## Selection lists

Three group flavors over one selection engine — options are projected children, keyboard navigation is roving-tabindex with wrapping arrows:

| Group                       | Options               | Mode     | Value        |
| --------------------------- | --------------------- | -------- | ------------ |
| `et-checkbox-group`         | `et-checkbox-option`  | multiple | array        |
| `et-radio-group`            | `et-radio`            | single   | single value |
| `et-segmented-button-group` | `et-segmented-button` | single   | single value |

```html
<et-radio-group [formField]="demoForm.color">
  <span class="et-radio-group-label">Favorite color</span>
  @for (option of options(); track option.value) {
  <et-radio [value]="option.value">{{ option.label }}</et-radio>
  }
  <et-hint>Pick one.</et-hint>
</et-radio-group>
```

Checkbox options and radios accept an `et-description` child for secondary text, and the headless layer offers a tri-state "select all" control (`[etSelectionListControl]`).

<StoryEmbed id="components-forms-selection-list-segmented-button-group--default" height="280px" />

## Rich text editor

`et-rich-text-editor` is a Markdown-valued editor built on `contenteditable` (no ProseMirror dependency): the `value` model is **Markdown**, converted to/from HTML internally. It ships a static toolbar (bold, italic, strikethrough, H1–H3, lists, links) plus a floating toolbar over the active selection, and uses the same field shell as text inputs:

```html
<et-form-field>
  <et-label>Match report</et-label>
  <et-rich-text-editor [formField]="demoForm.report" placeholder="Write something…" />
</et-form-field>
```

The editable region is a `role="textbox" aria-multiline="true"` with full invalid/described-by wiring.

<StoryEmbed id="components-forms-rich-text-editor--default" height="420px" />

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
| `et-radio-group` / `et-radio`                       | `--et-radio-group-*` (gap, support, error/hint sizes), `--et-radio-size`, `-dot-size`, `-border-width`, `-transition-duration`, `-opacity-disabled`, `-gap`                                                                                                                                      |
| `et-checkbox-group` / `et-checkbox-option`          | `--et-checkbox-group-*` (gap, support, error/hint sizes), `--et-checkbox-option-size`, `-border-width`, `-border-radius`, `-transition-duration`, `-opacity-disabled`, `-gap`                                                                                                                    |
| `et-segmented-button-group` / `et-segmented-button` | `--et-segmented-button-group-*` (gap, support, error/hint sizes), `--et-segmented-button-padding-x` / `-padding-y`, `-border-width`, `-transition-duration`, `-opacity-disabled`                                                                                                                 |
| `et-rich-text-editor`                               | `--et-rich-text-editor-toolbar-gap`, `-toolbar-padding`, `-button-radius`, `-min-height`, `-content-gap`                                                                                                                                                                                         |

All colors resolve through the surface/color theme systems (the error state forces the theme registered with `type: 'error'`).

## Error codes

An `et-form-field` without a control throws [`ET2200`](/components/error-codes#form-field-et22xx) in dev mode.
