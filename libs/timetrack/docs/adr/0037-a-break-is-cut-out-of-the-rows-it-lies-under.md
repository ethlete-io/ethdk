# A break is cut out of the rows it lies under

> **Amends [ADR 0028](./0028-a-break-is-the-time-away-less-what-each-prompt-bought-back.md)**, which
> kept a break an agent ran through booked and only drew it over the row.

On 2026-10-02 one agent session ran from 09:45 to 15:00, through breaks of 12:00-12:21, 13:10-13:43
and 13:58-14:45. Tom typed no prompt in any of them, at the desk or from the phone. The day booked one
row of 5h 15m and drew the three breaks hatched over it. Tom: he did nothing in those breaks, so the
time must not reach Tempo.

ADR 0028 kept that time for phone steering. Since then the break itself became the answer to that
question: a break is the time away less what each prompt bought back, and ADR 0033 cuts a remote
stretch out of it whole. What is left of a break is time nobody was there for.

**A break is cut out of every attended row it lies under.** The row becomes a part before the break
and a part after it, each with its own start, end and duration, and each rounded to the increment like
any other row. The first part keeps the row's start, and so its id. A part after a break is marked
`afterBreak`, so it folds only into a row it touches. A pinned row whose end tracks the day follows the
part it overlaps most; the parts after the break are rows of their own.

The cut runs on the measured break, before the rows are snapped, so a part after a break starts where
a row after any other break starts: on the boundary below the minute the user came back.

Measured on the real 2026-10-02, read at 15:30: the one row of 5h 45m is four rows of 4h 45m.

## Consequences

- **What a prompt bought back stays booked.** It is not part of the break, so no row is cut there. A
  remote stretch keeps its booking under ADR 0033.
- **ADR 0030 holds.** A call the user attended and a run they timed are taken out of the break before
  the cut, so neither is cut, nor the work under it.
- **A row nobody attended is unchanged.** It books nothing, ends with the break it starts in, and is
  still drawn, as ADR 0018 decides.
- **The break lane draws the gap the parts leave**, as it does for any break between two rows.
- **A row the reviewer pinned at both ends keeps its span.** The cut is the day's proposal, not a
  rewrite of what the reviewer wrote.
- **A statement does not undo the cut.** A `present` statement over a break clears the drawn break but
  not the cut, because statements are read after the rows are built.
