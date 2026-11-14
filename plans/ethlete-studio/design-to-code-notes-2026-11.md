# Design-to-code notes, 2026-11

This file holds as-built and update notes moved out of design-to-code.md for size, verbatim and in original order.

Moved from design-to-code.md line 386: As built (B364, 2026-11-07): a3b204c2d already made designSketch end every usage error w

As built (B364, 2026-11-07): a3b204c2d already made `designSketch` end every usage error with exit 2 (non-zero) and added `sketch-usage-exit.spec.ts` (every writing subcommand without arguments and with only `--by`, `ready` without `--by`). This row adds `covers`, `list`/`check` with an unknown flag and an unknown subcommand to that spec. Exit 2 stays (the other design commands use it for usage errors), not 1. Not verified: the compiled `et` binary's process exit code.

Moved from design-to-code.md line 413: As built (B362, 2026-11-07): tool side only, no design and no app change. A part declares

As built (B362, 2026-11-07): tool side only, no design and no app change. A part declares `coverage` (`PartCoverage`,
`define-part.ts`): `branches` (per layout branch the real widest and tallest input and the sample size each state
draws), `zoom` (extremes, and per status the state at each extreme), `async` (per async mark the state that draws it
unknown, or `null`) and `chrome` (live chrome labels). `design check` warns `COVERAGE-RANGE`, `COVERAGE-ZOOM`,
`COVERAGE-ASYNC`, `SAMPLE-CHROME` (text or `alt`/`aria-label`/`title` inside a `data-et-sample` region repeats a chrome
label) and, for every part, `STATUS-TWICE` (the same `data-et-status` twice in one `data-et-view` region)
(`rules/design-coverage.ts`, loads only parts whose source has `coverage:` or `data-et-status`). Verified: spec
(9 cases); a temporary `coverage` on `pages/sketches` (not committed) made `design check --part pages/sketches` print
3 COVERAGE-RANGE, 6 COVERAGE-ZOOM and 1 COVERAGE-ASYNC warnings. New e2e case "a sketch keeps its frame count and
pictures from the first paint through a sketch edit" (Sketches/Large): fails when the `[data-shot]` count at the first
paint differs from the settled one, or changes, or a pictured visible cell goes blank in the 10 s after a variant CSS
edit. The case did not run: the Studio build of this branch fails (TS2322, `ThemeSwitch[]`, not in this
change), so neither its pass nor its bite is proved; it is expected red until B345. Not done: `pages/sketches` carries no `coverage` yet and marks no `data-et-status`/`data-et-view`/`data-et-sample`,
so the rules do not bite on it until B346 adds them (gaps: tall page sample in the matrix branch, status × below-fit /
far-out, `changed` unknown, sample variant names "Aktuell"/"Variante a"/"Variante b", header status twice). The
`real` sizes are declared by hand, not read from the listing; the sample shots are pictures, so SAMPLE-CHROME sees
their labels only where the design marks a `data-et-sample` region with text or `alt`.

Moved from design-to-code.md line 548: Fixed in 9d788d831: design typecheck runs tsc with --pretty false; a spec under FORCE_C

Fixed in 9d788d831: design typecheck runs tsc with `--pretty false`; a spec under `FORCE_COLOR=1` fails without the
fix, and the full `nx test cli` passed (2553). B373 is closed.

Moved from design-to-code.md line 551: As built (B390, 2026-11-07): libs/cli/src/lib/plain-output.ts holds stripAnsi, plainE

As built (B390, 2026-11-07): `libs/cli/src/lib/plain-output.ts` holds `stripAnsi`, `plainEnv` (`NO_COLOR=1`, `FORCE_COLOR=0`), `spawnPlain([cmd, ...args])` and `execPlain([cmd, ...args])` (utf8 capture, plain `stdout`/`stderr`, also on the thrown error). Migrated: design typecheck and `--lint` eslint, prettier (stdin format, which now also reports empty output as a failure; `sketch/check-format` and `sketch/merge`), the git wrappers (`api/git`, push-status, hooks-problem, sketch-command, merge-commit, update commits/packages), compose output and `ps`, API setup, migration scan, release capture and both harness build spawns. `--pretty false` stays at the tsc call. Spec `plain-output.spec.ts` runs under `FORCE_COLOR=1` and bites. Not migrated: non-capturing spawns and git binary/buffer captures; no lint rule forbids a new raw capture.

