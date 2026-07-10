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

## Text fields — `et-form-field` + `et-input`

The form field renders the shell (label, prefix/suffix affixes, hint/error support region); the control registers itself into it via DI — no manual wiring:

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
- Dev mode throws an actionable error (`MISSING_CONTROL`, code 1800) if an `et-form-field` contains no control.
