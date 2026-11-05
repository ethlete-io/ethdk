# Builder handoff (2026-11-05, builder ethlete-sdk-0d)

Grill/docs session: ethlete-sdk-ea. SDK migration session: ethlete-sdk-ff (commits on next, does not push).

## Done this session

- CI run 41924354824 fixes: f30bb3b81 + c8d05a4a0 (machine id per OS; tested twice on ethlete-mac), b770d4222 (motion-shot fixture), 4de41ac2e + 6915b243e (Studio rules builds cli,components and runs `design check --rules`, ADR 0195).
- 40a92b60b revert of the SDK tooltip swap (ADR 0194). B372 8f059ae72. B373 9d788d831. B377 221073493 (not pushed).
- Pushed 5524606cf..8fe0309a0. CI run 42016914765: Component behavior tests shards 2/3 and 3/3 failed; logs only after the run ends (`gh run view --job <id> --log-failed`). Watch log: /tmp/b372/ci-watch.log.

## Next

1. CI 42016914765 red: behavior shards fixed in aff13b991 (scheduler locators back to [title], after the revert missed 80d8d2b8c). Studio rules --slow fails on pages/system direct-edit: the app has no build-ready footer ("Gründe"), open row B288; not caused by B372. Asked the grill session: build the B288 footer now (recommended) or accept red; and whether to push aff13b991 + 221073493 now. Act on the answer.
2. Queue: B388 -> B391 -> B392 -> B393 -> B394 -> B369 -> rest per the STATUS.md order line.

# Builder handoff (moved from .claude/handoffs, 2026-11-04 evening)

Uncommitted work (B321 stacking fix, verify-webkit-studio.*, verify-studio-headless.mjs refactor, B323 code notice) is on branch `wip/b321-stacking-fix`, one commit on top of next. Do not merge it as is: split it into the slices below.

## Done since the handoff below

- 12cddcbe3 pages/start pick, 4e53b553f lint fix, 2bad713a6 B328, 421d2fee8 + 3decc21bb + 317bef97a B330, f294ac49b + 2dbee7cc4 B322/B318, 296429625 B325, d2eaac782 + 2a1a52628 B324 (B329 part).
- Open: B329 rest, B331, B323 rest, B333 (finding numbers renumbered by prettier - urgent), B332 (import check rule), proof run `yarn design:check --product studio`, B326, B327.

## Original handoff

## Builder handoff (2026-11-04 evening, builder session ethlete-sdk-d0)

