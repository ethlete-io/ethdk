# Findings 2026-11

158. Hovering a variant frame in the Sketches view draws the teal border again (Tom, 2026-11-02, screenshot on
     pages/sketches r2), the same look as finding 96. Facts (builder): no `:hover` rule exists any more in the design
     CSS; the teal comes from the app canvas, which draws part outlines as siblings of the frame
     (design-canvas.component.html:163, `data-part-outline`, outline-2 primary) and crop outlines
     (canvas-frame.component.ts:153); exact element and commit pending. Why no check caught it: the e2e "hover alone
     draws no frame border" (canvas.e2e.mjs:358) compares only the frame and its descendants, so a sibling overlay is
     invisible to it; `yarn studio:e2e` runs in no CI workflow and not in pre-push. Tool fix: B67 (the e2e compares
     every outline and shadow over the frame's box across the whole canvas; studio:e2e runs in CI). Lesson: a guard
     test that runs nowhere guards nothing, and a test scoped to one element misses the same look drawn beside it.
     Update (builder, 2026-11-02): not reproduced. At HEAD no hover rule exists in design-canvas/, design-parts/sketches/
     or sketch-view; the `data-part-outline` lead is dead (`outlines` is bound nowhere); variant iframes sit under a
     pointer-events-none wrapper. A plain click (design-canvas.component.ts clickCanvas), or the press that starts a
     pan, selects the frame and CanvasFrameBorderComponent draws the intended primary selection outline - it looks the
     same as the reported border. Open: did Tom click or only hover. The repro also failed because headless Studio
     renderers died ~5 s after load ("Render process gone") under load ~16; load vs real crash unconfirmed. Second
     gap: the e2e "Sketches" page is a synthetic one-variant sketch, not pages/sketches r2, so this case could never go
     red - B67 also adds the real r2 sketch as an e2e target.
     Update (Tom, 2026-11-02): neither hover nor click - the outline appeared after the Studio window lost focus and
     regained it, so it is a focus effect. Cause pending (builder): which element takes focus or focus-visible on
     window refocus and why it draws the primary outline. Tool fix extends B67: the canvas e2e simulates window
     blur/refocus and asserts no frame outline appears.
     Cause (builder, from code, not reproduced headless): the `ethlete-design-canvas` host (tabindex=0 +
     FocusRingDirective, design-canvas.component.ts:202-206) draws `.et-focus-ring:focus-visible` (primary in dark).
     Window blur fires `blur` on the canvas, which clears the pointer-focus mark (design-canvas :213,
     pointer-focus.ts:22); refocus restores focus without a pointerdown, so Chromium/CEF matches :focus-visible and
     the ring shows. Fix in B97: pointer-focus.ts keeps the mark on a blur caused by the window losing focus
     (`!ownerDocument.hasFocus()`), and the design-canvas blur uses the same check; pointer-focus.ts is app code
     (apps/ethlete-studio), so no SDK change. Landed 849f2792c (spec and canvas.e2e red on old code, green on fix). Headless Chromium never loses window focus, so the e2e asserts only "pointer mark
     survives a synthetic window blur"; Tom confirms the real ring in the app.

184. The grill session asked Tom to reject pages/sketches r2 variants b and c in Studio; Studio has no UI to reject a
     variant (Tom, 2026-11-02). `sketch ready` refuses because b and c draw the same pixels as a, and the builder's
     message said they "need Tom's reject" - a step that does not exist. Lesson: never ask Tom for a UI action without
     checking the UI has it. Tool fix (decided, technical): pixel-identical variants are an agent defect (sketches are
     agent-drawn, finding 180), so the agent removes or redraws them; `ready`'s refusal names that agent action and
     never a user step. A reject UI in Studio, if wanted, is a product question for later.

186. `sketch reject --by tom` recorded the verdict as "rejected by the agent" (Tom, 2026-11-02): sketch-command.ts
     ~l.1062 maps every `--by` value except `designer` to `agent` silently, and the builder handed Tom a command with
     `--by tom`. Tool fix (decided, technical): verdict commands accept only `designer` or a known model id for
     `--by` and refuse anything else with the valid values; the usage/refusal text names `--by designer` for the
     user. Tom re-runs b and c with `--by designer`.

191. The Sketches view build lost the canvas (Tom, 2026-11-02): at 100 % it only scrolls up/down, zoom works only
     via the zoom chip. Cause (builder): the uncommitted rewrite of `design-parts/sketches/sketches.component.*`
     dropped `ethlete-design-canvas` and hand-rolled a camera from the design's own mock pan (`mountFit` in
     `pages/sketches/shared/sketch-rows.ts`): plain wheel pans, ctrlKey is ignored, pan is clamped to a full-width
     world, so there is no horizontal room. `canvas.e2e.mjs` covers the Sketches view but never ran: the slice's
     subagent hit its context limit before its checks, and Tom saw the uncommitted tree live. Lesson: a design's mock
     interaction code is a picture, not a spec for the app; and an interrupted slice reaches Tom's live app unchecked.
     Tool fix (decided, technical): a lint rule in the studio app refuses `wheel`/pointer camera listeners in
     `design-parts/**` outside `components/design-canvas` (CANVAS-CAMERA-OWN); the builder's subagent brief ends
     every slice with the e2e of each view it touched, and a subagent stop without that run is reported to the
     grill as "unchecked" (measured, not blocked).
     Run later (builder): canvas.e2e times out on Sketches waiting for `ethlete-design-canvas` /
     `ethlete-canvas-viewport` + `[data-sk-frame]` - the rewrite left the canvas contract, so no camera case could run.
     A lost contract is reported as a timeout; CANVAS-CAMERA-OWN catches the same cause at lint time.

209. `nx test cli` went red once (part-accept.spec "refuses a part with theming findings", 8.9 s) while a subagent ran
     a build and Playwright in parallel; alone it passes in 1.6 s (builder, 2026-11-02). Cause: no testTimeout in the
     cli vitest config, so the 5 s default applies to a spec that spawns tailwind. A vite "server closed" at the end of
     a real-repo `sketch check --product studio` did not come back on a solo rerun (likely the same load or a port
     clash, not proven). Nothing ran the cli suite on f7e66dbb6: the pre-commit `vitest related` covers only
     apps/ethlete-studio. Lesson: the commit-time spec check stops at one project, and a load-sensitive timeout reads
     as a real failure. Tool fix (decided, technical, B116): part-accept gets its own testTimeout (~30 s); the
     pre-commit related run extends to libs/cli. The rerun's CONTROL-STATE x2 on elements/shell-main variant a goes
     with the shell-main follow-up.

