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
- **An overlap books once, to the watched band.** Where two sessions of one checkout ran at the same
  time, the minutes go to the session the user's own window was on. The other band is drawn for those
  minutes and books nothing. The day's booked time therefore never rises above the time the user was
  present.

## Slices

1. ~~**Carry the session.**~~ Done on 2026-09-22. `ActivityContext.session` and `contextKey` carry
   it, and `sessionAt` in `streamDay` answers it for every stretch of a checkout rather than only for
   the stretches an `agent-session` sample covers - a session and the window watching it are one
   piece, and a key that told them apart would book those minutes twice. The day is still one
   sequence, so an instant two sessions both ran in goes to the oldest of them; that answer only ever
   moves forward, where reading the nearest sample would flap between the two. `lastAgentSample` is
   now keyed per session, so the gap between one session ending and the next starting stopped
   counting as an agent running. The branch and the work path leave the key where a session answers,
   the way a feature branch already keeps its directories from splitting it.
2. ~~**Cut the day into parallel stretches.**~~ Done on 2026-09-22. An agent stretch carries the
   session that ran it rather than the one `sessionAt` hands the checkout, so two sessions of one
   checkout that ran at the same time are two stretches that overlap. A stream holds its windows per
   piece - the key `blocksFromSpans` already cut blocks at - and unions inside a piece where it used
   to union across the checkout. Tom decided on 2026-09-22 that the checkout **books both**, the way
   two checkouts running at once already do, so `engagedMs` sums the pieces and `concurrency` sees a
   second agent inside one lane. `sessionAt` stays for the stretches nothing but the checkout is known
   about: the focused window and the rebuilt marks. Which session the window was really on is slice 3.
3. **Book it once.** Two bands that overlap must not book twice. The minutes go to the session the
   user's own window was on, decided before the timeline draws them, because `proposedMs` is read off
   the rows.
4. **Join the sessions that are one piece.** Before any stand-in opens, sessions of one checkout are
   gathered into pieces. What joins them is not decided yet - the candidates are the directory their
   commits touched, the branch they sat on, and the user saying so by hand. A wrong join is cheap to
   undo through `standIn.split`; a wrong cut leaves a list nobody answers.
5. **Open one stand-in per piece.** `groupByWork` keys on the piece, and `alreadyWaiting` and
   `alreadyAnswered` follow it. A rule stored against `repo@branch` still has to match, or every
   answer the user already gave is lost.

   The day screen shows nothing of slice 1 until this lands. `trackOf` in `rows/merge.ts:183` does key
   on `contextKey`, so four sessions are four tracks - but when a track has no open row `openFor`
   (`merge.ts:264-277`) falls back to `lastOfStream`, keyed by `streamKey`, which carries neither the
   branch nor the session. Any unnamed row of the checkout therefore absorbs every session's blocks,
   and `absorbSlivers` does the same for the short ones. That fallback is what slice 5 has to replace
   with the piece - and not before slice 4, or a checkout turns into a row per session, which is the
   grain Tom ruled out.

6. **Draw them side by side.** `lanes.ts` and `day-timeline.component.ts` lay out a lane that holds
   more than one band at an instant.

## Open questions

- **Answered by slice 1.** A session that is not an agent session - the user's own editor and
  terminal - has no session id, so it carries none and keys exactly as it did before: the checkout
  and the branch. A checkout that ran no agent all day is untouched.
- **Answered by slice 1.** The branch leaves the key where a session answers, so a session that
  switched branch twice is one stretch rather than three overlapping ones. A merged block is then
  named after the branch that held the most of its time, because a key no longer fixes the branch
  behind it - see `longestContext` in `blocks.ts`. On the real day of 2026-09-22 this took the whole
  day's overlapping block time from 2.9 minutes down to 1.0, below what it was before sessions were
  carried at all.
- Tom works through Claude remote, where a prompt leaves no local presence. A remote session's band
  is a band of work with nothing underneath it.
- `standIn.split` exists for the opposite problem. Once sessions are joined into pieces, the list
  needs the reverse too: a join the user can ask for when the automatic one cut too finely.
