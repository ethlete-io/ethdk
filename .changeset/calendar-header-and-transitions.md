---
'@ethlete/components': minor
---

Calendar: a header that holds still, and grids that cross over rather than cut.

- **The header label transitions with the grid it names.** Stepping a month or drilling a view used
  to swap the text in place while the grid animated underneath it — `2026` appearing where
  `August 2026` had been, in one frame. The label now travels the same 200ms and the same direction
  as the rows, and fades between units the way the grids do.
- **The caret no longer moves.** It sat after the text in a centred row, so every label of a
  different length swung it sideways — a step from `May 2026` to `September 2026` moved it 20px. It
  is pinned to the label button's trailing edge now, the text stays centred in the header, and the
  caret turns over when the reader reaches the year grid (there is nothing coarser above it, so
  tapping goes back to the day grid).
- **The header label reads as the button it is**: a press state, which is the only interaction
  feedback a touch device ever gets, and a transition on the hover state rather than a hard flip.
- **A grid change is a real crossfade.** The rows now share one grid area on the way in and out, so
  the outgoing grid dissolves under the incoming one instead of vanishing a frame before it arrives.
  It takes no clicks while it leaves.
- **The month and year grids use the same row height as the day grid** — one cell tall, not two —
  and sit centred in whatever height the picker reserves, so the month grid is a tidy 4×3 instead of
  three rows floating in a box with the remainder at the bottom.
- **The picker's bottom sheet no longer changes size**: it reserves the day grid's six-row worst case,
  so neither paging a month nor drilling a view moves it. A sheet grows upwards from the bottom of the
  screen, so any height change slides its top edge — and everything under the reader's thumb with it.
  The anchored panel on wider screens still sizes itself to whatever is showing, which is what it has
  always done: it grows downwards from a field, where a resize costs nothing.