210. The compare of pages/sketches against the app stayed at 81k-104k px per state (builder, 2026-11-02). Three causes,
     none reported by a tool: (a) the Studio title bar renders only under Tauri, so the app shot in the harness was
     32 px high - this broke every shell-page compare since fea9ac862/028ef7006, and nobody saw it because compare
     reports a pixel count, not a vertical offset; (b) the design's `gridFit` runs 6 passes, the app one, so the
     narrow part fits 0.6 % lower (22147 px); (c) pulse dots add +70 px from animation rounding. Fixed in the app
     (uncommitted, Sketches slice): a WINDOW_CHROME token gives the harness Linux window chrome; harness sample
     adapter for part:'narrow'; canvas.e2e builds synthetic sketches (it crashed on the deleted components-zoom-chip).
     (b) in progress: the app copies the 6-pass loop. Lesson: compare says how much differs, never how - a whole-shot
     offset and a scale gap look like any other diff. Tool fix (technical, B117): compare reports a vertical offset and
     the fit scale per picture; both pictures freeze `animate-*`; `design task` lists merged-design `data-sk-*` markers
     missing from the app DOM; per-part fixtures, and a warning when a design prop value does not match its shape.

211. In the design pictures of pages/sketches the shell title bar renders unstyled: the sr-only "Control K" is
     visible, no keycaps, no window buttons (builder, 2026-11-02; 3260 px on each wide state). Suspected cause: `ng()`
     emits the SDK CSS once per render process and attaches it to the first render; `prepareShots` renders the title
     bar in `slot('shot')` frames that are blanked, and the CSS goes with them; the title-bar render also drops
     `search.styles`. Nothing caught it: check and the go accepted a picture with a visible sr-only text. Decision
     (technical, doc agent): fix it in the design tool - `ng()` puts its styles into `drawing.styles`, not into the
     first render; the intended design does not change. pages/sketches then needs a new go from Tom (go hash changes).
     Tool fix (B118): `sketch check`/`design check` flag an SDK component rendered without its CSS (an sr-only element
     with a visible box).
     Built (af28afe38): cause confirmed - `ng()` put the SDK CSS in front of the frame's first `ng()` render only;
     now `ng()`/`ngStates()` return markup only and `withNgStyles()` puts CSS not yet handed out into
     `drawing.styles`. Guard: error rule UNSTYLED-SDK in `design check` empties the slots like the picture and flags a
     `.et-visually-hidden` element that still draws; proven red/green only on a Chromium spec fixture, the run on the
     real old pictures is still owed. The title-bar render dropping `search.styles` has no effect (title-search has
     no stylesheet) and stays as is. Merged pictures of other parts whose SDK component first rendered in an emptied
     slot change too - the fix, not a design change.

213. Navigating between Studio pages (e.g. System -> Sketches) makes the whole app jump: the title bar appears a
     moment after the page, and everything below moves down (Tom, 2026-11-02). Cause (checked in code, builder's
     uncommitted slice): every page wraps its own `ShellPageComponent`, which is created again on each navigation;
     shell-page.component.ts reads the window chrome with `toSignal(inject(WINDOW_CHROME)()..., { initialValue: null })`,
     so each new page renders without a title bar until the async chrome lookup resolves. Lesson: the harness and
     compare get the chrome synchronously (`of(LINUX_CHROME)`), and no e2e navigates between routes and watches the
     layout, so a first-frame state that never settles in a still shot is invisible. Tool fix (decided, technical,
     B121): resolve the window chrome once at app start (root provider / app initializer) and read it synchronously, so
     a page never renders a frame without the title bar; an e2e case navigates System -> Sketches -> Inbox and requires
     the main content's top edge to stay constant in every frame after the navigation (red first on today's build);
     the harness gets a mode that delivers the chrome async, so the same bug shows in a part shot.

216. Sketches slice committed (fb434b68b B121, 155777af9 canvas camera + fixtures from HEAD, 5a29b1b94 Sketches
     variant a; builder, 2026-11-02). B121 cause had a second half: each navigation opened a host
     `window_chrome_watch` channel that was never closed. Why the tools missed it: the headless shell stub had no
     `window_chrome_watch`, so headless runs had no title bar at all; the harness gave the chrome synchronously and
     never navigates; e2e and verify look at settled frames only. Guard page-switch.e2e (chrome after 80 ms, rAF
     frames) red 1/4 before, green 4/4 after; `withStudio` delivers chrome late by default, harness `?hostDelay=`.
     UNSTYLED-SDK proven on real output: old build red (16 hits), new build none. The ng() fix changes no stored go or
     accepted picture in any product (only the emptied-slot compare pictures of pages/sketches), so the pages/sketches
     go stays valid. Open: the tree holds uncommitted Studio-written state since 2026-11-02 09:06 (go.json with
     `auto: true` entries, accepted.json, merged.json, pictures.json, two studio-lab sketch.json) that no session owns,
     and `design check` warns "changed outside a sketch" for canvas-viewport, disclosure, canvas-frames, shell-main,
     pages/flows, pages/inventory. Lesson: Tom's Studio clicks write files, but nothing commits them or warns that
     they float. Tool fix (technical, B123): `design check` warns UNCOMMITTED-DECISIONS when go/accepted/merged/
     pictures differ from HEAD; the builder commits Studio-written state as its own commit per slice, after checking
     no go entry was written by an agent. Also `design check <part>` ignores the positional part and checks the whole
     product: honour it or reject it with a hint to `--part`.

218. `design task pages/sketches --verify 5a29b1b94` refused (25 files outside the allowed set) but exited 0, so no
     implemented.json was written and ready did not run (builder, 2026-11-02). 21 of the 25 were design files of the
     same commit (merged pages/sketches design, deleted sketch dirs); 4 were app wiring that feeds the part
     (system-view/inbox-comments.ts, system-tree.ts, system-view.component.ts and its spec). Lesson: a refusal that
     exits 0 reads as success in a script, and the allowed set knew only the part's own files, so a normal slice that
     commits design and app together cannot verify. Tool fix (decided, technical, B125): verify exits 1 on refusal;
     `.ethlete/design/**` never counts as implementation (one summary line); `task` lists wiring files up front (files
     that import the part plus their direct imports) and verify allows them with one WIRING line each; no per-file
     `--allow` flag. Then verify 5a29b1b94 again and mark ready.

