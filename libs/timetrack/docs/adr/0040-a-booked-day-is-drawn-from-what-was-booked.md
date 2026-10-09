# A booked day is drawn from what was booked

ADR 0038 froze a booked day's engine rows, but `reviewDay` still ran today's fold, override, re-cut and
booking rules over them. On 2026-10-09 eb7aa91ba changed the fold rule and eight booked days changed;
81b0fe6dd put them back by special-casing frozen days. Tom: a booked day must never change because of
a code change.

The same gap showed on 2026-10-06. The app read 10h 45m logged, Tempo held 8h 0m:

- 2h 30m were minutes two rows share - a call over a code row, and a stand-in row resolved to
  FIFAGG-12703 over a FIFAGG-12657 row. The sync writes them once (`separateOverlappingProposals`), the
  day's total counted them twice. `checkDay` now counts the separated writes.
- 15m was the ET-772 row of 17:00. It was written as 30m. The day was frozen after it was synced, and
  the frozen rows hold a 15m ET-772 scrap at 20:30 that today's fold grows the 17:00 row by, so the row
  read 45m and the sync planned an update.

**A booked day stores its review, and is drawn from it.** `DayReviewEdits.booked` holds the review as
it was drawn when the day was booked, the edits it was drawn with, and `written`: each worklog Tempo
holds that the ledger says this app wrote. `reviewDay` returns the stored review while the edits are
the ones it was stored with. No rule runs over it.

**A row this app wrote agrees with Tempo.** When the review is stored, a row whose pieces a sync would
now write differently from the worklogs it was written as takes Tempo's issue, start, length and, for
one worklog, its description. Every written row carries its worklog ids.

**An edit after the booking changes only what it edits.** The day is drawn twice by today's rules, with
the stored edits and with the current ones; a row keeps its stored fields except those the two draws
differ in. A row the edit added or removed comes or goes. The totals and warnings are the second
draw's until the day is booked again.

## When a day is booked

- The first read of a frozen finished day with no stored review fetches the day's worklogs from Tempo
  and stores the review drawn over the frozen rows by the frozen-day rule of 81b0fe6dd. That rule stays
  for this one draw, and for a day Tempo cannot be read for yet.
- Every sync of a finished day stores it again, with the sync's own writes laid over Tempo's answer
  (`writtenAfterSync`), since a read straight after a write can miss them.
- The sent day rows (M7, `ownDayRowsOf`) are the drawn rows, so a booked day sends its stored review.
  `PEER_DAY_ROWS_VERSION` 2 makes every machine send its booked days again.

## Consequences

- A rule change never reaches a booked day again, and a change to the frozen-day rule reaches only a day
  not yet stored.
- A worklog the ledger holds under an id no row has any more (a re-cut before ADR 0038) is drawn as a
  row of its own, added over the stored review on every draw, so a review stored without it heals on
  its own (ADR 0038). 2026-09-28, 09-29 and 10-01 each hold one.
- A setting changed after the booking - a stand-in resolved, a rule - no longer renames a booked row.
