# Findings from tidying sixteen days through the agent CLI

Status: recorded on 2026-11-17, not started.

An agent tidied the days 2026-11-02 to 2026-11-17 on the Linux machine through `timetrack` (the
agent CLI) before a presentation: it named unnamed rows, wrote German descriptions and read the
approval queue. Each finding below is something the app or the CLI did that cost time or would have
written a wrong record. "Suspected" marks a cause nobody proved.

## Attribution

1. **Night rows count as attended.** Eight rows between 00:00 and 07:00 on 15.11. to 17.11. (13.5 h,
   one of them 01:00 to 05:30) carried no `unattended` flag, although Tom was away and agents ran.
   This is lessons 4 and 5 of [`booking-lessons.md`](./booking-lessons.md), still open. Which event
   counted as presence is unknown; a peer machine's input or an agent prompt are the suspects.
2. **Accepted night rows inflate a day.** 08.11. holds 20.75 h logged, with accepted ET-772 rows from
   00:00 and 03:45. The `over-target` warning is the only sign.
3. **A row's description can come from another repo's commits.** Five named rows carry commit text
   that does not fit their issue (02.11. 15:00 FIP-3149, 03.11. 12:15 and 16:30 FIFAGG-12759, 05.11.
   16:15 FIFAGG-12759, 16.11. 01:30 FIFAGG-12652): Studio commits under a FIFAGG or FIP issue.
4. **One description is repeated on every row of a lane.** 13.11. has six ET-772 rows with the same
   three commits and "+99 more". A row should describe its own span.
5. **Descriptions are English commit lists.** Tom books in German and wants one sentence for each
   row. The agent rewrote 57 by hand.

## Auto mode

6. **Auto mode drafts a new ticket for each context, not for each piece of work.** On 17.11. it
   queued 13 `jira.create` drafts on Linux, among them five variants of "Ethlete-Übergabe nach dem
   Angular-22-Update fortsetzen". The existing FIFAGG-12069 "Update Angular abschließen" fits all of
   them, and auto mode did pick it for other contexts of the same day.
7. **Both paired machines draft for the same day.** The Mac queued about ten more `jira.create`
   drafts for the same work, because answers and rejections do not sync.
8. **"Approve all" files every draft.** With findings 6 and 7 one press creates some twenty Jira
   tickets, unless the action class of `jira.create` is set to one by one.

## Agent CLI

9. **A waiting write cannot be read.** `timetrack approval <id>` prints the status only, and
   `timetrack approvals` prints no day and no row. An agent cannot tell which row a draft is about.
10. **`ask --context` on a stand-in subject says the context holds no unnamed work.** The rows of
    that day carried `autoModeSubject.kind: "stand-in"`. The error should name the subjects the day
    holds.
11. **`rows <day>` moves the view of the app.** Reading sixteen days flips the user's screen sixteen
    times. A read of a range without that effect is missing.
12. **`rows --json` into a pipe is cut on a large day.** Redirected to a file the same answer is
    whole. Suspected: the process exits before stdout drains.
13. **No answer holds the concurrency of a day.** The app shows "× at once"; `rows` and `day` do
    not. `streamDay` throws in `worked-in.ts` on the events `timetrack day --out` writes, so the
    figure cannot be rebuilt outside the app either.
14. **One edit is one approval.** The tidy-up queued 135 writes. There is no batch, and the CLI
    cannot merge, split or delete a row, so a row that runs from the night into the morning cannot
    be cut at the hour the user came back.

## Sync and upkeep

15. **A day tidied on one machine stays untidy on the other.** Row edits, rules and stand-ins do not
    sync (ADR 0039), so the Mac names nothing of what Linux named. A presentation machine that is
    not the work machine shows the raw day.
16. **Old stand-ins pile up.** Linux holds 110 open stand-ins, many 50 to 63 days old with 0 days of
    work.
17. **Rows of zero duration are listed.** The `zero-duration` warning names them, and they still
    take a line.
