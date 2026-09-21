# A background band never claims the increment the day is still in

Tom, on 2026-09-21, with the row open on the screen: "this weird timetrack entry just got created".

The row read `ET-772`, 10:30 to 10:45, logged 00:15, `0m observed`, accepted, and its whole evidence
was one line: the attribution rule that names the `ethlete-sdk` checkout. Three minutes later the row
was gone, and the `specs` band had grown across the same quarter-hour.

The quarter-hour was the `specs` checkout's own. Measured off the day: about 11 minutes of window
focus on `specs`, with two commits and a dozen agent events, against 29 seconds on `ethlete-sdk`.

## Why the cut handed it over

`ET` is a background project, and `cutBackground` gives a background band every minute no foreground
band claims. In a quarter-hour that is not over, no foreground band has claimed anything yet: the
blocks that will cover it are still being cut from events the collectors are still reporting.

`roundDurationUp` then books whole increments, so 29 seconds of presence became a 15-minute row. The
attribution rule carries an issue key, so the row was accepted rather than suggested, which is the
state a sync writes.

Nothing was written — a sync is the user's own act. The row was pre-checked for one, on minutes that
belonged to another checkout.

## The rule

A background band claims nothing in the increment the day is read through. `CutOptions.through` is
that instant, and the cut holds back everything from the start of its increment.

The hold is reported as nothing at all. `behind` says a band lost its minutes to another band, and
these minutes are lost to no one yet.

## Consequences

- The band appears once its increment is over and no foreground band took it. That is one increment
  of delay on a band the day was going to draw anyway.
- The lane holds the running increment open. It is the one stretch of the day the reader cannot yet
  be told anything true about.
- A day that is over is read through its own end, which is after every block it holds, so nothing
  about a past day moves.
- A foreground band still rounds into the increment it is in. It is the work the day observed, and
  the increment it books is the one it already earned.
