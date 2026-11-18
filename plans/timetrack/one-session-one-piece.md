# One session, one piece

An auto stand-in opens per piece of work, not per branch. The decisions are in ADR 0043. The piece model, the join by
directory and by named work file, the hand join, the keying of `groupByWork` and `mergePass` on the piece, the sibling
booking rules, the lane drawing and the settle check per piece are built. What is open:

## Open

- **Check on a live day.** The `BehindStretch` a session lost to another session of its checkout (`cutUnwatched`) is
  built in the engine, but nobody looked at it on a running day (the snapshot needs the running app). Also check how
  `packLane` (`apps/timetrack/src/app/day-review/lanes.ts`) draws it beside the row that took the minutes.
- **Named bands of two pieces on one issue** still join through `lastOfTrack`. Slice 6 changed `mergePass`, but the
  case has no check on a live day.
- **A background band that covers a long stretch** (10:00-14:00 on 2026-09-29) should become a thin marker.
- **A phone stretch that lost its ticket** (13:15-14:00 on 2026-09-29: no `issueKey`, the description is the branch
  `next`) is unexplained.
- **A dispute from the row's own evidence.** Auto mode disputes a rule-named row by activity on another branch (built).
  It does not yet dispute from the row's own session titles or from Tempo history (the FIP-3006 case of 2026-09-29, 14:15,
  which was the security audit).
- **A session no evidence joins.** Session `f902bd2e` (audit follow-up) wrote no handoff or plan and worked mostly in
  `libs/core`, so it stays a fourth ET-772 row. Known limit of `sessionPieces`; it needs a new kind of evidence, or
  nothing.
- **A session must hold its own evidence.** An observation with a `sessionId` goes to that session, not to the oldest
  running one (`sessionAt` in `stream/stream-day.ts`). Check whether this is built before relying on session titles.
