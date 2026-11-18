# A10: build-ready instead of go (B249 + B295)

Status: built; the open rest is in `STATUS.md` (A10, B295, B388). Sources: `backlog-parallel/decisions-latest.md` ("build-ready" decisions
2026-11-02, point 5; "Solo focus" 2026-11-04, Studio checks leave the git hook), `STATUS.md` B249, B295 and A10.

## In progress

Builder ethlete-sdk-02 (2026-11-04 20:00, PC tank, after a restart), grill/docs ethlete-sdk-9e. One topic at a time.
Now: B323 rest (sketch components/title-bar --name code-notice, "needs approval" note, STATUS row). Then the fold
toggle + question line sketch (B329) and sketch-frame-cap.e2e in studio:e2e. B321 waits on Tom's paint check.

Builder handoff (2026-11-04, ethlete-sdk-d0, context full). Grill/docs session: ethlete-sdk-e4.

- First, before S4: finding 364 / B310. Studio froze at 14:00 in a frontend microtask loop (WebContent 99 % CPU,
  about 1 GB; sample in /tmp/studio-freeze-webcontent.txt), probably a retry or poll loop after the design server
  restart. Find the loop and fix it. Tool fix: a scenario that restarts and slows the design server under a running
  Studio and fails on a busy main thread. The render-bug tool fixes are finding 363 / B309. Then the person-name check
  B308 (finding 362, decisions-latest.md "Person names in the product"), and the edit-sketch decision below (S6b).

- Done, not pushed (17 commits on `next`): S1 8675cccbb, S2 5fd088c7c, S5 598e0b2bd, S7 rest dbd6de8e6; CI fixes
  45f505995 (contentful), 62c79da3b (ANSI in precommit-specs), 99905988b (shell-logo timeout; ET1234 absent in a
  green run), 4d78306ab (pages/system chip counts exceptions; undrivable states are a VISIBLE-CHANGE problem).
- Not verified anywhere: the full `nx test cli` on a quiet machine. Run it once, `--maxWorkers=2`, only while Tom
  does not use Studio. Then push and triage CI.
- S4 parked half-done: `.claude/handoffs/s4-parked/s4.patch` (+ `leftover-files.ts/.spec.ts`), applied over
  5fd088c7c. It does not compile yet. The patch holds the deletions and merged-parts/accepted-pictures cleanup. The
  remaining steps: check-system GO block + leftover warning + harness map after build-ready, the actions writer in
  the record, action-lost/action-undeclared, dom-command, studio-api/serve (apiLevel 5), design-command, mcp `go`,
  commit-hunks, sketch-command, stage-design-base.mjs, related-map, specs, the writer->reader round-trip spec
  (finding 361), GO_JSON in git-safety.py. Work it in a git worktree: an uncompilable libs/cli in the shared
  checkout breaks Studio's restart and `sketch check` ("CLI build is stale").
- Load rule: one heavy run at a time; no `nx build cli` while Tom works in Studio (serve's `watchBuild` restarts
  his server on every dist change, see below).
- S6b waits on Tom's S6a footer pick. S6b also: no Verwerfen on `<part>@edit` sketches, and the server refuses
  `sketch discard` on them with "pick old". Studio app knows no `direct-edit` kind yet. part-approval reads `go`,
  which is gone, so the footer shows "Go geben" until S6b.
- S8: data migration (Studio go.json holds 7 actions, ready.json none), docs (`apps/docs/cli/index.md:402`
  `ready --by`), pictures.json kinds to `record`.
- Studio render bug of 13:30-14:00 (both sketches empty): load + serve self-restart, not the sketches. Tool fixes,
  queued: (1) "Wartet auf deine Wahl" only when every live variant drew frames without error
  (`sketch-view.component.ts:530`); (2) no `watchBuild` self-restart when Studio owns the server, show "CLI
  geändert - neu starten"; (3) `design_server_restart` builds before it stops the old server; (4) frame error text
  through `canvas-frame.ts` to the chip; (5) per-shot timeout in `sketch check`. The valid `sketch check` on
  pages/sketches r1 is still open (needs a build, so only when Tom agrees).
- Queue after A10: B302 (machine lock for heavy runs), B303, B304 (traffic lights), B305 (hook matches command
  position only), B306, B307 (parser fixtures from real runs), B308 (person-name check; role `human`), B300,
  B301, B297, then A36 with A25.

