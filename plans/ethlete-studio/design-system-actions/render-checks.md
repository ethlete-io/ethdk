# Open: 4. Render checks and shots

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
- **Decision (Tom, 2026-10-30, crop size):** since 4.60 each change cluster has its own crop, and enlarging each
  to the column width blurred small crops up to 33x. Keep the cap from `cbba0051d`: a crop is enlarged at most 2x
  (`CROP_MAX_SCALE`) and keeps its own width; narrow crops leave empty space at the right. This replaces
  "enlarged to the column width" above.

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
- **Decided (Tom, 2026-10-30), control ownership:** a control that a page draws through an embedded part
  belongs to that part, automatically. Every rendered part root carries `data-et-part`; discovery gives each
  control inside it to that part. A page declares only its own controls, and the owning part must pass
  `design complete` itself. A page that restyles an owned control with its own CSS fails as
  `CONTROL-OVERRIDDEN` and must declare that control. Merged parts change only through sketches after this.
- **Decided (Tom, 2026-10-30), inventory approval view:** Studio shows the page's rest frame with a numbered
  box over each control (green declared, red undeclared, amber unclassified) and a list beside it: number, id,
  kind, inputs, surfaces, state count. One "approve inventory" button below. The approval stores the control
  ids and the part hash in `.ethlete/design/<product>/inventory.json`; a new or removed control or a part edit
  reopens it. A page with a red or amber box cannot be approved. No keychain signature.
- **Decided (Tom, 2026-10-30), base part sketches:** a sketch made from an SDK base part
  (`.ethlete/design/sdk/...`) merges into the base by default. A product override needs an explicit
  `sketch new --override`. Next: a new sketch moves the `components/button` controls into the base, and the
  studio copy `.ethlete/design/studio/components/button/button.ts` from `e304eb3d0` goes away.
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
- **Next (done below):** discovery (`CONTROL-UNDECLARED`,
  `CONTROL-UNCLASSIFIED`), then the other kinds.
- **Status:** discovery built (`3c0a2c59b`). Each rest frame's DOM is walked: native controls,
  interactive roles and known SDK controls (`et-select`, `et-form-field`, `[et-button]`, ...)
  without a marker fail as `CONTROL-UNDECLARED`; an element with a pointer cursor (where it
  starts, not inherited) or a matched `:hover` rule (forced `:is(:hover, ...)` included),
  outside every control and marker, fails as `CONTROL-UNCLASSIFIED`. One line per DOM path,
  with its states and count. `CONTROLS-MISSING` is gone: a part without controls passes when
  it draws none. Decided scope rules: a marker on the control itself declares it; a marker on
  a wrapper that is no control declares the controls inside it; a control nested in another
  control is its own control, except inside an SDK control (`et-textarea` owns its `textarea`).
  Everything inside a marker whose control names a `part` belongs to that part. `embedPage`
  iframes are not walked. Bites: the new specs fail on the old `complete.ts` (undeclared
  button, part without controls); walking iframe documents fails the embed spec. Verified:
  design vitest 740/740, tsc, build, eslint, prettier.
  Findings on the real parts (`.ethlete/design/studio`, unchanged): `components/disclosure`
  and `foundations/icons` pass. `pages/merge` fails with 6: Back and Merge buttons, the two
  buttons in the shot, the shell's project and collapse buttons undeclared, and the changed
  list `li` rows unclassified (cursor pointer). `components/tree-row`, `elements/part-tree`:
  the `div.st-trow[tabindex]` undeclared. `components/comment-pin`: its `button`.
  `elements/shell-main`: project/collapse buttons, picker `role="option"` rows and action.
  `elements/canvas-frames`: 18 grid buttons. `pages/inbox` 8, `pages/system` 7,
  `pages/sketches` 13 (zoom buttons, preset `et-form-field`, tree rows, grid buttons, shell),
  `pages/flows` 5, `pages/start` 2. The shell buttons repeat on every page.
- **Next:** controls of an included element or component (the shell, tree rows, grid cells)
  repeat on every page; let a page attribute them to the part that draws them (a marker with
  `part`, as for the disclosure) instead of declaring each again. Then the per-page inventory
  contact sheet with Studio approval, then the other kinds (`button`, `row`, `select`, ...).
