---
'@ethlete/components': minor
---

Add vertical orientation and tick marks to both sliders. `orientation="vertical"`
turns `et-slider` / `et-range-slider` (and the headless `etSlider` /
`etRangeSlider`) into a bottom→up slider - `aria-orientation` follows, pointer
mapping runs on the block axis, `touch-action` frees the other axis, and RTL
leaves a vertical track unmirrored; its length comes from
`--et-slider-vertical-size`. `marks` renders ticks on the track (`true` for one
per `step`, or an array of `{ value, label? }` stops), ticks inside the fill pick
up the active color, tick labels are `aria-hidden` decoration, and a pointer press
on a tick commits that exact value. With `snapToMarks`, commits and keyboard steps
move mark to mark instead of along the `step` grid (range sliders still honor
`minDistance`) and the current mark's label becomes the thumb's `aria-valuetext`.
