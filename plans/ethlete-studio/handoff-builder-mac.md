<!-- Builder handoff, Mac night shift 2026-11-09/10 (ADR 0239), second session. Replace once resumed. -->

# Handoff: builder, Mac night shift (ADR 0239)

Run `/builder-agent` first. The grill/docs session is `ethlete-sdk-68` (tmux `claude-2@ethlete-sdk`); report every
sha to it with `SendMessage`. Never ask the user. `export NX_NO_CLOUD=true`. Commits: `git commit -- <paths>` (a new
file needs `git add -- <file>` first), never `git add -A`, stash, amend or rebase. Never commit
`.ethlete/design/*/pictures.json`, `.ethlete/design/studio/ready.json`, any `sketch.json` or `.ethlete/design/sdk/sketches/`.
Commit scope: `repo` for Studio/tools, `cli`, `deps`; commitlint rejects `timetrack-app` and `ethlete-studio`.

Watchdogs are set: claude-at `kick-01-1110`, `kick-06-1110`, `kick-11-1110` (2026-11-10 01:35/06:35/11:35).

## Top priority: CI on `next` is red, the fix is not pushed

- Cause: `cargo audit` RUSTSEC-2026-0459. Fix 2bc4d42f2 (rusqlite 0.41.1, libsqlite3-sys 0.39.1), cargo test 280 ok,
  cargo audit ok. Not pushed: no `push-suite: ok` yet. Unpushed on top: 6cafe2129 (delay in hold run), 343e968aa
  (cli: macOS git `-G` POSIX regex, render fixture font, `maxWorkers: 4`), d43db5c91 (harness spec 30 s),
  077bd0543 (Studio unit specs `maxWorkers: 4`), plus grill plan commits.
- push:suite now: cli ok, studio ok, e2e fails 132/133 with a different load-timing case each run
  (`[Sketches] first load creates one iframe ...` 60 s waitForFunction; then `[System] page switch time is logged`,
  `icons->shell-main ... all NOT`). Each passes alone. Step takes 513-533 s on 3 workers. Do not rerun push:suite
  blindly again (grill: no loop).
- Cause to fix next: `canvas.e2e.mjs:3020` picks `min(8, floor(availableParallelism()/4))` = 3 workers on this 12-core
  Mac (PC: 8). Grill order: (1) find a worker count that fits the machine (lesson 662: fit the machine, not CI) and
  measure 4/6/8 workers with the load average and per-worker `fixtures`/`warmUp` times; (2) 3 idle runs, each with
  machine, cores, workers, load; (3) disk check cache (inside the existing CLI cache, shared read-files fingerprint,
  finding 649) if still over 90 s; (4) 647 bite proof through push-suite `exportCommit`. Then push:suite, push, send
  the green CI run id to the grill session.
- Run one full test run at a time; no subagent test runs during push:suite. Run `npx nx build cli` after any libs/cli
  commit, or the e2e runner shows NOT RUN (finding 663).

## Bug queue after queue 1 (grill order)

656 push-suite re-execs itself from the export dir (+ spec: dirty tools/scripts does not change the run);
658 failureReport prints vitest `FAIL` rows; 663 canvas runner checks dist freshness before workers start;
660 spec/lint rejects `\s \S \b \d \w` in git `-G`/`--grep`/`-E` args in libs/cli; 662 shared vitest preset with
maxWorkers that every project uses, plus a check; then 650/659 load report (load at start/end, top CPU processes).