- **Status:** part ownership built (`77c506b3d`, Q22 a). The `data-et-part` root marker already came
  from the part-marks transform; `markPart` now also stamps `data-et-slot="<key>"` on every element of the
  markup a host passes into a part through its props (strings in props, arrays and plain objects to depth
  4, copied). An element belongs to the nearest `data-et-part` key up its ancestors, skipping one root per
  slot key it carries; the frame's own key or none means the part itself. So a page's content passed into
  `elements/shell-main` stays the page's, the shell's own buttons are the shell's. Owned controls and
  unclassified elements are skipped on the host, owned `data-et-control`/`data-et-surface` markers are
  ignored there, and the host reports each owning part once as `CONTROL-PART-INCOMPLETE` ("`<owner>`
  draws N control(s) here and is not design complete: K gap(s)"), unless a declared control already names
  that part. Owners are checked once per run (memo). `CONTROL-OVERRIDDEN`: every rule of the `*.css`
  files in the host part's own folder is parsed in the frame (`CSSStyleSheet.replaceSync`, nesting
  resolved, `:hover`/`:focus*`/`:active` matched as always-on, pseudo-elements on their element) and
  matched against owned elements; on the owned root, outer layout (margin, inset, size, position,
  z-index, flex and grid placement, order, transform) does not count, everything else does, and inside
  the root every property counts. A host `data-et-control` around the element declares it. Limits: CSS
  the host returns from `render` or imports from elsewhere, Tailwind classes, and inline styles are not
  seen; raw files are parsed, so `@apply` is not expanded (no Studio part uses it).
  Bites: each fails the new spec when removed - the owner skip (shell `Menu` button undeclared on the
  page), the owner report, the root layout filter, the override check, the slot marks (page `Own` button
  given to the shell). Verified: design vitest 743/743 (one `sketch-stylesheets` load flake, passes
  alone), tsc spec, build, eslint, prettier. Findings (`.ethlete/design/studio`, unchanged), gaps before
  -> after: `pages/merge` 6 -> 5 (`li` rows unclassified; `components/button` (3 buttons, its own gaps:
  `PART-UNREVIEWED`, its `button` undeclared) and `elements/shell-main` incomplete; two overrides:
  `.mg-shot .et-button` outline and `.mg-shot[data-side="after"] .et-button` border-radius),
  `pages/system` 7 -> 3 (button, tree-row, shell-main), `pages/sketches` 13 -> 9 (tabindex div, pin
  button, preset `et-form-field`, button/tree-row/shell-main, overrides: zoom `.et-button` padding,
  color, font twice and `.st-shell-side` width), `pages/inbox` 8 -> 7 (comment draft `et-button`,
  `et-textarea`, pin button, `et-switch`; button, canvas-frames, shell-main), `pages/flows` 5 -> 4
  (`et-form-field`; button, tree-row, shell-main), `pages/start` 2 -> 1 (button). Owners:
  `elements/shell-main` 4 (project, collapse, picker options, picker action), `components/tree-row` 1,
  `elements/canvas-frames` 18 -> 1 (its grid buttons are `components/button`), `components/comment-pin`
  1, `components/button` 2. Fixing `components/button` and `elements/shell-main` clears most page gaps.
- **Next:** the per-page inventory contact sheet with approval in Studio, then the other kinds (`button`,
  `row`, `select`, ...), so `components/button` and the shell can declare their controls.
