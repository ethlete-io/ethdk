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
- CI run 42699047872 (f6a97186f): cargo audit fixed. Attempt 1: Unit tests (cli part-accept, part-go, part-ready at 30 s)
  and Studio e2e (hover = B464 flake). Rerun: e2e green, Unit tests failed again (part-go, part-ready) -> row B466,
  finding 675. Cause not proven (green CI prints no vitest worker line). Suspect undone as decided: c11cc03ac sets both
  caps to `Math.min(4, Math.max(availableParallelism() - 1, 1))` (vitest 5 default is cores - 1). The next CI run is
  the proof; if B466 still fails there, look at the part-* specs themselves (harness start under 30 s).
- B465 / finding 672 done: 9e4ada3c5 fix(repo) (local, not pushed). The sketch view keeps a painted frame until the
  new revision's frame paints; the case waits for a variant-a cell; per-case `holdListings: false`. Bite proven.
- Orphan a-cli design servers pids 65717-65719 (parent 1): kill refused by the permission check; the human decides.

## Then

1. NEXT STEP: `yarn push:suite` for the unpushed range (35 commits, incl. 9e4ada3c5 and c11cc03ac; load < 10 first,
   nothing else running). Push on `push-suite: ok <sha>`, send the CI run id and its B466 result to the grill session.
2. Bug queue: runner check that flags a case whose wait window is shorter than HOLD_LISTINGS_MS unless it opts out
   (657, 672, finding 674); B464 hover case waits for a stable DOM before the hover; 667 part (c) shared shot/vite cache keyed by the
   read-files fingerprint (finding 649), then once-per-run fixture request again; 656, 658 (failureReport prints vitest
   FAIL rows - tonight a cli fail had no file names), 663, 660, 662, 650/659; 670 warning names its source; 673 design
   server exits when its parent is gone, push-suite lists servers older than 1 h.
3. Measurements tonight: 4/6/8 workers made the e2e worse (load 120/253/395); keep 3 workers.
