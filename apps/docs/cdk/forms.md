# Forms

The CDK form system: field wrappers with shared label/error chrome around typed controls, bound via **classic Angular reactive forms** (`FormControl` / `ControlValueAccessor`).

::: warning Superseded by @ethlete/components - except for reactive forms
Every control on this page has a successor in [`@ethlete/components` forms](/components/forms), but the
successors are **signal-forms only**: they implement Angular's `FormValueControl` / `FormCheckboxControl`
contracts and bind via `[formField]`, with no `ControlValueAccessor` layer. **If your app is still on
classic reactive forms, the CDK controls are the ones to use** - that stack lives only here.

| CDK                                                                                                                                                 | components                                                                                                                                                     |
| --------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `et-input-field` / `et-select-field` / … wrappers                                                                                                   | one `et-form-field` shell (`et-choice-field` for the boolean controls), same `etInputPrefix` / `etInputSuffix` affixes                                         |
| `et-text-input`, `et-textarea-input`, `et-number-input`, `et-password-input`, `et-color-input`, `et-email-input`, `et-search-input`, `et-tel-input` | [Text inputs](/components/text-inputs): `et-input` (with `type`), `et-textarea`, `et-password-input`, `et-color-input`, plus masked, OTP, tag and phone inputs |
| `et-date-input`, `et-time-input`, `et-date-time-input`                                                                                              | [Date & time inputs](/components/date-time-inputs) - typed entry with anchored pickers, plus date range and duration                                           |
| `et-checkbox`, `et-slide-toggle`                                                                                                                    | [Choice & rating](/components/choice-inputs): `et-checkbox`, `et-switch`                                                                                       |
| `et-selection-list-field`, `et-radio-group`, `et-segmented-button-group`                                                                            | the three selection-list groups: `et-checkbox-group`, `et-radio-group`, `et-segmented-button-group` (`variant="tabs"` for the tabs look)                       |
| `et-select` + `et-combobox`                                                                                                                         | one [select](/components/select) - an optional search input turns it into the combobox                                                                         |
| `et-native-select`                                                                                                                                  | no successor; use [select](/components/select) or a plain `<select>`                                                                                           |
| `et-slider`                                                                                                                                         | [Slider](/components/slider), which also does two-thumb ranges                                                                                                 |
| `provideValidatorErrorsService()`                                                                                                                   | messages come from the signal-forms schema (`required(s.email, { message })`) - see the [forms overview](/components/forms)                                    |
| `provideDateFormat()` / `provideTimeFormat()` / `provideDateTimeFormat()`                                                                           | per-control `precision` and time-zone handling on the date & time inputs                                                                                       |

For a hierarchical picker, a Markdown editor or a file upload there was no CDK equivalent at all - see
[cascader](/components/cascader), [rich text editor](/components/rich-text-editor) and
[dropzone](/components/dropzone).
:::

## Anatomy of a field

A control sits inside a `*-field` wrapper together with an `et-label`; the `[formControl]` binds to the **field**, which owns the value accessor and renders validation errors below the control:

```html
<et-input-field [formControl]="email">
  <et-label>E-mail</et-label>
  <et-email-input />
</et-input-field>
```

```ts
import { InputImports } from '@ethlete/cdk';

@Component({ imports: [InputImports, ReactiveFormsModule] })
export class SignupComponent {
  email = new FormControl('', [Validators.required, Validators.email]);
}
```

The wrapper wires ids for `label[for]`, `aria-labelledby` and `aria-describedby` automatically and mirrors the control state as CSS classes on the field: `et-required`, `et-disabled`, `et-empty`, `et-autofilled` and `et-should-display-error` (errors become visible once the control has been touched).

### Validation messages

Error rendering needs a message service - provide it once at the root:

```ts
import { provideValidatorErrorsService } from '@ethlete/cdk';

providers: [provideValidatorErrorsService()];
```

The default service translates the built-in validators (`required`, `email`, `minlength`, `min`, `pattern`, …) plus the `@ethlete/core` validators into English strings. Pass your own implementation of `parse(errors)` for custom wording or i18n. Per field, `hideErrorMessage` keeps the message visually hidden but still announced.

### Prefixes & suffixes

Inputs accept projected affixes via `[etInputPrefix]` / `[etInputSuffix]` (an icon, a unit, a button); the field gets `--has-prefix` / `--has-suffix` classes for styling.

