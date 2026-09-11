# A row rounds twice, and observedMs keeps the truth

Tom, on 2026-09-11: "recording down to the minute feels like surveillance on a next level. the user
shouldnt feel bad just by looking at the screen. times should be recorded with a human factor in
mind. plus row items should always start at a minute divided by 15 and end on one."

A row therefore rounds in two independent places, and they answer two different questions.

`roundDurationUp` answers _how much does this book_. Any part of an increment books the whole of it,
so 23 minutes books 30. The rule is the ceiling and not the nearest boundary, because Tempo accepts
nothing smaller than an increment and a row rounded down to nothing cannot be written at all.

`snapRowBounds` answers _when does this say it ran_. The start rounds back to the boundary below it
and the end to the boundary nearest it, so 09:38 to 10:01 is written 09:30 to 10:00. The end is the
nearest boundary rather than the ceiling on Tom's own example: 10:01 rounds to 10:00, and giving up
that minute is the point of the exercise. The start is the floor rather than the nearest because a
row that starts before the work did is honest about where a reviewer should look, and a row that
starts after it is not.

Two rules bound the result. The end never lands before `from + durationMs`, so a band is never drawn
narrower than the time it books. And where the widening would reach into the row after it, the
earlier row's end rounds down instead of to the nearest boundary; only when that row's own booked
time leaves no room does the later row's start move up to meet it. A snap must not invent an overlap
the raw clock never held.

What the raw clock did hold is kept. `observedMs` carries the evidence-backed duration behind
`durationMs`, and the day screen shows both, so a reviewer can always see what the rounding did. What
is not kept is the raw start and end: once `propose` has snapped a row, the seconds are gone from the
proposal, which is the whole of Tom's point. The evidence chain behind the row still holds them.

## Consequences

- A row's `to - from` is not `durationMs`. It is larger on a row that spans a gap between its blocks,
  because the band covers the gap and the booking does not. This was already true and stays true.
- `proposal.from` is Tempo's `startTime`, so the content hash in `tempo/diff.ts` changes for every
  row. A day synced before this ships will plan an update on its next run. That is correct: the time
  the timesheet claims really did change.
- The proposal id still uses the group's raw start, so a re-run of a day recognises a row it already
  synced rather than duplicating it.
- `roundDurations`, which preserves a total across several rows, stays for `splitRow` and
  `moveBoundary`. A reviewer's cut must not invent time, so a cut is the one place the ceiling is the
  wrong rule.
- The day screen's drag already snapped to the same increment. The two now agree: a row a reviewer
  drags and a row the day proposed sit on the same grid.
