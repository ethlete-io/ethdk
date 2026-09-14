# A row books the time its band covers

Tom, on 2026-09-14, reading a band drawn from 15 past to 45 past and labelled `15m`: "here the sdk
block reads 15m but its 30m", and "15 - 45 means 30 minutes should be booked."

A row therefore books `to - from`. The band on the day screen and the duration on the row are one
number, and a reviewer can read the booking off the clock.

ADR 0017 kept them apart. `roundDurationUp` answered _how much does this book_ and `snapRowBounds`
answered _when does this say it ran_, and the two were free to disagree: a band could cover 30
minutes on the grid and book 15. That is the label Tom read. The rule that produced it was
`roundDurations`, which held a day's total across its rows and gave a row that observed 13 minutes
inside a 30-minute window one increment.

## The rule now

`snapRowBounds` still places both ends on the grid, and `roundDurationUp` still decides the smallest
band a row may have: the end never lands before the start plus the row's rounded time, so every band
covers a whole number of increments. What changed is what happens after. `propose` and `reviewDay`
read the duration back off the snapped bounds, so nothing can carry a duration its band contradicts.

A row the row before it pushes gives its minutes up. Its start moves to where its neighbour ends and
its end stays where the clock put it, because those minutes are now booked by the earlier row and
extending the later one would book them twice.

`observedMs` is unchanged. It carries the evidence-backed time beside the booking, and the day screen
shows both, so the reviewer can still see what the rounding did.

## Consequences

- The first consequence of ADR 0017 is overturned. `to - from` **is** `durationMs`, on every row the
  engine builds and on every row a reviewer edits. A row that spans a gap between its blocks books the
  gap; `observedMs` is where the gap shows.
- `roundDurations` is deleted. It had no caller left: a split and a boundary drag now move clock times,
  and the durations follow.
- `ManualRow.durationMs` is removed. A hand-written row is a span like any other.
- `setRowDuration` moves the row's end through `setRowRange`. The duration field on the edit surface
  writes a time, not a number beside one.
- A day books slightly more than it did, because a band that used to book one increment inside a wider
  window now books the window. This is the point: the widening was already on screen, and only the
  number disagreed.
