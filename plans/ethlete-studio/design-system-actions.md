# Ethlete Studio - pain points from the self-test

We design Studio in Studio to find where the tool and the workflow hurt. This list collects each
pain point that `design-system.md` reports (state on 2026-10-28). `Lnnn` is a line in
`design-system.md`, where the full report is.

Each entry has:

- **Pain** - what went wrong while we used Studio, the CLI or the workflow.
- **Where** - the incident that showed it.
- **Now** - the workaround that we use today.
- **Fix** - the options for the tool or the workflow.

Status: **open**, **fixed** (fix checked), **unverified** (fix built, not checked), **triage** (a
round 1 report from L700-L1100). A pass on 2026-10-28 checked and fixed most entries. A fixed entry
moves to `design-system-actions-fixed.md` and keeps its number.

Not in this list: the design choices for the Studio pages themselves (for example the zoom
composition of the Sketches page, L3020). Those choices go to Studio as sketches.

## 1. Studio app (native and WebKit)

### 1.2 Studio freezes at 100% CPU during frame reloads - not reproduced (L2697, L2965, L3076)

- **Pain:** Studio hung two times. Cmd+R and SIGTERM did not help. Only a kill of the WebContent
  process helped.
- **Where:** fast reloads of sketch frames while we drew the Sketches page.
- **Fix done:** `frame.ts` has no top-level await during an iframe removal. A native test with 40
  replacements passed.
- **Open:** a 100-cycle run started, but nobody recorded the result. Run it again.
- **Options not taken:** a bounded log of module-load failures with the active frame; a native
  menu item that creates the webview again.
- **Decision (Tom, 2026-10-29):** run the 100-cycle test over SSH on ethlete-mac when it is on.
- **Result (2026-10-29, ethlete-mac, macOS 15.7.7):** 100 cycles with 3 frames: 1 hang in 4 runs
  (after batch 80, WebContent at 100% CPU until the watchdog). 40 cycles passed. Other sessions
  loaded the Mac at the time. Next: 10 runs of 100 on an idle Mac after a fresh `nx build cli`.
- **Result 2 (2026-10-29, fresh `dist`, Mac mostly idle):** 1 hang in 10 runs of 100 (run 6, after
  batch 74). Sample `/tmp/wk-samples/hang-6.txt`: main thread 100% busy in
  `MicrotaskQueue::performMicrotaskCheckpoint` -> `ScriptModuleLoader::evaluate` ->
  `WTF::URLParser` (`parseIPv4Host`), no deadlock. Same shape as the first two hangs. The probe used
  a LAN IPv4 URL; a run against `localhost` is not done. Next: repeat 10 x 100 on `localhost`
  (run the server on the Mac or tunnel over SSH), then decide between a minimal WebKit repro for
  upstream and a workaround (e.g. never remove a frame while its module evaluates).
- **Result 3 (2026-10-29, `localhost` URL over an SSH tunnel, fresh `dist`):** 0 hangs in 10 runs
  of 100. Each run passed batch 100 in about 16 s. No stack: no hang to sample. Load (1 min) 4.3 to
  5.5 before the runs; the probe adds this load. The Mac screen was locked, so the probe in
  `/tmp/wk-probe` turned off window occlusion and hidden-page timer throttling. Without this
  change, all runs stopped at batch 12 or 13 with all processes idle; also with `127.0.0.1`. This
  is page suspension, not finding 1.2. The orphaned `nx tauri:dev` (100% CPU) also loaded the Mac
  in these invalid runs 1 to 4; it was stopped before the valid runs.
- **Result 4 (2026-10-29, LAN IPv4 URL `http://192.168.1.152:<port>`, the unthrottled probe of
  Result 3, `dist` of 19:47):** 0 hangs in 30 runs of 100 cycles. Each run passed batch 100 in
  16.3 to 16.4 s. Load (1 min) 2.4 to 5.1. No hang, so no sample. With Result 3: 0 hangs in 4000
  cycles on both hosts. The LAN IPv4 path is not the trigger. Results 1 and 2 differ from 3 and 4
  in two ways: the throttled probe, and an older `frame.ts` (later changes `43cec7ae9`,
  `144e2d843`).
- **Probe change:** `tools/scripts/verify-webkit-frame-reloads.swift` now always turns off window
  occlusion and hidden-page timer throttling. The probe tests frame replacement, and a throttled
  page only gives false stops at batch 12 or 13 on a locked or covered screen. Checked: 100 cycles
  pass on the locked Mac.
- **Recommendation:** close as not reproduced; no workaround and no upstream repro without a
  reproducing case. Reopen with a `sample` of WebContent if Studio hangs again. A hang plus a
  manual WebContent kill during a pinch can also cause finding 1.1.
- **Decision (Tom, 2026-10-30):** close as not reproduced. Reopen with a WebContent `sample` at
  the next hang.

### 1.5 Studio logs a nested Tokio runtime panic - open

- **Pain (Tom, 2026-10-29):** frequent `tokio-rt-worker` panic: "Cannot start a runtime from within a runtime" at Tokio 1.54.1 scheduler/multi_thread/mod.rs:89.
- **Investigation:** no concrete nested-runtime caller found in Studio commands or the pinned CEF event dispatch. No speculative runtime fix applied.
- **Diagnostic built:** Studio preserves the existing panic hook and force-captures a backtrace to stderr. Requires a rebuilt/restarted native app. Four focused Rust agent tests and rustfmt pass.
- **Next:** capture the next panic's full stack plus triggering action, then fix that call path. Root cause remains open.
- **Static search (2026-10-30, `claude-sdk58`):** no `block_on` caller in the Studio host, the
  pinned Tauri checkout (`9d1a5b1`, including `tauri-runtime-cef`), the updater, or `fix-path-env`.
  `tokio-rt-worker` is the Tokio default thread name, so it does not name the runtime. Dead end
  without a stack.
- **Panic log:** the hook now also appends each report (time, thread, message, backtrace) to
  `ethlete-studio-panics.log` in the temp dir (`/tmp` on Linux). On the next panic, read that
  file and the last Studio action, then fix that call path.
- **Other reported output:** DevTools remote debugging disallowed by system admin, rejected Blink Widget message, Mesa loader permission denied for `/usr/lib64/gbm/dri_gbm.so`, and CEF browser-info timeouts. Their relation to the panic is unproven; retain them with the next stack.

## 2. Review on the canvas

### 2.2 A new sketch adds controls that already exist - unverified (L2562)

- **Pain:** the sketch added a zoom toolbar. The accepted `canvas-frames` chip already does this.
- **Now:** the sketch reuses the chip.
- **Fix done:** the shared canvas element (2.1). No check for repeated markup.
- **Check (2026-10-29):** works, but the chip is drawn twice: app `− | 100 % | + | Fit`, drawing
  `Fit | 24%`. Tom still decides which chip both use.
- **Decision (Tom, 2026-10-30):** both use the app chip `− | 100 % | + | Fit`; the
  `canvas-frames` drawing adopts it.

## 3. Feedback, rounds and merge

### 3.39 A rename across layers needs three merges - open

- **Pain:** moving `comment-pin` hosts from `commentPinStyles` to `commentPin.styles` needs: add
  `styles`, then one page sketch per host, then drop the export. A component sketch may not edit a
  page, and a page sketch reads the merged component.
- **Fix options:** 1. let a component sketch carry host edits that only change an import
  (recommended). 2. a page variant resolves a part from another open sketch (5.21).
- **Decision (Tom, 2026-10-30):** option 1. A component sketch may carry edits to its hosts
  that only change an import.

### 3.41 A `sketch ready` run skipped the auto-merge on a markup-only change - open

- **Pain:** five cleanup sketches (4.40) went `ready` one after the other. Four merged at once;
  `pages/merge` printed `auto-merge skipped: variant a changes open`. `design shot pages/merge
--states --variants` then said "no pixel change, but the markup differs", and a second `sketch
ready` merged it. The first shot probably ran against a base that the merges just before had
  changed (`elements/shell-main`, `components/tree-row`), so the result is flaky.
- **Fix options:** 1. `autoMerged` draws the merged side fresh after a base change since the
  sketch opened, or retries once on a diff (recommended). 2. print the changed pixel count with the
  skip line, so the agent sees noise.

- **Reproduction tried (2026-10-30, `claude-sdk58`):** the `sketch ready` comparison
  (`shotsShowNoChange`) ran from source on `pages/inbox` variant c, the pixel-identical
  correction: three cold runs one after the other, then three at the same time on an emptied
  `vite-check-*` cache. All six returned `true`. Not reproduced, so no retry was added. On the
  next skip, run `design shot <part> --states --variants` at once and record the diff lines.

- **Related fix 3.44:** pixel-comparison results no longer survive into later screenshot requests. Regression reproduces a transient screenshot failure remaining cached, and a stale match hiding a later difference. This removes a confirmed cache hazard; the original first-run visual mismatch is still not independently reproduced.

### 3.45 Recording rejection in prose does not reject a variant in Studio - open

- **Pain (Tom, 2026-10-30):** after the agent said I/J were rejected, Tom corrected it:
  "abgelhent sind sie btw noch nicht, das hast du nur geschrieben. weiteres findings".
  The feedback was in the round note and plans, but both variants remained selectable.
  The agent falsely reported a lifecycle change it had not performed.
- **Evidence:** `SketchVariantInfo` in `system/sketch/sketch.ts` has authors, round and note,
  with no variant rejection/withdrawal state. CLI help exposes whole-sketch discard but no
  per-variant rejection. A round's note or `lost` text does not prevent choosing a variant.
  Discarding the entire sketch would remove the ongoing exploration, not just exclude I/J.
- **Required outcome:** a designer's rejection must be represented as a real, inspectable
  state that affects the permitted actions, rather than merely a sentence in chat or docs.
  Feedback recorded, variant rejected and whole sketch discarded are distinct operations.
- **Fix options:** 1. add a persisted per-variant rejection decision, with reason, decision
  origin and time, exposed in Studio and the CLI (recommended). Keep the drawings in history
  but prevent pick/merge of rejected variants in the backend as well as the UI. Reopening
  requires an explicit designer decision and retains the earlier verdict. 2. a round-level
  rejection that applies explicitly to its variants, with the same enforcement and history.
  Decide whether both scopes are needed; do not infer rejection merely from a newer round.
- **Guardrails:** distinguish unfinished, superseded and rejected work; old alternatives are
  not automatically rejected. An agent must only record a designer's actual decision, with
  its origin clear. A new round's prose is not a verdict. Do not delete files or discard
  the entire sketch as a substitute for a missing operation.
- **Acceptance:** explicitly reject I/J, reload, and see them as rejected history without
  working pick/merge actions. Direct API/CLI attempts fail with the verdict and reason.
  Other variants and new rounds remain usable. Reopening is explicit and auditable. Agent
  completion reports must verify the persisted decision and distinguish unsupported actions
  from completed ones.
- **Status:** missing lifecycle capability confirmed; no rejection API/CLI/UI implemented.
  I/J currently have negative feedback recorded but are not technically rejected. The next
  design round continues separately; the agent must not claim this finding is already fixed.
