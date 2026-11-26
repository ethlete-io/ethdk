# Process review 2026-11-26

Second round after [the baseline of 2026-11-18](process-baseline-2026-11-18.md). Window 2026-11-18..26 against
2026-11-11..18. Sources: git log, 400 CI runs on `next`, 1786 session transcripts (368 main, 1418 subagent). Scripts
and raw data: `.claude/handoffs/process-review/2026-11-26/` (git-ignored, may be gone).

The human's frame for this round: the usage limit is not the problem, the work tempo is. A night of 8 hours ends
with about 4 rows done and a red CI that takes hours to repair. More pre-commit hooks are no option: they make the
process slower.

## Against the baseline

| Measure                                  | 11.-18.11. | 18.-26.11.                           |
| ---------------------------------------- | ---------- | ------------------------------------ |
| Commits                                  | 1894       | 2521                                 |
| Commits touching product code            | 18%        | 17%                                  |
| Commits touching only plans              | 36%        | 38%                                  |
| Commits that change only QUEUE or STATUS | -          | 650 (26%)                            |
| Cancelled CI runs on `next`              | 109 of 200 | 18 of 231                            |
| Red CI runs on `next` (of finished)      | 46%        | 54% (114 of 213), 26.11.: 6 of 6     |
| Fix on a feat's file within 24 h         | 43%        | 48%                                  |
| Subagent starts                          | 730        | 1418                                 |
| Subagent starts on opus                  | 75%        | 45% of starts, 62% of subagent turns |
| Rows closed                              | 53         | 84 (about 10 a day)                  |

Bundling the pushes worked (cancelled runs are gone). Bundling the bookkeeping did not hold.

## Where the tempo goes

The subagents are not slow. The rows lie idle.

- One subagent job: median 8 min (start to first edit 1 min, edit to commit 5 min).
- Subagent work per row: median 12 min, p90 54 min.
- Queued to closed: median 3 h, p75 21 h (31 rows whose close is readable from git).
- All rows: 1080 h from first to last subagent, 125 h of them with a subagent on the row. About 88% of the time
  nobody works on the row.
- No subagent runs in 45% of the wall time (47% at night). The average is below one running subagent.
- Not the cause: a new builder session starts its first subagent after 1 min; the first code commit follows the
  queueing after a median of 20 min.

### What rows wait on

Sample of 14 rows from 24.-26.11., read from git only (three quoted states checked against their commits). Two rows
(B741, B728) carry 83 of 111 h; the other twelve close in 0-5 h, B751 in 12 h.

| Waited on (gaps over 45 min)            | Hours |
| --------------------------------------- | ----- |
| The human (merge or choice)             | 18.9  |
| Behind another row, or not begun        | 18.4  |
| Not readable (state text unchanged)     | 13.7  |
| Open measurement or live proof          | 8.1   |
| Red or running CI                       | 6.9   |
| Night, waiting for a subagent result    | 5.1   |
| Steps under 45 min (work, small pauses) | 40.3  |

- Waiting for the human is almost always overnight: B728 stood at "Offen nur: Merge durch den Menschen (morgens)"
  from 25.11. 05:04 (50d48ebe9a); with B741 about 11 h.
- B728 stayed at "Nicht begonnen" for 7.2 h behind B741 and B676 while one subagent ran on average.
- B728 and B741 share code commits and block each other; each has 12-13 code commits and over 120 queue commits.
- CI is not the largest post per row. It still costs the morning: the builder repairs the red run before any row.

### The three nights 24.-26.11.

Window 22:00-08:00 each, builder subagents only.

| Night      | Hours with 0 / 1 / 2 / 3+ subagents | Subagents | Commits (docs / fix / feat) | Rows out of the queue table |
| ---------- | ----------------------------------- | --------- | --------------------------- | --------------------------- |
| 23./24.11. | 4.0 / 3.3 / 2.6 / 0.1               | 45        | 77 (28 / 21 / 12)           | 10                          |
| 24./25.11. | 2.4 / 6.4 / 0.8 / 0.4               | 63        | 120 (69 / 28 / 12)          | 6                           |
| 25./26.11. | 2.8 / 2.3 / 2.7 / 2.3               | 131       | 225 (128 / 32 / 43)         | 23                          |

