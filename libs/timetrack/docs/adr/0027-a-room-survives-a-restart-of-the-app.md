# A room survives a restart of the app

Tom, on 2026-09-15, on a Discord room torn into fragments by the app restarting under it: "though it
should survive an app restart. otherwise that logic aint solid."

The call source watches the microphone from inside the app's own process. A run that ends while the
microphone is held writes no end for it, so `closeAbandonedCalls` writes one at the last instant the
app can be shown to have been running. The next run then sees the microphone held, has no memory of
having seen it before, and opens a second call.

Measured that morning, a room that was open from 11:04 to past 11:38 was stored as four calls: 1
second, 7 milliseconds, 4 minutes 13 seconds, and the one still running. `glueCalls` joined none of
them, because its 2 minute allowance is sized for a Google Meet device check. `matchCalls` then drew
none of them, because each fell under `MIN_PROPOSED_CALL_MS`. A room the app watched for half an hour
left nothing at all on the screen.

## The repair says which kind of end it wrote

A `call-end` now carries `stoppedWatching` when the repair wrote it. The flag separates the two things
an end can mean: the microphone closed, or the app stopped looking. Only the app can tell them apart,
and only at the moment it writes the end — by the time a day is read, both are the same edge.

Before this, the only way to recognise a repaired end was that its instant exactly equalled a
`window-focus` instant, because both came from `lastHostSampleAt`. That is a coincidence of the
implementation, not a fact about the day, and it cost a session to rediscover.

## The reading joins the room back up

`classifyCalls` gives the break after such an end `DEFAULT_CALL_RESTART_GAP_MS` of 10 minutes instead
of the ordinary 2. The next start of the same application inside it is the room the app was already
in, so one band is drawn across the restart.

This is the one place the app extends a call over time it did not watch, and the bound is what makes
that defensible. The microphone was held on both sides of the gap and nothing else accounts for it,
which holds for a restart, a crash the app came back from and a rebuild during development. It does
not hold for a night: an app closed at six and opened at nine is not evidence that anybody sat in the
room, so ten minutes is where the claim stops.

A genuine `call-end` is never joined this way, whatever the gap. Leaving a room and rejoining it four
minutes later stays two calls, because the microphone really did close and the app really did see it.

## What it does not do

Days already in the store keep their fragments. The flag is written when a repair runs, so only a run
after this change marks its ends, and nothing rewrites the edges of a day that is already recorded.
