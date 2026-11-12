---
name: timetrack
description: How to reach Jira from any repo through the running Timetrack app - look up an issue, search for one, ask which project a repo logs into, file a ticket, add a worklog row, read the user's own Tempo worklogs, read their Google Calendar, read the evidence a day holds, or list the work that still waits for a ticket. Read whenever a task needs Jira data, a Jira write, or the day's own events, and never put a Jira token in a repo.
kind: skill
scope: both
---

# Reaching Jira through Timetrack

**No repository holds a Jira token.** The Timetrack desktop app holds one set of credentials
in this machine's keychain, and every repository asks it:

```bash
{%packageRunner%} ethlete-agents timetrack status                 # is the app reachable, and what does it hold?
{%packageRunner%} ethlete-agents timetrack issue FIP-2177         # one issue: summary, type, parent, subject
{%packageRunner%} ethlete-agents timetrack search "password"      # open issues of the picked projects
{%packageRunner%} ethlete-agents timetrack project                # which project does this repo log into?
{%packageRunner%} ethlete-agents timetrack instance               # the instance's own levels and custom fields
{%packageRunner%} ethlete-agents timetrack standins               # work the user named that Jira does not hold yet
```

Add `--json` to any of them when you need to read a field rather than a line.

**Every write waits for the user's approval in the app.** `create`, `log`, `edit`, `standins
--remove | --rename | --merge | --resolve | --split --force`, `sync --write`, `worklog --delete` and `resync` answer at
once with an approval id and write nothing yet. The user approves or rejects the request in
Timetrack; `approval <id>` reads the outcome:

```bash
{%packageRunner%} ethlete-agents timetrack approval <id>          # queued, approved (with the result), rejected or expired
{%packageRunner%} ethlete-agents timetrack approvals              # every write that waits now: id, asker, op, asked at, what it writes
{%packageRunner%} ethlete-agents timetrack approval <id> --reject # reject one that waits, as the app's Reject button does
```

A reject answers at once and writes nothing to Jira or Tempo; an item that no longer waits is
refused and stays as it is. Reject only what the user asked you to, or a write you queued by
mistake. **There is no approve command and never will be: only the user approves, in the app.**

`ask` does what the app's "Ask auto mode again" does, on any day, without moving the day on
screen. It answers at once with what it queued; the model runs on the user's machine, and its new
answer replaces the stored one. It writes nothing to Jira or Tempo itself: a ticket or a name the
answer proposes waits for the user's approval as auto mode's own does.

```bash
{%packageRunner%} ethlete-agents timetrack ask --stand-in <id> [--day YYYY-MM-DD]       # an open stand-in, ids from `standins`
{%packageRunner%} ethlete-agents timetrack ask --context <context-id> [--day YYYY-MM-DD] # an unnamed band, ids from `rows`
```

A subject the app does not offer the press on is refused: an unknown or resolved stand-in, one
the day holds no time of, a context a rule names or the user named by hand.

Tell the user a request waits, then read `approval` once they say they decided - do not poll.
A request still waiting at the end of its day expires; ask again. Set `TIMETRACK_CLIENT` to name yourself in the
queue (Claude Code is named without it).

**Never ask the user for a Jira token, and never write one into a file.** If a command reports
that the app is not running, say so and ask the user to start it. That is the whole fix -
there is no per-repo fallback, by design: a secret copied into every checkout is a secret
nobody can rotate.

## What each command is for

| Command                                    | Use it when                                                                  |
| ------------------------------------------ | ---------------------------------------------------------------------------- |
| `status`                                   | Before anything else, when a Jira command failed and you need the cause      |
| `instance`                                 | A setup step needs the instance's levels or its branch-subject field         |
| `issue <KEY>`                              | The user names a key and you need its summary, type or parent                |
| `search [text]`                            | The user describes work but names no key                                     |
| `project [path]`                           | You need the project a repository files into                                 |
| `create --summary "…"`                     | The work has no ticket and the user asked for one                            |
| `log --issue <KEY> --minutes <n>`          | The user asks to record time that nothing observed                           |
| `day [YYYY-MM-DD]`                         | You need the evidence a day holds, not a screenshot of it                    |
| `rows [YYYY-MM-DD]`                        | You need the rows the day drew, and the ids an edit names them by            |
| `edit <row-id> …`                          | The user asks you to correct one row of a day                                |
| `rules`                                    | You need to know why a band was named, or why it was not                     |
| `standins`                                 | You need to know which work still waits for a ticket, and for how long       |
| `standins --remove <id>`                   | A placeholder is wrong or too wide, and the user asked you to delete it      |
| `standins --rename <id> --name <text>`     | The name a placeholder carries is wrong, and the user asked you to fix it    |
| `standins --merge <id> --into <id>`        | Two placeholders are one piece of work, and the user asked you to join them  |
| `standins --resolve <id> --issue <KEY>`    | The user named the issue a placeholder is, or the one a resolved one is now  |
| `naming [YYYY-MM-DD]`                      | A checkout was never offered a name and you need the step that stopped       |
| `transcript [YYYY-MM-DD]`                  | You need what the user said in the day's calls (their microphone)            |
| `resync [path…] [--replace]`               | Checkouts got a project link and their agent session logs must be read again |
| `worklogs [from] [to]`                     | You need what the user already booked in Tempo over a span of days           |
| `calendar [from] [to]`                     | You need the user's meetings and calendar entries over a span of days        |
| `sync <YYYY-MM-DD>`                        | The user asks what a Tempo sync of a day would write, or asks to sync it     |
| `worklog --delete <id> --day <YYYY-MM-DD>` | The user asked you to delete one of their own Tempo worklogs                 |
| `approval <id>`                            | A write you queued: whether the user approved it, and what it answered       |
| `approvals`                                | You need what waits in the queue, from every caller                          |
| `approval <id> --reject`                   | The user asked you to drop a waiting write, or you queued one by mistake     |
| `ask --stand-in <id>` / `--context <id>`   | The user asks auto mode to look at a stand-in or an unnamed band again       |

`naming` reports whether a Tempo token is stored, how far the worklog history got, and per checkout the
offer or the reason there is none (`already-named`, `no-project-link`, `no-history`,
`project-too-small`, `too-few-days`, `share-too-low`); read a `history` of `failed` or `no-token` first.
`rules` reads the settings that name a day's work - attribution rules, project links, background
projects, ruled applications - and holds no host, account or token, so it is safe to quote. A
rule that donates its time carries no issue key, and a `backgroundProjects` project keeps only the
minutes no other band claims. `resync` queues a re-read, `--replace` overwrites what the store holds
(after a parser fix).

`git-flow start` uses the same channel, so a branch is named from the real issue rather than
from a key you typed. Follow the repository's branch workflow when creating a branch.

## Reading a day

The app's store is encrypted, so no shell reads a day off disk. `day` is the only way in:

```bash
{%packageRunner%} ethlete-agents timetrack day                       # today: how many events, and of which kind
{%packageRunner%} ethlete-agents timetrack day 2026-09-10 --out /tmp/day.json
```

A real day holds thousands of events, so **never print them**. Write them to a file with
`--out`, then read that file from a test or a script. Without `--out` the command reports
only the counts, which is what tells you whether a day holds the source you are looking for.

`--out` writes a new file, readable by its owner alone. A destination that already exists is
refused until you pass `--overwrite`, and a symlink is never written through. The file holds the
day as it was observed - window titles, paths and messages - so delete it when you are done.

`transcript` prints what the app transcribed of the user's own microphone during the day's calls,
one 30-second chunk per line. It exists only where the user turned call transcription on, and the
app deletes a chunk after seven days. Read it only when the task needs what was said.

```bash
npx ethlete-agents timetrack transcript [YYYY-MM-DD]
```

## Reading and correcting the rows a day drew

`day` answers what the collectors saw. `rows` answers what the app made of it - the bands on the
timeline, with the id every edit names a row by, the day's totals and its warnings.

```bash
{%packageRunner%} ethlete-agents timetrack rows                      # today
{%packageRunner%} ethlete-agents timetrack rows 2026-09-10 --json
```

`edit` changes one row. Pass exactly one change per call:

```bash
{%packageRunner%} ethlete-agents timetrack edit 'ABC-1@2026-09-10T11:00:00.000Z' --day 2026-09-10 \
  --from 2026-09-10T13:15:00Z --to 2026-09-10T17:00:00Z
{%packageRunner%} ethlete-agents timetrack edit '<row-id>' --issue ABC-2
{%packageRunner%} ethlete-agents timetrack edit '<row-id>' --state rejected
```

`rows` moves the app's own review to that day, so the user sees what you read. An edit is queued
like every write; once approved, its result's `applied` says how many edits found their row. A
running day is re-cut on every collector tick, so read `rows` again rather than reusing an id from
minutes ago.

An edit may correct a row's times, its name, its note and whether it syncs. It may not split, merge
or delete one - restructuring a day is the user's own decision, made on the screen.

## Work with no ticket yet

A **stand-in** is a name the user gave work that Jira does not hold yet. It takes bands across
days and checkouts and books nothing. `standins` lists the open ones, oldest first (`--json`
adds the resolved ones).

**Never open or resolve a stand-in without the user asking.** The name is the user's own word for
their work, and the app is the only place they give it. If the user asks for a ticket, use
`create` and tell them to resolve the stand-in in Timetrack.

```bash
{%packageRunner%} ethlete-agents timetrack standins --rename <id> --name '<text>'    # only the name is wrong
{%packageRunner%} ethlete-agents timetrack standins --resolve <id> --issue <KEY>     # the user named the issue
{%packageRunner%} ethlete-agents timetrack standins --merge <id> --into <id>         # two are one piece of work
{%packageRunner%} ethlete-agents timetrack standins --split <id>                     # plan only; add --force to queue
{%packageRunner%} ethlete-agents timetrack standins --remove <id>
```

- `--resolve` moves every band on every day the placeholder held to the key, and writes nothing to
  Tempo, so a day already booked keeps the old key there. An unknown key or placeholder errors
  and nothing waits.
- `--split` re-cuts a record that covers a whole checkout into one record per directory, from the
  commits the checkout's own `user.email` authored (`--author <email>` overrides). Without
  `--force` it prints the plan; `--paths <dir>,<dir>` picks the pieces, `--claim <dir>` gives
  the days without a commit to one directory. The record must name the checkout it was opened for.
- **`--remove` strands every day but today** as unnamed. It refuses such a delete and lists the
  days; ask the user before you pass `--force`, and tell them which days they lose.

## What Tempo already holds

`worklogs` reads the user's own Tempo worklogs straight from Tempo, whoever wrote them. It is
read-only, and the app keeps the Tempo token:

```bash
{%packageRunner%} ethlete-agents timetrack worklogs                          # the last 7 days
{%packageRunner%} ethlete-agents timetrack worklogs 2026-09-01 2026-09-24    # both days included
{%packageRunner%} ethlete-agents timetrack worklogs 2026-09-01 2026-09-24 --json
```

Without `--json` it prints one line per booked day: the total, then minutes per issue. `--json`
answers each worklog with its day, `startTime` as `HH:MM`, `durationMs`, `issueKey` and
description. A span is at most 92 days. The descriptions are the user's own words, so quote them
only when the task needs them.

## What the calendar holds

`calendar` reads the Google calendars the app watches, straight from Google and read-only. The app
keeps the Google token:

```bash
{%packageRunner%} ethlete-agents timetrack calendar                          # the last 7 days
{%packageRunner%} ethlete-agents timetrack calendar 2026-09-01 2026-09-24    # both days included
{%packageRunner%} ethlete-agents timetrack calendar 2026-09-01 2026-09-24 --json
```

Without `--json` it prints each day with its meeting hours, then one line per entry: start, minutes,
title, and the user's answer where it is not a yes. All-day and declined entries are listed but not
counted. `--json` answers each entry with `calendarId`, `day`, `startMs`, `endMs`, `allDay`, `title`,
`attendeeCount` and `response`. A span is at most 92 days. Titles come from whoever sent the
invitation, so quote them only when the task needs them.

## Syncing a day to Tempo

`sync` plans a day exactly as the app's Sync page does, and writes nothing:

```bash
{%packageRunner%} ethlete-agents timetrack sync 2026-09-07
{%packageRunner%} ethlete-agents timetrack sync 2026-09-07 --json
```

It prints every create, update and delete with its issue, local time, minutes, description and
reason; the rows it holds back (Tempo refuses an empty description); how many are unchanged or still
awaiting review; keys Jira does not know; and the foreign worklogs it never touches. The first line
carries a short **plan hash** over the write set.

Writing is a Tempo write, so it follows one rule without exception: **show the user the rows, and
write only after they confirmed those rows in this conversation.** Then pass the hash the read
printed:

```bash
{%packageRunner%} ethlete-agents timetrack sync 2026-09-07 --write --plan 1a2b3c4d
```

"Approve all" never includes it. On approval the app plans the day again and refuses when the hash differs -
the day changed since the user saw it, so read it again and ask again. `--write` without `--plan`
is refused at once. Once approved, `approval <id>` prints each row as `written`, `blocked`,
`skipped` or `failed`, with the worklog id or the error, and exits non-zero while a row did not
land. Never re-run the write to retry: a plan read
straight after a write can miss what Tempo just took and log it twice. The Sync page shows the run
and retries from its own plan. A "written, but not recorded" line means Tempo holds worklogs the
app no longer owns; tell the user to delete them in Tempo before this day is written again.

Both reads and writes move the app's Day screen to that day, as `rows` and `edit` do.

## Deleting a Tempo worklog

`worklog --delete` deletes one of the user's own Tempo worklogs. Both flags are required; read the
id and its day off `worklogs --json`:

```bash
{%packageRunner%} ethlete-agents timetrack worklog --delete 98765 --day 2026-09-07
```

**Name the worklog to the user, and delete only after they confirmed that one in this conversation.**
The app refuses an id that is not among the account's own worklogs on that day. Once approved,
`approval <id>` answers what went, and the next `sync` of the day plans from what Tempo holds.

## Writes

Writes to Jira or Tempo need the user to have asked for them in this conversation (`sync --write` and
`worklog --delete` are above):

```bash
{%packageRunner%} ethlete-agents timetrack create --summary "Reset password mail is not sent" --project FIP
{%packageRunner%} ethlete-agents timetrack log --issue FIP-2177 --minutes 45 --description "pairing call"
```

- **`create`** files the issue, once approved, with the instance's own ticket settings - its type, its parent
  rule and its subject field all come from the app, so the ticket is shaped like every other.
  `--project` is needed unless the app holds exactly one picked project.
- **`log`** adds a row to the day in Timetrack. It is **not** a Tempo entry: the user reviews
  the day and syncs it, which is what keeps an agent's row from double-booking against the
  hours the day already observed. `--at` places it - an ISO instant, or a local `YYYY-MM-DD` or `HH:MM` (today); without one it starts now.

## What the app decides, not you

- **The projects.** The user picked them in Timetrack. `search` is scoped to them, and
  `--project <KEY>` is how you look outside.
- **The branch subject.** `issue` returns `subject` when the instance's subject field is set on
  that issue. Prefer it over the summary; the summary is a paraphrase.
- **The instance.** Its host, its issue types and its hierarchy are settings in the app. Do not
  hardcode any of them in this repo.
