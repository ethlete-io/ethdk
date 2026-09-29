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

Before any stand-in opens, gather the sessions of one checkout into pieces. The join criterion is
not decided. The candidates are the directory their commits touched, the branch they sat on, and the
user saying so by hand. A wrong join is cheap to undo through `standIn.split`; a wrong cut leaves a
list nobody answers.

The stand-in list also needs the reverse of `standIn.split`: a join the user can ask for when the
automatic one cut too finely.

## Slice 5: open one stand-in per piece

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

Tom decided (2026-09-29): two agent sessions on one ticket at the same time are two parallel rows,
each with its own auto description. Example: ET-772 in `ethlete-sdk`, one session builds Timetrack
and one builds the scan-files sub-agents. Tempo gets the wall-clock time once: the shared minutes
are split, and the split follows focus, as `cutUnwatched` already does for unnamed stretches.

- Today `join()` in `rows/merge.ts` merges named rows by issue, so the two sessions become one row.
  Key the join on issue plus piece (slice 4), not issue alone. Needs slice 4 first, or a ticket turns
  into a row per session.
- `ET` is a background project: its rows are cut behind foreground rows (`review/recut.ts`). The
  per-session rows must still lose their stretches to foreground rows the same way.
- Auto description (`review/auto-description.ts`): with one row per session, "settled" can be read
  per session: 30 minutes after that session's last attended activity. This replaces the check on
  the row's end, which passed a 10-minute piece of ET-772 at 11:31 on 2026-09-29 that later grew to
  45 minutes (stored answer asked at 11:31:49, `minutes: 10`). Cause of the short piece not found.
