# Slider

`et-slider` picks a single number from a range by dragging a thumb; `et-range-slider` picks a `[start, end]` pair with two thumbs that cannot cross. Both integrate with signal forms like every other [forms](/components/forms) control and ship with the same label/hint/error chrome. Import `SLIDER_IMPORTS`.

```ts
import { SLIDER_IMPORTS } from '@ethlete/components';
```

```html
<et-slider [formField]="form.volume" [min]="0" [max]="100" [step]="1">
  <et-label>Volume</et-label>
  <et-hint>System output volume</et-hint>
</et-slider>
```

## Live demo

<StoryEmbed id="components-forms-slider--default" height="220px" />

## Options

On `et-slider` (forwarded from the headless `[etSlider]` directive):

| Input        | Type                  | Default     | Description                                                                                              |
| ------------ | --------------------- | ----------- | -------------------------------------------------------------------------------------------------------- |
| `min`        | `number \| undefined` | `undefined` | Lower bound; `undefined` means `0`. A schema `min(...)` validator binds into this input automatically.   |
| `max`        | `number \| undefined` | `undefined` | Upper bound; `undefined` means `100`. A schema `max(...)` validator binds into this input automatically. |
| `step`       | `number`              | `1`         | Snap grid, anchored at `min`. Keyboard steps, pointer commits and the displayed value all snap to it.    |
| `disabled`   | `boolean`             | `false`     | Blocks all interaction and removes the thumb from the tab order.                                         |
| `readonly`   | `boolean`             | `false`     | Focusable but not adjustable (`aria-readonly`).                                                          |
| `mixedLabel` | `string`              | `'Mixed'`   | `aria-valuetext` the thumb announces while `mixed` is true.                                              |

The `value` model is a plain `number` (default `0`). Values outside the bounds or off the step grid are displayed clamped and snapped, but the model is only rewritten when the user interacts.

## Range slider

`et-range-slider` models `[number, number]`. Because signal forms reserves `min`/`max` on a value control for validators typed like the value (here the tuple), the numeric track bounds are named `minValue` / `maxValue` instead:

| Input                     | Type     | Default                   | Description                                                                          |
| ------------------------- | -------- | ------------------------- | ------------------------------------------------------------------------------------ |
| `minValue` / `maxValue`   | `number` | `0` / `100`               | Track bounds.                                                                        |
| `step`                    | `number` | `1`                       | Snap grid.                                                                           |
| `minDistance`             | `number` | `0`                       | Minimum gap kept between the thumbs — use a multiple of `step`. `0` lets them touch. |
| `startLabel` / `endLabel` | `string` | `'Minimum'` / `'Maximum'` | Accessible name (`aria-label`) of each thumb.                                        |
| `mixedLabel`              | `string` | `'Mixed'`                 | `aria-valuetext` both thumbs announce while `mixed` is true.                         |

A reversed tuple is normalized for display (`[80, 20]` renders as 20–80). Dragging or stepping a thumb never lets it cross its sibling; each thumb's `aria-valuemin`/`aria-valuemax` shrink to the sibling's position (± `minDistance`), so assistive tech announces the real limits.

<StoryEmbed id="components-forms-range-slider--default" height="220px" />

## Value labels

Project an `ng-template[etSliderThumbLabel]` to render a value bubble above each thumb — the context is the thumb's current value (`$implicit`) and its `index` (`0` = start, `1` = end):

```html
<et-slider [formField]="form.volume">
  <et-label>Volume</et-label>
  <ng-template etSliderThumbLabel let-value>{{ value }}%</ng-template>
</et-slider>
```

<StoryEmbed id="components-forms-slider--value-label" height="220px" />

## Mixed values in bulk editors

Try it live in Storybook: `Components/Forms/Slider` → `Mixed` / `Components/Forms/Range slider` → `Mixed`.

Use `mixed` when one slider edits several records whose current values differ — both slider components implement the SDK-wide [mixed state contract](/components/mixed-state). A slider has no text display slot, so the state is expressed through ARIA and visual masking: while mixed, the rail switches to a dashed treatment and the thumb(s) park dimmed at the track start (the position reads as "provisional / values differ", not "minimum"), the fill collapses, any value-label bubble is hidden, `aria-valuenow` is removed (the ARIA-sanctioned indeterminate value) and `aria-valuetext` announces `mixedLabel`. The raw form value stays unchanged and is not readable from the DOM.

