# One session, one piece

Read out of the running app on 2026-09-22, after Tom reported that one stand-in held work of more
than one ticket. It changes the grain an auto stand-in is opened at, which
[`ticket-the-day.md`](./ticket-the-day.md) set to the branch.

## What the day really looked like

Two checkouts, two stand-ins, and both of them wrong:

| Band        | Checkout          | Stand-in                    |
| ----------- | ----------------- | --------------------------- |
| 10:15-12:30 | `fut-frontend`    | Totw 16 9 special layout    |
| 11:30-12:30 | `fifagg-frontend` | Competition journey overlay |

The agent sessions underneath them are the pieces of work, and they overlap:

| Session    | Checkout          | Branch                                         | Ran         | Directory               |
| ---------- | ----------------- | ---------------------------------------------- | ----------- | ----------------------- |
| `257b3d53` | `fut-frontend`    | `fix/totw-16-9-special-layout`                 | 10:17-11:32 | `.../social`            |
| `f4eee250` | `fut-frontend`    | `fix/totw-16-9-special-layout`                 | 11:18-11:40 | `apps/hub/src/app`      |
| `a8251c7d` | `fut-frontend`    | `fix/totw-16-9-special-layout`                 | 11:33-12:12 | `.../graphics-renderer` |
| `578af125` | `fifagg-frontend` | `feature/20260911_competition-journey-overlay` | 11:35-11:57 |                         |
| `e9e4ac84` | `fifagg-frontend` | `dev-tappp-finals`, then `next`                | 11:58-12:12 |                         |

`257b3d53` and `f4eee250` ran at the same time for fourteen minutes, on one branch, in two parts of
the checkout that share no ticket. The merge request of that branch was accepted at 10:28, and the
work after it is a second piece by any reading.

## Why the app could not see it

Three facts, each true and each too coarse:

1. `streamDay` is one sequence. Every instant of the day belongs to one context, so two sessions in
   one checkout collapse into one stretch and the second one is invisible.
2. `ActivityContext` holds `repoPath`, `branch` and `workPath`, and no session. `contextKey` cannot
   tell two sessions apart, so nothing downstream can either.
3. `groupByWork` in `auto-stand-in.ts` keys on `repoPath@branch#workPath`. A `workPath` is only read
   when the checkout's commits spread over several declared project roots, which neither checkout's
   commits did on this day.

## What Tom decided, on 2026-09-22

- **The agent session is the grain.** A session in a checkout is one piece of work, whatever branch
  it sits on. Neither the branch switch nor the accepted merge request becomes a cut of its own.
- **A lane draws parallel bands side by side.** Two sessions that overlap in time are drawn
  overlapping, rather than the day picking one of them.
- **Two sessions can be one piece.** The session is the finest grain, not the answer. `257b3d53` and
  `a8251c7d` both worked on the totw layout in the same directory, one after the other, and they
  belong on one ticket. So the grain cuts and something else joins - the day must not turn into a
  stand-in per session.

## Slices

1. **Carry the session.** Add the session to `ActivityContext` and to `contextKey`, from the
   `agent-session` events the collector already writes. Nothing else changes yet: a day with one
   session per checkout cuts exactly as it does today, which is the regression test.
2. **Cut the day into parallel stretches.** `streamDay` stops being one sequence per day and becomes
   one per session, joined by the checkout they run in. This is the large one. Open: what a lane's
   own stretch is when the sessions in it overlap, and what the day's own presence line means then.
3. **Book it once.** Two bands that overlap must not book twice. Decide where the minutes go before
   the timeline draws them, because `proposedMs` is read off the rows.
4. **Join the sessions that are one piece.** Before any stand-in opens, sessions of one checkout are
   gathered into pieces. What joins them is not decided yet - the candidates are the directory their
   commits touched, the branch they sat on, and the user saying so by hand. A wrong join is cheap to
   undo through `standIn.split`; a wrong cut leaves a list nobody answers.
5. **Open one stand-in per piece.** `groupByWork` keys on the piece, and `alreadyWaiting` and
   `alreadyAnswered` follow it. A rule stored against `repo@branch` still has to match, or every
   answer the user already gave is lost.
6. **Draw them side by side.** `lanes.ts` and `day-timeline.component.ts` lay out a lane that holds
   more than one band at an instant.

## Open questions

- A session that is not an agent session - the user's own editor and terminal - has no session id.
  It is a piece of work too, and slice 1 has to say what it is grouped as.
- Tom works through Claude remote, where a prompt leaves no local presence. A remote session's band
  is a band of work with nothing underneath it.
- `standIn.split` exists for the opposite problem. Once sessions are joined into pieces, the list
  needs the reverse too: a join the user can ask for when the automatic one cut too finely.
