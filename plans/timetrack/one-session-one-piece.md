# One session, one piece

An auto stand-in should open per piece of work, not per branch. Slices 1 to 3 are built: the
session is carried in `ActivityContext.session`, two sessions of one checkout are parallel
stretches, and an overlap books once to the watched band (`rows/cut.ts` `cutUnwatched`). Lanes
already draw overlapping bands side by side. Slices 4, 5 and 6 are open.

## What Tom decided (2026-09-22)

- **The agent session is the finest grain.** A branch switch or an accepted merge request is not a
  cut of its own.
- **Two sessions can be one piece.** Sessions that worked on the same thing one after the other
  belong on one ticket. The grain cuts and something else joins, so the day must not turn into one
  stand-in per session.

## Slice 4: join the sessions that are one piece

Built (2026-09-29): Tom picked the directory rule. `sessionPieces` in `model/session-piece.ts` reads
each session's directory from the files its tool calls named (`workedIn`), through the same
`workPathsOf` rule commits use. A commit cannot say which of two parallel sessions made it. A session
joins the latest earlier piece in the same directory that had ended before it started. Parallel
sessions stay apart (slice 6). A session with no directory is its own piece. The piece is the first
session's id, on `ActivityContext.piece`. Nothing reads it yet; slice 5 does.

Hand join built (2026-09-29): "Join into <name>" in the stand-in list, through `mergeStandIn`, for
every other open stand-in of the same checkout (`standInJoinTargets`). Slice 4 is done.

The stand-in list also needs the reverse of `standIn.split`: a join the user can ask for when the
automatic one cut too finely.

## Slice 5: open one stand-in per piece

In progress (2026-09-29). Built: 578e66c24 gives a session stretch on a base branch its piece's
directory as `workPath`, where the checkout's pieces name 2+ directories. A piece's identity across
days is its directory, not its session id. Thus `groupByWork`, the rules and the stand-ins keep the
`repo@branch#workPath` key, and stored rules still match. 6754ade81 keys the `lastOfStream` fallback in
`mergePass` on checkout plus piece (`pieceOf`). `absorbSlivers` folds an unnamed sliver only into a band
of its own piece (`streamOf` → `pieceOf`); a sliver no band of its piece takes is dropped.
`cutUnwatched` reports what a session lost to a session of its checkout on another issue as a
`BehindStretch` with `session` (2026-10-03); only a row of its lane on its own issue clears it
(`clearOfLaneRows`). Open: check the band on a live day (the snapshot needs the running app), and how
`packLane` draws it beside the row that took it. Named bands of two pieces on one
issue still join through `lastOfTrack`; slice 6 changes that.

- Key `groupByWork` in `ticket/auto-stand-in.ts` on the piece. Today it keys on
  `repoPath@branch#workPath`. `alreadyWaiting` and `alreadyAnswered` follow the piece.
- A rule stored against `repo@branch` must still match, or every answer the user gave is lost.
- Replace the `lastOfStream` fallback in `rows/merge.ts`. `trackOf` (`merge.ts:183`) keys on
  `contextKey`, so sessions are separate tracks. But when a track has no open row, `openFor`
  (`merge.ts:264-277`) falls back to `lastOfStream`, keyed by `streamKey`, which carries neither
  branch nor session. So any unnamed row of the checkout absorbs every session's blocks, and
  `absorbSlivers` does the same for short ones. Replace that fallback with the piece, and not before
  slice 4, or a checkout turns into a row per session.
- Once rows are per session, report the stretch an unwatched session lost as a `BehindStretch`, the
  way worktrees already do (ADR 0034).

## Slice 6: one row per session on the same ticket

Slice 6a built (2026-09-29, 06a5fca3a), the engine side:

- `mergePass` keys a named track on name plus piece (`namedTrackOf`). A band with no piece, or in
  another checkout, still continues the latest band of its name, unless that band holds another piece
  of its checkout (`holdsOtherPiece`). A named sliver folds only into its own name and piece.
