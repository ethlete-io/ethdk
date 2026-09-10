# One day screen, and a band is a row

The app shows a day twice. The Today screen lists streams in an accordion with no time axis, and
the Day Review screen draws a real 24-hour axis beside a table of bookable rows. Tom asked for one
clear timeline of what he did and when, with the ticket match on top of it. Two screens mean he
reads the same day twice in two shapes, so they merge into one. ADR 0007 already ruled that the v1
screens are replaced rather than repaired, so this follows that decision instead of fighting it.

A band on the merged timeline is a **row**, not a stream. The two objects behave differently and
only one of them can be a band. A stream is derived on every read and keyed by its checkout under
ADR 0001, so splitting one contradicts that ADR. A row already splits, merges, moves its boundary
and survives a re-correlation, through `splitRow`, `mergeRows`, `moveRowBoundary` and the `replaces`
list on a `PinnedRow`. Tom asked for splitting and gluing, and choosing the row gets both at no
build cost. The stream stays as the thing that produces the proposal, and it becomes the evidence
shown when a band is opened.

The merged screen starts read-only in the sense that matters: it writes local edits to `day_review`
and it never reaches Tempo. Booking is added to this same screen later, rather than as a third
screen.

## Consequences

- The exit test for naming says "every **stream** of a real day carries the right issue". It has to
  say **band**, or a band the user split would fail a test it should pass.
- `PinnedRow.issueKey` must become optional. Right after a cut, neither half is named, and an
  unnamed band has to be a legal state for the "show both and ask" rule to work at all.
- `DayReviewViewComponent` and `WorklogRowComponent` become reference material for what the booking
  milestone adds. They are not code that survives unchanged.
- `DayTimelineComponent` moves to the merged screen. It consumes `SchedulerTimeGridDirective` from
  `libs/components`, which is the reusable primitive. `libs/components/src/lib/timeline` is **not**
  that primitive: it is an activity feed with no scale, so a duration never becomes a width.
