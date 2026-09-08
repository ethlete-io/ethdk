# The v2 slices, and where v2 lives

Agreed with Tom on 2026-09-08. Read
[`time-and-token-spend.md`](./time-and-token-spend.md) first: it holds the model this plan
delivers in slices. `plans/timetrack.md` stays the reference for the app as a whole.

## The problem this plan answers

The prototype collects well and reports badly. The pipeline is not trusted, the day review shows
too much at once, and three of its buttons look broken. So the next step is not more features. It
is one thin path from a collected event to a number the user believes.

## Where v2 lives: a new module and a new route, in the same app

**Decided.** No second app and no second library.

I measured what a fork would cost, on 2026-09-08:

| Part                                        |                  Lines | State                                                    |
| ------------------------------------------- | ---------------------: | -------------------------------------------------------- |
| Rust host, `src-tauri/src`                  |                  6 746 | Proven. Idle, keychain, PAM lock, tray, widget, SQLite.  |
| Providers: jira, tempo, gitlab, google, git | ~4 400 src, 5 100 spec | Verified against the real APIs.                          |
| Host ports and collectors, TypeScript       |                  1 795 | Proven. Holds the idle rule and the `repoRoots` folding. |
| `correlate`                                 |  2 337 src, 2 939 spec | **The part in doubt.**                                   |
| `review` and the UI                         |          979 and 9 671 | **The part that confuses.**                              |

A parallel app duplicates about 13 000 lines of proven code to rewrite about 3 300 lines of
doubtful code. It also forks the one thing that must not be forked: the keychain entries and the
SQLite database. Two apps that open and migrate one store is a hazard, and a store of v2's own
means every credential and every collected day starts again.

This repository already ran that experiment. `cdk` against `components` is the same shape, and
`AGENTS.md` now warns that near-identical paths in two libraries cost every later session.

### The shape instead

| What                              | Where                                | Note                                 |
| --------------------------------- | ------------------------------------ | ------------------------------------ |
| The v2 pipeline                   | `libs/timetrack/src/lib/stream/`     | Beside `correlate`, never inside it. |
| The v2 screen                     | `apps/timetrack/src/app/today/`      | Beside `day-review/`, its own route. |
| The old day review                | `apps/timetrack/src/app/day-review/` | Untouched. It keeps working.         |
| Collectors, host, providers, Rust | unchanged                            | Shared by both. Nothing is copied.   |

Two facts make this cheap, and both are checked:

- **`readDay$` already isolates the pipeline.** `apps/timetrack/src/app/read-day.ts` reads
  `events` from the store and hands them to `correlateDay`. A v2 screen calls a second pure
  function over the same array. No host change.
- **A new event kind needs no migration.** `collected_event` in `src-tauri/src/db.rs` is
  `at_ms, source, kind, payload` with `payload` as text. An `agent-usage` row fits as it stands.

### The deletion trigger, written down now

When slice 3 syncs a named stream to Tempo, `day-review/` and its three silent buttons are
deleted in the same change. Without a named trigger the app keeps both screens forever, which is
the outcome this shape exists to avoid.

## The three buttons are silent, not dead

Checked in the source:

| Button                              | Wired to                                   | Why it looks broken                                                    |
| ----------------------------------- | ------------------------------------------ | ---------------------------------------------------------------------- |
| `Re-correlate`                      | `store.recorrelate()`, `day-review.ts:547` | The same events give the same day. Nothing on screen says "unchanged". |
| `Ask for suggestions` / `Ask again` | The agent-CLI reasoning provider           | It runs, it is slow, and an empty answer looks like a dead button.     |
| `Ask me again`                      | The same, for one context                  | The same reason.                                                       |

None of the three is carried into a slice. Two rules follow from them, and both apply to every
new screen:

1. **Every action states its outcome, including "nothing changed".**
2. **An action that takes longer than an instant shows that it runs.**

## The slices

Each slice is shippable and each has its own exit test. Nothing from a later slice may leak into
an earlier one.

| Slice | Name              | Exit test                                                              |
| ----: | ----------------- | ---------------------------------------------------------------------- |
|     1 | Today, honestly   | Three replayed real days read as true, with no edit.                   |
|     2 | Name it           | Every stream of a real day carries the right issue, or says it cannot. |
|     3 | Book it           | One day reaches Tempo, twice, and the second sync writes nothing new.  |
|     4 | The rest of a day | Meetings, timers and pauses appear as themselves, not as gaps.         |
|     5 | The price table   | A real day shows a cost the user recognises.                           |
|     6 | The week          | Cost and time per issue and per project, over a week.                  |