- **Proposal (2026-10-30, `claude-sdk58`, for Tom - not built):**
  - **Data:** a new optional `rejected` map in the sketch file, next to `variantInfo`:
    `rejected: { [variant]: { reason: string; by: 'designer'; decidedAt: string; reopened?:
{ reason: string; decidedAt: string }[] } }`. It is separate from `decision`, because
    `decision` holds one pick or one discard for the whole sketch.
  - **Write paths:** `decideSketch` gets two more kinds: `reject` (variant, reason) and
    `reopen` (variant, reason). Studio sends them through `SKETCH_DECISION_PATH`. The CLI gets
    `et design sketch reject <part> --variant <v> --reason <text>` and `... reopen ...`.
  - **Who may write:** only Studio writes a `reject` or a `reopen`, from a designer click. The
    CLI commands exist for the designer at a terminal and print the stored state after the
    write. An agent never calls them from prose.
  - **Enforcement:** `decideSketch` refuses a `pick` of a rejected variant. The merge route and
    `sketch merge` refuse it too, with the reason. `sketch copy --from` a rejected variant is
    allowed, because a new variant from an old idea is a new idea.
  - **Studio:** a rejected variant stays in its round, dimmed, with "Rejected: <reason>" and a
    "Reopen" action. Pick and Merge are hidden for it. `design shot --variants` still draws it,
    with a "rejected" label.
  - **Scope:** per variant only. A round rejection is "reject every variant of the round" in
    the UI, not a second stored kind.
  - **Open points, with recommendations:**
    - Reason required? Recommended yes: one line, so the history says why.
    - May the agent record a rejection the designer said in chat? Recommended no: Studio or
      the terminal only, so the origin stays true.
    - Does a rejected variant count for "all variants decided" checks? Recommended yes, as
      decided.
- **Decided (Tom, 2026-10-30):** build it as proposed, with these changes. The reason is
  optional. An agent may reject a variant itself, for example when Tom says "X is out" in chat.
  Each rejection and each reason stores who wrote it (`by: 'designer' | 'agent'`), each on its
  own. A rejected variant counts as decided and drops out of the pick and merge choice, but
  stays visible.
- **Built (2026-10-30, `claude-sdk58`):** `rejections` in the sketch file (a list per variant,
  so a reject after a reopen keeps the history). `et design sketch reject|reopen <part> --variant
<v> [--reason <text>] --by <model id | designer>`. Pick, merge and the auto-merge refuse a
  rejected variant; Studio dims it with Reject, Reopen and "Note as reason". Specs only: not yet
  seen in a real browser, and I/J are not rejected yet. Stays open until Tom accepts it in Studio.

## 4. Render checks and shots

### 4.5 Stale results until a restart - fixed, one limit (L1415, L532, L1820)

- **Pain:** a cached wrong shot stays until a file changes. A flow edit, and a change to the port
  or `render.*`, need a server restart.
- **Fix done (`41bc90f74`):** a flow edit clears the shot and thumbnail caches. A change to
  `render.*` restarts the worker. Shots use the new port.
- **Limit:** the Vite server keeps listening on the old port until a restart.

### 4.6 Useful helpers live only in `/private/tmp` - fixed, one gap (L3055)

- **Pain:** the agent wrote scratch scripts for batch shots, zoom-state shots, a sketch audit,
  painted bounds and interactions. Each session writes them again.
- **Fix done (`1902a2675`):** `et design shot <part> --states [--variants]` writes one labelled
  contact sheet. The skill points to it.
- **Gap:** no zoom states for a page, because only the Studio canvas has a zoom. No CLI for
  comparison geometry.

### 4.7 Fitted `vh` parts have no true height - known limit (L2264)

- **Pain:** the frame settles about 32 px taller. Live and shot heights can differ.

### 4.43 Small changes disappear in a full-page sketch comparison - open

- **Pain (Tom, 2026-10-29):** in `pages/inbox`, round "Switch sizing", the 32 × 18 and 40 × 22 SDK switches were hard to distinguish across full 1440 × 900 page frames. Nearly all of each frame was unchanged. The agent inspected enlarged crops, but Studio did not give Tom an equally focused comparison.
- **Evidence:** Tom's screenshot shows Current, A and B as small full-page columns; the changed switch occupies only a few pixels in each column. Variant notes also crowd the round header.
- **Now:** manual canvas zoom or the agent's `design shot --crop`. Neither makes the initial comparison self-explanatory for the designer.
- **Fix options:** 1. derive a shared crop from the union of changed pixel bounds and show an enlarged Current/A/B comparison alongside the full-page context (recommended). Keep identical crop coordinates and scale for all variants. 2. a declared focus rectangle on a sketch, with a visible "Zoom to change" action. 3. zoom only the changed frame; this still makes side-by-side detail comparison difficult.
- **Acceptance:** for the Inbox switch round, Tom can distinguish both off and on appearances at the initial comparison view without hunting for the changed control. Full-page context remains available.
- **CLI done (2026-10-30, `claude-sdk58`):** `design shot <part> --states --variants --crop changed`
  draws every cell (merged, each variant, each state) with one shared rectangle: the union of the
  changed-pixel boxes against the merged cell, padded by 16 px. It prints
  `crop x,y,width,height (changed bounds)`. With no change it says so and keeps the full frame.
  The pure part is `changedCropOf` in `libs/cli/src/lib/design/contact-sheet.ts`, for the design
  server later. Also fixed: under `tsx`, the in-page diff threw `__name is not defined` as soon
  as two shots differed. Not verified on a real small change, because no open sketch has one.
- **Studio proposal (for Tom - not built):** the round header gets a "Changed area" toggle, on
  by default when the crop is less than half of the frame. With it on, each column shows the
  shared crop, enlarged to the column width, at the same scale for Current and every variant.
  A thin outline on a small full-page thumbnail above each column shows where the crop sits.
  Toggle off gives today's full-page columns. Variant notes move under their column, so the
  header holds only the round title and the toggle. Open point: the trigger threshold.
  Recommended: half of the frame area, because a larger crop gains little.
- **Decided (Tom, 2026-10-30):** build the Studio toggle as proposed. It is on by default when
  the crop is less than half of the frame area.
- **Studio built (2026-10-30, `claude-sdk58`):** "Changed area" button in each round header,
  crop from the new route `/__design/sketch-crop`. Specs only, not seen rendered. Pins, the
  changed-box outline and comment drafts follow the crop. Known gaps: below 25 % zoom the
  variant notes hide; the choice is not remembered across reloads; a click on the whole-page
  thumbnail drafts a comment at the top edge of the crop.
- **Gaps closed (2026-10-30, `ethlete-sdk-57`):** a variant note is an `everyZoom` canvas note: it
  stays at column-label size below 25 % zoom, and the layout keeps room for that. The switch of
  each round is stored in the sketch view state for the sketch's `createdAt`. A click on the
  whole-page thumbnail drafts at that page point, and a pin outside the crop sits on the
  thumbnail. Specs only, not seen rendered.

### 4.47 No enforceable design-completeness check for controls and their surfaces - open

- **Pain (Tom, 2026-10-30):** the agent treated largely static pages as nearly ready for
  implementation. Tom immediately found missing repo/project picker interactions, tree-icon
  tooltips, Inbox and Merge changed-list hover states, zoom-control interactions, the open
  preset select body (`desktop 1440x900`) and the unchanged-list accordion. A manual reminder
  or a passing render check does not prevent this from happening again (see process 6.5).
- **Required outcome:** the system must prevent an agent from declaring a design complete
  for implementation while required interactions or associated surfaces are uncovered.
  A warning the agent can ignore is insufficient. Completing one exploration round is not
  evidence that its host page or the product is complete.
- **Existing mechanisms:** `definePart` already supports part-level `interactions` and grids.
  `rules/interactions.ts` validates declared interaction names; `GRID-COVERAGE` checks declared
  grid rows. Neither establishes an inventory of every control and associated surface in a
  page. Native `title`, CSS `:hover`, a state name, or valid metadata alone is not evidence of
  a drawn, reviewed tooltip, hover state or select body.
- **Tom's proposed direction:** explicitly mark an element as interactive, allowing the CLI
  to require its interaction states. Extend the model to associated surfaces such as a
  select body, tooltip, picker menu or accordion body. Exact flag/API remains a proposal.
- **Recommended approach to investigate:**
  - Give controls stable identities and declare their required states. For pointer controls
    this includes hover; keyboard-operable controls need focus-visible. Include active,
    selected, disabled, expanded or other states where the control actually supports them.
    Apply requirements by control kind and input mode, rather than blindly demanding every
    combination from every control.
  - Declare a control's associated surfaces and connect each to a real drawn state: select
    trigger to open options, tree status icon to visible tooltip, unchanged header to its
    expanded body. Cover interactions inside those surfaces too, such as hovered/selected
    options. A declaration without a matching rendered target/state must fail validation.
  - Detect likely controls in rendered output (native controls, interactive roles and known
    SDK controls) and report those missing declarations. Otherwise an agent can bypass all
    requirements by omitting the flag. Non-semantic clickable drawings and overlays need an
    explicit audit path; DOM detection alone cannot guarantee complete discovery.
  - Reuse coverage from the real inherited component where applicable, while verifying the
    host's actual surface/theme/placement and product override. Do not copy every SDK control's
    entire matrix into every page or count a closed select as proof of its open surface.
  - Expose unresolved coverage as blocking failures in an explicit completeness check used
    for implementation handoff/CI. Keep "ready for the designer to compare this round"
    distinct from "design complete for implementation": partial explorations must remain
    reviewable. Specify the command/status and its enforcement points before building it.
  - Exceptions need explicit scope, reason and designer review, visible in the coverage
    report; an agent-authored `complete: true` or silent opt-out must not satisfy the gate.
- **Alternative:** infer the entire inventory and state requirements automatically from DOM,
  accessibility roles and SDK metadata. This reduces annotation but cannot reliably infer
  all intended overlays, custom clickable regions or task-specific states. Compare a hybrid
  declaration-plus-discovery approach before choosing the API.
- **Acceptance examples:**
  - An interactive repo picker with only a rest drawing blocks implementation completeness
    and identifies its missing hover/focus evidence.
  - A select with a drawn trigger but no open body blocks completeness. Drawing its open
    body while omitting option interactions still reports the missing coverage.
  - A tree icon with only `title` does not pass as a designed tooltip; the visible tooltip
    must be drawn in context. The Merge unchanged accordion needs collapsed and expanded
    coverage, including its header interactions and real body.
  - A passing render/type check or a `ready` sketch cannot independently claim product
    completeness. Missing declarations, stale state references and new unclassified controls
    produce actionable failures. Existing complete coverage can be reused without creating
    a Cartesian product of page states.
