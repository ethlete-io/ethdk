# Process speed plan 2026-11-26

Ordered by the human on 26.11.: one solid plan, built at once, not one drop after another. The numbers behind each
step are in [the review](process-review-2026-11-26.md). The four packages start today and run side by side; the two
rows in flight finish first, no other product row starts before package 1 is done.

## What is wrong, in four lines

- One machine does 98% of the work, and since 13:50 it runs one heavy job at a time: 69% of subagent time is waiting.
- 54% of the CI runs are red, 22 of 29 unit test failures are real, and a red run names no commit.
- A night runs one subagent at a time for most hours and starts 1.5 to 3 hours late.
- 26% of the commits and a third of the tokens are bookkeeping and reading the same big files again.

## Package 1: machines (today, first)

Goal: no agent waits for a machine while another machine idles.

1. `tools/scripts/heavy.mjs run -- <command>` replaces the bare `flock`. It takes the first free of 3 slot files on
   tank and prints which job holds a slot when all are taken. One design check of one part, one spec file and one
   e2e `--case` are light and take no slot. `docs/process.md` line 35 changes with it; the other repo calls the same
   script.
2. `tools/scripts/remote-run.mjs --host rack|mac --ref <sha> -- <suite>` pushes the commit to a bare repo on the
   host, checks it out into a scratch folder there, installs from the host's cache, runs the suite, streams the log
   and exits with the suite's code. No subagent waits on it: it starts the run and hands back, the end of the run
   wakes the builder.
3. Where each job runs:

   | Job                                                                | Machine                        |
   | ------------------------------------------------------------------ | ------------------------------ |
   | Editing, design server, the Studio the human sees                  | tank                           |
   | Light jobs and at most 3 heavy ones                                | tank                           |
   | Full unit test run, Storybook e2e, the other repo's non-visual e2e | rack                           |
   | The other repo's visual shards, in chunks under 15 min             | tank, until step 4 is proven   |
   | Studio e2e shards                                                  | rack; tank until it runs there |
   | Container shards (picture tests in the Playwright image)           | Mac now; rack after step 4     |
   | Unit tests of one lib as overflow, all Apple checks                | Mac                            |

   Visual baselines are bound to Linux: the other repo's visual tests are all red on the rack (its session, 26.11.).
   A suite that compares pictures moves to the rack only after a Linux container runs there.

4. The rack gets a Linux side for picture tests (the human, 26.11.): WSL 2 with a container runtime inside it. The
   suites run in the Playwright image (`mcr.microsoft.com/playwright:v1.64.1-noble`, the version CI pins), so tank,
   rack and CI can share baselines. `remote-run --host rack --linux` runs a suite there.
   - The other repo's 629 baselines are recorded on tank's own Chromium, not in the image, and image against host was
     never measured. So its baselines are recorded once in the image and the human accepts them (its plan VB-1,
     branch `test/visual-container`, script `tools/e2e/visual-container.sh`, written for podman).
   - Proof: the same container shard (`--grep "visual-baseline public"`) runs on tank and on the rack against
     baselines recorded in the image on tank, and both are green. Its two container runs on tank: 245 of 255 shots
     identical, 9 under 10 px, one at 1203 px, so the limit is a `maxDiffPixelRatio` of about 0.001.
   - It needs on the rack: the e2e build in `dist/e2e`, and its API with the seeded database reachable from the
     container.
   - Measured 26.11.: Windows 11 Pro, the ssh user is admin, a hypervisor runs, `wsl.exe` is there with no
     distribution, 65 GB free on C:. The human allowed a restart of the rack on 26.11.

5. The Mac is the second container host, and it is ready before the rack. Measured 26.11.: Intel i7-9750H (x64, 12
   threads, 32 GB, load 1.5, 132 GB free), colima 0.10.3 with the docker runtime was installed and stopped. It starts
   in 30 s, pulls the Playwright image in 37 s and runs its Chromium (`linux/x86_64`, the architecture of tank and
   CI). It is left running.
   - `remote-run --host mac --linux` runs a suite in the image there; the same flag serves the rack after step 4.
   - The VM has 4 CPUs and 8 GB. `colima stop && colima start --cpu 8 --memory 16` gives it 8 and 16 and leaves 4
     threads and 16 GB for the simulator; an Apple check and a container shard do not run at the same time.
   - Proof: the container shard of step 4 is green on the Mac against the baselines recorded in the image on tank.
     Then the other repo's visual shards leave tank without waiting for the rack.
   - The CPU is from 2019 with 6 cores: the Mac takes shards, not a full run. Its time for one shard beside tank's
     decides how many.

