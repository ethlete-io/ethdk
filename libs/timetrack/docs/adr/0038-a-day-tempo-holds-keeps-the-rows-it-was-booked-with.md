# A day Tempo holds keeps the rows it was booked with

The day screen re-runs the engine over a day's stored events every time it reads the day, and only the
reviewer's edits are stored. An edit is keyed by the id of the row it was made on. So a change to the
model re-cuts every day, booked or not.

On 2026-10-05 the phone-time stretch rule (ADR 0033) changed how rows are cut, and two days Tempo
already held were re-cut in the app. On 2026-09-30 a 45m FIP-3006 band was split by an unnamed 15m
row. On 2026-10-01 the FIFAGG-12657 row of 18:15-19:45 that Tom had edited and described became an
unnamed 18:15-19:15 row and a FIFAGG-12657 row of 19:15-19:45, and his edit no longer sat on the row
he made it on. Tom: freeze booked days.

**A finished day Tempo holds keeps its rows.** The first time the app reads such a day, it stores the
engine's rows into the day's edits as `frozenRows`, and `reviewDay` reviews the day over those rather
than over a fresh cut. A model change re-cuts only the days Tempo does not hold.

A day is held when the ledger has a worklog this app wrote on it. A day is finished once it is not
today.

Until 2026-10-08 a foreign worklog in the stored coverage held a day too, the test the stand-ins
still use (`isDayHeldByTempo`). That froze a day another machine of the same user booked: the PC was
off until 19:26 while the MacBook booked the day, and the PC's first read the next morning would have
frozen its own half-collected cut. A later cross-machine merge (M7) could then never reach those
rows. So only a day this app booked itself is frozen; a day only another machine booked keeps being
re-cut.

## Consequences

- The edits still apply. A reviewer can rename, resize, split or hide a row of a frozen day, and a
  sync writes the change, because the edits are applied to the frozen rows as they were to the cut.
- The freeze is written by the day screen, by every agent read of a day, and right after a sync
  writes a day. A day synced while it was still today is frozen on its first read once it is over.
- Evidence that arrives after the freeze, and a setting changed after it (a rule, a project link), no
  longer reach the day's rows. That is the point: Tempo already holds the day.
- A day that was re-cut before this landed is frozen as it now reads. 2026-09-30 and 2026-10-01 need
  their rows fixed by hand once.
- Nothing unfreezes a day. A day whose worklogs were all deleted from Tempo keeps its frozen rows.