## Current state

**Three human-or-agent records per product dir** (`.ethlete/design/<product>/`):

- `ready.json` (`libs/cli/src/lib/design/system/part-ready.ts`): `PartReady { hash, files, embedded, by, at }`.
  `markPartReady` (called only by `et design ready`, `ready-command.ts`) refuses on a stale hash, any open point
  (`drawnPartPointsOf`) or a failed action check. `readyMarkOf` / `readyPartsOf` / `actionsRerunOf` read it.
- `go.json` (`part-go.ts`): `PartGo { hash, files, by, at, actions?, review?, note? }`; written by `markPartGo` /
  `writeGo` via `et design go` (`go-command.ts`, `go-step.ts`, `go-guard.ts` with `--by tom` + `Impl Qnn` note,
  `go-batch.ts` go lists), Studio `POST /__design/part-go` (`studio-api.ts` `partGoAnswer`) and the MCP `go` tool
  (`mcp-command.ts`). A go stores `go` pictures (`accepted-pictures.ts` `storePictures`) and regenerates a stale
  harness map.
- `accepted.json` (`sketch/merged-parts.ts` `ACCEPTED_FILE`): log of `et design accept` (direct edit of a merged part,
  `accept-command.ts`, Studio `POST /__design/part-accept`), auto-merged sketches and `sketch merge --allowed-by`.
  Accept also writes `merged.json` and `review` pictures into `pictures.json`.

**Readers of go:** `part-task.ts` (`taskPartOf` refuses `no go` / stale go; `doneParts` compares `implemented.json`
hash with the go hash), `open-points.ts` (`no-go`, `stale-go` kinds from `read-open-points.ts`), `check-system.ts`
(`GO` line, new-state review line, `ACTION-UNDECLARED` only under a current go), `action-lost.ts` (actions recorded
in the go), `stale-parts.ts` (go hash moved, legacy rehash), `commit-hunks.ts` and `uncommitted-decisions.ts` (file
lists), `tom-confirm.ts`, `tools/scripts/stage-design-base.mjs`.

**Studio app:** `apps/ethlete-studio/src/app/system-view/part-approval.component.ts` (Go geben / Go erteilt /
Änderung abnehmen in the open-points popover footer), `src/host/design-part-approval.ts` (`partApproval$`,
`giveGo$`, `acceptEdit$`), labels in `src/app/i18n/studio-labels.ts`. The Studio design product draws the footer in
`.ethlete/design/studio/pages/system/system.ts` and lists `edit-accept` in `capabilities.json`. The Tauri host does not
read go.json.

**Check system:** `check-system.ts` `RULES` (static, per product) yield `Problem { rule, file, message }`;
`partOfFile` maps a problem to the innermost part folder or `(product)`. Open points (`open-points.ts`) are the
per-part list Studio shows. Slow checks are flags of `et design check`: `--live` (regions no part covers),
`--visible-change` (`visible-change-command.ts`, base..HEAD, git-range based), plus `design compare` and the harness
SDK-error watch (`sdk-errors.ts`).

**Pre-push** (`.husky/pre-push`, throwaway clone): format, typecheck + lint affected, 12 yarn checks, and four Studio
gates through `tools/scripts/prepush-checks.mjs` (`specs`, `design`, `live`, `visible`; helpers
`libs/cli/src/lib/design/prepush-{changes,specs,design,sketches}.ts`), VitePress build on apps/docs changes. CI
(`.github/workflows/ci.yml`) already runs all 12 yarn checks, typecheck, lint, test, `design complete` and
`design compare --all` for studio, but no `design check` and none of the four gates.

**Hook:** `libs/agent-rules/content/hooks/git-safety.py` (`GO_JSON`, synced to `.claude/hooks/ethlete/`) blocks
`git add/commit` of `go.json`; spec `libs/agent-rules/src/lib/git-safety.spec.ts`.

## Target state

- **Build-ready is computed.** `buildReadyOf({ product, part })` answers `{ ready: true }` or
  `{ ready: false, blockers }`. A part is build-ready when all hold: the check record matches the current design hash;
  no open point; action checks pass (embedded parts unchanged since); every embedded part is build-ready; no rule
  problem on the part (static rules and the slow rules below); an implemented part compares green against its design;
  its harness render shows no SDK error. No `by`, no click.