- **Proposal (for Tom - not built):** a hybrid of declaration and discovery, with its own gate.
  - **Declaration.** `definePart` gets a `controls` map. The drawing marks each control with
    `data-et-control="<id>"`, and each open surface with `data-et-surface="<id>.<surface>"`.
    The check joins rendered DOM to the declaration by these attributes. A control has a
    `kind`, its `input` modes and its `surfaces`. A surface names the state that draws it.
    ```ts
    controls: {
      unchanged: { kind: 'disclosure', input: ['pointer', 'keyboard'], surfaces: { body: 'unchanged-open' } },
    },
    ```
  - **Requirements per kind.** `pointer` requires `hover`; `keyboard` requires `focus-visible`.
    `button` adds `active`. `disclosure` requires its body surface. `select` and `menu` require
    the open surface, with option hover, focus and selected. `row` requires selected and
    selected-hover. `tooltip` requires the visible tooltip surface in its host. `disabled`
    applies only when the control declares it. For 6.8, a control may declare a `lifecycle`
    with valid states and transitions. The gate then removes unreachable combinations.
  - **Evidence.** A requirement passes only with a rendered frame. That frame must differ
    from rest inside the control's box, and the part's accepted hash must include it. A
    surface passes only when its state renders the surface element visible and non-empty.
    CSS `:hover` without a visible diff, a `title`, or a state name alone fails.
  - **Discovery.** After render, the check walks each state's DOM. Native controls
    (`button`, `a[href]`, `input`, `select`, `textarea`, `summary`, `[tabindex]`), interactive
    roles and known SDK `et-*` controls count as likely controls. Each one without a
    `data-et-control` fails as `CONTROL-UNDECLARED`, with part, state and DOM path. An
    element with `cursor: pointer` or a matched `:hover` rule but no role fails as
    `CONTROL-UNCLASSIFIED`. For the rest, the report shows a contact sheet of the
    declared controls per page. Tom approves that inventory once, like an exception.
    Controls inside `embedPage` belong to the embedded page and are not counted twice.
  - **Gate.** A new command `design complete <product> [<layer>/<name>]` exits 1 on any gap.
    It is separate from `sketch ready` (a round is ready for comparison) and `design check`
    (rule hygiene). It does not run in `sketch ready`, so partial rounds stay reviewable.
    `design complete --handoff` gives a part the status `handoff` only when it passes. CI
    re-runs it for every `handoff` part and fails when one regresses. The implementation
    skill allows app work only on `handoff` parts. `GRID-COVERAGE` stays a warning.
  - **Inherited coverage.** A control with `sdk: 'et-select'` reuses the SDK part's matrix
    for states inside the component, such as option hover. The host still draws the open
    surface once in its own placement and theme, and every host override. A closed select
    never counts as its open surface.
  - **Exceptions.** `design complete --request <part>.<control>.<requirement> --reason "..."`
    writes a pending entry, and a pending entry still fails. Only an approve button in
    Studio turns it into an approval, with `by`, `at` and the part hash. Studio signs the
    entry with a key from the OS keychain. A later edit of the part reopens it. The report
    lists every exception. An agent on Tom's machine can still forge one, so this makes
    forgery visible, not impossible.
  - **The eight gaps as failures.** Repo picker: `CONTROL-UNDECLARED` on the trigger, then
    missing hover, focus, active and the menu surface. Project picker: missing menu surface
    and selected versus hovered entry. Tree status icons: `title` only, so the `tooltip`
    surface fails. Inbox rows: `row` kind misses hover, focus, selected-hover. Merge changed
    list: the same `row` failures. Canvas zoom: `span`s fail as `CONTROL-UNCLASSIFIED` on
    System; the Sketches buttons fail as undeclared. Preset select: the open surface fails,
    then option states. Merge unchanged accordion: the `<button>` fails as undeclared, then
    `body` fails because `pages/merge` has only `open`.
  - **Open points, with recommendations:**
    1. Identity in markup only, or also in `definePart`? Recommend both: the attribute
       for identity, `definePart` for kind and surfaces, so the check types each id.
    2. Does "reviewed" need an accepted hash, or only a render? Recommend the accepted
       hash. A frame that Tom never saw is not a reviewed design.
    3. Is a signed approval enough? Recommend yes, with tamper evidence. A true barrier
       needs a second person or a server, which costs more than it gains now.
    4. Where does the gate block? Recommend the `handoff` status plus CI, not pre-push
       for all parts. Pre-push on every part would block every partial exploration.
    5. How far does non-semantic discovery go? Recommend `cursor` and `:hover` heuristics
       plus a per-page inventory approval. Pure DOM inference misses custom overlays.
    6. Is `lifecycle` (6.8) in the first slice? Recommend no. Add it when the editor is
       the first control with unreachable combinations.
  - **Rollout:** `controls` + `design complete` for `disclosure` on `pages/merge`, then
    discovery, the other kinds, exceptions, SDK reuse, and the `handoff` status with CI.
- **Decided (Tom, 2026-10-30):** the proposal as written, with the recommendation for open
  points 1, 2 and 4 to 6. Exceptions differ from point 3: no keychain signature. Only the
  approve button in Studio writes an approval, and git shows every change to it.
- **Status:** slice 1 built: `definePart({ controls })`, the `data-et-control` and
  `data-et-surface` markers, and `design complete <layer>/<name>` for `disclosure` (hover,
  focus-visible, collapsed, visible body; a forced frame must differ from rest in the control's
  box; the part must match its `merged.json` hash). Until discovery lands, a part without
  `controls` fails as `CONTROLS-MISSING`. `pages/merge` declares its unchanged line as a
  disclosure and passes (Tom merged variant a, 2026-10-30).
- **Feedback (Tom, 2026-10-30):** hover and focus states of an accordion do not belong in a
  page design. `pages/merge` now draws `unchanged-hover` and `unchanged-focus`, because slice 1
  asks every declared control for its interactions on the part that declares it.
- **Proposal (for Tom - not built):** interactions belong to the component. On a page, a
  control names the part that draws it, for example
  `unchanged: { part: 'components/disclosure', surfaces: { body: 'unchanged-open' } }`.
  Hover and focus-visible then come from that part, which must be design complete itself.
  The page only draws what depends on its placement: the open body. A page control without
  `part` fails. Then `components/disclosure` gets the unchanged line, and `pages/merge` loses
  its two interaction states.
- **Decided (Tom, 2026-10-30):** build the proposal. Built in `0788954d7` (`part` on a control,
  `CONTROL-PART-MISSING`, `CONTROL-PART-INCOMPLETE`). `components/disclosure` is merged and
  design complete (`826738337`).
- **Feedback (Tom, 2026-10-30):** the disclosure toggle lacks an `active` state. Pointer input
  should require `active` as well as `hover`.
- **Status:** `pointer` requires `hover` and `active` (`INPUT_INTERACTIONS` in
  `libs/cli/src/lib/design/system/complete.ts`). `components/disclosure` fails until step 2.
- **Status:** `components/disclosure` d merged (`31a6708e1`): full width, `active` tint, grid of
  `rest` and `open` by hover, active and focus-visible.
- **Status:** `pages/merge` merged (`7441190de`): the unchanged line is `components/disclosure`
  at `size: 'xs'`, control `toggle` with `part`. Both parts pass `design complete`.
- **Next:** discovery (`CONTROL-UNDECLARED`,
  `CONTROL-UNCLASSIFIED`), then the other kinds.

### 4.48 A focused sketch opens as an overwhelming matrix of unrelated screens - folding fixed, focus review open

- **Pain (Tom, 2026-10-30):** "dieser sketch umfasst so viele screens ich weiß gar nicht
  wonach ich schauen soll". The Inbox sketch asks only where to compose a new comment, but
  Studio displays the old list/filter states across Current, A, B and C above the relevant
  `comment-draft` row. The decision is buried under repeated full-page screens at unreadable
  fit scale. Explaining a state name in chat does not make this a usable review workflow.
- **Evidence:** Tom's screenshot `/tmp/codex-clipboard-UgNUoD.png` shows `with-resolved`,
  `active-only`, `active-clear` and `all-clear` repeated across four columns, then the new
  `comment-draft` row at the bottom. The author comparison reported no pixel changes in the
  15 pre-existing variant/state drawings. These states must survive merge, but they are not
  competing answers to the current question.
- **Existing mechanism and diagnostic limit:** Studio already supports folding unchanged
  state rows. The server supplies per-variant `unchanged` through `unchangedStatesOf` in
  `studio-api.ts`; it can compare markup/styles and, when available, pixels. The sketch's
  existing-state markup changed despite identical pictures. The screenshot proves that the
  initial review is unfocused; it does not establish whether the live server's comparison,
  a failed screenshot, an older running server or remembered expanded rows caused it.
  Inspect the live response and row-open state before claiming a root cause.
- **Fix options:** 1. a decision-focused initial view that shows the relevant new/changed
  states, with unchanged states folded behind a clear count and "Show all states" action
  (recommended). Make the round's question and its comparison scope visible in Studio;
  optionally declare focus states/regions, validated against actual variants. 2. initially
  select one relevant state and offer explicit navigation through other changed states.
  A manual state selector is a temporary workaround, not the systemic fix.
- **Constraints:** keep every existing state in the sketch and in validation. Separate the
  retained regression coverage from the designer's initial comparison. A focus declaration
  must not hide additional changed states or render failures: report them visibly and make
  them reachable. Keep a full-context view available; use consistent focus geometry across
  variants for detail comparison (related finding 4.43). Do not solve overload by dropping
  states or creating a separate sketch per placement.
- **Acceptance:** opening this round immediately presents the question "Where should I
  write a point-anchored comment?" and the A/B/C `comment-draft` comparison at a useful scale.
  The five retained list/filter states remain inspectable and checked but do not consume
  the initial comparison. New, changed, unchanged, failed and not-yet-compared states are
  distinguishable; an unknown comparison result must not silently count as unchanged.
- **Status:** unchanged-row detection is fixed and live-verified below. Composer placement
  remains undecided. Further focus-region metadata and useful initial detail scale remain
  proposals, related to 4.43; the live API check does not verify those design requirements.
- **Decision (Tom, 2026-10-30):** option 1. A sketch round opens with its question shown in
  Studio and only the states it changes open at a readable scale; unchanged states fold behind a
  count with "Show all states".
- **Live diagnosis (2026-10-30, during round 2):** a read-only request to Tom's
  `:4402/__design/sketches?product=studio` returned `targets[].unchanged: []` for A/B/C and
  the newly created D/E/F. The UI therefore receives no evidence to fold the old state rows;
  remembered expansion alone cannot explain this response. The author had previously
  verified identical pixels for the five retained states. The reason the live server does
  not recognize that equality remains unproven. No server restart or tooling change made.
- **Proven cause and fix (`b78bff197`, reported by `claude-sdk57`):** Inbox renders through
  `ng()`, which requires browser `location`/fetch. Rendering it for a Node markup comparison
  threw `location is not defined`; `markupOf` returned null, and equality failed before the
  pixel comparison. Existing states now reach the pixel comparison when markup differs or
  cannot be rendered in Node. New states, failed screenshots or absence of a screenshot
  provider remain changed. Studio adds a folded-state count and "Show all states" action.
- **Live verified after Tom's rebuild/restart (2026-10-30, `claude-sdk57`):** the same
  `:4402/__design/sketches?product=studio` now returns all five retained states in `unchanged`
  for each of the eight Inbox variants: open, with-resolved, active-only, active-clear and
  all-clear. This supplies the folding evidence that was missing before. No restart was
  performed by this design session.

### 4.51 A round that changes no pixel looks broken in Studio - open

- **Pain (Tom, 2026-10-30):** "was ist mit dem inbox sketch?" The Inbox round r2 showed only
  folded "unchanged in c" row heads, empty dashed cells under Current and c, and the folded
  r1. Nothing said what c changes or why the canvas is empty.
- **Cause:** c restores the accepted L look on purpose (6.8). It drops the extra
  `comment-draft-focus` state and adds one sentence to the page note: the editor is open only
  while focus is within it. Both are real changes, but no state differs in pixels, so every
  row folds. c also has no variant note, and Studio shows no change to the part note.
- **Now:** the agent compares `shared/inbox.ts` with `c/shared/inbox.ts` by hand and
  explains it in chat.
- **Fix options:** 1. when a round's variants change no pixel, the canvas shows one line in
  place of the empty grid, for example "c changes no pixel: part note changed, state
  `comment-draft-focus` dropped", with the note diff on a click (recommended). 2. a
  variant-note check: `sketch ready` refuses a variant without a note when its round has a
  new variant. 3. a note-only change opens the merge preview directly.
- **Acceptance:** for the Inbox r2, Tom sees at the first view that c changes only the
  part note and drops one state, and can read the new note text without the agent.
- **Decision (Tom, 2026-10-30):** option 1. Build it.

### 4.52 A pick in Studio shows only after a long delay - done

- **Pain (Tom, 2026-10-30):** in the ready `pages/inbox` sketch, Tom clicked "Pick c". All
  buttons were disabled for a moment, then enabled again, and nothing showed as picked.
  After a wait, c showed as picked. In between, the view looks as if the pick failed.
