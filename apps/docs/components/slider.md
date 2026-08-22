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

| Input         | Type                             | Default        | Description                                                                                              |
| ------------- | -------------------------------- | -------------- | -------------------------------------------------------------------------------------------------------- |
| `min`         | `number \| undefined`            | `undefined`    | Lower bound; `undefined` means `0`. A schema `min(...)` validator binds into this input automatically.   |
| `max`         | `number \| undefined`            | `undefined`    | Upper bound; `undefined` means `100`. A schema `max(...)` validator binds into this input automatically. |
| `step`        | `number`                         | `1`            | Snap grid, anchored at `min`. Keyboard steps, pointer commits and the displayed value all snap to it.    |
| `orientation` | `'horizontal' \| 'vertical'`     | `'horizontal'` | Axis the slider runs along - see [orientation](#orientation).                                            |
| `marks`       | `boolean \| { value, label? }[]` | `false`        | Tick marks on the track - see [tick marks](#tick-marks).                                                 |
| `snapToMarks` | `boolean`                        | `false`        | Snaps values onto the marks instead of the `step` grid.                                                  |
| `disabled`    | `boolean`                        | `false`        | Blocks all interaction and removes the thumb from the tab order.                                         |
| `readonly`    | `boolean`                        | `false`        | Focusable but not adjustable (`aria-readonly`).                                                          |
| `mixedLabel`  | `string \| null`                 | `null` ¹       | `aria-valuetext` the thumb announces while `mixed` is true.                                              |

¹ `null` falls through to [`FORM_FIELD_LABELS.mixed`](/components/localization) (`'Mixed'`).

The `value` model is a plain `number` (default `0`). Values outside the bounds or off the step grid are displayed clamped and snapped, but the model is only rewritten when the user interacts.

## Range slider

`et-range-slider` models `[number, number]`. Because signal forms reserves `min`/`max` on a value control for validators typed like the value (here the tuple), the numeric track bounds are named `minValue` / `maxValue` instead:

| Input                     | Type             | Default     | Description                                                                          |
| ------------------------- | ---------------- | ----------- | ------------------------------------------------------------------------------------ |
| `minValue` / `maxValue`   | `number`         | `0` / `100` | Track bounds.                                                                        |
| `step`                    | `number`         | `1`         | Snap grid.                                                                           |
| `minDistance`             | `number`         | `0`         | Minimum gap kept between the thumbs - use a multiple of `step`. `0` lets them touch. |
| `startLabel` / `endLabel` | `string \| null` | `null` ²    | Accessible name (`aria-label`) of each thumb.                                        |
| `mixedLabel`              | `string \| null` | `null` ¹    | `aria-valuetext` both thumbs announce while `mixed` is true.                         |

¹ `null` falls through to [`FORM_FIELD_LABELS.mixed`](/components/localization) (`'Mixed'`).
² `null` falls through to [`SLIDER_LABELS`](/components/localization) (`'Minimum'` / `'Maximum'`).

`orientation`, `marks` and `snapToMarks` behave exactly as they do on `et-slider`.

A reversed tuple is normalized for display (`[80, 20]` renders as 20–80). Dragging or stepping a thumb never lets it cross its sibling; each thumb's `aria-valuemin`/`aria-valuemax` shrink to the sibling's position (± `minDistance`), so assistive tech announces the real limits.

<StoryEmbed id="components-forms-range-slider--default" height="220px" />

## Orientation

`orientation="vertical"` turns either slider into a vertical one. A vertical track runs **bottom→up** - the minimum sits at the bottom, and unlike the horizontal track it is **not mirrored in RTL** (the ARIA/W3C convention). Its length comes from `--et-slider-vertical-size` (`160px`), so give it whatever height the layout needs:

```html
<et-slider [formField]="form.volume" style="--et-slider-vertical-size: 220px" orientation="vertical">
  <et-label>Volume</et-label>
</et-slider>
```

<StoryEmbed id="components-forms-slider--vertical" height="320px" />

Everything else follows: `aria-orientation` reports the axis, ArrowUp/ArrowDown keep incrementing/decrementing, and the browser's native panning is freed on the other axis (`touch-action: pan-x` instead of `pan-y`). Value-label bubbles and tick labels move to the inline sides of the track instead of above and below it.

## Tick marks

`marks` draws stops on the track. Pass `true` for one tick per `step`, or an explicit list for named stops:

```html
<!-- a tick every 10 units -->
<et-slider [formField]="form.volume" [marks]="true" [step]="10" />

<!-- named stops the value snaps to -->
<et-slider [formField]="form.quality" [marks]="qualityMarks" [max]="2" snapToMarks>
  <et-label>Quality</et-label>
</et-slider>
```

```ts
const qualityMarks = [
  { value: 0, label: 'Low' },
  { value: 1, label: 'Medium' },
  { value: 2, label: 'High' },
];
```

<StoryEmbed id="components-forms-slider--marks" height="240px" />

- Ticks inside the filled part of the track (between the thumbs, for a range) render in the theme's on-primary color; the rest sit on the neutral rail.
- Explicit marks are sorted, de-duplicated and clipped to the bounds. `marks="true"` refuses to generate more than 200 ticks - raise the `step` or pass an array ([`ET3104`](/components/error-codes#slider-et31xx)).
- A pointer press that starts on a tick (or its label) commits **that exact value**, not the value under the pointer - a mark that sits off the `step` grid included. The arrow keys still move along the `step` grid, so reach for `snapToMarks` when the marks are meant to be the only stops.
- Labels are decoration: the whole tick layer is `aria-hidden`, and the accessible value stays on the thumb.

### snapToMarks

With `snapToMarks`, the marks replace the `step` grid entirely - commits land on the nearest mark, the arrow keys move one mark at a time (Page keys ten), and Home/End go to the outermost marks. A range slider still honors `minDistance`: a thumb that would come too close to its sibling falls back to the closest mark that keeps the gap.

While snapping, a mark's `label` also becomes the thumb's `aria-valuetext`, so screen readers announce "Medium" instead of "1".

<StoryEmbed id="components-forms-slider--labelled-marks" height="260px" />

## Value labels

Project an `ng-template[etSliderThumbLabel]` to render a value bubble above each thumb - the context is the thumb's current value (`$implicit`) and its `index` (`0` = start, `1` = end):

```html
<et-slider [formField]="form.volume">
  <et-label>Volume</et-label>
  <ng-template etSliderThumbLabel let-value>{{ value }}%</ng-template>
</et-slider>
```

<StoryEmbed id="components-forms-slider--value-label" height="220px" />

## Mixed values in bulk editors

Try it live in Storybook: `Components/Forms/Slider` → `Mixed` / `Components/Forms/Range slider` → `Mixed`.

Use `mixed` when one slider edits several records whose current values differ - both slider components implement the SDK-wide [mixed state contract](/components/mixed-state). A slider has no text display slot, so the state is expressed through ARIA and visual masking: while mixed, the rail switches to a dashed treatment and the thumb(s) park dimmed at the track start (the position reads as "provisional / values differ", not "minimum"), the fill collapses, any value-label bubble is hidden, `aria-valuenow` is removed (the ARIA-sanctioned indeterminate value) and `aria-valuetext` announces `mixedLabel`. The raw form value stays unchanged and is not readable from the DOM.

```html
<et-slider [(mixed)]="volumeIsMixed" [formField]="form.volume" mixedLabel="Different volumes">
  <et-label>Volume</et-label>
</et-slider>
```

Treat `mixed` as explicitly controlled state. Updating the raw form value from application code does not change it; set `volumeIsMixed` to `false` yourself when external data establishes one value. Setting it to `false` reveals whatever raw value is currently in the form.

- The first user commit replaces the hidden raw value and resolves mixed - clicking or dragging on the track commits that position; keyboard steps start from the effective minimum (`ArrowRight` on a `0`–`100` slider commits `1`, `Home` commits the minimum, `End` the maximum). A commit that happens to equal the hidden value still resolves.
- On `et-range-slider` one flag masks both thumbs. The first committed thumb writes a fresh range: its own end takes the committed value, the untouched end falls back to its default bound (`[value, maxValue]` when the start thumb commits first, `[minValue, value]` for the end thumb), honoring `minDistance`. While mixed, each thumb announces the full track as its `aria-valuemin`/`aria-valuemax` - parked thumbs carry no sibling constraint.
- Sliders have no clear affordance; there is no empty shape to clear to.
- Both hosts expose `data-mixed` for consumer styling.

## Headless usage

`[etSlider]` / `[etRangeSlider]` own the state and form integration; `[etSliderTrack]` maps pointer positions on its own rect onto the range (place the thumbs inside it so their pointer events bubble up); each `[etSliderThumb]` carries the ARIA slider semantics and the keyboard model. Thumb order is registration order - render the start thumb first:

```html
<div [(value)]="range" etRangeSlider>
  <div etSliderTrack>
    <div #start="etSliderThumb" [style.--_pos]="start.percent()" etSliderThumb label="Minimum"></div>
    <div #end="etSliderThumb" [style.--_pos]="end.percent()" etSliderThumb label="Maximum"></div>
  </div>
</div>
```

Position thumbs from `percent()` (0–100, already RTL-agnostic when applied via `inset-inline-start`); the host exposes `thumbPercents()` for track fills. Both directives provide the shared `SLIDER_TOKEN`, so the sub-directives compose with either.

All of the behavior above lives in the headless tier - the default components only add visuals. Useful pieces when building your own:

- `orientation()` is mirrored onto the host as `data-orientation`, and `[etSliderTrack]` / `[etSliderThumb]` already set the right `touch-action` themselves.
- `markStops()` gives the resolved ticks as `{ value, label?, percent, active }` in ascending order - render them however you like.
- A tick element carrying `data-et-slider-mark-value="<value>"` commits that exact value when a pointer press starts on it (`SLIDER_MARK_VALUE_ATTRIBUTE`).

## Accessibility

- Each thumb is a `role="slider"` element with `aria-valuemin`/`aria-valuemax`/`aria-valuenow`, an `aria-orientation` that follows the `orientation` input, and `aria-readonly`/`aria-disabled`/`aria-invalid` as applicable.
- A single slider's thumb is labelled by the projected `et-label`; range thumbs get individual `aria-label`s (`startLabel`/`endLabel`).
- Clicking or dragging anywhere on the track moves the nearest thumb (and focuses it); the drag captures the pointer, and touch scrolling on the other axis stays native (`touch-action: pan-y` horizontally, `pan-x` vertically).
- A drag the browser takes away mid-gesture - a system back/home swipe, an incoming call, the tab going to the background - reverts the thumb to the value the press landed on. The user never released, so the position the pointer happened to be at is not one they chose.
- Right-to-left contexts mirror a horizontal slider: positioning uses logical properties and the horizontal arrow keys follow the visual direction. A vertical slider is never mirrored.
- Tick labels are `aria-hidden`. With `snapToMarks`, the current mark's label becomes the thumb's `aria-valuetext`.

| Key               | Action                                                            |
| ----------------- | ----------------------------------------------------------------- |
| ArrowRight / Left | ± one `step` (visual direction, RTL-aware on a horizontal slider) |
| ArrowUp / Down    | ± one `step`                                                      |
| PageUp / PageDown | ± ten `step`s                                                     |
| Home / End        | Jump to the bound (range: as far as the sibling allows)           |

With `snapToMarks`, a "`step`" above means "one mark".

## Theming

The rail is a neutral `--et-surface-interaction-solid` tint; the fill and thumbs use `--et-theme-color-primary-solid` from the nearest [color theme](/core/theming). Public design tokens (shared by both components):

| Token                               | Default | Purpose                        |
| ----------------------------------- | ------- | ------------------------------ |
| `--et-slider-track-size`            | `4px`   | Rail / fill thickness          |
| `--et-slider-thumb-size`            | `18px`  | Thumb diameter                 |
| `--et-slider-vertical-size`         | `160px` | Track length when vertical     |
| `--et-slider-mark-size`             | `4px`   | Tick diameter                  |
| `--et-slider-mark-label-font-size`  | `11px`  | Tick labels                    |
| `--et-slider-label-font-size`       | `13px`  | Projected `et-label`           |
| `--et-slider-thumb-value-font-size` | `12px`  | Value-label bubble             |
| `--et-slider-error-font-size`       | `12px`  | Error messages                 |
| `--et-slider-hint-font-size`        | `12px`  | Hint text                      |
| `--et-slider-support-duration`      | `180ms` | Error/hint transition duration |
| `--et-slider-support-offset`        | `4px`   | Error/hint slide-in offset     |

## Error codes

The slider domain owns the `ET3100`–`ET3199` range - see [error codes](/components/error-codes#slider-et31xx).
