<!-- Builder handoff, Mac night shift 2026-11-09/10 (ADR 0239), third session. Replace once resumed. -->

# Handoff: builder, Mac night shift (ADR 0239)

Run `/builder-agent` first. The grill/docs session is `ethlete-sdk-68`; report every sha to it with `SendMessage`.
Never ask the user. `export NX_NO_CLOUD=true`. Commits: `git commit -- <paths>` (`git add -- <new file>` first), never
`git add -A`, stash, amend or rebase. Write the slice paths to `$(git rev-parse --git-path slice-paths)` at each slice
start; an exported `ETHLETE_SLICE_PATHS` does not reach a later Bash call (finding 670). Run one full test run at a
time; pause subagent e2e runs during a push:suite.

## State at handoff (2026-11-09 ~22:30)

- Pushed: f6a97186f to next = cargo fix (rusqlite 0.41.1) + 343e968aa + d43db5c91 + 077bd0543 as new shas. Local next
  merged origin/next (c9d65d0f0). Unpushed local: bf629fca8 (e2e timing cases -> perf job), fe28fc8c9 + 265baef27
  (fixture check once, warm-up every worker, fail on timeout), f3e978adb (`delayPictures: false` for 3 cases), grill docs.
- CI run 42699047872 (f6a97186f): cargo audit no longer fails. Failed: Unit tests (3 cli part-* specs at the 30 s
  timeout: part-accept, part-go, part-ready) and Studio e2e 6/6 (hover case = B464). A `gh run rerun --failed` runs.
  Grill decision (ADR 0230): the part-* timeouts get row B466 whatever the rerun shows. If they fail again and no cause
  in 15 min, revert the suspect. Grill hypothesis: 343e968aa `maxWorkers: 4` in libs/cli/vitest.config.mts (and
  077bd0543 in apps/ethlete-studio/vite.config.mts) raised CI parallelism on the 2-vCPU ubuntu-latest runner (vitest
  default there is 1-ish). Check: compare the vitest worker count in the logs of runs 42651661922 vs 42699047872. Fix:
  cap `Math.min(4, <vitest default>)`, not a fixed 4. Send the rerun result to the grill session.
- B465 / finding 672 done: 9e4ada3c5 fix(repo) (local, not pushed). The sketch view keeps a painted frame until the
  new revision's frame paints; the case waits for a variant-a cell; per-case `holdListings: false`. Bite proven.
- Orphan a-cli design servers pids 65717-65719 (parent 1): kill refused by the permission check; the human decides.

## Then

1. One push:suite for the unpushed range (load < 10 first), push on ok, send CI run id.
2. Bug queue: runner check that flags a case whose wait window is shorter than HOLD_LISTINGS_MS unless it opts out
   (657, 672, finding 674); B464 hover case waits for a stable DOM before the hover; 667 part (c) shared shot/vite cache keyed by the
   read-files fingerprint (finding 649), then once-per-run fixture request again; 656, 658 (failureReport prints vitest
   FAIL rows - tonight a cli fail had no file names), 663, 660, 662, 650/659; 670 warning names its source; 673 design
   server exits when its parent is gone, push-suite lists servers older than 1 h.
3. Measurements tonight: 4/6/8 workers made the e2e worse (load 120/253/395); keep 3 workers.
