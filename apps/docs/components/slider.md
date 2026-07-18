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

| Input      | Type                  | Default     | Description                                                                                              |
| ---------- | --------------------- | ----------- | -------------------------------------------------------------------------------------------------------- |
| `min`      | `number \| undefined` | `undefined` | Lower bound; `undefined` means `0`. A schema `min(...)` validator binds into this input automatically.   |
| `max`      | `number \| undefined` | `undefined` | Upper bound; `undefined` means `100`. A schema `max(...)` validator binds into this input automatically. |
| `step`     | `number`              | `1`         | Snap grid, anchored at `min`. Keyboard steps, pointer commits and the displayed value all snap to it.    |
| `disabled` | `boolean`             | `false`     | Blocks all interaction and removes the thumb from the tab order.                                         |
| `readonly` | `boolean`             | `false`     | Focusable but not adjustable (`aria-readonly`).                                                          |

The `value` model is a plain `number` (default `0`). Values outside the bounds or off the step grid are displayed clamped and snapped, but the model is only rewritten when the user interacts.

## Range slider

`et-range-slider` models `[number, number]`. Because signal forms reserves `min`/`max` on a value control for validators typed like the value (here the tuple), the numeric track bounds are named `minValue` / `maxValue` instead:

| Input                     | Type     | Default                   | Description                                                                          |
| ------------------------- | -------- | ------------------------- | ------------------------------------------------------------------------------------ |
| `minValue` / `maxValue`   | `number` | `0` / `100`               | Track bounds.                                                                        |
| `step`                    | `number` | `1`                       | Snap grid.                                                                           |
| `minDistance`             | `number` | `0`                       | Minimum gap kept between the thumbs — use a multiple of `step`. `0` lets them touch. |
| `startLabel` / `endLabel` | `string` | `'Minimum'` / `'Maximum'` | Accessible name (`aria-label`) of each thumb.                                        |

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