- **`ready.json` becomes a tool-written check record** (hash, files, embedded, actions, at; no `by`). `design check`
  and Studio write it when a part turns build-ready and drop the entry when it is not. Old entries with `by` read fine.
- **go.json, accepted.json, Go geben, Änderung abnehmen are gone,** with `et design go|accept`, go lists, `--by tom`
  guard, `/__design/part-go`, `/__design/part-accept`, the MCP `go` tool and the go.json commit hook.
- **Direct edit of a merged part:** no picture change holds at once (today's auto carry); a picture change is a
  `direct-edit` open point (blocks build-ready) and Studio opens a sketch with variants "old" and "new" to pick.
- **The four Studio gates are rules** with problems on the part: `APP-SPEC` (specs related to the part's app files),
  static design rules (already rules; the "reached parts" filter goes), `UNCOVERED-REGION` (live: region no part
  covers, attached to the innermost part whose render contains it, else `(product)`), `VISIBLE-CHANGE` (app looks
  different without a picked sketch). Slow results live in a gitignored per-product cache keyed by input hash; a part
  whose slow result is missing or stale is "being checked" and not build-ready. CI runs the same rules as backstop.
- **`design task` starts only for build-ready parts** and prints the blockers otherwise.
- **Pre-push** keeps only format, changesets, VitePress build on apps/docs changes, without a clone. AGENTS.md says so.

## Slices

Contract fixed before group A starts (in S1's first commit, consumed by S3 and S6b):
`slowProblemsOf({ product, part }): Problem[] | 'pending'` and `BuildReady = { ready: true } | { ready: false;
blockers: Blocker[] }` with `Blocker = { kind: 'stale-record' | 'open-point' | 'action' | 'embedded' | 'problem' |
'compare' | 'sdk-error' | 'pending'; text: string; part?: string }`. Open-points answer gains `buildReady`.

### Group A (parallel)

**S1 Build-ready core (CLI).** Goal: `buildReadyOf` and the auto-written check record.
Owns: `system/part-ready.ts`, new `system/part-build-ready.ts(+spec)`, `system/ready-command.ts`,
`system/open-points.ts`, `system/read-open-points.ts`, the open-points answer in `studio-api.ts` (only that handler).
Red first: `part-build-ready.spec.ts`: host whose embedded part has an open point is not build-ready (blocker
`embedded`); part with a static rule problem is not; part with `slowProblemsOf` = `pending` is not; a green part is,
with no `by` anywhere; `open-points.spec` no longer yields `no-go` / `stale-go`.
Done: `et design ready <part>` drops `--by`, runs the checks and writes the record; `design check` writes or drops
records for every part it checked; open-points answer returns `buildReady`; `nx test cli` green, lint clean.
Deps: none (stub `slowProblemsOf` until S3).

**S3 Studio gates as rules (CLI, B295).** Goal: the slow rules and their cache.
Owns: new `system/rules/app-spec.ts`, `system/rules/uncovered-region.ts`, `system/rules/visible-change.ts`
(adapter over `visible-change-command.ts`), new `system/slow-checks.ts` (runner + cache), `check.ts` flags,
`serve.ts` background runner (debounced, one run at a time), `.gitignore` entry for the cache.
Red first: `app-spec.spec.ts` (failing spec of a part's component yields an `APP-SPEC` problem on that part),
`uncovered-region.spec.ts` (region under a page part attaches to it; no host gives `(product)`),
`slow-checks.spec.ts` (changed input hash makes the result `pending`).
Done: `et design check --product <p> --slow [--part]` runs the three slow rules plus compare and SDK-error watch and
fills the cache; serve reruns them after a part's files change; spec runner config comes from the design config
(projects without it skip `APP-SPEC`); `VISIBLE-CHANGE` base defaults to the merge base with the default branch.
Deps: contract only.

**S6a Studio design: footer status (sketch, Tom picks).** Goal: draw what replaces Go geben / Änderung abnehmen in
the open-points popover: build-ready state, "wird geprüft", blocker list grouped by kind, and the direct-edit entry
that opens the old/new sketch. Owns: a sketch over `.ethlete/design/studio/pages/system/` and
`capabilities.json` (`edit-accept` out). Done: Tom picked a variant, merged (`ethlete-design-exploration` skill:
he decides). Deps: none.

### Group B (after S1; S2 and S5 parallel)

**S2 Task, done and stale on build-ready.** Owns: `system/part-task.ts`, `system/stale-parts.ts`,
`system/action-lost.ts`, the `ACTION-UNDECLARED` "under go" branch in `check-system.ts` (`actionUndeclaredUnderGoOf`).
Red first: `part-task.spec.ts`: `design task` on a part with one open problem refuses and lists it; on a build-ready
part it starts without any go.json; `doneParts` matches `implemented.json` against the record hash;
`action-lost.spec.ts` reads recorded actions from the check record.
Done: no import of `part-go` left in these files; `allowStale`/`unapproved` removed or redefined as "not build-ready".

**S5 Direct edit becomes an old/new sketch.** Owns: `system/sketch/merged-parts.ts` (accept paths, `ACCEPTED_FILE`
log), `system/accepted-pictures.ts` (one picture kind for the check record instead of `go`/`review`), new
`system/sketch/edit-sketch.ts(+spec)`, the `direct-edit` open-point kind (adds one kind to `open-points.ts` after S1).
Red first: a merged part edited outside a sketch with a pixel change yields `direct-edit` and a sketch with variants
`old` (HEAD design) and `new` (working design); without a pixel change it holds at once and no sketch appears.
Done: Studio picks merge like any sketch; auto-merge and `--allowed-by` stop writing accepted.json (see Q4).

### Group C (after S2 + S5; S4, S6b, S7 parallel)

**S4 Remove go and accept (CLI).** Owns: delete `part-go.ts`, `go-step.ts`, `go-command.ts`, `go-guard.ts`,
`go-batch.ts`, `accept-command.ts`, `tom-confirm.ts` (if unused) and their specs; `design-command.ts` usage,
`mcp-command.ts` `go` tool, `studio-api.ts` `partGoAnswer`/`partAcceptAnswer` + paths, `studio-api-level.snapshot.json`
(bump `apiLevel`), `commit-hunks.ts` doc list, `uncommitted-decisions.ts` file list, `check-system.ts` `GO` lines,
`tools/scripts/stage-design-base.mjs`, `libs/cli/related-map.json`. Harness map regeneration moves from the go to
`design check` (stale map regenerated when a part turns build-ready).
Red first: `studio-api-level.spec` expects no `part-go`/`part-accept`; `design-command.spec` `et design go` exits 2
with "unknown command". Done: `git grep -n "go\.json\|accepted\.json\|readGo" libs/cli/src` empty except the
leftover-file warning (Q3).

**S6b Studio app on build-ready.** Owns: `apps/ethlete-studio/src/app/system-view/part-approval.component.ts(+spec)`
(replace with a build-ready status component per S6a's pick), `src/host/design-part-approval.ts`,
`src/app/i18n/studio-labels.ts`, `system-view.component.ts` (one binding), `src/app/system-view/__fixtures__/`.
Red first: component spec: open-points answer with blockers shows them and no Go geben button; `pending` shows
"wird geprüft". Done: follows the `studio-design-part` skill; `design compare` of the system part green; S6a pick
implemented 1:1. Deps: S6a, S1 contract (and S4 for endpoint removal, client side can go first).

**S7 Pre-push, CI backstop, hook.** Owns: `.husky/pre-push`, `.github/workflows/ci.yml`, delete
`tools/scripts/prepush-checks.mjs` and `libs/cli/src/lib/design/prepush-*.ts` (keep any helper S3 reuses by moving it
into S3's files first), `libs/agent-rules/content/hooks/git-safety.py` + `git-safety.spec.ts` (drop `GO_JSON`), then
`yarn agents:sync`, the AGENTS.md pre-push sentence.
Red first: `git-safety.spec.ts` case "git commit -- .ethlete/x/go.json" now passes. Done: pre-push runs format check
over committed blobs of base..HEAD, `lint:changesets`, VitePress build when apps/docs changed, nothing else, no clone;
CI job "Studio rules" runs `design check --product studio` and `--slow` with the PR base; a push with a deliberate
hard-coded colour in a Studio part passes the hook and fails CI. AGENTS.md: "The `.husky/pre-push` hook runs format,
changesets and, when apps/docs changes, the VitePress build; lint, typecheck and the Studio rules run in CI and in
Studio's check system." Deps: S3 in CI before the gates leave the hook.

### Group D (last)

**S8 Data, docs, changesets.** Owns: delete `.ethlete/design/{sdk,studio-lab,studio}/accepted.json` and
`.ethlete/design/studio/go.json`; rewrite `ready.json` without `by` via `design check` (no hand edit);
`pictures.json` kinds via S5's reader (coordinate: `.ethlete/design/sdk/pictures.json` has another session's
uncommitted edit today - claim it first, `ethlete-agent-sessions` skill). Docs: `apps/docs/cli/index.md` (ready,
go, go list, accept, task, sketch merge, commit-hunks sections, around lines 379-470, 621, 680, 684; new "Build-ready"
and "Studio rules" sections), `libs/agent-rules/content/skills/design-exploration/{SKILL.md,
reference-products-and-sketches.md}` + `yarn agents:sync`, `.agents/skills/studio-design-part/SKILL.md` line 19.
Changesets: each slice ships its own file; S8 checks coverage: `@ethlete/cli` (minor in pre mode, breaking note:
`design go`, `design accept`, `--by` removed), `@ethlete/agent-rules` (hook + skill), `ethlete-studio` (UI).
Done: `yarn vitepress build apps/docs` green; `git grep -n -i "go geben\|design go\|design accept\|go\.json"` over
`apps/docs .agents libs/agent-rules/content` empty.

Each slice: `npx nx lint cli --fix` scoped to changed files, then `nx lint`, `nx test cli`, `tsc -p
libs/cli/tsconfig.spec.json` (vitest does not typecheck), no new warnings; design checks run in the background.

## Verify in the live Studio

On the `studio-serve` tmux server (:4402), after S6b:

1. A green part: popover shows build-ready, no Go geben; `GET /__design/shot` of the system view.
2. Add a hard-coded colour to a Studio part: the problem appears on that part within one serve rerun, build-ready
   drops, `et design task <part> --product studio` refuses naming `HARD-CODED-COLOUR`; revert, it returns.
3. Edit a host's embedded part so it gets an open point: the host shows the `embedded` blocker.
4. Change the app component of an implemented part so it renders differently: `VISIBLE-CHANGE` problem; a visible
   edit of a merged design part opens an old/new sketch in the sketch view; picking "new" makes it build-ready.
5. During a slow run the part shows "wird geprüft". Report with a live shot each ("ok" only after a shot).

## Where B250 and B251 plug in

- **B250** (presentational check before and after the build): a classification printed next to build-ready, not a
  `Blocker`: a blocker would refuse `design task` for every developer part, against decision 4. No change to
  `buildReadyOf`. As built: `design-to-code.md` "As built (B250)".
- **B251** (dev-built missing state becomes a sketch variant; loading/error/empty mandatory for data parts): the
  mandatory states are `missing-state` open points (S1 path); the dev-built state reuses S5's edit-sketch builder.

## Open questions (each with a recommendation)

- **Q1 Is `ready.json` committed or a cache?** Recommend committed, tool-written: CI, `doneParts` and `ACTION-LOST`
  need the last green hash and actions without a browser; agents commit it like `pictures.json`.
- **Q2 What does Studio call the state?** Recommend "Baubereit" / "Nicht baubereit (n)" / "Wird geprüft"; the final
  wording comes from Tom's pick in S6a.
- **Q3 Leftover go.json / accepted.json in other repos?** Recommend no `et update` migration: readers ignore them and
  `design check` prints one warning naming the file to delete.
- **Q4 Where does `sketch merge --allowed-by` log its plan ref?** Recommend in the part's `merged.json` entry
  (`note`), accepted.json gone; drop the flag if no caller remains after go lists go.
- **Q5 Base of `VISIBLE-CHANGE` in Studio?** Recommend the merge base with the default branch (today's CLI default);
  CI passes the PR base. A stored-picture baseline is a later change.
- **Q6 Should Studio create the old/new sketch itself or offer a button?** Recommend itself on the `direct-edit` hit
  (decision: "Studio turns it into a sketch"); the button only reopens it.
- **Q7 Format check without a clone sees other sessions' uncommitted edits.** Recommend `prettier --check` on
  committed blobs (`git show HEAD:<file> | prettier --stdin-filepath`) of base..HEAD; no clone.
- **Q8 Slow-rule cost in serve.** Recommend reruns only for parts whose input hash changed, one browser at a time, and
  `APP-SPEC` through `vitest related` with the existing module cache.

## In progress: B388 (finding 449, ADR 0195)

Builder ethlete-sdk-0d, 2026-11-05. Step 1: a full `design check --product studio` run, log in
`/tmp/b388/full-check.log`. Step 2: group the render problems by code and part, and sort them into real defects and
rule noise. Step 3: fix per group, one commit per group. Step 4: CI runs the full check again.

Triage (opus subagent, from `/tmp/b388/full-check.log`, run 10:46 min, 798 findings): the count is doubled. Render
issues are kept once per colour scheme (render-check.ts:982), so the real number is about 412. Slices, rule fixes first:
(1) de-dup per scheme; (2) `edged()` in surface-nesting.ts:30 counts a one-side border as a card edge (133 LOST-SURFACE
noise, title-bar root); (3) SKIP-SCOPE once per part+path, skips moved onto the clipped children (81); (4) COVERED
exempts aria-hidden decoration and an open layer over its anchor, plus `pointer-events-none` on the comment-pin badge
(34); (5) the CLI token and icon sheets drop their redundant fill (15); (6) small drawing edits (mg-shot fill,
co-surface skip, inbox NESTED-SCROLL skip, sketches far-out pin, gutter COVERED skip, logo NESTED-SURFACE); (7) design
call with Tom: raised surface for `aside.st-shell-side` and comment-draft (96, asked the grill session); (8) CONTROL-STATE
in studio (3); (9) DROPPED-PROP (27) are missing app inputs and stay warnings. The SDK CONTROL-STATE hints print without
a prefix.

Finding 465 (builder, after the handoff): `sketch check` also draws the product part of each sketch target and prints
its problems as `<target> before: ...` lines on stdout; they do not change the exit code. The render check reuses the
baseline draw it already did for old-problem filtering (`renderIssuesOf` option `before`). Verified: two new specs
bite (sketch-command.spec.ts with mocked render, render-check.spec.ts in real Chromium), tsc and lint clean. Not
verified: a real `sketch check` on studio. A new part (not in the product yet) gets no `before` lines.

B388 full run 3 (`/tmp/b388/full-check-3.log`): 190 -> 47 findings. LOST-SURFACE no longer fires on the product
`aside.st-shell-side`, so the shell-main sketch is discarded (907495e9f). HINT prefix: the non-blocking CONTROL-STATE,
CONTROL-UNDECLARED and OPTION-VALUE-MISSING hints print as `HINT ...` (complete.ts, one place for all three printers).
Verified: complete.spec and check-system.spec pass; complete.spec fails 3 cases without the change.

COVERED skip on the cover: `coverOf` (reach.ts) ignores a hit inside a `data-et-skip~="COVERED"` element that does not
contain the target, so a skip on an occluder (the frozen `span.sk-gutter`) works. Before, `skipsOf` read only the
ancestors of the covered element. Verified: reach.spec fixture `components/reach-skipped-cover` fails without the
change; `design check --part elements/variant-cell` is clean (3 COVERED before). Not verified: the UNREACHABLE path,
which shares `coverOf`.

Finding 464 gate: `sketch ready` refuses with `SHOT-NOT-VIEWED` while a live variant draws a pixel diff (the auto-merge
diff, rendered once before the ready mark) and no shot of it was fetched since its last edit. A view is recorded per
checkout in `node_modules/.design-explore/viewed-shots/` with the variant content hash (variant folder + `shared/`), by
`GET /__design/shot` with `sketch` and `variant` (not `priority=low`) and by `design shot --variants`. Verified: specs
bite (shot.spec, sketch-command.spec); real run: title-bar `notice-shape` refused, then passed after `design shot`.
Not verified: the Studio server route records only after Studio runs this build. A new-part sketch is not gated. The
gate records a handed-out shot, not a look.

Finding 466: `drawnPair` (merge compare and auto-merge) uses `looksTheSame`: same size and no channel delta over 8 of
255; a picture that does not decode compares byte for byte. Verified: merge-compare.spec fails with tolerance 0
(rounded-border anti-alias case), passes with 8; no-visible-change.spec passes. Not verified yet: the real
`sketch merge pages/system@check-fixes` (next step).

Finding 467: cause confirmed in /tmp/b388/commit-464.log. `embedded-actions.spec.ts` timed out at 5000 ms under the
full related run; the hook re-ran it alone (1003 ms, passed), as built. The agent grep for `failed` saw only the first
summary. Tool fix: after a passing re-run the hook prints `<spec> passed when re-run alone; the timeout above does not
fail the commit.` Verified: commit-wait.spec fails without the line. A real failure already failed the commit.

Finding 466 real run: `sketch ready pages/system@check-fixes` now reports no visible change, but the merge refuses on
the uncommitted `ready.json` (same block as the foundations merge). The refused auto-merge left a `pick` decision in
`sketch.json`; I restored the file. Fix: a refused auto-merge writes `sketch.json` back as it was (sketch-command.spec bites).

As built (B249 actions in check record): `writePartRecord` takes `actions`; `recordBuildReady` (`declaredActionsOf`) and
`markPartReady` (`declaredActionsOf`) write the keys the part source declares (`declaredPartActionsOf`, the logic of
`goActionsOf`, which now aliases it); a read failure prints `ACTIONS NOT RECORDED` and keeps the held keys. ACTION-LOST
already reads ready.json, so it now compares against what check recorded. `design check` regenerates a stale harness
map per product before auto-accept (`REGENERATED <product>: the stale harness map`, or `HARNESS MAP STALE` and go on);
`design ready` regenerates it first and exits 1 with the regenerate command when it cannot. Go/accept paths unchanged.
Verified: 4 new cases (part-build-ready, action-lost, harness-map x2) fail on the old source; tsc, eslint, related
specs and spec:stress pass. Not verified: a real `design check` run (would rewrite the shared ready.json); a record
that still holds is not rewritten, so old records get actions only at their next write. Suspect, not traced: a definite blocker
(ACTION-LOST included) drops the whole record, actions with it, so an ACTION-LOST disappears on the next check.

As built (B249 keep recorded actions): Cause (proven by the new action-lost spec): ACTION-LOST is a slow-check problem
of the part, a definite blocker, so `recordBuildReady` called `dropPartRecord`, which removed the whole ready.json entry
with its `actions`; the next check found no recorded key and reported nothing. Fix: `dropPartRecord` leaves an action
baseline `{ actions, at }` (no `hash`) in place of a record that held actions. `readReady` returns only check records,
so `readyMarkOf`, `readyPartsOf`, `isPartReady`, stale parts and the open-points answer never take a baseline as ready;
`readRecordedActions` (ACTION-LOST, the slow-check inputs) reads records and baselines; `writePartRecord`, the drop and
the legacy-hash upgrade keep other parts' baselines. The baseline moves only when a record is written again (with the
then-declared keys, or the held ones when they cannot be read). Commit: see git log "Keep recorded actions when a check
record is dropped". Verified: the new spec fails on the old source and passes; tsc, eslint, 122 related spec files and
spec:stress (4/4) pass. Not verified: a real `design check` run (would rewrite the shared ready.json).

As built (B249 Studio app on build-ready): the System page no longer renders `PartApprovalComponent` and no longer calls
`giveGo$`/`acceptEdit$` (component, spec, `src/host/design-part-approval.ts` and the go/accept labels removed; the CLI
endpoints stay). `buildReadyStatusOf` (`src/app/system-view/open-points.ts`) maps the open-points answer to the footer:
ready → Baubereit; a `pending` or `stale-record` blocker → Wird geprüft; otherwise Nicht baubereit (n) with a
`direct-edit` open point as a `direct-edit` blocker, the other points in Studio words, and the rule blockers by kind
(`action` and unknown kinds as `problem`). The mapping lives in the app, not `src/host`, because the status type is the
footer's. The chip gets `[buildReady]`; `(openEditSketch)` activates `sketch:<part>@edit`, Studio never switches by
itself (ADR 0252). Verified: open-points spec (3 cases) and a system-view case fail on the old source; e2e case "open
points chip pressed matches its popup" asserts the footer badge and no Go button, plain and with `--hold-listings 14000`.
Open: a stale record reads as Wird geprüft until someone runs `design check`; nothing starts that check from Studio.

As built (B249 serve records build-ready): Cause, proven by `libs/cli/src/lib/design/system/slow-run.spec.ts`: the
slow runner of `design serve` (`startSlowRunner`) reran the slow rules and cached their results but never wrote a check
record, so a part with a stale record kept its `stale-record` blocker (Wird geprüft) until someone ran `design check`;
the spec fails on the old source with exactly that blocker. Fix: after each settled run the runner calls
`recordSettledBuildReady` (`system/record-settled.ts`), which runs `recordBuildReady` for the run parts and every part
that embeds one (all parts when the product itself reran) with `partActionFailuresOf` and `declaredPartActionsOf`, as
`design check` does. The open points and rule problems come from the open-points worker as data
(`buildReadyDataInWorker`); the action checks stay on the main thread, because they start a design server and
`createDesignServer` calls `process.chdir`, which a worker refuses. An open sketch or direct edit is an open point, so
`recordBuildReady` writes no record for it. Commit: see git log "Record build-ready when the serve slow run settles".
Verified: both spec cases fail without the record call and pass with it (one through the worker and the real declared
actions read); tsc, eslint, 122 related spec files, spec:stress 4/4. Not verified: a live `design serve` on the repo
design (would rewrite the shared ready.json); the action check of a linked part inside serve (starts a harness and a
design server per stale part); products without a `harness` still never run the slow runner, so their parts stay
pending in serve.

As built (B249 missing harness): Cause, proven: `startSlowRunner` skips a product without a harness
(`libs/cli/src/lib/design/system/slow-run.ts:393`), so its parts stayed `[stale-record, pending]` (Wird geprüft) forever.
Fix (decision: a missing harness is a definite blocker): every part of a product without `config.harness` gets a
`no-harness` blocker in `part-build-ready.ts` / `build-ready-contract.ts`; it replaces the `pending` slow result, the
record blockers are skipped, so `recordBuildReady` writes no record and `design ready` / `design task` refuse the part.
Studio maps the kind in `system-view/open-points.ts` with the label `noHarness` ("Kein Harness - ..."). Specs: new cases in
`slow-run.spec.ts`, `part-build-ready.spec.ts` and the Studio `open-points.spec.ts` fail on the old source. Existing
cases whose fixture product had no harness now expect the new output: `open-points-answer.spec.ts` (`no-harness`
blocker), `check-system-args.spec.ts` (NO RECORD `(+2 more)`, a NO RECORD line with `no-harness` for `pages/home`),
`part-ready.spec.ts` (the `design ready` CLI calls refuse with the blocker; the action-check refusals stay on the POST
path), `part-task.spec.ts` and `action-lost.spec.ts` (their fixtures get a harness, so they keep testing the task
output, the wiring list and ACTION-LOST). Verified: related specs in libs/cli (only one
`check-system-sketch.spec.ts` expectation fails, handed to its owner) and apps/ethlete-studio, both typecheck targets,
eslint, prettier, spec:stress 4/4. Not verified: a real `design check` or `design serve` on the repo design. The repo
product `studio-lab` has no harness, so after the next `design check` its 1 record is dropped and its parts read
"Nicht baubereit (Kein Harness)"; answered by ADR 0254: it stays blocked until it gets an app.

As built (718 harness product pending): Cause, proven by `libs/cli/src/lib/design/system/check-record.spec.ts`: `design check`
without `--slow` never runs the slow rules; only `design ready`, `design check --slow` (which writes no record) and the
serve slow runner do. So a harness part whose slow result was missing or stale (a scratch copy has no
`node_modules/.cache` slow cache) kept `[stale-record, pending]` after `design check --part`: `recordBuildReady` treats
`pending` as not checked, writes no record and drops none. Fix: the check record step goes through
`recordCheckedBuildReady` (`system/check-record.ts`), which first runs `runSlowChecks` on the `--part` part when its slow
result is pending and the product has a harness (only when the check could draw), as `design ready` does. A whole-product
`design check` still leaves pending parts to the serve slow runner, so it does not run every slow rule. Bite: the spec
fails with `[stale-record, pending]` when the slow run is skipped. Verified: tsc, eslint, 123 related spec files,
spec:stress 4/4. Not verified: a real `design check --part` on the repo design (would rewrite the shared ready.json),
and whether the scratch Studio serve was also running its slow runner.

As built (718 pending count): a whole-product `design check` still leaves pending parts to the serve slow runner (grill decision), and now prints `PENDING <product>: <n> parts wait for slow rules - run design serve or design check --product <p> --part <part>` (`slowWaitingLineOf`, `check-record.ts`), so it never looks settled. Verified: a check-record spec case (whole-product call keeps `pending`, line text), cli typecheck, eslint. Not verified: the line in a real `design check` run.