Grill/docs session: ethlete-sdk-e4 (resumed fresh; it relays to Tom) (send it messages; it relays to Tom). Plan: `plans/ethlete-studio/build-ready.md`
("As built: B318, B319, B320" holds this afternoon's state). Branch next, nothing pushed.

### Done this session (commits)

- B318 4c1667672 cli-copy plan. B319 a148d713e + 7581b65e1. B320 598973423 budget spec, 52d23cfc2 + 996b339ef
  German blocker texts, 16a3d8214 spec fix. 9ecade036 as-built notes.
- Server probe: `quick=1` is no parameter; the quick listing is `&unchanged=no` (0.17 s). Event loop free; the full
  listing waits on picture draws in `targetsOf`.

### State of the earlier work

- B317 rest DONE: 8577d87ae (abort on closed request), f1307c562 (quick listing carries targets). Live after "Neu starten".
- Tom's "sketch view shows nothing": full listing measured 33 s on a148d713e (not the cause). Waiting for sketch
  name + screenshot from the grill session after Neu starten + Cmd+R (dev server watches; reload is enough).
- CI triage DONE and reported: 4 of 5 failures already fixed (62c79da3b, 99905988b, 45f505995, 4d78306ab probably -
  next CI run confirms). New ae388f531: the `yarn commit` gate ran NO vitest spec on this Mac (tmpdir symlink); now
  realpath. Open: eslint `no-control-regex` on the ANSI regex in tools/scripts/precommit-specs.mjs (from 62c79da3b).
- No agent runs. Nothing pushed; push + CI triage after the queue items below (or when the grill session asks).
- B319 follow-up DONE: 1cf06ce2d. Open undecided @edit sketches get re-checked (draw `old`, close as HELD when equal);
  baselines compare the part hash (`partHashOf`) on both sides; `record` stores `partHash`; `go` is never a baseline.
  PROOF still owed (quiet machine only, it builds the CLI): `yarn design:check --product studio` -> expect `HELD studio
pages/{flows,merge,start}` and the folders `.ethlete/design/studio/sketches/pages-{flows,merge,start}.edit` gone.
  Checked: no uncommitted diff in those parts' shared/ (flows/shared last changed in 5bec01b89, the TLA fix).
- 378 (no "Neu starten" while the server runs): answered - kill is safe, every host start runs cli-copy, which builds
  the latest commit; studio-view.component.ts:301/334 auto-start on "not listening". Tool fix queued: render the
  title-bar code notice now as interim "needs approval" + open its sketch.
- pages/flows@edit showed only "Variante new", no frame (on the a148d713e server): not diagnosed; re-check on the new
  server first.
- 376: b7ce45cb3 pre-push label check (covers rewording only); `vitest related` goes into every agent brief.

### B321 pixel check - Tom runs it late tonight / tomorrow. Do NOT commit the stacking fix before the run.

- Fix uncommitted: `apps/ethlete-studio/src/app/design-parts/shell-main/shell-main.component.{html,spec.ts}`.
  Patch copies: /tmp/b321-shell-stacking-fix.patch and `.claude/handoffs/b321-shell-stacking-fix.patch`.
- Check uncommitted: `tools/scripts/verify-webkit-studio.{swift,mjs}` (`paint` mode), details in
  `.claude/handoffs/agent-results/webkit-soak.md` "Paint check (B321)". Needs Screen Recording for the terminal
  app (restart it after the grant); window 1440x900 top left, ~1.5 min, nothing may cover it.
- Commands (repo root, `export NX_NO_CLOUD=true`):
  1. `git worktree add --detach /tmp/b321-head HEAD && ln -s $PWD/node_modules /tmp/b321-head/node_modules`
     (HEAD has no fix, because the fix is uncommitted).
  2. `(cd /tmp/b321-head && npx nx build ethlete-studio --outputPath=/tmp/webkit-studio/b321-head --excludeTaskDependencies --skip-nx-cache)`
  3. `node tools/scripts/verify-webkit-studio.mjs --built /tmp/webkit-studio/b321-head --checks paint --png-dir /tmp/webkit-studio/shots-head` -> must FAIL (if it passes, raise `--paint-hangs` before calling the check blind).
  4. `(cd /tmp/b321-head && git apply /tmp/b321-shell-stacking-fix.patch && npx nx build ethlete-studio --outputPath=/tmp/webkit-studio/b321-fix --excludeTaskDependencies --skip-nx-cache)`
  5. `node tools/scripts/verify-webkit-studio.mjs --built /tmp/webkit-studio/b321-fix --checks paint --png-dir /tmp/webkit-studio/shots-fix` -> must PASS.
  6. `git worktree remove --force /tmp/b321-head`. Then commit the fix (+ `ethlete-studio` patch changeset) and the
     check. `verify-studio-headless.mjs` refactor still needs one Chromium e2e run before its commit.

### Uncommitted: Tom's pick of pages/start@edit (15:48, decidedBy user, variant new)

- `.ethlete/design/studio/merged.json`, `pages/start/start.ts`, deleted `sketches/pages-start.edit/`. Commit it as
  Tom's pick, but first remove 'design check' from `madeBy` in start.ts (accepted-pictures.ts:307 opens edit sketches
  with that author; the merge copied it). Finding 382 / B327.

### Queue after that - accepted order: lint fix FIRST (eslint no-control-regex on the ANSI regex in

tools/scripts/precommit-specs.mjs breaks CI), then B324 + B329 TOGETHER (same root: the slow full listing gates the view) -> B325 -> B326 -> B322 -> B323 -> B327 -> B328.
Proof run waits for B325.

- B329 / finding 384 (high priority, d2adf9c5a): opening pages/sketches froze Studio - 3 variants x 25 states = 75
  live 1440 frames, each a full Studio page; WebContent 2.6 GB. Only the 3 `agent-*` states changed, but the fold of
  unchanged states needs the full listing (>90 s), so all frames load first. Fix: live frames only near the viewport
  with a cap (rest = stored pictures/placeholders); fold unchanged states from the quick path before any frame loads;
  `sketch check` warns when variants x states x widths passes a budget; headless test with a 75-frame sketch.
  pages/system@pages-system-build-ready freezes the same way (3 x 26 = 78 frames). Tom can judge NO open sketch
  until B329 lands. Pending decision from Tom (via the grill session): round focus = show only the states a round
  is about.