- **Evidence:** `sketch.json` holds `decision: { kind: 'pick', variant: 'c' }` with
  `decidedAt` 13:26:27Z, the same second as the file write. The pick reached the disk; the
  view did not follow it.
- **Suspects, not checked:** the sketch list that Studio reloads after the pick still
  returns no `decision`, or the view keeps its own pick state and drops it on the reload.
  c changes no pixel (4.51), so a view that derives "picked" from a diff may also fail.
- **Fix options:** 1. after the pick request, Studio reads the decision from the answer of
  that request and shows it at once, then confirms it from the next list read
  (recommended). 2. reload the sketch list and fail visibly when it has no decision.
- **Acceptance:** a click on "Pick c" shows c as picked at once and enables Merge, also for a variant
  that changes no pixel; a failed pick shows an error instead of a silent reset.
- **Decision (Tom, 2026-10-30):** option 1. Build it.
- **Done (2026-10-30, 5c44e2edb):** `decideSketch$` returned the answer's decision to nobody; the view
  waited for the list read. It now lays the answer over the listed sketch at once.

- **Migration (Tom, 2026-10-30):** once the 4.47 and 4.53 rules stand, every existing Studio
  design gets one pass: declare its interactive controls, draw the missing states and
  surfaces, and cut CSS to what utilities cannot express. One page per commit.

### 4.53 Studio designs use plain CSS where Tailwind utilities would do - open

- **Pain (Tom, 2026-10-30):** many Studio designs style with plain CSS, though the rule is
  Tailwind utilities in the markup and CSS only where utilities cannot express it.
- **Evidence:** about 1,800 lines of CSS outside sketches, for example `pages/inbox/shared/inbox.css`
  (258), `elements/shell-main/shell-main.css` (246), `pages/merge/merge.css` (161),
  `elements/canvas-frames/canvas-frames.css` (126). `foundations/colors/colors.css` (454) is
  token definitions and probably stays. The process rule from 2026-10-29 (see the fixed
  table, "new plain CSS files for a sketch") covers only new sketch code, and no check
  enforces it.
- **Fix options:** 1. a `design check` rule that flags a CSS declaration with a matching
  Studio utility, for example `display: flex` or a spacing or colour token, and lets the
  rest pass (recommended). Then move the existing parts, one page per commit, with no
  pixel change. 2. only a one-time manual move, without a rule; new CSS comes back.
- **Acceptance:** `design check` fails on a new utility-expressible declaration, and the
  existing pages draw the same pictures with their CSS cut to what utilities cannot do.
- **Decision (Tom, 2026-10-30):** option 1, the `design check` rule, then the one-page-per-commit
  move. `foundations/colors` stays CSS.
- **State (2026-10-30):** the `UTILITY-CSS` rule is in `libs/cli/src/lib/design/system/rules/utility-css.ts`,
  not yet in `RULES`. Token utilities come from the product's `@theme`, keywords from a fixed table. The checkout
  has 318 findings in 12 files, most in `elements/shell-main/shell-main.css` (55) and `pages/inbox/shared/inbox.css`
  (42). Known gaps: a parent-state selector over an SDK element is flagged; inline `style="..."` is not checked.
  Next: the one-page-per-commit move through sketches, then register the rule.

- **Progress (2026-10-30):** `elements/shell-main` moved; `ready` auto-merged it (no visible change). Kept in CSS:
  px sizes, 1px borders, inset shadows, the dot-grid image, calc offsets. State overrides now pick utilities in
  the TS (a utility beats the components layer). Class names with no rule left were removed from the markup.
  Next: `pages/inbox` after its open sketch merges, then the other pages.
- **Tool notes (2026-10-30):** (1) `sketch check` fails on a baseline finding of another part (inbox contrast),
  `ready` still merges. (2) `UTILITY-CSS` is not in `RULES`, so the move was checked by hand against the rule's
  tables. (3) Each move triggers `UNDEFINED-CLASS` for semantic class names with no rule left. (4) The rule does
  not flag px sizes on the 4px scale (40px = `w-10`); open whether intended.
- **Progress (2026-10-30):** `components/tree-row` moved; `ready` auto-merged it after one fix. `rounded-full`
  (9999px) antialiases a 1.5px ring on a 6px dot differently from `50%`, so `border-radius: 50%` stays in CSS.
  `text-ui-xs` also sets a line height; use the plain size where the old CSS set only `font-size`. Tool note
  (not proven): `rounded-[50%]` in a sketch file drew square dots, so an arbitrary-value class in a sketch may
  not reach the sketch stylesheet.
- **Progress (2026-10-30):** `elements/canvas-frames` moved; `ready` auto-merged it. Kept in CSS: ring shadows,
  off-scale text sizes, calc grid columns, `nth-child` padding, `.st-sgrid-cell` (`inbox.ts` rewrites its exact
  markup with a regex) and `.st-canvas-zoom*` (`pages/sketches` selects them). `pages/merge` moved the same way. Next:
  `components/disclosure`, `foundations/*` (except colors); `inbox`, `comment-pin`, `pages/sketches` after their
  open sketches merge.

### 4.54 A design cannot say that a change between states animates - in progress (builder, 2026-10-30)

- **Pain (Tom, 2026-10-30):** a design draws each state as a still frame. Nothing says that a
  change between two states moves. Examples in Studio: the active bar in the rail could move
  between items with a FLIP animation, and the Inbox sidebar opens and closes.
- **Idea:** next to the `controls` of 4.47, a part declares a transition between two states,
  for example `transitions: { 'rail.active': { from: 'pages', to: 'inbox', kind: 'flip' } }`,
  and the drawing marks the moving element. `design complete` then requires the declaration
  for a control kind that changes layout, for example a disclosure or a selection indicator.
- **Open:** whether a still pair of states is enough evidence, or whether Studio must play the
  transition; and which kinds need one.
- **Decision (Tom, 2026-10-30):** a still pair of states plus a `transitions` declaration is
  enough evidence for now; Studio plays the transition in a later slice. The declaration is
  optional: `design complete` requires it for no control kind until a concrete kind needs it.
- **Amended (Tom, 2026-10-30):** the motion model of `plans/ethlete-studio/motion.md`
  (2026-10-27) applies. The declaration is its `motions` field, not a new `transitions` field.
  This finding is that plan's slice 1 (`motions`, the morph, `ctx` and the check rules); shots
  and the Studio timeline follow as its later slices.

### 4.55 A comment on a new part in a sketch cannot be marked done - fixed

- **Pain (2026-10-30):** `inbox done 20261030T135029Z-35c6 --note "…"` on a comment on the
  sketch `components/disclosure` variant a answers "components/disclosure is no part of studio -
  the note has nowhere to go". The part exists only in the sketch, but the variant holds its note.
- **Fix option:** for a comment on a sketch variant, write the note into the variant even when
  the merged product does not have the part yet.
- **Decision (Tom, 2026-10-30):** this fix. No design question left.
- **Status:** fixed - `completeComment` checks the merged part only for a comment outside a sketch variant.

### 4.56 An interactive component draws its interactions as flat states, not as a grid - fixed

- **Status:** fixed - `design complete` fails a control that draws its own interactions with
  `CONTROL-GRID-MISSING` when its part has no grid column per required interaction, or a grid row
  without a state in one; the docs example uses `interactionRows`.

- **Pain (Tom, 2026-10-30):** "wieso nutzt du nicht den grid view wie wir ihn schon bei comment
  pin etc nutzen? das darf nicht vorkommen". `components/disclosure` drew `rest`, `hover`,
  `focus-visible` and `open` as a flat list, so `open` had no hover, active or focus-visible.
  The agent added `active` as a fifth flat state in sketch r1 instead of moving to the grid.
- **Cause:** nothing points to the grid. `interactionRows` exists (`comment-pin`, `tree-row`), but
  the `design complete` example in `apps/docs/cli/index.md` shows flat `hovered`, `pressed` and
  `focused` states. `design check` and `design complete` accept flat interaction states.
- **Now:** sketch r2 variants d and e use `interactionRows` with the rows `rest` and `open`.
- **Fix options:** 1. `design complete` fails a declared control when its part has no `grid`
  with a column per required interaction, and the docs example uses `interactionRows`
  (recommended). 2. a `design check` warning on a state named after an interaction. A warning
  can be ignored, so it does not meet "das darf nicht vorkommen".
- **Acceptance:** a disclosure with flat `hover` and `active` states fails `design complete`
  with a message that names `interactionRows`; the docs show only the grid.

### 4.57 A rest frame can draw a real hover - fixed

- **Status:** fixed - headless Chromium's pointer starts at 0,0 on a new page, so the first frame of a page hovered a control in its top-left corner; `openFrame` now moves the pointer to -1,-1 after each load, which covers `design shot`, thumbs, `render-check` and `design complete`.
- **Pain (2026-10-30):** in `design shot`, `components/disclosure` e `rest` and `open` show
  the hover tint, though no state forces hover. The toggle fills the frame from its top-left
  corner, so the real `:hover` matches where the headless pointer stands.
- **Risk:** `design complete` compares a forced frame with the rest frame. A rest frame that
  draws real hover can hide a hover requirement or fail it wrongly.
- **Fix option:** before each shot, move the pointer out of the frame, or turn off real
  `:hover` in drawn frames, so only `data-et-force` draws an interaction. Add a spec with a
  full-width control that bites.

### 4.58 Controls change state without a transition - done

- **Pain (Tom, 2026-10-30):** "einfache transitions fehlen. zb beim disclosure". The hover and
  active fill of `components/disclosure` and `components/tree-row` switch in one frame.
- **Cause:** Studio has no motion tokens. The only transition in a merged part is the disclosure
  chevron (`transition: rotate 120ms`). `design complete` checks forced frames as stills, and its
  frames turn off all motion (`NO_MOTION`), so nothing asks for a transition.
- **Not 4.54:** 4.54 is about a layout change between two states (FLIP, a sidebar that opens).
  This finding is about the fade of an interaction state on the same control.
- **Fix options:** 1. a `foundations/motion` part with duration and easing tokens (a plain fade,
  no scale or slide), and `design complete` fails a control whose interaction states change its
  colour while its computed `transition-duration` is 0 (recommended). 2. only the tokens and a
  rule in the design-exploration skill. A rule can be skipped, as in 4.56.
- **Open for Tom:** the duration (proposal: `120ms ease` on background, color, border-color and
  box-shadow, as `libs/components/src/lib/button/button.component.css`) and whether the disclosure
  body fades in when it opens (proposal: no, a body fade is a 4.54 transition).
- **Decision (Tom, 2026-10-30):**
  - Option 1: a `foundations/motion` part with duration and easing tokens, and the
    `design complete` check on a colour change with a computed `transition-duration` of 0.
  - Colour changes use `120ms ease` on background, color, border-color and box-shadow. They stay
    in reduced motion (`motion.md` allows `color` as an exception).
  - The disclosure body fades in by opacity in 120 ms when it opens. Its height still jumps; no
    height or slide animation.
  - Prepare for the motion model: every simple transition uses only the `foundations/motion`
    tokens, never a literal duration or easing, and an appearing element (the disclosure body)
    uses `@starting-style`, as `motion.md` prescribes. The later motion system then recognizes
    these transitions and its timeline names them by token.
- **Done (2026-10-30):** `foundations/motion` (`--duration-state`, `--duration-appear`,
  `--ease-standard`, `--transition-state`), loaded in `apps/ethlete-studio/src/styles.css`.
  `design complete` fails `CONTROL-TRANSITION-MISSING` (`87033303b`); `design check` fails
  `HARD-CODED-MOTION` (`bb9754494`). Shots now show the end of finite transitions (`3737b12a3`),
  so a `@starting-style` body is drawn fully visible. The disclosure and tree-row fade with the tokens.