- The nights are not idle. Of 9.2 h without a subagent, 5.8 h lie before the builder starts (00:45, 23:28, 23:31;
  on 25.11. it held on the doc session's word from 20:05). The rest: 38 min usage limit (26.11. 05:43-06:21), two
  stretches of 20 and 40 min in which the builder worked alone, and pauses under 20 min.
- The limit is one subagent at a time: 6.4 of 10 h in the night 24./25.11. The night with two and more closed four
  times the rows.
- Repairs take the subagent time: 23./24.11. 51% went to jobs without a row (red CI, broken tools); 24./25.11. 25%
  to B736 (Studio e2e stable) and 9% without a row; 25./26.11. 18% without a row.
- "Rows out of the queue table" counts closed and parked rows alike; git does not tell them apart.

### The heavy lock, since 26.11. 13:50

The human saw both builder subagents "pur auf waiting" at 16:05. Measured at 16:07: B787's e2e case held
`/tmp/fifagg-heavy.lock` after 83 s in the line; behind it waited a visual shard of the other repo (4 of 6) and B804's
design check. 202742bdfa allows one heavy job on the machine at a time, across all repos: every design check, build,
e2e and full test run. The machine has 32 cores and 93 GB.

| Builder subagents                | Wall time | In pauses over 60 s |
| -------------------------------- | --------- | ------------------- |
| 48 h before the rule (462)       | 64.5 h    | 36%                 |
| Since the rule (35)              | 6.4 h     | 69%                 |
| Since the rule, with a lock (17) | 4.9 h     | 76%                 |

Two subagents now work one after the other whenever both test, and a second repo's suite takes turns with them.
Proposal 2 gains nothing while this rule stands. B793 step 1 handed back uncommitted, "blocked on the heavy lock".

### Three machines, one in use

The human on 26.11.: three machines run here, and all the agents do is step on each other's feet on one of them.

| Machine        | Size                                         | Share of 82.7k Bash calls in the window |
| -------------- | -------------------------------------------- | --------------------------------------- |
| tank (Linux)   | 32 threads, 93 GB, load 14 at 16:07          | 98.4%                                   |
| Mac            | 12 threads, 32 GB, load 1.4 at 16:09         | 1.4% (1151, mostly Apple-only checks)   |
| rack (Windows) | 32 threads, 64 GB, runs the other repo's e2e | 0.2% (154)                              |

Every checkout, build, e2e run, design server and Studio app shares tank, with the second repo. The builder skill
names the other two in one line ("Compute by ssh") and no rule sends work there. CI runs on GitHub's runners
(`CI_SELF_HOSTED` is false), not on a machine here.

### Red CI

Failed jobs in the 114 red runs of CI (Next):

| Job                      | Runs                         |
| ------------------------ | ---------------------------- |
| Studio e2e               | 75 (53 of them nothing else) |
| Unit tests               | 29                           |
| Perf ("non-blocking")    | 27                           |
| Rust host                | 13                           |
| Timetrack e2e            | 13                           |
| Checks                   | 9                            |
| Component behavior tests | 7                            |
| Build                    | 4                            |

A run takes 34 min (median, green). Pushes go in batches (one case: 14 commits), so a red run does not name the
commit. Lint, build and checks are 13 runs together: more pre-commit hooks would gain almost nothing. Some red
shards only passed the 5 min budget with no failed case (run 44964042867: 5m06s and 5m01s).

Unit tests, the 29 red runs by cause (failed job log of each run; a run with two causes counts under the first):

| Cause                                                                               | Runs |
| ----------------------------------------------------------------------------------- | ---- |
| A spec fails on its assertion every time (12 spec files, 9 of them in `cli`)        | 11   |
| Stale snapshot `cdk/generators/migrate-from-cdk/components-classes.spec.ts`         | 6    |
| The step `yarn test:e2e-helpers` (no failed nx task in the log)                     | 3    |
| `agent-rules/src/lib/agent-sessions.spec.ts` reads the runner (paths, cgroup, time) | 4    |
| A temp folder vanishes or is not empty (ENOENT, ENOTEMPTY)                          | 3    |
| `Test timed out in 5000ms`                                                          | 2    |

- 22 of 29 are real failures that the project's own test run shows locally; 7 tip.
- The snapshot is red in 8 runs (two of them under another first cause). It breaks when a commit adds an `et-` class to a components stylesheet: the commit touches
  `components`, the red spec lives in `cdk`. It stayed red over three runs in a row on 20.11. (10:33-19:56).
- Twice the same real failure went through two runs (`runtime-imports.spec.ts` 21.11., `about-dialog` 22.11.).
- One real failure exists only in CI: the merge specs of 25.11. need a git identity the runner lacks.

Perf is history: all 27 failures are the 27 red runs before e506e76ba8 (20.11. 13:35), which moved the job into its
own workflow CI (Perf). `Verified` does not need it, so it turns no run red any more. With `continue-on-error` the
new workflow is green whatever the perf specs say (132 green, 0 red): a perf regression shows in no run list.

### Where the tokens and the subagent time go

- Subagents use 65% of all tokens, the builder 22%, the doc agent 13%.
- Half of all subagent tool calls are `grep`/`sed`/`cat`/`ls` (36.8k of 73k). Estimate: a third of all tokens.
- Read again and again: `apps/ethlete-studio/e2e/canvas.e2e.mjs` 1308 times (also 86 commits, 44 of them fixes),
  `tools/scripts/verify-studio-headless.mjs` 522, `tools/scripts/scratch-checkout.mjs` 294.
- `plans/QUEUE.md`: 690 commits, 647 reads, about 3600 messages between the sessions.
- Rework: `sketches.component.ts` 75 commits, 53 of them fixes. B676, B757 and B602 took 55-65 subagents each.
- 428 subagent starts (30% of subagent tokens) name no queue row.
- Subagent wall time (196 h): 33% model, 19% waiting for background jobs (mostly `until grep` loops of 8-25 s),
  about 25% looking around, tests and lint and build about 8%.
- Still failing: `Monitor` without `description` (41), tool `bash` instead of `Bash` (87), 1233 retries with the
  same command prefix after a failure.

## Proposals

Not decided by the human except where noted.

Tempo:

1. The builder merges at night where it may; the human gets the merged result with an image in the morning and can
   turn it back. Check whether eee7d66bac covers the cases B728 and B741.
2. More than one subagent at night when rows are free. Rows that touch the same files become one row first.
   Before that: the one heavy lock becomes a few slots (the first free of N lock files), and a check of one part
   counts as light. How many slots the machine carries before the e2e cases tip is not measured.
   Better than slots on tank: heavy jobs leave tank. A command takes a commit, runs a suite in a scratch checkout
   on the rack or the Mac and returns the result. The rack already does this for the other repo (`fifagg-e2e`
   there, used from 92 of its sessions) and holds node 24, git, cargo and three scratch folders of this repo; only
   steps bound to Linux (bash scripts, the Linux host) need a Linux side there. Tank keeps the editing, the design
   server and the Studio the human looks at.
3. Cut large rows: a row not closed after its third code commit is split into the finished and the open points.

Red CI, beside the commit instead of before it:

4. A checker next to the builder runs the affected Studio e2e shards in a scratch checkout after each commit and
   reports red within minutes, with the commit. The commit itself stays fast.
5. Red means revert, not repair: the commit goes back at once, the row reopens, `next` stays green.
6. Passing the time budget with no failed case warns and does not fail.

Tokens and turns (the human: "rest klingt gut"):

7. `QUEUE.md` changes only when a row opens or closes; states in between live in the subagent hand-back.
8. Split `canvas.e2e.mjs` by view. Give the two most-read scripts a `--help` that the brief names.
9. Search and measuring jobs may go to Codex. The human's limit there does not last long: use it sparingly.
   Opus subagents only for jobs with no known cause.
10. No subagent waits for a run: it starts the run and hands back; the end of the run wakes the builder.

## Open

- The 13.7 h "not readable" in the row sample.
- How many heavy jobs tank carries at once before the e2e cases tip, and which suites run on the rack as it is.
- The three `yarn test:e2e-helpers` runs: the failing helper spec is not read.
