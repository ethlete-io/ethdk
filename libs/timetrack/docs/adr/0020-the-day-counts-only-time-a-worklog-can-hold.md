# The day counts only time a worklog can hold

Tom, on 2026-09-14, on the same day screen: "the 2h 57m unattributed is confusing since it lists non
tracked work", "some time matched no issue also seems to include non tracked work", and "day short of
target? of cause it is. just had my break. we shouldnt scream that to the user during his active work
time."

Two readouts were answering questions the reviewer could not act on. Both are now narrowed.

## Unattributed time is bookable time

`checkDay` counted every band nothing named, including bands that were nothing but an application —
a browser, a chat window, an hour of reading. No worklog can hold that time, so counting it asks the
reviewer to name work that has no issue to name it with.

A band counts only if it is a checkout's work or a call. The lane decides it, and not the blocks
under it, so the footer, the `unattributed-time` warning and the bands on screen all read the same
day. Application time is still drawn, in its own lane, because the machine really was busy and hiding
that would be a different kind of lie.

`unattendedMs` is narrowed the same way, for one rule rather than two.

## Under target is a warning for a finished day

A day still being worked is under its target by definition. Warning about it during the day tells the
reviewer that lunch was a mistake.

`checkDay` takes `finished`, and raises `under-target` only when the day can no longer grow. The day
screen passes `!isToday`. `over-target` is raised either way: more work cannot fix it, and it is the
one a reviewer wants to see early.

`deltaMs` is untouched. The number stays on screen through the whole day; only the warning waits.

## Consequences

- A day of nothing but application time raises no warning at all, and its footer reads `0m`
  unattributed. That is correct: there is nothing there to book.
- The `too-many-rows` cap still counts every drawn row, bookable or not, because that warning is about
  what a reviewer has to read rather than about what a sync will write.
- A caller that does not pass `finished` keeps the old behaviour and warns. The option is the day
  screen's to set, because only the screen knows which day it shows.