Moved from design-to-code.md line 573: As built (B394): yarn revert:check <sha-to-revert> [head] (tools/scripts/revert-check.m

As built (B394): `yarn revert:check <sha-to-revert> [head]` (`tools/scripts/revert-check.mjs`) lists the markup tokens
(aria-_, data-_, `[attr.x]`, `[x=...]` locators, `x="..."`) the commit touches and every later commit that names it or
changes a line with one of them, e2e specs included; prose files are skipped; exit 1 when any is found. Run on
e73234f6e..40a92b60b^ it lists 80d8d2b8c. Part 2 needed no hook: ADR 0225 moved slow checks out of pre-push, and CI
already runs the behavior suites of the changed components (`apps/storybook-e2e/affected.mjs`, the `e2e-selection`
step and three `storybook-e2e` shards in `ci.yml`), including a change that touches only an e2e folder.

Moved from design-to-code.md line 589: As built (B393): a part with a record in implemented.json whose hash differs from its de

As built (B393): a part with a record in `implemented.json` whose hash differs from its design hash gets the `COMPARE`
rule (`designOnly` in its slow inputs, so the design change already makes the cache stale). That run judges only the
states `shootStates` marks `undrivable`; a pixel difference is ignored, as the app is not yet rebuilt. A hit names the
state and the linked app component to build the trigger in. A part never implemented is not compared. Specs on fixtures
with fake runners in `slow-checks.spec.ts`; no real render ran.

Moved from design-to-code.md line 601: As built (B395): .husky/pre-commit runs check-studio-adrs.mjs (about 0.7 s) when STAT

As built (B395): `.husky/pre-commit` runs `check-studio-adrs.mjs` (about 0.7 s) when `STATUS.md` or an ADR file is
staged; it checks the working tree, like the pre-push gate. The doc-agent skill carries the `built:` rule. A spec
pins the hook wiring.

Moved from design-to-code.md line 928: As built (494, builder): pixelsDiffer in libs/cli/src/lib/design/system/anti-alias.ts

As built (494, builder): `pixelsDiffer` in `libs/cli/src/lib/design/system/anti-alias.ts` is the one per-channel rule (8 of 255); `merge-compare.ts` (`looksTheSame`) and `comparePngs` in `part-compare.ts` both use it, so a 1-2 level corner shift is `ok` in `compare` and a 9 level change still counts. `check-studio-adrs.mjs` refuses an `open: none` ADR numbered above 0204 (older ones are grandfathered by number). Specs: `part-compare.spec.ts`, `merge-compare.spec.ts`, `check-studio-adrs.spec.mjs`; bite proofs run (tolerance -1 fails the compare spec, cutoff 9999 fails the ADR spec). The repo passes `lint:studio-adrs`. Not verified: a live `design compare` run on the 21 px corners, and a push through the pre-push hook.

Moved from design-to-code.md line 971: B406 as built (builder subagent, 2026-11-07): mergeSketch builds a temp copy of the chec

B406 as built (builder subagent, 2026-11-07): `mergeSketch` builds a temp copy of the checkout (`sketch/clean-copy.ts`):
`.ethlete/design` (and a non-built-in base outside it) comes from `git archive HEAD`, or from the working tree outside
git; every other entry links to the checkout, `node_modules` is a folder of links without `.design-explore`, `.git` is
left out. The product's `sketches/` in the copy holds only the merged sketch. Writing, the check and formatting run in
the copy; the files it changed are then written into the checkout, and the bookkeeping (`merged.json`, comments, sketch
removal, rebase of other sketches) runs there as before. Foreign uncommitted edits elsewhere neither block nor fail
the merge. The old guard is gone; the new one asks `git status` only for the replaced folders and the changed files,
and refuses with `dirty` naming them ("would overwrite uncommitted edits"), so the held-merge retry keeps working.
Specs: `merge.spec.ts` (clean copy ignores a broken and a dirty file outside; a dirty merged file is named),
`sketch-command.spec.ts` (the auto-merge runs past a dirty file outside the sketch and keeps it). The spec of the
held-merge retry is gone: a dirty file inside the target folder now stops `sketch ready` at SKETCH-BASE-STALE before
the merge, so no `sketch ready` fixture reaches a hold; `retriedHeldMerges` is unchanged.

Moved from design-to-code.md line 1130: B416 phase 1+2 (in progress, then as built in the perf(cli) commit that adds this note):

B416 phase 1+2 (in progress, then as built in the `perf(cli)` commit that adds this note): measured first - each app
shot of pages/sketches spent 10.05 s in `settledPanesOf` waiting for an overlay pane its design draws and the app never
opens (`PANE_COUNT_TIMEOUT_MS` 10 s); load 0.1-0.2 s, screenshot 0.06 s. Built: per-shot timing phases
(`compare-app-shot <state> load|settle|screenshot|...`); the pane wait capped at 1 s, ending early once the open panes
settle with no new one; a state whose app opened fewer panes prints `<state> note: the design draws N overlay panes,
the app opened M ...` (a note, not a failure: the 0 px pictures of other sessions had the same mismatch); design and
app shots draw 4 at once (`INSPECTS_AT_ONCE`) through the draw queue, shots in state order, a string pointer open still
aborts. Numbers (studio, read-only, resident off, harness cached): pages/sketches 340.8 s -> 19.7-25.7 s
(compare-app-shots 317.7 -> 5.0-6.0 s, design shots 10.1 -> 5.6-7.0 s, compare-actions 8.2-8.7 s untouched); pages/start
-> 2.5 s. Verified: specs (concurrency > 1 with order kept, fails at limit 1; pane cap and note), tsc, lint. Not
verified: warm resident numbers (not restarted, shared). Still over 10 s: design shots (S4 cache) and compare-actions.

Moved from design-to-code.md line 1274: 591 as built (2026-11-08): canvas.e2e.mjs sets a 10 s Playwright default (WAIT_MS) and

591 as built (2026-11-08): `canvas.e2e.mjs` sets a 10 s Playwright default (`WAIT_MS`) and drops every explicit 15, 30
and 90 s wait; `settled` stops after 10 s. Two waits stay named and long: `FULL_COMPARE_MS` (60 s) for the full sketch
compare (`data-sk-changed="pending"`, the full listing, the folded same-variant row), and `COLD_START_MS` (60 s) for a
once-per-worker warm-up page load, since the first Studio load of a worker took 12-17 s here. The run prints `suite
<m>m<s>s of 5m budget` and fails above it only with `STUDIO_E2E_BUDGET_ENFORCE=1` (not set in CI). CI runs
`STUDIO_E2E_WORKERS=2`: one worker used about 3 cores here; on 12 cores 4 workers overloaded and missed 10 s first-frame
waits, 2 did not. The default stays cores / 4. Verified: `--case` subsets at 1, 2 and 4 workers; one full run at 2
workers, 114/132 in 19m06s on this Mac (load 20-30 from other sessions, x64 Chromium under Rosetta), its failures the
known B434 set plus full-compare waits that ran past 60 s here. Not verified: the time on the 4-core CI runner.

Moved from design-to-code.md line 1562: As built (finding 665, B463, ADR 0230): two e2e cases carry perf: true in canvas.e2e.mj

As built (finding 665, B463, ADR 0230): two e2e cases carry `perf: true` in `canvas.e2e.mjs`: "page switch time is logged to the design timings" and "Neu starten in the code notice answers within 100 ms". They fail under load on the 12-core Mac, so the default run, `push:suite` and the blocking e2e job skip them. `--perf` runs only them, and `--case` finds one only together with `--perf`. The header line prints how many were skipped. The CI `perf` job now builds and runs `yarn studio:e2e --perf` with one worker; it stays non-blocking and out of both `needs` lists. `tools/scripts/studio-e2e-perf.spec.mjs` checks that the default selection never holds a perf case. The B462 flake is not a timing case and stays blocking.

Moved from design-to-code.md line 1596: As built (B471, finding 681): cases flagged quiet: true sort last; only worker 0 takes t

As built (B471, finding 681): cases flagged `quiet: true` sort last; only worker 0 takes them, once no other worker
holds a case, after printing `quiet tail: <n> case(s) on worker 0`. Every failed row ends in `- load <1-min> on <n>
worker(s)`. Marked: page switch timings (`all` painted), listing refresh 1 s (`framesPainted`), first load (every iframe
loaded), part shown before (every picture loaded), hover (late mount, B464); 9 rows. Full run: before 503.6 s 131/131
(load 3.0); after 533.6 s 130/131 (load 4.9; tail 62 s; `Fit is stable` hit `page.goto` during the build, `load 46.3 on
3 worker(s)`). Bite: 3 workers ran 9 parallel rows, the tail line, then 4 hover rows, each forced fail printing `load
72.8 on 1 worker(s)`. Not verified: push:suite, CI, `--perf`.

Moved from design-to-code.md line 1604: As built (B471 cause, finding 681): on failure the page switch case now prints each marked

As built (B471 cause, finding 681): on failure the page switch case now prints each marked img/iframe that is not shown at the window end (state, opacity, img complete/width or iframe load and posted messages, picture request sent / on the wire / first byte / answered in ms since the switch, viewport, frame `data-live`, frame painted) and the requests still in flight. `--cold-shots` gives the scratch checkout its own `node_modules/.design-explore`, as in a fresh worktree; with the shared store warm, shell-main paints in about 100 ms and the case can not fail. Repro: 12 `node -e 'for(;;){}'` hogs, load 47-90 (other sessions ran too), cold: 1 fail in 12 runs, shell-main `all` 8.3-9.6 s in the 11 passes. The fail: 4 of 8 frames painted, all 15 pictures sent at +42 ms, pairs answered at +6.7, +9.4 and +10.5 s with 1.2-2.0 s of server time each. A 6 s window run: `server-stopped` sent +55, on the wire +5459, first byte +6658. Cause (bite): the browser holds the out-of-viewport pictures, at most two or three on the wire, so 15 cold draws run about two at a time. Not the six connections per host: pictures from `[::1]` instead of `localhost` (temporary build) still went on the wire at +491, +1043, then +4174. With `fetchpriority="high"` on the shot imgs (temporary build) every picture goes on the wire at once and shell-main `all` is 3.8-4.4 s in 3 runs at the same load, but `system->icons` then fails in all 3: its two pictures and `/__design/open-points` queue behind the system page's pictures. Proposed fix: none committed. Raise the priority of only the frames of the current switch, or have the server answer the newest view first; each needs its own bite against the first switch. Not verified: the full suite, push:suite, CI, the Chromium rule that caps the pictures.

Moved from design-to-code.md line 1606: As built (B471 fix, 681): the design canvas now asks for its shot pictures with fetchprio

As built (B471 fix, 681): the design canvas now asks for its shot pictures with `fetchpriority="high"` once its camera key changes from one view to another, so every picture of the frames switched to goes on the wire at once, off-screen ones too. The first view a canvas opens keeps the browser's own order, so the system page's pictures stay low and do not take the sockets the next switch needs. `SHOT_FETCH_PRIORITY` (shot-rank.ts) carries it to `ShotRankDirective`, which binds the attribute. Measured with 12 busy-loop hogs (load 29-41 at the run starts), `--cold-shots --perf`, the page switch case, base (HEAD) and fix interleaved, 3 runs each. Base: all 3 pass; `system->icons` 2986/2838/2881 ms, first `icons->logo` 2701/2541/2598 ms, first `icons->shell-main` all 4400/4862/4519 ms; wall 85/80/80 s. Fix: all 3 pass; `system->icons` 2639/2721/2882 ms, first `icons->logo` 547/872/728 ms, first `icons->shell-main` all 4337/4028/4976 ms (its first frame later: 2.3-3.1 s against 1.9 s); wall 77/78/79 s. So the fix keeps `system->icons` passing, makes the first logo switch about 2 s faster and costs no wall time. Suspect, not Cause: the fix stops the shell-main miss. The base did not miss in these 3 runs (the cause runs missed 1 in 12 at load 47-90, with shell-main at 8.3-9.6 s), so no fail was removed here. Not verified: the full suite, push:suite, CI, a higher load where the base misses.

Moved from design-to-code.md line 1617: As built (B472, finding 683): the order already held. The runner owns two build steps: en

As built (B472, finding 683): the order already held. The runner owns two build steps: `ensureCli` (sync, before any
worker) and the Studio build (async); each worker runs its design server and the fixture listing during the build, then
awaits the `built` message before warm-up and its first `next`, so no case starts before the build ends. The design
server builds nothing the runner owns (a Vite dev server that compiles on request). In the 683 run the build ended at
41.9 s and the cases started after every worker was ready; `Fit is stable` was in the first wave, on three cold design
servers rendering their first pages, and the 1-min load still held the build. Built: a `first case starting at <s>`
line, the quiet-tail line carries its start time, and workers 1+ no longer restart during the tail (681 restarted both
for a 50 s setup only to get no job). Bite (fake 20 s build step, removed): HEAD `studio build done at 65.7s`, each
worker `build 17.0s` waited, cases after; with the worker wait removed, `first case starting at 51.9s` before `studio
build done at 54.6s`. Full run: 442.2 s, 131/131, load 4.9 at the start and 16.0 at the end, first case 51.4 s, tail
from 395.1 s, 46.9 s for 9 rows (against 503.6 s before 681 and 533.6 s after). Not verified: push:suite, CI, a second
full run for spread.

Moved from design-to-code.md line 1630: As built (683, 150c2cbe1): the cause recorded above is wrong. The runner already started n

As built (683, 150c2cbe1): the cause recorded above is wrong. The runner already started no case before the Studio
build ended (`await studioBuilt` before warm-up and the first case); a bite with a 20 s slower build shows that this
wait holds the order. `Fit is stable` ran in the first wave on three cold design servers that each rendered their first
page; the 46.3 1-min load still carried the finished build. Cause now: first-wave cold design servers. Tool fix (next):
one warm-up page render per design server before its first case, with a bite (cold server fails the 10 s goto under the
same load, warm passes). Also fixed in 150c2cbe1: during the quiet tail, workers 1 and 2 restarted and did a full setup
of about 50 s for no case. Full `yarn studio:e2e`: 442.2 s, 131/131 (503.6 s before 681, 533.6 s after it).

Moved from design-to-code.md line 1638: As built (B472 warm-up, 683): what the warm-up missed is the shots. warmUp opens the def

As built (B472 warm-up, 683): what the warm-up missed is the shots. `warmUp` opens the default view, the System
page, which asks for 1 or 2 `/__design/shot` pictures. The Sketches page of `pages/system` asks for 52, and the design
server draws each one cold in its own browser, because every worker has a fresh checkout and so an empty shot store.
The 683 row shows that: 66 requests, most of them shots, pending at 10 s. Built: after `warmUp`, each worker takes its
first job and opens that job's page once (`openView`, 60 s cold-start timeouts), and waits until no shot request is
in flight for 1 s. The `ready` line keeps `warmUp` and adds `firstPage`. Bite, 3 workers with the three Fit cases, 10
`yes` processes, 1-min load 31 to 52: cold (warm-up as before), 3/3 passed, goto plus first frame 2.0 to 2.5 s, at
settle only 18 of 52, 24 of 30 and 26 of 32 shots answered, the last one after 25.0 s, cases 28.0, 32.8 and 41.7 s;
warm, 3/3 passed, every shot answered after 1.0 to 3.0 s, cases 18.0, 14.6 and 10.0 s. The bite did not reproduce
the 10 s goto fail cold: the goto ended before the shot images were in the page, so `load` did not wait for them. With
20 or 36 `yes` processes both modes failed earlier, in the fixture listing (60 s). Suspect: under load the page's
`load` event comes after the shot images are inserted, and then the goto waits for cold shot draws. Not proven. Cost:
`firstPage` 19.6, 27.7 and 47.8 s per worker under that load, 21.3 s unloaded; `warmUp` stays at 20 s loaded and 8.6 s
unloaded. The first case gets 10 to 32 s faster, so a worker's start costs net 10 to 16 s more, because the warm-up
waits for every shot of the page. Rejected: warming every target of the run on every worker took `warmUp` from 20 s to
116 to 119 s for three targets. Not verified: a cold goto fail, a full `yarn studio:e2e`, the first pages of the other
targets (System, Flow, Wide), CI.

Moved from design-to-code.md line 1681: As built (667 c, 82369780d): one part-shots store for every checkout, keyed by the read-

As built (667 c, 82369780d): one `part-shots` store for every checkout, keyed by the read-files fingerprint with
checkout inputs stored relative to the checkout; up to 4 variants per key, one file per fingerprint, so a checkout
with other files never gets or overwrites another checkout's picture. A second bug, Cause proven by the bite: the
`server-<pid>` snapshot files were inputs under their real path through the `node_modules` symlink, so the store stayed
cold; both paths are filtered. Vite `cacheDir` stays per checkout (`getConfigHash` includes checkout paths). Bite, one
worker, two runs: before, 22 shots in setup and 28-35 per case in both runs; after, warm, 12 in setup (the fixture
compare redraws on purpose) and 0 per case; a changed `zoom-chip.ts` drew exactly the 67 keys that read it. Draws are
counted (`drawnTotal` in `/__design/queue`). 7 Fit and first-load cases, 3 workers, load 18-27: 120.9 s before, 93.4 s
after. Open: workers on a cold store at the same time still draw the same shot, because nothing shares an in-flight
draw; Suspect: the Wide Fit case draws about 30 shots each run, because its sketch is new in each checkout; 517 old
`shots-*` folders (5.5 GB) in `node_modules/.design-explore` stay.

Moved from design-to-code.md line 1693: As built (667 a, shared in-flight draw): before a design server draws a key that is not in

As built (667 a, shared in-flight draw): before a design server draws a key that is not in the shared store, it takes
a lock file `draw.lock` in the key's store folder (`open` with `wx`, holding pid, start time and a token). A server that
finds the lock taken does not draw; it polls every 100 ms for the stored picture. It reads the picture only when the
read-files fingerprint matches its own checkout; else it draws itself once the lock is released. The owner releases the
lock after the store write, and also when the draw fails or is dropped, so a waiter then draws itself. A lock of a dead
pid, or one older than the draw limit (`DRAW_LIMIT_MS` 60 s, scaled by load), is taken over, and the waiter logs
"past the draw limit" when the age was the reason. Fresh draws neither lock nor wait. The ledger counts `waitedTotal`
next to `drawnTotal` (`/__design/queue`); the e2e `ready` line and each case line print both.
Bite, unit: two stores on one folder, the second waits and reads the first's picture; two shooters, the second draws 0
and waits for 1; a dead-pid lock and an old lock are taken over; a failed draw and a changed input file let the waiter
draw. `spec:stress` 4/4 on the three touched specs. E2E, 7 first-load and Fit cases, 3 workers, cold store each run,
load 4 to 28: setup draws per worker HEAD 22/22/22 (66) and new 21+1/13+6/12+2 waited (46 drawn, 9 waited). Plain
7/7, 115.2 s HEAD vs 112.8 s new. With `--hold-listings 14000`: setup HEAD 20/21/22 (63), new 46 drawn and 9 waited
as above; 7/7, 226.3 s HEAD vs 220.4 s new. Case draws hardly changed (25 to 55 per Fit case, 3 waited for in all):
each case runs another target on another worker, so the workers rarely draw the same key at once. Not explained: the
held Wide Fit case drew 79 at HEAD and 132 new, with 0 waited for in it; one run each. No
"past the draw limit" line in the runs. About 12 setup draws per worker stay: the fixture compare draws fresh on
purpose. Suspect: a lock is taken when the draw is queued, not when it starts, so a waiter may wait for a draw that
sits in the owner's backlog; bounded by the draw limit, not seen in the runs. A server that is killed leaves its locks
(2 left after a plain run); the next waiter takes them over and the store sweep removes dead-pid locks. Not verified: a
full `yarn studio:e2e`, CI, more than 3 workers, a waiter that really reaches the draw limit.

Moved from design-to-code.md line 1715: As built (667 b, 8f45fbb32): each design server start removes the old path-keyed shot fold

As built (667 b, 8f45fbb32): each design server start removes the old path-keyed shot folders in
`node_modules/.design-explore`. Correction: the old name was `shots-<10 hex>` (`viteCacheOf` cuts the sha1 to 10), not
the full sha1. Only directories that match `^shots-[0-9a-f]{10}$` go; `part-shots`, `shots-foo`, `vite-*` and every other
name stay. It runs once per start in `serveDesign`, under the same condition that turns on the shot store, and is not
awaited, so the start is not slower; a failed removal logs one line and the server goes on. Bite: spec
`old-shot-folders.spec.ts` (pattern, missing root, unremovable folder) red without the module, 3/3 with it, `spec:stress`
4/4. Real run: 525 folders and 5.6 GB before, 0 folders and 304 MB after one server start (`part-shots` kept), about 8 s
from launch including the boot. Not verified: a spec for the `serve.ts` wiring, several servers that start at once,
Windows file locks.

Moved from design-to-code.md line 1957: Built (Mac builder, 746): f10c01295 (mock keychain under ETHLETE_STUDIO_SMOKE_VIEW, a "p

Built (Mac builder, 746): f10c01295 (mock keychain under `ETHLETE_STUDIO_SMOKE_VIEW`, a "page loaded" marker from the
init script, fail after 30 s with "no page loaded in 30 s (native dialog?)", first existing sketch as default). Dead
end: a run before the commit still showed the prompt, because the smoke builds HEAD in a worktree, not the working tree.
Decided by the doc agent (tool internal): the smoke `--help` and its start line name the commit it builds ("builds HEAD
<sha>, not the working tree"), and it warns when the working tree has uncommitted changes under `apps/ethlete-studio`.

Moved from design-to-code.md line 1973: As built (Linux builder, 747): the release bot commit chore: 🤖 update prereleases (next)

As built (Linux builder, 747): the release bot commit `chore: 🤖 update prereleases (next)` had no scope, so commitlint failed on it. `ci-next.yml` and `ci-main.yml` now pass `chore(repo): Update prereleases` and `chore(repo): Update versions`; the vendored action appends ` (next)` in pre mode. New `yarn lint:commit-messages` (`tools/scripts/check-workflow-commit-messages.mjs`) lints every workflow `commit_message:` plus that suffix; wired in ci.yml after the commitlint step and in `.husky/pre-push`. Bite: the spec fails the old scopeless message and passes the new ones. Not verified: a real release run.

Moved from design-to-code.md line 2114: 664 + 659 (part 1), as built by the Linux builder (2026-11-11, night): apps/ethlete-studi

664 + 659 (part 1), as built by the Linux builder (2026-11-11, night): `apps/ethlete-studio/e2e/run-load.mjs` prints
the machine (hostname), the cores and the workers on the load line of each e2e run
(`load 3.1 at start, 7.9 at end on tank, 8 cores, 4 worker(s)`). A noisy run adds the top 5 processes by `ps` CPU share,
each with its pid, command and checkout (`/proc/<pid>/cwd` on Linux, `?` elsewhere). Spec: `run-load.spec.mjs`
(4 tests, the machine and process lines fail on the old code). Verified: the spec, a live `topProcesses()` sample on
Linux, and one e2e case run. Not verified: the Mac (no `/proc`, so the checkout prints `?`). Not built: the push-suite
warning before its start (659 part 2) and the goal check per machine (the 90 s goal machine is a human question).
`ps` CPU share is the average over the life of the process, not the last minute.
659 part 2, as built by the Linux builder (2026-11-11, night): `push-suite` calls `processList()` (new in `run-load.mjs`,
`topProcesses()` now uses it) before its slot claim and prints `push-suite: warning: N other test or build process(es) of
this checkout run:` plus one `pid  cpu % cpu  command` line each. `otherTestProcessesOf` (exported, `push-suite.spec.mjs`)
selects by checkout (`/proc/<pid>/cwd` under the repo root), skips push-suite, its ancestors and children, long-lived servers
(Nx daemon, language servers, `design __resident` and what they started) and judges only the first three words of a
command. It warns, never refuses. No `/proc` (Mac): one line, `other processes of this checkout not checked: no /proc on
this OS`. Verified: 2 new specs (both fail with the self/ancestor exclusion removed), a live call with a busy `vitest.mjs`
in the checkout. Not verified: the Mac, a real push-suite start with a warning; the fixture is hand-assembled from real
`ps` shapes, not one capture. Only processes that used CPU in the one-second sample appear, so an idle waiting run is not named.

Moved from design-to-code.md line 2159: 652 step 1, as built (2026-11-11): accepted-pictures.ts writes the shot hashes only to t

652 step 1, as built (2026-11-11): `accepted-pictures.ts` writes the shot hashes only to the gitignored
`.ethlete/cache/<product>/pictures.json` (`productCacheDirOf` in `product.ts`, `CACHE_DIR` in `design-config.ts`). It
reads the old `<product>/pictures.json` only while no cache exists. `writeJsonFile` and the `sketch.json` writer skip a
file that already holds the same text (`writeChangedFile`), so an equal `ready.json` keeps its mtime. `pictures.json`
left the decision files of the UNCOMMITTED-DECISIONS warning. The same commit removes the three tracked
`pictures.json` files from the index (`git rm --cached`; the working files stay). Verified: specs in
`accepted-pictures.spec.ts` (cache write, product folder unchanged, old-path fallback) and `part-ready.spec.ts` (equal
ready.json untouched) fail without the fix and pass with it; typecheck and lint clean. Not verified: a live
`et design check` run on this checkout.

Moved from design-to-code.md line 2195: 793 (a), as built by the Linux builder (2026-11-11): the top-process list of run-load.mjs

793 (a), as built by the Linux builder (2026-11-11): the top-process list of `run-load.mjs` samples `/proc/<pid>/stat`
twice, 1 s apart, and ranks by the CPU share in that second; a process that did not run is left out. Without `/proc`
(the Mac) it keeps the `ps` lifetime average. Specs: `cpuTicksOf` parses a stat line with spaces and parens in the
command; an idle process with a high lifetime average does not appear. Verified: 6/6 specs, eslint, a live sample on
Linux. Not verified: the Mac.
796 (1) result (Linux builder, check runs in scratch clones at 033c17c27 and bb4648025; Cause): both drop the record the
same way, so 652 step 1 is ruled out. The definite blocker is `no-harness` on every `studio-lab` part (7093784d7). The
drop is intended: ADR 0254 keeps `studio-lab` blocked until it gets an app. The builder again named this "open for the
human" (second case of 793 in one night; `build-ready.md` still said "Tom's product call", now marked answered). Decided
by the doc agent (applies ADR 0254): the builder commits the emptied `studio-lab/ready.json` by path, so the next check
does not change the tree again. Side Suspect: no NO RECORD line was printed for the drop; it belongs to 796 (2).
796 (2), as built (Linux builder, 2026-11-11): `recordBuildReady` takes `onRecordDropped`; when `dropPartRecord` really removes a record for a definite blocker, `design check` prints `RECORD DROPPED <product> <part>: <kind>: <text>[; ...]` (every check, not only with `--part`); no line when there was no record. Verified: bite spec (fails with the call removed, passes with it), related specs 127 files, typecheck, eslint, prettier. Not verified: a live run. NO RECORD is a Suspect, not a Cause: `check-record.ts` forwards `onNoRecord`, the existing spec prints it after a drop, and the code reads the same on the live path, so no cause for the missing line was found in the code; it was probably not seen in the run output.
796 (3) and (1) live (Linux builder, 2026-11-11, HEAD 261b8c80e): Cause (measured) of the missing cache file in 796: studio-lab has no harness, so `design check --product studio-lab --part foundations/tokens` prints `NO RECORD studio-lab foundations/tokens: no-harness: ...` and never draws pictures. In a HEAD export (no ignored `pictures.json`), `design check --product studio --part components/disclosure` wrote `.ethlete/cache/studio/pictures.json` with the `components/disclosure` record; `components/comment-row` (6 missing states) wrote none and printed NO RECORD. A main-checkout check of `components/list-row` printed `RECORD DROPPED studio components/list-row: open-point: 5 missing states (...)` live, so (2) is shown live; the grill confirmed the drop was correct (an uncommitted local record).

Moved from design-to-code.md line 2362: 655 (2) as built (Linux builder, 2026-11-11): new .github/workflows/rust-audit.yml runs

655 (2) as built (Linux builder, 2026-11-11): new `.github/workflows/rust-audit.yml` runs `cargo audit` (pinned 0.22.2,
cached binary) on both Tauri crates of `next` daily at 05:00 UTC, on `workflow_dispatch`, and on a push that changes
the workflow. Studio had no audit at all: `cargo audit` in `apps/ethlete-studio/src-tauri` found the 4 zip advisories
(RUSTSEC-2026-0367, -0368, -0369, -0429) that timetrack accepts for the same updater reason, plus a yanked
yoke-derive 0.8.3. Fix: Studio gets the timetrack `audit.toml` (same ignores, same deny list), `cargo update -p
yoke-derive` (0.8.4), a new `ethlete-studio:audit-rust` target, and a step in the `ci / Rust host` job. Verified
(measured): `cargo audit` exits 0 on both crates locally. Not verified: the push run and a dispatch run on GitHub;
the schedule fires only once the workflow file reaches `main` (GitHub runs scheduled workflows from the default
branch). Suspect: a red scheduled run does not show in `et design status`, which reads only the CI run of `next`.

Moved from design-to-code.md line 2377: 760 as built (Linux builder, 2026-11-11, night): check-studio-adrs.mjs --summary prints

760 as built (Linux builder, 2026-11-11, night): `check-studio-adrs.mjs --summary` prints one line
`warning: N studio ADR warning(s); run \`yarn lint:studio-adrs\` for the list`instead of one line per warning, and the
pre-commit hook calls it with`--summary`. `yarn lint:studio-adrs`still prints the full list. Verified: a new spec for`warningLines` and the hook pattern (both fail on the old code: no export, no flag in the hook), 15/15 pass; live:
309 warning lines become 1. Not changed: the 309 warnings are almost all "finding N is cited by no STATUS row".

Moved from design-to-code.md line 2382: 763 as built (Linux builder, 2026-11-11): the case "a step with a log file writes its outp

763 as built (Linux builder, 2026-11-11): the case "a step with a log file writes its output to a new file as it comes"
waited a fixed 150 ms for the first line and let the child print the second line after a fixed 300 ms, so a child that
starts slowly under load missed the first read. Cause (bite): the same case with a child that starts 200 ms late fails
on the old code and passes on the new one. Fix: the case polls until the run log holds the first line, then writes a
`go` file; the child prints the second line only after it sees that file. No fixed delay is left. Verified: spec:stress
4/4 at `--load 2 --slow 4`. Not verified: the Mac at load 18.

Moved from design-to-code.md line 2389: B491 as built (Linux builder, 2026-11-11, ADR 0265): check-changeset-coverage.js skips t

B491 as built (Linux builder, 2026-11-11, ADR 0265): `check-changeset-coverage.js` skips the docs-only paths
`DOCS_ONLY` (`apps/ethlete-studio/docs/adr/**`, `plans/**`) before it maps a path to a package. AGENTS.md "Releasing"
and the changeset skill name the rule. Verified: 3 new specs in temp repos (an ADR-only range passes; a `libs/cli`
README change and a Studio code change next to an ADR still fail); the ADR-only case fails on the old script, 11/11
pass on the new one. Not changed: the pre-existing `no-useless-assignment` lint error at the `kept = null` line.

Moved from design-to-code.md line 2395: B489 as built (Linux builder, 2026-11-11, ADR 0263/0264, finding 792 A/B): sketch pages/s

B489 as built (Linux builder, 2026-11-11, ADR 0263/0264, finding 792 A/B): sketch `pages/sketches@open-points` (targets
`pages/sketches`, `components/sketch-status-badge`), ready, no pick. New page states `picked`, `sketch-only-points`
(a sketch-only part with a pick and two UTILITY-CSS problems), and in a and c `sketch-only-points-open`; new badge state
`picked`. a: the part-view chip "3 offen" top right beside Verwerfen with the Offene Punkte popover; badge "Sketch
gewählt, noch nicht gemergt" (the pick shows twice). b: no chip, one points line beside the round picker; badge
"Gewählt, Merge offen" (long lists truncate). c: the chip in the head of the picked variant beside Übernehmen; badge
"Variante gewählt" (no place for the chip without a pick). No existing badge state fits a pick: a variant that left the
badge unchanged was refused by `sketch check` (same pixels as a), so every variant adds `picked`. Verified: `sketch check`
(only ROUND-NOT-READY before ready), `design check --lint <7 files> --tsconfig` ok, `et design shot` of the new states of
every variant read at full scale, `sketch ready` ok (auto-merge skipped, variants differ). Not done: the app
(`sketchStatus` reading the pick, one shared "waits for a pick" function, the bite) waits for the pick.

Moved from design-to-code.md line 2407: B490 as built (Linux builder, 2026-11-11, ADR 0262/0264, finding 811): sketch foundations

B490 as built (Linux builder, 2026-11-11, ADR 0262/0264, finding 811): sketch `foundations/type@font-pair`, ready, no
pick. Each variant ships its two fonts as self-hosted variable woff2 (fontsource 5.3.0, Latin subset, OFL 1.1) in its
own `assets/fonts/`, with `@font-face` in `type.css` and the face first in `--font-ui`/`--font-code`. a: Roboto + Roboto
Mono (74 kB). b: Inter + JetBrains Mono (86 kB). c: Noto Sans + Noto Sans Mono (66 kB, today's Linux look). Verified on
Linux: `sketch check` ok, `design check --lint <6 files> --tsconfig` ok, `et design shot --variants` of the type sheet,
`pages/merge` open drawn per variant in the design frame, every woff2 served 200 and its FontFace `loaded`, and each face
measures wider than the serif fallback (none of Roboto, Inter, JetBrains Mono is installed here). Found: the
`type.css?inline` copy that `tokenSheet` injects keeps `url('@assets/...')` unresolved, so each family has a second,
never-loading `@font-face` and `document.fonts.check` returns false; the resolved face comes later and wins, but the
order is the only thing that holds. Not done: the Mac shot (out of reach of this builder).

Moved from design-to-code.md line 2418: B490 rest as built (Linux builder, 2026-11-11, 210235327): the Studio app build ships the

B490 rest as built (Linux builder, 2026-11-11, 210235327): the Studio app build ships the design's `@assets`.
`ethlete-studio:build` copies `.ethlete/design/studio/assets` to `@assets/` in the output and marks `@assets` as an
external dependency, so `url('@assets/fonts/...')` stays relative to the emitted stylesheet and loads the copied file. The
recipe holds for any app that imports a product's design CSS: one asset glob from `.ethlete/design/<product>/assets` and
`externalDependencies: ["@assets"]`. The build inputs now name the foundations CSS and the assets instead of the removed
`tokens.css`, so a change there no longer hits a stale Nx cache. Verified on Linux: `build:production` passes; the built
CSS holds `url(@assets/fonts/noto-sans-...woff2)`, the copies equal the design files byte for byte; the built app served
statically loads `/@assets/fonts/noto-sans-latin-wght-normal.woff2` and renders the start view in Noto Sans (shot in
`.claude/handoffs/agent-results/b490-studio-linux-noto.png`); the 855-blocked e2e case passes normally (23 s) and with
`--hold-listings 14000` (135 s); `design check --product studio --part foundations/type` 0 findings. The `ty-specimen`
classes are not in `type.css`: they sit in the `styles` of `type.ts`, the foundation's own sheet, and never reach the app,
so they stay. Not verified: Noto Sans Mono in the app (the start view shows no code text), the Mac shots (Mac builder).

Moved from design-to-code.md line 2438: Sketch pick tool gap as built (Mac builder subagent, 2026-11-11): new et design sketch pi

Sketch pick tool gap as built (Mac builder subagent, 2026-11-11): new `et design sketch pick <target> --variant <key> --decided-by "<words, where>" --by <model id>` writes the `decision` Studio's `POST` pick writes (`decideSketch`), the words as its `comment`; it refuses an unknown or rejected variant and a sketch that is not ready (exit 1, message from `decideSketch`). Verified: 3 new cases in `sketch-command.spec.ts` (merge `--decided-by` exits 1 "has no pick" before the pick and 0 after; unknown variant; not ready), all 3 fail with the command unregistered. Gap 2 not reproduced: a refused `sketch merge` exits 1; the 0 seen live came from a wrapper. `sketch ready` exits 0 on a held auto-merge (`stillReady`): ready succeeded, the merge is retried. Not verified: a pick and merge on the real repo sketches.

Moved from design-to-code.md line 3078: 819 as built (Linux builder, 2026-11-11, ffaf42f02): check-person-names.mjs --staged rea

819 as built (Linux builder, 2026-11-11, ffaf42f02): `check-person-names.mjs --staged` reads the staged blobs under
libs, apps and `.ethlete/design` (pre-push baseline and message); `.husky/pre-commit` runs it when such a file is staged.
Bite: a spec stages a name and clears it in the working tree; red on the old script. Not verified: a real refused commit.
820 as built (Linux builder, 2026-11-11, c373dcfd0): Cause (proved): `lint-changesets.js` read `.changeset` from disk in
the checkout, so an untracked file of another agent counted. Fix: `lint-changesets.js --rev <sha>` reads only the
changesets committed at that sha (`git ls-tree`, `git show`); pre-push-checks passes the pushed head, which covers
push:suite and pre-push. Deviation from the planned fix (run it in the HEAD export): the export has no `.git`; the blobs
are the same content. New script `lint:changeset-coverage`; `yarn lint:changesets` runs both. Bite: 3 cases red on the
old scripts; spec:stress 4/4.

Moved from design-to-code.md line 3588: 900 update (Linux builder, 785facf09): still Suspect, no Cause. Not reproduced in 7 runs (

900 update (Linux builder, 785facf09): still Suspect, no Cause. Not reproduced in 7 runs (pair 2/2; pair + 6 heavy cases
on 8 workers 9/9; scratch with HEAD .ethlete + cold store 2/2; `--page System` 29/29 twice; pair --hold-listings 14000
2/2). The hang: `waitForSelector('ethlete-sketches [data-sk-state]', 120 s)` in `edit()` of `withEditSketch`
(canvas.e2e.mjs); 128 failed at 126.4 s, 41 pictures drawn vs 487 on a pass. Ruled out by runs: shared fixture, load,
dirty tree, cold store, 31d9002d7, 57bac0dc0. The failed case dropped the `design check` exit code and output; 785facf09
now names them, the sketch folder state and the page state on that timeout. Tool gaps (builder default, tool backlog):
on a failed case print the tail of the worker and design-server output; `studio:e2e --like-push-suite` for chosen cases.

Moved from design-to-code.md line 3603: 901 update (Mac builder, 44f8a4eeb): Cause (spec bite + live bite): compare copied the des

901 update (Mac builder, 44f8a4eeb): Cause (spec bite + live bite): compare copied the design frame root text style onto
the harness host before the app shot, so the part inherited the design font and the app body font was never seen. Fix:
`harnessShotOf` reads the computed font family of `document.body` and the harness host before that copy; a first family
that differs from the design root's first family fails the state with a problem line. Live bite: body Jost -> all 15
elements/shell-main states FAILED "app body renders in jost, design root font is noto sans"; reverted -> passes.

Moved from design-to-code.md line 3609: 903 update (Linux builder): Cause (measured): OFF-CENTRE on studio components/zoom-chip

903 update (Linux builder): Cause (measured): OFF-CENTRE on studio `components/zoom-chip` is 0 at aaeef909d^ and 28 at
aaeef909d (B490 merge, `--font-ui` -> Noto Sans) and at HEAD; 210235327 only changes project.json. `apps/ethlete-studio/src/styles/sdk-token-map.css`
gives every `.et-button` line-height 1.5 at `--text-md` (13 px) = 19.5 px; Noto fills 18 px and Chromium puts the 1.5 px
spare below the text (pixel probe 8.75 above, 10 below). xs the same (17.25 px). A fix inside the chip trips
CONTROL-STATE and CANONICAL-CLASS; `--et-button-line-height` is `inherits: false`. Decided by the doc agent (applies ADR
0262: the hit is fixed in CSS; the cause sits in the Studio token map): whole-pixel `--text-*-line` line heights with
padding that keeps the heights, then compare --affected and new records. Why not caught: the B490 slice ran no rendered
check on a part that embeds zoom-chip, only static lint and two shots. Tool fix (builder default): a change to a global
style or font file counts as embedded by every part for the slice-end check.

Moved from design-to-code.md line 3629: 908 update (0db51f57b): Cause (measured, Chromium): the doc agent's no-fallback variant wa

908 update (0db51f57b): Cause (measured, Chromium): the doc agent's no-fallback variant was wrong; an unset `var()` with
no fallback becomes `unset` and the author rule beats the UA sheet, so `<button>` inherited 2px/uppercase. Built: no
`@property`, `var(--et-button-letter-spacing, revert-layer)` (same for text-transform). Measured before = after on
`<a>` (inherited) and `<button>` (normal/none); token on host and on an ancestor applies. Open: WebKit and Firefox probe
before the push. Lesson: the doc agent sent a CSS mechanism it had not measured; send the intent and the probe, not an
unmeasured mechanism.
908: revert-layer fallback measured equal in Chromium 156, Firefox 157, WebKit 27.2 (Playwright builds); older iOS Safari not tested.

Moved from design-to-code.md line 3654: 903 update 2 (Linux, slice stopped, nothing committed): --et-button-line-height is an @

903 update 2 (Linux, slice stopped, nothing committed): `--et-button-line-height` is an `@property` number, so a length
falls back to 1.5; the working fix sets `line-height: var(--text-md-line)` (xs `--text-sm-line`) on `.et-button` in
sdk-token-map.css plus padding. Measured: md 28 -> 28, xs 24 -> 24, xs with the kbd chip (title-search) 25.25 -> 26.5;
zoom-chip OFF-CENTRE 28 -> 0; pages/sketches 38 -> 1 (new: title-search text 1.3 px low). The visible-change gate refused
pages/sketches: states `sketch-only-points-open` and `edit-sketch` draw an overlay pane the app no longer opens, and the
look `[&_[data-camera-reset]_button]:font-ui-strong` matches nothing. Decided by the doc agent (applies ADR 0262 and
ADR 0209): the kbd chip in xs buttons sizes to the 16 px line; the two stale sketch states are fixed as a direct edit
naming ADR 0262 + 903; then the gate re-runs.

Moved from design-to-code.md line 3663: 912 update (Linux, c35380b93): the archive tool now moves an old orphan finding when it ha

912 update (Linux, c35380b93): the archive tool now moves an old orphan finding when it has a built line or an entry in
the STATUS.md tool backlog paragraph, and prints why each old finding stays. Dry-run on the real plan: moves 0 (34 old
orphans have no built line and no backlog entry, 23 are open in STATUS, 4 are named in STATUS outside a row). The doc
agent classifies the 34 and adds built lines or backlog entries.

Moved from design-to-code.md line 3695: 916 update (Linux): built in 516b5b8be (skips text under clip-path: inset(50%), a zero c

916 update (Linux): built in 516b5b8be (skips text under `clip-path: inset(50%)`, a zero clip, or overflow hidden on a
box of 1 px or less; bite: spec part components/visually-hidden at scale 0.2). OFF-CENTRE pages/sketches 38 -> 0,
zoom-chip 28 -> 0.

Moved from design-to-code.md line 3704: 924 update (Linux): Cause (measured): the visible-change shots of pages/sketches are not d

924 update (Linux): Cause (measured): the visible-change shots of pages/sketches are not deterministic; neither the patch
nor a commit in the range moves page-sketch. Two runs of the same code at 238235493: page-sketch 5744 vs 54552,
paused-reason 49443 vs 2573. At six bases (238235493 to 84c3f4926) the base app is 54552 each time, HEAD + patch 52852,
verdict PASS 6/6. What flips: the variant notes in the title-bar sketch header break at different words, and one more
line moves the rows about 16 px. Suspect (not traced): the note column width settles late (fonts, model chip load, or a
fit-zoom race in `design-parts/sketches`). Lesson: the gate judged one shot of a layout that had not settled. Tool fix
(builder default, tool backlog): shoot each state twice or after layout is stable, and report a state with two
different shots as unsettled, not judged.
924 closed (Linux builder, 2026-11-13, B500): no fix; the visible-change gate that shot pages/sketches is removed
(`check --visible-change` gone, its slow rule gone in 17375e4f3). See B500 check --visible-change as built.

Moved from design-to-code.md line 3715: 911 update (Mac): design copy built in e1557311c (sketch merge, variant a, agent accept ci

911 update (Mac): design copy built in e1557311c (sketch merge, variant a, agent accept citing the doc agent's option A:
the existing no-real-name rule applied to the design copy of the same sample) + 08c6de8a3 (checker). The sketch also
covered components/comment-pin (9 hits in its shared file). Compare: only author text, initials and the pin glyph
changed, no layout shift. Checker: zero names under `.ethlete/design/<product>/{foundations,components,elements,pages,sketches}/`;
34 other files under `.ethlete/design/` stay baselined (31 comment records, capabilities.json, a call, a stale
sketch-data entry). Bite: the new case fails on the old checker.

Moved from design-to-code.md line 3722: 903 update 3 (Linux, not committed): compare --affected against a HEAD baseline shows page

903 update 3 (Linux, not committed): compare --affected against a HEAD baseline shows pages/sketches idle, paused and
paused-reason DIFF 2778 -> 49443, also without the token-map change; the variant-a note wraps 4 or 5 lines. Suspect: the
924 note-wrap flake (49443 is the exact flaky paused-reason value there); the builder repeats idle 4x with and without
the patch. edit-sketch FAILED on HEAD already (the zoom-chip look targets a missing element). The builder splits 903 into
two commits (finding 926).

Moved from design-to-code.md line 3728: 903 update 4 (Linux, not committed): the patch causes the pages/sketches idle DIFF; not th

903 update 4 (Linux, not committed): the patch causes the pages/sketches idle DIFF; not the 924 flake. Repeat: HEAD 2778
x4, patch 49443 x4. Cause (measured, bisect): each of the two app files alone moves it (`sdk-token-map.css` button
line-height, `title-search.component.ts` kbd leading); design files do not. The app's variant columns get about 5 px
wider and the rows move up 16 px; the design picture stays. Suspect (not checked): the shorter app page loses a vertical
scrollbar that the design frame keeps. Decided by the doc agent (applies ADR 0209 and the 903 decision; no look choice):
the design side gets the same button metrics as the app, from one source, then compare re-runs (finding 930).

Moved from design-to-code.md line 3760: 930 update (Linux, withdrawn): the 930 Cause was wrong. Measured (Playwright on the app ha

930 update (Linux, withdrawn): the 930 Cause was wrong. Measured (Playwright on the app harness and the design
`frame.html`): one source holds already (`.ethlete/design/studio/styles.css` imports `apps/ethlete-studio/src/styles.css`,
which imports `sdk-token-map.css`; kbd line-height 14 px on both sides). The scrollbar Suspect is ruled out too. 930 has
no tool fix; the 903 DIFF Cause is below. Lesson (doc agent): it wrote "Cause" for its own inference from a bisect; an
inference stays "Suspect" until a measurement names the mechanism.

Moved from design-to-code.md line 3766: 903 update 5 / 924 update 2 (Linux): Cause (measured): a font-load race in the pages/sketc

903 update 5 / 924 update 2 (Linux): Cause (measured): a font-load race in the pages/sketches matrix fit. The fit measures
the state-label gutter (font-code labels). The design `mountFit` (`pages/sketches/shared/sketch-rows.ts`) fits once while
Noto Sans Mono still loads (gutter 141.6 px, frames 205.6 px) and never refits; the app
(`design-parts/sketches/sketches.component.ts`) refits after the font on an Angular re-render (gutter 138, frames 206.5),
so the columns are 5 px wider and the rows move 16 px. HEAD matched only because neither side refit. Likely also the 924
flake. Trial `void document.fonts.ready.then(fit)` in mountFit: idle, paused, paused-reason 2785 (HEAD idle 2778). Fix
(builder default, direct edit naming 903 + 924): both fits re-run on `document.fonts.ready`; then 903 lands as commit A
(title-search + token map) and commit B (pages/sketches @edit merge). Tool fix (builder default, tool backlog, with 924):
the check shoots after `document.fonts.ready` and flags a layout that changes after the fonts load.

Moved from design-to-code.md line 3776: 903 update 6 (Linux): built in c538efb84 (shared button metrics, title-search design + app

903 update 6 (Linux): built in c538efb84 (shared button metrics, title-search design + app, the app sketches fit refits
on `document.fonts.ready`), 1c0421859 (pages/sketches@edit merge, direct edit by ADR 0262 + 903 + 924) and cc0a514d1
(changeset). Measured: pages/sketches idle, paused and paused-reason 2785 (HEAD 2778); page-sketch 52852 -> 2785;
OFF-CENTRE 0 on title-search, zoom-chip and pages/sketches (was 38); xs + kbd 24 px. Not verified: a live shot of the
app's pages/sketches (asked for).

Moved from design-to-code.md line 3850: 900 update (Linux, HEAD 77b0cc55c): the 120 s timeouts did not reproduce in 3 runs (128+12

900 update (Linux, HEAD 77b0cc55c): the 120 s timeouts did not reproduce in 3 runs (128+129 on 2 workers, 128 alone,
128+129 with hold 14000). Case 128 now fails every run with "part opened after each merge:
sketch:components/zoom-chip@edit, ...". Suspect (code read): a race from the unpushed 487e24844: the merge removes the
sketch folder, the listing drops the sketch before `mergeSketch$` answers, SketchViewComponent is destroyed, and
`takeUntilDestroyed` swallows `mergeComplete.emit` (`sketch-view.component.ts` ~787), so `leaveGone()` never runs. Fix
(Linux, push blocker): Studio opens the part when a picked sketch leaves the listing after a merge; 128 is the bite.
Timeout diagnostics at `canvas.e2e.mjs:772` (785facf09) name the cause next time.

Moved from design-to-code.md line 3858: 900 update 2 (Linux, 37841f237): the 128 race is fixed. Cause (bite): the listing drops th

900 update 2 (Linux, 37841f237): the 128 race is fixed. Cause (bite): the listing drops the merged edit sketch before
`mergeSketch$` answers, so the merge answer is lost with the destroyed child. Fix: system-view owns the end of the merge
(an effect calls `leaveGone()` when the merging sketch leaves the listing while it is still picked). The spec fails
without the fix; 128 alone, 128+129, and 128+129 with hold 14000 pass. Not verified: the full suite. Each e2e run leaves
one orphan resident (6 now, about 4.3 GB), so the 955 teardown part is a push-suite blocker; Linux builds it next.

Moved from design-to-code.md line 3930: 901 as built: the app body now uses var(--font-ui) (Noto Sans) and the canvas frame uses

901 as built: the app body now uses `var(--font-ui)` (Noto Sans) and the canvas frame uses `font-(--font-code)`; the `--font-sans` (Jost) and `--font-mono` (IBM Plex Mono) variables and the Google Fonts link in index.html are removed. Commit: see `git log` for "Render the app text in the design fonts". Verified: related specs, lint, production build and the measured body font (see the commit report).

Moved from design-to-code.md line 3932: 901 tool fix as built: et design compare now reads the computed font-family of the app b

901 tool fix as built: `et design compare` now reads the computed font-family of the app body and of the harness
host (before the design's text ambient is set on it) and fails each state with "the app's body renders in X, but the
design's root font is Y" when the first family differs from the design frame root's. Cause (proven by the bite): the
harness host is drawn in the design frame root's text ambient, so the part never inherits the app's body font. Verified:
a new spec fails on the old code; with the body set to 'Jost' the studio `elements/shell-main` compare failed every
state with the new line, and passed the check after the revert (its pre-existing project-picker pixel diff stays). No
sdk part has an `implements` link, so the check has no sdk hits.

Moved from design-to-code.md line 3940: 911 as built: the inbox sample, its template pin and four specs under apps/ethlete-studio

911 as built: the inbox sample, its template pin and four specs under `apps/ethlete-studio/src` named a real person; they
now use "human" with the initials "H". `check-person-names` already scanned `apps/`, but the baseline let those files
pass, so it now ignores baseline entries for `apps/ethlete-studio/src/` and the entries were removed. A spec fails on the
old code. The design's inbox sample (`.ethlete/design/studio`) still draws the old name and initials; it is a design
file and was not touched.

Moved from design-to-code.md line 3946: 911 design as built: the design's sample author in components/comment-row, pages/inbox

911 design as built: the design's sample author in `components/comment-row`, `pages/inbox` and `components/comment-pin`
named a real person; it is now "human" with the initials "H", like the app samples. One sketch with the three targets,
merged as an agent accept on finding 911 option A (`e1557311c`); the shots showed only the author text, initials and pin
glyph changing (no layout shift). `check-person-names` now ignores baseline entries for design parts and sketches
(`.ethlete/design/<product>/{foundations,components,elements,pages,sketches}/`) and those entries were removed; comment
records, `capabilities.json` and old calls keep their baseline. A spec fails on the old checker. The three part checks
had 0 findings before and after.

Moved from design-to-code.md line 3954: 922 as built: SketchRow has withdrawn?: string (the agent's reason, empty when it gave

922 as built: `SketchRow` has `withdrawn?: string` (the agent's reason, empty when it gave none) and
`SketchesComponent` a `withdrawn` model (`'hidden' | 'shown'`, default `'hidden'`). With a withdrawn row the picker
line shows the SDK switch "Zurückgezogene (n)" in an `et-choice-field size="sm" color="brand"`; hidden rows leave the
list before the fold and the same-row grouping, as in the design's `visibleRows`. A shown withdrawn row reads "Vom Agent
zurückgezogen: …" (the `systemTree` labels) in place of "Übernehmen", drops its pin and dims its stage to 60 %.
`sketch-view` fills `withdrawn` from `rejectionOf(...).status === 'withdrawn'` and binds `[(withdrawn)]`; the harness
sample marks variant b of the narrow sample with the design's reason. The two stale `withdrawn-*` DROPPED-PROP entries
left `rule-baseline.json`. Verified: the spec fails without the change and passes with it; compare turns
`withdrawn-hidden`/`withdrawn-shown` from FAILED (dropped prop) to DIFF 84596/88947 px; the shot shows the switch, mark
and dimming as drawn, the rest is the fold of the `fit-*` states that `narrow-part` (84885 px) has too. `design check`
for pages/sketches lists 4 DROPPED-PROP findings (points, screen) that HEAD has too; pages/flows has 0. Not verified:
a live shot of the Studio app with a real withdrawn variant, and no spec covers the `sketch-view` mapping.

Moved from design-to-code.md line 3976: 925 as built: Cause (verified): pre-push-checks.mjs ran yarn lint:person-names, which

925 as built: Cause (verified): `pre-push-checks.mjs` ran `yarn lint:person-names`, which lists `git ls-files` and
reads the working tree, so another session's uncommitted file refused a push of clean commits. The pre-push call is now
`check-person-names.mjs --range <base> <head>`: it checks the files `git diff --name-only <base> <head>` changed and
reads each one, and the baseline, with `git show <head>:<path>`, as `.husky/format-check-committed.mjs` does. Plain
`yarn lint:person-names` still reads the tree, `--staged` the index. Spec: `check-person-names.spec.mjs` (uncommitted
hit over a clean range passes, committed hit fails) and `lint-changesets.spec.mjs` (the pre-push wiring); both failed
before the fix. A 20-commit range takes about 3.5 s. Follow-up: the first wiring called
`node tools/scripts/check-person-names.mjs` relative to the cwd, and the push-suite checks fixture has no such file, so
`push-suite.spec.mjs` failed. `pre-push-checks.mjs` resolves the script from its own directory now; the yarn script is
no way out, since the fixture stubs it as `node -e 0`, which rejects `--range`. `yarn test:tools` would have caught it, and is the per-slice check for a change in `tools/scripts`.

Moved from design-to-code.md line 3987: 929 as built: yarn studio:e2e --load <n> starts n busy loops once the run holds the heav

929 as built: `yarn studio:e2e --load <n>` starts n busy loops once the run holds the heavy run lock, through
`startRunLoad` in `apps/ethlete-studio/e2e/run-load.mjs`, which calls `startBusyLoops` from
`tools/scripts/ci-like-load.mjs` unpinned. Each loop ends once its parent is gone, and the lead also kills them on
`exit`, so a failed, interrupted or killed run leaks none (`ps` showed 0 after every run). An invalid value exits 2;
failure lines and the start line name the busy loops, and the 90 s goal line is skipped under load. Spec:
`run-load.spec.mjs` (arg parsing, refusal, and the loops ending on stop, `process.exit(1)`, SIGINT and SIGKILL); with a
plain `for(;;)` loop the SIGINT and SIGKILL cases fail, and without the exit hook the exit case fails too. Picture cases:
"a sketch cell edited on disk while scrolled away shows its new picture on return" waited one 10 s window for a new
URL and a drawn picture; it now waits 10 s for the URL and 60 s for the drawing, and reports both times. Cause (probe):
under `--load 24` its new URL came at 21.2 s and the drawing 47 ms later; under `--load 12` at 5.4 s and 5 ms later. So
this case fails under heavy load on the URL stage, not the draw, and the split names that stage; whether the URL budget
should grow is open. Checked and left, no shared new-and-drawn window: "a part shown before paints every stored picture
in the first frame", "a sketch scroll never empties a cell that had a picture", "a sketch keeps its frame count and
pictures through a sketch edit" (a fixed watch window), "page switch time is logged to the design timings" (records
mounted, first and all painted separately), "the sketch view at 30 % and 100 % draws no failed picture ...".

Moved from design-to-code.md line 4003: 904 as built: write-build-info.mts stamps commit (git rev-parse HEAD) into build-in

904 as built: `write-build-info.mts` stamps `commit` (`git rev-parse HEAD`) into `build-info.json`; the copies
`yarn et:design` runs from `tmp/studio-cli/<sha>` already carried it as `pinned-commit`. `runningCliStaleWarning` in
`libs/cli/src/lib/design/stale-cli-dist.ts` now reads that commit and runs one `git diff --quiet <commit>` over the
built paths of `libs/cli` (specs and `.md` excluded); a change prints one stderr line naming the commit. A build made
from uncommitted sources stays silent while its `sourceHash` still matches them. Silent under `node_modules`, for an
unknown commit and outside git. Cause of the miss (probe): the B191 check (2086f4cda) returned null unless the CLI ran
from `dist/libs/cli`, and `yarn et:design` runs a copy under `tmp/studio-cli/`; `runningCliStaleWarning()` loaded
from the 448c47f16 copy returned null. Spec: `build-commit.spec.ts` (temp git repo); it also caught the build dir's own
`src` being taken for the source root.

Moved from design-to-code.md line 4013: 963 as built: push:suite already held the heavy run lock (tools/scripts/heavy-run-lock.mj

963 as built: push:suite already held the heavy run lock (`tools/scripts/heavy-run-lock.mjs`, `$TMPDIR/ethlete-heavy-run.lock`,
`{ pid, name, started }`) from before its checks until its verdict, so over studio:e2e and the repeat runs; its
children inherit `ETHLETE_HEAVY_RUN_HELD` and take none. A dead holder's lock is taken over, and a signal before the
export leaves only such a stale file. studio:e2e, spec:stress and ci-like-load took it already. New:
`waitForNoHeavyRun` waits without taking the lock, and `tools/scripts/heavy-gate.mjs <name> [--no-wait] -- <cmd>`
wraps `yarn test:tools`, `yarn test:e2e-helpers` and the nx build of `yarn verify:webkit-studio`. It prints one
`<name>: waiting for push-suite (pid N, since T)` line and runs the command when the holder ends or dies; with
`--no-wait` (or `ETHLETE_HEAVY_NO_WAIT=1`), or after 60 min, it prints one line and exits 2. Default wait, as
studio:e2e and spec:stress do: the slice's check runs late instead of failing into a retry loop. Spec:
`heavy-gate.spec.mjs`; with the holder check removed the refuse, wait and limit cases fail, without the held-env check
the owner case fails. Still unchecked: `npx nx ...`, `npx vitest ...`, `node --test <file>` and `yarn design` (its
`nx build cli`). Suggestion: an Nx `preTasksExecution` hook in a local plugin in `nx.json` that calls
`waitForNoHeavyRun`; Suspect: under the Nx daemon the hook runs in the daemon process, so it would not see the
caller's `ETHLETE_HEAVY_RUN_HELD` and would block push:suite's own builds unless they run with `NX_DAEMON=false`
(push:suite sets that).

Moved from design-to-code.md line 4029: 926 as built: Cause: the merge checks in a clean copy of HEAD plus the sketch and, for an

926 as built: Cause: the merge checks in a clean copy of HEAD plus the sketch and, for an @edit sketch, its own part
folder. A part the edit embeds (here `title-search`) with an uncommitted change stays at HEAD in the copy, so its hash
misses the baseline the sketch recorded from the checkout, and `sketch rebase` records the same checkout state again.
Choice: the refusal names the commit order, not a clean copy that takes the other changed parts, because a merge must
not pass on content its commit will not hold (ADR 0206). `merge.ts` `commitOrderRefusalOf`: each conflicting part
whose checkout state still holds the baseline hash is named as "holds uncommitted changes that <sketch> was drawn on
... commit <parts> first, then merge <sketch>"; a part that really changed keeps the rebase advice. Spec:
`edit-sketch.spec.ts` (an embedded `components/button` with an uncommitted change: refused with the commit order,
merges after the commit); before the fix it got the rebase advice.

Moved from design-to-code.md line 4039: 973 as built: tools/scripts/nx-heavy-wait.mjs is a local Nx plugin in nx.json whose p

973 as built: `tools/scripts/nx-heavy-wait.mjs` is a local Nx plugin in `nx.json` whose `preTasksExecution` calls
`waitForNoHeavyRun('nx')`, so a direct `npx nx ...` waits while push:suite or studio:e2e holds the heavy run lock. Probe
(Nx 24.0.2, `cli:lint` in a scratch copy): Cause: with the daemon off the hook runs in a plugin worker the CLI spawns,
sees the caller's `ETHLETE_HEAVY_RUN_HELD`, and its stderr reaches the caller. Cause: with the daemon on it runs in a
worker under the daemon that gets the caller's env per call (held `222`, `333`, then unset, each seen), but its stderr
goes to the daemon log, and Nx does not forward `TMPDIR`: the daemon's `os.tmpdir()` is `/tmp`, the callers' lock is in
the macOS per-user temp dir, so the first daemon-on refusal check ran the task. `lockFileOf` reads that dir with
`getconf DARWIN_USER_TEMP_DIR` when `TMPDIR` is unset; after it the daemon-on check refuses too. Cause: the worker
cannot exit the CLI with 2 (`process.exit(2)` reads "Plugin worker exited unexpectedly", exit 1), so the hook throws the
heavy-gate line instead: one `NX nx: heavy run lock held by ...; run again after it ends` line, exit 1. Cause: Nx fails
an isolated plugin call after 10 min, so the hook waits at most 9 min, then refuses. A lock-holder child, no lock or a
dead holder return at once; `ETHLETE_HEAVY_NO_WAIT=1` refuses at once. Exempt with `ETHLETE_HEAVY_EXEMPT=design`: `yarn
design`, `yarn design:check` and the cli/app builds of `studio-code.mjs` (et:design, studio app serve). Added time on a
cached no-lock `cli:lint`: about 450 ms daemon off (1.83 s to 2.28 s), 200-900 ms daemon on, nearly all of it the worker
start. Spec: `nx-heavy-wait.spec.mjs`; without the exempt check, the env handoff, the holder check or the no-wait flag,
or with `lockFileOf` ignoring the daemon case, a case fails. Suspect: two daemon callers at once share the worker's env,
so one may see the other's held or exempt flag.

Moved from design-to-code.md line 4057: ### As built: 982

### As built: 982

`lockFileOf` moved into `heavy-run-lock.mjs`; env `ETHLETE_HEAVY_LOCK_FILE` wins over the TMPDIR/darwin logic, and
every lock taker and waiter resolves through it. `takeHeavyLock` throws when `NODE_TEST_CONTEXT` is set and no file
option or env override is given. The lock specs, the spec-stress `--github` case and the push:suite checks case now
pass a private lock file (the last two took the real lock before). Verified: the guard spec fails with the guard off
(the child prints `took`); `yarn test:tools` 424/425, the one failure an e2e-check timing case that passes alone; the
real lock file was absent before and after. Not verified: a live `push:suite` or Nx daemon run with the moved resolver.

### As built: 976

Each sketch merge refusal that names a remedy has a spec that applies the remedy and then merges:
`merge-remedies.spec.ts` (not ready; no pick; rejected pick - reopen; no baseline - rebase; changed part - port and
rebase; uncommitted drawn-on part - commit; uncommitted edits in the way - revert, or commit then rebase; product not
in the committed config.json - commit it; another part imports @shared/ - move the code in; the three `mergeStepOf`
refusals), `merge-shared.spec.ts` (orphan shared/ file - delete it; target's own shared/ folder - rename it),
`design-lint.spec.ts` (new lint warnings - fix them). Through the API, rejecting the picked variant drops the pick, so
the "rejected - reopen it first" refusal only meets a sketch file that holds both; the spec builds that state.

Cause (bite in `sketch-base-stale-remedy.spec.ts`): a sketch drawn while its own part had an uncommitted change
records a baseline no commit holds; SKETCH-BASE-STALE names `sketch rebase`, `portBaseChanges` refuses "no commit holds
the state the baseline recorded, port it by hand", and the refusal said "then run sketch rebase again", so following it
ran the same rebase three times with the same refusal. Only `--ported` clears it. The refusal now names the full
`sketch rebase <target> --ported --product <name> --by <model id>` command; the spec follows the printed remedies, clears
SKETCH-BASE-STALE, and merges after the part is committed. Not verified: the "built-in base - --override" refusal has
no spec (the fixture has no built-in base).

### As built: 977

Cause: a refused `merge --allowed-by` kept its agent pick in `sketch.json`; a later `--variant b` merged the stale `a`.
Now a refused allowed merge and the `mergeStepOf` pre-check restore the sketch, and a pick by a model id counts as no
pick. Verified: three biting specs, related specs, lint, typecheck. Not verified: a live run; a non-model-id `--by`.

998\. Linux builder (2026-11-12, push round): CI on origin/next red (run 43190178268): timetrack-app:audit-rust fails on
RUSTSEC-2026-0502 (sqlcipher-src 419.0.6, advisory of 2026-10-30); fix rusqlite 0.41 -> 0.42 goes into the push round.
Second occurrence of 655: 655 (2) built a scheduled `rust-audit.yml` on 2026-11-11, and still nothing warned before the
push. Suspect: the scheduled run did not run, failed unseen, or `et design status` does not read it. Blocking (CI red),
so numbered. Tool fix (Linux, after the push): find which of the three, and make a red scheduled audit show in
`et design status` like a red push run.
