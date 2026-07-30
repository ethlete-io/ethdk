# Choice & rating

The controls where the user picks from fixed options rather than typing a value:
the boolean [checkbox & switch](#checkbox-switch), the three
[selection-list groups](#selection-lists) (radio / checkbox / segmented), and the
[rating](#rating) control. They bind via signal forms — see the
[Forms overview](/components/forms) for the shared validation, mixed-state and
theming contracts.

```ts
import { CHOICE_FIELD_IMPORTS, CHECKBOX_IMPORTS, SWITCH_IMPORTS, RATING_IMPORTS } from '@ethlete/components';
```

| Array                  | Contains                              |
| ---------------------- | ------------------------------------- |
| `CHECKBOX_IMPORTS`     | `et-checkbox`                         |
| `SWITCH_IMPORTS`       | `et-switch`                           |
| `CHOICE_FIELD_IMPORTS` | `et-choice-field` + label/hint chrome |
| `RATING_IMPORTS`       | `et-rating`                           |

The selection-list groups have no aggregate array — import the components
directly (`CheckboxGroupComponent` + `CheckboxOptionComponent`,
`RadioGroupComponent` + `RadioComponent`, `SegmentedButtonGroupComponent` +
`SegmentedButtonComponent`), and the same goes for `DescriptionComponent`
(`et-description`).

## Checkbox & switch — `et-choice-field` {#checkbox-switch}

Boolean controls pair with a label inside `et-choice-field` (instead of
`et-form-field`):

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

<StoryEmbed id="components-forms-checkbox--indeterminate" height="220px" />
<StoryEmbed id="components-forms-switch--default" height="220px" />

- `et-checkbox` — `role="checkbox"`, `checked` + `indeterminate` models
  (`aria-checked="mixed"` when indeterminate; toggling an indeterminate checkbox
  resolves to checked).
- `et-switch` — `role="switch"`, `checked` + `indeterminate` models (toggling an
  indeterminate switch resolves to checked). Because `role="switch"` cannot carry
  `aria-checked="mixed"`, the indeterminate state is presentational only — the
  thumb parks mid-track behind `data-indeterminate` while `aria-checked` stays
  boolean.
- Both toggle on click and <kbd>Space</kbd>, and mark themselves touched on blur.
- Both honor `readonly` (e.g. from a `readonly(...)` schema): the control keeps
  its normal look and stays focusable (`aria-readonly`), it just cannot be
  toggled — distinct from the dimmed `disabled` state.
- `et-choice-field` accepts `size: 'sm' | 'md' | 'lg'` (default `'md'`), scaling
  the control and label together.

## Selection lists

Three group flavors over one selection engine — options are projected children,
keyboard navigation is roving-tabindex with wrapping arrows:

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

<StoryEmbed id="components-forms-selection-list-segmented-button-group--default" height="220px" />

- The group label is a projected `et-label` — it renders the `*` marker when the
  group is `required` and wires `aria-labelledby`. A plain
  `<span class="et-<group>-label">` also works for text-only labels.
- All three groups accept `size: 'sm' | 'md' | 'lg'` (default `'md'`), matching
  the `et-form-field` size scale.
- All three groups honor `readonly`: options keep their normal focusable look,
  arrow keys still move focus (without the radio pattern's select-while-roving),
  but nothing can be (de)selected — distinct from the dimmed `disabled` state.
- The segmented button group renders its options on a tonal track; the filled
  active pill animates between options on selection.

Checkbox options and radios accept an `et-description` child for secondary text,
and the headless layer offers a tri-state "select all" control
(`[etSelectionListControl]`). See the `Radio group`, `Checkbox group` and
`Segmented button group` stories.

## Rating — `et-rating` {#rating}

A star rating implementing the slider pattern (`role="slider"`, one keyboard
stop). Value is `number | null` — `null` means no rating.

```html
<et-rating [formField]="demoForm.stars" [max]="5" allowHalf>
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

Interaction: hovering previews without committing, clicking commits (clicking the
current value **clears** to `null`), and **dragging/swiping across the stars**
(mouse or touch) previews continuously and commits on release — vertical page
scrolling stays untouched (`touch-action: pan-y`). Arrows step by `1` (or `0.5`),
<kbd>Home</kbd>/<kbd>End</kbd> jump to first/last step,
<kbd>Backspace</kbd>/<kbd>Delete</kbd> clear — arrowing below the first step also
clears. The host exposes `aria-valuemin="0"`/`aria-valuemax`/`aria-valuenow` and
an `aria-valuetext` like `3.5 of 5`.

The default stars fill as **one continuous motion** — a single clipped overlay
row sweeps across the icons with the theme's primary color. Custom icons via an
`ng-template[etRatingIcon]` (context: the state `'full' | 'half' | 'empty'` and
the 1-based `index`) render per-step instead and don't take part in the sweep.
Tokens: `--et-rating-icon-size` (`24px`), `--et-rating-gap` (`4px`).

## Bulk editing

These controls implement the SDK-wide
[mixed state contract](/components/mixed-state), but express it through
ARIA/visual masking only (no `mixedLabel`): `et-rating` masks its
`aria-valuetext`, and the selection groups (`et-radio-group`, `et-checkbox-group`,
`et-segmented-button-group`) render nothing as `aria-checked`. `et-checkbox` and
`et-switch` carry this concept as their platform-named `indeterminate` input
rather than `mixed` — reach for `et-checkbox` when the state itself must reach
assistive tech (it reflects `aria-checked="mixed"`; the switch keeps
`aria-checked` boolean). See the [Forms overview](/components/forms#mixed-values-bulk-editing).

## Accessibility

- Selection groups use correct roles for their mode: a single-select group is a
  `radiogroup` of `radio`s; a multi-select checkbox group is a `role="group"` of
  `role="checkbox"` items (and the tri-state select-all is a `checkbox`, not an
  `option`).
- `et-checkbox`/`et-switch` toggle on click and <kbd>Space</kbd> and mark
  themselves touched on blur; `readonly` keeps them focusable via
  `aria-readonly`.
- The rating host is a `role="slider"` with a single keyboard stop and a spoken
  `aria-valuetext`.
- Every group/control needs an accessible name — a projected `et-label` or your
  own `aria-label`/`aria-labelledby`. See
  [Validation & accessibility](/components/forms#validation-accessibility).

## Theming

Public design tokens (override them in your CSS scope):

| Component                                           | Tokens                                                                                                                                                                                                                     |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `et-checkbox`                                       | `--et-checkbox-size`, `-border-radius`, `-border-width`, `-transition-duration`, `-opacity-disabled`                                                                                                                       |
| `et-switch`                                         | `--et-switch-track-width`, `-track-height`, `-thumb-size`, `-thumb-offset`, `-transition-duration`, `-opacity-disabled`                                                                                                    |
| `et-choice-field`                                   | `--et-choice-field-gap`, `-support-duration`, `-support-offset`, `-label-font-size`, `-error-font-size`, `-hint-font-size`                                                                                                 |
| `et-radio-group` / `et-radio`                       | `--et-radio-group-*` (gap, label/error/hint sizes, support), `--et-radio-size`, `-dot-size`, `-border-width`, `-transition-duration`, `-opacity-disabled`, `-gap`                                                          |
| `et-checkbox-group` / `et-checkbox-option`          | `--et-checkbox-group-*` (gap, label/error/hint sizes, support), `--et-checkbox-option-size`, `-border-width`, `-border-radius`, `-transition-duration`, `-opacity-disabled`, `-gap`                                        |
| `et-segmented-button-group` / `et-segmented-button` | `--et-segmented-button-group-*` (gap, label/error/hint sizes, support, `-track-padding`, `-track-radius`), `--et-segmented-button-padding-x` / `-padding-y`, `-border-radius`, `-transition-duration`, `-opacity-disabled` |
| `et-rating`                                         | `--et-rating-icon-size` (`24px`), `--et-rating-gap` (`4px`)                                                                                                                                                                |

All colors resolve through the app-registered
[surface/color theme systems](/core/theming) (the error state forces the theme
registered with `type: 'error'`).
