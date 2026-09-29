# Time picker: the 24h ring

## Goal

Replace the column overlay of `et-time-picker` with the 24h ring that the design calls in
`.ethlete/design/calls/components/time-range/` (00 to 06) settled. The ring serves the time
input, the time range input, the date-time input and the date-time range input.

## Settled design

- A 24h ring, `SIZE` 280, track radius 112, stroke 28, ticks 88 to 94, labels at 74 (68 for
  labels longer than two characters). A 12h locale keeps the 24h ring with the labels
  `12 AM / 6 AM / 12 PM / 6 PM`, a moon under 12 AM and a sun over 12 PM (call 00 E).
- Single time: one handle. One drag sets hour and minute, snapped to `minuteStep`. The centre
  shows the time live. An exact minute is typed in the input (calls 01 H, 02 A).
- Range: two handles and one arc, also past midnight. The focused field picks the active handle
  on desktop. The overlay has no start and end toggle and no range tint (call 00 B).
- Blocked time (`min`, `max`, `timeFilter`): the track exists only where a time can be picked,
  with butt ends. A blocked span is a dotted line. A drag stops at the edge of a blocked span
  (call 03 C).
- Touch, below `md`: the ring is 328px with 44px handles. No handle is active: the handle under
  the finger moves (call 04 C).
- Centre text: a time-only range shows the duration. With a calendar, the centre shows the time
  and the day of the active end, and the calendar band shows the length (call 05 E).
- Empty value: no handle and no arc. The centre shows `--:--` and a short hint label. A tap
  on the track places the handle of the focused field; in a range, focus then moves to the end
  (call 07 A).
- Desktop with a calendar: calendar left, ring right, as today (call 05 A). Below `md`: the
  Dates and Times tabs stay, the Times tab holds the touch ring (call 06 A).

## Facts from the code

- `time-picker/headless/time-picker.directive.ts`: models `value`, `rangeValue`, `activeSide`;
  inputs `mode`, `minuteStep` (5), `secondStep`, `min`, `max`, `timeFilter(date, side)`, labels.
  Range picks wait in `pendingParts` until the time is complete; the first start pick moves
  `activeSide` to `end` once.
- Nothing binds `activeSide` from field focus today. The field directive sets only its own
  `focusedSide` (`forms/date-time/internals/date-range-picker-input.directive.ts:84`).
- `forms/date-time/internals/date-picker-overlay.ts`: bottom sheet below `md` (768px), anchored
  pane from `md` up. `internals/date-time-panes.directive.ts` animates the time columns with a
  `translateY` when the calendar height changes; it assumes centred columns.
- No ring or angle code exists. Reuse `dragGestureFrom` (`libs/core/src/lib/drag-handle/drag-gesture.ts:176`)
  and the keyboard model of `forms/slider/headless/slider-thumb.directive.ts`.
- `time-availability.ts` already computes disabled options; its rules become blocked spans.

## Status

- Slice 1 (ring math): done, `time-picker/headless/internals/time-ring.ts`.
- Slice 2 (headless ring): done, `TimePickerRingDirective`, `TimePickerRingHandleDirective`, ring state on `TimePickerDirective` (`ringStops`, `ringMinute`, `commitRingMinute`). The columns still exist.
- Slice 3 (default component): done, `et-time-picker` renders the SVG ring (open track, dotted blocked spans, range arc, 24h or 12h labels with moon and sun, handles, centre readout with the duration), tokens `--et-time-picker-ring-size` and `--et-time-picker-handle-size`, labels `emptyHint`, `durationHours`, `durationMinutes`, `endsNextDay`. The side buttons are gone.

## Slices

Each slice ends green (lint with no new warnings, `tsc -p tsconfig.spec.json`, vitest) and is
committed on its own.

1. **Ring math** in `time-picker/headless/internals/time-ring.ts`: minute of day to angle and
   back, snap to `minuteStep`, the blocked spans from `min`, `max` and `timeFilter` (evaluate
   each step, merge runs, wrap past midnight), and the clamp of a drag at a span edge. Pure
   functions with specs.
2. **Headless ring** `TimePickerRingDirective` and `TimePickerRingHandleDirective`
   (`role="slider"`, `aria-valuetext` with the formatted time). The handle self-registers.
   Drag through `dragGestureFrom`; the handle nearest to the pointer moves. Keys: arrows move
   one `minuteStep`, PageUp and PageDown one hour, Home and End the first and last open time.
   Write through the existing `value`, `rangeValue` and `activeSide`. Drop `pendingParts`
   and the auto-advance for the ring: a drag sets a whole time.
3. **Default component**: the SVG ring in `time-picker.component.html`, design tokens for
   the ring size and the handle size (`--et-time-picker-ring-size` 280, 328 in
   `.et-date-picker-sheet`), the centre text, 12h labels and marks, blocked spans. Read the
   `theming` skill first. Remove the side buttons.
4. **Inputs**: bind `activeSide` from `focusedSide` in the time range and the date-time range
   inputs. With a calendar, pass the day of the active end for the centre text. Remove the
   `translateY` of `date-time-panes.directive.ts` if the ring no longer needs it.
5. **Tests**: update `time-picker/testing/time-picker-driver.ts`, the scenarios
   (`time-picker`, `forms-date-time*`), and the e2e suites `time-picker`, `time-inputs`,
   `date-inputs` for drag, keys and touch.
6. **Stories, docs, changeset**: update the time picker stories, `apps/docs/components/time-picker.md`
   and `date-time-inputs.md`, and write the changeset.

## Decisions (Tom, 2026-09-29)

1. Remove `TimePickerColumnDirective`, `TimePickerOptionDirective` and the start and end side
   buttons from the public API. This is a breaking change: note it in the changeset. fut-frontend
   does not use the column or option directives.
2. The ring picks hours and minutes only. Seconds are typed in the input, and `secondStep` keeps
   its meaning for the input.
