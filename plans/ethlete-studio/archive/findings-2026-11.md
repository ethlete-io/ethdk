289\. A merge regressed an embedding part unseen (builder, 2026-11-03, full studio check on a fresh dist). Full run:
29 parts, 271 findings, RENDER-TIMEOUT 0, and page-sketch draws, so B221 is done. B230 (50024f9b8) cleared the 13
spec type errors and dropped the filter; its node:test case still owes a red proof. New defect: 20 COVERED
findings sit in pages/system state comment-draft, where canvas-frames c's absolute overlay div covers the comment
draft (2 of 9 points, shot 6 of 25). The `--part elements/canvas-frames` run showed 0 COVERED and GO, so merging
c silently broke pages/system after its go. Why no tool caught it: a part-scoped check never runs the parts that
embed the part. Fix (B236, decided, technical): `design check --part X` also checks every part that embeds X, and
its GO line counts only when they pass as well. B237: Tom looks at pages/system comment-draft in Studio. If there
is a choice in the fix, the builder sketches variants; the pages/system go is then given again.

291\. B209 + B220a (builder, 2026-11-03). B209 07947d6ce: the identical-renders ready rule takes the first changed
state from shot's own pixel diff (shooter.changedBoxesOf) at framesOf()[0]. The behavioural red is quoted. The
real repro (finding 273) did not reproduce, not even on 9e94a2dc3, so its cause is unknown. shot-command.ts still
picks its frame inline. B239 (decided, technical): one shared frame helper for shot and ready. B220a 7e1759fef,
fa830a267: `sketch rebase` ports base changes 3-way per file, finding the old base in git by its baseline hash;
a conflict lists the files, writes nothing and exits 1. `sketch ready` on a ready sketch exits 0 "still ready".
Real repro, title-bar on d961cb00d: f/g/h conflicted on import line 1 although they already held the change, so
the builder added `--ported` (keep the hand-ported files) as an escape. Why no tool caught it: decision 272's
"conflict -> abort" never considered a variant that already holds the change. Into B220b: a conflict resolves on
its own when the variant side holds every line the product added. The rebased sketch is committed as
baseline-only. Tom's stale pick f stays uncommitted; his new pick overwrites it.

292\. Withdrawn variants read as Tom's rejection (builder, 2026-11-03, title-bar). b and e were withdrawn by the
drawing agent ("identisch mit a"). The ready rules skip them on purpose, and a pick refuses them. But
shot-command.ts:200 and Studio label them "rejected", so they read as Tom's own decision, and the shot diff
showed them with no change. Why no tool caught it: the label has one word for two actors. Fix (B240, decided,
technical): shot and Studio label a variant "withdrawn by agent: <reason>" when the agent withdrew it, and
"rejected" only when Tom did. Whether withdrawn variants are shown at all is Tom's product question. The
pickable set for title-bar is a, c, d, f, g, h.

### Withdrawn variant decisions (2026-11-03)

- Tom: an agent-withdrawn variant is hidden by default in the Studio sketch view and in the shot. A toggle in
  Studio (`--all` on the CLI) shows it again, labelled "withdrawn by agent: <reason>", so Tom can reopen it. Part
  of B240.

at: 12:13:42Z}` and the sketch dir is gone, so B228 is proven on the real case. B240's shot part is
behaviourally red-checked. B240 Studio toggle: where the toggle goes is a look question, so the builder sketches
it on design-parts/sketches, and Tom picks.

components/title-bar --prodct studio`. The behavioural red is quoted. Why no tool caught it: argsOf had no list
     of valid switches, so no spec could assert a refusal. Gaps, which go into B227b (decided, technical): `sketch`
lists the union of its subcommands' flags; check.ts, new-call.ts, product-command.ts, system-command.ts and
visible-change-command.ts parse argv by hand and ignore unknown flags; commit-hunks exits 1 on bad usage
instead of 2 (align it and its specs). B240 data side 0f7c28b68: hideWithdrawn defaults to false, and the view
wiring waits for Tom's pick of the control sketch.

295\. Title-bar f merge, 0c full studio check (builder, 2026-11-03, after 72ecd0adb): exit 1, 29 parts, 270
findings. components/title-bar has 0 problems and 1 warning: CLASS-GLUED-INTERPOLATION in title-bar.ts, where
`gap-2` is glued to a `${...}`, a latent dropped class (296 corrects the effect). Why no tool
caught it: the code is only a warning, so sketch check, ready and merge let the variant through, although a
glued class in a design file is always a dropped class. Fix (B242, decided, technical): CLASS-GLUED-INTERPOLATION
is a problem in design files and blocks ready and merge. The f defect itself is fixed in a tidy commit before
Tom's go.
20 embedding parts went stale with the merge (shell-main, flows, inbox, inventory, merge, sketches, system, ...).
"No new problem from the merge" is unproven: the pre-merge run was lost, and nothing kept a baseline. Why no
tool caught it: a merge does not name the parts it makes stale, and does not check them. Fix (B243, decided,
technical, extends B236): a merge prints the embedding parts it made stale and checks them before and after,
reporting only the new problem codes.

296\. B238 close-out + B242 (builder, 2026-11-03). B238 d154e79ce: readVitestReport/verdictOf, with the fixture
red-check.vitest-report.json captured from a real vitest run (crash only gives RED BY CRASH; crash plus
assertion stays RED). B242: a62942f0c un-glues title-bar.ts:74, 8833cb290 makes CLASS-GLUED-INTERPOLATION a
problem (blocks sketch ready, merge and prepush, behavioural red). With the rule on, it found one more case:
canvas-frames.ts:100 `bg-et-surface-bg${extra}`, fixed in 706f18805. Now 0 in the repo. Correction to 295: no
drawing changed. Both classes are also used unglued elsewhere, so Tailwind emitted their CSS anyway, and compare
and pictures saw no difference. The defect was latent, and the only signal was a warning nothing blocked on.
Both tidy fixes change no pixel, so neither needs a sketch.

<part> --by x`now exits 2); commit-hunks exits 2 on bad usage. check.ts and the visible-change flag already
     refused. Red-check RED. Defect: B227 (2699545b4) committed 2 max-params lint errors and a guard-return-newline,
     fixed in 75a0174b1. Why no tool caught it:`yarn commit`runs the specs but not lint, and lint ran only at
     pre-push, which is 523 commits away on next. "The builder should remember" is no fix. Fix (B244, decided,
     technical):`yarn commit`runs`nx lint` on the projects of the staged files (cached, so cheap) and refuses the
commit on a lint error.

commit`derives the selection from the spec list of`yarn test:tools`: a staged file in a directory that holds
such specs runs those specs. A new directory in test:tools is then covered without another patch.

300\. B245b as built (builder, 2026-11-03). 004169aa0: `yarn commit` and the hook read the spec globs of
`test:tools` from package.json at the tested tree (toolSpecGlobsAt), and a staged file under a glob's directory
runs that directory's specs with `node --test`; tools/scripts and apps/ethlete-studio/eslint-rules are covered
now. Verified: e2e case with a `tools/lint/*.spec.mjs` glob refuses a failing change; red-check RED.
Also found: `design check` after a62942f0c carried the go of elements/shell-main and pages/inventory
(refreshedBy "design check", the decided B219/B223 carry), and the builder left that refresh uncommitted. Why
no tool caught it: check writes go.json silently and no commit gate sees an uncommitted refresh. Recommended
B246, sent to the grill session.

### Go carry decisions (2026-11-03)