221. B125 landed (e07475c08, builder, 2026-11-02): verify on 5a29b1b94 skips 21 design files, allows 6 wiring files,
     and refuses only on the drawing compare (70 px animate-pulse). The earlier "exits 0" was wrong: the builder piped
     the output through `tail`, which hid the exit code; a spec now locks exit 1. Weak point: system-view.component.ts
     counts as wiring only because shell-logo.spec.ts happens to import both it and SketchesComponent; it is the
     parent of the part's importer, which "importers plus their direct imports" misses. Lesson: a fixed import depth
     and a spec's imports are proxies for "is on the path that mounts the part"; the next deeper nesting refuses
     again, and a spec edit silently changes the allowed set. Tool fix (decided, technical, B128; doc agent overrides
     the builder's "one more level"): wiring = every non-spec file under the app that transitively imports the part
     (its ancestors in the import graph, stopping at the app root), plus the part's own spec; spec imports never add
     wiring. Keep the one WIRING line per file so a wide set stays visible.

222. B117 compare slice landed (d4cd2c8b3, builder, 2026-11-02): the design side awaited `finished`, which skips
     infinite animations, so it shot a random pulse frame while the app side ran with animations disabled; now held
     at the start frame and verify 5a29b1b94 compares 9/9. The next gate, the action check, then missed 11 actions:
     9x the shared host `DesignCanvas` (pan/zoom, every state) and 2x the "Pausiert" badge button (paused,
     paused-reason). Facts for (B): the merged design renders that badge through `holdTrigger` as a real button with
     `aria-expanded` that toggles `[data-sk-hold-reason]`, and has its own `paused-reason` state, so the design means
     it to be clickable; only the `data-et-action` marker is missing. Lessons: (1) 5a29b1b94 ran compare but never the
     action check, so 11 misses passed a commit unseen; (2) a design helper drew an interactive button with no action
     marker and neither `check`, `sketch check` nor `sketch ready` flagged it, so the gap surfaced only at verify;
     (3) a shared host component is chrome for every canvas page, not an action of each part. Tool fixes (decided,
     technical): B129 the product config declares host components (DesignCanvas) and the action check reports them as
     one "host ... not checked" line instead of a miss, never inferred; B130 a check rule flags any interactive
     design element (button, `[aria-expanded]`, `[role=button]`, a click handler) without `data-et-action`, at draw
     time; `holdTrigger` gets the marker in the merged design and in round-2 variant a, so Tom's pending go of
     pages/sketches covers it (no extra design round; the app button stays); B131 `design compare` on a part with a
     go runs the action check too. Also: frame-bootstrap.spec.ts and one UNSTYLED-SDK spec fail on clean HEAD
     (withNgStyles export missing in the vm-loaded define-call); a builder subagent fixes it and reports why
     pre-commit missed it (lesson pending).

223. Two CLI specs red on clean HEAD since af28afe38, fixed in 1f9431a0c (builder, 2026-11-02): the fixture
     `__fixtures__/frame-bootstrap.mjs` hand-stubs `../define-call` without `withNgStyles`, and UNSTYLED-SDK was
     missing from `CHECK_RULES`. Pre-commit runs `vitest related` on staged files; frame-bootstrap.spec loads
     frame.ts by path (spawnSync + vm) and check-rules.spec reads render-check.ts as text, so no import edge exists and
     `related` never picked them. Lesson: a spec that loads source by path is invisible to the module graph, and a
     hand-written stub drifts from the module it stands in for. Tool fix (decided, technical, B132): a related-map
     file (spec -> source globs, not a comment header) that the pre-commit hook merges into `related`; a lint/check
     fails when a spec under libs/cli reads or spawns a source path (`readFileSync`, `spawnSync`, `vm`) and has no
     map entry; the builder confirms that pre-push or CI runs the full CLI spec suite, and adds it if not.

226. Round-2 sketch of pages/sketches went stale (Tom, 2026-11-02): d2d484c55 edited the merged pages/sketches design
     (hold toggle action marker) while the round-2 sketch (78f0fbb3a) was open, so Studio showed the base as changed
     since the sketch. Lesson: nothing stops a design commit on a part with an open sketch round; Tom finds it at his
     pick. Tool fix (decided, technical, B138): `check` (and so pre-push) refuses a commit that changes a part's design
     while it has an open sketch whose base no longer matches, unless the sketch is rebased in the same commit; the
     refusal names the rebase command.

230. Builder commit 3be274358 (B133) swept the B138 draft in check-system.ts/.spec into its commit (two parallel
     slices on one file), so HEAD was red until 7b6e79545 (builder, 2026-11-03). Why no tool caught it: pre-commit
     runs the related specs on the working tree, not on the index, so a commit whose staged content is red passes
     when the tree is green, and a clean staged part cannot be committed while the tree is red. Lesson: a check
     before a commit must test what the commit contains. Tool fix (B143): pre-commit runs `vitest related` against
     a checkout of the index, like pre-push does for HEAD. Builder rule: never give two parallel slices one file.

233. The B145 comment sketch (5caf55609, pages/system variant a) could not be marked ready: `sketch check` failed on
     CONTROL-STATE for the merged states `part-focus-visible` and `points-closed-focus-visible` (the open-points chip
     focus ring), which the variant did not touch; the product check does not report them (builder, 2026-11-03). Why:
     `controlStateGapsOf` judges by state name, and sketch check does not separate gaps the variant introduces from
     gaps already in the base. Lesson: two checks that judge the same input differently block work for a reason the
     user cannot act on. Tool fix (B152, technical): sketch check and ready count a gap only when the variant adds it
     (unchanged-since-base logic as in the ratchet), and the sketch and product checks agree on the same input.

236. `studio-api-level.spec.ts` fails since B147 (a028e8707): `rules/orphan-endpoint.ts` contains the string
     `/__design/`, which that spec forbids in cli sources outside the server. Nobody noticed, because the pre-commit
     hook runs only the specs `libs/cli/related-map.json` maps to the changed files, and a spec that scans every cli
     source is mapped to none of them (builder, 2026-11-03). Lesson: a spec that guards all sources of a lib must run
     for any change in that lib; a related map that only knows direct relations hides it. Fix: B156, the related map
     lists source-wide specs (studio-api-level) as related to every cli source file, new ones included.

238. Three builder slices in one morning (B152 87de26aff, B155 653c345ad, B156 2666cc517) shipped new specs that
     were never seen red; each report says so itself (builder, 2026-11-03). Red-first is a rule in the sub-agent brief
     only, and nothing checks it, so it erodes under load. Lesson: a rule an agent must remember is a rule that slips;
     the proof that a spec can fail must be produced by a tool, not promised in a report. Fix: B161, a `red-check`
     script: for a commit that adds or changes specs, it checks out the parent's non-spec files, runs the changed specs,
     and fails unless at least one new test fails there; the builder's report quotes its output.

244. While proving B171/B172 the builder hit three CLI gaps (2026-11-03): `design shot` with a single `--state` and no
     `--states`/`--variants` prints only usage; `--out` with `--variants` prints only usage; `sketch check` still checks
     rejected (not only withdrawn) variants. No spec covers flag combinations, only the flags one by one, and a bare
     usage print reads to an agent like its own typo, so it works around the tool instead of reporting it. Lesson: a
     valid flag combination the tool refuses must say which combination and why, and each documented combination
     gets a spec. Fix: B180 (technical) - accept both combinations, skip rejected variants with the withdrawn NOTE,
     and a usage refusal names the conflicting flags.

249. `sketch ready` auto-merges and writes shared JSON hunks (merged/accepted) that the agent cannot commit under the
     pathless-commit hook, and the subagent brief's hunk-patch flow ends in a pathless `git commit` the hook denies
     (builder, 2026-11-03). Two tools disagreed on how a commit works, and only a human-run hook noticed. Lesson: a tool
     that writes shared files must also name the exact way to commit its own lines. Fix: B184 (technical) - a
     `design commit-hunks <file> --part <p>` helper (HEAD + own hunks, `commit -- file`, restore the rest); `sketch

250. Sketch dirs are always `<layer>-<name>`, so a second sketch on the same part collides with the first (builder,
     2026-11-03). Fix: B185 (technical) - `sketch new --name`.

257. Tom (2026-11-03): the Sketches canvas no longer pans past the top-left (B186). Cause (builder): 030fe2f36 added
     `clampPan` / `room` / `shownPan` in `design-parts/sketches/sketches.component.ts`, probably for the sticky state
     column; Flows, System and Inbox have no clamp. Why nothing caught it: the CANVAS-CAMERA-OWN lint rule from finding
     191 was decided but never built and had no STATUS B item, and as decided it would only have seen wheel/pointer
     listeners, not camera math; canvas.e2e's "left drag on an empty area pans" would have gone red on Sketches, but
     no e2e ran for 030fe2f36, and no case pans past the content edges on purpose. Lessons: a decided tool fix without
     a B item is not decided; a rule must target the defect class (camera state owned outside the canvas), not one
     symptom; a slice that touches a view is not done without that view's e2e. Fix: B186 (clamp removed, sticky gutter
     keeps max(0, -x), e2e "pan beyond every edge" on every canvas view, red first); B196 (technical) builds
     CANVAS-CAMERA-OWN for any pan/zoom state or clamp in `design-parts/**` outside the canvas component; B197
     (technical) a script maps a commit's changed files to the views they touch and runs those e2e; slice reports
     quote it like red-check.

258. The empty title-bar frames in the same screenshot were a slow load (builder, 2026-11-03): all 60 iframes are
     destroyed and recreated right after the first render (60 ERR_ABORTED), then load 6 at a time (~15-20 s), and every
     Vite full reload from parallel agents' edits under `.ethlete/design` reloads them again. While loading, a frame
     shows only its bordered 150 px measuring strip, so Tom cannot tell loading from broken. No check measures load
     work (frame creations, aborted requests). Fix: B198 (technical) - no iframe recreation after first render, visible
     frames load first; a spec counts iframe creations == frame count. B199 - the canvas-frames loading state as a
     Studio sketch, after Tom's B178 pick.

260. B183 deviated from the decision (builder, 2026-11-03, c56a88d4a): instead of loading the module, the LIVE check
     now skips a part whose state names it cannot read statically - silently. A check that skips without a word reads
     as passed (same class as findings 246 and 254). Decided (technical): B183 reopened - (a) now a NOTE "live states
     not checked: <part>: spread states"; (b) load the module through the B182 private build, then remove the skip.
     Also: a `hold` set for a CLI bug outlives its fix and `ready` only refuses (B200: the refusal names
     `sketch release <part> --by`); parallel commit-hunks race on `.git/index.lock`, and d962c4109 picked up two foreign
     auto-accept entries (B184 retries on the lock and stages only its own hunks).

261. `sketch new --name` (B185, 088b27cfb) gave sketches a second key form, but `check-sketches.ts` (~l.109) still
     compares `sketch.target` with a part key, so it silently skips a named sketch (builder, 2026-11-03). Why no tool
     caught it: the B185 specs cover only `sketch new`; no spec runs a named sketch through the code that reads
     sketches, and a skipped sketch is silent (same class as findings 246, 254 and 260). Lesson: a new key form gets
     a spec in every consumer of the key, not only in its producer. Fix: B203 (technical) - compare through
     `partKeyOf`, grep every other `sketch.target` equality check, and add one spec that drives a named sketch through
     `sketch check`/`ready`/`go`. Also open: `server-identity.spec` "reports no installed cli when the project has
     none" failed in the full design vitest run; the builder re-runs it on a clean HEAD.

262. B173 (builder, 2026-11-03): `commit-hunks` splits only part-keyed files, so the agent committed
     `capabilities.json` (keyed by capability id) by hand - the hand commit `commit-hunks` exists to replace. Why no
     tool caught it: B184 was specified for go/merged/pictures; nothing lists the shared design JSON files the tool
     must cover. Lesson: a tool for "shared files" is tested against the list of every shared file, not the ones that
     prompted it. Fix: B204 (technical) - `commit-hunks` covers every shared JSON under `.ethlete/design`
     (capabilities.json by `--id <capability>`); a file it cannot split refuses with a message; one spec iterates all
     shared files.

269. Tom's merge of the pages/system sketch (pick b, 2026-11-03) failed in Studio: components/title-bar had changed
     since the sketch was made. Why no tool caught it: Studio offered the pick on a sketch with a stale base and only
     the merge checked the base, so Tom learned it after deciding. Lesson: a stale base shows before the pick, not at the
     merge. Fix: the builder rebases the sketch and keeps pick b; B220 (technical) - Studio marks a sketch with a stale
     base (also a child part) "braucht Rebase" before the pick and `sketch ready` refuses it; when only a child part no
     variant touches changed, the tool rebases on its own and keeps the pick.
     After the rebase (builder, 2026-11-03): `sketch check` fails a and b - "drops the state send-rejected that
     pages/system has in studio". acd6ce0bf (Tom's comment error texts) added that state to the merged part while the
     sketch was open; `sketch rebase` moves the baseline but does not port new merged states into the variants, and a
     `git apply --3way` of the diff conflicts. Lesson: a design change to a part with an open sketch reaches the sketch
     in the same step. B220 grows: `sketch rebase` ports new merged states into every variant (3-way; on conflict it
     lists the conflicts and stops), and a design commit on a part with an open sketch names that sketch.

273. Title-bar r2/r3 (builder, 2026-11-03, 4054edf4c, 9e94a2dc3): three tool gaps. (1) The ready rule "first changed
     state draws identical frames" fired on linux-full-update while the shot showed 0 px change: the merged markup was
     refactored after the sketch's baseline, so every variant trips it. (2) `design shot` still prints "not drawn" for
     the hover, active and focus-visible cells of title-bar after B171. (3) `sketch variant --from e` built on a
     withdrawn variant without a word. Why no tool caught them: ready and shot compute "changed" and "drawn" in two
     places, and nothing compares them; withdrawn has no meaning outside `ready`. Lesson: one measurement of change
     feeds every command that judges it. Fix (technical): B209 - ready takes each variant's first changed state from the
     shot's pixel diff; B210 - shot draws the interaction cells the way `sketch check` drives them; B211 - a variant
     made from a withdrawn one says "from withdrawn <v>". Also: a spec timed out at 5 s under load in pre-commit
     (passes alone in 1.5 s) - goes into B207 (re-run a timed-out spec once alone); two checks in one session disagreed
     after a dist rebuild - B191.
     B210 cause (c12a65e92): `design shot` took its state names from `drawnStateNamesOf`, which drops every row whose
     forced controls are only unchanged SDK components; B171 (327bd8362) fixed only the `--state <name>` path, and a
     grid shot passes no name. Fix: `shotStateNamesOf` returns every defined state. Still open: shot and `sketch check`
     share no interaction driver, so the lesson (one measurement) is not met yet.

274. pages/system rebase (builder, 2026-11-03, 288252ce4): two tool gaps. (1) `sketch ready` on a sketch whose status
     is already ready exits 1 with "pages/system is ready, not in progress", also right after a rebase, so every rebase
     reads as a failure. (2) The tree's go.json holds 127 changed lines nobody claims, one of them `"by": "tom"` ->
     `"by": "user"`: the author of a go changed without a command that says so. Why no tool caught them: ready treats
     its status as a gate, not as a state to refresh; go entries carry no writer, so a rewrite is untraceable. Fix
     (technical): into B220 - `sketch ready` on a ready sketch with a refreshed base re-readies and exits 0 ("still
     ready, base refreshed"); B223 - every go.json write names its command, and `by` is never rewritten on a refresh
     Cause (builder): no `by` was rewritten - the 127 lines only reorder keys; the "user" line is a diff alignment
     artifact. The CLI writer sorts keys on every write; the hand copy-aside hunk commit e2f9391d7 appended three new
     entries instead, and every later hunk commit kept that order. Fix: into B204 - commit-hunks writes keys in the
     writer's sorted order (spec: committed file equals the writer's output), reports a semantically empty hunk as
     "order only", and the manual copy-aside rule leaves the brief once B204 covers every file. The sorted go.json is
     committed as-is.

276. Builder report (2026-11-03, e245c85de, B201): two tool gaps. (1) `yarn agents:sync` reorders the two Stop hooks in
     .claude/settings.json on every run: the hand registration of builder-chat-words.py (3326a7670) and the sync
     disagree on order, so the tree is dirty after each sync. (2) In a full product check, RENDER timeouts from
     parallel load (shell-project-switch, studio-menu: 10-13 s alone, 0 findings) read as real findings. Why no tool
     caught them: sync rewrites the whole hook list instead of merging into it; the checker has one RENDER code for a
     timeout and a broken render. Fix (technical): B224 - agents:sync keeps the existing order of hook entries and
     only inserts or removes its own, so a second sync is a no-op; into B221 - a render timeout gets its own code,
     distinct from a render error, and is re-run once alone before it counts.

280. B194 (builder, 2026-11-03, 649b04940): `definePart({ instant: '<reason>' })` replaces per-pair `unreachable` for
     parts whose states switch without motion; a loop in an ongoing-work state is still asked for; an empty or
     non-literal reason is MOTION-INSTANT. Gap: only `sketch ready` prints the instant note, `design check` does not.
     Why no tool caught it: each command assembles its own report lines, with no shared note list. Fix: B226 -
     `design check` prints the instant lines from the same source. elements/canvas-frames moves to `instant` in the
     B199 commit. Not run yet: B194 through the built CLI.

282. B221 + B222 (builder, 2026-11-03, a293f319f, 5f839ff40, ecf7b626b). B221: the real silent pass was `design ready`.
     drawnFindingsOf (drawn-open-points.ts) ignored a state that never drew, so ready now refuses ("cannot draw").
     page-sketch did not fail again on its own. Its cause is lost because render-check kept only the first line of
     frame.ts' error; RENDER now carries the whole message. Inference, unproven: a module import failed under
     full-run load. A timed-out part is redrawn once on its own; a second timeout is RENDER-TIMEOUT (exit 1, blocks
     ready). B222: check.ts' parser dropped args and read an unknown flag as the value of the flag before it. Why no
     tool caught it: no spec fed check an unknown or form-ignored flag, and no spec had a state that never drew.
     Fix: a positional part narrows every list. An unknown flag, an ignored flag or a retired flag gives exit 2.
     Decisions (technical, doc-agent): (1) with no browser, a CI run passes "RENDER CHECK SKIPPED", and a dev-machine
     --product/--part run fails with exit 1. (2) The frame.ts import retry stays until the next full-run failure shows
     its cause. B227 adds the unknown-arg guard to every design subcommand. Open: a full `design check --product

283. B199 merge without a record (builder, 2026-11-03). The tree is byte-equal to canvas-frames variant c, apart
     from the `@shared` -> `./shared` import rewrite in merge-shared.ts. Nothing records that c was merged or who
     decided: sketch.json at HEAD has no `decision`, the merge deleted the sketch dir, and merged.json/pictures.json
     hold only hashes. So Tom could not say for sure whether he merged c. Why no tool caught it: `sketch merge` never
     had to prove a pick. Fix (B228): merge writes `{variant, decidedBy, at}` into merged.json and refuses a merge
     without a recorded pick. B208 landed in 2d3251bfd; the settings.json restore proved B224 live.

284. HEAD's cli did not compile (builder, 2026-11-03). 5f839ff40 (B221 timeout redraw) has TS2345 in
     render-check.ts:526-536, so `yarn design` (nx build cli) failed and every run used a stale dist from 11:49. The
     full studio check therefore did not cover a293f319f..ecf7b626b. Why no tool caught it: `yarn commit` runs only
     the related vitest specs, and vitest transpiles without a type check, so a type error lands green. The pre-push
     typecheck comes too late for unpushed slices that the next slice builds on. Fix (B229, decided, technical):
     `yarn commit` also runs `tsc --noEmit -p <lib>/tsconfig.lib.json` for each lib it touches, in the same throwaway
     worktree. B221 goes back to built until the type fix lands and the full check reruns. Also: pages/system merged
     (c02c7aede, 1eb065b87, f07311c49), but the go is missing (go.json holds the old hash 4fd4095b3c562d4f, merged is
     a8cacb703e9e5945). canvas-frames was restored to HEAD and waits for Tom's pick. B223 landed in 6ba7806c6 (B219's
     refreshedBy/cause had never landed before it).

285. B229 + canvas-frames instant (builder, 2026-11-03, fe03eb979). B229: `yarn commit` now type-checks lib and spec
     projects. HEAD already carries 13 spec type errors (cli 12, agent-rules 1), so for now a spec project blocks only
     on errors in the committed files. B230 clears the 13 and drops that filter. canvas-frames: 40 pairs became
     `instant` and 70 real `unreachable` pairs stayed. That declaration edit landed after Tom's go (12:09:43Z), so
     the go can go stale through a change that draws nothing. Why no tool caught it: go covers file hashes, not what
     the files draw (same lesson as title-bar r3, 281). Order rule: declaration migrations of a merged part are made
     before Tom's go. If the check shows the go stale, Tom gives it again. A draw-free go refresh is part of B220's
     draw-free signal.

286. `instant` breaks the part type (builder, 2026-11-03, design check on a fresh dist after d2f70de3c). B194
     (649b04940) taught the parser `instant`, but `PartSource` lacks it: TS2353 at canvas-frames.ts:219. Why no tool
     caught it: B194's specs parse `instant` from a string, and no spec type-checks a part source that uses it. B229
     type-checks libs, not design products. Fix (B231): add `instant` to `PartSource`, plus a spec in which a fixture
     part using every key the parser reads passes tsc, and which compares the parser keys with the type keys. Tom's
     canvas-frames go held after the instant edit (AUTO ACCEPTED). B226 is proven on the real part. go.json is
     committed by Tom or Studio only, never by an agent.

290. B230 red proof (builder, 2026-11-03). The new node:test case is red on 50024f9b8^, but by a crash (TypeError:
     the old function took 3 args), not by an assertion. The behavioural red was shown by hand: the old function
     returns [] for a type error in an untouched spec. Why no tool caught it: red-check counts any failure as red, so a
     signature change passes as proof. Fix (B238, decided, technical): red-check labels a failure that is a thrown
     TypeError/ReferenceError outside an assertion "RED BY CRASH", and that is not proof. The slice then quotes a
     behavioural red.

293. Tom's title-bar merge failed in Studio (2026-11-03, 13:13 CET). Tom picked f and the merge failed, and the
     error text is lost: Studio holds the design server's log in a pipe that nothing can read later. Likely cause,
     unproven: the sketch was older than the merged title-bar (the rebase came at 13:50), so mergeSketch answered 422
     "changed" (needsRebase). Why no tool caught it: Studio offered the merge button on a stale base (B220b), and a
     failed Studio action leaves no readable trace. Fix (B241, decided, technical): Studio writes each refused design
     action (command, part, status, message) to the host log file, and the builder can read it afterwards. At Tom's
     request the builder merged f via the CLI (72ecd0adb). merged.json now holds `{variant: "f", decidedBy: "user",

294. B227 + B240 data (builder, 2026-11-03). B227 2699545b4: argsOf takes each command's switches, so any other
     --flag gives "unknown flag --x (flags: ...)" and exit 2 across all 18 callers. Real repro: `design shot

297. B227b + lint slip (builder, 2026-11-03). e8a64d994: product, new and system parse via argsOf and refuse
     unknown flags with exit 2; each sketch subcommand derives its flags from its SKETCH_USAGE line (so `sketch check

298. B244 as built (builder, 2026-11-03). f4e6e5b8b: `yarn commit -- <paths>` maps each non-docs path to the nx
     project whose project.json owns it (lint target or eslint.config.mjs), and runs `nx run-many -t lint` on them in
     the throwaway worktree, after tsc and before the specs, with the main checkout's nx cache. A lint error refuses
     the commit and names the projects. Verified: a node:test case builds a tiny nx repo and is refused on a
     `no-debugger` error, a docs file lints nothing, and the clean commit lands; red-check RED; a real probe (a
     5-param arrow in libs/cli) was refused by max-params in 11 s with tsc. Not verified: a plain `git commit` without
     paths (the hook) does not lint; ethlete-studio lint time. Second defect found on the way: 50024f9b8 made every
     tsc error block, but its end-to-end case in commit-wait.spec.mjs still asserted the opposite and failed; aligned
     in f4e6e5b8b. Why no tool caught it: `yarn commit` selects only Studio and cli suites, so a change in
     tools/scripts runs none of `yarn test:tools`. Recommended fix (B245): a tools/scripts change runs the
     tools/scripts specs (node --test) in the same worktree. Decided (doc agent): B245 as recommended, technical. The
     plain `git commit` gap is closed by B244b (decided, technical): the pre-commit hook runs the same lint on the
     projects of the staged files, unless `yarn commit` already linted that exact tree.

299. B245 + B244b as built (builder, 2026-11-03). 9c015d2af: a tools/scripts change adds a `tools/scripts` suite
     that runs every tools/scripts/*.spec.mjs with `node --test` in the worktree (NODE_TEST_CONTEXT stripped, or the
     nested run skips itself). The pre-commit hook lints the projects of the staged files in its index checkout, and
     skips only when yarn commit tested that exact tree, or when the files committed since select no specs and lint
     no project. Verified: two node:test cases (a failing tools spec refuses yarn commit; a lint error refuses a
     plain `git commit -i -- <path>`), red-check RED (3 cases); a real hook probe (5-param arrow in libs/cli) was
     refused by max-params in 5 s. Not verified: the eslint-rules specs of `yarn test:tools`
     (apps/ethlete-studio/eslint-rules) are still not selected by a commit.
     Decided (doc agent) on the eslint-rules gap: B245b, technical, but general rather than one more directory. `yarn

303. Comment draft built into pages/system (Tom, 2026-11-03: "again wrongly part of the system view instead of an
     element/component; this still happens far too often"). Facts (builder): pages/system/system.ts:99-137 holds an
     inline draft card with its own busy and error states (:82-97, states :307-308) and an inline crosshair target
     (:70-78), merged with the comment button sketch 63785ccd0. pages/inbox/shared/inbox.ts:316-329 holds a second,
     different draft built from raw `<et-textarea>`/`<button et-button>` strings (4a960f125). The app already
     reuses one `ethlete-comment-draft` across two hosts, under a page-named folder. There are 8 page-local
     interactive places today: system commentTarget and commentDraft; inbox row, draft popover, raw `<et-switch>`,
     raw "Erneut laden" button; merge listRow; sketch-status holdTrigger. capabilities.ts regex-patches `<button`
     into embedded markup. Why no tool caught it: no rule looks at interactive UI inline in a page. CONTROL-PART-MISSING
     only covers controls the page declares, and a page sketch may add UI freely, because the sketch check runs the
     same rules. Q252's list of parts to extract never named the draft. Fix (B247, decided, technical): the problem
     rule INLINE-UI-IN-PAGE scans page sources (and page sketch variants, so it blocks sketch ready and merge) for
     `<button`, `role="button"`, `tabindex`, raw `<et-` and `data-et-action` outside an embedded part's output, and
     names the part to create. The same rule is the design half of A10's embed-don't-copy check. Fix (B248, decided):
     extract the 8 places into elements/components parts; a pixel-free extraction is a tidy. The two drafts differ, so
     the shared components/comment-draft is a sketch with variants for Tom. B237 (the canvas-frames overlay covers the
     draft) is fixed inside that sketch. The builder also verifies whether COMPONENT-COPY flags inbox.ts:309/316-335.
     If it does not, that is a gap in the same item.

304. Tom cannot pick on the B240 sketch (pages/sketches, 5e51db22a, 2026-11-03: "it does not seem ready, I cannot
     pick anything; this happens more and more often"). The badge says "Keine Aktivität" and no variant offers
     Übernehmen. The empty b/page-100 frame was only still loading (Tom), but the loading state looks bad. This is
     finding 208 again: a drawn round committed while still in progress. Cause (builder): ready was skipped, not
     refused. 5e51db22a committed sketch.json as "in progress", and the builder's own handoff step ("Tom picks in
     Studio") left ready out. ROUND-NOT-READY did fire (sketch-command.ts:802-805, printed :1053-1056 as console.warn,
     exit 0). Why no tool caught it: f7e66dbb6 made ROUND-NOT-READY a warning, and a warning that nothing blocks on is
     no fix (finding 295). Unblocked in 88a3f737e (`sketch ready` exit 0). Fix (B252, decided, technical):
     ROUND-NOT-READY becomes a problem; the commit hook and `sketch report --done` refuse a drawn round that is neither
     ready nor held. Loading state (B253): the sketch view renders a picture-loading state that no part designs. The
     variant cell (pages/sketches/shared/sketch-rows.ts:128/:146) has no loading branch; only elements/canvas-frames
     designs one (canvas-frames.ts:631, "Lädt" badge :171-180). That makes it a B251 case: an undesigned state the app
     renders. Fix (B253, decided, technical): a sketch on pages/sketches that adds a loading state to the variant cell,
     with 2-3 variants, one of them embedding (not copying) the canvas-frames loading look; Tom picks. Whether the cell
     becomes its own element is decided after the pick. The builder checks whether the slow frame is the failing B241
     e2e case (a listing refresh re-navigates iframes and leaves 150px frames).

310. One open sketch per target blocks B253 and B261 (builder, 2026-11-03). pages/sketches holds the B240 round r1,
     ready and waiting for Tom's pick. A second question about the same page (the loading state of the variant cell, the
     look of the render-error badge) would have to start round r2, which records r1 as lost without Tom deciding. Why no
     tool caught it earlier: page-local UI kept unrelated questions on one target, so they queue behind each other.
     Decision (technical): one open sketch per target stays, because it keeps a pick coherent. An independent question
     gets its own part: the render-error badge becomes components/sketch-status-badge and the variant cell becomes
     elements/variant-cell, each as a pixel-free extraction (the same direction as B248a). B253 and B261 are then
     sketched on those parts, in parallel with B240. The refusal of a second sketch on the same target names this way
     out ("extract the region into a part and sketch that") instead of only refusing.

312. sketch ready reports pre-existing problems only as a count (builder, 2026-11-03, B240). It prints "5 problems were
     there before" per variant and the code never lists them, so nobody can check whether they matter or whether a
     variant added one in their place. The problem list of a plain part check on pages/sketches (36 SKIP-SCOPE,
     2 COVERED) does not map to the 5. Why no tool caught it: no spec asserts that a counted problem is also printed.
     Decision (technical, own slice B264, not folded into B255): sketch check and sketch ready print each pre-existing
     problem as rule, file, message and variant, in the same line format the part check uses; a spec asserts the
     printed lines equal the count. The B240 pixel compare is not final yet: b and c are 0 px, a differs only in the
     caption strip, and the "after" side was a later HEAD, so the exact a7bad251a^ vs a7bad251a shot is still owed.

314. A design check ran a stale CLI dist (builder, 2026-11-03, B248b). The emptied OPEN_INLINE_UI list lives in
     libs/cli, and the first check ran dist/libs/cli from before the edit, so it judged with the old list. Its COVERED
     problem in 5 system states is gone on the fresh dist, most likely because that dist also carries fe2d8b87f (B258
     settles embedded frames before a shot); not traced. Why no tool caught it: stale-dist.ts and the B256 guard watch
     the render packages and the design mocks, not the CLI itself. Tool fix B267: the design command refuses to run
     when libs/cli sources differ from what dist/libs/cli was built from, and names `NX_NO_CLOUD=true npx nx build cli`.
     B248b itself is accepted with "NOT RED": the change only empties a data list, the rule's own spec covers the
     mechanism, and the check runs show 0 INLINE-UI hits on pages/inbox and pages/system.

315. An empty controls object counts as missing (builder, 2026-11-03, B262). The extracted components/sketch-status-badge
     and elements/variant-cell are not interactive, but both carry the open point "no controls declared", and
     `controls: {}` does not clear it because open-points.ts treats an empty object like an absent key. That blocks
     `ready` for every non-interactive part. Why no tool caught it: no spec separates "declared none" from "not
     declared". Decision (technical, B269): an explicit `controls: {}` counts as declared-none; a spec asserts that a
     part with `controls: {}` has no open point and a part without the key keeps it.

318. red-check cannot judge a slice spread over several commits (builder, 2026-11-03, B259). The watchdog landed in
     5f6a7e7fc and f1b295520, so `yarn red-check f1b295520` says "passes at the parent state" (the parent already has
     the watchdog), and 405e73693 gives LOAD-ONLY. The builder proved red by hand: the final spec against the scripts
     of 855305f90 fails 2 cases, against 405e73693 1 case. Why no tool caught it: red-check takes one sha and compares
     with its parent only. Decision (technical, B271): `yarn red-check <base>..<head>` runs the specs of head against
     the code of base and prints the same verdict; a slice report of several commits quotes the range form.
     B259 probe on 9e7ebf434 (load 15-20) moved the B254 blocker: canvas finished in 682 s (its failure is the B232
     re-navigation, fixed in 21dcfc17f), while sketches-tree hangs silently (watchdog: TIMEOUT 180 s, no case reached).
     Decision: B254 waits on a bisect of sketches-tree alone, after B270 gives that suite per-case output. Two
     behaviour cases failed once under load, frame-load-failed "variant frames retried" (B254's own new case) and
     canvas "ctrl-wheel keeps the world point" (171 px). Behaviour cases are not excused by load: each must pass 3 of 3
     at a load below the core count, or it is a defect with a finding.

320. Sketching the variant-cell loading state (B253, 421c6cfaa, builder, 2026-11-03) hit four tool gaps.
     (1) Variant b wants the canvas-frames loading mark, but an element may not import from another element and
     canvas-frames exports no loadingBadge, so b copies the spinner markup. Decision (technical): if Tom picks b, the
     merge first extracts components/loading-mark (pixel-free) and both canvas-frames and variant-cell use it; no copy
     is merged. (2) There is no `sketch target remove`: a second target that the layer rule refuses stays in the sketch
     and blocks ready as "draws the same pixels as Aktuell", so the agent edited sketch.json and deleted files by hand.
     Decision B272: `sketch target remove <part>`, and `sketch target add` refuses a target that would break the layer
     rule up front; spec: add then remove gives an identical sketch.json. (3) "no looping motion in loading" does not
     say how to fix it. Decision: the refusal prints the exact `motions` line to add; folded into B264. (4) The 14 px
     SDK spinner reports CLIPPED on its own internals and needed data-et-skip. Decision B273: verify whether the clip is
     inside the SDK component; if so, CLIPPED does not descend into SDK component hosts and the skip is removed. Low
     priority, not queued: a change that only touches a part's declaration (B269's `controls: {}`) still needs a
     manual copy into every open variant plus `sketch rebase --ported`.

345. Builder (2026-11-04, B287): the title-search gate was red (459-1048 px off), but with a freshly built CLI compare
     is 0 px in all 8 states and the app component is unchanged since 6e3c4f00b. Most likely cause (not proven, does
     not reproduce): a stale dist/libs/cli from before 0ddbcc120. Why no tool caught it: `design compare` and
     `design check` run dist/libs/cli without a stale check, so a stale CLI reports gaps HEAD does not have. Tool fix
     (technical): the CLI rebuilds or refuses when its dist is older than the libs/cli sources, as the gate does for
     the libs, with a spec. Built as B293. B287 closed with no app change.

346. Builder (2026-11-04, B254, 5a28fbee9): when the design server cannot load a variant's part module, the variant has
     no frames, so Studio showed no render-error badge and still offered Übernehmen on the broken variant. Fixed:
     erroredVariantsOf also counts targets with `error`. Why no tool caught it: `sketch ready`/`sketch check` reject an
     unloadable variant only at ready time, on the CLI's own server; a variant that breaks later shows nothing in
     Studio. Tool fix (technical, queued as B296): Studio treats every server-reported part error as pick-blocking
     through one frame-error path, not per view.

350. Builder (2026-11-04, B291 push 2): the hook passed, then the push died with "Connection to ssh.github.com closed
     by remote host". Cause: git opens the SSH connection before pre-push; the old hook (clone, lint, typecheck,
     Studio gates; several minutes) outlasts GitHub's SSH idle timeout, so a green hook still ends in a failed push.
     This also explains the end of push 1 and why pushes went out with --no-verify. Why no tool caught it: nothing
     bounds the hook's run time. Tool fix: S7 (short hook, Tom 04.11.); the hook gets a time budget well under the
     SSH idle timeout, and the S7 end-to-end run measures it.

370. Tom (2026-11-04, during finding 365): the sketches tree on the System canvas vanished and came back only
     after a reload. Cause (builder): `system-view.component.ts` did `concat(quick listing, full listing)` with
     `catchError(() => of([]))`. When the full listing failed or hit the 120 s timeout (`host/design.ts`), the empty
     fallback replaced the quick result that was already on screen. Fix a36530087: `sketchRead$` in
     `sketch-read.ts` keeps the last items on a failed listing and carries the error as `sketchesError`. Why no tool
     caught it: the lint rule `ethlete/no-silent-catch-error` saw the bug, but Studio runs it as `warn`, and a
     disable comment ("no listed sketches render as the existing empty list") silenced it; 28 such comments exist
     in `apps/ethlete-studio/src`. The spec "quick ok, full fails" came only with a36530087
     (`sketch-read.spec.ts`). Tool fix (B316, decided): the rule becomes `error` in Studio, and one pass reviews all
     28 disable comments (error value or an accepted reason).