- `joinable` does not count the time another piece spent on the same ticket in the same checkout
  (`siblingTime`) against a band's gap or span. Without it, the prompt switches cut one session into
  many short rows. On the real 2026-09-29, 3 parallel ET-772 sessions went from 7 rows to one per piece.
- Booking rule: a row that overlaps another row of the same lane and ticket (`sharingTicket` in
  `rows/round.ts`) books its observed minutes, rounded up and capped at its span. `propose` and
  `reviewDay`'s `bookTheSpan` apply it. Every other row still books its span. The rule is not "a row
  with a piece", because nearly every agent row has a piece, and that would break ADR 0019 for them.
- Downstream: `recutReviewedRows` does not cut a background row behind its sibling session's row. Both
  still lose minutes to foreground rows. `foldShortRows` does not fold a sibling row. `withOverlaps`
  does not warn about an edited sibling pair. `separateOverlappingProposals` places the sibling rows'
  minutes in the free increments of their spans, earliest deadline first, so Tempo gets the wall clock
  once. A second proposal with the same issue and start gets `+<piece>` on its id.

Slice 6b built (2026-09-29): a row with a piece carries `activeUntil`, the end of the last activity of its
own piece in the same checkout, read by `propose` from the blocks before `cutUnwatched`. Auto descriptions
settle 30 minutes after the later of `to` and `activeUntil`; a row without a piece keeps the check on `to`.
Cause of the 10-minute piece: `cutUnwatched` gave the shared minutes to the sibling session, so the row's
`to` lay early while its session still ran. `approvalRowIdsOf` picks the sibling row a `worklog.add`
covers most.

Open:

- Done b2f55fa44: `packLane` in `apps/timetrack/src/app/day-review/lanes.ts` draws a one-ticket overlap group in fixed columns (Tom picked this over one outer band or a collapsed band). e2e `session-columns.spec.ts`.
- Engine side done (2026-10-03): `BehindStretch` for the stretch an unwatched session lost (slice 5); the drawing is open.
- Done e0f482bbc: a second unnamed row with the same stream and start gets `+<piece>` on its id.
- Done 45403c8ae: sibling rows no longer sit in columns. `packLane` in `lanes.ts` draws each one as full-width
  pieces over the minutes it books (`piecesOf`): each 15-minute step of the group goes to the session that
  held most of it, and each row gets as many steps as it books. Where the rows book more than the clock
  holds, a row is drawn shorter instead of over another. Sibling rows now carry their own unjoined
  stretches (`propose`). The row list keeps one row per session. e2e `session-pieces.spec.ts`.
- Tom decided (2026-09-29, c0cb8243f, restored after d98b3de8d and 02c2a5051 replaced it): parallel
  sessions on one ticket are drawn side by side. `packLane` draws each sibling row over its own
  stretches widened to 15m steps (`stretchPiecesOf`), and where only such pieces overlap they cascade
  (`cascadeOf`), the later one indented and on top. `separateOverlappingProposals` books the shared
  minutes once in Tempo (`placeShared`). Tom: "it makes 0 sense to stack parallel tasks below each
  other." Rejected: one card per session after another (d98b3de8d); cards in turns over the 15m steps
  each session held most of (02c2a5051).
- Open: the background band that covers 10:00-14:00 on the live day should become a thin marker.
- Open: the phone stretch 13:15-14:00 on the live day lost its ticket (issueKey missing, description is
  the branch `next`).
- Done 973c95585: sibling rows no longer book more than the clock holds. `siblingBookingsOf` in
  `rows/round.ts` rounds a group's summed observed minutes up once, capped at the clock it covers.
- Done 68a9e9aae: a Bash `workedIn` directory ends in `/`, so `workPathOf` no longer reads it one level
  too high. On the live 2026-09-29 this joined one ET-772 session to its predecessor (6 pieces to 5).
- Done 8c0c299af: a lane shows at most 3 parallel rows of one ticket. Where more overlap, `reviewDay`
  folds the shortest sibling row into the one with the longest span (`foldCrowdedSiblings` in
  `review/fold.ts`). The grown row books the observed minutes of both. A pinned row counts but does not
  fold; an edited row does not fold but can take in another row.