- Tom: the go system is not extended any further; its rework (A10, "build-ready" replaces go and acceptance) is
  pulled forward now. So no rule on who commits a go carry, and B246 is dropped: both are go-system extensions. The
  go.json already in the tree (Tom's title-bar go plus the carries) is committed once as it is.

302\. B241 + B240 sketch + B244 at work (builder, 2026-11-03). B241 715f4857f: a Tauri command appends
`<ISO> <command> part=<p> status=<n> <message>` to /tmp/ethlete-studio-design-actions.log on every refused
design action (cargo test, 4 vitest cases, red-check RED; not yet exercised in the real app). B240 sketch
5e51db22a on pages/sketches: A an entry in the round select, B an SDK switch beside it (agent's pick), C a muted
footer row; Tom picks. go.json committed as it was in 66e71e8e3 (Tom's title-bar go plus the carries of
shell-main, inventory, system). B244 caught its first real case: HEAD carried two ethlete-studio lint errors
from 0f7c28b68 (max-params on sketchRoundsOf, click-without-key on the comment-draft div), fixed in 8bf9046ca.
Why no tool caught it then: 0f7c28b68 predates B244; the gate is the fix, no new item.

305\. B247 as built (builder, 2026-11-03, 74501d02b). INLINE-UI-IN-PAGE is a problem rule. The detector
(rules/inline-ui.ts, `inlineUiOf(source)`) reads string and template literals through the TS AST and flags
button/input/select/textarea, raw `<et-*>` tags and `et-*` attributes, and markup with an interactive role,
tabindex or data-et-action; `data-et-part` tags are skipped. It runs on page parts plus their relative/@shared
imports, and on sketch variants, so it blocks sketch ready and merge. Open list OPEN_INLINE_UI
(rules/inline-ui-in-page-open.ts): 14 entries keyed by product + place + anchor + kind, with an exact count and an
owner. An unlisted hit, a count overrun (on every hit of the group) and a stale entry (fewer hits than count) are
problems; a listed hit is a warning. Red-check: every mutation failed the spec. Renaming an anchored const gives an
unlisted problem plus a stale entry, as intended. The survey in finding 303 missed 2 more regex patches (`loading`
in merge.ts and system.ts write `<button data-loading>` into embedded markup); B248a owns them. COMPONENT-COPY gap
confirmed: it matches only component-part CSS classes, so it missed inbox.ts:309 and :316-335. Decision
(technical): the gap stays closed inside INLINE-UI-IN-PAGE (raw et- markup names the part to embed); COMPONENT-COPY
is not extended, because a second rule would report the same place twice and need its own list. B248a: the first
sub-agent ran out of context with nothing committed. A fresh one finishes it in slices, with a per-part pixel proof,
shrinking OPEN_INLINE_UI in the same commits. The extracted parts have no hover/active/focus-visible looks (the
inline originals had none either). That becomes design work for Tom as sketches, and CONTROL-PART-MISSING becomes
CONTROL-PART-INCOMPLETE.

306\. Red frames on the B240 sketch (Tom, 2026-11-03). In Studio, pages/sketches showed "Failed to fetch
dynamically imported module .../pages-sketches/a/pages/sketches/sketches.ts" in 3 states for the base, a and b,
while the badge said "Wartet auf deine Wahl". Cause (builder, not reproducible afterwards): the B248a sub-agent
edited pages/sketches files while Studio loaded those states. Vite failed one request mid-edit, and the browser
caches a failed dynamic import for the page's lifetime, so the frames stay red after the file is fixed. Why no tool
caught it: `sketch ready`/`sketch check` render every state, but on the CLI's own fresh design server, not on the
Studio dev server the user looks at. Their verdict was right; Studio never retries a failed frame and still offers
the pick. Fix (B254, decided, technical): in the sketch view, a variant with an errored frame shows no Übernehmen,
the badge says the round has a render error, and an errored frame re-imports (cache-busted) on the next
design-server change event; a sketch-view case joins the frame-load-failed e2e suite. Side facts: the B240 sketch
holds its own copies of sketches.ts and shared/sketch-status.ts with holdTrigger inline, so it is rebased onto the
B248a page before Tom's pick is merged (no picture change). The warning triangles in the part tree on inbox, merge,
sketches and system are the listed OPEN_INLINE_UI hits, but their title says "Render-Check: 1 Warnung"
(tree-row-item.component.ts:59). Fix (B255, decided, technical): the tree warning title names the rule and the
owner, so the user can tell an open-list entry from a render warning.

307\. B248a as built (builder, 2026-11-03). e7c26984e: the sdk button design mock gets `loading` (real loader
markup, spinner sized from BUTTON_SPINNER_CONFIG), red-check RED. 27804bf45: the page-local controls move into the
new parts components/comment-row, list-row, hold-trigger and comment-target (comment-target is declared a
control); the sdk switch passes options.attributes through; the merge/system `loading` regexes and the
capabilities.ts act/titled regexes are gone; all 10 B248a OPEN_INLINE_UI entries are removed in the same commit.
red-check says NOT RED (no spec changed), so the gate is the rule: INLINE-UI-IN-PAGE went from 10 listed hits to 0,
leaving the 5 B248b warnings. Pixel proof by `design shot --states` from HEAD vs tree: 0 px on inbox, sketches,
system, sdk button and sdk switch. merge differs in one band of the embedded thumbnails, but two HEAD-only runs
differ in the same band. Three new defects:
(a) Stale mocks: the design server reads the mocks from dist/libs/components/design, and the agent copied the new
button.ts there by hand. A check on a stale dist renders the old mock without a word. Why no tool caught it: nothing
compares libs/components/design with dist. Fix (B256, decided, technical): a problem, not a warning (finding 295).
`design check`, `sketch check`/`ready` and `design shot` refuse to run on a stale dist and print the build command,
and the design server shows the same refusal as a banner in Studio.
(b) Restyled embed: the sdk switch part draws an unchecked-track border that the inbox switch never had. The page
embeds the part but passes switchStyles to stay pixel-identical, so the page and the part look different. Why no tool
caught it: no rule flags an embed that overrides the embedded part's look. Fix (B257): a sketch for Tom on the sdk
switch, with and without the border; after his pick, the page drops switchStyles. Whether a style override on an
embed becomes a rule is decided after B257.
(c) Flaky picture: merge shots differ between two runs of the same files, so no pixel proof on merge can be trusted.
Fix (B258, decided, technical): find the nondeterministic source in the merge thumbnails and make it stable.
`design shot` runs each state twice and reports a part whose two runs differ as a problem.

308\. Owner of the canvas e2e red "a listing refresh re-navigates no iframe" (B232, finding 287), found by bisect
(builder, 2026-11-03). First bad commit is 030fe2f36 ("Draw the round 2 Sketches page in the sketch view"); its parent
f05409524 passes with 0 navigations. B241 is not the owner. Mechanism: the iframes are destroyed and recreated, not
re-navigated. Each refresh reads the listing twice (concat(quick, full), system-view.component.ts:511). The quick
read has no `unchanged` list, so every shot gets changed:null (system-tree.ts:1382), and an all-unchanged variant row
lands in changedRows, which renders its iframes. The full read then sets changed:false, and sameRows
(sketches.component.ts:243-250) moves the row into the collapsed "same" group, so the iframes are destroyed. This
repeats on every refresh. The sketch view shares the path, but it only flashes all-unchanged variants, so it does not
explain Tom's single slow frame (finding 306). Untested candidate for that: sketchRevisionOf
(studio-view/frame-revisions.ts:109-123) gives one revision to the whole sketch, so any redraw changes every frame's
src. Why no tool caught it: when 030fe2f36 landed, the canvas suite crashed in setup (it ran `git archive` on the
elements-shell-main sketch, which 5a29b1b94 had deleted, from 155777af9 to 8d5d281cb), and before 03d197841 e2e-check
did not count a crash before the first case as a failure. When the suite ran again, finding 287 filed the red as a
separate bug without a bisect. The STATUS B197 line "e2e-check 4221e7cb3: canvas 104/105" cannot be true, because
that revision's own suite crashes in setup, so the run used an uncommitted tree. Fix (B232, decided, technical): the
quick read's changed:null means "unknown" and keeps a row in its previous group until the full listing arrives.
Fix (B259, decided, technical): e2e-check always runs the suite from a clean worktree of the named revision, never
from the working tree, and prints the suite's own sha. A red that appears in an e2e run is bisected before it is filed
as a separate bug. Fix (B260, decided, technical): probe sketchRevisionOf. If a redraw reloads unchanged frames, the
revision becomes per frame (one picture, one revision).

309\. Tree marks (B254/B255 results, builder, 2026-11-03). B254 built in 9e7ebf434: a variant with an errored frame
offers no Übernehmen, and the badge reads "Render-Fehler in dieser Runde" (red-check RED; e2e pending under B259).
The badge reuses the neutral tonal badge, and sketch-status.ts has no such status. Its look goes to Tom as a sketch
(B261). B255 as specified was moot: the live part title already names the rule (system-tree.ts:289), and the
open-list warnings never reach the tree (list-system.ts:322 sends only ruleProblemsOf). Facts on the live server
(HEAD 855305f90): no part and no sketch carries a mark now; Tom's Studio is a dev build from 09:59, so an old
build is ruled out. The triangles Tom saw were most likely error-level INLINE-UI hits while B247 was uncommitted
and had no open list yet. Two real defects: (a) a sketch entry with a problem gets title = sketch.target
(system-tree.ts:121), so its tooltip names the target path, not the variant or the rule; (b) the listing carries
5 product-level problems that the tree never shows (SAMPLE-DEFAULT inbox.component.ts:72; UNBOUND-INPUT
system-page.component.ts commentMode, draft, send, reason), because they are not attached to the part whose file
they sit in. Why no tool caught it: nothing compares the problems in the listing with the problems the tree draws.
Fix (B255, decided, technical): a sketch entry's title lists "<variant>: <rule>: <message>" per problem; a
product-level problem attaches to the part that owns its file (one product row only when no part owns the file);
a spec asserts that every listed problem reaches some tree row.

311\. A state was renamed to dodge the ongoing-work motion rule (builder, 2026-11-03, B248b). The comment-draft sketch
drew the send state as "sending" because the check demands a looping motion for a state named "busy". The app calls
it 'busy' (CommentSendPhase in apps/ethlete-studio/src/app/design-parts/system-page/comment-draft.component.ts) and
shows a loading button there. Why no tool caught it: isOngoingWork in libs/cli/src/lib/design/system/open-points.ts
matches words in the state NAME, so a name without those words switches the rule off, and nothing compares sketch
state names with the app. Decision (technical): the sketch state is "busy" and draws the loop (the button's loading
spinner). Tool fix (B263): a state also counts as ongoing work when its render holds aria-busy="true" or a loading
button, whatever its name; when the part has an implementing app component, its state names must match that
component's phase values, and the check names the mismatch.

313\. The merged comment-draft card is a double surface in the inbox dialog (builder, 2026-11-03, B248b wiring
9cb6ce68e). Tom picked variant a, the bordered, filled card. In the inbox it sits inside the anchored-dialog
pane with a ~12 px dark band around it, and the comment-entry state grew from a 1-row field to a 3-row field with
Abbrechen. The sketch showed the part alone at 360px, never inside its hosts, so the pick could not show this.
Why no tool caught it: no rule flags a filled, bordered surface whose only parent is another surface pane, and a
sketch of a new part renders no host page. Decision (technical): B265 sketches the inbox dialog host for Tom with
two variants, (a) no dialog pane, the card placed directly (builder's pick), (b) a no-card variant of the part
for dialog hosts. Tool fix B266: a NESTED-SURFACE problem for a part root with its own fill and border that is
the only content of another surface; and a sketch of a part that already has hosts also shoots each host page.

316\. A timing case of the e2e suite fails under machine load (builder, 2026-11-03, B232). `yarn e2e-check 21dcfc17f`
passed canvas 109/109, but sketches-tree "first sketch row after reload" took 5943/2916/2782 ms against a 2000 ms
budget at a load average of about 19; two reruns at normal load took about 700 ms. Why no tool caught it:
e2e-check reports a timing budget as PASS or FAIL whatever the load, so a busy machine reads as a regression.
Decision (technical, B270): e2e-check prints the 1-minute load average and the core count with every result; a
timing case that fails while the load is above the core count reports "NOT MEASURED (load <n>)" instead of FAIL,
and the slice stays unverified until a run below the core count passes. Behaviour cases keep failing as before.

317\. The inbox host sketch for comment-draft (B265, 153ca659d, builder, 2026-11-03) shows two more blind spots.
(1) A card moved out of its dialog pane fell back to the base surface and drew almost black, with no warning,
until data-et-auto-surface was added. (2) Variant b gets its no-card look by stripping the part's class string in
b/pages/inbox/bare-comment-draft.ts; STALE-REPLACE does not catch it, and the same kind of hack sat in the inbox
editor pin until B248b. Why no tool caught them: no rule compares a filled box with the surface around it, and no
rule looks at string rewrites of a part's rendered markup or classes. Decision (technical): B266 grows to three
checks: NESTED-SURFACE (a bordered, filled box whose nearest surface pane draws the same background, with only
padding between the edges), LOST-SURFACE (a filled card whose fill equals the canvas around it), and
PART-REWRITE (a page or sketch that rewrites an imported part's markup or class string instead of passing an
option). A merge of variant b turns the strip into a `card` option on comment-draft.

319\. The clean-worktree e2e-check may be red on any sha (builder, 2026-11-03, B232 rerun on the B259 script). `yarn
e2e-check 21dcfc17f` at load 15-21 of 32: canvas TIMEOUT after 180 s with no case reached (the old B254 symptom,
now on another sha), and sketches-tree "first sketch row after reload" 5831/3134/3215 ms against 2000 ms, while warm
reruns on the main tree take about 700 ms. Hypothesis, not verified: the fresh worktree builds cold, the build
prints nothing for over 180 s, and the first reloads hit uncompiled chunks. Why no tool caught it: the watchdog
cannot tell a silent build from a hung suite, and a timing case has no warm-up. Decision (technical): verify
first, by two runs in a row plus the time of each suite server's ready line. If confirmed, B270 also does this:
the build phase has its own limit and message ("BUILD TIMEOUT", not a suite timeout), the idle watchdog starts at
the server's ready line, and each timing case does exactly one warm-up load outside the budget. Until then a
canvas TIMEOUT with no case reached proves nothing about the sha, which also applies to the B254 hang.

321\. The render-error badge sketch (B261, 0eb774996, builder, 2026-11-03) needed the same manual step as B253: variants
copied before B269 lacked `controls: {}` and passed ready only after a hand copy plus `sketch rebase --ported`.
The second hit in one day moves the low-priority note of finding 320 into the queue. Why no tool caught it: sketch
rebase does not compare a part's declaration (controls, motions, states) between Aktuell and the variants.
Decision (technical, B274): `sketch rebase` carries a declaration-only change of the part into every open variant
on its own and prints what it carried; a spec rebases a sketch after `controls: {}` is added to the part.
Also from B261: the new `failed` state does not fit the exported SketchStatus (pages/sketches tags map, TS7053),
so the variants use SketchBadgeStatus = SketchStatus | 'failed'. A merge adds `failed` to SketchStatus and the
tags map instead; showing the badge on the sketches page is its own pages/sketches sketch after the pick.

322\. The B256 Studio banner shipped as visible UI without a picked sketch (builder, 2026-11-03, 14bf51766). Finding
307 decided "a banner", but no sketch fixed its look or placement; the builder placed an SDK warning et-banner
top-left over the canvas. Why no tool caught it: nothing refuses a commit that adds visible app UI with no picked
sketch or implements link behind it. Decision (Tom's standing rule: any look goes to a sketch): revert only the
visible hunks (system-view.component.ts/.spec.ts, studio-labels.ts); the /__design/stale-mocks route and the
stream stay. Then sketch the banner on the system view page for Tom. Tool fix B275: a problem UNSKETCHED-UI for
an app template diff in a design-part or system-view file that adds an element or label with no picked sketch or
implements entry behind it.

323\. The B267 stale-CLI guard broke the e2e suite server-restart (builder, 2026-11-03, e2e-check of 117eb20bb). In the
throwaway e2e tree the guard refused "This CLI build is stale" before the first case, because that tree's
dist/libs/cli carries no matching source hash. Why no tool caught it: B267 changed the CLI entry and build but ran
no e2e-check, since the rule asked for it only on view slices. Decision (technical): fix slice B267b (the hash is
part of the nx build output; no refusal for shas before 91aadd6dd), and the slice rule widens: any change to a
libs/cli entry point, build target or guard also quotes `yarn e2e-check <sha>`. B255 (117eb20bb) stays 🔨 until a
clean e2e run and its red-check line; a frame-load-failed miss of the render-error badge (1 of 2 runs) is open
until B270 lands.

324\. The cold-worktree hypothesis of finding 319 is wrong (builder, 2026-11-03, B270 part 2, two runs of
`yarn e2e-check 21dcfc17f`). The build takes 14 s and the load stayed below the 32 cores, yet canvas stalls after
the build and before its first case in every run, and sketches-tree misses its budget at load 6.4 (reloads
5808/2616/2629 ms against 2000). Second fact: the e2e worktree symlinks the shared dist, so it tests whatever
dist another agent built last, not the sha. Why no tool caught it: B259 promised "the worktree is the revision"
but nothing checks that the dist inside it was built from that revision. Decision (technical): no BUILD TIMEOUT
or warm-up gets built. B267b gives the e2e tree its own dist built from the sha; until then every e2e verdict on
a dist-dependent commit is suspect. Then B270c logs the design server ready line, the chromium launch and the
first case with timestamps in tools/scripts/verify-studio-headless.mjs and reruns once. The sketches-tree budget
miss at low load counts as a real defect until B270c explains it. The B254 bisect follows B270c.

325\. Tom's picks (2026-11-03) and two process corrections. Picks: B240 variant b (switch beside the select), B257
variant b (no border, 38% fill), B265 variant a (no dialog pane, the card sits under the pin). Tom reports that
the B240 sketch shows render errors in Studio, although `sketch check` and `sketch ready` passed and the builder
read the shots. Why no tool caught it: unknown, the builder traces it before the merge; the lesson follows the
cause. Correction 1: a sketch pick is never a chat grill question; the grill session only says which sketches
wait in Studio, and Tom picks there. Correction 2: a question about one rule's display is too narrow when there
are hundreds of checks. Decision (technical, replaces the INLINE-UI tree question): warning-level problems of any
rule get no tree mark; they show in the part's detail only. The tree marks errors.

326\. B267b (00fafc71f, c0c163c4a) removes the stale refusal in the e2e tree: the tree builds its own cli dist and
`cliBuildProblem` fails the run when the dist is outside the tree or its source hash differs. Two defects remain.
(a) 5e525ca9b makes the B267 guard skip when the build dir resolves outside the checkout: a silent pass for any
tree that symlinks dist. Why no tool caught it: no spec asserts that a guard never passes without comparing; the
skip was written to quiet a symptom. Decision: drop the skip, not turn it into a warning (finding 295). The guard
compares the source hash wherever the dist lives; match passes, mismatch refuses. A spec covers a symlinked dist
with a matching and a differing hash. (b) The e2e-check spec that reads `git worktree list` flakes while other
agents hold worktrees, and e2e-check.mjs and its spec carry lint errors (empty catch, empty arrow). Why no tool
caught it: the spec reads machine-global state, and the lint errors predate the pre-push lint scope. Fix: the
spec asserts only the tree's own worktree path; the lint errors get fixed. The real run e2e-check 117eb20bb shows
0 stale but 3 FAIL at load 15-23 of 32 cores: canvas crash at canvas.e2e.mjs:1295 (waitForFunction timeout),
frame-load-failed 121 s, server-restart 121 s. Load is below the core count, so these are real failures until
B270c explains them; B255 stays open on them.

327\. B263 (f7f7f3b17) lands the finding-311 fix in the draw path: render-check marks a state whose drawing holds
`aria-busy="true"` or `data-loading="true"` as busy, and ongoing work counts it whatever its name. New rule
STATE-NOT-IN-COMPONENT reads the linked component's phase/state union. Decision (technical): the narrow reading.
A state that sets a phase value must be named after it (`busy`, `busy-<detail>`); a state that sets no phase
(`empty`, `typed`) is free, since input states are no app phases. Two gaps. (a) The rule found 0 hits today
because the B248b comment-draft sketch had no `implements` link; with the link added to the 87fffd218^ source it
flags "sending". Why no tool caught it: IMPLEMENTS only checks a link that exists; nothing asks for one, so every
component-reading rule is silently skipped on an unlinked part. Fix: a part without `implements` whose name
matches an existing app component gets a problem that names the path (count the hits on studio first; each is
either linked or explained). (b) sketch check and sketch ready still see state names only, because
sketch-command.ts does not pass `rendered.busy`. Finding 311 happened in a sketch, so B263 stays open until that
wiring lands (with B264b, after B272).

328\. Correction to finding 325 (builder, B255b). The premise was stale: list-system.ts fills `part.problems` from
error rules only, so no warning reaches the Studio tree today, and the part detail has no problem list at all.
Why no tool caught it: the decision was taken from the rule list, not from the listing code, and no spec pins
which severities the listing carries. Decision: the policy already holds; no new UI. Warnings stay in the CLI
output of `design check`; "detail only" from finding 325 is dropped. B255b becomes a spec: a warning-rule problem
never enters `part.problems`, with a mutation that lets one in and turns it red. The same slice gives
system-tree.spec a red proof by mutation, since its red-check on 117eb20bb only fails to load.

329\. Cause of the B240 render errors Tom saw (finding 325). Variant b's code is fine. The Studio sketch view of
pages/sketches mounts all 84-91 iframes at once; each loads an unbundled Vite page graph, and Chromium (and CEF in
the Linux app) refuses requests past its per-renderer budget: 450-1200 net::ERR_INSUFFICIENT_RESOURCES on
/__design/render and /@fs, frames fail with "Failed to fetch dynamically imported module". A refused import fails
its frame for the document's lifetime, and the B254 retry fires only on the next design-server change, so the
frames stay red. Every state renders alone. Why no tool caught it: render-check.ts opens one frame at a time in
one page, so sketch check, sketch ready and the shots never load at Studio's concurrency; the check and the view
take different loading paths. Finding 306's import failure on this sketch was most likely the same cause. Fix:
(1) the sketch view loads frames through a bounded queue (src set only while fewer than N frames load; a frame
leaves on its first height message or a timeout); (2) a Studio e2e opens the real many-state sketch view and fails
on any errored frame or render-error badge, red today. Decision (technical): (3) check and ready load a sketch's
frames through the same queue module with the same N as Studio, not one at a time and not all at once, so the
check takes Studio's path; a mutation that unbounds N must turn a check spec red. B240 merges after (1) and (2).

330\. B273 (finding 320, CLIPPED inside SDK internals) does not reproduce. On elements/variant-cell a/b/c, the sketch
check and the part check show no CLIPPED, also with every `data-et-skip="CLIPPED"` removed; the drawn states
include the b "Lädt" badge with the spinner, so the spinner path is rendered. The earlier CLIPPED most likely came
from an older cli build. Why no tool caught the leftover: a skip that suppresses nothing passes silently, so dead
skips pile up and will hide a real clip later; SKIP-SCOPE only judges where a skip sits, not whether it is needed.
Decision (technical): rerun the variant-cell check once on a fresh `nx build cli` (the shared dist was older than
src); if still clean, delete the dead skips and close B273. New rule SKIP-UNUSED (B279): a `data-et-skip` that
suppresses no problem in any rendered state is a problem naming the element, so a skip lives only while it hides
something. Count its hits on studio, studio-lab and sdk before landing; each is removed, not suppressed.

331\. Contradicting instruction in the check output (builder, 2026-11-03). After the pages/system carry refresh
(go kept by auto refresh, committed 3eb81ca97, 0f3b2d4f6 through commit-hunks), the check printed "WARNING
UNCOMMITTED-DECISIONS ... Studio or Tom commits them; an agent never commits go.json"
(uncommitted-decisions.ts, 66f1acb49, 2026-11-02). That rule was superseded by the go carry decisions after
finding 301: Tom set no rule on who commits a carry, and agents commit carries of their own parts through
commit-hunks (66e71e8e3, d16ea1786, 3eb81ca97 stand). Why no tool caught it: the message text is a hand-written
rule copy, and no spec ties tool messages to the plan's current decisions. Fix (technical, no go-system
extension): the warning names the files and the commit-hunks command to run, and drops the "never commits"
clause; a spec asserts the message names commit-hunks. The rest of that check run (145 findings, exit 1) is
sorted separately: LOST-SURFACE comes from b266's uncommitted rule, the STALE line is stale SDK mocks
(`nx build components`), SKIP-SCOPE/COVERED/DROPPED-PROP need a count on HEAD alone.

332\. B261 sketch shows three identical variants (Tom, 2026-11-03, Studio screenshot). components/sketch-status-badge
round 1 "Render-error status": Aktuell, a, b and c all draw only drawing/waiting/paused/idle; the render-failed
badge the round is about appears in no row, so Tom cannot pick. The variant notes describe three different
looks. Cause unknown; candidates: the matrix takes its columns from the base part's states and drops a state only
the variants declare, or the variants never added the state. Why no tool caught it: unknown until the cause is
known; neither sketch check nor sketch ready refuses a round whose variants render pixel-identical to each other
and to Aktuell in every shown column. Fix (technical, B281): trace the cause first and report it; then a round
whose variants all match pixel for pixel in every state Studio shows is a problem in sketch ready, and the
sketch view shows every state any variant declares. B261 goes back to the builder; no pick from Tom until fixed.

333\. B265 go and B278 (builder, 2026-11-03). (a) The grill session told the builder to record the pages/inbox go with
`--by tom` under Impl Q15; the CLI refused (TTY confirm, Impl Q119, b873da3ee), and the builder then prepared a
go batch file for Tom. Both were wrong: Impl Q119 replaced Q15/Q45, and finding 74's direction says Tom approves
only by a click in Studio, never by a command or batch file. Why no tool caught it: the decisions list keeps
superseded entries (Q15) without a "replaced by" mark, so a reader of Q15 alone acts on a dead rule. Fix: Q15
and Q45 get a "replaced by Impl Q119" mark; the batch file is deleted; pages/inbox waits for Tom's go click in
Studio (A10 replaces the go). (b) B278 3675d9c5f: capabilities.json named comment-write emit:send, but since
9cb6ce68e the inbox draws the shared comment-draft whose send button declares emit:sendComment; the data was the
wrong side. The app still emits `send` from comment-draft and InboxComponent, so design and app disagree.
Decision: the app output is renamed to sendComment in a part commit. Why no check caught it: CAPABILITY-PLACE
runs only in the full check and its own spec; a design-part commit does not select it. Fix: the part check and
`yarn commit`'s related specs run CAPABILITY-PLACE for every capability whose place names the changed part.
(c) `design actions pages/inbox --state comment-draft` reports "has no interactive element", so the send button
was never pressed; cause unknown, the builder traces it. (d) commit-hunks wrote capabilities.json unformatted
(d983abfc5 reformat, same data); commit-hunks must write Prettier-formatted JSON, spec on a real file.

334\. B270c (builder, 2026-11-03, f59f1c5f9, b9c558b37). The 5e525ca9b skip is gone (symlinked dist: matching hash
passes, differing hash refuses; red-check RED), the harness and e2e-check stamp their phases, the worktree spec
asserts its own path, lint is clean. B267's proof landed: full `nx build cli`, `design --help` rc 0. e2e-check
21dcfc17f twice (load 16-28/32, then 6.1/32): canvas FAIL at canvas.e2e.mjs:1295 and sketches-tree FAIL (cold
load) in both runs, so deterministic, not load. Cause 1: suites pin DE_PORT; on a busy port the cli prints
"Port ... is already in use" and keeps running, the harness waits only for "Local:" and hangs 180 s, the
watchdog SIGKILL skips `finally`, and the orphan server holds the port for the next run (loop reproduced; 7
orphan canvas servers were found). Why no tool caught it: a busy pinned port is not an error anywhere, and no
invariant checks that a run leaves no server behind. Fix (B282): the cli exits non-zero on a busy pinned port, the
harness fails on that line and takes a free port, e2e-check kills the process group, and an e2e-check spec
asserts no design server outlives the run. Cause 2: in an e2e worktree GET /__design/system (and /stamp,
/comment-events) does not answer within 12 s, while the main tree answers at +4.2 s; not found yet (untracked
or gitignored artifact, or cold vite optimize). sketches-tree's budget miss is likely the same. frame-load-failed
and server-restart are re-checked after B240 phase 2.

335\. B256 banner sketch empty in Studio (Tom, 2026-11-03, screenshot). pages/system round 1 "Veraltete Design-Mocks"
shows about 20 rows x 4 columns of empty frames at 25 % zoom. The builder had reported "all 6 frames render" from
the sketch shot. Two causes. (a) The frame flood of finding 329: the view mounts every frame at once; the bounded
queue (B240 phase 2) has not landed. (b) The shot and the Studio view draw different frame sets: the shot drew the
round's 2 new states (stale-one, stale-many) plus `part` per column, Studio draws every pages/system state per
column. Why no tool caught it: the builder's proof was the shot, and nothing ties the shot's frame set to what
the Studio view mounts. Fix (B284): the sketch shot draws exactly the frame set the Studio view mounts (one
shared list function), and a spec asserts both lists are equal for a round. Open question for the builder: should
a round show only the states it touches (plus a reference state) instead of every base state; recommend with
facts. B256 is not pickable until B240 phase 2 lands and the view renders.

337\. The B264b slice (busy sketch renders count as ongoing work, motions hint in every check) is spec-green in the
tree but uncommitted: `yarn commit` refused twice because its related-spec run in the HEAD worktree failed
`motion-shot.spec.ts` (72 instead of >= 300), the B268 flake. The flaky spec does not touch the changed code. Why
no tool caught it: B268 was reopened as a flake but queued behind other work, while the commit gate still runs
the flaky spec for every slice that shares its related set; one known flake blocks unrelated slices. Fix: a
reopened flake in a spec the commit gate runs goes to the head of the builder queue (B268 before B264b's
commit), and the B268 fix drives the motion steps from the fake clock, not the wall clock. Open B264b caveat:
merged-side busy is passed as [], so a busy state the merged part already has under a non-loading name shows
as "added" in a sketch; the builder states whether that needs a row.

338\. Rebasing the pages/sketches sketch (7a47470cd): `sketch rebase` refused because variants a/b/c and the product
all changed sketch-rows.ts, sketch-status.ts and sketches.ts. A hand port was started, but nothing needed
porting: the shared files were byte-identical to the product and every variant already carried the product
commits, and `sketch rebase --ported` succeeded at once. Why no tool caught it: the rebase compares "changed on
both sides" by file, not by content, so an already-applied change looks like a conflict. Fix: `sketch rebase`
treats a file whose variant and product content already agree (or whose product delta is already in the
variant) as ported and rebases without asking; it refuses only on a real content conflict and names the hunk.
Queued in the builder handoff, not started (Tom: no new topics, 2026-11-03).

339\. Tom's merge of pages/sketches variant b (2026-11-03, after the 7a47470cd rebase) failed: the post-merge check
reports PART-REWRITE at pages/sketches/sketches.ts:175 (`replace(/ data-et-action="[^"]*"/)` rewrites
components/disclosure) and restores the product's old files. The builder had just reported `sketch check` exit 0
with that same PART-REWRITE per variant and said "Tom can look again". Why no tool caught it: `sketch check`
lists PART-REWRITE without failing, the merge check fails on it, so the same problem is a note in one gate and a
blocker in the other; and the builder reported the sketch pickable without asking whether the merge gate
passes. Fix: `sketch check` and `sketch ready` fail on every problem the merge check fails on (one shared
blocking set, a spec that compares both); a sketch whose variants carry a blocking problem is not offered for a
pick. Order: B286 (disclosure gets an option without data-et-action, the product and all variants pass it)
comes before the pages/sketches merge, together with finding 325.

340\. Tom asked to push `next` at the end of 2026-11-03 (686 commits ahead). The pre-push hook's Studio
visible-change gate failed: 4 parts look different in e3914fb4e..HEAD without a picked sketch, 7 states unjudged:
elements/canvas-frames (selected, active, load-failed, loading, rounds, round-folded) and pages/system (the harness
finds no "49 offen" button to force focus-visible on for part-focus-visible). Nothing was pushed. Why no tool
caught it: the gate runs only at push, and the day's slices were reported done on red-check and e2e-check
alone, so a day of visible drift piled up unseen. Fix: every view slice report also quotes the visible-change
gate for its range (`node tools/scripts/prepush-checks.mjs visible <base> <head>`), and the builder runs it
before reporting a merge; a state the harness cannot drive (missing focus target) is a check problem on the
part, not an unjudged push failure. First item tomorrow, before A10: make the push pass.

341\. The push of 2026-11-03 (finding 340) passes every hook check after 1b2692ae9..1eb7277e8, except
components/title-search: 3aae1d37c split it out of title-bar, db86c73d9 and 6e3c4f00b changed its look, and
no sketch of it was ever picked. Tom picks it in Studio. The gate now passes a state that neither the base nor
the HEAD app can be driven into as "undrivable, a problem of the part" (Tom kept this rule). pages/system has
two such states (part-focus-visible, points-closed-focus-visible): the design chip counts exceptions ("49
offen", Tom's pick c02c7aede), the app chip counts only open points, and the app has no exceptions group and
no footer. Open task: implement those in apps/ethlete-studio/src/app/design-parts/system-page/. The four
comment inputs of system-page (commentMode, draft, send, reason) are on KNOWN_UNBOUND_INPUTS, because no app
template uses the component yet.

342\. Correction to finding 341: Tom cannot pick components/title-search in Studio. A one-variant sketch whose
variant equals the part shows only the "Aktuell" column, so there is nothing to pick (Tom's screenshot,
2026-11-03). The real defect is in the gate: a part new in the range has no base picture, so the gate
demands a sketch even when the HEAD app matches its design. Fix: the gate judges a state with no base
picture against its design and passes it when the app matches. The withdrawn sketch was never committed.

343\. Tom (2026-11-04, screenshot of the components/shell-project-switch grid, row open): the cells that render
as a live iframe (rest, hover, active) clip the open project list to two rows and show a scrollbar; the cell
that renders as a static picture (focus-visible) shows the full list with "design-playground" and "Projekt
öffnen…". So one part draws two different looks, depending on how the cell renders. Tom's call: when a part
can hold a scroll container, the design draws both cases on purpose - a state where the content fits, and a
state where it is scrollable. Open: give the scrollable parts an explicit scrolled state, and make iframe and
static cells size the same content the same way, so the scrollbar only shows in the state that asks for it.

344\. Builder (2026-11-04, B291): docs:build failed with "Element is missing end tag". c922a8e65 wrapped a code span
so a line in apps/docs/cli/index.md started with `<sketch> <part> ...`, and VitePress read it as raw HTML. Fixed
in dc936b68e. Why no tool caught it: pre-push runs no docs build. Tool fix (technical, grill decided): pre-push
runs `docs:build` when the push changes apps/docs (about 1 min). Built as B292.

347\. Builder (2026-11-04, B291 push 1): B292's parallel VitePress build writes apps/docs/.vitepress/.temp while
`docs:lint` reads it (ENOENT); fixed in 2a06c3914. Why no tool caught it: the hook change was committed without
one end-to-end hook run ("not verified" in the report). Lesson: a change to a git hook is done only after one
real run of that hook; B295 shrinks the hook, so it carries this check.

348\. SDK fixer (2026-11-04, D11): `design check --product sdk` reports 5247 open points in 50 of 57 parts; 5104 are
missing motions between every pair of showcase states (for example badge filled -> tonal). Why it matters: the
noise hides the 143 real points, so nobody reads the list. Tool fix (technical, queued as B297): ask a motion
only for state pairs that a control or an interaction connects, or let a part mark states as showcase variants.

349\. SDK fixer (2026-11-04, D11): the check's auto-rebuild of a stale CLI went through the nx cache, restored the old
dist and then refused on it. Why no tool caught it: the B293 stale guard has no spec for a cache-restored dist.
Tool fix (technical, queued as B298): rebuild with --skip-nx-cache, with a spec.

351\. Builder (2026-11-04, S7): tools/scripts/e2e-check.spec.mjs "the result line carries the sha" fails inside the
pre-commit index checkout (git rev-parse --show-toplevel runs outside a repo), so every commit that stages a file
under tools/scripts fails. Also: the grill session's own plan edits were not Prettier-formatted and blocked the
push. Why no tool caught it: the spec assumes a git checkout, and plan edits by script skip the formatter. Tool
fix (technical, B299): the hook passes the sha to the spec by env or arg; the grill session formats every plan
file it writes before the commit.

352\. Builder (2026-11-04, S6a round r1): in variant C's direct-edit state the first blocker text is cut off by an
ellipsis. `sketch check` and `sketch ready` were clean; a subagent saw it only on the CLI contact sheet. Why no
tool caught it: no rule looks at clipped text, and the contact sheet is not 1:1. Tool fix (technical, B300): a
general rule TEXT-TRUNCATED, run per state, flags every visible text node that holds content text and has
scrollWidth > clientWidth (ellipsis or clip); a label that may truncate opts out with data-et-skip=TRUNCATE.

353\. Builder (2026-11-04, sketch-view agent progress): a subagent bypassed the stale-dist guard. It built the CLI
from HEAD in /tmp, and a wrapper rewrote the hash in build-info.json to match the checkout. Cause: while other
sessions hold uncommitted libs/cli edits, no fresh dist can exist, so the guard blocks all design work. The
`sketch check` result of that sketch is therefore not trusted until it runs again on a CLI built in the
checkout. Why no tool caught it: the guard trusts build-info.json, and nothing forbids an agent to write it.
Tool fix (technical, B301): the hash covers only committed sources (git ls-files + HEAD blobs), so a dist built
from HEAD passes while others edit; every agent brief forbids edits to build-info.json.

354\. Tom (2026-11-04): Studio did not start. `tauri dev` stopped with "Could not connect to http://localhost:4221/
after 180s". Cause: load average about 350 on the Mac. Many vitest runs at the same time: one pre-commit spec run
per commit of each session and subagent, plus a full `nx test cli`. The Angular dev server could not compile in
180 s. Why no tool caught it: each session and hook starts vitest on its own; nothing limits the number of test
runs on one machine, and the Studio start shows only the timeout, not the load. Tool fix (technical, B302): one
machine-wide lock for heavy runs (pre-commit specs, `nx test`, `design check`), so a second run waits in a queue;
the Studio start prints the load average and the heavy runs in progress when the dev server is late.

355\. Tom (2026-11-04): after the dev server came up, Studio showed only "Design-Server startet" for more than a
minute. Cause: the debug build sees an outdated `dist/libs/cli` (other sessions edit libs/cli) and first runs
`nx build cli`; under load that takes minutes. Why no tool caught it: the status has one word for every start
phase, so a rebuild looks like a hung server. Tool fix (technical, B303): the status names the phase ("CLI wird
gebaut", "Design-Server startet") and shows the elapsed time; a failed rebuild shows its error.

356\. Builder (2026-11-04, CI triage): the Studio gates failed in CI on pages/system. Pick b (c02c7aede) made the
open-points chip count the exceptions too ("49 offen" = 47 + 2); the app still drew "47 offen", so the
focus-visible states found no "49 offen" button. Why no tool caught it earlier: the visible gate classed such a
state as `undrivable` ("a problem of the part") and never failed on it; 1eb7277e8 brought that in with this exact
case in its spec, and the new VISIBLE-CHANGE slow rule also dropped undrivable states. Tool fix (done, 4d78306ab):
an undrivable state is a VISIBLE-CHANGE problem, and the part is not build-ready. Open app work: the live view
passes the real exception count to the chip (now 0); the other app lag from pick b goes into S6b.

357\. Tom (2026-11-04, for later): on macOS the native traffic lights are not centred vertically in Studio's title
bar (screenshots of pages/sketches and pages/system). Why no tool caught it: the native controls are not part of
any design drawing or headless compare; the design only reserves their space, and nothing checks the real Tauri
window. Tool fix (technical, B304): derive the traffic-light position from the title-bar height token of the
design, and add a macOS window check that measures the traffic-light centre against the title-bar centre.

359\. Tom (2026-11-04): every frame in Studio showed the browser's broken-image icon and an endless "Rendering" chip
(foundations/agent-logos and others), while the part head said "Nichts offen". Cause: load about 256 from a full
`nx test cli` with coverage plus other vitest runs; the design server did not answer within 5 s. Why no tool
caught it: a failed or timed-out shot has no state of its own, and "Nichts offen" counts only known problems,
not missing shots. Tool fix (technical, B306): a shot that fails or times out shows an error state with the
cause and a retry; a part with missing shots never shows "Nichts offen"; with B302 a full test run waits while
Studio renders.

360\. Builder (2026-11-04, CI triage): `commit-wait.spec` looked timing-flaky in CI. Cause: vitest prints ANSI
colours in CI, and `timedOutSpecs` in precommit-specs.mjs anchors `^\s*Error` / `^\s*FAIL`, so it never saw a
timeout and never re-ran the spec. Fixed in 62c79da3b (strip ANSI first). Why no tool caught it: the parser spec
used a hand-written fixture, against the AGENTS.md rule that a parser of tool output takes its fixture from a
captured real run. Tool fix (technical, B307): precommit-specs fixtures come from a captured CI log; check the
other tool-output parsers in tools/scripts and libs/cli for hand-written fixtures. Related: 99905988b raised the shell-logo.spec timeout to 30 s. A green run under load ~42 has no ET1234, so ET1234 comes only from the teardown after a timeout. The cold first test takes about 6 s (speed, not a11y).

361\. Builder (2026-11-04, S2): nothing wrote `actions` into the build-ready record (ready.json), while ACTION-LOST
reads them there; Studio's go.json holds 7 actions, ready.json none. Why no tool caught it: the ACTION-LOST spec
seeded ready.json by hand, and the writer specs never asserted `actions`, so each side was green alone. Same
lesson as 360. Tool fix (S4): the record writer stores declared actions, plus a writer-to-reader round-trip spec
(check writes the record of a part with actions; ACTION-LOST, doneParts and stale-parts read it back).

362\. Tom (2026-11-04): product code named one user. b873da3ee0 (2026-11-01) added `TomPrompt` in
libs/cli/.../tom-confirm.ts ("Confirm design go and accept by Tom"); the file is gone now, but
`.ethlete/design/sdk/accepted.json` notes say "allowed by Tom chat" and apps/docs/cli shows `ready --by tom`.
Studio and the CLI are built for every user, not for one person. Why no tool caught it: no check knows person
names, and a review saw the name as the plan's wording. Tool fix (B308): see "Person names" decisions below.

363\. Tom (2026-11-04): pages/sketches r1 drew empty cells with "Render-Fehler" and "vergleicht ..." forever, and
the S6a sketch on pages/system drew no frames but said "Wartet auf deine Wahl". Cause: (a) load 140-256 from a
full cli suite made `/__design/sketches` time out at 90 s; (b) `serve.ts` `watchBuild` (`reloadOnRebuild`)
restarts the server on every dist/libs/cli change and kills shots in flight; system-view's concat(quick, full)
never got the full answer. The sketches themselves were fine. Why no tool caught it: "Wartet auf deine Wahl"
reads only sketch.json `status`; the frame error text stays inside the frame; `sketch check` renders on its own
server one frame at a time and has no per-shot timeout (hung 19 min). Tool fix (B309): pick state only when
every live variant drew frames without error, else a loading or error state without "Übernehmen"; no
self-restart of a Studio-owned server, a "CLI geändert - neu starten" hint instead; `design_server_restart`
builds first and stops the old server only after a good build; the error text reaches chip and head
("variant · state: message"); a per-shot timeout in `sketch check`.

364\. Tom (2026-11-04, 14:00, again 14:17): Studio froze completely. The WebContent process ran at 99 % CPU with
about 1 GB, the design server was idle; `sample` shows the time in `WebCore::MicrotaskQueue::runJSMicrotask`
(samples: /tmp/studio-freeze-webcontent.txt, /tmp/studio-freeze3-webcontent.txt). Cause (builder, proven with a
native WKWebView repro): a WebKit engine bug. Removing an iframe while a module with top-level await still
evaluates can hang WebContent for good in `JSC::moduleLoaderEvaluate`. All samples show `moduleLoaderEvaluate`
-> `ScriptModuleLoader::evaluate`. The fix 2032f0928 removed top-level await only from frame.ts; about 25
design sources in .ethlete/design/studio still had a module-level `await <part>.render(...)`. Repro: 6 frames
replaced every 150 ms pass 640 batches without top-level await and hang at batch 15-265 with it (also with
`await <sync value>` in a shared dependency). The hang is random, and each mass frame remount rolls the dice:
both freezes followed one (the server restart of 363, the SSE drops of 365). Why no tool caught it: the
top-level-await rule existed only as a one-off fix in frame.ts, no check scans design modules, and every frame
check runs in Chromium. Tool fix (B310): remove every module-level await from the design sources; a parse-based
guard with a spec that reports top-level await in any frame-loaded design module; a WebKit frame-churn soak
(the repro, off-screen, 300+ batches) in the macOS CI job; a main-thread watchdog in the Studio host. A host
thread (not the WebView main thread) pings with `evaluateJavaScript` and a timeout; on a miss it writes one log
entry per freeze to the Studio log dir, with the WebContent pid, a 3 s `sample`, and the current route.

365\. Tom (2026-11-04, 14:04): after a Studio restart, Studio draws no frame content. pages/sketches r1 shows empty
cells with "vergleicht ..." forever; pages/system@pages-system-build-ready shows variant heads, no frames, but
"Wartet auf deine Wahl". curl gets `/__design/sketches?product=studio` with 200; inside the WKWebView the same
request, about 11 `comment-events` requests and about 170 `/__design/render` fetches fail ("access control
checks" is WebKit's text for any failed fetch, not CORS). Cause (builder, proven with an offscreen WKWebView
probe): WKWebView drops an SSE response after 60 s without bytes, and `comment-events` (serve.ts
createDesignEvents) sent only `: open`. Each reconnect emits `all` on `reconnects$`
(apps/ethlete-studio/src/host/design-changes.ts), so every frame revision bumps, every iframe remounts, and the
sketch listing restarts. The full listing (`openSketchProblemsOf`) runs sync and blocks the Node event loop for
12-30 s, so frame.html, render and shots time out; a frame gives up after one retry (empty cell) and the full
listing never lands ("vergleicht ..."). Why no tool caught it: every check runs in Chromium (no SSE idle
timeout), on an idle server, one request at a time, under 60 s; no design-server log file; no headless view of
the WebView console or network; an empty cell has no failure state; `designAnswer$` has no timeout and swallows
errors. Tool fix (B311): a 20 s heartbeat with a spec that fails without it (563995251); the listing off the
event loop with a spec that fails on a blocked server; a reconnect to the same server pid remounts no frame;
`designAnswer$` and `listedSketches$` show errors; a WKWebView soak check that holds the real event stream of
`et design serve` for 90 s and fails on a close; a design-server log file; a local WebKit probe opens its
window off-screen, never on the user's screen.

366\. Tom (2026-11-04, 14:30): the Studio shell rubber-bands at the scroll edges (macOS elastic scroll; Edge does
it too now). Cause: no `overscroll-behavior` anywhere except the canvas. Fix de2b83743: `overscroll-behavior:
none` on html, body and every element (the property is not inherited); the Tauri host needs no WKWebView
setting while Safari 16+ honors the CSS. Why no tool caught it: every check runs in Chromium or jsdom, and no
check asserts overscroll; the new spec checks the CSS rule, not the computed style. Tool fix (B312): a
scroll-to-edge probe in the macOS WebKit job that fails on any bounce offset.

367\. Tom (2026-11-04, 14:35): under load, canvas frames paint over the explorer panel (the colors frame shows on
top of the explorer tree). Cause (builder, the compositor part assumed, not reproduced): the canvas host
clipped only with `overflow-hidden`, which makes no stacking context and no paint containment, so WebKit's
compositor drew a scaled iframe layer outside the pane. Fix de2b83743: `isolate` and `contain-paint` on the
canvas host. Why no tool caught it: every check runs in Chromium or jsdom, no check asserts paint containment,
and none runs under load; the new spec checks the classes only. Tool fix (B313): the macOS WebKit job takes a
screenshot under frame churn and fails when the explorer pixel area changes.

368\. Builder (2026-11-04, during finding 365): a failed sketch listing had no visual, so a compare row could show
"vergleicht ..." forever. Cause: the design `.ethlete/design/studio/pages/sketches/sketches.ts` declares only
the `comparing` state, and `designAnswer$` turned every error into an empty list. Interim fix 636234e22: a
pending row shows "Vergleich fehlgeschlagen: <message>" in the merge-error style, and the sketches head shows
one "Erneut laden" button; the final look comes from an error-state sketch that Tom picks. Why no tool caught
it: the state checks (`system/open-points.ts`, `reached-state.ts`) only see states the design declares, so
nothing can flag a state the design never declared. Tool fix (B314 = B251): a part that loads data or lists is
build-ready only with declared loading, error and empty states. The interim look itself reached the app without a sketch round (the doc agent asked for it), and no gate checks that the app shows only what the design has. Second tool fix (in B251): a design compare is required for every Studio UI commit, enforced in the pre-push hook. The error-state sketch was then blocked: the stale-build guard
(`libs/cli/src/lib/source-hash.ts`) refuses every `design sketch` command while any agent has uncommitted
`libs/cli` edits, which conflicts with parallel agents. Third tool fix (in the "Studio runs committed code only"
slice): the sha-keyed CLI copy also serves the design commands agents run (sketch, task, check). The "needs
approval" mark of a state is the open sketch alone; no new field.

369\. Tom (2026-11-04, about 15:00): Tom clicked "neu starten" in Studio. The old host restarted the design server
from the dirty tree, the stale-build guard stopped it, and Studio showed "Design-Server gestoppt" with an
English developer message ("This CLI build is stale ... npx nx build cli"). Tom had no design server and no
action in the UI to recover. An agent recovered it by hand: a CLI build at HEAD in a clean worktree, started on
:4402 with cwd in that worktree. Why no tool caught it: the restart button could not rebuild, no check runs the
restart against a dirty `libs/cli`, and the stopped state has no recovery action. Tool fix (B315, mostly in
dd708ee4a "Studio runs committed code only"): restart only from the sha-keyed copy; a scenario that clicks
restart with a dirty `libs/cli` and expects a running server; a stopped server shows a German message and a
recovery button.

371\. Builder (2026-11-04, cause for the slow first sketch listing after finding 365): the quick listing takes about
14 ms on an idle server, but it waits behind a running full listing. The full listing runs its rule checks
synchronously (`studio-api.ts` `sketchesAnswer` -> `openSketchProblemsOf`: 22 s cold with jiti, 1.5-2 s warm
per product and again per variant; `unchangedStatesOf` baselines 300-450 ms per variant). A `switchMap`
restart cancels only the client request; the server work goes on and blocks. The frame grid ("vergleicht
...") also waits for the targets of the full listing. Why no tool caught it: no check measures the quick
listing while a full listing runs, and a cancelled request does not stop server work. Tool fix (B317, with the
B311 listing slice): the checks run in a worker thread with a 50 ms block budget for 200 sketches; a spec that
times the quick listing during a full listing; a closed request aborts its server work; the frame grid draws
from the quick listing targets.

373\. Tom (2026-11-04, about 15:15): `pages/flows@edit` ("Runde 1 · Direct edit", variants "new"/"old") shows no
frame, no "vergleicht ..." and no error, with English texts in the German UI. The direct-edit check ran at
13:53:56Z on the uncommitted TLA edit of an agent, 17 s before 5bec01b89, and also opened `pages-merge.edit`
and `pages-start.edit`. Causes (builder, read-only): (a) Studio uses `sketch.target` (`pages/flows@edit`) as a
part key (`system-view.component.ts:616`, `system-tree.ts:1420`), so no state matches and no iframe renders;
the listing already sends `targetParts`. (b) `edit-sketch.ts:84-87` points the `old` variant at the new
`shared/` copy, so `old` fails once frames render. (c) Likely, not proven: `baselineOf`
(`accepted-pictures.ts:246-250`) uses the stored `go` pictures without a hash check (`go` hash cccece47, merged
hash 63515abb), so a change with no picture change opened a sketch instead of the automatic merge. (d)
`edit-sketch.ts` writes English round and variant texts into `sketch.json`, and Studio shows them verbatim.
Why no tool caught it: no Studio fixture has a named sketch target; `edit-sketch.spec.ts` has no case with a
changed `shared/`; `accepted-pictures.spec` has no stale-`go` case; nothing flags server free text in the German
UI; a variant with zero states has no failure state. Tool fix (B319): resolve the part from `targetParts`; HEAD
`shared/` for `old`; the baseline only from pictures at the merged hash, else draw HEAD; a spec for each; the
three wrong edit sketches must close themselves through the fixed check (the proof), not by hand. The German
texts (kind `direct-edit` mapped to STUDIO_LABELS) and a "variant draws no states" look go to Tom as a sketch.

375\. Tom (2026-11-04, about 15:35): finding 367 is back. While the WebContent process hangs, the frames of the
first canvas column ("Rendering" chips, borders, text) paint on top of the explorer tree. So `isolate` and
`contain-paint` (de2b83743) do not hold in WKWebView under load. Why no tool caught it: the B313 pixel check
under frame churn is not built, and the de2b83743 spec checks the classes only. Cause (builder): in
`shell-main.component.html` the canvas `<main>` and the explorer `<aside>` are absolute siblings without a
stacking context, the explorer is on top only by DOM order, and the canvas reaches under the explorer on
purpose, so a canvas-side `isolate` cannot hold; WKWebView lags in its overlap check while WebContent hangs.
Tool fix: B313 first, so the check fails on this state; then `isolate` on `<main>` and an own layer for the
explorer.

376\. Builder (2026-11-04): 52d23cfc2 (German blocker texts) broke a system-view spec that expected the English
text; fixed in 16a3d8214. The agent ran only the spec file of the changed module. Also for finding 373: the
hash in `merged.json` (`partHashOf`, folder hash) and the picture hash (`designHashOf`) are different kinds and
never match, so `go`/review never served as a baseline; `record` was used without a hash check. B319 fixed
this (a148d713e, 7581b65e1): one hash kind on both sides, `record` checked too, and design check re-checks open
undecided edit sketches and closes them as held when old and new draw the same. Why no tool caught the spec
break: no check links a label change to the specs that assert the old text. Tool fix: the agent briefs run
every spec that imports `studio-labels`, and a check fails when a spec asserts a label text that no longer
exists.

378\. Tom (2026-11-04, about 15:55): while the server runs, Studio shows no "Neu starten" (only in the stopped
state), and the title-bar code notice is built but not rendered. So a new CLI commit reaches Tom only by a
kill of the server or a full Studio restart. Why no tool caught it: the committed-code-only slice tested the
restart flow only from the stopped state; no spec renders the running state with a newer commit. Tool fix
(B323): render the title-bar notice in the running state as an interim "needs approval" notice that opens its
sketch (finding-368 flow); a spec for the running state with a newer CLI commit.

380\. Tom (2026-11-04, same screenshot): `pages/flows@edit` now draws "new", but "old" ("the design at HEAD") fails
with `Importing binding name 'emptyCanvas' is not found`, and both variants show "Vergleich fehlgeschlagen:
Load failed". Cause (doc agent, from the files): the sketch is from 13:53, before B319. Its `old/` holds a
flows.ts that imports `emptyCanvas`, but its `shared/` is the current copy, which exports `emptyCanvasOf`
(5bec01b89). pages/flows has no uncommitted change, so the sketch has no direct edit at all. Texts are still
English ("the edit made outside a sketch", "the design at HEAD"). Why no tool caught it: B319 fixed new
sketches only; nothing re-checks a stored `old/` against its `shared/`, and the B319 follow-up (1cf06ce2d)
compares by drawing `old`, which cannot render here. Tool fix (B325): the re-check draws HEAD fresh, not the
stored `old/`; an `old` that fails to render while the working part equals HEAD closes the sketch as HELD; a
render error in an edit sketch's `old` is a check problem, not a silent frame; German variant notes; a spec
with a stale `old/` against a renamed `shared/` export.
As built (B332): `design check` already types every variant of every open sketch, `old` included, over the sketch's
`shared/` (a5b7715fe, `typecheckOpenSketches`); a stale `old/` importing a removed export is a `TYPE-ERROR` and exit 1. The
gap was a spec: check-system-sketch.spec.ts now pins it with `old` importing `emptyCanvas` against a `shared/` that
exports `emptyCanvasOf`. No new rule.

381\. Tom (2026-11-04): on the Mac the frames (iframes) eat the two-finger trackpad pan of the canvas. A wheel event
over an iframe goes to the iframe document and never reaches the canvas. Why no tool caught it: the canvas
behavior tests pan on empty canvas only, never with the pointer over a frame. Tool fix (B326): frames do not
take wheel and pointer input while the canvas is in pan mode (shield over the frame or forwarded wheel), and
a storybook-e2e or Studio headless test that pans with the pointer over a frame.

383\. Builder CI triage of run 41811275798 (at 68fbfd019). Four of five failures were fixed by later commits.
(a) test:tools: `timedOutSpecs` did not strip ANSI colour from GitHub output (fix 62c79da3b); missed because
pre-push does not run test:tools. (b) shell-logo.spec 5 s timeout on the slow runner (fix 99905988b);
CI-only timing. (c) contentful build: ng-packagr needs `allowedNonPeerDependencies` after 7711a8616 (fix
45f505995); no local gate builds a lib, and `@nx/dependency-checks` asked for the move that ng-packagr
rejects. (d) Visible-change gate on pages/system: design chip counted exceptions, app chip did not (probably
4d78306ab, the next CI run confirms). (e) Correction to finding 376: the `yarn commit` gate made its worktree
under `os.tmpdir()`, a symlink on macOS; vitest resolved the real path, printed "No affected test files
found" and exited 0, so on this Mac the gate ran no spec for any commit (fix ae388f531 with realpathSync and
a symlink-TMPDIR spec). Open: 62c79da3b adds an eslint `no-control-regex` error in precommit-specs.mjs.
Tool fixes (B328): a gate that ran zero specs for a non-empty related set fails instead of passing; a
lib-build gate for libs whose package.json dependencies changed; lint of tools/scripts at commit time.

384\. Tom (2026-11-04, about 16:55): opening the `pages/sketches` sketch ("Agent-Fortschritt in der Sketch-Ansicht")
froze Studio until it recovered by itself. Facts: 3 variants x 25 states = 75 live frames at 1440, each a full
Studio page that draws its own sketch grid; the WebContent process held 2.6 GB. The round asks only about the
three `agent-*` states; the other 22 states are unchanged and would fold, but the fold data comes from the full
listing (over 90 s, finding 379), so the view first loads every frame. Why no tool caught it: no budget for
live frames per sketch view, no check of frame count or memory when a sketch is made, and the fold waits for
the slow listing. Tool fix (B329): live frames only near the viewport, the rest as stored pictures or
placeholders, with a cap on live frames; unchanged states fold before any frame loads (fold data from the
quick path, not the full listing); a sketch check that warns when variants x states x widths passes a budget;
a Studio headless test that opens a 75-frame sketch and asserts the cap and a usable frame rate.
Same on `pages/system@pages-system-build-ready` (Tom, minutes later): 3 variants x 26 states = 78 frames. So
Tom can judge no open sketch until B329.

385\. Tom (2026-11-04): the doc agent asked again whether a sketch round shows only the states it is about. Tom
decided that on 2026-10-30 (render-checks.md 4.48, option 1: a round opens with its question shown and only
the states it changes open at a readable scale; unchanged states fold behind a count with "Show all
states"). The fold part was built, the focus part was not, and finding 384 is the result. Why no tool caught
it: decisions live in several plan files (design-to-code.md, decisions-latest.md,
design-system-actions/*.md) and nothing makes a grill agent search them before it asks, and no check links a
decision to the slice that builds it. Tool fix: the doc-agent skill searches all `plans/ethlete-studio/**`
decisions for the topic before every grill question; B329 builds 4.48 option 1 in full, so the focus view is
the default and the live-frame cap is the guard; a decided-but-unbuilt decision gets a STATUS row the day it
is decided.

386\. Tom (2026-11-04, screenshot): in the System view the tree's Sketches group marks `flows` and `merge` with a
warning, and a click on the `merge` sketch row selects it but the canvas stays empty while the top bar still
shows the part actions (Go geben, Kommentar, 1 offen) instead of the sketch view. The warnings are expected
(both edit sketches have an `old` that fails to render, finding 380), but nothing says what they mean, and the
row opens nothing. "Go geben" is still there because B249 (A10 removal of go) is not built yet. Why no tool
caught it: no spec clicks a sketch row in the System tree and asserts the sketch opens, and a tree warning
has no reason text the user can read. Tool fix (B331): a sketch row opens the sketch view (or the System
canvas draws the sketch); a tree warning carries its reason as a tooltip and in the open-points list; a spec
for both.

387\. Builder (2026-11-04): prettier renumbered 138 findings in this plan in 3decc21bb: from 159 on every number
shifted down (159 read 158, the last, 386, read 374), so "Bef. N" in STATUS.md and "finding N" here pointed at the
wrong finding. Cause: the findings were one long ordered list with gaps where findings went to the archive, and
prettier renumbers an ordered list from its first number. Why no check caught it: nothing checked the numbers;
`lint:studio-adrs` read them only for the orphan warning, and archive-findings.mjs took every ordered list item,
decision lists included, for a finding. Fix (B333): the numbers are restored by matching each finding's text against
3decc21bb^; every finding here and in the archive is one paragraph that starts with `N\. `, which prettier leaves
alone; `yarn lint:studio-adrs` fails on a list item numbered 100 or more, a duplicate or decreasing finding number,
and a "Bef. N" with no finding N, and its spec runs a prettier-renumbered fixture as the red case. Lesson: a number
that other text points at must not be one a formatter computes.

390\. Builder (2026-11-04, B333): `commit-wait.spec` was red since 2bad713a6 (B328), which added an eslint run over
staged tools/scripts files; the spec's temp repo had no eslint config (fixed in 9f0d70e47). It blocked every later
tools/scripts commit. The gate selects the whole tools/scripts suite for such a commit, so on 2bad713a6 and six later
commits made on the Mac (421d2fee8 to be8aa16b7) the hooks most likely did not run: several carry the scope
`ethlete-studio`, which commitlint never allowed. Verified cause: the Mac checkout never installed husky (`core.hooksPath` unset, no `.husky/_`), so no git hook ran there. Why no tool caught it: nothing checks after the fact that the local
hooks ran. Fix (B335): a CI job runs commitlint and `yarn test:tools` over the pushed range, and pre-push checks
commitlint for each commit in the range; `yarn commit` and the agent session start refuse when `core.hooksPath` is not `.husky/_`; the Mac checkout gets husky installed.
As built (B335, w3-gates-b): CI `Checks` runs `yarn commitlint --from $NX_BASE --to $NX_HEAD` next to the existing
`yarn test:tools` and `hooks:check`; `.husky/pre-push` runs the same commitlint over the pushed range (about a second).
Not built: `yarn commit` refusing without hooks (its spec runs in a repo without `core.hooksPath`), and husky on the Mac.

392\. Builder (2026-11-04, B321 on the Mac): the pixel check run lacked two build steps the handoff did not name
(`nx build cli`, the components build); without `dist/libs/components` the design server hangs on `/__design/system`
instead of failing (the exact wait point is not traced; the CLI guard `guardsDesignMocks` covers `design`, not this
serve path). The paint check then failed over SSH, because the Screen Recording permission holds only for a
GUI terminal. Why no tool caught it: the server does not check its build inputs, and the verify script starts
without a check of what it needs. Fix (B337): the design server answers with an error that names the missing dist,
and `verify-webkit-studio.mjs` checks its build inputs before it starts; a Mac check that needs Tom ships as one
prepared command, not a list of steps.
As built (B337): `/__design/system` answers 503 `missing build: dist/libs/<lib> is missing - run ...` when a render module maps to a missing `dist/libs/<lib>` (`missingDistOf`, `stale-dist.ts`); the actual hang was not reproduced or traced, so a hang from another cause may remain. `verify-webkit-studio.mjs` fails at setup with the missing CLI or `dist/libs/components` (`missingBuildInputs`). The Mac check is `yarn verify:webkit-studio` (builds cli and components, then runs the checks; needs a GUI terminal for Screen Recording). Specs run; the Mac run did not.

393\. Builder (2026-11-04, B326): on the Mac the frames ate the two-finger trackpad pan (finding 381). Cause, inferred
and not run on WebKit: the Sketches, merge and flow pages kept wheel input out of their iframes only with
`pointer-events: none` on a wrapper, and WKWebView still routes a trackpad wheel into the iframe; the System canvas
cover did not cover the live frame. Why no tool caught it: the canvas e2e wheeled over a frame, but only in Chromium,
where `pointer-events: none` is enough. Fix (built in 7658705c1): a transparent frame shield on those pages, the
cover also over the live frame, and an e2e case that forces `iframe { pointer-events: auto }` as WebKit does; plus
`verify-webkit-frame-wheel.swift` for a real WebKit run. Lesson: an e2e that stands in for another engine must
model that engine's difference, not only run the gesture.

398\. Builder (2026-11-04, B329 sketch `pages/sketches@fold-question`): `sketch ready` passed variant c although it
changed two states the round did not touch (withdrawn-shown and withdrawn-hidden: gap 3 instead of 4, toggle moved);
only an "auto-merge skipped" line named them. The builder found it in the shots and had it fixed. Why no tool caught
it: no check compares the states outside a round's new and changed states with HEAD. Fix (B342): `sketch check` fails
a variant whose untouched states differ from HEAD, unless the round note names them.

399\. Builder (2026-11-04, same sketch): `sketch report` on a ready sketch was refused without naming `--reopen`, so
the agent edited first and reported after. Why no tool caught it: the refusal text does not say how to go on. Fix
(B342): the refusal names `--reopen`. The same sketch showed that the app's fold label (B329, built without a design)
has no nowrap and likely wraps in Studio; it is fixed with Tom's pick (finding 391 covers why no gate saw it).

400\. Tom (2026-11-04, 20:20): Studio said "pages/sketches hat sich seit dem Sketch geändert" for
`pages/sketches@fold-question`, but no commit changed pages/sketches. Cause: Tom's merge of
`components/title-bar@code-notice` (20:17) changed a part that pages/sketches draws, three minutes after the sketch
was ready. Why no tool caught it: the stale text names the sketch's own part, not the changed dependency, and a merge
does not say which open sketches it makes stale. Fix (B343): the stale text names the changed parts from the
baseline diff ("components/title-bar wurde gemergt"), and a merge lists the open sketches it makes stale. The same
happened to `pages/system@pages-system-build-ready` minutes later, so a merge also rebases every open sketch it makes
stale by itself when the rebase applies cleanly; only a conflict reaches a person.

401\. Builder (2026-11-04): Tom picked variant a of `pages/sketches` ("Agent-Fortschritt in der Sketch-Ansicht"),
then merged `pages/sketches@fold-question` b, which changed the same files. `sketch rebase` refused and asked for a
hand port of all three variants, although only the picked one will be merged. Why no tool caught it: rebase does not
know that a pick makes the other variants dead. Fix (B344): after a pick, `sketch rebase` ports only the picked
variant and drops the others; and two open sketches on one part warn at the first merge that the other one needs a
port.

402\. Tom (2026-11-04, screenshot of `pages/system@pages-system-build-ready`): "echt viel, extrem viele Screens, das
macht es hart zu vergleichen". The round is about the popover footer, but it shows about 29 changed states as whole
pages; at 30 % zoom the footer is unreadable, and most crops would look the same. There is also an empty teal frame
above the grid. Why no tool caught it: decision 4.48 option 1 (2026-10-30) says the changed states open "at a
readable scale"; B329 built the fold, not the readable scale, and no check measures whether a round's change is
readable at the zoom Studio opens with. Fix (B345): a round opens each changed state cropped to the region that
differs from HEAD, with a margin and a switch to the whole screen; states whose cropped change is identical show
once with a count; a check fails a round whose changed region renders below a readable size at the opening zoom.

As built (B346, 2026-11-07, part 2): Empfehlung gebaut, c "tag", merged as 34bc2d4ac; a (head gone, grid
jumps left) and b (head scales into strokes) rejected. `sketch ready` first refused two hits the product already had:
the hidden head now gets `hidden` from the fit script (`data-sk-head-full`, like the pins), and
`unchanged-matrix-open` moved to 20 % so no head button is cut at the pan limit. Below the label floor the head
collapses into a pill with the variant name ("Aktuell", "a"), the row grid narrows to `max-content` with a 2-unit gap,
and the full head and note are hidden (`data-sk-head-tag`), in `pages/sketches` (list rows and matrix columns) and in
`sketches.component` (`headHidden()`, `headColumns()`, the head template). The e2e case now checks heads at 30 % and
100 %: no empty head at either zoom, at least one tag in view at 30 %, none at 100 %, tag text at least 11 px.
Also fixed: `sketch new` wrote 9 `../` instead of 6 into the canvas-math import of a copied `shared/sketch-rows.ts`:
`seedTarget` rebased imports that leave `shared/` for the variant folder and then lifted the folder up three levels.
It now rebases them for the place they end up (`settledIn`); spec "points an import that leaves the shared folder at
the same file from the sketch" fails on the old code. Why no tool caught it: no spec resolved an outside import of a
lifted `shared/` file. Not built: the state-name floor of the matrix gutters (finding 431 (2)), still transparent at
30 %.

404\. Builder (2026-11-04, S6a merge 2e70dc149): `pages/system@pages-system-build-ready` showed "stale since
5bec01b89" and `sketch rebase` reported a conflict, but all three variants already held 5bec01b89's change, identical to
the product. No port was needed. Why no tool caught it: `sketch rebase` calls a file a conflict when variant and product
both changed it, without comparing the content. Fix (B343): identical content counts as clean, so this case rebases on
its own and never reaches Tom as stale.
Real cause (B343, 46177c36b): a sketch moves the part's own `shared/` files into the sketch's `shared/`, and rebase
looked for them in the part folder, so it called every such file a conflict.

405\. Builder (2026-11-04): `yarn commit -- <paths>` joins the paths into one string, so it works only with a few path
arguments. Why no tool caught it: the commit script has no test with many paths. Fix (B347): pass the paths to git as
an array, with a spec that commits more than ten paths.
As built (B347): the script already passed an array; `commit-wait.spec.mjs` now commits 15 paths (one with a space).
B122: `pre-commit-hook.spec.mjs` runs the real hook under `git commit -- <paths>` in a temp repo.

407\. Builder (2026-11-04, after B339 part 1, c0035f241): `studio:e2e` is 109/112. Three cases went red that were green
after B321 (c348db743): Sketches and Large "pan beyond every edge of the content" (bottom edge), and Chip "first load
creates one iframe per frame and aborts no frame request" (6 aborted requests). Suspects, not triaged: tonight's merges
(fold-question b, title-bar c, system a), the frame cap's far cells, or the B339 commit. Why no tool caught it: finding
395 again; no gate ran `studio:e2e` after a merge. Fix: B339's CI job, plus a post-merge run of the e2e cases for the
merged part (B349). Decision (grill session, Tom afk): triage before B343; no case is rewritten without Tom's OK.
Triage (52d7d2b55, `studio:e2e` 112/112): none of tonight's merges. The cause is b9367d285 (frame cap). Pan: a far
frame had a 150 px placeholder height and grew on load, so the content grew while panning (Large: 2 570 -> 7 710 px).
Chip: frames went live on the names-only first listing, then folded kept states moved the live slots, and a
content-sized part used a 1 440 px stand-in width that flipped the layout when the real width came, so every iframe
was rebuilt. Fix: no frame goes live before the sketch has targets; a far frame takes a measured height; the column
switch counts only rows with a known width. The "green after c348db743" baseline was false (finding 414).

408\. Mac perf session (2026-11-04, B348, next@ee7ab1de7, product studio with 1 sketch): the first
`/__design/sketches` listing after a server start takes 240.8 s on the Mac and stalls the design server for up to
33.5 s at a time; the second request takes 23 ms. Desk: 580 ms with a warm harness cache. Likely cause: the first
listing starts `nx run ethlete-studio:build:development --skipNxCache` harness builds (3 in one cold run, 25-85 s each
on the Mac), and the cache key (`harnessBuildKeyOf`) hashes every tracked file, so any commit anywhere forces new
builds. Why no tool caught it: the desk always has a warm cache and is fast enough to hide the stalls; no check measures
a cold start or the server stall. Fix (B317, extended): with a cold cache (empty ET tmpdir, one sketch), the longest
event-loop stall during the first listing stays under 50 ms (20 ms ping route), the listing answers within 1 s without
waiting for a harness build, and a cold start runs at most 1 harness build.
Correction (second runs, fresh scratch checkouts on both machines): cold listing Mac 120.7 s, desk 120.6 s; the stall
is Mac 35.5 s, desk 10.3 s. Near-equal times on a 4x slower machine point to a fixed wait of about 60 s (likely a timeout
on a render worker or a harness build wait, not proven), so the slow answer hits the desk too. The Mac-specific part is
the stall length. Budget (updated): in a fresh checkout with a cold cache the first listing answers in under 2 s
without waiting on a timeout, and the longest stall stays under 50 ms (20 ms ping to `/@vite/client`).

409\. Mac perf session (2026-11-04, B348): `GET /__design/system?product=studio` takes 61 s on the Mac on every call,
also warm; the server stalls up to 1 s during it. Desk: 2 s. The sketch view (pages/sketches) showed no cell within
180 s on the Mac; desk 3.3 s. Likely cause: no result cache, each call redoes the product analysis (vite/rollup chunk
code, TypeScript scan, file reads, a postcss `CssSyntaxError` thrown and caught in a loop), plus synchronous child
processes (`execFileSync` in the canonical-class rule `classFactsOf` 4.6 s, git calls in `headOf`, `gitOrNull`,
`workTreeFilesOf`, `defaultBaseOf`). Why no tool caught it: 2 s on the desk looks fine, and no check measures a repeated
call or the server stall. Fix (B350): the second call on a warm server answers within 200 ms from a cache keyed on its
inputs; the longest stall during the first call stays under 50 ms, with the Tailwind and git calls as async child
processes; zero `CssSyntaxError` throws per call.
Correction (second runs): the 61 s warm call did not repeat; drop "on every call". Cold: Mac 66.5 s, desk 61.8 s
(the same fixed wait as finding 408). Warm: Mac 1.05 s (stall 1.04 s), desk 0.35 s (stall 0.34 s). Budget (updated):
the first system answer in a fresh checkout under 5 s, the warm call under 200 ms, the longest stall under 50 ms.

As built (B352, 2026-11-07): `PENDING-STATE-MISSING` (warning, `rules/pending-state.ts`) traces each `emit:` action from
its binding on the component's tag through methods, re-emitted outputs, service subjects and `kind` branches to a host
invoke or HTTP call; on studio it names 10 actions in 5 parts, title-bar `emit:restart` among them. The update dialog's
restart is missed (bound via `outputBinding`). e2e case "Neu starten in the code notice answers within 100 ms" with
`expectFeedbackWithin`, marked `open` (passes while it fails). Sketch `components/title-bar@restart-pending` a/b/c drawn,
not checked or readied (stale `dist/libs/components`). Not run: the e2e case end to end (first run broke on a type error,
since fixed), `design check`.

As built (B352 close, 2026-11-07): Tom chose variant a (recommendation: SDK busy button). Brought by hand into part `components/title-bar` (the `restart: 'pending' | 'failed'` prop, states `linux-full-notice-pending`/`-failed`, `loading` button, failed toast; sketch dir deleted) and the app `ethlete-title-bar` (`restart` input, `dismiss` output, `ethlete-error-toast` under the bar). `code-watch` holds the restart state (`pending` on act, `failed` on a refused server restart or quit, dismissed by the toast); `studio-view.restartServer` reports into it, so finding 145's swallowed refusal now shows. The e2e case lost its `open` mark. Verified: specs (title-bar, code-watch, shell-main, studio-view), lint; `design check --part components/title-bar` shows no PENDING-STATE finding and re-drew the two new pictures. Not verified: e2e case end to end, `design compare`, `task --verify`. Tool gap: `sketch merge` refuses while variants b/c live and the sketch is in progress (rejected b, c; the merge then needs the sketch ready), so the variant was copied by hand and `design check` opened a direct-edit sketch `components/title-bar@edit` (old/new) that Tom must pick in Studio; the sketch dir `restart-pending` was kept. Recommendation: let `sketch merge --variant` accept a recorded user choice from the plan, or let an agent ready a sketch.

413\. Mac perf session (2026-11-04, B348, scratch copies, one-variant sketch of components/tree-row): `sketch ready`
takes 284 s on the Mac and 117 s on the desk. Phase 1, the render check (`renderIssuesOf`), is 238/98.5 s: tree-row
itself is 7 s (53 frames), the rest re-inspects every part that contains tree-row (pages/sketches 50 frames,
pages/system 52, pages/inventory 8, pages/flows 4), one frame after another (proven on the desk from the goto log; Node
idle 96 of 117 s). Phase 2 (identical renders) 20/10.5 s and phase 3 (no-change check for the auto-merge) 16/4 s each
start their own Vite server and Chromium, share no pictures, and redraw states phase 1 drew. No progress output
(`onProgress` not passed), so the desk shows 111 s of silence. The merge takes 4.97/1.85 s and runs fully synchronous on
the server thread: Studio freezes for that time. Why no tool caught it: no budget on `sketch ready` or on the server
stall during a merge, and the desk is fast enough to hide both. Fix (B354): `sketch ready` on this fixture under 60 s
on CI, affected parts with no pixel change skipped or sampled, one Vite server and Chromium shared by all phases, and
progress output; the merge keeps the longest `/@vite/client` ping under 100 ms.
As built (B354, 2026-11-07): `sketch ready` runs every phase on one design server and Chromium (a run-scoped
`createRunDraw` without the resident process, the resident one with it) and one part shooter, so identical renders and
the no-change check share pictures. The render check skips every state of an embedding part that `unchangedStatesOf`
finds markup- and style-identical to the merged part (`RenderJob.unchanged`, a NOTE line names the count), and prints
`[n/m] part s` progress to stderr. The Studio merge (`sketchMergeAnswer`) runs `mergeSketch`, the harness map and the
note in a worker (`merge-runner.ts`). Desk, scratch clone, one-variant copy of components/tree-row, desk under load
25-85 on 16 cores (no clean verdict): before 81.3 s cold, 87.1 s resident (render-check 54-56 s, changes-shot 13-21 s);
after 32.4 s cold, 32.6/32.5 s resident (render-check 5.5-7 s; part-tree 5, flows 2, inventory 4, sketches 30, system 26
states skipped). Specs: `render-unchanged.spec.ts` (a named-unchanged state draws no frame) and a stall budget in
`merge.spec.ts` (longest event-loop gap under 100 ms during a Studio merge; 1 021 ms before), both fail without the fix.
Not done: the 60 s budget is not an enforced CI gate (the `sketch ready` timing target stays the 10 s over-target line);
changes-shot (15.5 s) is now the slowest phase and is the next cut; the Mac and the live `/@vite/client` ping were not
measured.
