---
'@ethlete/components': minor
---

Sliders: `orientation="vertical"` turns `et-slider` / `et-range-slider` (and the headless `etSlider` /
`etRangeSlider`) into a bottom→up slider, its length set by `--et-slider-vertical-size`. `marks`
renders ticks on the track - `true` for one per `step`, or an array of `{ value, label? }` stops - and
`snapToMarks` moves commits and keyboard steps mark to mark instead of along the `step` grid.
