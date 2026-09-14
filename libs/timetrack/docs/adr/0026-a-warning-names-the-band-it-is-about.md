# A warning names the band it is about

Tom, on 2026-09-14, on the same day screen ADR 0020 came from: "Some time matched no issue is
confusing. most of it is non tracked and thus not visible in the scheduler. same for A meeting and
observed work claim the same time. what meeting? i dont see overlapping meetings in here".

Both warnings were true and neither was findable. One counted bands the screen no longer draws as
questions; the other named no call, no clock time and no row.

## An answered band is no longer unattributed

`reviewDay` handed `checkDay` the engine's own `rows.unattributed`, which is built before a single
edit is applied. A band the reviewer named therefore became a proposal _and_ stayed unattributed: the
day booked the minutes and, in the same breath, asked to have them named. A hidden band did the same.

`reviewDay` now drops every band the reviewer has settled — named, given a stand-in, hidden, or
consumed by a row they built — before the check runs. The band is matched through `unnamedRowId`,
which is the id its row already carried, so the review and the engine agree without a second identity.

## A warning says where to look

`unattributed-time` reported a count of blocks. A count answers nothing: the reviewer has to find
them. It now lists the lanes, longest first — `5h 34m: ethlete-sdk 1h 45m, fifagg-frontend 1h 45m,
calls 15m` — which are the day screen's own columns. A concurrent day runs several lanes at once, so
the parts still sum past the clock, and naming them is what makes that readable rather than wrong.

`meeting-overlap` reported one total over the whole day, under the word "meeting". Nothing overlapped
on screen that the reviewer could see, because the overlap was between a _call_ row and a work band in
another column. `CheckDayOptions.meetingOverlapMs` is replaced by `meetingOverlaps`, one entry per
call, and the detail reads `17m during the 09:55 call FIFAGG-12652`. The heading says "call".

## Consequences

- A call nothing named carries its window title into the warning, which is long. It is the label the
  rest of the day already uses for that row, so the two read the same.
- `unattributedMs` and the footer still count concurrent lanes twice. That is the day the machine
  observed; the lane list is what stops the number reading as wall-clock time.
- A caller of `checkDay` that passed `meetingOverlapMs` has to pass `meetingOverlaps` instead. Only
  `dayCheckOptions` did.