```html
<et-slider [(mixed)]="volumeIsMixed" [formField]="form.volume" mixedLabel="Different volumes">
  <et-label>Volume</et-label>
</et-slider>
```

Treat `mixed` as explicitly controlled state. Updating the raw form value from application code does not change it; set `volumeIsMixed` to `false` yourself when external data establishes one value. Setting it to `false` reveals whatever raw value is currently in the form.

- The first user commit replaces the hidden raw value and resolves mixed — clicking or dragging on the track commits that position; keyboard steps start from the effective minimum (`ArrowRight` on a `0`–`100` slider commits `1`, `Home` commits the minimum, `End` the maximum). A commit that happens to equal the hidden value still resolves.
- On `et-range-slider` one flag masks both thumbs. The first committed thumb writes a fresh range: its own end takes the committed value, the untouched end falls back to its default bound (`[value, maxValue]` when the start thumb commits first, `[minValue, value]` for the end thumb), honoring `minDistance`. While mixed, each thumb announces the full track as its `aria-valuemin`/`aria-valuemax` — parked thumbs carry no sibling constraint.
- Sliders have no clear affordance; there is no empty shape to clear to.
- Both hosts expose `data-mixed` for consumer styling.

## Headless usage

`[etSlider]` / `[etRangeSlider]` own the state and form integration; `[etSliderTrack]` maps pointer positions on its own rect onto the range (place the thumbs inside it so their pointer events bubble up); each `[etSliderThumb]` carries the ARIA slider semantics and the keyboard model. Thumb order is registration order — render the start thumb first:

```html
<div [(value)]="range" etRangeSlider>
  <div etSliderTrack>
    <div #start="etSliderThumb" [style.--_pos]="start.percent()" etSliderThumb label="Minimum"></div>
    <div #end="etSliderThumb" [style.--_pos]="end.percent()" etSliderThumb label="Maximum"></div>
  </div>
</div>
```

Position thumbs from `percent()` (0–100, already RTL-agnostic when applied via `inset-inline-start`); the host exposes `thumbPercents()` for track fills. Both directives provide the shared `SLIDER_TOKEN`, so the sub-directives compose with either.

## Accessibility

- Each thumb is a `role="slider"` element with `aria-valuemin`/`aria-valuemax`/`aria-valuenow`, `aria-orientation="horizontal"` and `aria-readonly`/`aria-disabled`/`aria-invalid` as applicable.
- A single slider's thumb is labelled by the projected `et-label`; range thumbs get individual `aria-label`s (`startLabel`/`endLabel`).
- Clicking or dragging anywhere on the track moves the nearest thumb (and focuses it); the drag captures the pointer, and vertical touch scrolling stays native (`touch-action: pan-y`).
- Right-to-left contexts mirror everything: positioning uses logical properties and the horizontal arrow keys follow the visual direction.

| Key               | Action                                                  |
| ----------------- | ------------------------------------------------------- |
| ArrowRight / Left | ± one `step` (visual direction, RTL-aware)              |
| ArrowUp / Down    | ± one `step`                                            |
| PageUp / PageDown | ± ten `step`s                                           |
| Home / End        | Jump to the bound (range: as far as the sibling allows) |

## Theming

The rail is a neutral `--et-surface-interaction-solid` tint; the fill and thumbs use `--et-theme-color-primary-solid` from the nearest [color theme](/core/theming). Public design tokens (shared by both components):

| Token                               | Default | Purpose                        |
| ----------------------------------- | ------- | ------------------------------ |
| `--et-slider-track-size`            | `4px`   | Rail / fill thickness          |
| `--et-slider-thumb-size`            | `18px`  | Thumb diameter                 |
| `--et-slider-label-font-size`       | `13px`  | Projected `et-label`           |
| `--et-slider-thumb-value-font-size` | `12px`  | Value-label bubble             |
| `--et-slider-error-font-size`       | `12px`  | Error messages                 |
| `--et-slider-hint-font-size`        | `12px`  | Hint text                      |
| `--et-slider-support-duration`      | `180ms` | Error/hint transition duration |
| `--et-slider-support-offset`        | `4px`   | Error/hint slide-in offset     |

## Error codes

The slider domain owns the `ET3100`–`ET3199` range — see [error codes](/components/error-codes#slider-et31xx).