### 4.59 Icons are inline SVG in each part, not a catalogue - done

- **Pain (Tom, 2026-10-30):** "ist das chevron nicht eig ein icon was wir als asset extrahieren
  sollten in eine art icon catalouge?"
- **Evidence:** 7 merged parts hold an inline `<svg>` (`components/disclosure`,
  `components/tree-row`, `elements/shell-main`, `pages/inbox`, `pages/merge`, `pages/flows`,
  `foundations/colors`). The check mark path `m3.5 8.5 3 3 6-7` is copied 4 times, the warning
  triangle 2 times. The viewBox is 16, 24 or 32 and the stroke width 1.5, 1.75 or 2.
- **Existing mechanism:** `svgAsset` and a product `assets/` folder. `foundations/logo` and
  `foundations/agent-logos` already draw their SVGs this way and export a helper.
- **Fix options:** 1. a `foundations/icons` part: one `.svg` per icon in `assets/icons/`, its
  drawing is the catalogue (each icon with its name, at each size), and it exports
  `icon(name, { size })`. `design check` fails an inline `<svg>` outside `foundations/`
  (recommended). 2. the part only, without the check. An agent then draws inline again.
- **Open for Tom:** one stroke width and one grid for all icons (proposal: 16 px viewBox,
  1.5 stroke), and whether the Studio app later takes the same files through the SDK icon system.
- **Decision (Tom, 2026-10-30):** option 1 with the `design check` rule. All icons use a 16 px
  viewBox and a 1.5 stroke. The Studio app later takes the same files through the SDK icon
  system, in a later slice.
- **State (2026-10-30):** Tom merged `foundations/icons` (`merged.json` hash `9f686e3ce096e6b8`); the parts draw from it since `d8e224f30`. The sketch had 15 icons, `icon(name, { size, cls })`, a `construction` state with the grid).
  The `INLINE-SVG` rule is in `libs/cli/src/lib/design/system/rules/inline-svg.ts`, in `RULES` of
  `check-system.ts`: active since `928eebbc9`. An `<svg>` with `data-et-drawing`
  passes, so the `pages/flows` sketch adds it to its edges. Next: after the merge, one sketch per part, then
  register the rule with a minor changeset and `apps/docs/cli/index.md`. The `elements/shell-main` mark is a logo
  and moves to `foundations/logo`.
- **Decision (Tom, 2026-10-30), replaces the `viewBox` exemption:** a missing `viewBox` does not
  exempt an `<svg>`, because an icon without one would slip past. A computed drawing, such as the
  `pages/flows` edges, carries an explicit marker attribute (for example `data-et-drawing`);
  every other inline `<svg>` outside `foundations/` fails `INLINE-SVG`. The rail mark of
  `elements/shell-main` moving to `foundations/logo` is confirmed.
- **Done (2026-10-30):** every part outside `foundations/` draws `icon()`, the rail logo is
  `studioMarkLine` from `foundations/logo`, and `INLINE-SVG` is in `RULES` (commit 928eebbc9).
  `foundations/colors` still draws its status marks inline; foundations are exempt.

### 4.60 The changed area is one box around all changes - done

- **Pain (Tom, 2026-10-30):** in the `components/tree-row` icon sketch, the changed area of the `tree` state
  covers almost the whole row column, though only four small icons change.
- **Cause:** `changedBoxOf` in `libs/cli/src/lib/design/contact-sheet.ts` returns one box around every
  changed pixel of a state. Changes far apart, as the warning at the top and the check at the bottom, give
  one tall box that is mostly unchanged.
- **Fix options:** 1. one box per cluster of changed pixels: boxes closer than a margin merge, and Studio
  shows each box as its own crop, before and after side by side (recommended). 2. keep one box, but outline
  each cluster inside it. 3. no change.
- **Decision (Tom, 2026-10-30):** option 1. Build it.
- **Done (2026-10-30):** one box per cluster (16 px gap, max 8), one crop per box in Studio and `--crop changed`.

### 4.61 The merge editor renders slowly - done

- **Pain (Tom, 2026-10-30):** "das rendering im merge editor etc ist mittlerweile ziemlich langsam
  geworden." It got slower over time, also in other views.
- **Evidence:** not measured yet. One hint from 4.52: the sketch list read (`/__design/sketches`)
  renders the targets and took 7 s on its first call.
- **Next:** measure before a fix. Time each shot request of the merge view (server log or the
  network panel of a headless run on an own server): render queue wait, page render, pixel diff,
  changed box. Compare with a small part to see if the time grows with the part count or the state count.
- **Measured (2026-10-30):** own server on a scratch copy, 3 open sketches (`components/tree-row` 20 states,
  `components/comment-pin` 40, `foundations/logo` 2; variant `a` a copy, `b` a CSS change). Cold / warm:

  | Request                                              | Cold          | Warm     | Dominant                                  |
  | ---------------------------------------------------- | ------------- | -------- | ----------------------------------------- |
  | `sketches` (list)                                    | 17.5 s        | 0.23 s   | 124 draws: every state of each `b`, twice |
  | `sketch-diff` tree-row `a` / `b`                     | 5.6 s / 3.1 s | 1-300 ms | 40 / 20 draws; 20 boxes cost ~0.3 s       |
  | `sketch-crop`                                        | 2 ms          | 2 ms     | reuses the diff pictures                  |
  | `sketch-compare` tree-row / logo                     | 3.8 s / 4.7 s | 2 ms     | 20 / 33 draws of 5 / 7 affected parts     |
  | 4 merge requests at once, comment-pin                | 9.2 s wall    | -        | queue busy all the time                   |
  | `sketches` after a one-line CSS edit in tree-row `b` | 17.0 s        | -        | all 124 drawn again                       |

- **Per draw:** ~140 ms (part) to ~190 ms (page), one at a time; the pixel diff and box are cheap. Time is linear in
  draws: 2 x target states (diff), 2 x states of each affected part (compare), 2 x states x frames per variant (list).
- **Cause:** any edit of a file under `.ethlete/design/studio/` drops every cached picture of the product: 154
  parts (22 product, 66 per variant name over all sketches). `studio/styles.css` has `@source './'`, so Tailwind
  makes each part file a dependency of it; `dependentIdsOf` (`serve.ts:485`) finds it and `styled` in
  `changed-parts.ts:87-93` redraws `everyPartOf` the product. Each Studio revision then pays the full cold cost
  again, on the one-page-at-a-time `createDrawQueue` (`thumb.ts:76-115`). It grows with parts x states x sketches.
- **Fix (recommended):** a change that reaches the product styles only as a Tailwind source redraws only the parts
  of its own file (and their importers), not `everyPartOf`. A new utility only styles the elements that use it.
  Gain: a sketch edit redraws one variant (tree-row `b`: ~20 draws, ~3 s) instead of 124-154 (~17 s + merge view).
- **Alternative:** let the draw queue run 4 pages at once. Measured with a patched dist: list 17.5 s -> 5.7 s
  (same answer), compare 3.8 s -> 1.7 s, diff `a` 5.6 s -> 0.9 s. About 3x on every cold path, no cache change.
- **Decision (Tom, 2026-10-30):** build both, as two slices. First the targeted redraw, then the draw queue with
  4 pages at once. Each slice gets a spec that fails without the fix, a changeset for `@ethlete/cli` and a docs
  line.
- **As built (slice 1, `2cd0ec45a`):** a PostCSS plugin records the files each stylesheet `@import`s; `dependentIdsOf`
  no longer climbs from a file to a stylesheet that only scans it as a Tailwind source. Spec in `changed-parts.spec.ts`
  bites (6 parts instead of 2 without the fix). Measured on a scratch copy: a part `.ts`/`.css` edit redraws 1 part
  instead of 22; an untouched part's next shot stays cached (0.7 ms vs 0.22 s); `styles.css` and the `@import`ed
  `colors.css` still redraw all 22. Not measured: the sketch list (no open sketch in the copy).

- **As built (slice 2, 2026-10-30):** `createDrawQueue` (`libs/cli/src/lib/design/thumb.ts`) runs up to
  `DRAWS_AT_ONCE = 4` drawings; high lane first; `--disable-partial-raster` kept. Probe on `pages/merge` 1440x900:
  2.7-2.8x faster. **Open:** 1 of 60 (`open`, `toggle`) and 1 of 120 parallel pictures differed from the rest
  (the 4.66 fix had 0 of 90). A `ready` compare can again see a false change. Find the cause before relying on it;
  fallback: draw compare pictures one at a time. Not verified: a real `ready` or the Studio merge view under load.
- **Probe of the open point (2026-10-30):** not reproduced. About 3,500 drawings of `pages/merge` `open` and
  `toggle` at 4 at once gave one hash per state, also with 32 CPU burners, 6 probes at once, a cold server and a
  mixed queue of 480 drawings. The embedded frames of `pages/merge open` have no font face, running animation or
  unloaded image at screenshot time, so a per-frame wait would fix nothing. Likely cause (timeline only): the old
  probe ran while `16cfed851` and `86d9f66e9` wrote into `.ethlete/design/studio/`, so a drawing caught a
  stylesheet rebuild. A replay of both writes on a scratch copy gave no odd picture either. Found on the way:
  `openFrame` (`thumb.ts`) gives up silently after `DRAW_TIMEOUT_MS`, so a frame that never draws becomes a blank
  picture with no error. Recommended next: a frame that never draws fails the drawing, and `ready` redraws each
  changed state one at a time before it accepts the change. Keep 4 at once.
- **As built (guard, `ee14a8bee`):** `openFrame` throws a `ShotTimeoutError` with the URL when the frame content
  or an embedded frame never draws (a Vite error overlay still passes). `drawnPair` (`merge-compare.ts`) draws a
  differing pair once more with `fresh` (no picture cache), and only the second pair counts; `compareMerge` and the
  target-state check use it. Five specs; each fails on the old source (run, not read). Not verified: a real
  `ready` that meets an odd picture.

### 4.63 Auto-merge ignores the parts that use the changed part - done

- **Pain (2026-10-30):** the `foundations/colors` sketch that removed the copied generator output auto-merged
  as "no visible change", but it removed `.et-color--accent`, which the inherited sdk part `components/select`
  (state `open`, `panelColor: 'accent'`) needs. `design check --product studio` fails since then.
- **Cause:** `sketch ready` compares only the target part's own states with the merged part.
- **Decision (Tom, 2026-10-30):** fix the tool. The auto-merge also draws the affected parts that
  `sketch preview` lists and stops at `ready` if any of them changes visibly.
- **Not part of this fix:** the select part itself. Tom: the sdk part is not usable as it is; it waits for the
  open plan to adopt the needed SDK components cleanly. Until then the `UNKNOWN-THEME` finding on
  `components/select` stays.
- **As built (`693cd80cc`):** `sketchShowsNoChange` in `libs/cli/src/lib/design/system/sketch/no-visible-change.ts`
  runs `compareMerge` after the target's own states show no change. It draws every state of each `affected` part
  from the merge preview, with and without the variant. A change, or a part that fails to draw, stops at `ready`
  and prints e.g. `auto-merge skipped: variant a changes pages/home default`. Spec bites (fails with the old
  `return null`). Verified: unit specs, spec typecheck, `nx build cli`, lint. Not verified: a live run against a
  render server. Affected parts draw only at the first width, as `compareMerge` does.

### 4.65 A token value change in a sketch auto-merges as "no visible change" - done

- **Pain (2026-10-30):** the colour step B sketch `foundations/colors` had two variants: a (each `*-active`
  0.05 L darker, `--text-subtle` oklch(0.62 0 0)) and b (0.09 L darker, oklch(0.58 0 0)). `sketch ready`
  printed "No visible change in any state: merged foundations/colors automatically" and merged variant a.
  The part draws `.co-fill--active` with `var(--accent-active)` and `.co-subtle-text` with `var(--text-subtle)`,
  so the change must show. The builder undid the uncommitted merge.