## Slice 1: Today, honestly

Read-only. One screen. It answers one question: **what did I work on today, for how long, and
what did it cost?**

### What it reads

The store as it stands, through `eventsBetween$` for the local day:

| Source          | Kind                                  | Use                                  |
| --------------- | ------------------------------------- | ------------------------------------ |
| `window`        | `window-focus`                        | Presence, and the exclusive stream   |
| `idle`          | `idle-*`, `lock`, `unlock`, `pause-*` | The presence gate                    |
| `git`           | `git-checkout`, `git-commit`          | The branch, and description material |
| `agent-session` | `agent-session`                       | The concurrent streams               |
| `agent-usage`   | `agent-usage`                         | **New in this slice.** The spend.    |

`calendar`, `gitlab`, `editor` and `ingest` events are ignored by slice 1. They stay in the store
and the old screen keeps using them.

### What it computes

`streamDay()` in `libs/timetrack/src/lib/stream/`, one pure function, no network and no clock:

1. Gate on presence. The rule is copied from `sessionize`, unchanged. A meeting away from the
   machine therefore books nothing, even with five agents running. Slice 4 gives meetings their
   own treatment; slice 1 gains no rule for them.
2. Open, extend and close one block sequence **per stream key**.
3. Sum `agent-usage` onto the stream whose instant contains it.
4. Report `presenceMs`, `engagedMs`, `concurrency` and the per-stream totals. `engagedMs` sums
   **every** stream, the Other applications line included, so `concurrency` always equals
   `engagedMs / presenceMs`. One definition is worth more than a truer-sounding ratio.

**How an exclusive focus sample picks its stream.** Copied from `sessionize` and not changed: the
window title names a repository, else the one global sticky checkout inside `repoStickinessMs`,
else the Other applications line. One window has focus, so one stream gets it.

**Known weak, and deliberately not fixed in slice 1.** `repoStickinessMs` is 5 minutes, and a
window title of `localhost:4200 — Mozilla Firefox` names no repository. So 30 minutes of browser
testing gives 5 minutes to the checkout and 25 to Other applications. Two fixes were considered and
both were held back: raise the stickiness, or let a running agent session hold the checkout sticky.
Each attaches unfocused time to a checkout on a guess, and slice 1's claim is that exactly one
thing can be wrong with a line. Let the exit test show it on a real day, then choose. The running
agent is the likelier answer, because it is evidence and a timer is not.

**A stream nobody ever focused** still books its time — the locked decision says it must — and its
line carries `agent only, never focused` as evidence. That label is what makes the exit test's
"can you explain every line" answerable for it. This resolves open question 2 of
[`time-and-token-spend.md`](./time-and-token-spend.md).

**Five consoles in one checkout are one stream.** Blocks are intervals, so five overlapping agent
sessions extend one block rather than sum to five; only the spend sums. The line reads
`ethlete-sdk · 5 agent sessions` with the sessions as evidence. If a real day shows one checkout
holding two clearly different tickets, slice 2 needs a way to split a stream. The exit test is what
will surface that.

No attribution, no rules, no donation, no gap fill, no rounding, no merge, no reasoning provider.
Those are five later steps of the old pipeline, and every one of them is a reason to distrust a
number. Slice 1 has none of them, which is the point: if a row is wrong, exactly one thing can be
wrong with it.

### What it shows

One list, ordered by time. One line per stream. A line here is never called a row: a row is a line
that can be booked, and none of these can. See
[`libs/timetrack/CONTEXT.md`](../../libs/timetrack/CONTEXT.md).

A stream is keyed by the checkout, so a day that switched branch three times is one line and not
three. ADR 0001 says why. The branch is shown on the line, and it stays evidence.

```
09:12 – 17:40   ethlete-sdk         2 h 28 m engaged   1.2 M out · 604 M cached   [3 commits, 2 agent sessions]
09:30 – 10:05   fut-frontend          35 m engaged     0.3 M out ·  88 M cached   [1 agent session]
11:05 – 16:20   Other applications   1 h 04 m engaged                             [Slack, Firefox, Spotify]
```

Two numbers per line, and they may differ. The span reads the first block's start to the last
block's end. The engaged time reads the sum of the blocks. A stream with a gap in it says so by
letting the two disagree.

