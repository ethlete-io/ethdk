# 06 — Slider: vertical orientation + tick marks

Two standard slider affordances every comparable library has (Radix, Ark,
Material, Mantine) and this one lacks. Evidence: no `orientation` input in
`slider.directive.ts`/`range-slider.directive.ts`;
`slider-thumb.directive.ts:17` hardcodes `'aria-orientation': 'horizontal'`;
no marks/ticks concept anywhere — `step` snaps invisibly.

## Vertical orientation

- `orientation` input (`'horizontal' | 'vertical'`, default horizontal) on the
  headless slider + range-slider directives, surfaced on the styled
  components; `aria-orientation` follows it.
- Engine: `slider-engine.ts` currently maps pointer X→fraction with RTL
  mirroring (`:60-67`). Add the Y axis: vertical sliders run bottom→up
  (fraction from `rect.bottom`); RTL does not flip vertical sliders (per
  ARIA/W3C convention). Keyboard: ArrowUp/ArrowDown already increment/
  decrement — verify mapping stays correct and Home/End/PageUp/PageDown are
  orientation-agnostic.
- CSS: vertical variant via a `data-orientation` attribute; track becomes a
  column (inline-size/block-size swap — use logical properties), thumb travel
  on block axis, value-label bubble repositions to the inline side.
  `touch-action` swaps: horizontal slider keeps `pan-y`
  (`slider-track.directive.ts:16`), vertical needs `pan-x`.
- Range slider: same treatment; `minDistance` logic is fraction-based so it
  should carry over — verify.

## Tick marks

- `marks` input on the headless directives:
  `boolean | { value: number; label?: string }[]` — `true` renders a tick at
  every `step`, an array renders explicit stops (with optional labels).
- Rendering: default components draw ticks on the track (absolutely positioned
  by fraction; `:where()` config-modifier pattern for styling, colors via
  surface/theme tokens; ticks within the filled range get the active color).
  Labels render under (horizontal) / beside (vertical) the tick — labels are
  presentation-only, `aria-hidden` (the thumb's value text is the accessible
  value).
- Optional `snapToMarks` input: when marks are an explicit array, thumb snaps
  to nearest mark instead of `step` grid (common "Low/Medium/High" use).
- Clicking a tick/label moves the (nearest) thumb to it.

## Notes

- Headless-first: all logic in the headless tier so custom-styled consumers
  get both features; the default components add the visuals
  (component-architecture skill).
- Watch bundle: tick rendering is a loop in the default component template —
  no styles-only-component split needed at this size.

## Verification & shipping

Stories: vertical single + range, marks boolean, labelled marks with
snapToMarks, RTL horizontal (existing behavior must not regress — engine has
spec coverage `slider-engine.spec.ts:76`; extend specs for vertical). Mobile
emulator pass for touch-action correctness both orientations. Docs:
`slider.md` (orientation + marks sections). Changeset: `@ethlete/components`
(minor).
