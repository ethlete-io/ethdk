<!-- Session state of the grill/docs agent, moved from the gitignored .claude/handoffs/ so another machine can resume. Delete once resumed. -->

# Handoff: grill/docs session (doc-agent) for the Studio design work

Branch: next · Last commit seen: 3decc21bb docs(repo): Move 54 done Studio findings to the archive and budget the plan files
Working tree: builder agents have uncommitted work (B321 stacking fix in shell-main, B322 app copy in src-tauri,
serve.ts, studio-code.mjs, verify-webkit-studio.*). Not ours - never commit them.

## Goal

Continue as the German grill/docs session (`/doc-agent` skill). Talk to Tom in German. Builder is `ethlete-sdk-d0`
(English, SendMessage). Findings go to `plans/ethlete-studio/design-to-code.md` (last is 385) plus a row in
`plans/ethlete-studio/STATUS.md` (last B330). NEW (Tom 2026-11-04, cf723b2a0): decisions go ONLY as ADRs into
`apps/ethlete-studio/docs/adr/NNNN-slug.md` with frontmatter `status`, `built: <sha>` | `open: B<row>` | `open: none`,
`decided`, `source`. Before EVERY grill question search the ADRs and all `plans/ethlete-studio/**` decision blocks
(Tom is fed up with repeated questions; finding 385). Claim files with
`node .agents/skills/ethlete-agent-sessions/agent-sessions.mjs claim ethlete-sdk-e4 <paths> --ttl 1`, release after.
Write plan edits as a python script in /tmp/dx/ and run it: a heredoc that contains the words "design check" is
blocked by a PreToolUse hook.

## Running

- ADR migration slice 1 DONE (subagent, commits b65a0f981..c787924c3): ADRs 0001-0180 + apps/ethlete-studio/CONTEXT.md.
  Next ADR number 0181. Files LEFT (spawn one fresh opus agent with the same brief as before - shape: frontmatter
  status/built|open/decided/source, one ADR per decision, replace block by `- ADR NNNN: <title>` link, claim files,
  one commit per file, no changeset needed again unless a new package): design-to-code.md (32 blocks, grep only,
  claim first), design-system/decisions-core.md (12), decisions-comments.md (11), decisions-frames.md (8),
  decisions-sketches.md (5), decisions-wireframes.md (4), backlog-parallel/decisions-overnight.md (4),
  decisions-studio-ui.md (3). Also search other forms: bare "Tom:" lines, "Decided (Tom".
  Left in place on purpose (not decisions): in decisions-latest.md the `design dom` gap, "In progress (builder 57)",
  floating-action frame, Q248 (unconfirmed), MVP lessons list, "Studio MVP reached", "Checkbox missing states",
  "For Tom's round" (Impl Q39/Q43); build-ready.md open Q1-Q8. Build states are rough: many 2026-10-31 MVP ADRs
  say `open: none` though probably built - a build-state pass (sonnet) fixes them before `open: none` turns strict.
- Builder parallel slices: B324+B329 (4.48 option 1 focus view in full, fold from quick path, live-frame cap,
  75-frame spec), B325 (re-check draws HEAD fresh; old render error = check problem; German notes), B322 app copy.
  Done today: B328 2bad713a6, B330 421d2fee8/3decc21bb, start merge 12cddcbe3, lint fix 4e53b553f.
- Orphan list is built (317bef97a): `node tools/scripts/archive-findings.mjs --orphans` shows 177 (some are dated
  decision-list items, not findings). Classify them once AFTER the ADR migration agent is done with
  design-to-code.md (one subagent, sonnet): add a STATUS row for an open one, or mark done so the script archives it.

## URGENT open

- Finding numbers in design-to-code.md are renumbered (prettier renumbered the ordered list after the archive
  run 3decc21bb): today's 382 reads "370.", 386 reads "374.". Sent to builder as finding 387 / B333 (restore
  numbers from git history, prettier-proof format, uniqueness + "Bef. N" check). Do not edit design-to-code.md
  or STATUS.md until the builder reports it fixed. B325 done 296429625; B332 approved (import-resolve rule).
- Pushed by builder: 68fbfd0199..2a1a526286 on next (99 commits, hook passed). Builder gave its running agents
  (B323, B329 rest, B331, B333) 8 minutes to commit, then pushes again. Check
  `git rev-list --count origin/next..HEAD`; if > 0, ask the builder to push the rest. B321 fix stays uncommitted.
- After B333: check the finding numbers (382 = "pages start merged", 386 = sketch row opens nothing) and that this
  file's numbers still match. After B329+B323: tell Tom to quit Studio and run `yarn studio` once (B322 app copy).
  After that: proof run for B325 (builder runs it), then Tom picks in pages/sketches + pages/system build-ready.

## Waiting for Tom

- B322/B318 done (f294ac49b, 2dbee7cc4): Studio serves a static build of the committed frontend. Tom must quit
  Studio and run `yarn studio` once (first start builds the app copy, minutes). Advised to do it after B324+B329
  land, so one restart covers both. Not verified: real start and reload after the click - ask Tom for the result.
- Finding 386 / B331 sent (sketch row in System tree opens nothing; warnings without reason).

- Tom can judge no open sketch until B324+B329 land (pages/sketches 75 frames and pages/system build-ready 78
  frames freeze Studio). Then: pick in pages/sketches (agent progress) and pages/system@pages-system-build-ready.
- Do NOT touch pages/flows@edit and pages/merge@edit: test cases for B325. After B325: proof run
  `yarn design:check --product studio` (run_in_background, quiet machine) -> expect both closed as HELD.
- B321 pixel check: when Tom gives a quiet window (Screen Recording for the terminal, ~15 min). Steps in
  (builder file webkit-soak.md, see the builder handoff in plans/ethlete-studio/handoff-builder.md). Stacking fix must not be committed before the run.
- Q1 of this session (keep the two @edit sketches open) - Tom did not answer explicitly; treated as yes.
- Parked by Tom: finding 374 (is `motion.instant` the default?). Undecided old detail: role name `human` in notes.

## Gotchas

- `/__design/sketches?product=studio&unchanged=no` is the quick listing (0.03 s); the full listing took >90 s.
- Server runs from `tmp/studio-cli/<sha>/`; check `ps` for the sha before you blame old code.
- Look questions go to the builder as sketches, never as a grill question.
- Keep status lines to Tom short and concrete.

## Machine change (2026-11-04)

Work continues on the PC `tank`, not the Mac. `tank` reaches this Mac by `ssh ethlete-mac` (checkout
`~/dev/ethlete-sdk`). So the gitignored files can be copied with `scp ethlete-mac:dev/ethlete-sdk/.claude/handoffs/<file> .claude/handoffs/`,
and the B321 pixel check can run on the Mac over SSH when Tom names a quiet window (Screen Recording must be
granted to the terminal app on the Mac itself). The B321 pixel check (WebKit, ScreenCaptureKit) needs the Mac; the uncommitted B321 stacking fix is on branch `wip/b321-stacking-fix` if the builder pushed it.
To resume: copy this file to `.claude/handoffs/doc-agent-studio.md`, then run `/handoff resume doc-agent-studio`.