- B327 / finding 382: an edit sketch whose variants draw the same pictures merges itself as HELD; a tool author
  never goes into madeBy; Studio commits its merges.
- B328 / finding 383: a gate that runs 0 specs must fail; a lib-build gate; lint of tools/scripts at commit.
  A. B324 / finding 379: the Sketches group in the part tree still shows late. Quick listing 0.03 s, full listing >90 s
  (load avg 32). Find why the tree waits (full-listing gate? quick listing not wired to the tree?), send the cause,
  fix: tree from the quick listing only + a spec with a never-answering full listing.
  B. B325 / finding 380: pages/flows@edit `old` fails `Importing binding name 'emptyCanvas' is not found` (stale old/
  from 13:53 vs shared/ renamed to `emptyCanvasOf` in 5bec01b89). 1cf06ce2d re-check draws the STORED old/, so this
  sketch can never close -> re-check must draw HEAD fresh; a render error in an edit sketch's old = check problem,
  not a silent frame. Also "Vergleich fehlgeschlagen: Load failed" on both variants, English notes ("the edit made
  outside a sketch", "the design at HEAD") -> German. Spec: stale old/ vs renamed shared/ export. Then the proof run.
  C. B326 / finding 381: on macOS the iframes eat the two-finger trackpad pan of the canvas. Fix: no wheel input to
  frames during a canvas pan (shield or wheel forwarding) + a test that pans with the pointer over a frame. A visible
  choice (e.g. frame interaction only after a click) goes to Tom as a sketch with variants, not as a question.
  D. B322 / finding 377 ( one opus agent, ~1-2 h): the Studio frontend dev server serves the working tree,
  so Cmd+R brings uncommitted agent edits into Tom's Studio. Build `app-copy` in tools/scripts/studio-code.mjs like
  cli-copy (worktree at last apps/ethlete-studio commit, `nx build ethlete-studio` into tmp/studio-app/<sha>/ +
  pinned-commit, static server on the Tauri devUrl port instead of `nx serve`), switched by the "Neu starten" click
  (one click for both copies unless the grill session says otherwise). Node spec with a temp repo: an uncommitted
  app edit never reaches the served files. Touches the Tauri host start path (studio_code.rs / dev start script).
  E. B323 / finding 378: no restart path while the server runs. Render the title-bar code notice now with its built
  variant as interim, marked "needs approval", and open its sketch (same flow as finding 368).

1. Sketches for Tom: title-bar code notice, `pages/sketches@error`, German stop text + recovery action (369),
   German direct-edit labels + "variant draws no states" (373), "N Übergänge ohne Motion" folding (374).
   `yarn et:design sketch new <part> --name <name> --variants a,b,c`.
2. B318 open: a clean tree without dist/libs/cli plans `copy` and copyDist throws (fix with next studio-code.mjs slice).
3. TLA visual compare; old queue in build-ready.md "In progress" (B309 rest, B308, S4, S6b, S8); `nx test cli` once
   on a quiet machine, push, triage CI. Old worktrees /tmp/webkit-tla-wt, /tmp/webkit-revert-wt.

### Gotchas

- zsh: arrays for path lists; no `timeout` command. New files need `git add <file>` before `git commit -- <paths>`.
- Commit with `git commit -- <paths>` only. No CPU-heavy runs while Tom's server is slow.
- Agent briefs: a label change greps all specs for the old literal (finding 376).

## Agent result: b323

### B323 (finding 378) - result

Stopped at the coordinator's time limit.

#### Built

- `tools/scripts/studio-code.mjs`: `AREAS.frontend` is now `APP_SOURCES` (one list); `areaState` and `ensureAppCopy` both
  read it. Node spec `studio-code.spec.mjs` (+2 tests; the second fails on the old `apps/ethlete-studio/src` key).
- `code-watch.ts`: frontend notice action is `restartServer` (a window reload served the same app copy); `act()` quits for a
  host rebuild or emits `serverRestarts$`; `studio-view` restarts the design server on it (works while the server runs).
- New `components/code-notice` (text + "Neu starten" tonal xs button), rendered on the title bar's right side; spec with 5 cases.
- Label `code.frontend` is now "Oberfläche geändert - neu starten", new `code.restart` "Neu starten"; `code-watch.spec` updated
  (only spec asserting the old literal).
- Changeset `.changeset/studio-code-notice-restart.md`.

#### Not done (next steps)

1. Sketch: `yarn et:design sketch new components/title-bar --name code-notice --variants a,b,c --by <model> --product studio
--round "Code-Hinweis in der Titelleiste"`; draw the notice in a (built look: muted text + tonal brand xs "Neu starten"
   left of Update), b/c alternatives; `sketch ready`. Not created.
2. Mark the interim as "needs approval": an "As built: interim code notice (B323)" section in
   `plans/ethlete-studio/build-ready.md` and the STATUS.md row. Not done.
3. ADR: no ADR names `open: B323` - nothing to switch.
4. Not run: full `nx lint ethlete-studio` (eslint ran on the changed files), the design compare of components/title-bar,
   Studio itself. Rust unchanged, no cargo check needed.

## Agent result: b329

### B329: result (second agent, stopped at the coordinator's 8-minute limit)

#### Commits

- None by this agent. Earlier: d2eaac782 (cli), 2a1a52628 (ethlete-studio).
- Both already have changesets: `.changeset/cli-sketch-listing-tiers.md` (@ethlete/cli) and
  `.changeset/studio-sketch-tree-name-listing.md` (ethlete-studio). The new work still needs its own ethlete-studio changeset.
- No ADR under apps/ethlete-studio/docs/adr says `open: B329` or `open: B324` (grep found none). ADR 0132 is the one to update once the focus view ships.

#### Verified

- The working tree has no edits from this agent. The B323 files are untouched.
- Read for the plan: `signalElementIntersection` (libs/core/src/lib/signals/element-intersection.ts) accepts a
  `Signal<ElementRef[]>` such as `viewChildren('shotCell')`. When `rootMargin` is set and not zero, it waits for the
  observer's own first entry, so a spec has to stub `IntersectionObserver` and fire its callback. Use `entry.isIntersecting`, which honors rootMargin.
  `isVisible` ignores rootMargin.
- The shot template is rendered inside sketches.component.html at about line 397, in a scaled div sized `row.width x item.height`.

#### Not verified

- Nothing was run. No spec, lint or live check.

#### Remaining (exact steps)

1. Cap, in apps/ethlete-studio/src/app/system-view/sketch-view.component.ts:
   - In the `#shot` template, wrap the content in `<div #shotCell [attr.data-shot]="row.key + ' ' + state" class="size-full">`.
   - Add `near = signalElementIntersection(viewChildren<ElementRef<HTMLElement>>('shotCell'), { rootMargin: '400px' })`.
   - Add a pure export `liveShotsOf(order: string[], near: ReadonlySet<string>, cap = 6)`. It keeps the near keys in
     row order (from `sketchRows()`) up to the cap. Write a unit spec for it.
   - Live keys render the iframe. A near key past the cap renders `<img [src]="picture">`. Read `SketchRowShot.picture`
     through a map like `rowShots`, then sanitize, or bind as a plain URL. Any other cell renders a placeholder div.
   - Add an `(load)` handler on the img. It stores naturalHeight/naturalWidth per key in a signal. In the `rows` computed,
     set `height = sizeOf(state)?.height ?? (ratio ? ratio * width : MEASURING_HEIGHT)`.
2. Spec in sketch-view.component.spec.ts:
   - Build a sketch with 3 variants x 25 states.
   - Stub `IntersectionObserver` so it reports every observed cell as intersecting.
   - Assert that `iframe[data-state]` count <= 6 and that `img` fills the other near cells.
3. Focus view, in design-parts/sketches/sketches.component.{ts,html}:
   - A state folds only when every non-Current shown row has `changed === false`. A `null` (unknown) result never folds.
   - Read the fold data from the quick listing's `unchanged` field. Do not wait for the full listing.
   - Remove folded states from the matrix and the shots.
   - Show a count plus a toggle, kept as a `model` like `sameOpen`.
   - Show the open round's `note` as the question.
   - Labels "n unveränderte Zustände eingeklappt" / "Alle Zustände zeigen": studio-labels.ts carries B323's uncommitted edits,
     so put them in a separate file, e.g. design-parts/sketches/sketch-fold-labels.ts, or add them to
     STUDIO_LABELS.sketches after B323 lands.
   - Spec: changed, null and false states; the toggle shows all states.
4. A headless e2e with a 75-frame sketch that asserts `iframe[data-state]` <= 6. It is blocked: tools/scripts/verify-studio-headless.mjs
   has another slice's uncommitted work.
5. Write an ethlete-studio changeset for steps 1-3. Run `npx vitest related <files> --run`, `npx nx lint ethlete-studio --fix` and prettier.
   Then mark ADR 0132 as built if it carries an open marker.

## Agent result: b331

### B331 (finding 374/"386" in design-to-code.md, sketch row opens nothing)

Commits: none. Stopped at the coordinator's 8-minute limit during diagnosis; no file edited.

#### Verified (by reading code, not run)

- The wiring for a sketch row already exists in apps/ethlete-studio/src/app/system-view/system-view.component.ts:
  `sketch` computed (l.615) matches `sketchKeyOf(listed.target) === picked()`, `sketchShown` (l.619), `sketchPage`
  (l.939) renders `<ethlete-sketch-view>` with its own shell (l.317). So "opens the sketch view" is the existing way.
- The symptom (canvas empty + part actions Go/Kommentar/1 offen) is the `part()` branch: `part()` falls back to
  `pickedPartKeyOf(picked())` (l.739), which strips `sketch:` and shows the target part. That happens only when
  `sketch()` is null, i.e. the picked `sketch:<target>` is not in `sketches()`.
- Tree warning: `sketchEntryOf` in system-tree.ts (l.141) already sets `title` from `sketch.problems`, but the
  finding-380 failure (an `old` that fails to render) is in `sketch.targets[].error`, not in `problems` - so the
  'error' badge/title source and the warning shown may differ; check which field marks the row in the screenshot.

#### Not verified / remaining steps

1. Reproduce: find why `sketches()` lacks the clicked target. Suspects: `mergedSketches` filter (l.536-542, a
   target merged once stays filtered), `itemsOf(sketchRead(), product)` returning another product's list, or
   sketch-view guards (`port`/`product` null in `sketchShown`). Spec in system-view.component.spec.ts: pick
   `sketch:merge` with a listed sketch whose `targets[].error` is set -> expect `ethlete-sketch-view`, no
   `ethlete-open-points-chip`.
2. Warning reason: extend `sketchEntryOf` title with `targets[].error` text (and the error badge); spec in
   system-tree.spec.ts asserting `title` holds the reason.
3. Open-points entry: open-points.ts is part-scoped (`PartOpenPoints` from host/design-open-points); a sketch
   entry needs a new line kind or a sketch-level group - needs a label; studio-labels.ts is B323's, so add the
   label after B323 commits or via the coordinator.
4. Changeset for ethlete-studio (level none/patch), lint, prettier, `npx vitest related`.

#### Why no tool caught it

No spec clicks a sketch row in the System tree and asserts the sketch view renders; the fallback in `part()`
silently turns an unmatched `sketch:` key into its target part, so a miss looks like a valid part selection.
Tool fix: a system-view spec per tree group (part, sketch, flow, call) that picks the row and asserts the matching
page component; and make `part()` not fall back from a `sketch:` key once lists are read (render an explicit
"Sketch nicht gefunden" state instead), so a miss is visible.

## Agent result: webkit-soak

### webkit-soak: paused on user request (CPU contention with live Studio)

Nothing committed. Uncommitted, prettier-formatted:

- `tools/scripts/verify-webkit-studio.swift` (new): one off-screen WKWebView driver (borderless window at x -20000,
  occlusion/throttling SPIs off), modes `soak`, `edges`, `paint`, a 30 s no-message hang watchdog. Studio modes
  stub `__TAURI_INTERNALS__` with a `fetch('/__host')` bridge and seed `ethlete-studio.call-view`.
- `tools/scripts/verify-webkit-studio.mjs` (new): builds Studio to scratch (or `--built <dir>`), starts its own
  design server on a free `DE_PORT` (`--checkout <dir>` to serve another tree), serves Studio with a `/__host`
  endpoint, runs `--checks soak,edges,paint`. Flags: `--soak-batches` (600), `--paint-hangs` (24), `--png-dir`.
- `tools/scripts/verify-studio-headless.mjs`: exports `listen`, `serveStatic(dir, answer?)`, `startDesignServer`,
  and the host stub as `studioHostAnswer(command, checkout, designPort)` (withStudio uses it). Not re-run through a
  Chromium e2e yet - run one Studio e2e (e.g. `apps/ethlete-studio/e2e/sketches-tree.e2e.mjs`) before committing.
- Last in-flight edit (interrupted run, never measured): soak uses `...SOAK_FRAMES, ...SOAK_FRAMES` (12 frames) at a
  fixed 150 ms; the jittered 20-180 ms variant was also tried.

#### Check status

1. Soak (6 real Studio design frames: pages/start x2, system, sketches, merge, flows; mount/unmount churn, a
   checkpoint every 50 batches that must draw every frame within 20 s).
   - Current code: PASS (320 batches, and 600 with checkpoints).
   - Harness proof: against `/tmp/tla-repro/frame-timer.html` x6 it FAILs ("WebKit stopped responding for 30 s")
     before batch 100.
   - Fix-revert proof NOT achieved: the pre-fix design sources (worktree `/tmp/webkit-tla-wt` at 5bec01b89^, with
     `libs/cli/src` deleted there to get past the stale-CLI guard) failed 1 run of 5 ("last batch drew 0 of 6",
     320 batches) and passed the other 4 (600 batches, constant and jittered). The real top-level awaits
     (`await button.render(...)`) settle too fast to hit the hang window reliably. The repro hangs because
     `dep-timer.js` awaits a 100 ms timer.
   - Next: measure the 12-frame variant against the pre-fix tree. If it still passes, decide with the coordinator
     whether the revert proof can be "add a timer-backed top-level await to one design module", or whether the soak
     also churns a frame whose part awaits a shared dependency.
2. Edges (scroll every visible `overflow:auto|scroll` element under `ethlete-root`, plus the root, to each edge,
   then send continuous-phase CGEvent wheel gestures and fail on any change of scrollTop/Left, first-child offset or
   window scroll): written and typechecks, NEVER RUN. Open: whether synthetic `scrollWheel` reaches the off-screen
   view at the computed point, and whether WebKit exposes the rubber-band offset in the DOM. Fall back to a snapshot
   diff mid-gesture if it does not. Revert build ready: `/tmp/webkit-studio/no-overscroll` (worktree
   `/tmp/webkit-revert-wt`, styles.css rule reverted). Current build: `/tmp/webkit-studio/current`. Run with
   `--built /tmp/webkit-studio/<dir> --checks edges`.
3. Paint (B321 / finding 375): rewritten, see "Paint check" below. Typechecks, NEVER RUN.

#### Paint check (B321)

`paint` loads `sdk` / `components/textarea` with the explorer open, presses ArrowRight on the canvas (up to 40
times) until a frame covers at least 30 % of the explorer probe (the `<aside>` around `ethlete-part-tree`, inset
14 px past its rounded corners), captures a baseline and a settle shot, then runs `--paint-hangs` (24) hangs: 1-3
rounds of iframe clones 150 ms apart, then after 0-300 ms a 1.5-3 s busy loop on the Studio main thread. While each
loop runs it captures the window through ScreenCaptureKit (`SCScreenshotManager`, the window server's pixels, not
`takeSnapshot`) every ~150 ms and fails on any explorer pixel off by more than 16 in a channel. The failing capture
goes to `<png-dir>/explorer-changed.png` and its path is printed.

Needs: macOS 14+, the Screen Recording permission for the terminal app that runs it (System Settings > Privacy &
Security > Screen & System Audio Recording; restart the terminal after granting). Without it the check fails with
a message naming the permission. The 1440x900 window sits on screen at the main screen's top left, floating and
mouse-transparent, for about 1.5 min - do not cover it or change Spaces during the run.

Build from HEAD (no fix) - expect FAIL:

```bash
export NX_NO_CLOUD=true
git worktree add --detach /tmp/b321-head HEAD
ln -s /Users/tom/dev/ethlete-sdk/node_modules /tmp/b321-head/node_modules
(cd /tmp/b321-head && npx nx build ethlete-studio --outputPath=/tmp/webkit-studio/b321-head --excludeTaskDependencies --skip-nx-cache)
node tools/scripts/verify-webkit-studio.mjs --built /tmp/webkit-studio/b321-head --checks paint --png-dir /tmp/webkit-studio/shots-head
```

Build with the fix - expect PASS:

```bash
(cd /tmp/b321-head && git apply /tmp/b321-shell-stacking-fix.patch && npx nx build ethlete-studio --outputPath=/tmp/webkit-studio/b321-fix --excludeTaskDependencies --skip-nx-cache)
node tools/scripts/verify-webkit-studio.mjs --built /tmp/webkit-studio/b321-fix --checks paint --png-dir /tmp/webkit-studio/shots-fix
git worktree remove --force /tmp/b321-head
```

If HEAD passes, raise `--paint-hangs` (e.g. 60) before concluding the check is blind; if the fix build fails, open
`explorer-changed.png` against `explorer-baseline.png`.

#### Not done

- ci.yml: not wired. Plan: in `webkit-design-events`, add `node tools/scripts/verify-webkit-studio.mjs` after the
  events step (it builds Studio itself), raise `timeout-minutes` to about 25, and widen the `design-changes` diff to
  `.ethlete/design libs/cli/design tools/scripts/verify-webkit-*`.
- build-ready.md "As built" line: not written.
- Changeset: none needed (tools/ci/plans only).

#### Cleanup state

My design servers, the swift probes and the repro static server (:4291) are stopped. I did not touch :4402 or
:4221. Worktrees `/tmp/webkit-tla-wt` (pre-fix, `libs/cli/src` deleted) and `/tmp/webkit-revert-wt`
(overscroll-reverted), each with a node_modules symlink, are still registered. Remove them with
`git worktree remove --force <path>` when they are no longer needed.

## B321 patch

The patch equals the shell-main.component.{html,spec.ts} diff on wip/b321-stacking-fix. In step 4 of the B321 commands, use `git diff next wip/b321-stacking-fix -- apps/ethlete-studio/src/app/design-parts/shell-main > /tmp/b321-shell-stacking-fix.patch`.

## Agent result: b333

The map script `b333-map.mjs` is on branch `wip/b321-stacking-fix` at `tools/scripts/b333-map.mjs`.

### B333 result: not committed (time limit)

Commits: none. Both plan files are untouched.

#### What I found

- The archive `plans/ethlete-studio/archive/findings-2026-11.md` is fine: all 54 numbers match their numbers at 3decc21bb^ (I matched on the first 50 chars of the text). It has not changed since 3decc21bb.
- In `design-to-code.md`, 3decc21bb itself renumbered the list: prettier ran before that commit. 138 findings are now off. The shift starts at today's 158, which was 159 (158 went to the archive). The tail today reads 372..385 = 384..385 at the old offset, and the last item, "374." (Sketches group, screenshot), is really 386 (added in 784a4c141).
- A map by text restores all of them. I wrote the script to `.claude/handoffs/agent-results/b333-map.mjs`; run it with the archive path and the plan path. It writes `/tmp/b333-restored.md`. It needs `git show 3decc21bb^:plans/ethlete-studio/design-to-code.md > /tmp/b333-old.md` first. Unmapped items get 386. Check that only the last item is unmapped.
- Blocker 1: `prettier --write` renumbers the restored file again (159 -> 158), so restoring the numbers alone is not green. The numbers have to be in a prettier-proof format in the same commit.
- Blocker 2: the findings range (line 562 to "1. Build-ready") has other top-level ordered lists in it (they restart at "1. The MVP goal", "1. Studio gets its own title bar", "1. From 70 %", "1. Repo switch", "1. Go last", "1. Now, in the MVP", "1. Push:"). The check and the format conversion have to tell findings apart from these lists, for example by number > 100 or by position after the findings heading. Look at each spot before converting.

#### Remaining steps

1. Restore the numbers with b333-map.mjs and convert every finding in both files to `#### F<N>` or `N\.` (decide after looking at nested sublists and code blocks inside findings; `N\.` turns the item into a paragraph, so check that indented continuation lines and nested lists still render). Run prettier and confirm the numbers survive. Spot-check 382 (edit sketch merge), 384 (75 live frames), 386 (Sketches row leaves the canvas empty).
2. Update the parsing in archive-findings.mjs, studio-status.mjs and check-studio-adrs.mjs, and their specs.
3. Add the uniqueness / increasing / "Bef. N" resolves check to `yarn lint:studio-adrs`, with fixtures, including a prettier-renumbered fixture that must fail.
4. Add finding 387, row B333 (done) and row B332 (open: a design check rule that resolves each sketch variant's imports; finding 380 / 296429625).

## B321 pixel check over SSH

Tom's PC `tank` reaches this Mac with `ssh ethlete-mac`. Run the B321 commands there. The paint check captures the screen, so it needs a logged-in GUI session on the Mac and Screen Recording for the process that runs it. An SSH shell may not get that grant: if the capture fails, run the check in a terminal on the Mac desktop (for example through screen sharing). The parked fix is on `wip/b321-stacking-fix`; the old worktree `/tmp/wip-b321` on the Mac holds the same commit.