An application with no checkout is not hidden, and it gets no line of its own. Every one of them
folds into a single **Other applications** line, with the applications named under it as evidence.
Without that line presence does not reconcile with the list, and reconciliation is the one thing
slice 1 must deliver.

Above the list, three numbers and nothing else: presence, engaged time, and the ratio between them.
Below each line, its evidence, verbatim, exactly as the old timeline shows it.

### What it must not do

- No write of any kind. No Tempo, no Jira, no ticket, no rule, no edit.
- No rounding. A stream that ran 2 h 28 m says 2 h 28 m.
- No hidden row. A stream the pipeline cannot name is still a row, with no name.
- No cost, until the price table exists in slice 5. Slice 1 shows token counts.

### Exit test

Replay 2026-08-12, 2026-08-17 and 2026-08-18. All three are measured in
[`time-and-token-spend.md`](./time-and-token-spend.md) and all three are real multi-stream days.
It is a judgment by the user, and it is a written one. For each of the three days it runs in this
order:

1. Before the screen is opened, the user writes down what they remember working on that day.
2. The screen is opened.
3. The day passes only if every item on that list appears as a stream, **and** every stream on the
   screen is one the user can explain.

Step 3's second half is what catches an inflated day. Recognition alone never does: a screen that
is 80 % right still reads as familiar. One unexplainable stream fails the day.

The test needs the spend backfill of ADR 0003 to have run, or all three days show zero spend.

A failure is fixed in a collector or in `streamDay`, never by an edit in the UI.

## No git flow. Chaos is the case to build for

**Decided with Tom on 2026-09-08.** Tom's words: "we also want to just straight out cancel support
for git flow for now. just pure chaos style development aka the hardest case for the software.
adding git flow later on should be a breeze".

So no slice may rely on a branch naming convention. No `feat/ABC-3010-…` grammar, no branch per
issue, no merge request per branch, and no assumption that a repository even has more than one
branch. A day of work on `main` with three unrelated commits and no ticket in sight is the normal
case, not the degenerate one.

What that removes from the plan:

| Was going to be                          | Now                                                |
| ---------------------------------------- | -------------------------------------------------- |
| The branch grammar as attribution rung 1 | Gone. Attribution starts at the per-repo rule.     |
| Branch repair                            | Out of scope. It only exists to fix a grammar.     |
| Start a piece of work, with a branch     | Out of scope. It only exists to write a grammar.   |
| A branch name as description material    | The commit subject and the working directory stay. |

What it does **not** remove: `git-checkout` and `git-commit` events keep being collected, and the
branch is still recorded. It is evidence a person can read, and the rung that reads it can be added
later. That is what "adding git flow later should be a breeze" means in code — a new rung on a
ladder that already exists, above rules that never assumed one.

Building for chaos first is also the cheaper order. A pipeline that works with no naming signal at
all works with one too; the reverse has never been true.

## Slice 2: Name it, in outline

Attribution comes back, one rung at a time and in this order: a per-repo rule, then naming by hand.
Nothing else, and no branch grammar — see the section above. The reasoning provider stays out until
a real day proves that a rung is missing rather than broken.

## Slice 3: Book it, in outline

Tempo sync for accepted rows only, one day at a time, through the existing `tempo/` module. The
second sync of an unchanged day must write nothing — the idempotence the current code already
has. This slice carries the over-capacity warning from `time-and-token-spend.md`, and it is the
slice that deletes `day-review/`.

## Rules that carry over untouched

These were each found the hard way, and each cost a real day. They move into `stream/` as they
are, with their specs:

1. **An agent session is not presence.** From an `idle-start` or a `lock` until real input, no
   block opens or extends. This one cost 7 hours on 2026-08-10.
2. **`maxUnobservedMs` is a safety valve, not an idle rule.** Every collector is edge-triggered,
   so ten quiet minutes inside one context are ordinary work.
3. **A flap joins only a block it touches.** A lone sample hours later is dropped.
4. **`repoRoots` folds a working directory into its checkout.** This turned 48 blocks into 21 on
   2026-08-12, and it has to run over usage as well.
5. **A repository name two checkouts share is dropped, not resolved.**
6. **A private project link answers before every other rung.**

## What this plan does not decide

- The old `correlate` module's fate after slice 3. It keeps the week view and the tray alive until
  slice 6 replaces them. Delete it then, not before.
- Whether `stream/` eventually absorbs `correlate` or replaces it wholesale. Answer it with a real
  day in hand, at slice 4.
