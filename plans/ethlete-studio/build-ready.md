# A10: build-ready instead of go (B249 + B295)

Status: planned 2026-11-04, not built. Sources: `backlog-parallel/decisions-latest.md` ("build-ready" decisions
2026-11-02, point 5; "Solo focus" 2026-11-04, Studio checks leave the git hook), `STATUS.md` B249, B295 and A10.

## In progress

Builder: ethlete-sdk-d0 (2026-11-04, after b3). Grill/docs session: ethlete-sdk-e4. SDK fixer: ethlete-sdk-ed.

- Done: S3 and S7 (slim pre-push) committed and pushed; the push of `next` went through.
- In progress (d0): S1 build-ready core on the contract 943e84cad; S2 and S5 start after S1. S7 rest: a CI
  "Studio rules" job on `design check --slow`, delete the `prepush-*` scripts. Triage of the last CI run on `next`.
- S6a: sketch of the popover footer (status words final: Baubereit, Nicht baubereit (n), Wird geprüft) plus an agent-progress signal ("Agent untersucht", "Agent behebt"; second signal, not a replacement). Tom picks the variant.
- Sketch on pages/sketches: agent progress in the sketch view ("Agent baut Runde 2"). Tom picks.
- Open design task (builder decides): one source of agent state (working, waiting, interrupted, failed, plus what it does on which part) that both displays and the A25 chat read. Proposal: the agent reports through a CLI/MCP command that writes a gitignored state file per product; Studio reads it through the design server.
- Decisions: Q1, Q3 (changed: S8 adds an `et update` migration that deletes go.json and accepted.json), Q4, Q5 (base = `harness.baseBranch`, origin/next here), Q7, Q8 taken. Q2 decided (words above). Q6: Studio creates the old/new sketch by itself. B296 (every server-reported part error blocks the pick through one path) goes into S6b.
- Re-run `sketch check` on pages/sketches r1 (6279f63f3) with a checkout-built CLI before it counts as ready. Queued, not started: B300 (TEXT-TRUNCATED), B301 (stale hash over HEAD blobs), D19 (part-ready.ts uses writeJsonFile; S1 got the note).
- After A10: B297 (missing-motion only for connected state pairs), then A36 explorer with A25 chat sketches.

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
