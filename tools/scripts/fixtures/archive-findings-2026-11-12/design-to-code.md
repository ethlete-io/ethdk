# Design to code

## Findings

875\. Linux builder (2026-11-11, during 867): the tmux `studio-serve` (:4402) had crashed with a node stack trace; a
subagent restarted it. Cause unknown; the trace was not kept. Lesson: a crashed serve is visible to the human (Studio
waits on it) and leaves no record. Tool fix: `design serve` writes an uncaught error with its stack to a log file under
the project's design folder, and Studio shows "Design-Server abgestürzt" with the log path instead of waiting. Side:
user-facing, after B249 (ADR 0269).

900\. Linux builder (2026-11-11 night): the approved push suite failed on 86f8b0497, no push. e2e 136 passed, 2 failed
with `page.waitForSelector` 120 s timeouts in the full run (2 workers, load 8.8): 128 [System] "picking old of an edit
sketch restores the design, picking new records the edit as merged" and 129 [System] "a visible edit of a merged design
part opens its old/new sketch with nothing folded". 128 passed alone (plain + hold) on 57bac0dc0. Suspect (no
measurement): the two edit-sketch cases share the zoom-chip fixture or sketch folder across workers, or 31d9002d7 /
57bac0dc0 changed a wait 129 relies on. Log: `.claude/handoffs/push-suite-e2e-20261111T222955938Z-200555-0.log`.
Lesson: a case proved alone is not proved in the full run; the push suite was the first run with both cases on two
workers. Tool fix (builder default): before a push-suite request, run the changed e2e cases together with their
neighbours at the push-suite worker count; a fixture or sketch folder used by two cases gets a per-worker copy.
Open for the human (morning round): one more push-suite run after the fix proves 128 and 129 pass together (q1ok
covered one run). Builder recommends yes.

900 update (Linux builder, 785facf09): still Suspect, no Cause. Not reproduced in 7 runs (pair 2/2; pair + 6 heavy cases
on 8 workers 9/9; scratch with HEAD .ethlete + cold store 2/2; `--page System` 29/29 twice; pair --hold-listings 14000
2/2). The hang: `waitForSelector('ethlete-sketches [data-sk-state]', 120 s)` in `edit()` of `withEditSketch`
(canvas.e2e.mjs); 128 failed at 126.4 s, 41 pictures drawn vs 487 on a pass. Ruled out by runs: shared fixture, load,
dirty tree, cold store, 31d9002d7, 57bac0dc0. The failed case dropped the `design check` exit code and output; 785facf09
now names them, the sketch folder state and the page state on that timeout. Tool gaps (builder default, tool backlog):
on a failed case print the tail of the worker and design-server output; `studio:e2e --like-push-suite` for chosen cases.

914\. Linux builder (2026-11-12 night, 912 slice): the finding-779 rule ("run the related specs") sent the builder to
`npx vitest related`, which is the wrong runner for `tools/scripts` node:test specs: it picked about 698 files and 694
"failed" with no tests. Cause: the rule names one runner for the whole repo. Tool fix (builder default, tool backlog):
the rule names `node --test <related specs>` for `tools/**`.