Tom decided (2026-09-29): two agent sessions on one ticket at the same time are two parallel rows,
each with its own auto description. Example: ET-772 in `ethlete-sdk`, one session builds Timetrack
and one builds the scan-files sub-agents. Tempo gets the wall-clock time once: the shared minutes
are split, and the split follows focus, as `cutUnwatched` already does for unnamed stretches.

- Tom decided (2026-09-29): a per-session row books its own observed minutes, snapped to 15m, not its
  snapped span. `cutUnwatched` gives each shared minute to the last-prompted session, so the rows of
  two sessions interleave; booking spans would book the same hour twice. The rows are drawn side by
  side in the lane. Rejected: cut rows at every switch (many short rows); one row with a split text.
- Today `join()` in `rows/merge.ts` merges named rows by issue, so the two sessions become one row.
  Key the join on issue plus piece (slice 4), not issue alone. Needs slice 4 first, or a ticket turns
  into a row per session.
- `ET` is a background project: its rows are cut behind foreground rows (`review/recut.ts`). The
  per-session rows must still lose their stretches to foreground rows the same way.
- Auto description (`review/auto-description.ts`): with one row per session, "settled" can be read
  per session: 30 minutes after that session's last attended activity. This replaces the check on
  the row's end, which passed a 10-minute piece of ET-772 at 11:31 on 2026-09-29 that later grew to
  45 minutes (stored answer asked at 11:31:49, `minutes: 10`). Cause: see slice 6b.

## Slice 7: one row per piece of work, not per session

Tom decided (2026-09-29, replaces the "two parallel rows" decision above): parallel agent sessions
that do one piece of work are one row. Target: `ethlete-sdk` on 2026-09-29, 10:45-14:00, is three
parallel ET-772 rows (Timetrack, SDK audit fixes, the new time picker UI), not one row per session
(about nine). Tempo still gets the wall-clock time once.

- Directories alone separate the Timetrack work (`apps/timetrack`, `libs/timetrack`), but not the
  audit fixes from the time picker: both touch `libs/components`. Session titles and the paths of
  design calls and handoffs (`.ethlete/design/calls`, `.claude/handoffs/<slug>.md`) tell them apart.
- First, a session must hold its own evidence: an observation with a `sessionId` goes to that session,
  not to the oldest running one (`sessionAt` in `stream/stream-day.ts`). Without that, a parallel
  session has no title and no prompts to group by.
- Later: auto mode may dispute a row a rule named, when the row's own titles or commits point to a
  stand-in or to Tempo history (FIP-3006 on 2026-09-29, 14:15, was the security audit); and the git
  scan reads branch-ref reflogs, so a branch a session rebased or merged without a checkout counts.

Done (2026-09-29, 6f3936104, 11bc4627d): the grouping key, decided by Tom. `sessionPieces` (`model/session-piece.ts`)
joins two sessions of a checkout into one piece when they wrote the same named work file - a handoff
(`.claude/handoffs/<slug>.md`), a plan file (`plans/...`) or a design call
(`.ethlete/design/calls/<area>/<name>`) - also when they ran at the same time. Code directories still
join only a session that starts after the piece ended, and project roots with the same last folder
name (an `-e2e` suffix folded) count as one directory, for every work path, because the app passes no project roots: `apps/timetrack`, `apps/timetrack-e2e` and
`libs/timetrack`. Known limit: an audit session that only wrote time picker code joins the audit only
because the audit piece ended last before it started.

Live result 2026-09-29, 10:45-14:00: four ET-772 rows, not three. The fourth is session `f902bd2e`
("Sounds good", audit follow-up): it wrote no handoff or plan and worked mostly in `libs/core`, so no
evidence joins it to the audit. Done: branch-ref reflogs (a3147ca8f) and the dispute of a rule-named row
by activity on another branch (b1c781b7d, settled by auto mode in 4a963cfb9). Open: a dispute from the
row's own titles or from Tempo history (the FIP-3006 case).
