# Choice & rating

The controls where the user picks from fixed options rather than typing a value:
the boolean [checkbox & switch](#checkbox-switch), the three
[selection-list groups](#selection-lists) (radio / checkbox / segmented), and the
[rating](#rating) control. They bind via signal forms - see the
[Forms overview](/components/forms) for the shared validation, mixed-state and
theming contracts.

```ts
import { CHOICE_FIELD_IMPORTS, CHECKBOX_IMPORTS, SWITCH_IMPORTS, RATING_IMPORTS } from '@ethlete/components';
```

| Array                      | Contains                                                                              |
| -------------------------- | ------------------------------------------------------------------------------------- |
| `CHECKBOX_IMPORTS`         | `et-checkbox`                                                                         |
| `SWITCH_IMPORTS`           | `et-switch`                                                                           |
| `CHOICE_FIELD_IMPORTS`     | `et-choice-field` + label/hint chrome                                                 |
| `RATING_IMPORTS`           | `et-rating`                                                                           |
| `CHECKBOX_GROUP_IMPORTS`   | `et-checkbox-group`, `et-checkbox-option`, `et-checkbox-group-select-all`             |
| `RADIO_GROUP_IMPORTS`      | `et-radio-group`, `et-radio`                                                          |
| `SEGMENTED_BUTTON_IMPORTS` | `et-segmented-button-group`, `et-segmented-button`                                    |
| `SELECTION_LIST_IMPORTS`   | the headless engine: `etSelectionList`, `etSelectionOption`, `etSelectionListControl` |
| `DESCRIPTION_IMPORTS`      | `et-description`                                                                      |

## Checkbox & switch - `et-choice-field` {#checkbox-switch}

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

- `et-checkbox` - `role="checkbox"`, `checked` + `indeterminate` models
  (`aria-checked="mixed"` when indeterminate; toggling an indeterminate checkbox
  resolves to checked).
- `et-switch` - `role="switch"`, `checked` + `indeterminate` models (toggling an
  indeterminate switch resolves to checked). Because `role="switch"` cannot carry
  `aria-checked="mixed"`, the indeterminate state is presentational only - the
  thumb parks mid-track behind `data-indeterminate` while `aria-checked` stays
  boolean.
- Both toggle on click and <kbd>Space</kbd>, and mark themselves touched on blur.
- Both honor `readonly` (e.g. from a `readonly(...)` schema): the control keeps
  its normal look and stays focusable (`aria-readonly`), it just cannot be
  toggled - distinct from the dimmed `disabled` state.
- `et-choice-field` accepts `size: 'sm' | 'md' | 'lg'` (default `'md'`), scaling
  the control and label together.

## Selection lists

Three group flavors over one selection engine - options are projected children,
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

- The group label is a projected `et-label` - it renders the `*` marker when the
  group is `required` and wires `aria-labelledby`. A plain
  `<span class="et-<group>-label">` also works for text-only labels.
- All three groups accept `size: 'sm' | 'md' | 'lg'` (default `'md'`), matching
  the `et-form-field` size scale.
- All three groups honor `readonly`: options keep their normal focusable look,
  arrow keys still move focus (without the radio pattern's select-while-roving),
  but nothing can be (de)selected - distinct from the dimmed `disabled` state.
- The segmented button group renders its options on a tonal track; the filled
  active pill animates between options on selection.

Checkbox options and radios accept an `et-description` child for secondary text.

### Select all {#select-all}

`<et-checkbox-group-select-all>` is the prebuilt select-all row: put it in the group above the
options and it ticks all of them, clears them, and shows the **mixed** state while only some are
picked.

```html
<et-checkbox-group [formField]="form.toppings">
  <et-label>Toppings</et-label>
  <et-checkbox-group-select-all />
  @for (topping of TOPPINGS; track topping) {
  <et-checkbox-option [value]="topping">{{ topping }}</et-checkbox-option>
  }
</et-checkbox-group>
```

<StoryEmbed id="components-forms-selection-list-checkbox-group--group-control" height="300px" />

It is a real `role="checkbox"` with `aria-checked="mixed"`, **not** an option: a listbox option has
no mixed state (it uses `aria-selected`), and "some of these are on" is exactly what this control has
to be able to say. Its text comes from the shared `selectAll`
[form label](/components/localization), or from a `label` input for a one-off wording.

The tri-state logic is the headless `[etSelectionListControl]`, which this composes - reach for the
directive directly only when you want entirely different markup.

### Orientation {#orientation}

`et-checkbox-group` and `et-radio-group` take `orientation="horizontal"` to flow their options in a
wrapping row instead of a column:

```html
<et-radio-group [formField]="form.size" orientation="horizontal">…</et-radio-group>
```

<StoryEmbed id="components-forms-selection-list-checkbox-group--horizontal" height="240px" />

The group's label and its error/hint block keep their own lines above and below - only the options
move, and an option is still a direct child of the group, so nothing about the projected DOM changes.
Set `--et-checkbox-group-column-gap` / `--et-radio-group-column-gap` (20px) for the spacing between
options in a row; the vertical `--et-*-group-gap` still spaces the rows.

Vertical is the default and usually the right answer: it scans better and gives each option a
full-width hit area. Reach for horizontal when the options are short and few - a two-way filter, a
size picker. All four arrow keys move between options either way, as the ARIA radio pattern expects.

The segmented button group is horizontal by construction and takes no `orientation`.

### Card presets {#card-presets}

`et-radio`, `et-checkbox-option` and `et-choice-field` take `variant="card"`: the
option becomes a full-width clickable panel with the label leading and the
control trailing, and the selection shows on the panel's border as well as in the
control.

In this variant the **label carries the selection too** - muted until the option
is chosen, full strength once it is. Hover and focus are answered by the panel,
not by the label, so an unselected card under the cursor never reads as selected.

The panel's chrome follows the **`et-form-field` frame**: a neutral border at
rest, `--et-surface-interaction-hover-solid` on hover and
`--et-surface-interaction-active-solid` on press, the accent on focus, and the
accent while selected. There is no tinted fill - the background stays the
surface, so a selected card differs from its neighbours by its border alone.
Because each card is `[etColorInteractive]`, a **selected** card's border also
tracks the theme's hover / focus / active shade instead of freezing at the
resting accent.

Reach for it when the options are few and consequential - a plan, a shipping
speed - and each deserves room for an `et-description`. A 20px circle is a small
thing to aim at; a card is a large one.

```html
<et-radio-group [formField]="demoForm.plan">
  <et-label>Plan</et-label>

  <et-radio value="team" variant="card">
    Team
    <et-description>Everything in Solo, plus shared workspaces.</et-description>
  </et-radio>
</et-radio-group>
```

<StoryEmbed id="components-forms-selection-list-radio-group--card" height="320px" />

`et-checkbox-option` takes the same preset - swap `et-radio-group` for
`et-checkbox-group` above and a multi-select list of cards renders identically
(see the `Checkbox group / Card` story).

For a checkbox or switch the preset lives on the **wrapper**, `et-choice-field`,
because that is what holds the label - so both controls get it from one place.
The wrapper learns the control's checked state with `:has()`.

```html
<et-choice-field variant="card">
  <et-checkbox [formField]="demoForm.acceptTerms" />
  <et-label>I accept the terms</et-label>
  <et-hint>You can withdraw consent at any time.</et-hint>
</et-choice-field>
```

::: tip The whole panel really is the control
`et-radio` and `et-checkbox-option` **are** the panel, so nothing extra is
needed. In `et-choice-field` the panel is a wrapper `div`, so the preset stretches
the projected control's own hit area over it instead of forwarding clicks - which
keeps one activation path, and with it one cursor, one `:hover` treatment, and the
control's own `readonly` (clicks land, nothing toggles) and `disabled` (the panel
dims as a unit and shows `not-allowed`) behavior.
:::

All three components share **one** token set, so a card radius is set once and
every card follows: `--et-selection-card-padding` (`16px`), `-border-radius`
(`10px`), `-border-width` (`1px`), `-transition-duration` (`150ms`) and
`-disabled-opacity` (`0.5`, the choice field's one-unit dim).

::: warning Renamed in favour of one set
These replace `--et-radio-card-*`, `--et-checkbox-option-card-*` and
`--et-choice-field-card-*`, which no longer resolve. The old names each styled one
of the three components; the new ones style all of them. `--et-choice-field-card-disabled-opacity`
is now `--et-selection-card-disabled-opacity`.
:::

The panel chrome is one stylesheet, injected the first time any of the three
renders with `variant="card"` - an app that only ever uses `variant="plain"` never
puts it in the document.

### Segmented button: tabs variant {#segmented-tabs}

`et-segmented-button-group` takes `variant="tabs"`, which underlines the selected
segment instead of filling it and drops the tonal track for a baseline rule. The
same element the FLIP animation moves becomes the underline, so the selection
still slides between segments.

The variant reads the same [tab scale](/components/tabs#theming) real tabs do, so
at a given `size` the two rows match: trigger padding, label size and weight,
underline thickness and the baseline rule. The accent sits in the underline rather
than the label, hovering an unselected segment warms its label without filling it,
and the press does not scale the segment - all as a tab bar behaves.

<StoryEmbed id="components-forms-selection-list-segmented-button-group--tabs" height="220px" />

::: warning It is still a selection control
The tabs variant only changes how the selection is drawn. The group is still a
`radiogroup` bound to a form field. If your segments are **routes**, or panels of
content that should be linkable and announced as tabs, use
[tabs](/components/tabs) instead - this variant is for a filter that happens to
look like tabs.
:::

## Rating - `et-rating` {#rating}

A star rating implementing the slider pattern (`role="slider"`, one keyboard
stop). Value is `number | null` - `null` means no rating.

```html
<et-rating [formField]="demoForm.stars" [max]="5" allowHalf>
  <et-label>Rating</et-label>
  <et-hint>Optional</et-hint>
</et-rating>
```

<StoryEmbed id="components-forms-rating--default" height="220px" />

| Input       | Type                  | Default | Description                                                                              |
| ----------- | --------------------- | ------- | ---------------------------------------------------------------------------------------- |
| `max`       | `number \| undefined` | `5`     | Number of steps. Reserved by signal forms - a schema `max(...)` validator binds into it. |
| `allowHalf` | `boolean`             | `false` | Half-star steps for pointer, keyboard and rendering.                                     |
| `readonly`  | `boolean`             | `false` | Display-only (still focusable, e.g. for review averages).                                |

Interaction: hovering previews without committing, clicking commits (clicking the
current value **clears** to `null`), and **dragging/swiping across the stars**
(mouse or touch) previews continuously and commits on release - vertical page
scrolling stays untouched (`touch-action: pan-y`). A drag the browser takes away
mid-gesture (a system swipe, an incoming call) commits nothing and drops the
preview. Arrows step by `1` (or `0.5`),
<kbd>Home</kbd>/<kbd>End</kbd> jump to first/last step,
<kbd>Backspace</kbd>/<kbd>Delete</kbd> clear - arrowing below the first step also
clears. The host exposes `aria-valuemin="0"`/`aria-valuemax`/`aria-valuenow` and
an `aria-valuetext` like `3.5 of 5`.

The default stars fill as **one continuous motion** - a single clipped overlay
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
rather than `mixed` - reach for `et-checkbox` when the state itself must reach
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
- Every group/control needs an accessible name - a projected `et-label` or your
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