922\. Mac builder (2026-11-12 night, 910 probe, group B): 2 "Übernehmen" rows in `withdrawn-hidden` and `withdrawn-shown`
are an app defect. Cause (code read): the app part has no withdrawn concept (no row flag, no input, no "Zurückgezogene
(n)" switch); compare names it ("design prop withdrawn has no input on the app component"). Fix (Mac, next): withdrawn
rows in the app part, `withdrawn` mapped in `DESIGN_HARNESS_SAMPLES` (`design-harness-samples.ts:44`). The tool caught it;
no tool fix.

941\. Linux builder (2026-11-12 night): the design server on :4402 was down: the studio-serve pane showed "FATAL ERROR:
Reached heap limit ... JavaScript heap out of memory" after a 4 h 18 min run. Restarted in tmux studio-serve. Suspect: a
leak in the resident or the shot browser pool. Tool fix (builder default, tool backlog): find the leak with two heap
snapshots an hour apart; until then the serve command names its heap use in its status line.

945\. Linux builder (2026-11-12 night, 933): `sketch ready` prints about 30 UNBOUND-INPUT note lines per variant. Tool fix
(builder default, tool backlog): one summary line per variant, details behind `--verbose`. Parked (ADR 0276), see parked-suspects.md.

946\. Linux builder (2026-11-12 night, 933): `.ethlete/design/studio/ready.json` shows stale hashes for
components/canvas-viewport (`button.component.css`, `icon-button.component.css`) in the working tree, uncommitted. Suspect:
a shot or a ready run rewrote it after the 903 button change. Tool fix (builder default, tool backlog): find which command
writes ready.json outside `sketch ready`; only `sketch ready` may write it, with a spec.

946 update: `.ethlete/design/studio/ready.json` is now rewritten in 279 lines by a writer that is not the builder's
command; still uncommitted.

922 built (Mac, ca232c417, unpushed, push:suite runs): withdrawn rows in the app part ("Zurückgezogene (n)" switch, mark
in place of "Übernehmen", pin dropped). Bite: spec failed without the fix. Compare withdrawn-hidden/shown went from FAILED
(no input) to DIFF 84596/88947 px; not verified by a live shot with a real withdrawn variant. The Mac found no 922 text in
its checkout: the doc commits are unpushed and ride with the Linux push.

946 update (Linux, process read): `.ethlete/design/studio/ready.json` was written by `et design check` at 01:31 (pid
1055162). Suspect stays until a bite: `design check` writes ready.json, which only `sketch ready` may do.

941 update (doc agent, 2026-11-12 02:10, ps): the design server (`yarn design`, pid 1055162) held 6.0 GB RSS after 38 min
and its child (pid 1185015) 4.5 GB; Linux had 1.5 GB available and a full swap, and Claude Code killed background
shells for memory. So the heap growth shows in under an hour, not only after 4 h. The ready.json writer in 946 is this
server process (the builder saw pid 1055162 as `et design check`). Suspect for both until a bite.

941 update 2 (Linux builder): restarting studio-serve and `yarn design stop` on an orphaned resident (pid 1281248, 23
min, about 6.5 GB with its Chromium) brought available memory from 1.5 GB to 45 GB.

875 server half built (Linux, 4ca55ca3c): a dying design server appends `<ISO time> pid <pid> port <port>: <stack>` to
`.ethlete/cache/design-server-crash.log` (one per checkout, gitignored, never deleted on start), prints the path and
exits 1; the next server reports `ServerIdentity.lastCrash`. Bite: crash-log.spec fails without the module. Not verified:
a real end-to-end crash. The Studio "Design-Server abgestürzt" screen is not built; decided by the doc agent (look
question, night shift): after the human's 879 pick, the builder sketches a `crashed` state on elements/shell-main for
the human's pick by merge.

900 update (Linux, HEAD 77b0cc55c): the 120 s timeouts did not reproduce in 3 runs (128+129 on 2 workers, 128 alone,
128+129 with hold 14000). Case 128 now fails every run with "part opened after each merge:
sketch:components/zoom-chip@edit, ...". Suspect (code read): a race from the unpushed 487e24844: the merge removes the
sketch folder, the listing drops the sketch before `mergeSketch$` answers, SketchViewComponent is destroyed, and
`takeUntilDestroyed` swallows `mergeComplete.emit` (`sketch-view.component.ts` ~787), so `leaveGone()` never runs. Fix
(Linux, push blocker): Studio opens the part when a picked sketch leaves the listing after a merge; 128 is the bite.
Timeout diagnostics at `canvas.e2e.mjs:772` (785facf09) name the cause next time.

900 update 2 (Linux, 37841f237): the 128 race is fixed. Cause (bite): the listing drops the merged edit sketch before
`mergeSketch$` answers, so the merge answer is lost with the destroyed child. Fix: system-view owns the end of the merge
(an effect calls `leaveGone()` when the merging sketch leaves the listing while it is still picked). The spec fails
without the fix; 128 alone, 128+129, and 128+129 with hold 14000 pass. Not verified: the full suite. Each e2e run leaves
one orphan resident (6 now, about 4.3 GB), so the 955 teardown part is a push-suite blocker; Linux builds it next.

968\. Linux builder (2026-11-12 night, 907): a root `npx vitest related --run <file>` runs 705 files with no config
(694 failed) and leaves /tmp dirs; the builder's own subagent did it once. The builder skill says to run it per project, but
nothing enforces it. Cause (measured, 907). Tool fix (builder default, tool backlog): a root vitest config that refuses to
run and names the project dir to use, with a spec.

968 + 914 built (Linux, 9d366dbcc): a root `vitest.config.mjs` throws and names the project dir, `node --test` for
tools/** and `vitest.projects.ts`; `vitest.projects.ts` skips it. Root `npx vitest related` exits 1; a project-dir run and
`yarn vitest:projects:check` still work. Spec `tools/scripts/root-vitest-guard.spec.mjs` bites. The builder-agent skill
rule (779) names the project dir and `node --test` for tools/** (914). Not verified: the VS Code vitest extension.

946 closed (Linux, not a bug): `design check`, the slow runner and `design ready` write `ready.json` by design; Cause
(measured): they wrote fresh records at 01:31 and 03:50 after the 903 and 7f CSS changes, and the committed file is the
stale side. Decided by the doc agent (applies ADR 0009: the builder commits tool-written design records): the Linux builder
commits the working-tree `ready.json` of sdk and studio after a fresh `design check`.

941 built (Linux, 903012491): `design serve` logs `design-explore: heap <used>/<limit> MB` every 5 min and one WARNING when
the heap first passes 80 % (`heap-watch.ts`). Spec bites; live in a growing 2 GB process the WARNING came at 1817/2240 MB.

997\. Doc agent (2026-11-12, push-round merge): the merge of origin/next is blocked: design-to-code.md is 449519 chars
against the 440000 budget, and `archive-findings.mjs --dry-run` moves 0 even with `--days=0` (247 "no built line").
Cause (measured): the script counts a finding as done only by a done STATUS row or a line that starts with "Built"/"As
built" inside its own block. Since about 900 the agents record "NNN built (sha)", "NNN closed" and "Parked (ADR 0276)"
as separate paragraphs, and findings have no STATUS rows, so no finding ever qualifies and the file only grows. Lesson:
the archive rule and the record format drifted apart with no check. Tool fix (Linux, now, blocking): the script also
counts a finding as done when a paragraph that starts with "NNN built", "NNN closed", "NNN withdrawn" or a line in
parked-suspects.md names it; it moves the finding with all its "NNN update"/"NNN built" paragraphs; a spec bites on
today's format; the budget gate names `archive-findings.mjs` in its refusal.