- **Two defects:** (1) a token value edit in a variant's `.css` does not reach the compared drawings (suspect:
  the drawing loads the merged product CSS); (2) auto-merge picks one of two variants, which is the designer's
  choice.
- **Decision (Tom, 2026-10-30):** `ready` auto-merges only when every live variant draws the same as the
  merged part in every state; otherwise it stops at ready. Order: finish 4.61 slice 1, then fix both defects,
  then redo step B. Before the redo, change both variants so every text on every surface reaches at least
  4.5:1 (today a fails on raised and overlay, b on raised, overlay and `on-danger` on `danger-active`); Tom
  then picks.
- **Step B values and WCAG 2 contrast** (redo the sketch after the fix): subtle on surface / raised / overlay:
  a 5.25 / 4.46 / 3.88, b 4.46 / 3.79 / 3.30; `on-*` on `*-active` accent / warning / danger: a 5.75 / 7.42 /
  4.95, b 4.95 / 6.40 / 4.20.
- **As built (2026-10-30, 2b3919780):** cause: a frame loaded the product stylesheet as merged, so its `@import`
  of `foundations/colors/colors.css` drew the merged tokens for every variant, and the markup shortcut called
  equal markup unchanged. Now a variant frame loads the product stylesheet with the variant's file in place of the
  merged one, and the shortcut is off when a variant changes a stylesheet the product imports. Defect 2 was defect
  1: `ready` already needs every variant equal. Verified: specs that bite, a scratch `sketch ready` stops with
  "variant a changes accent". Not verified: Studio frames by eye; rejected variants still block an auto-merge.

### 4.66 `sketch ready` gives a different answer on a re-run - done

- **Pain (2026-10-30):** in the colour cleanup (`2a4b435da`), `sketch ready` on a CSS-only sketch sometimes
  printed "auto-merge skipped: ... changes pages/merge ...", and a plain re-run then auto-merged. The same
  input must give the same answer.
- **Suspect:** a draw of an affected part (4.63 compare) is not deterministic, for example a font, an image or an
  animation that is not settled when the picture is taken.
- **Next:** draw `pages/merge` several times on an own server and compare the pictures; find the unstable state.
- **As built (2026-10-30):** cause: Chromium partial raster. Under load, the anti-aliased rounded corners of the
  `.mg-shot` clips over the embedded `pages/system` frames drew 2-6 levels apart (about 20 pixels, both states of
  `pages/merge`; 16 of 60 parallel draws). The draw browser now starts with `--disable-partial-raster`: 0 of 90.
  Fonts, animations and images were settled every time. Verified: a probe script and a spec on the launch flag.
  Not verified: a real `sketch ready` under load. Saved pictures from before differ at those corners.

### 4.67 The design render does not load the generated SDK theme classes - premise wrong

- **Pain (2026-10-30):** `pages/sketches/sketch-data.css` keeps its own `:root, .et-color--default` block to map
  the SDK default blue to the Studio accent. A sketch that removed it changed `page-sketch` and `zoomed-page`.
- **Cause:** the design render does not load `apps/ethlete-studio/src/styles/themes.css`, which
  `yarn studio:themes` generates from `foundations/colors`. A part with SDK components draws other colours than
  the app.
- **Fix option:** the product render loads the generated theme classes; then the override goes away (see Q4).
- **Decision (Tom, 2026-10-30):** discard the `pages/sketches` sketch that removes the override; the block stays
  until this fix lands. Also for the colour cleanup: a separate sketch drops the `surface-sunken` cell from
  `foundations/agent-logos` (`surfaces` list); the builder may merge it and then the `foundations/colors`
  sketch that removes the alias itself.

- **Finding (2026-10-30):** the render already loads the theme classes: `.ethlete/design/config.json` gives `studio`
  `styles: [".ethlete/design/studio/styles.css"]`, which imports `apps/ethlete-studio/src/styles.css` and so
  `styles/themes.css`. The `sketch-data.css` override is redundant: without it `page-sketch` and `zoomed-page`
  differ by at most 2/255 per channel (oklch `--accent` vs the generated rgb), which is why the removal sketch
  showed a change. UNKNOWN-THEME has another cause: the inherited SDK part `components/select` passes
  `panelColor: 'accent'`, a theme only the SDK product defines; Studio registers `brand`.
- **Open for Tom:** remove the override through a sketch (the strict check shows the rounding change); fix
  `select` with a Studio `components/select` that uses `brand` or no `panelColor`, or drop the theme name from
  the SDK base part.
- **Decision (Tom, 2026-10-30):** a sketch removes the `sketch-data.css` override; Tom accepts the rounding
  change. Drop `panelColor` from the SDK base part `.ethlete/design/sdk/components/select` now, so the panel
  uses the default theme in every product; the rest of that part still waits for the SDK components plan.
  Merges: Tom wrote "merges gehen klar wenns visuell kleinvieh ist" - allowed when the visible change is minor.

### 4.72 A `foundations/colors` variant does not reach the SDK components in its frame - done

- **Pain (2026-10-30, found in 4.67):** `themes.css` is generated from the merged `foundations/colors`. A colours
  sketch variant changes `--accent` and the other part tokens, but SDK components in that frame keep the merged
  theme colours until `yarn studio:themes` runs. Not tested with a real colours sketch.
- **Fix option:** the render generates the theme classes from the variant's `foundations/colors` for a variant frame.
- **As built (2026-10-30):** product config field `generated: [{ part, command, stylesheets }]`. When a variant
  changes `part`, the render runs `command --part <variant css> --out <dir>` (cached by content) and the variant
  frame loads the listed stylesheets from `<dir>`. `studio` lists `foundations/colors` with
  `tools/scripts/generate-studio-themes.mjs` (new `--part`, `--out`). Verified: a fixture spec; an end-to-end run
  on the real product (variant accent changed `.et-color--brand`; merged compile byte-identical). Not verified:
  Studio by eye, a real colours sketch. Old run folders in `node_modules/.design-explore/generated` stay.

### 4.68 One change across many parts needs one sketch per part - open

- **Pain (2026-10-30):** the removal of the alias `--surface-sunken` touched 10 parts. It took 10 sketches, each
  with its own `new`, `report`, `ready` and commit. A `shared/` edit through `foundations/spacing` also
  changed `foundations/colors`, `foundations/motion` and `foundations/type` without a sign in the command.
- **Fix option:** a sketch with several targets, or `sketch new --each <part,part>` that runs the same
  edit and one `ready` over all of them. `ready` names every part a `shared/` edit reaches.

### 4.69 A CLI rebuild breaks sketch commands that run at the same time - done

- **Pain (2026-10-30):** two agents ran at once: one rebuilt `dist/libs/cli`, one ran `sketch ready`. The
  builder had to copy the build to `dist/cli-css-snapshot` for the sketch agent.
- **Fix option:** `nx build cli` writes to a temp folder and swaps it in at the end, so a running command
  never sees a half-built `dist`.
- **As built (2026-10-29, b2142f3c1):** `compile` writes to `tmp/cli-build`; `move-into-place.mts` renames file by file into `dist/libs/cli` and never empties it. Found on 2026-10-30; the snapshot copy is no longer needed. Not verified: a rebuild while a `design sketch` command runs.

### 4.70 A rejected variant still blocks the auto-merge - done

- **Pain (2026-10-30):** `sketchShowsNoChange` counts every variant, also a rejected one. Tom's rule (4.65
  "Decision") names only live variants. A rejected variant with a change stops a merge that is safe.
- **Fix option:** skip rejected variants in the "every variant draws the same" check.
- **As built (2026-10-30):** `sketchShowsNoChange` checks only live variants; with none it answers "the sketch has no live variant". The auto-merge already picks the first live variant. Verified: a spec that fails without the filter; design specs and spec typecheck pass. Not verified: a real `sketch ready` with a rejected variant.

### 4.71 A merge Tom allows in the plan has no CLI path - done