- **Status:** control kinds built (`db90334c2`). `button` adds `active`; `select` and `menu` need
  `surfaces.open` drawn visible, with an option in it (`role="option"`, `role="menuitem*"`, `data-et-option`)
  forced hover and focus-visible and one selected with its own look; `row` needs a selected look and a forced
  hover while selected; `tooltip` needs `surfaces.tooltip` visible next to the control; `disabled: true`
  needs a disabled look (`disabled`/`aria-disabled`). Selected is `aria-selected|checked|pressed="true"` or
  `aria-current`; a look is the computed colours, opacity, shadow and weight of the element and its
  descendants, compared only on unforced instances. With `part`, interactions, looks and option states come
  from the part, surfaces stay on the host, so a closed select never counts as open. Options in a surface
  belong to its control in discovery. Fixed on the way: a base part (`components/button` in studio) read its
  review from the product's `merged.json` and failed `PART-UNREVIEWED`; it now reads the base's.
  Inherited coverage via `sdk: 'et-select'` is not built: the SDK base parts (`components/select`,
  `components/button`, `components/form-field`) declare no `controls` and draw no option matrix, so the
  existing `part: 'components/select'` is the reuse path today and fails until that part declares its options.
  Bites: each kind fails its spec when its rule is removed (button `adds`, row `selects`, `disabled`, select
  `options`, tooltip kind, `own` guard on options, unforced-look filter, option discovery, ARIA selected
  detection, base review). Verified: design vitest 751/752 (one `changed-parts` load flake, passes alone),
  tsc spec (only the motion agent's `motion-shot.spec.ts` errors), build, eslint, prettier.
  Findings (`.ethlete/design/studio`, unchanged): `components/button` 2 -> 1 (`PART-UNREVIEWED` gone; its
  `button` undeclared: needs `kind: 'button'`, pointer+keyboard, grid columns hover/active/focus-visible,
  `disabled: true` since it draws disabled). `elements/shell-main` 4: project trigger as `menu` with
  `surfaces.open: 'project-picker'` and the picker list marked `project.open` (clears the 3 `role="option"`
  rows; then option hover, focus, selected), collapse button and picker action as `button` or
  `part: 'components/button'`. `components/tree-row` 1: `div.st-trow[tabindex]` as `row` (it already draws
  selected, selected-hover, active, focus-visible in its grid). `components/comment-pin` 1: its `button` as
  `button` (it already draws hover, active and focus-visible). `pages/merge` 5: changed-list
  `li` rows unclassified (need a row part and `part`), `components/button` and `elements/shell-main`
  incomplete, two `.mg-shot` overrides.
- **Next:** the per-page inventory contact sheet with approval in Studio; sketches for `components/button`
  and `elements/shell-main` that declare their controls with these kinds; then `controls` on the SDK
  base parts (select options) for inherited coverage, exceptions, and the `handoff` status with CI.
- **Status (2026-10-30):** sketch `components/button` a r1 at ready (`111e56d73`), not merged: each button gets
  `data-et-control="button"` and `data-can-animate` (the real `et-button` gets it; without it the forced states fail
  `CONTROL-TRANSITION-MISSING`), `interactionRows` with the 7 states plus `disabled`, each with forced hover, active
  and focus-visible, and `controls.button` `kind: 'button'`, pointer and keyboard, `disabled: true`. On the sketch
  code `design complete` leaves only `PART-UNREVIEWED`. Not auto-merged: every rest frame counts as changed. Gaps
  found: `design complete` cannot take a sketch (checked by a temporary copy over the base part); the base part lives
  under `.ethlete/design/sdk/` while the sketch is under `studio/sketches`, so check the merge target. Q25 (inventory
  sheet UI) is with Tom.
- **Merged (Tom, 2026-10-30):** the button sketch (`e304eb3d0`). The merge wrote a new product part
  `.ethlete/design/studio/components/button/button.ts` that overrides the `sdk` base part; the base still declares
  no controls. `design complete components/button --product studio` passes. Open: should a sketch of a base part
  merge into the base, or stay a product override?
- **In progress (2026-10-30):** Q32 (a): base part sketches merge into the base, `--override` for a product copy;
  then the button controls move into the base (subagent). Also: `sketch ready` must refuse a variant that does not load.
- **Status:** inventory slice 1 built (`0c4b8a887`): `system/inventory.ts`, `inventory-approval.ts`; `seePart` in
  `complete.ts` draws once for `design complete` and the inventory; discovery records each control's box in shot
  pixels. `GET /__design/inventory?product=&part=` gives `{ part, hash, ids, findings, approval, state, reason, frames }`
  (`state` none/approved/reopened with added, removed, changed; a frame is `{ state, preset, width, shot, controls }`,
  a control `{ number, id, status, kind, inputs, surfaces, states, box }`). `POST /__design/inventory-approve?product=`
  with `{ part, hash, by }`: 422 with a red or amber control, 409 on a changed hash, 400 without `by` or `hash`; writes
  `{ ids, hash, by, at }` to `inventory.json` (the base's folder for a base page). Page parts fail
  `INVENTORY-UNAPPROVED` until approved. Bites: added id, removed id, hash change, refused approval, the gap. Not
  verified: a real 409 and a real write; Chromium missing throws instead of a 4xx. Elements with one DOM path share
  one number (two `li`s on `pages/merge`). Found on the way: `aae2914f3` imported the frame runtime into `src`, so
  `tsc` emitted CommonJS into `dist/libs/cli/design` and every render failed with `exports is not defined`; fixed in
  `203aa2c35` with a spec. Next: slice 2, the Studio view.
- **Status:** inventory slice 2 built (`2a90d0cfd`): a page part has an "Inventory" toggle in Studio
  (`system-view/inventory-view.component.ts`, `inventory.ts`, `host/design-inventory.ts`): each rest frame's shot with
  numbered boxes (brand declared, danger undeclared, warning unclassified), the list (number, id, kind, inputs, surfaces,
  states), the approval state, and "Approve inventory", off while a control is red or amber; it posts
  `{ part, hash, by: 'designer' }` and names 409 and 422. Bites: tone by status, number order, disabled approve, the
  `by`, the 409 text. Not verified: the view in the running app; a real 409 and write. Against an own server the GET
  answered for `pages/merge` (shot 1440x900 matches the boxes), then every page draw failed while other streams
  changed the design tsconfigs.

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

### 4.54 A design cannot say that a change between states animates - in progress (builder, 2026-10-30)

- **Progress (2026-10-30):** `components/disclosure`, `foundations/icons` and `foundations/logo` moved, all
  auto-merged; `logo.css` is gone. `.st-disclosure-body` stays in CSS: `pages/merge/merge-data.ts` builds its own
  `<ul class="st-disclosure-body">`. Left: `inbox`, `comment-pin`, `pages/sketches`, `foundations/agent-logos`
  after their open sketches merge; `shell-main/shared/picker.css`; then register `UTILITY-CSS` in `RULES`.
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