## Typed inputs

`InputImports` bundles twelve input variants, each a thin shell around the corresponding native input type: `et-text-input`, `et-textarea-input`, `et-number-input` (value as `number | null`), `et-email-input`, `et-password-input`, `et-search-input`, `et-tel-input`, `et-date-input`, `et-time-input`, `et-date-time-input` and `et-color-input`. All support `placeholder` and `autocomplete`; number and date variants add `min` / `max`.

<StoryEmbed id="cdk-forms-input-text--default" height="220px" />

Extras worth knowing:

- **Password visibility** - project `<et-password-input-toggle etInputSuffix />` into an `et-password-input` to toggle between masked and plain text.
- **Search clear** - `<et-search-input-clear *etIfInputFilled etInputSuffix />` clears the input; the `*etIfInputFilled` / `*etIfInputEmpty` structural directives render content based on the value.
- **Autosize textarea** - `et-textarea-input[etAutosize]` grows with its content, capped by `maxHeight`.
- **Date formats** - the native pickers speak their own formats, but the _model_ value format is configurable app-wide via `provideDateFormat()` / `provideTimeFormat()` / `provideDateTimeFormat()` (date-fns format strings; the default is an ISO-like `yyyy-MM-dd'T'HH:mm:ssxxx`, times default to `HH:mm`).
- **Native pickers** - `[etShowPickerTrigger]` opens the browser picker programmatically; `*etIfSupportsShowPicker` guards for support.

## Checkbox

```html
<et-checkbox-group>
  <et-checkbox-field>
    <et-checkbox etCheckboxGroupControl />
    <et-label>All fruits</et-label>
  </et-checkbox-field>
  <et-checkbox-field [formControl]="apple">
    <et-checkbox />
    <et-label>Apple</et-label>
  </et-checkbox-field>
</et-checkbox-group>
```

```ts
import { CheckboxImports } from '@ethlete/cdk';
```

`CheckboxImports`. Supports an indeterminate state, a card-style variant (`et-checkbox-card-field`) and groups: a checkbox marked `etCheckboxGroupControl` acts as the "select all" master for its siblings (with `aria-controls` wired for you).

## Radio

```html
<et-radio-group [formControl]="choice">
  <et-radio-field>
    <et-label>Option one</et-label>
    <et-radio value="1" />
  </et-radio-field>
  <et-radio-field>
    <et-label>Option two</et-label>
    <et-radio value="2" />
  </et-radio-field>
</et-radio-group>
```

```ts
import { RadioImports } from '@ethlete/cdk';
```

`RadioImports`. The group carries the `formControl` and `role="radiogroup"`; each `et-radio` contributes a `value` (compared deeply, so object values work) and an optional `disabled`. A card variant exists as `et-radio-card-field`.

## Slide toggle

```html
<et-slide-toggle-field [formControl]="enabled">
  <et-slide-toggle />
  <et-label>Enable notifications</et-label>
</et-slide-toggle-field>
```

```ts
import { SlideToggleImports } from '@ethlete/cdk';
```

