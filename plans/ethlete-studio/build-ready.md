# A10: build-ready instead of go (B249 + B295)

Status: planned 2026-11-04, not built. Sources: `backlog-parallel/decisions-latest.md` ("build-ready" decisions
2026-11-02, point 5; "Solo focus" 2026-11-04, Studio checks leave the git hook), `STATUS.md` B249, B295 and A10.

## In progress

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

- A `<part>@edit` sketch (old/new after a direct edit) has no "Verwerfen" button. Picking `old` is the discard: the
  merge writes the HEAD copy back into the part folder and records the hash, so the sketch does not reopen. Known
  limit: `shared/` files are the working ones in both variants, so `old` does not undo a `shared/` edit.

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
