<!-- Builder handoff for the Mac night shift 2026-11-09/10 (ADR 0239). Replace once resumed. -->

# Handoff: builder, Mac night shift (ADR 0239)

Run `/builder-agent` first. The doc agent reads `plans/ethlete-studio/handoff-doc-agent.md`. Report every slice
sha to it. Never ask the user. `export NX_NO_CLOUD=true`. Commits: `git commit -- <paths>`, never `git add -A`,
stash, amend or rebase. Never commit `.ethlete/design/*/pictures.json`, `.ethlete/design/studio/ready.json`,
`.ethlete/design/studio/sketches/pages-system/sketch.json` or `.ethlete/design/sdk/sketches/` (other sessions).

## Start

1. `git fetch origin && git checkout next && git pull --ff-only`. The PC pushed up to the sha the doc agent names.
2. Set three one-shot claude-at watchdogs as in ADR 0220: `kick-01`, `kick-06`, `kick-11` at 01:35, 06:35 and 11:35
   (five minutes after each usage reset). Each reads both tmux panes, types a resume line into a session that stopped
   at a limit, logs to `/tmp/dx/kick-report.log` and exits.
3. Scope tonight (ADR 0239): e2e speed, then perf, then bugs. No features. B249 (Baubereit) is day-shift work.

## Push rule (ADR 0230/0231)

`yarn push:suite` in the background; push only the sha in `push-suite: ok <sha>` (`git push origin <sha>:next`).
A plans-only commit on top of an ok sha needs no new verdict. `PUSH_SUITE_SKIP=1` is for the human only.

## Queue 1: e2e speed (rest of item 0, ADR 0237/0238, now tool backlog)

- Idle measurement against 90 s: 3 runs of the push:suite e2e step, with the 1-min load average written next to each
  time (`cut -d' ' -f1-3 /proc/loadavg` on Linux, `sysctl -n vm.loadavg` on macOS) at start and end. Last PC values:
  127.6, 123.0, 117.6 s at load 39-51 (noisy, finding 650). Wait for idle with a deadline (finding 640).
- If the idle runs are over 90 s: the next lever is an on-disk check cache shared across design servers, keyed by
  target-relative inputs (36 of 57 misses were the first check of a fresh server, about 185 s worker CPU in total).
  The doc agent decided that its cost goes to the human first. Second lever: let `sketches` reuse a fresh `rules`
  result.
- Delay run in the repeat gate (647 tool fix): `tools/scripts/studio-e2e-repeat.mjs` passes `--delay-pictures <ms>`
  inside the existing hold run (run 3, with `--hold-listings 14000`), not as a 4th run. First prove that the two do
  not mask each other, and find the smallest delay that bites.
- 647 bite proof through `exportCommit` of `tools/scripts/push-suite.mjs` (accepted backlog fix). Two hand-made
  exports of HEAD on the PC (`/tmp/exp-tools/export.mjs`, a copy of `exportCommit`, plus
  `STUDIO_CLI_ENTRY=<main tree>/dist/libs/cli/src/index.js`) timed out in `warmUp` (canvas.e2e.mjs:2765, 60 s) in every
  run, also with no delay. So a hand-made export cannot start the canvas, but push-suite's export can. The cause was
  not found. Proof: the `liveShotsOf` change of ec946602e reverted plus `--delay-pictures 60000` must fail the case
  'a sketch scroll never empties a cell that had a picture'; with the fix, 2 runs must pass. The delay route is
  already installed after `warmUp` (canvas.e2e.mjs:2939-2950).

## Queue 2: perf and bug candidates

- Finding 649: every CLI cache uses the shared read-files fingerprint (`trackedRun`, open-points cache), no
  hand-built keys.
- Finding 650: the e2e timing report prints the load average at start and end and marks a run over a threshold as
  "noisy, not a measurement".
- Finding 651: every "Verified" line in a plan names the sha and the command.
- Bug: find why a hand-made export of HEAD times out in `warmUp` while push-suite's export does not (see above).

## State at handoff

- Check cache b94bb9b46 is in; 7 specs bite. `dist/libs/cli` on the PC was rebuilt from it.
- Not verified: the 647 fix under a delay on committed code (the earlier "passes 3/3" came from the /tmp scratch
  harness, finding 651).