`SlideToggleImports`. A boolean switch - superseded by the components [`et-switch`](/components/choice-inputs#checkbox-switch) for signal-forms apps.

## Segmented button

```html
<et-segmented-button-group [formControl]="view" renderAs="buttons">
  <et-segmented-button-field>
    <et-segmented-button value="list">List</et-segmented-button>
  </et-segmented-button-field>
  <et-segmented-button-field>
    <et-segmented-button value="grid">Grid</et-segmented-button>
  </et-segmented-button-field>
</et-segmented-button-group>
```

```ts
import { SegmentedButtonImports } from '@ethlete/cdk';
```

`SegmentedButtonImports`. A single-select group rendered as a connected button row with a FLIP-animated active indicator. `renderAs` switches between `'buttons'` (default) and `'tabs'` styling.

## Slider

```html
<et-slider-field [formControl]="volume">
  <et-label>Volume</et-label>
  <et-slider [min]="0" [max]="100" [step]="1" />
</et-slider-field>
```

```ts
import { SliderImports } from '@ethlete/cdk';
```

`SliderImports`. Defaults: `min` 0, `max` 100, `step` 1. Options: `vertical`, `inverted` and `renderValueTooltip`, plus a custom thumb via `<ng-template etSliderThumbContentTemplate>`. Full `role="slider"` semantics with keyboard support (arrows ±1 step, PageUp/PageDown ±10, Home/End) and mouse/touch dragging that snaps to `step`.

<StoryEmbed id="cdk-forms-slider--default" height="200px" />

## Selection list

```html
<et-selection-list-field [formControl]="tags" multiple>
  <et-selection-list-option isResetOption>All</et-selection-list-option>
  <et-selection-list-option value="angular">Angular</et-selection-list-option>
  <et-selection-list-option value="rxjs" disabled>RxJS</et-selection-list-option>
</et-selection-list-field>
```

```ts
import { SelectionListImports } from '@ethlete/cdk';
```

`SelectionListImports`. A `role="listbox"` of options with single or `multiple` selection, roving-tabindex keyboard navigation (typeahead, Home/End, Ctrl+A in multiple mode). An `isResetOption` appears selected while the model is empty and clears the value when picked.

## Select

All three select flavors share the same `et-select-field` wrapper (which carries the `formControl` and label).

### Native select

```html
<et-select-field [formControl]="country">
  <et-label>Country</et-label>
  <et-native-select>
    <et-native-select-option disabled hidden>Please choose</et-native-select-option>
    <et-native-select-option value="de">Germany</et-native-select-option>
    <et-native-select-option [value]="regionObject">Regions work too</et-native-select-option>
  </et-native-select>
</et-select-field>
```

```ts
import { NativeSelectImports } from '@ethlete/cdk';
```

`NativeSelectImports`. A styled shell around a real `<select>` - best on mobile. Option values aren't limited to strings; the directive maps the selected index back to the bound value.

### Styled select

```html
<et-select-field [formControl]="assignees">
  <et-label>Assignees</et-label>
  <et-select multiple emptyText="Nothing selected">
    <et-select-option value="1">Alice</et-select-option>
    <et-select-option value="2" disabled>Bob</et-select-option>
  </et-select>
</et-select-field>
```

```ts
import { SelectImports } from '@ethlete/cdk';
```

`SelectImports`. An overlay-based listbox with single/`multiple` selection and complete keyboard handling - Alt+Arrow and Space open, typeahead jumps to options, Escape/Tab close, Backspace removes the last value in multiple mode.

<StoryEmbed id="cdk-forms-select-select--default" height="380px" />

### Combobox

An autocomplete-style select: a text input filters an option list in an overlay.

```html
<et-select-field [formControl]="user">
  <et-label>User</et-label>
  <et-combobox [options]="users" [filterInternal]="true" bindLabel="name" bindValue="id" placeholder="Search users…">
    <ng-template etComboboxOptionTemplate let-option="option">{{ option.name }}</ng-template>
  </et-combobox>
</et-select-field>
```

```ts
import { ComboboxImports } from '@ethlete/cdk';
```

<StoryEmbed id="cdk-forms-select-combobox--default" height="420px" />

| Input                | Default          | Purpose                                                                                                                               |
| -------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `options` (required) | -                | The option list - primitives or objects (with `bindLabel` / `bindValue` / `bindKey` / `bindDisabled`).                                |
| `filterInternal`     | `false`          | `true` filters the given options in memory; `false` emits the debounced (300ms) text via `(filterChange)` so you can query a backend. |
| `multiple`           | `false`          | Multi-select with chips; Backspace removes the last one.                                                                              |
| `allowCustomValues`  | `false`          | Enter adds the typed text as a value.                                                                                                 |
| `loading` / `error`  | `false` / `null` | Show a loading or error body while async options resolve.                                                                             |

Every rendered piece - options, selected chips, the empty/loading/error/"more items" bodies - can be replaced with templates (`etComboboxOptionTemplate`, `etComboboxBodyEmptyTemplate`, …) or component classes. App-wide defaults (like the empty text) go through `COMBOBOX_CONFIG_TOKEN`.

## Styling

Everything renders `et-` classes: the shared chrome (`et-form-field`, `et-label`, `et-error--has-errors`, the state classes listed above) and per-control classes with state modifiers, e.g. `et-checkbox--checked`, `et-radio--checked`, `et-select--is-open`, `et-select-option--active`, `et-combobox--loading`, `et-slider--is-sliding`, `et-segmented-button--checked`. See each control's stories for the full markup.