6. Measure once: Studio e2e on tank with 2, 3 and 4 slots taken, and the same suite on the rack. The slot count and
   the table follow the numbers.

Done when: pauses over 60 s are back under 35% of subagent time, the rack has run one full unit test run and one
Studio e2e shard of this repo, and the container shard of the other repo is green on tank, on the Mac and on the rack.

## Package 2: `next` stays green (today, beside package 1)

Goal: a red commit is known within minutes, by its hash, and never reaches GitHub.

1. A mirror on the rack: for every new local commit on `next` it runs the affected unit tests and the Studio e2e
   shards through `remote-run`, and writes red with the commit hash to the builder's mailbox.
2. The builder pushes only commits the mirror passed. No hook is added: the commit stays as fast as it is.
3. Red means revert: the commit goes back at once, its row reopens with the log line, nobody repairs on `next`.
4. Known noise goes now, one subagent job each:
   - `cdk/generators/migrate-from-cdk/components-classes.spec.ts` (8 red runs): the list is derived from the
     components stylesheets at test time, or its check moves into `components:test`, so the commit that adds a class
     fails its own project.
   - ~~`agent-rules/src/lib/agent-sessions.spec.ts` (5 runs)~~: done, each cause already fixed (882f1e051f, d8e9cd6136, 5efbc18271, b60970c636, 87c34ab3de, ee8e6daee8); no red since 23.11.
   - Temp folders of `cli` and `agent-rules` specs (3 runs): one folder per spec file, removed with retries.
   - `cli` specs that time out at 5000 ms (2 runs): a higher limit for the specs that start a process.
   - Merge specs set their own git identity (red only in CI on 25.11.).
   - A Studio e2e shard over its time budget with no failed case warns and stays green.
   - `yarn test:e2e-helpers` (3 runs): read the failing helper spec, then fix or revert.
5. CI (Perf) drops `continue-on-error`: it is its own workflow, so red there blocks nothing and is seen.

Done when: three days with under 20% red runs on `next`, and no red run older than one push.

## Package 3: the night (tonight)

1. ~~The builder starts at 22:00 on its own~~: dropped, the human starts the sessions (26.11.).
2. Three subagents on three rows with no file in common. Rows that share files become one row before the night.
3. A row not closed after its third code commit is split into the finished part, which closes, and the open points.
4. The builder merges at night where eee7d66bac allows it. The human gets the merged result with an image in the
   morning and can turn it back.
5. Jobs without a row (51% of one night) get a row id from the builder before they start, so the morning report
   shows what the night went into.

Done when: a night shows two or more subagents for over half of its hours and its report lists every job by row.

## Package 4: bookkeeping and tokens (tomorrow, the human agreed on 26.11.)

1. `plans/QUEUE.md` changes when a row opens or closes. States in between live in the subagent hand-back.
2. `apps/ethlete-studio/e2e/canvas.e2e.mjs` splits by view (1308 reads, 86 commits). The brief names the file.
3. `verify-studio-headless.mjs` and `scratch-checkout.mjs` get a `--help` that the brief quotes.
4. Opus subagents only for jobs with no known cause. Search and counting jobs may go to Codex, sparingly.

Done when: queue-only commits are under 10% of all commits.

## Who builds what

| Package | Builder subagent jobs                                    | Blocks        |
| ------- | -------------------------------------------------------- | ------------- |
| 1       | `heavy.mjs` (1), `remote-run.mjs` and the rack setup (1) | 2.1, 3.2      |
| 2       | mirror (1, after 1.2), noise fixes (4 in parallel)       | -             |
| 3       | process text and the scheduled start (1)                 | needs 1.1     |
| 4       | queue rule (1), split of `canvas.e2e.mjs` (1)            | after tonight |

## Check in three days

The review's scripts run again on 29.11.: pauses, red runs, subagents per night hour, rows out of the queue, share
of queue-only commits. A package that did not move its number is changed or dropped.