- **Pain (2026-10-30):** Tom allowed the builder to merge the `foundations/agent-logos` and `foundations/colors`
  sketches itself. The CLI merges only after a pick in Studio ("has no pick - the user picks a variant in
  Studio"), and agents have no pick command.
- **Decision (Tom, 2026-10-30):** add `sketch merge --variant <key> --allowed-by <plan ref>`, only for a sketch
  with exactly one live variant; the merge note names the plan reference. A sketch with more than one live
  variant still needs Tom's pick.
- **Condition (Tom):** if a sketch works around an issue of the theming system that belongs in the system (SDK
  theming, the generator, the render), do not merge it this way. Fix the system instead, and tell Tom.
- **As built (2026-10-30):** `sketch merge <part> --variant <key> --allowed-by <plan ref> --by <model>`; refuses
  unless `<key>` is the only live variant; both flags go together; a sketch Tom picked merges as before.
  `accepted.json` logs "merged without a pick: allowed by <ref>"; the part note stays. Verified: 4 specs.

### 4.64 Shared helper code had to be a part - done

- **Pain (Tom, 2026-10-30):** `foundations/sheet` is no design. It only exports the token-sheet layout that
  colors, type, spacing and motion import, and its canvas state duplicates `foundations/spacing`.
- **Cause:** `@shared/<path>` resolved only inside sketches, so a merged product had no place for helper code.
- **Decision (Tom, 2026-10-30):** build the missing capability.
- **Done (2026-10-30):** a product `shared/` folder, imported as `@shared/<path>` by any part (sketch lookup:
  variant, sketch, product). Part hashes cover the shared files they reach. A sketch file with a product
  shared path replaces it at merge. The sheet is `shared/token-sheet.ts`; `foundations/sheet` is removed.

## 5. Drawing parts and pages

### 5.21 A sketch cannot draw another part at a sketch variant - parked

- **Pain:** the merge page needs `components/button` "after merging b". The agent faked the after
  frames with a CSS override of the radius.
- **Fix option:** an alias such as `@sketch/components/button:b`. Low priority: only drawings of
  Studio itself need it.
- **Decision (Tom, 2026-10-30):** parked. Do not build it until a second case needs it.

### 5.23 The SDK hover token draws light on Studio's dark frames - open

- **Pain:** in `components/tree-row`, `--et-surface-interaction-hover-solid` came out light grey,
  and the hovered label became unreadable. The agent used `--surface-raised` instead.
- **Fix options:** 1. a part frame gets the product's dark surface context, so SDK surface tokens
  resolve as in the app (recommended, check first why it does not). 2. `design check` warns on an
  SDK surface token in a product without that context.
- **Decision (Tom, 2026-10-30):** neither now. Treat it as a likely design issue in the SDK, not a
  Studio defect. Once Studio is ready, it is the tool that finds such SDK issues, this case
  included. No Studio workaround and no `design check` warning.

### 5.24 A component sketch does not see what its hosts draw - open

- **Pain:** `components/tree-row` was merged without the part-with-frames row and the warning
  triangle that `elements/part-tree` draws. The adoption sketch on part-tree then mapped the
  warning to "in progress" and lost the bright part row (467 px diff). It was discarded; tree-row
  gets round r2.
- **Fix options:** 1. `sketch new` on a component lists the parts whose markup it will replace, and
  the brief says to draw every case they draw (recommended, a skill rule). 2. a CLI check that
  compares the classes a host uses with the component's states.
- **Rule (Tom, 2026-10-29):** a part becomes a component only when two hosts draw the same case.
  Option 1 is in the `design-exploration` skill under "The order of a design".

### 5.31 Studio has no pressed surface token - open

- **Pain:** `tree-row`'s `:active` fill is a `color-mix` of `--surface-raised` and
  `--surface-sunken`, written in the component.
- **Fix option:** a `foundations/tokens` sketch that adds a pressed surface, once a second control
  needs a pressed state.
- **Decision (Tom, 2026-10-30):** the condition is met: `design complete` now requires an active
  state for pointer input (`e52f43d59`), and `components/disclosure` needs one. Add a
  `--surface-pressed` foundation token with the `tree-row` value
  (`color-mix(in oklch, var(--surface-raised), var(--surface-sunken) 30%)`); `tree-row` and the
  disclosure use it. It lands with the disclosure merge.
- **Reopened (2026-10-30), do not build yet:** the disclosure is already merged (`31a6708e1`,
  `7441190de`) with `color-mix(in oklch, var(--text) 10%, transparent)`. The `tree-row` value was
  nearly invisible on the toggle, which has no background at rest. Tom chooses between one
  text-tint token for any surface and two tokens.
- **Decision (Tom, 2026-10-30), replaces the first one:** one token `--surface-pressed` as a text
  tint that works on any surface, with the disclosure value
  `color-mix(in oklch, var(--text) 10%, transparent)`. `tree-row` and the disclosure use it. The
  `tree-row` press may change slightly; show Tom the before and after, and keep it visible.
- **`comment-pin` (Tom, 2026-10-30):** the pin moves to the token too. `comment-pin.css:71` and
  `:108` still mix `--surface-raised` with `--surface-sunken`; the token is a translucent text
  tint, so the move changes pixels. The pin layers the token over its face:
  `linear-gradient(var(--surface-pressed), var(--surface-pressed)), var(--surface-raised)`. A
  sketch shows before and after, with no auto-merge; Tom picks in Studio.

### 5.32 A page cannot reuse the canvas frame chrome - open

- **Pain:** `pages/system` "Many states": `elements/canvas-frames` exports only the fixed button
  frames, so the agent copied the frame head, frame box and zoom chip CSS into the sketch's
  `shared/`.
- **Fix option:** a sketch on `elements/canvas-frames` that exports frame head, frame box and zoom
  chip as named parts.

Also seen again in "Many states": 3.27 (`sketch.json` not Prettier-clean) and 4.30 (shot path).

### 5.39 A combo of two forced states was never drawn, and its bug slipped through - open

- **Pain:** the "Pressed state" sketch claimed a pressed selected row keeps its tint. There was no
  `selected-active` state, so nobody saw that `.st-trow:active` replaced the accent with grey.
  Tom found the gap in the grid of "Many states" ("selected active fehlt noch").
- **Fix options:** 1. the grid shows an empty cell where a row has states in other columns, and
  `sketch check` lists empty cells (recommended; the grid made the gap visible). 2. `sketch check`
  draws every row x column combination of a grid in a scratch pass and flags cells that look like
  another row.

### 5.51 No contrast numbers next to colour tokens - open

- **Pain:** the warning sketch agent wrote its own oklch-to-sRGB and WCAG script, because the raw
  `.et-color--*` vars take rgb triplets and the Studio aliases are oklch.
- **Fix options:** 1. the tokens drawing prints the contrast ratio of each colour token against
  each surface (recommended; it reads computed styles already). 2. a `design contrast <fg> <bg>`
  command.

### 5.52 One colour theme spans three hand-kept blocks - open

- **Pain:** a theme lives in the `:root` aliases, the `.et-color--x` raw block and the Studio
  aliases in `tokens.css`, plus the group regex of the tokens drawing.
- **Fix options:** 1. `design tokens theme add <name> --type <type> --oklch ...` writes all blocks
  (recommended). 2. the skill names the places.

### 5.55 `embedPage` cannot mark or restyle inside the embedded page - open

- **Pain:** `pages/merge` variant a (round "No page import") embeds `pages/system`. The merge CSS
  cannot reach into the iframe, so the button loses its accent ring, and the "After merging" side
  cannot show the new look. Only the 200 % crop still shows the change.
- **Fix option:** an `embedPage` option, for example `{ mark: '.et-button', css: '...' }`, that the
  embedded frame applies inside itself.

### 5.56 `embedPage({ scale })` and a host's own scale wrapper overlap - open

- **Pain:** `pages/merge` already scales the row by `--mg-scale`; a `scale` on `embedPage` too
  shrinks the page twice. Nothing warns.
- **Fix option:** the skill says to use one or the other; a check warns when both are set.

### 5.60 Merging one candidate keeps all discarded candidate code in shared helpers - open

- **Evidence (L merge, `4a960f125`):** the accepted Inbox wrapper calls `inbox(true, 'l')`,
  but merged `shared/inbox.ts` still accepts placements A-L, branches over the old editor
  compositions, imports `svgAsset` for I/J and keeps their optional icon argument. Its CSS
  also retains placement rules for the earlier candidates. Only L is used by the merged
  part. The merger correctly copied shared files, but the shared layout mixed common code
  with mutually exclusive exploration code.
- **Pain:** the authoritative selected design carries rejected/unfinished alternatives,
  unused CSS and obsolete parameters. A successful user merge does not produce a focused,
  maintainable implementation of the chosen result.
- **Fix options:** 1. keep candidate-specific rendering in variant files/helpers and share
  only genuinely common data/markup; require a selected-result cleanup check before merge
  (recommended). 2. tooling reports unused variant-only imports/styles/parameters left in
  the selected dependency closure. Generic automatic pruning needs a defined contract;
  do not delete branches just because their names resemble variant letters.
- **Now:** the next Inbox focus sketch simplifies the helper to L and its new focus choice,
  with all seven existing drawings required to remain pixel-identical. It does not edit the
  merged base directly. This addresses the current artifact; prevention remains a proposal.
- **Checked in the open focus sketch:** the old placement branches/styles and unused icon
  parameter/import were removed. All seven pre-existing states have no pixel change for
  either focus candidate. This cleanup is still in the sketch, not merged into the base.
- **Decision (Tom, 2026-10-30):** both options. Option 1 is the authoring rule: rendering for one
  candidate lives in that variant's files, shared files hold only common code. Option 2 enforces
  it: `sketch ready` fails when the picked variant's dependency closure keeps unused imports,
  styles or parameters.

### Colour foundations and agent logos decisions (2026-10-30)

From the builder's check of `foundations/colors` against SDK theming (comments d367, 8e02) and
the agent logos sketch (comment 7257). Each change runs as its own sketch, in this order:
dead copy, then one source plus the warning theme, then the missing states.

- **One source:** the `foundations/colors` part is the source. `themes.ts` and
  `surface-themes.ts` in `apps/ethlete-studio` are generated from it; the overrides in
  `sdk-token-map.css` go away.
- **Dead copy:** remove the copied generator output (about lines 1-420 of `colors.css`, with the
  light blocks and `.et-color--warning`). The part keeps only real Studio tokens.
- **Warning:** register a `WARNING_THEME` of type `warning` with the part's values.
- **`--surface-sunken`:** no token below the surface system. Elevation 0 is the app background, so
  the page background maps to elevation 0 and `--surface-sunken` stops being a separate level.
- **Missing states:** add `--text-subtle`, `*-active` and `*-disabled` as part tokens; the part
  shows them as states for accent, warning and danger.
- **Studio-only tokens:** keep `--surface-pressed`, `--surface-shadow` and the `*-subtle` tokens,
  labelled as Studio-only in the part.
- **Agent logos:** Grok has no Simple Icons entry; look up xAI's official brand or press kit
  online and take the SVG from there. Never draw it from memory; leave Grok out only if no
  official source exists. Kimi in white, as Codex. Meta uses the "Meta AI" ring, not the Meta
  infinity mark. Tom picks the generic mark in Studio.

### State token values decisions (2026-10-30)

For the missing states (`*-active`, `*-disabled`, `--text-subtle`) in `foundations/colors`:

- **Step A, no visible change:** add the part tokens with today's generator values: active = the
  base colour, disabled = base at 0.4 opacity, on-colour disabled = 0.6, `--text-subtle` =
  `--text-muted` (oklch(0.72 0 0)). `generate-studio-themes.mjs` reads them from the part. Done: Tom
  merged it (`31c882a86`); the generator reads the tokens (`b39d636d4`), output byte-identical.
- **Step B, its own sketch:** tune the values, for example active darker than base (accent
  oklch(0.62 0.11 190)) and `--text-subtle` one step below muted (oklch(0.6 0 0)), with contrast
  numbers in the drawing. Tom picks in Studio.

### Comment cleanup decisions (2026-10-30)

Pain: the Studio comment panel fills with addressed threads nobody closes. On 2026-10-30, 27
comments had `addressed` and no `resolved`, and `sketches/` was empty, so none of them belonged to a
live sketch (reasons `round`, `merge`, `done`).

- **Sketch end:** `sketch merge` and `sketch discard` resolve every addressed comment whose `sketch`
  is that sketch, with a note that names the end, for example "resolved by the merge of
  pages/sketches variant f". Open comments stay open.
- **One-time cleanup:** resolve every addressed comment whose sketch no longer exists, note "sketch
  ended". Open comments are not touched.
- **Addressed without a sketch** (reason `done`): the next merge of its part resolves it. Until then
  it stays in the panel, with no extra group.

**As built (2026-10-30):** `sketch merge` and `sketch discard` call `resolveSketchEndComments` before they
address the open comments, so only comments addressed earlier are resolved (note "resolved by the merge of
<target> variant <key>" or "...the discard of <target>"); a merge also resolves the sketch-less addressed
comments of its merged parts. `et design comment resolve-ended [--product]` resolved 45 comments of
`studio` (27 addressed, 18 legacy `resolved` files that read as addressed); open comments were untouched.

## 6. Agent process

These pains came from how the agent worked, not from the tool. Each one has a rule now.

### 6.5 Completed sketch rounds were mistaken for complete product coverage - open

- **Pain (Tom, 2026-10-30):** after Switch and Project Picker were merged, the agent proposed
  only remaining page states and then app implementation. Tom corrected that much of Studio
  remains undesigned and that using Studio must continue to reveal workflow improvements.
- **Evidence:** `pages/inbox` has five list/filter states but no comment composer or thread
  reply. The running app already has `comment-draft.component.ts`, `comment-thread.component.ts`
  and `new-product-form.component.ts`; their workflows have no matching designed state.
  `pages/merge` has only `open`, while `sketch-view.component.ts` also handles comparison
  progress, comparison errors and a merge refused after the target changed. The existing
  start drawing sends product creation to the agent/CLI, while the app offers an in-app form.
- **Now:** the coverage inventory in `studio-wireframes-handoff.md` distinguishes existing
  drawings, missing workflows and separately planned capabilities. The next sketch compares
  three placements for composing a point-anchored comment in `pages/inbox`.
- **Fix options:** 1. maintain this evidence-based coverage inventory as each workflow is
  explored; record tool friction here with reproduction and options, then let Tom choose
  the design (recommended). 2. add workflow coverage metadata to the design tool so a list
  of parts/states can also reveal uncovered tasks; this needs a separate proposal.
- **Still open:** the inventory is an initial source audit, not an exhaustive product review.
  No tool change or missing workflow is complete merely because it has been listed.
- **Tom's follow-up audit:** repo/project picker hover and menu states, tree-icon tooltips,
  Inbox and Merge changed-list hover states, canvas zoom controls, the preset select's open
  body (`desktop 1440x900`) and the Merge unchanged accordion are also missing design coverage.
  These are recorded individually in the handoff's interaction-detail table. A page's presence,
  CSS pseudo-state or native `title` must not be counted as a reviewed interaction design.
- **Required systemic prevention:** finding 4.47 records Tom's demand for an enforceable
  completeness gate, including interactive-element declarations and associated surfaces.
  The manual inventory alone does not satisfy this requirement.

### 6.6 Literal attachment variants passed checks but failed visual judgment - open

- **Pain (Tom, 2026-10-30):** "das schaut alles nicht wirklich gut aus" after reviewing the
  Avatar attachment round D/E/F. All 36 state renders passed; none of these alternatives
  received design approval. The initial recommendation of D was not supported by Tom's
  assessment of the overall appearance.
- **What was drawn:** the same existing composer with a pointer, an overlapping avatar or a
  narrow bridge. Parent review corrected disconnected geometry but still focused too much
  on whether endpoints touched. That did not establish a good comment composition.
- **Interpretation, not a quoted requirement:** the agent treated "more attached to an avatar"
  too mechanically and retained the cluttered composer structure. The next round should
  compare coherent avatar/editor compositions rather than more connector decorations.
- **Now:** round 3 G/H rebuilds the composer composition from the directionally useful A;
  D/E/F remain visible as rejected history. Scope stays the same point-comment task.
- **Fix options:** 1. before presenting, critique hierarchy, avatar relationship, spacing,
  form nesting and host context together, at a readable detail scale and in the whole page
  (recommended). Reject technically valid but visually weak alternatives before `ready`. 2. add a declared visual review rubric to the exploration brief; it must support human
  judgment rather than turn subjective design quality into a render-pass boolean.
- **Acceptance:** future summaries distinguish "renders correctly" from "designer approved";
  a successful attachment check or a preferred agent variant does not establish either
  design quality or implementation completeness. Tom still chooses the composition.
- **Reference review requested by Tom:** before continuing G/H, compare his Figma screenshot
  (`/tmp/codex-clipboard-ZMjDSV.png`) and other tools. The screenshot shows an empty compact
  input alongside a pin, with an integrated arrow action and no heading, target breadcrumb
  or separate footer. This is a different state from our filled multiline editor; it must
  not be treated as an alternative to that state.
- **References checked (2026-10-30):**
  - [Figma's current add-comment guide](https://help.figma.com/hc/en-us/articles/360041068574-Add-comments-to-files):
    the official animation also shows a filled composer adjacent to its pin, with the send
    arrow in its own lower action region. It supports distinguishing initial entry from
    filled composition; it does not justify copying a whole feature set. The
    [2021 design rationale](https://www.figma.com/blog/stay-in-the-flow-with-redesigned-comments/)
    explicitly describes reducing composer size to encourage focused feedback; treat this
    as historical rationale, not proof of today's exact appearance.
  - [Miro comments](https://help.miro.com/hc/en-us/articles/360017730873-Comments):
    documents saved drafts when navigating away, Enter to publish and Shift+Enter for a
    newline. Its official edit screenshot shows a thread with author, editing controls and
    a separate reply field. That screenshot is an existing-thread edit, not a new comment.
  - [Penpot workspace comments](https://help.penpot.app/user-guide/designing/workspace-basics/#comments):
    the official screenshot shows an anchored thread with messages, authors and a reply
    field. The guide distinguishes adding a point-comment from replying to a thread.
- **Implication to explore, not an approved design:** compare compact entry compositions
  first, and show empty, filled/multiline and existing-thread states as separate states of
  each candidate. Start with pin plus input and integrated send; add chrome only when the
  task needs it. Cover draft preservation/cancel semantics separately so visual reduction
  does not introduce text loss. G/H were interrupted before visual review or a passed check;
  they are unfinished drafts, not reference-backed proposals ready for Tom.
- **Round 4 review finding:** the first compact I/J drawings recreated the marker at
  x=610, y=244 while A's actual marker was x=609, y=187. They looked locally aligned with
  their input but moved the feedback point by 57 px. Parent review requested browser
  measurement; the author confirmed and corrected both to x=609, y=187. Compare the pin
  against the original target, not just against its editor. A reusable anchored-composer
  helper or target-identity/geometry check is a potential tooling improvement; fixed page
  coordinates currently allow this semantic drift without a render/type error.

### 6.7 A reference was copied instead of informing an independent design - open

- **Feedback (Tom, 2026-10-30):** "das ist nun einfach eine kopie von figma. referenz heißt
  nicht klauen. feedback aufnehmen." Round 4 I/J is rejected; neither is an accepted
  direction for Studio or implementation.
- **What went wrong:** the agent used Figma's pin/input/send composition as the template
  for both candidates. The main comparison became a gap versus direct contact. That did
  not provide independent Studio solutions to the underlying comment task. Changing a
  palette or spacing does not establish a distinct design concept.
- **Scope of the earlier approval:** "sounds good" approved using the reference analysis
  to continue exploration. It did not approve copying Figma's visual composition or the
  resulting I/J drawings. The agent's recommendation and passing checks did not change this.
- **Required correction:** extract the problem a reference solves and its useful principles
  (low effort to start, clear point association, different entry/thread states), then derive
  a composition from Studio's own visual language and designer/agent workflow. Compare
  actual alternative answers to that problem; do not present minor variations of the
  reference as design exploration. More elaborate decoration is not a correction either.
- **Process improvement proposal:** before presenting a reference-led round, state which
  principle each reference contributes, what is specific to Studio and how the alternatives
  differ in concept. Review the candidates beside the reference to catch literal imitation.
  This supports human design judgment; no pixel-difference or render gate proves originality.
- **Decision (Tom, 2026-10-30):** option 1, as a rule in the `ethlete-design-exploration` skill:
  before a reference-led round is shown, the agent states the problem each reference solves, the
  principle it takes from it, and how each variant differs in concept, then reviews the variants
  beside the reference for literal copies. No fixed visual rubric.
- **Action at that turn:** record the negative feedback in the round note and handoff, leave
  the product unmerged and do not extend I/J into more states. This did not create a real
  rejection decision: I/J remained selectable. Tom corrected this false completion report;
  finding 3.45 records the missing lifecycle capability. Tom then explicitly requested that
  the design exploration continue with new work.

| Pain                                                                                                                                | Rule                                                                                                                                                | Ref        |
| ----------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| The agent said "visually checked" after static fit shots only                                                                       | Define the check from the design claim first. Report exactly which states and actions ran.                                                          | L2720      |
| The exploration became a second canvas implementation                                                                               | Name the visual question and the smallest artifact first. Reuse the real canvas.                                                                    | L2940      |
| One unchosen idea grew into four screens                                                                                            | Draw about three different alternatives next to each other.                                                                                         | L3020      |
| The agent blamed the wrong cause for an alignment comment                                                                           | Look at the real render before you name a cause.                                                                                                    | L2659      |
| A synthetic `dblclick` passed, a real double-click failed                                                                           | Use real pointer sequences.                                                                                                                         | L2818      |
| The agent extended the sketch while the tool was broken                                                                             | Stop the design work while a broken tool is repaired.                                                                                               | L2982      |
| New controls duplicated accepted controls                                                                                           | List the accepted controls before you draw. Name what you reuse.                                                                                    | L2579      |
| Shared elements were extracted too early                                                                                            | Draw pages first. Record repeats as findings. Compare before you extract.                                                                           | L2607      |
| The agent changed a ready variant without a report; Tom saw it change while no one was drawing                                      | Run `sketch report --variant <x>` before any edit to a variant, also a fix after `ready`.                                                           | 2026-10-29 |
| The agent guessed the direction of "spacing passt nicht" and drew one answer; it made the spacing worse                             | If a comment does not say which way, draw both directions as variants, or ask.                                                                      | 2026-10-29 |
| The agent answered Tom's comments with a variant in the running round; `sketch variant` defaults to it                              | An answer to comments opens a new round (`--round`, `--note`).                                                                                      | 2026-10-29 |
| A header decision went into one state; the sibling state kept the old header and Tom found it after the merge                       | Before `ready`, shoot every state that draws the changed chrome. Carry the decision into each, or ask.                                              | 2026-10-29 |
| After the zoom work the agent proposed more detail on `pages/sketches` (open points 5 to 8); that drifts from the base plan         | Before you propose the next step, read the agreed order: all pages first, then extract components (`design-system.md:905`).                         | 2026-10-29 |
| The agent wrote new plain CSS files (`header.css`, `heads.css`) for a sketch, though sketches may use the Studio Tailwind utilities | Use utilities in sketch markup (`f27c66d0e`). Plain CSS only for what utilities cannot express.                                                     | 2026-10-29 |
| `components/tree-row` was extracted with one host (`part-tree`); its sketch missed the host's cases and cost an extra round         | A part becomes a component only when two hosts draw the same case. Until then it stays in its host. `tree-row` has two: `part-tree`, `pages/flows`. | 2026-10-29 |

### Parked: open points on `pages/sketches` (2026-10-29)

Parked until all pages exist and the components are extracted. Next is `pages/flows`, the only shell
section without a page.

- Several state rows per variant, with the head on the top frame.
- Pending "Wird gezeichnet" placeholders.
- The head of the "Aktuell" column.
- Pins and comments at zoom. Recommendation: keep them at screen size.
- Several screen sizes side by side.

### 6.8 The agent invented focus variants without establishing the editor lifecycle - open

- **Correction (Tom, 2026-10-30):** "ich denke nicht dass wir das comment fenster ohne
  focus offen lassen. der bereits gestaltete stand ist der focus stand. kein focus ->
  comment schließt". The merged L appearance is already the open/focused editor.
- **Failure:** the agent treated focus as a missing visual decoration and opened a new
  A/B ring comparison. It assumed an open/unfocused base state instead of deriving valid
  states from the task. Render checks passed this invented matrix. The bare textarea's
  suppressed outline did not establish a requirement to redraw the accepted editor.
- **Agreed behavior:** opening the comment editor means it has focus; leaving its focus
  scope closes it. Focus moving between controls inside the editor, such as textarea to
  Send, keeps it open. There is no persistent open-but-unfocused editor state. Losing
  focus does not submit the comment. Draft retention/discard after closing is a separate
  policy, not silently decided by this correction.
- **Current action:** a corrective single-variant round restores L's accepted appearance,
  removes the speculative extra focus state in that candidate and documents the lifecycle.
  Existing no-editor drawings cover the closed presentation. No actual focus/blur runtime
  behavior is implemented by these static drawings, and no formal rejection state for
  the old A/B candidates is implied (3.45).
- **System improvement:** extend the proposed completeness model (4.47) with valid
  lifecycle states, transitions and focus scope. Require reachable states and meaningful
  transitions before expanding interaction coverage; do not demand every mechanical
  focus/hover combination for a control that would already be closed. Drawn focus evidence
  and real behavior verification remain distinct.
- **Acceptance:** the accepted L appearance is used for the focused editor; focus can move
  to Send without hiding it prematurely; moving outside closes it without sending. Future
  implementation must verify those transitions and the separately chosen draft policy.
- **Draft policy (Tom, 2026-10-30):** a closed editor keeps its draft. The pin shows a draft
  mark, and the editor shows the text again when it opens. Only Send or an explicit discard
  drops the draft.
- **Stopped at Tom's request:** "no more new sketches for you" / "wrap it up". Corrective C
  exists with an author check but remains unmerged and not ready. No further sketch work,
  publication or automatic continuation is authorized. The committed L design stays as is.
  Lifted (Tom, 2026-10-30): the stop held only for that evening.

## 7. Open checks

These fixes are built, but nobody checked them in the real Studio.

1. The status-watch reload with `et design sketch report` (L1918): the Studio side is verified headless. The Rust side (the watcher) needs the Tauri host and is still unchecked.
2. The `stale` footer (L1980): the Studio side is verified headless. The Rust side (`is_stale`) needs the Tauri host and is still unchecked.
3. Shot size against live size on Tom's HiDPI window (L1214).
4. Round d on macOS WebKit, at 800%, and on touch (L2792).
