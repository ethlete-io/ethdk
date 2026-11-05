# A10: build-ready instead of go (B249 + B295)

Status: planned 2026-11-04, not built. Sources: `backlog-parallel/decisions-latest.md` ("build-ready" decisions
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

## As built: B366 merge guards (finding 434)

Commit: the one that holds this section (`feat(repo): Guard sketch merge against a dirty product`). `mergeSketch` refuses before any write on uncommitted git edits in the product outside `sketches/` and the merged parts, naming the files; a failed check whose type errors all lie outside the merged paths answers "product broken outside this sketch: <file>". Two specs in `merge.spec.ts`, both fail on the old `merge.ts`. Verified: design and sketch specs, spec tsc, lint. Not verified: a live `et design sketch merge` in a real checkout; a product outside git skips the dirty check.

## As built: B367a gone sketch (finding 435)

Commit: the one that holds this section (`fix(repo): Draw a gone sketch as the product`). `drawnOf` returns `{ ...product, sketchGone: <the SketchVariant> }` when the sketch is not found, and does not cache it (a missing variant of a found sketch still returns null). `partOf`, `resolveId` and the sketch registry therefore resolve `@system/...` against the product; `serve.ts` (draw ledger) and `shot.ts` still treat a gone sketch as missing (404). New spec in `system-modules.spec.ts` fails on the old `system-modules.ts`; the sketchesRoot spec changed to expect `sketchGone`. Verified: cli tests, spec tsc, lint. Not verified: a live frame of a merged sketch in a running Studio; no frame note is rendered yet (part b uses `sketchGone`).

---

## As built: B367b leave a gone sketch (finding 435)

Commit: the one that holds this section (`fix(repo): Leave the Studio sketch view at once on a discard`). A list drop of the open sketch (merge or discard elsewhere) already showed the target part through `pickedPart`/`sketchMissing`; the gap was the in-view discard, which kept the deleted sketch's frames until the listing reloaded. `SketchViewComponent` now emits `discardComplete` after a successful discard, and `SystemViewComponent.leaveGone` (renamed from `selectMerged`, shared with `mergeComplete`) hides the sketch and picks the target part. New spec in `system-view.component.spec.ts` fails on the old code (the sketch view stays open). Two canvas e2e cases (`Merge`, `Discard` pages, own fixture sketches `components/title-bar`, `components/tree-row`) assert no sketch view, no frame of the sketch, no error overlay, frames of the target part. Verified: app specs, spec tsc, lint, studio e2e. Not verified: the e2e cases pass on the old code too for a merge and an external drop (no regression bite there); the transient Vite overlay window between file removal and listing is only covered by part a.

---

## As built: B339 Sketches e2e rule (2026-11-04)

Commit: the one that holds this section (`test(repo): Allow kept unchanged marks before the full sketch compare`).

- The case "no state is marked before the compare answers" now runs on the Chip page only. Its fixture is the
  scratch checkout's `components/zoom-chip` sketch whose variant a sets `reset` to 110 %, so 4 states differ and 12 are
  unchanged. No real sketch is needed; the old `pages/system` sketch dependency is gone from this case.
- It first asks the design server for a full listing (the kept comparison), reloads with the full listing held and the
  quick listing let through, and passes when every mark shown before the full listing answers equals what that earlier
  full listing says for the same state. A mark that listing does not produce is a new mark and fails. After the full
  listing it waits for that answer itself (the old wait on "pending" marks returned too early and left `listed` unset,
  which was the "no listed sketch" message) and then checks every mark against the full listing as before.
- Bites: a temporary route patch dropped `fit` from the quick listing's `unchanged`; the case failed with
  `a/fit marked true before the compare`. The patch is reverted and not committed.
- Not verified: the CI job for `studio:e2e` (B339 stays open for it); the `pages/system` and `shell-main` pages no
  longer run this case, as their sketches are all-unchanged copies and show no variant marks.

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

- **B250** (presentational check before and after the build): one more rule in S3's slow set, its problem a `Blocker`
  of kind `problem`; no change to `buildReadyOf`.
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

## As built: S7 (pulled to the front)

- `.husky/pre-push` checks each pushed ref over `<remote sha>..<local sha>` (merge base with `origin/main` for a new
  branch), no clone: `.husky/format-check-committed.mjs` runs Prettier on the committed blobs of the changed files,
  then `lint:changesets`, `versions:check`, `lint:size`, `lint:cli-related-map`, `docs:error-codes:check`,
  `sdk:tokens:check` (each under 1 s), and `yarn vitepress build apps/docs` only when the range touches `apps/docs/`.
  About 3 s without the docs build, about 20 s with it.
- Dropped from the hook: the clone, typecheck, lint, `agents:check` (it builds agent-rules from the working tree, so
  another session's half-done edit fails it), `test:tools`, the export-coverage and `studio:classes:check` scripts,
  and the four Studio gates. CI's "Checks" job already ran all of them except the gates.
- `ci.yml` has a new `studio` job ("Studio gates") that runs `tools/scripts/prepush-checks.mjs`
  `specs|design|live|visible` over `NX_BASE..NX_HEAD`; every gate runs even when an earlier one fails. `verified` and
  `deploy` need it.
- The `studio` job is now "Studio rules": it builds the CLI, then runs `design check --product studio` and
  `design check --product studio --slow --base "$NX_BASE"` (the second runs even when the first fails). `verified` and
  `deploy` still need it. `tools/scripts/prepush-checks.mjs` and `libs/cli/src/lib/design/prepush-*.ts` (+ specs) are
  deleted; `touchedPartsOf` and the `PrepushChange` type, which `system/visible-change-parts.ts` used, moved to
  `system/touched-parts.ts` with their spec. `ci-check` skill updated; changeset `cli-studio-rules-ci.md` (none).
- Verified: `touched-parts` and `visible-change-parts` specs pass, `nx lint cli` passed, `lint:cli-related-map`, ci.yml
  parses as YAML, prettier. Not verified: `nx test cli` in full and the local run of the two `design check` commands
  (the CLI build was blocked by another agent's unfinished `ready-command.ts`, and the machine load ruled out heavy
  runs); `tsc` on the spec config reports only the `by` error in `part-compare.spec.ts` from that same edit. The job has
  never run in CI.
- Not done yet from the S7 entry: dropping `GO_JSON` from `git-safety.py` (goes with S4).

## As built: S1

- `system/part-build-ready.ts`: `buildReadyOf` (record holds, embedded unchanged since the actions, open points, rule
  problems, `slowProblemsOf`, every embedded part ready) and `recordBuildReady`, which writes or drops the records of
  the checked parts, embedded parts first. Inputs come from `buildReadyInputsOf` in `check-system.ts` (open points plus
  static rules; `design check` adds the rules it tallied).
- `ready.json` entries: `{ hash, files, embedded?, actions?, at }`, written through `writeJsonFile` (D19); `by` is
  optional on read. `writePartRecord` / `dropPartRecord` in `part-ready.ts`.
- `et design ready <part>`: no `--by` (passing it exits 2); runs the slow rules of the part when pending, then refuses on
  open points, other blockers, failed actions.
- `design check` writes a record only when the part has none (or its embedded parts changed) and the actions pass; the
  actions run only when the check could draw. It drops a record only on a checked blocker: a pending slow result or
  actions that did not run keep it.
- Open-points answer gains `buildReady`; `no-go` / `stale-go` and the `linked` / `go` open-point inputs are gone.
- Verified: the S1 specs, `tsc` on the spec config, lint, `nx test cli`. Not verified: a live `design check` /
  `design ready` in a real repo, and the Studio app, which still knows `no-go` / `stale-go`
  (`apps/ethlete-studio/src/app/system-view/open-points.ts`, `src/host/design-open-points.ts`) - S5.
- Follow-ups: `apps/docs/cli/index.md` still shows `design ready --by` (docs); `embedded-actions.spec.ts` now expects
  check to drop the record of a part with a rule problem instead of printing `ACTIONS RERUN` for it.

## As built: S5

- `system/sketch/edit-sketch.ts` `openEditSketch`: a ready `<part>@edit` sketch, variants `new` (working part) and `old`
  (the part folder at HEAD, its `shared/` imports rewritten to `@shared/`; a changed shared file shows the new one in
  both). Refuses when the part is not in HEAD or HEAD already holds the edit.
- `accepted-pictures.ts` `autoAcceptOf` (name kept, `check-system.ts` untouched): stores one kind, `record`, at the
  design hash of a merged part unchanged since its merge; a direct edit compares with `record`, else `review` at the
  merged hash, else `go`. Same pictures: `recordMerged` (holds, `HELD` line). Changed: `PICTURES CHANGED` +
  `DIRECT EDIT` line and the edit sketch. No pictures to compare with: the edit sketch, no drawing. The go carry is gone.
- Serve hook: `system/slow-run.ts` `startSlowRunner` resolves each settled direct edit (hash still for one poll) of every
  product before the slow rules, in the same one-run-at-a-time poll.
- Open point `direct-edit { sketch: string | null }` (`open-points.ts`); `read-open-points.ts` reads it through
  `directEditsOf` (`merged-parts.ts`) and hides the edit sketch's `unmerged-sketch` point.
- `merged.json` entries take `note`: `recordMergeReason` writes plan ref and reason there (Q4); a new merge decision
  drops it. `recordAutoMerge` / `recordAutoReview` are gone; auto-merge and `--allowed-by` write no `accepted.json`.
  `acceptPart` still logs it until S4 deletes it.
- Verified: specs `accepted-pictures`, `sketch/edit-sketch`, `sketch/merged-parts`, `sketch-command`, `open-points`,
  `accept-command`, `part-accept`; `tsc` on the spec config; `nx lint cli` (no new warnings); prettier.
- Not verified: the slow-runner hook (no spec, no live serve run), a real browser drawing, the Studio app on the new
  kind, `nx test cli` in full. Red-first was not kept: specs were written with the code.
- Follow-ups: S6b shows `direct-edit` (Studio app readers do not know the kind yet). S4 removes `acceptPart`,
  `readAccepted`, `ACCEPTED_FILE` and the `kind` argument of `storePictures`. Discarding an edit sketch reopens it on
  the next poll. S8 migrates `pictures.json` through `writePictures`.

## As built: S2

- `part-task.ts`: `linkedTaskPartOf` (part + `implements` link, current design hash, no gate) for compare;
  `taskPartOf({ product, part, inputs })` refuses a part that is not build-ready with one `  <kind>: <text>` line per
  blocker; `verifiedTaskPartOf` for `task --verify` needs only a holding check record (slow results go pending once the
  app files change, so verify does not wait on them). `allowStale` and `unapproved` are gone (also from
  `compare-command.ts`). `doneParts` compares `implemented.json` with the hash of the holding check record. The task
  prints `design <hash>` instead of `go <hash>`; `designTask` takes `inputs` for specs.
- `stale-parts.ts`: design staleness from the check record only; the legacy upgrade moves ready.json and
  implemented.json, not go.json. `action-lost.ts` reads `actions` from the product's ready.json.
- `check-system.ts`: ACTION-UNDECLARED turns into a warning on a part whose check record holds (was: current go).
- Open-points answer drops `go`. Studio: `partOpenPoints$` returns `{ points, buildReady }`; the chip lists every
  blocker except `open-point` in the error group (CLI text, detail = embedded part or kind).
- Verified: part-task, stale-parts, action-lost, part-compare, open-points-answer, harness-map (S2 cases) specs; the
  app open-points and system-view specs; `tsc` on the cli spec config; lint cli and ethlete-studio.
- Not verified: `nx test cli` / `nx test ethlete-studio` in full; the browser case in `check-system.spec.ts` (warning
  under a check record); a live `design task`. The two `design go with a stale harness map` cases in
  `harness-map.spec.ts` fail locally with "Impl Q9 is not committed yet" - go path, untouched here.
- Follow-ups (S4): nothing writes `actions` into a check record yet (`writePartRecord` only carries them over), and
  go.json holds the only recorded actions today - migrate them before go.json goes, or ACTION-LOST stays silent;
  `action-undeclared.ts` still says "unchanged since its go"; `GoActionsOf`/`goActionsOf` in `action-lost.ts` serve
  only go-step; `part-approval` reads `go` from the answer, now always absent, so it shows Go geben (S6b).

### Edit sketch decisions (2026-11-04)

- ADR 0135: [Picking old is the discard of an edit sketch](../../apps/ethlete-studio/docs/adr/0135-picking-old-is-the-discard-of-an-edit-sketch.md)

## As built: B311 event-stream heartbeat (finding 365, part 1)

- Cause: WKWebView drops an SSE response after 60 s of silence; `comment-events` was silent. Each reconnect made
  Studio remount every frame and restart the full sketches listing, which blocks the Node event loop of :4402 for
  12-30 s, so frame.html, `/__design/render` and shots timed out. Proven with an offscreen WKWebView probe (closed at
  exactly 60.0 s without a heartbeat, open 139 s with one) and curl (frame.html 11.7 s behind a listing).
- Built: `DESIGN_EVENTS_HEARTBEAT_MS` (20 s) heartbeat in `serve.ts` `createDesignEvents`, spec in `serve.spec.ts`
  (fails without the fix).
- Verified: the heartbeat spec. Not verified: in Studio (needs a CLI build and a server restart).
- Open: run `openSketchProblemsOf` off the event loop; reconnect without a pid change must not remount frames;
  `designAnswer$` must surface errors; server spec for frame.html latency during a listing; WKWebView soak check.

## As built: B311 WebKit event-stream soak check (finding 365, tool fix c)

- Built: `tools/scripts/verify-webkit-design-events.{mjs,swift}` start `et design serve` from `dist/libs/cli`, hold
  `/__design/comment-events` in an offscreen WKWebView (x -20000) for 90 s and fail on any close. CI: a
  `design-changes` diff job and a `webkit-design-events` job on `macos-latest`, gated on `apps/ethlete-studio` or
  `libs/cli/src/lib/design`; listed in `verified.needs`, not in `deploy.needs`.
- Verified locally: pass against the heartbeat build (90 s open); fail against a silent stand-in SSE server (closed at
  60.0 s). Not verified: the job on a real macOS runner.

## As built: B311 reconnect keeps frames, listing errors (finding 365, Studio side)

- Built: `reconnects$` compares the `/__design/stamp` pid; same pid gives `relisted` (lists only, no frame remount),
  another or unreadable pid keeps `all`. `flow-view` caches `SafeResourceUrl` per src. `sketchRead$`
  (`system-view/sketch-read.ts`) keeps the quick items and emits an error on a failed or timed-out full listing
  (`LISTED_SKETCHES_TIMEOUT_MS` 120 s); `system-view` exposes `sketchesError`.
- Verified: new specs `design-changes.spec.ts` (fails without the fix), `sketch-read.spec.ts`; host, system-view and
  studio-view specs green (253); lint; `tsc -p tsconfig.app.json`. Not verified: in Studio/WebKit; the timeout has no
  spec; two stamp fetches per reconnect.
- Open: no UI shows `sketchesError` yet (design question to the grill session); `flowRead` still swallows errors.

## As built: Studio overscroll and canvas paint clip (Tom's reports 14:3x)

- Built: `styles.css` `overscroll-behavior: none` on html, body and every element (not inherited, so one rule covers
  all shell scroll containers); `design-canvas` host gets `isolate` and `contain-paint` next to `overflow-hidden`.
- Verified: `styles.spec.ts` (compiled CSS holds the rule) and `design-canvas.component.spec.ts` (host classes), both
  fail without the change; lint. Not verified: in Studio/WKWebView; the frame-over-explorer cause (WebKit compositing
  under load) is an assumption; no WKWebView host setting changed.

## As built: interim failed-listing state (finding 365 follow-up)

- Built: a pending compare row shows "Vergleich fehlgeschlagen: <message>" (merge-error style) and the sketches head
  one "Erneut laden" et-button while the listing failed; `flowRead$` keeps the last flows and exposes `flowsError`
  (no UI, flows have no pending state). Interim look (a), not in the design; Tom's sketch pick replaces it.
- Verified: sketches, system-view and sketch-read specs (56), lint, tsc. Not verified: fail-without proof, Studio,
  `design check`/compare of the sketches part.
- Why no check flagged it: B251 (declared loading/error/empty states for data parts) is unbuilt; the state checks
  only see states the design declares.

## As built: Studio runs committed code only + B309

- Built: `tools/scripts/studio-code.mjs` builds the CLI from the last `libs/cli` commit into `tmp/studio-cli` (kept
  while `libs/cli` is dirty); the host (`studio_code.rs`, `design_server.rs`) starts the design server from it, and
  `startedByStudio()` turns off reload-on-rebuild. `yarn studio` runs `tauri dev --no-watch` via `studio-dev.mjs`, the
  dev server has no HMR/live reload; `yarn et:design` runs a design command from the committed copy (B309).
  `code-watch.ts` polls the host every 10 s and derives the notice (`codeNoticeOf`, labels, `quitForRebuild$`).
- Verified: `studio-code.spec.mjs`, `started-by-studio.spec.ts`, `source-hash.spec.ts`, `code-watch.spec.ts`;
  `cargo check`, `cargo fmt --check`, lint, `tsc`. Not verified: the real Studio flow, the worktree build, the
  restart/reload clicks, the `yarn studio` rebuild loop.
- Open: the title-bar notice is not rendered and waits on a sketch of the title-bar design part; frontend reload and
  host rebuild still use the working tree; `tmp/studio-cli` is never pruned; the 10 s poll cost; skills and docs do
  not mention `yarn et:design` yet.

## As built: B318, B319, B320 (findings 372-374, 2026-11-04 afternoon)

- B318 4c1667672: a copy without `pinned-commit` counts as absent; a dirty `libs/cli` builds the last CLI commit
  when no copy of it exists; ensureCliCopy removes an unpinned directory of the same sha first. Tom: the
  "Neu starten" click is the approval of that build (32bdcdfe5). Verified: `node --test
tools/scripts/studio-code.spec.mjs` (end-to-end case with a fake build). Not verified: the real `nx build cli` path.
  Open: a clean tree without `dist/libs/cli` plans `copy` and copyDist throws - fix with the next slice in that file.
- B319 a148d713e (cli b, c) + 7581b65e1 (studio a): `sketchPartOf()` resolves the part from `targetParts[0]`; `old`
  keeps HEAD's `shared/`; baselineOf uses review/go only at `merged[part]`, else draws HEAD and closes the edit sketch
  as HELD when every state draws the same. Verified: the touched specs, tsc on libs/cli. Not verified: a real drawing,
  live Studio. Open (sent to grill): the three wrong @edit sketches stay open (`changedOutsideSketchOf` skips parts
  with an open sketch); merged.json holds `partHashOf`, pictures hold `designHashOf`, so the hash check never
  matches; `record` has no hash check.
- B320 598973423: real-design open-point budget spec (ratchet per product, part, kind; growth checked by hand: a
  lowered budget fails). 52d23cfc2 + 996b339ef: German blocker texts (`stale-record` = "Kein Prüfergebnis ...",
  `pending`, `embedded`). 16a3d8214 fixed the system-view spec that 52d23cfc2 broke (only the module spec ran).
- B321: cause and fix in finding 375 report; fix uncommitted in `apps/ethlete-studio/src/app/design-parts/shell-main/`
  (copy /tmp/b321-shell-stacking-fix.patch) until the new `paint` check (uncommitted, verify-webkit-studio.swift)
  fails on HEAD and passes with the fix in Tom's quiet window.

## As built: B325 rest

- 296429625 had items 1, 2 and 4 (re-check rebuilds `old/` from HEAD, `EDIT-OLD-NOT-DRAWN`, stale-export spec).
- 842fce846: the re-check also rewrites the English notes of an open edit sketch into German (shared constants).
- 586c115a9: `part-ready.spec.ts` / `part-go.spec.ts` no longer expect `go` in the open-points answer (they failed
  at HEAD and blocked every cli commit).
- Verified: new specs fail without the fix; cli gate 1002 tests green at commit; eslint, prettier clean.
- Not verified: proof run (needs a CLI build). Open: `tsc -p libs/cli/tsconfig.spec.json` fails on
  `started-by-studio.spec.ts` (from dd708ee4a); `list-system.spec.ts` failed once under load ("not a git repository").

## As built: B321 panel stacking in WebKit (2026-11-04)

- Fix: `shell-main.component.html` gives the canvas `main` `isolate` and the explorer `aside` `z-1` +
  `will-change-transform`, so WebKit keeps the panel above the frame iframes while WebContent hangs. Spec covers the classes.
- Check: `tools/scripts/verify-webkit-studio.{swift,mjs}` (WKWebView, 24 main-thread hangs over churned frames, pixel
  compare of the explorer) and a reusable `verify-studio-headless.mjs`.
- Verified: on ethlete-mac the check FAILs at HEAD (184190 explorer pixels changed, hang 2 of 24) and PASSes with the fix
  (47 captures); shell-main spec (7) green; `sketches-tree.e2e.mjs` and `yarn studio:e2e` on tank green.
- Not verified: the fix in the Tauri app itself; the check runs only on macOS with Screen Recording (no gate runs it, B337).

## As built: interim code notice (B323)

Commit be8aa16b7. The title bar shows a code notice left of the Update control: muted text "Oberfläche geändert - neu starten" and a tonal brand xs `et-button` "Neu starten" (component `apps/ethlete-studio/src/app/components/code-notice/`). It appears while the running server is older than the latest commit.

Needs approval: Tom picks a variant of sketch components/title-bar code-notice (a = as built, b = quiet button with a brand dot, c = compact pill with icon); until then the notice is interim.

Verified: the component spec. Not verified: the look against a design part, because none drew it until the sketch.

## As built: B333, B329 rest, B331 (2026-11-04 evening)

- B333: 319c4a832 (numbers restored, findings as `N\. ` paragraphs), ab06d7bc6 (`lint:studio-adrs` number checks,
  prettier-renumbered red fixture), 9f0d70e47 (commit-wait spec temp repo gets an eslint config). Verified: prettier
  keeps the numbers; finding specs 16/16; `node --test tools/scripts/*.spec.mjs` green.
- B329: b9367d285 (6 live frames, pictures for near cells, fold of unchanged states, round note), 4ebc754ca
  (`sketch-frame-cap.e2e.mjs`: PASS 6 live of 101 cells on pages/sketches). Not verified: fold in the live app,
  Tauri memory; sketch pages/sketches@fold-question (a = built look) waits for Tom's pick.
- B331: not reproduced on HEAD. 885b0eada: "Sketch nicht gefunden" instead of a silent part fallback, `x@edit` falls
  back to `x`, failing-variant reason in the tree title, per-group pick specs. Open: `selectMerged` sets `picked` to
  the raw `@edit` target; open-points entry for a sketch needs a design.

## As built: B326

- 7658705c1: `ethlete-frame-shield` (transparent cover after an iframe) on Sketches and merge shots and flow frames;
  the design canvas cover also covers the live frame during a wheel gesture (`data-wheeling`, 200 ms) or a drag.
  New canvas e2e case forces `iframe { pointer-events: auto }` (as WKWebView routes): fails without the fix on
  Sketches, Chip, Large; passes with it. Specs for the covers fail on the old source.
- Not verified: real WKWebView routing. `tools/scripts/verify-webkit-frame-wheel.swift` (never compiled) delivers
  wheel gestures in-process to its own WKWebView (`web.scrollWheel(with:)`, no global event post).
- Pre-existing e2e failure: "Sketches: no state is marked before the compare answers" (fails on the old build too).

### Code notice and push decisions (2026-11-04)

1. Code notice icon: Tom merged title-bar@code-notice variant c (tonal pill). The `up-down` icon reads as "sort", so a
   refresh icon is added to the icon set and replaces it in c, through a small sketch with the new icon.
2. Push timing: push after the gates B334, B335 and B336, before S4 to S8; then triage the red CI on `next`.

## As built: B343 (findings 400, 404)

- Stale counts embedded parts: `sketch/stale-base.ts` finds every product part a variant's held parts reach through
  imports; a change there makes the sketch stale. `design check`, `sketch check` (new: prints `SKETCH-BASE-STALE`
  and fails) and the inbox name that part, and the merge refusal (Studio "… hat sich seit dem Sketch geändert") names
  it too, not the sketch's own target.
- Every merge (`mergeSketch`, the one path of CLI merge, Studio merge button, merge step and auto-merge) calls
  `rebaseAfterMerge`: each undiscarded sketch whose stale parts the merge changed is ported and rebased, re-checked
  when files were ported, and keeps its status (`REBASED <product> <sketch> after the merge of <part>`). On a
  conflict or a failing re-check it gets `portAfterMerge` in `sketch.json` (merged parts, parts, reasons) and the
  merge prints `AGENT PORTS …`; the inbox still lists it as a rebase item. `sketch rebase` clears the mark.
- `sketch rebase`: a part `shared/` file is compared with the copy the sketch lifted into its `shared/` folder, and
  relative shared imports are compared as `@shared/` (cause of finding 404: the variant held the change, but in the
  lifted copy, so the rebase saw a deleted file).
- Specs (each failed before the code): `after-merge.spec.ts` (embedded merge rebases and keeps ready; conflict marks
  and prints), `rebase-port.spec.ts` (lifted shared file identical is clean; product change ports into the lifted
  copy), `sketch-command.spec.ts` (embedded change: `sketch check` prints SKETCH-BASE-STALE naming elements/hero).
  "Identical content in the part's own file" passed before already (the old code compared bytes).
- Open: Studio does not draw the "Agent portiert nach Merge von <part>" mark; no design part draws it, so it needs a
  sketch. The mark is in the sketch listing (`portAfterMerge`).

## As built: B351 (finding 410)

- A missing `dist` of a `render.packages` folder fails at once: `entryOf` throws
  ``design-explore: <dir> missing, run `nx build <folder name>`.``. The 60 s poll (`entryOfBuilt`,
  `entryOfBuiltAsync`, `BUILD_WAIT_*`) is gone; the render worker's resolve hook and `mappedSubpathOf` call `entryOf`.
  An installed package (`node_modules`) keeps its old "has no package.json" message.
- Why the poll existed: commit 1d116d6b8 added it so a render survives a package that is mid-rebuild while the
  server runs. Dropped by decision; the file watcher redraws after the rebuild settles.
- Cache scope: none. The check is one `existsSync` per import, never stale, so a later build is picked up at once.
- Specs (`render.spec.ts`, `node-modules-base.spec.ts`): message, 30 modules of a missing-dist fixture under 5 s,
  a late build is picked up, installed message unchanged. The budget spec cannot start the compiled worker (needs
  `nx build cli`); it runs the resolve path the worker calls.

## As built: CI run 41924354824

- f30bb3b81: the setup action reads the Nx machine id per `RUNNER_OS` (macOS `ioreg`, Windows registry, else a warning). Verified: Linux branch and fallback in bash. Not verified: a real macOS runner.
- b770d4222: `motion-shot.spec.ts` fixture sets its class on `:root`, so a re-render does not clear it (repro with a 300 ms delay; still bites on the old `motion-shot.ts`). `merge.spec.ts` flake (B373) not reproduced; the assertion now prints the check findings.
- 66a4de23f: the base table error mark uses `title` again; the tooltip stays opt-in. Table goldens back inside tolerance.
- 4de41ac2e: the Studio rules job builds `cli,components` before `design check`. The check now runs, but finds 3 problems from finding 438 (B372).
- Open: B372 must land before CI can be green. Bundle growth from the tooltip swap (password-input, stream-with-pip, scheduler, cascader) waits for Tom. Nothing pushed.

## As built: B377 (ADR 0192)

- `yarn studio:e2e` builds Studio once, then runs the cases on workers: each a forked process with its own scratch checkout, design server (free port via `DE_PORT`) and Chromium. Workers pull cases from one queue, slowest first by the timings of the last run (`node_modules/.cache/studio-e2e/canvas-timings.json`). Every case already reloads the page and clears localStorage, and the only shared state is the checkout, so any case can run on any worker.
- Default: `min(8, cores / 4)` workers (8 here); `--workers <n>` or `STUDIO_E2E_WORKERS` overrule it. `--case <name>` still works. The workers run with `ETHLETE_DESIGN_SLOW_CHECKS=off`.
- The run ends with the time per page group and per case, slowest first.
- `tools/scripts/verify-studio-headless.mjs` exports `ensureCli` and `buildStudio`.
- Wall time: 12 min 10 s serial (B367b) -> 2 min 27 s (8 workers, slow checks on, 113/114: System "a frame renders real content" saw empty frames), 1 min 56 s (12 workers, load peak 46, 113/114: Sketches "ctrl-wheel keeps the world point" drifted 86 px), 2 min 9 s (8 workers, final, load peak 38, 114/114).
- Flaky cases: Sketches "pan beyond every edge" and Large "a variant equal to Aktuell" passed in all 3 parallel runs.
- cli vitest: no config change. Default (31 forks) 97 s, `--maxWorkers=16` 91 s; CPU about 50 % idle in both. The run is bound by `check-system.spec.ts` alone (89-95 s); splitting that file is the lever.
- Not verified: a serial run of the new runner (only the B367b number as "before"), more than one run per worker count.

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
