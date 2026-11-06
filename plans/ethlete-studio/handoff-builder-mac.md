<!-- Builder handoff for the Mac, copied from the PC .claude/handoffs/builder.md (gitignored). Delete once resumed. -->

# Mac first (ADR 0217, 0218)

- `git fetch origin && git checkout -B next origin/studio-mac-move`.
- Order: fix pages/sketches, pages/system, pages/merge drift; check-record pages/inventory and pages/start; push `next` with the hook (finding 541). Then push safety (ADR 0216: draft PR + full CI per slice while a push is held; uncompared parts surface when the app file changes). Then perf S7c/S8/S5, measured on the Mac.
- Not done on the PC: full local ci-check (only format + typecheck ran). Doc agent on the Mac reads plans/ethlete-studio/handoff-doc-agent.md.

# Handoff: builder (coordinator) c0 - PERF (ADR 0213): push, then S7c

Branch: next · Last commit: 7c08e0a9d docs(repo): Record S7b-4 and S7b-5 as built
Working tree: nothing of c0. `.ethlete/design/*/{pictures,merged,ready}.json`, `.ethlete/design/*/sketches/`,
`.ethlete/mac-perf.prompt.txt`, `libs/query/*` belong to other sessions/Tom/tools - never commit them.

## Role

Run `/builder-agent` first. You are ethlete-sdk-c0, the ONLY builder (ADR 0207). Grill/docs = `ethlete-sdk-c4`.
Report every slice sha to c4. Never ask the user. Commits: `git commit -- <paths>`, NO trailers, header <= 100 chars,
changeset <= 40 words. Studio-only commits use scope `repo` (commitlint rejects `ethlete-studio`).
Claim: `node .agents/skills/ethlete-agent-sessions/agent-sessions.mjs claim ethlete-sdk-c0 libs/cli/src/lib/design --ttl 8`.
`yarn et:design` builds and runs the LAST COMMIT (finding 535, fix queued).

## Done this session (all reported to c4)

NG0953 = pre-existing (finding 533). 528 draw-once invariant b7b19adb7. S7a ecb5057b2 (check via resident, phases,
compare between check parts, UNEXPLAINED flag; finding 534). S7b-1 df132a653 (render-inspect cache, served-cache.ts).
S7b-2 6f2061c10 + 52c079983 (completeness cache; finding 537 null hashes always hit -> fixed). S7b-3 294eef997 (no entry
with null hash, timings NULL-HASHES), 44514b348 (warning replay spec; 536 closed). S7b-4 72457e493 (per-frame registry
slice keys, stable SDK render ids; finding 538; STUDIO_API_LEVEL 6->7 accepted). S7b-5 07d3c5bcd (wsToken/sourcemap
normalize, flaky spec = live code-hash salt -> mocked). As-built paragraphs in plans/ethlete-studio/design-to-code.md.
Numbers: main tree warm full `design check --product studio` 51.4 s (auto-accept 39.0, static 7.2, render 1.9,
completeness 0.8, open-points 1.4); fresh worktree: unchanged 0/167 rewritten, zoom-chip edit 103.3 s exactly 9 entries,
after `design stop` 70.9 s 0 rewritten. => ADR 0213 check target MET.

## Next steps

0. c4 CONFIRMED (2026-11-06): ci-check, then push `next`. Report ANY blocker to c4 before working around it - no
   baseline/skip to get it green.
1. ADR 0215: green local CI (`ci-check` skill) then push `next`. Expect blockers from the design-rules gate
   (`node tools/scripts/design-rules-gate.mjs origin/next next`): earlier IMPLEMENTATION-UNCOMPARED for
   elements/studio-menu, pages/flows, inventory, merge, sketches, start, system; merge had merge-error DIFF 2 px; the
   ff698951f verify demands title-bar (3 missing notice states -> needs a sketch, ADR 0106) and shell-main (@edit open).
   Pending accepts: `sketch merge <part>@edit --variant new --allowed-by "<refs>" --by builder --product studio` for
   shell-main ("ADR 0050, ADR 0209"), update-dialog ("ADR 0106, ADR 0210"), inventory ("Impl Q58, Impl Q56, ADR 0210"),
   sketches ("finding 500, ADR 0210"); pages/start is Tom's own accept - send c4 a `design shot` first (ADR 0211).
   Report what blocks to c4 with a recommendation; sketch/accept decisions go through c4. If fifagg needs the
   section 12 fixes earlier, push at once after green CI.
2. S7c (c4-accepted scope): auto-accept (39 s warm, 55 s after an edit) works on the S4 picture cache and stops
   creating/removing `<part>.edit` sketches in the checkout every run; fresh-worktree test asserts `git status`
   unchanged after a check; partActionFailuresOf (harness-server.ts:344) / checkActions (actions-command.ts:262) on the
   WarmDraw; open-points after a resident restart (13.5 s); parallel lanes across parts for wide edits (cold 314 s).
   Finding 539 (in S7c): check caches use the per-producer import-graph hash from code-hash.ts (like the compare
   caches) instead of the live libs/cli hash; spec: edit an unrelated libs/cli file between two runs -> 0 redraws.
   S7c also owns the cold run (314-346 s, above the 120 s hard timeout).
   Each cache slice is done only after a real scratch-worktree edit redrew exactly edited part + embedders (537 rule).
3. Queued after S7: 533 (Studio spec setup fails on logged NG0 error + sketch-view emit after destroy), 535 (et:design
   builds the working tree into a scratch dist), then 514/518/516 sketch-view sketch, title-bar notice states sketch,
   511/512, B412, B406, B407, B410, B413, B414, B415; deferred cut 2, 532.

## Subagent brief rules (every brief)

Fresh opus subagent per slice, self-reporting to `.claude/handoffs/agent-results/<name>.md`. Both cli tsconfigs
(`npx tsc -p libs/cli/tsconfig.lib.json --noEmit`, `tsconfig.spec.json`). Only touched specs. Numbers ONLY from
`.ethlete/design/.timings.jsonl` (sha/dirty/load/nullHashes; load > cores = redo). `design check` only in the BACKGROUND
(hook) with `timeout 600s`; never read a pipeline exit code. Real edits only in a scratch worktree (`git worktree add
--detach`, symlink node_modules, `cp -a dist` NOT symlink; CLI copy via `node -e "import('./tools/scripts/studio-code.mjs')
.then(m=>m.ensureCliCopy(process.cwd(),{keepWhenDirty:false}))"`, run `node tmp/studio-cli/<sha>/src/index.js ...`).
Timing sketches only in `--product studio-lab` (513). Edit-between-runs spec per cache input (519/531), timeout per
wait loop (521), no write after abort (524). Revert lint-made `libs/cli/package.json` dep changes. Code commit, then
`docs(repo): Record <slice> as built` paragraph at plan tail (only own hunk). Never `git add -A`/stash/amend/rebase.

## Gotchas

- Any change under libs/cli changes the check cache code hash -> the first check after a cli commit is cold (~314 s).
- `accept --by tom` from an agent is refused by the permission classifier - Tom runs it himself with `!`.
- A changed `libs/components/design/*.ts` needs `npx nx build components` before a design check.
- `git commit -- <file>` commits the whole file: never commit a file with another session's dirty hunks.
