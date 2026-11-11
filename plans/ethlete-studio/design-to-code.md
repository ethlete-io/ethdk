# Design to code

Status: decided (Tom, 2026-10-31), not built.

## Goal

A merged design becomes code under the control of the system, not of the agent. Tom: "Das System muss machen was
geht, der Agent hat sonst zu viel Freiraum." No implementation without Tom's go (Q153).

Core principle (Tom, 2026-11-02, finding 169; he had written it about 100 times in other words): a rule an agent
must remember is a rule the next agent forgets; the tool has to enforce it. Every rule that lives only in prose
(skills, handoffs, plan decisions, agent messages) and that a tool could check becomes a hook, a check or a refusal.
Prose may explain a rule, never be its only guard. Every new finding answers: which tool enforces this now?

Archived: Design to code decisions (2026-10-31), see [findings-2026-10](archive/findings-2026-10.md).

## Not decided

- Done (280efe991): compare renders the real component per state through a harness route in the owning app.
  Done as built: a page part is a presentational component; the fixture and the harness supply its data through
  inputs (studio-design-part skill, "No sample data as an input default").

- Where the go and the released state are stored (builder call).

## Build slices (builder ethlete-sdk-57)

1. Built (`cae5fb9c6`): `definePart({ implements })` takes a `PartLink`: `'<repo path>.component.ts'`, or
   `{ route: '/x' }` for a `pages/` part. Rule `system/rules/implements.ts`: `IMPLEMENTS-MISSING` (no such file)
   and `IMPLEMENTS-SHAPE` (not a literal, wrong form for the layer, absolute path, route without `/`).
   `system/open-points.ts` is pure: `OPEN_POINT_KINDS` holds the Q156 order, `openPointsOf()` lists the points per
   part; `read-open-points.ts` reads them for a product. Open comment = any comment not `resolved` (an answered one
   counts). Unmerged sketch = any sketch folder that targets the part. Unlinked = no `implements`; foundations do
   not count. `et design check` prints them after the problems; the exit code is unchanged. Studio API not touched.
   Verified: 419 cli design tests, tsc, lint; the new check specs fail without the change; one real check run.
   Not built: a new-part sketch has no part to attach to; routes are not checked against the router.
2. Built (`02a6049bc`, `97ab889ed`, `8b5b314d3`, `f8d126bd5`):
   - Missing state: every check prints "no controls declared" for a component part. The per-control gaps
     (`CONTROL-UNDRAWN`, `CONTROL-GRID-MISSING`, `REQUIREMENT-MISSING` of `completenessGapsOf`) need a full draw per
     part, so they print only with `et design check --complete`. `partsCompletenessOf` draws many parts with one
     server and browser. Pages and foundations are exempt.
   - Contrast: the render check's `CONTRAST` findings per part. Text keeps the WCAG large-text rule (Q170). New
     3:1 measure (Q169, Q175): borders only of controls (native inputs, `[data-et-control]`, control roles) and of
     the nearest bordered ancestor that wraps a control inside its part; icons (`svg` fill or stroke, best paint
     counts). Disabled, invisible and excepted elements are skipped.
   - Missing motion (Q168): every ordered pair of `states`, static, on every check. A pair with a `focus` state is
     exempt. A loop is a motion with `from === to`; an ongoing-work state (name contains loading, pending, busy,
     progress, indeterminate or spinner) needs one. `definePart({ unreachable: [{ from, to, reason }] })` drops a
     pair; rules `MOTION-UNREACHABLE-STATE`, `-REASON`, `-LITERAL`. Foundations are exempt.
   - Verified: specs that fail without each change, the design folder (916 tests), both tsc configs, lint.
     Not verified: a full `check --complete` run on a real product, and its run time.
   - Known: about 3,750 motion points per product, because `states` holds showcase variants. Q173 moves them out.
     `changed-parts.spec.ts` has a timing test that fails sometimes under load.

- Built, tool frictions between slice 2 and 3:
  - Q181 (`cba45653d`, `d2c5f7f30`): `CONTROL-STATE` error from `controlStateGapsOf` (`system/complete.ts`) in the
    render check and in `completenessGapsOf`; the <10 % change is a HINT in `complete` and `check --complete`. The
    element name is the state's last word. A `components/` part with no `controls` gets "declare its controls (Q164)".
    `sketch report` is not gated. Freeze follow-ups: `0cdb62d6d`, `8b35a636f`.
  - Contrast (`348654b93`, `bb2aa68a8`, `1711ebc68`, `c97762e35`, `53b5e7543`): UNUSED `shared/` rule; a frame is a
    wrapper bordered on 4 sides that its controls together fill to at least half (Q175, Q96), toolbars excluded; an
    `aria-hidden` svg outside a control is skipped; a gradient frame fill reads as a colour; repeated findings print
    once with "(N times)".
  - Studio: grid LIGHT cells on dark (`cb8663fd9`); extra targets in `shot`, `sketch list` and
    `sketch target add` (`f7b2ac56b`); render-queue priority with `view` and `rank` on `GET /__design/shot`
    (`7ad3413ae`, `74fa36038`, `41b34d2a5`). Q186 Codex model names (`6300dac7e`).
  - Verified: specs that fail without each change, tsc, lint; sketch agent ethlete-sdk-33 used shot and list.
    Not verified: the render-queue priority and the checkouts toggle (`b85f0e33f`) in the running Studio.
    `shot-store.spec.ts` and `sketch-stylesheets.spec.ts` flake in the full design run (temp dirs in the source tree).
  - Q185 (`41e463a5a`, `4594ab65d`): merged interaction states on a non-control part are hints under `--complete`;
    a sketch check blocks only added or changed ones (pixel compare when its CSS changed). Plain `check` shows none.
  - Q182 (`574342778`, `35707ec97`): `OPTION-VALUE-MISSING` (`system/rules/option-values.ts`,
    `definePart({ omits })`); merged gaps are hints, a sketch blocks on a newly missed value. 18 merged sdk parts
    miss values. Also: `sketch merge` runs the target repo's Prettier (`89fdc42c7`), `variant --from` keeps
    relative symlinks (`c9bafb453`).
- Built, friction slice B:
  - Q176 (`6b348f54f`): `bg-surface-pressed` in the Studio theme (`apps/ethlete-studio/src/styles.css`); a forced
    state that draws no different pixel names an undefined `hover:`/`active:`/`focus` class. Studio has no hover
    token yet (with the lead).
  - Q177 (`c9406cde0`): kind `menu` needs hover, focus-visible, active and no selected look; `select` keeps
    selected. No `listbox` kind until a part needs one.
  - Q179 (`37356a2f3`, `a53ccb27c`, `91b915f17`): the existing `base` relation is the kit. A page no longer fails on
    gaps of base parts, and base-part findings never block the consuming product's `check`; one line counts them
    per rule.
  - CONTROL-PART-INPUT (`2e85c5747`, `beb4c70db`): a control without `data-et-control` is a warning in `check`; a
    sketch blocks only a newly added one. One selector (`PLAIN_CONTROL_SELECTOR`) with `CONTROL-UNDECLARED`, which
    is now a hint in `complete` (`5451296f2`). sdk: 39 warnings in 17 parts.
  - `control(markup, name)` (`6f28f0a61`, `ee8b754e6`) in `libs/components/design/control.ts`, for product parts;
    the sdk mocks set plain `data-can-animate="true"`. CONTROL-TRANSITION-MISSING on sdk: 10 to 5 (chip remove and
    switch track need lib CSS, with 33).
  - Verified: specs that fail without each change, tsc, lint, read-only `check` on sdk and studio. Studio's check
    still stops on 3 findings in its own design files (with 33).
- Built, step 2 (slice 3 without the Studio UI; Q191: 33 sketches the list UI, built after the pilot):
  - `GET /__design/open-points?product=&part=&draw=` (`6cceea5a3`): no draw by default; `draw=true` with a `part`
    adds contrasts and control states (`system/drawn-open-points.ts`).
  - Part ready (`0b326145d`): `ready.json` `{ [part]: { hash, by, at } }` in the owner's folder;
    `et design ready <part> --product --by`, `POST /__design/part-ready` (400, 404, 409 stale hash, 422 with the
    points), MCP `part_ready`. The mark drops on a hash change; `check` prints `READY`.
  - `sketch ready` gate (`d7929629a`, `d495e30ce`): refuses on missing-state, contrast and missing-motion points
    the variant ADDS against the merged part; inherited ones print as NOTE. A new part blocks on all.
  - Fixes on the way: CONTROL-PART-INPUT matched nothing after `beb4c70db` (import cycle, `911aa3e24`);
    STALE-REPLACE read an anchored regex against the whole source (`1e5ff0c72`); Q190 `surface-hover` (`a52b0d7bf`).
  - Verified: specs that fail without each change, tsc, lint, design folder 968/969 (`list-system.spec.ts` passes
    alone). Not verified: a real draw through the endpoints or `et design ready`.
- Built, Q191 frictions: a shared export of a sketch warns only when no variant imports it (Q96, `2676c44a9`);
  `control(markup, name)` renames an already marked control (`fc4258a3a`). CLIPPED on the narrowed canvas: no tool
  change, the canvas part marks its pan viewport itself (33). CI fix: cli specs run without a browser (`923da26db`).
- In progress, step 3 (go/task/compare), in slices:
  - 3a go, built (`aafb4e832`): `go.json` `{ [part]: { hash, by, at } }` beside `ready.json`, stale on a hash
    change; `et design go <part> --product --by`, `POST /__design/part-go` (400, 404, 409 stale hash), MCP `part_go`;
    `check` prints `GO`. Open points `no-go` and `stale-go` only for a part with an `implements` link, so a linked
    part needs a go before ready. `GET /__design/open-points` for one part also answers `go`. Verified: new
    `part-go.spec.ts`, system/mcp/open-points specs, tsc, lint. Not verified: the `serve.ts` route in a running
    server.
  - `sketch report` refuses a ready sketch without `--reopen` (`b199b7164`).
  - 3b task, built (`95219930b`): `et design task <part> --product` prints go hash, link, the `states` props as
    inputs, new and changed states against `implemented.json` (`{ [part]: { hash, at, states } }`, a sorted-key
    props hash per state; "all states" when only render or styles changed), allowed files and "compare green".
    Refuses an unlinked or route-only part (Q195, comes with 3c), no go, or a stale go. `--verify [<rev>]` checks
    the files of a commit or range (default `HEAD`; the shared tree holds other sessions' edits) against the
    allowed files (implements folder; sdk adds `.changeset/*.md`, `apps/docs/components/**`) and records nothing
    until 3c; `markImplemented` is exported for 3c. Verified: `part-task.spec.ts`, go and open-point specs, tsc,
    lint, a real refusal (no part has a link yet) and the success and verify paths in a temp repo. Not verified:
    the sdk product, a root commit for `--verify`.
  - 3c compare, in progress (builder ethlete-sdk-57), in two parts. 3c-1 CLI: `et design compare <part> --product
--url <app dev server>`, `PartLink` `{ route, component }` for page parts, `task --verify` records
    `implemented.json` when compare is green. 3c-2: the harness route in `apps/ethlete-studio` and
    `apps/docs-examples`. Builder defaults (safe to undo): the CLI passes each state's props as a JSON `props` query
    param to `/__design-harness?part=&state=&props=`; the app keeps a hand-written dev-only registry from part to a
    lazy component; compare shoots the part frame and the harness host element in one Chromium at 0 px; the CLI
    never starts the app server, it takes `--url`.
    Lead changes (76, 2026-10-31): no hand-written registry; the part-to-component map comes from the `implements`
    links (generated, or resolved by the harness from the link; Q157 one source of truth). `--url` stays; without
    it, compare starts the app's dev server itself on a free port, never on 4221, 4402 or 4492 (3c-3).
  - 3c-1 built (`490a2ae39`): `PartLink` `{ route, component }` for pages (rule and `task` accept it);
    `harnessUrlOf` is the app contract (`/__design-harness?part=&state=&props=`, host `[data-design-harness-host]`);
    `et design compare <part> --product --url [--state]` shoots the fitted design frame and the host at 1280x800,
    scale 1, `omitBackground`, after `document.fonts.ready`, animations off; 0 px, size mismatch fails; failing
    states write design, app and diff PNGs to a temp folder. `task --verify` needs `--url` and records
    `implemented.json` only on green. PNG compare on Node `zlib`, no new dependency. Verified: specs (browser cases
    skip without Chromium), tsc, lint, one real Chromium run against a static harness in a temp checkout. Not
    verified: a real app harness (3c-2), the CLI from `dist`.
  - 3c-2 built (`280efe991`): `harness: { app, map }` per product in `.ethlete/design/config.json` (studio:
    `apps/ethlete-studio`, sdk: `apps/docs-examples`); `et design harness --product [--check]` generates
    `DESIGN_HARNESS_PARTS` from the `implements` links (one exported `@Component` per file, route-only skipped);
    `compare` and `task --verify` refuse a stale map. Both apps use hash routing, so `main.ts` boots a harness root
    on `/__design-harness` in dev only (`ngDevMode`); production bundles hold no harness. Verified: specs, tsc,
    lint, prod and dev builds, docs-examples in Chromium (unknown part text; a temporary map entry rendered a host).
    Not verified: Studio served, a real `compare` against a harness, a non-empty map under module-boundary lint.
  - Q198 (a) and (b) built (backlog-parallel.md); (c) waits for the Q197 migration.
  - 3c-3 built (`8554ad508`): without `--url`, `compare` and `task --verify` run `nx run <project>:serve --port=<n>
--host=127.0.0.1` for `harness.app` as a detached process group on an OS-given free port (never 4221, 4400, 4402,
    4403, 4492), poll `/__design-harness` up to 300 s, and always stop the group (also on a failure and on SIGINT).
    The stale-map refusal and the git file check run before the start (`system/harness-server.ts`). Verified: specs,
    tsc, lint, a real docs-examples start and stop (ready in 18 s, no process left, also after Ctrl-C). Not verified:
    a real compare of a part (empty map), Studio served this way, the 300 s timeout, the CLI from `dist`.
  - Pilot, in progress (builder ethlete-sdk-57): the pilot (Studio `elements/shell-main` b, `pages/inbox` d through go, task and compare). Slice 1 `pages/inbox` d: implements link
    `{ route: '', component: 'apps/ethlete-studio/src/app/design-parts/inbox/inbox.component.ts' }`, go, a
    presentational component, harness map, compare, `task --verify`. Slice 2 `elements/shell-main` b with its controls.
  - Pilot slice 1 built (`1c6bf2291`, `bf6f3d455`): `pages/inbox` compare is 0 px in all 7 states, and
    `task --verify` recorded it in `implemented.json`. The last diff was the comment editor arrow: the app now draws
    the SDK `et-overlay-arrow` geometry (20 px box at 16 px, clipped 14.14 px square, `translate3d(0,0,0)` for the
    same antialiasing), and the pane is `isolate` so the pin stays on top. The harness map was stale (the older
    `implements` links of 10 parts); regenerated. Verified: a real compare and `task --verify` with the harness app,
    ethlete-studio lint. Not verified: the real Studio route; `/` still renders `StudioViewComponent`, not the
    inbox component.
  - Pilot slice 2, in progress (builder, 2026-11-01): `elements/shell-main` as its own component, linked, go, task,
    compare and `task --verify`; then the inbox uses it and its shell copy is deleted, with the inbox compare still
    green (Impl Q3).
  - Pilot slice 2 as built (`9cda20519`, `cea751f51`, `85e3a6796`, `aa9c3fb57`, `c8776fe99`): `ShellMainComponent`
    (`apps/ethlete-studio/src/app/design-parts/shell-main/`) with slots `[shellMainStudio]` (falls back to the Studio
    mark), `[shellMainSide]` and the canvas; rail buttons are `et-button`s; the picker is the SDK `etMenu`. A
    component-only link is a string literal (`implements: '<path>'`); the object form is refused. Tool gap fixed:
    compare now hovers, presses or keyboard-focuses each `data-et-force` element of the design picture, found in the
    app by its `aria-label`. Compare `elements/shell-main`: 14 of 15 states 0 px; `project-picker` 2923 px, so
    `--verify` recorded nothing. Cause, a design defect: the frame loads the SDK `--et-font-family: system-ui`, so
    the design menu draws in system-ui, the app in the Studio font (with the token copied in, 29 px of corner
    antialiasing remain from the overlay pane). The inbox draws inside the shell; `pages/inbox` is 0 px in all 7 states
    and re-recorded. Verified: both compares, `task --verify`, lint, tsc, the app-classes check, the cli compare spec.
    Not verified: the real Studio on :4402, keyboard opening of the picker (`autoFocus="false"`). Open: the inline
    SVGs (rail icons, Studio mark) have no shared app source; they moved over from the inbox copy.
  - In progress (builder ethlete-sdk-cf, 2026-11-01), in parallel: Impl Q6 items 1 and 2 (cli); Impl Q10 disabled
    guards (sdk CSS); Impl Q8 picker font and the 29 px (shell-main); pilot slice 3 real route (Impl Q5).
  - Impl Q12-Q14 as built (`a136928b4`, `1302cdc3a`, `87562073c`, `43f647c10`, `f7fe9b71c`): `--et-font-family:
var(--font-ui)` on `:root` in `sdk-token-map.css`; `translate3d(0, 0, 0)` on `.st-project-picker` and a new go
    (recorded `--by tom`, from Impl Q13); `autoFocus="false"` removed. Compare opens a state that a control names in
    `surfaces` by a real pointer click: it loads the nearest other state (fewest differing props; a tie stops with
    an error), clicks the `[aria-expanded]` app element whose `aria-label` or text matches `[data-et-control=<id>]`,
    moves the pointer off the page and waits for the open state. Verified: compare `elements/shell-main` 0 px in 15
    of 15 states, `pages/inbox` 0 px in 7 of 7; `task --verify 43f647c10` recorded shell-main (hash
    `4b64a4137ba97697`); `part-compare.spec.ts` 17 of 17, the new tests fail without the fix; tsc and eslint on the
    cli files. Not verified: full cli and Studio suites, compare `pages/merge` (state `unchanged-open` now opens by
    click). `task --verify` without a revision checks HEAD, so it fails while other agents commit; pass the revision.
  - Pilot slice 3 as built (`c41236520`, `55f20e053`): `system-view` draws `ShellMainComponent` around every view;
    the tree sits in the side panel, the rail lists the design products, section Inbox draws `InboxComponent` with
    live comment-store rows (`system-view/inbox-comments.ts`). The old comment panel, product `et-select` and
    "Comments · n" button are deleted; "n ?" opens Inbox. The checkout picker moved from the footer into the shell
    project picker ("Projekt öffnen…" opens the checkouts panel). Verified: compare `pages/inbox` 0 px in 7 of 7;
    ngc, tsc, eslint; app vitest 443 of 444 (the stale canvas class spec, fixed in `d0d4df8fc`); headless on own
    servers with a stubbed Tauri host: products, tree, 53 inbox rows, section switch, project switch, chat, no page
    errors. Not verified: row click to an open comment in the browser (all comments resolved), real frames in the
    shell, Studio on :4402 (Tom's check).
  - Impl Q6 items 1 and 2 as built (`1d0baf663`, `4584c898f`, docs `9065c15e5`): plain `design check` always runs
    the completeness draw and lists missing states, contrasts and `CANNOT DRAW` lines; `--complete` is a no-op and
    left the help. `check` and `ready` print `WARNING STALE BUILD <lib>` when `libs/<name>/src` is newer than
    `dist/libs/<name>`, for the render libs and their `@ethlete/*` deps (13 ms). Verified: design specs 1126 of
    1126, both new specs fail without the fix, tsc, eslint; `check --product studio` 6:28 against 4:22 before, same
    output as the old `--complete`. Not verified: the stale warning on the real checkout (all builds were fresh).
  - Impl Q10 as built (`07ff69494`): hover and active rules use `:not([disabled], [aria-disabled='true'])` in the
    button, properties-styles and icon-button CSS (this clears button, carousel, copy-button, pagination, scrollable
    and toolbar), the calendar nav buttons and the chip (`[data-disabled]`, remove button), and in the sdk design part
    `button.css`. `design check --product sdk`: 48 `DISABLED-INTERACTION` findings before, 0 after. Verified: build
    and lint of components. Not verified: components specs, a visual check; `fab` and `text-button` have the same
    unguarded pattern but the check does not flag them.
  - In progress (builder ethlete-sdk-cf, 2026-11-01), in parallel: Impl Q19 and Q20 inbox load states and scroll;
    Impl Q24 clean count (cli).
  - Impl Q19 and Q20 as built (`af2f464ea`, `d86590c14`, `6291165b5`, `27047beb9`, `6ad063d82`): `pages/inbox` has
    the new states `loading`, `load-error` (error icon, "Erneut laden" button, control `retry`) and `long-list` (16
    rows); the list is `overflow-auto`; go `--by tom`. `InboxComponent` takes `load` and emits `retry`; `system-view`
    maps `commentStore.loaded()`, `loadError()` and `retry()`. The error text is fixed, not the real message.
    Verified: compare `pages/inbox` 0 px in 10 of 10, `elements/shell-main` 15 of 15; `task --verify` recorded the
    inbox (hash `70d2d0c3f68b5b46`); a fetch-fail-retry spec; system-view specs 214; eslint, tsc, app classes. Not
    verified: the scroll in a browser, Studio on :4402, the full app suite. `task --verify` refuses a commit that
    also touches files outside the part, so a part commit and its live wiring go in separate commits.
  - In progress (builder ethlete-sdk-cf, 2026-11-01): Q251 rest of the Studio parts. Wave 1: `components/tree-row`;
    `components/canvas-viewport`, `zoom-chip` and `comment-pin` (one subagent, shared `design-canvas`).
    Wave 2 (go for 7 parts in `8ebd3a1ee`, Impl Q27): `shell-collapse`, `shell-project-option`,
    `shell-project-switch` (swap into shell-main); `disclosure`, `studio-menu` (components only, live swap in the page
    slices). Next: `elements/part-tree` (after tree-row), `elements/canvas-frames` (after the canvas parts), then the
    pages `system`, `sketches`, `merge`, `flows`, `inventory`, `start`. Q24 count (`fe709f9d8`, not pushed) widened
    `PARTS` to base parts (34 of 81); the builder recommends a revert and a separate `DONE studio: n of 26` line,
    decision open with the grill session.
  - Wave 3, as built (builder ethlete-sdk-cf, 2026-11-01): ready and implemented: comment-pin, zoom-chip,
    canvas-viewport (`f7141dd6e`), disclosure (`f2031f2c4`, record in a later commit), tree-row (`be0206317`, verified
    against `3aa01050e` because the Q42 commit touches `i18n/`), canvas-frames (`c74b9608c`, `34df339ec` Q33 logos,
    `e6d93a870`, `49fda04da` Q47, `bc111d04e`). Built, not verified: part-tree (`8da3cfbcf`, `af588a176`; blocked by
    the tree-row design row without `role="treeitem"`), studio-menu (`d7824be48`, `6604aeaea`, `fd93d9b24`, accept
    `6bec961b2`; 103-1143 px left on cli gaps (i) and (j)), shell-project-switch (Q35, Q36, Q44 `ba55326cf`; open states
    blocked by cli gap (k)). Live: tree-row in `system-view` (`110fa072b`, Q39), German labels from
    `apps/ethlete-studio/src/app/i18n/studio-labels.ts` (`6eda5ac12`, Q42). cli: `9b0ad6972` gaps (d)-(f),
    `38fed0efd` gap (g). Verified per part with compare 0 px and `task --verify`; not verified: Studio in a browser.
    Timetrack: `d64222269` key export/import (Cargo example `store-key`), proven on Linux, not on Windows.
  - Canvas parts, partial (`817d09b9b`, `752623638`, `249d2ab66`, `3c510d2bd`, `98f24fcec`): `ZoomChipComponent` and
    `CommentPinComponent` in `design-parts/`, links and go (Impl Q28); the live canvas draws the zoom chip, not yet the
    pin. Nothing recorded: zoom-chip `out` 0 px, `reset`/`in`/`fit` fail on size rounding (173 vs 174 px), its 12
    forced states need `aria-label`s in the design; comment-pin 16 of 40 states 0 px, 24 count states fail on the
    clipped badge, 2 `*-active` on forced active without hover. canvas-viewport not started: its design draws a
    sample frame not from props. Tool gaps (a) rounding, (b) overflow, (c) active+hover in a cli slice; design
    questions with the grill session.
  - Disclosure and studio-menu, partial (`ed94b5129`, `071105769`, `b81ab2e15`, `a1cdd6b31`): components in
    `design-parts/`, links and go; no live swap (live users: `sketch-view.component.ts:212`,
    `exception-list.component.ts:20`, the studio slot of inbox and shell-main). Nothing recorded. Queued cli gaps:
    (d) the pointer starts at (0,0) and hovers a part drawn top-left in rest states (move it off the page after
    fonts load); (e) a forced interaction falls back to the element text and searches the whole page (portaled
    overlays); (f) the pointer-open "from" state skips states with an `interaction`. With d-f patched locally,
    disclosure was 0 px in 12 of 12; then `task --verify 071105769`. studio-menu open states ~52k px: the design
    draws the panel without the overlay pane (base surface, not elevated); decision open with the grill session.
  - shell-collapse as built (`bdce4d13c`, `a7d9d5a47`, `4c03c7364`, `a8a74c218`, `f963b88aa`, `7cf4bd69e`, swap
    `ce271784b`): compare 4 of 4 at 0 px, recorded; shell-main draws it (shell-main 15 of 15, inbox 10 of 10 at
    0 px). A component drawn in a padded wrapper carries the padding on its host, no host background.
    `task --verify` also refuses the design link file: commit component and changeset alone, the link separately.
  - shell-project-switch, partial (`836113a8a`, `a0a86e3a9`, `e826d1ebc`, `da2823183`, `0005e8aca`): `closed` 0 px;
    `open` 1144 px (the component owns the menu, the design draws the trigger only); forced states wait on gap (e).
    shell-project-option not built: no part draws its custom row; shell-main uses SDK radio items. Both are design
    questions with the grill session.
  - tree-row, partial (`3aa01050e` part, `c8f5b61bc` link and go): `TreeRowComponent` and `TreeRowItemComponent`
    in `design-parts/tree-row/`. Real compare: 8 states 0 px, 5 states 1 px wide (gap a), 40 forced states wait on
    gap (e); with both patched locally 53 of 53 were 0 px. No live swap yet: the live badges `from base`,
    `overridden`, `changed`, `merging`, `question`/`answered`, `transferred` and the kit count have no design mark;
    decision open with the grill session.
  - In progress (builder ethlete-sdk-cf, 2026-11-01, wave 4), six parallel subagents: part fixes (studio-menu Q51,
    shell-project-switch Q52 design + cli harness room above, shell-main go, agent-logos accept Q33); pages
    `system` with the part-tree and canvas-frames (Q32) live swaps; `sketches` + `merge`; `flows`; `inventory`;
    `start`.
  - Impl Q29 as built (`dbc0eda7d` revert, `aae8c5d4c`): `design check` prints `DONE <product>: n of m` after the
    unchanged `PARTS` line, over own parts: `implemented.json` hash equals the `go.json` hash and the ready mark
    holds (`doneParts` in `part-task.ts`). Studio today: `DONE studio: 0 of 26` ; the ready marks of inbox and shell-collapse were stale and shell-main had none. After `task --verify` the builder runs `design ready --by <model id>`: `5e2743fd1` marked all three, so DONE should be 3 of 26 (not re-run). Verified: specs, tsc, eslint, a real studio check. Not verified:
    the full cli design folder after the last helper fix.

3. Not started: the list on the part in Studio, and `sketch ready` / part ready refused while the list is not empty.
4. Last: point 5, open plan questions that name the part.

Archived: Go, task and compare decisions (2026-10-31), see [findings-2026-10](archive/findings-2026-10.md).

Archived: Implementation phase decisions (2026-11-01), see [findings-2026-11](archive/findings-2026-11.md).

Archived: Impl findings: system lessons (2026-11-01), see [findings-2026-11](archive/findings-2026-11.md).

Archived: Exit the fix loop decisions (2026-11-01), see [findings-2026-11](archive/findings-2026-11.md).

Archived: Title bar, search and activity decisions (2026-11-01), see [findings-2026-11](archive/findings-2026-11.md).

Archived: Handoff restart decisions (2026-11-01), see [findings-2026-11](archive/findings-2026-11.md).

Archived: Sidebar header and switch decisions (2026-11-01), see [findings-2026-11](archive/findings-2026-11.md).

Archived: Project switch focus row decision (2026-11-01), see [findings-2026-11](archive/findings-2026-11.md).

Archived: One-click accept and go decision (2026-11-01), see [findings-2026-11](archive/findings-2026-11.md).

Archived: System fit state decision (2026-11-01), see [findings-2026-11](archive/findings-2026-11.md).

Archived: Go order and stale go decisions (2026-11-01), see [findings-2026-11](archive/findings-2026-11.md).

Archived: CLI speed decision (2026-11-02), see [findings-2026-11](archive/findings-2026-11.md).

Archived: Sketch in context decisions (2026-11-02), see [findings-2026-11](archive/findings-2026-11.md).

Archived: Visible change gate and no-memory decisions (2026-11-02), see [findings-2026-11](archive/findings-2026-11.md).

Archived: Title bar and refused-action decisions (2026-11-02), see [findings-2026-11](archive/findings-2026-11.md).

Archived: Pick and merge decisions (2026-11-02), see [findings-2026-11](archive/findings-2026-11.md).

Archived: Title bar implementation decisions (2026-11-02), see [findings-2026-11](archive/findings-2026-11.md).

Archived: Title bar search and gate decisions (2026-11-02), see [findings-2026-11](archive/findings-2026-11.md).

Archived: Update dialog and merge commit decisions (2026-11-02), see [findings-2026-11](archive/findings-2026-11.md).

Archived: Sketch view states decision (2026-11-02), see [findings-2026-11](archive/findings-2026-11.md).

Archived: Post-MVP tool fixes (2026-11-02), see [findings-2026-11](archive/findings-2026-11.md).

Archived: Builder wave (2026-11-02), see [findings-2026-11](archive/findings-2026-11.md).

Archived: Rule audit decisions (2026-11-02), see [findings-2026-11](archive/findings-2026-11.md).

Archived: Sketches zoom label decisions (2026-11-02), see [findings-2026-11](archive/findings-2026-11.md).

Archived: Sketches view real-data layout decisions (2026-11-02), see [findings-2026-11](archive/findings-2026-11.md).

Archived: Sketches matrix and state name decisions (2026-11-02), see [findings-2026-11](archive/findings-2026-11.md).

### Shell rail buttons decisions (Tom, 2026-11-02)

- elements/shell-main rail buttons (section, product): own control parts `components/shell-section` and
  `components/shell-product`, today's look unchanged. The sketch round r1 is withdrawn: Tom clicks "Verwerfen" on
  the elements/shell-main sketch himself. The builder extracts both parts without a sketch round, draws only their
  missing interaction states (rest, hover, pressed, focus-visible; active for section), links them, and Tom gives
  each part its go. Reason: variant a (forced plain SDK buttons) looked as bad as expected, and variant b changes no
  pixel, so there was no choice to make.
- CONTROL-STATE sketches (replaces decision 11 "two variants: unchanged SDK button + own part"): the plain-SDK
  variant is drawn only when the SDK button reaches today's look with its own variants and tokens. Otherwise the
  agent extracts the own control part directly, with no sketch, and writes a one-line reason why the SDK button does
  not fit; the doc agent reviews the reason. Tool fix (B119): the CONTROL-STATE hint text says this; extracting a
  part without a visual change needs no sketch round (`sketch ready` already refuses a pixel-identical round), and the
  extraction records the "SDK does not fit" reason where `design check` can see it is present.

Archived: Findings 224-239 (2026-11-02), see [findings-2026-11](archive/findings-2026-11.md).

Archived: Findings 253-262 (2026-11-03), see [findings-2026-11](archive/findings-2026-11.md).

Archived: Findings 263-339 (2026-11-10), see [findings-2026-11](archive/findings-2026-11.md).

Archived: Findings 340-414 (2026-11-10), see [findings-2026-11](archive/findings-2026-11.md).

415\. Builder (2026-11-04, port of Tom's pick a of pages/sketches, e0f6a4396): `sketch report` refuses on a picked
sketch even with `--reopen` ("is decided (pick) - a report would reopen it"), so the rule "report before a variant edit"
cannot be followed for a port. Why no tool caught it: no test covers a report on a decided sketch. Fix (B342): a report
on the picked variant of a decided sketch is allowed and keeps the decision.

416\. Builder (2026-11-04, same port): `rebase --ported` marks every variant ported, also the unported b and c; only
`sketch check` noticed (STATES errors). The same port also hit finding 404 a second time (`sketch-rows.ts`, identical
change on both sides). Why no tool caught it: `--ported` takes no variant and checks nothing. Fix (B344): `--ported
<variant>`, or a refusal while an unported variant still conflicts, unless it is withdrawn or the sketch is picked.

417\. Mac perf session (2026-11-04, B348, built Studio, pages/sketches with 100 cells, headless Chromium): zoom and pan
are not slow on the Mac (p95 24 ms, no long task). Opening the sketch is: first cell 5.5-5.9 s on the Mac, 1.9 s on the
desk, about 95 % server time. The page asks for `/__design/system` twice (4.0 s Mac / 1.3 s desk), and two
`/__design/stamp` calls queue behind the first. Likely cause: the system build runs synchronous on the server thread
(finding 409). Runs with the CDP profiler on are not valid as times (open 37 s, zoom p95 up to 225 ms on the Mac); use
them for attribution only. Why no tool caught it: no check counts the requests a page makes before its first content.
Fix (B350): one `/__design/system` request until the first cell, at most 300 ms on a warm server, and the
`/@vite/client` ping stays under 100 ms during the open.

418\. Mac perf session (2026-11-04, B348, headless WebKit 27.2 on the Mac, built Studio, pages/sketches with 100 cells):
zoom runs at about 20 fps in WebKit, the engine of the Mac app (frame interval p50 45-49 ms, p95 55-58 ms), and at
60 fps in Chromium on the same Mac (p50 16-17 ms). Pan is fine in WebKit (p95 19 ms), so the cost is per zoom step.
Likely cause, not profiled (WebKit has no CDP): each zoom step changes the scale, and WebKit re-rasterizes the 100
scaled cells on the main thread, plus layout reads per step (`holdAnchor` in `frame-zoom-viewport.ts`, `mountFit` in
`sketch-rows.ts`). WebKit has no Long Tasks API, so a budget must use frame intervals. Why no tool caught it: every
perf check runs in Chromium, the engine Tom's desk e2e uses, not in the engine of the shipped app. Fix (B356): a
WebKit zoom budget on this fixture (rAF frame interval over 90 wheel-zoom steps, p50 at most 20 ms, p95 at most
33 ms) on a CI image with the WebKit libs (Fedora lacks them without sudo), and the zoom fixed to meet it.

424\. Builder (2026-11-04, port-mark sketch `pages/sketches@merge-port`): ADR 0183 says the same state of the same
variant carries the same sample marks in every page state. After B357, `narrow-part` and `comparing-narrow` still mark
the fit-* states of variant a as changed. Why no tool caught it: the sketch check does not compare the marks of one
variant state across the page states of a design. Fix (B363): a sketch check rule that warns when the same variant
state carries different sample marks in two page states. B357 stays open until all page states match.

426\. Grill (2026-11-04): `pages/sketches@merge-port` shows "Wartet auf deine Wahl", but the builder plans to align the
sample marks of `narrow-part` and `comparing-narrow` after Tom's pick (finding 424). A sketch is ready only when no
change to it waits (rule "ready means final"). Why no tool caught it: `sketch ready` does not run the sample-mark rule.
Fix: the B363 rule runs in `sketch ready` and blocks there, not only as a warning in the sketch check.

427\. Tom (2026-11-04): "die sidebar/exporer frisst nun irgendwie auch mouse wheel events oft. man scrollt und es
passiert nichts und dann auf einmal scrollt er dann doch". The explorer in the sidebar often ignores the mouse wheel
for a moment and then scrolls late. "nun" points to a recent change. Tom, with a screenshot of the tree item
`title-search`: "der innere bereich eines tree items scheint die events zu fressen". The wheel fails over the inner
(highlighted) box of a tree item, not over the gap between items. Cause not yet known (asked the builder, with a
check of the wheel shields from finding 393 and of main-thread stalls such as B317). Why no tool caught it, and the
fix: pending the cause.

As built (B364, 2026-11-07): a3b204c2d already made `designSketch` end every usage error with exit 2 (non-zero) and added `sketch-usage-exit.spec.ts` (every writing subcommand without arguments and with only `--by`, `ready` without `--by`). This row adds `covers`, `list`/`check` with an unknown flag and an unknown subcommand to that spec. Exit 2 stays (the other design commands use it for usage errors), not 1. Not verified: the compiled `et` binary's process exit code.

430\. Tom (2026-11-04): "das wir nun ständig die frames 'laden' die im viewport sind ist super nervig. ständig
verschwindet das bild und kommt wieder beim scrollen. man scrollt wie durch so ein laggy netscape browser window wo
gerade 17kb an bild übers modem laden müssen." When a frame scrolls into the viewport, its picture is gone and then
appears again. Probable cause (builder, code read; B365 measures it): b9367d285, refined by 52d7d2b55. The sketch view
renders a live iframe for at most 6 near shots, an `<img>` for other shots within 400 px of the viewport, and nothing
farther away. Two paths blank a frame on scroll: a shot leaves the 400 px margin and its `<img>` is removed, so on
return it is empty until it decodes; or the live set follows the near set, so a shot flips from `<img>` to a new
iframe that is blank until its document loads. Why no tool caught it: the canvas e2e specs check frame count, marks
and the live cap on a still view; none scrolls. Fix (B365): an e2e that scrolls a long sketch step by step and fails
on any cell that had a picture or a loaded frame before and now shows neither. App: keep the last picture under a
frame until its iframe reports loaded, and keep a far shot's picture instead of removing it.

431\. Tom (2026-11-04, `pages/sketches@merge-port`): "ich seh da zudem keinen unterschied zwischen a und b. ich glaub b
hat a übernommen und nur noch mehr states hinzugefügt oder? das erklärt so einiges". Facts (builder, live listing): the
sketch has one variant; the columns are "Aktuell" and "Variante a". 16 of 30 states fold; 14 differ: the 2 new port
states, and 12 states whose only change is three dimmed "unverändert" sample cells. Three causes: (1) a changed state
shows whole at fit (about 24 %), so a change in three 3 px cells is invisible; (2) at fit the state names (13 px ×
zoom, about 3 px) hide below the 9 px floor, so no row tells which state it is, while the column heads keep a 12 px
floor; (3) every frame draws the sample Sketches page, whose own rows read "Aktuell", "Variante a", "Variante b", the
same words as the real columns. Why no tool caught it: no check measures whether a change is readable at the zoom the
view opens with, and no check flags sample text that repeats the live chrome around it. Fix: (1) B345 (cut-out of the
change, check "change readable on open"); (2) B346: the state name keeps a floor like the column heads; (3) the B346
sketch gives the sample other variant names (Tom picks), and B362 gets a rule that a part which draws the tool itself
uses sample labels that differ from the live chrome.

As built (B362, 2026-11-07): tool side only, no design and no app change. A part declares `coverage` (`PartCoverage`,
`define-part.ts`): `branches` (per layout branch the real widest and tallest input and the sample size each state
draws), `zoom` (extremes, and per status the state at each extreme), `async` (per async mark the state that draws it
unknown, or `null`) and `chrome` (live chrome labels). `design check` warns `COVERAGE-RANGE`, `COVERAGE-ZOOM`,
`COVERAGE-ASYNC`, `SAMPLE-CHROME` (text or `alt`/`aria-label`/`title` inside a `data-et-sample` region repeats a chrome
label) and, for every part, `STATUS-TWICE` (the same `data-et-status` twice in one `data-et-view` region)
(`rules/design-coverage.ts`, loads only parts whose source has `coverage:` or `data-et-status`). Verified: spec
(9 cases); a temporary `coverage` on `pages/sketches` (not committed) made `design check --part pages/sketches` print
3 COVERAGE-RANGE, 6 COVERAGE-ZOOM and 1 COVERAGE-ASYNC warnings. New e2e case "a sketch keeps its frame count and
pictures from the first paint through a sketch edit" (Sketches/Large): fails when the `[data-shot]` count at the first
paint differs from the settled one, or changes, or a pictured visible cell goes blank in the 10 s after a variant CSS
edit. The case did not run: the Studio build of this branch fails (TS2322, `ThemeSwitch[]`, not in this
change), so neither its pass nor its bite is proved; it is expected red until B345. Not done: `pages/sketches` carries no `coverage` yet and marks no `data-et-status`/`data-et-view`/`data-et-sample`,
so the rules do not bite on it until B346 adds them (gaps: tall page sample in the matrix branch, status × below-fit /
far-out, `changed` unknown, sample variant names "Aktuell"/"Variante a"/"Variante b", header status twice). The
`real` sizes are declared by hand, not read from the listing; the sample shots are pictures, so SAMPLE-CHROME sees
their labels only where the design marks a `data-et-sample` region with text or `alt`.

432\. Tom (2026-11-04, screenshot of `agent-failed` and `question-only` in `pages/sketches@merge-port`): "dann
funktioniert die unveränderte screens erkennung noch nicht korrekt. bzw screens wurden mixed". The compare itself is
right: in both states, "Aktuell" marks fit-hover, fit-active and fit-focus-visible of sample variant a as changed, and
"Variante a" marks them "unverändert" (the B357 change). But the "Aktuell" frame is cut at the left: the icon rail and
most of the explorer are missing, and the page starts about 180 px into the frame, while the "Variante a" frame shows
the whole page. Such a cut makes two shots look like different screens. Cause (builder, partly proved): the compare
saw the full pictures (both server shots 1440×900 from x=0), so the unchanged detection is right and nothing is mixed.
The cut is in the sketch view: `liveShotsOf` makes the first 6 near shots in listing order live iframes, and the
"Aktuell" row comes first. So in one state "Aktuell" was a live iframe and "Variante a" a picture, and the live
document was shifted left about 250 px (why is not proved: a scroll inside the iframe document, or an iframe narrower
than its frame). Why no tool caught it: the e2e checks the live frame count and the marks, never that a live frame
paints the same as its picture. Fix (B365): the e2e asserts for every live frame scrollLeft = scrollTop = 0 and iframe
width = frame width, and compares the live paint with its picture once ready. App: a live frame counts as ready (ADR 0186) only if it matches its picture, and the cells of one state never mix live and picture.

433\. Tom (2026-11-04, screenshot of `comparing-narrow` in `pages/sketches@merge-port`): "und hier? ist doch beides
gleich". In this state the sample shows "vergleicht …" and no marks at all, so the new sample marks never paint, and
"Aktuell" and "Variante a" look the same. Still the listing counts the state as changed (one of the 12 narrow states).
Cause (builder, pixel diff of the two server shots): the compare is right. 1358 pixels differ in a 575×45 px strip
(x 842-1416, y 371-415), the sample variant-a cells fit-hover, fit-active and fit-focus-visible. The sample applies
variant a's pill look only to its changed states (`cell()` in `shared/sketch-rows.ts`), so the B357 alignment
(6f4b45040) took the pill corners away with the mark. In a comparing state no marks paint, so only a corner radius
differs, invisible at 24 %. No compare fix. Fix (B345): the cut-out shows such a strip enlarged at fit, and the state
says why it changed when the diff is small (for example "1358 px in 3 Zellen").

434\. Tom (2026-11-04, merge of `pages/sketches@merge-port` variant a): "immer. wieder. fehler. beim. mergen." The check
after the merge failed with `TYPE-ERROR ... elements/variant-cell/variant-cell.ts:88:3 TS2353 'sample' does not exist
in type 'PartSource<...>'`; the product files rolled back and the sketch stayed. Cause (builder): the B363 subagent
edited product files (`variant-cell.ts`, both `shared/sketch-rows.ts`, a baseline in the ready `merge-port/sketch.json`)
without committing; its brief did not forbid it. The :4402 server runs `serve-committed`, so the merge check
type-checks with the committed CLI copy, whose `define-part` has no `sample`. `variant-cell` is not part of the merge,
so the check covers more than the merged files, and Tom's merge carried the blame for an agent's half edit. The
subagent's edits were intact; the builder saved them to `/tmp/b363-product/product.patch` and restored HEAD.
Why no tool caught it: the merge writes before it looks at the tree; nothing marks product edits outside the sketch;
the check reports any type error as a failed merge of the sketch. Tool fix (B366): (a) the merge refuses before it
writes anything when the product has uncommitted edits outside the sketch, and names the files; (b) a type error in a
file the merge did not change reads "product broken outside this sketch: <file>", not a failed merge; a spec for
each. Process: no agent edits product files under `.ethlete/design` while a sketch waits for Tom; every subagent
brief says so.

435\. Tom (2026-11-04, screenshot after merge aa8c96889): every frame, the sample too, shows the Vite overlay
`Failed to resolve import "@system/foundations/icons" from ".../components/tree-row/shared/tree-row.ts?design-product=studio&design-sketch=pages%2Fsketches%40merge-port&design-variant=a"`.
Tom guessed the parallel Studio build; it is not. Cause (builder, code read): the listing has no sketch any more, but
the frames still request the merged sketch. The server resolves imports of a module with `design-sketch=` through
`drawnOf` (`libs/cli/src/lib/design/system/system-modules.ts:94`); for a gone sketch it returns null and caches the
miss, so `@system/...` has no resolution. The sketch query spreads to product files, so every frame breaks. Probable,
not proved: Tom's view still held the sketch frames, and Vite HMR reloaded them with their old URLs after the merge.
Why no tool caught it: no spec or e2e requests a frame of a sketch after its merge or discard; the merge e2e ends at
the merge result. Tool fix (B367): (a) `drawnOf` resolves a gone sketch to the product, does not cache the miss, and
the frame shows a plain note instead of a Vite error; a spec. (b) Studio: when the open sketch drops from the
listing, the sketch view leaves it and drops the old frames; an e2e merges a fixture sketch with its view open and
asserts no error overlay and that the view leaves.

436\. Builder (2026-11-04): the handoff said "restart studio-serve" to load the B363 CLI, but :4402 runs inside Tom's
Studio app (pid 670846, parent `target/debug/ethlete-studio`) on the older copy `tmp/studio-cli/842fce846`; the tmux
session `studio-serve` does not own the port. Only the Studio command `design_server_restart` restarts it, and a kill
would leave Tom without a server. So the B363 product opt-in waits for Tom to press restart in Studio. Why no tool
caught it: nothing tells an agent who owns the design port or which CLI copy it serves. Tool fix (B368): `et design`
prints the serve state: the port owner (Studio app or terminal), the served CLI commit against HEAD, and how to
restart it.
As built (B368): `et design serve-state` (`serve-state.ts`) reads `/__design/stamp`; the server identity now carries
`owner` (studio or terminal) and `cliRoot`. The served build is compared with this checkout's cli by version and
build hash, not by commit; a Studio copy's folder (`tmp/studio-cli/<commit>`) shows in `cliRoot`. Not done: calling it
automatically from other commands.

437\. Tom (2026-11-04): "ich bekomm ihn nicht tot. ctrl c tut nichts" in the `nx tauri:dev ethlete-studio` terminal.
`target/debug/ethlete-studio` (pid 36678, 4 h old) was in state R; Tom ended it with `kill -TERM`. Cause (builder,
code read, not proved, no log): the host has no SIGINT or SIGTERM handler of its own; its only clean-up is
`RunEvent::Exit` (`apps/ethlete-studio/src-tauri/src/lib.rs:218`, `stop_every`). The design server runs in its own
process group (`design_server.rs:540`), so Ctrl+C never reaches it. Hypothesis: CEF's browser process turns
SIGINT/SIGTERM into a shutdown task on the UI thread; a spinning UI thread (state R, the stalls of finding 427) never
runs it. Why no tool caught it: no test sends a signal to the real host binary; the studio e2e harness stops only its
own group. Tool fix (B370): first prove it on a second debug instance (strace for signals, gdb main-thread stack, never
Tom's instance); a host e2e sends SIGINT to the debug binary and asserts exit and a free :4402 within 5 s, failing
today; the host installs its own SIGINT/SIGTERM handler that calls `app.exit(0)`, with a 5 s watchdog that runs
`stop_every` and exits; the B368 serve state shows the owner pid.

438\. Tom (2026-11-04): the system view reports SAMPLE_DEFAULT, UNBOUND-INPUT, and on "Produkt/studio" ("was auch immer
das ist") ORPHAN_ENDPOINT `design/stale-mocks`; "und vor allem; wieso hat er das nicht selbst entdeckt." Cause
(builder): all three are real; `design check --product studio` exits 1 on them since 2026-11-04 13:25.
SAMPLE-DEFAULT and UNBOUND-INPUT come from 4d78306ab: `system-page.component.ts:154` has
`exceptions = input(PART_EXCEPTIONS_SAMPLE)` and no template binds it, so the live open-points chip probably counts
sample exceptions. ORPHAN-ENDPOINT: 0f6e6682d removed the only caller of `/__design/stale-mocks` and kept the route.
"Produkt/studio" is a pseudo part for problems in app code outside any design part. Why no tool caught it: no slice
runs `design check --product <p>` at its end (CLI slices run tests, tsc, lint; product slices run compare; app slices
ran Angular specs only), and no gate reads the check. Tool fix (B372): every slice ends with `design check --product
<p>` and fails on any new problem, with the same list as the system view (builder-agent skill, every brief, pre-push
when `apps/ethlete-studio` or `.ethlete/design` change); the pseudo part reads as app code with the file of each
problem. Code fix (B372): bind `exceptions` to the real part exceptions or drop the input; remove the stale-mocks
route and its snapshot entry.

439\. Tom (2026-11-04): "der fortschritt ist echt wieder schleppend extrem. vielleicht auch wegen den e2e? unit test?
langsamen studio cli calls? eig müssten wir viel schneller sein auch mit einem builder agent". Measured (builder,
subagent tool timestamps): B366 454 s, of it tests 170 s and commit hook 198 s, model 78 s; B367a 546 s, of it tests
391 s (full `nx test cli` twice, bite runs, flake re-runs) and hook 100 s, model 52 s. About 80 % of a slice is test and
hook time, the model works 10-17 %. One slice runs the full cli suite 2 to 4 times: in the slice, in the bite proof and
in the `yarn commit` hook, which re-runs it when only a changeset or plan file changed. `design check --product studio`
took 664 s, `components/scheduler` alone 120 s (probably a render timeout). Not measured: subagent cold start and
coordination. Also, five of the six rows before B345 came from defects of the same evening. Why no tool caught it: no
tool reports where slice time goes. Tool fix (B374): during a slice only the touched spec files run (`vitest
related`), the full suite once per batch before a push; the commit hook's spec cache ignores `.changeset/` and
`plans/`; (B373) the flaky merge spec; (B375) the 120 s of `components/scheduler` in the design check.
Correction (builder): the hook already runs only `vitest related` plus a typecheck and skips plan and changeset
changes; the waste was the builder briefs that ran the full suite. Fixed in the builder-agent skill (c431d0e50), with
the B372 slice-end check rule. The ~100 s hook run itself is B376.

440\. Tom (2026-11-04): "The e2e run is still going; I'm waiting for the monitor notification before committing. es
ist extrem schleppend". The B367b subagent ran the full serial `yarn studio:e2e` (over 6.5 min) inside the slice.
Cause (builder): `canvas.e2e.mjs` already has `--case <text>`; the brief said "run all cases", written before
c431d0e50, so the filter went unused. Why no tool caught it: nothing tells a slice which e2e cases its change needs, and
the skill did not name the filter. Tool fix: the builder-agent skill names `--case` for a slice (builder, next commit);
parallel cases for the full suite are B377 (ADR 0191).

441\. B367b (3c67d2143, builder 2026-11-04): the two new e2e cases "Merge" and "Discard" pass, but they also pass on the
old view code, so they do not bite. Only the new vitest spec fails without the fix. Cause: part a (e459da21e, CLI) already
stops the overlay, and the e2e always runs the current CLI. Why no tool caught it: the bite rule covers specs, and the e2e
harness has no way to run a case against an old build. Tool fix (B378, builder default): for a bite run the harness takes
`STUDIO_CLI_ENTRY` from a CLI copy built before the fix, so a new e2e case must fail there first.
As built (B378): `yarn studio:e2e:bite <ref-before-the-fix> [--case Name]` (`tools/scripts/studio-e2e-bite.mjs`) builds the CLI of that ref in a temporary git worktree, runs `canvas.e2e.mjs` with `STUDIO_CLI_ENTRY` pointing at it, and exits 0 only if the e2e fails (the case bites). `canvas.e2e.mjs` and the headless harness already read `STUDIO_CLI_ENTRY`. Only the arg parsing and verdict are specced; the build and e2e run were not executed (load).

446\. Four migration generators have no `migrations.json` entry, so `et migrations` does not list them:
`@ethlete/query:migrate-from-ngrx-toolkit` (reported by the fifagg session, 475 files still on `@tomtomb/ngrx-toolkit`),
and in core `migrate-create-destroy`, `migrate-color-theme-variants`, `migrate-legacy-color-themes` (doc agent check,
2026-11-05). Why no tool caught it: nothing compares `generators.json` with `migrations.json`. Tool fix (B383, builder
default): a check in the pre-push Checks and in CI that fails when a generator is neither in `migrations.json` nor marked as a
scaffold generator in `generators.json`; its message names both ways out.

447\. The pre-commit gate blocks every commit that touches `tools/scripts` (ethlete-sdk-ff, 2026-11-05): it runs
`tools/scripts/e2e-check.spec.mjs` ("the result line carries the sha the suite ran at") in a `/tmp/pre-commit-*` copy
without `.git`, and the spec calls `git rev-parse` in `process.cwd()`. The spec passes in the repo. Why no tool caught it:
the spec was only run in the repo, never in the gate's copy. Tool fix (ethlete-sdk-ff, own commit before B383): the
gate passes the repo root by env var and the spec uses it; no skip, because a skip hides the spec in the gate.

448\. The pre-commit gate passed c874d9dd2, but its `color-theme-variants` entry broke the guard spec
`generator-requirements.spec.ts` (the generator imports `ts-morph` and the entry had no `requires`). Fixed in e02da0aaa;
ethlete-sdk-ff caught it with the whole cli update suite. Why no tool caught it: the gate picks related specs by import
graph, and a guard spec that reads `libs/*/migrations.json` does not import it. Tool fix (B386, builder default): the gate
maps data files (`migrations.json`, `generators.json`) to the specs that read them.
As built (B386): `libs/cli/related-map.json` already maps the data files; the gap was `lint:cli-related-map`, whose
source-path detection ignored `.json`. A spec that locates `migrations.json`/`generators.json` by path now needs a map entry too.

449\. After B372 (8f059ae72) the full `design check --product studio` still exits 1 after 605 s with about 800 render
problems (LOST-SURFACE in foundations/*, title-bar 265, shell-main 248, canvas-viewport SKIP-SCOPE 92, comment-pin
COVERED 52, DROPPED-PROP and more). The list was the same before B372. Why no tool caught it: the CI step refused early
on stale mocks, so the full check never ran to its end in CI, and no local gate runs it. Builder default 6915b243e: the
CI step "Static design rules" runs `--rules` only. Tool fix (B388): triage the render problems into real defects and
rule noise, fix both, then CI runs the full check again.

450\. The macOS branch of the machine-id fix f30bb3b81 broke on the second run: the id has hyphens and `${name#*-}`
cut only its first part, so the cache file became `<id>-C7CC-...-cache.db`. Found on ethlete-mac, fixed in c8d05a4a0,
re-run twice with a stable name (the same id Nx uses on the Mac). Why no tool caught it: the CI subagent tested the
awk on one sample line, not two runs with a real hyphenated id. Tool fix (B389, builder default): the builder skill
says a CI step that renames or caches is run twice with real data, on each OS it has a branch for.

451\. The `merge.spec.ts` flake (B373) has its cause: the check found the right TYPE-ERROR in `home.ts`, but tsc
printed the path inside ANSI colour codes, so merge did not see the file as "outside this sketch" and gave the
generic reason. Colour depends on the env of the test worker, so it failed only in the full `nx test cli` run (1 of
2553). The builder fixes it in product code (no colour in captured tsc output, match without ANSI) with a spec that
bites. Why no tool caught it: specs run tsc in a no-colour env when they run alone, and nothing asserts that captured
tool output is plain text. Tool fix (B390, builder default): every captured child-process output in `libs/cli` goes
through one helper that sets `NO_COLOR` and `--pretty false` and strips ANSI, with a spec that runs it under
`FORCE_COLOR=1`.

Fixed in 9d788d831: design typecheck runs tsc with `--pretty false`; a spec under `FORCE_COLOR=1` fails without the
fix, and the full `nx test cli` passed (2553). B373 is closed.

As built (B390, 2026-11-07): `libs/cli/src/lib/plain-output.ts` holds `stripAnsi`, `plainEnv` (`NO_COLOR=1`, `FORCE_COLOR=0`), `spawnPlain([cmd, ...args])` and `execPlain([cmd, ...args])` (utf8 capture, plain `stdout`/`stderr`, also on the thrown error). Migrated: design typecheck and `--lint` eslint, prettier (stdin format, which now also reports empty output as a failure; `sketch/check-format` and `sketch/merge`), the git wrappers (`api/git`, push-status, hooks-problem, sketch-command, merge-commit, update commits/packages), compose output and `ps`, API setup, migration scan, release capture and both harness build spawns. `--pretty false` stays at the tsc call. Spec `plain-output.spec.ts` runs under `FORCE_COLOR=1` and bites. Not migrated: inherit/ignore stdio spawns (nothing is captured), `sketch/rebase-port`, `edit-sketch`, `go-guard`, `slow-checks`, `part-task` and other `execFileSync('git', ...)` binary or buffer captures, and the doctor streamed check; no lint rule yet forbids a new raw capture.

452\. Two Studio e2e cases fail only in the full `yarn studio:e2e` run (112/114) and pass alone, also after other pages:
(1) Sketches "pan beyond every edge": the content grew taller while it panned. Likely cause, not verified: far frames
use a stored picture height, and the live iframe is taller. (2) Large "a variant equal to Aktuell keeps its iframes":
variant a got 0 iframes. Likely cause: `liveShotsOf` (`sketch-view.component.ts`) fills the cap of 6 live frames in
row order, Aktuell first, so cells near Aktuell starve variant a; under CPU load, a is also never folded as equal. Why
no tool caught it: no spec compares a stored picture height with the live height, and the `liveShotsOf` spec fixes
the starving order as expected. Tool fix (B391, builder default): fill the live-frame cap by distance to the view, a
spec that compares picture and live height, and a check of the fold-equal path under load.

453\. CI 42016914765: 5 scheduler cases in the component behavior tests time out or fail (drag, long-press drag, tap
opens the surface, no resize handles). Lead, not verified: the tooltip revert 40a92b60b put the scheduler back to the
native `title`, and the cases may depend on the tooltip markup. Cause: 80d8d2b8c (after the tooltip swap) moved 8
scheduler e2e locators from `[title=…]` to `[aria-label=…]`. The revert 40a92b60b brought back `[attr.title]` but did
not revert 80d8d2b8c, so the locators matched nothing. Fixed in aff13b991: the 8 locators are back to `[title=…]`,
exactly as before 80d8d2b8c; assertions unchanged. 45 scheduler cases pass, desktop and touch. Why no tool caught it:
the revert ran only unit specs, and the search for later commits looked only at the reverted files, while 80d8d2b8c
touched `apps/storybook-e2e`. Tool fix (B394, builder default): a revert also reverts or checks every later commit
that names the reverted change or matches its markup (grep the e2e for the attributes the revert removes), and
pre-push runs the behavior suites of the components whose files the pushed range changes.

As built (B394): `yarn revert:check <sha-to-revert> [head]` (`tools/scripts/revert-check.mjs`) lists the markup tokens
(aria-_, data-_, `[attr.x]`, `[x=...]` locators, `x="..."`) the commit touches and every later commit that names it or
changes a line with one of them, e2e specs included; prose files are skipped; exit 1 when any is found. Run on
e73234f6e..40a92b60b^ it lists 80d8d2b8c. Part 2 needed no hook: ADR 0225 moved slow checks out of pre-push, and CI
already runs the behavior suites of the changed components (`apps/storybook-e2e/affected.mjs`, the `e2e-selection`
step and three `storybook-e2e` shards in `ci.yml`), including a change that touches only an e2e folder.

454\. CI 42016914765, Studio rules: the `--slow` step finds that the direct-edit state of `pages/system` has no
"Gründe" trigger. Cause (the first lead, B372, was wrong): the design state draws the build-ready footer with a "Gründe"
disclosure since 2e70dc149 (merge pick a of the build-ready sketch, design files only). The app never had it; building
it is row B288. The slow gate compares only parts whose app files change, so it first ran when 8f059ae72 touched
`system-page.component.ts`. Every app commit on `pages/system` fails this way until the footer exists. Why no tool
caught it: no gate runs the slow compare when only the design side of a part changes. Tool fix (B393, builder
default): a design-only change to a part also runs the visible-change gate for that part, and a merge that adds a
state the app cannot drive (missing trigger) fails and names the app row to build.

As built (B393): a part with a record in `implemented.json` whose hash differs from its design hash gets the `COMPARE`
rule (`designOnly` in its slow inputs, so the design change already makes the cache stale). That run judges only the
states `shootStates` marks `undrivable`; a pixel difference is ignored, as the app is not yet rebuilt. A hit names the
state and the linked app component to build the trigger in. A part never implemented is not compared. Specs on fixtures
with fake runners in `slow-checks.spec.ts`; no real render ran.

455\. The grill session closed B377 in `STATUS.md`, but ADR 0192 still had `open: B377`. The pre-push check found it
only at push time, and the builder fixed it in de53d8571. Why no tool caught it earlier: the check that matches ADR
`open:` rows against `STATUS.md` runs at pre-push, not when a plan file is committed. Tool fix (B395, builder
default): run that check at commit time for commits that touch `STATUS.md` or an ADR, and the doc-agent skill says to
set `built: <sha>` in the same commit that closes a row.

As built (B395): `.husky/pre-commit` runs `check-studio-adrs.mjs` (about 0.7 s) when `STATUS.md` or an ADR file is
staged; it checks the working tree, like the pre-push gate. The doc-agent skill carries the `built:` rule. A spec
pins the hook wiring.

456\. B388 triage of the full studio check (798 problems, 10:46 min): the check renders each part in light and dark
and does not de-duplicate render problems across the schemes, so the count doubles (about 412 real). Why no tool
caught it: no spec renders one part with a problem in both schemes and counts the result. Tool fix (in B388, builder
default): de-duplicate per scheme at `render-check.ts:982`, with that spec.

457\. Rule noise in the same run: 133 LOST-SURFACE because `edged()` (`surface-nesting.ts:30`) takes a one-side
`border-b` for a card edge (title-bar root on every shell page); 81 SKIP-SCOPE from 5 skip sites, repeated per state;
COVERED without exemptions for `aria-hidden` decoration and an open layer over its anchor; 15 LOST-SURFACE from the
CLI's own token and icon sheets; SDK CONTROL-STATE lines print without a prefix. Why no tool caught it: CI never ran
the full render rules (finding 449), so nobody saw the noise. Tool fixes (in B388, builder default): one-side borders
are no edge, report SKIP-SCOPE once per part and path, the two COVERED exemptions, no redundant `var(--surface)` fill
in the CLI sheets, a HINT prefix for CONTROL-STATE. 27 DROPPED-PROP (missing app inputs) stay a CI warning until the
inputs exist. 96 LOST-SURFACE are real: the floating side panel `aside.st-shell-side` and the comment-draft popover
have the canvas fill and no visible shadow; the builder sends both to Tom as sketches.

458\. `sketch ready` checked for a dirty product after `swap()` and returned without a restore. A foreign uncommitted
`go.json` therefore left `components/comment-pin` half-swapped, and every part that uses it broke (a builder subagent
restored it with `git checkout`). Why no tool caught it: the old spec used variant files equal to the product, so a
swap without a restore left no trace. Tool fix (builder, c465c3a75): the guard runs before the swap and ignores the
decision files; two specs with variant files that differ from the product fail without the fix.

459\. `sketch new` copies a part without a rewrite of relative imports that leave the part folder, so the copy of
`agent-logos` fails with an IMPORT error on `../../apps/...`. It holds four sketches (elements-canvas-frames,
pages-sketches, pages-merge, foundations-colors.foundations-check-fixes), together with two more CLI gaps: SKIP-SCOPE
does not ignore `[inert]` (CUT-CONTROL does), and CLIPPED fires on a pan viewport. Fixes (builder, each spec fails without it): c649a9d08 SKIP-SCOPE counts only controls outside `[inert]`; 09953108c
`sketch new` rebases relative imports that leave the part and merge rebases them back; f0d66e7bd CLIPPED does not
report a ring cut at the edge of a pan or scroll container on its pan axis (a ring cut by a box that fits its content
still reports, spec `ring-fits`; a container skip was rejected because it hides focus rings). Why no tool caught it:
the SKIP-SCOPE spec had no inert fixture, and CUT-CONTROL had its own inert exemption with no shared helper, so the
two rules drifted; the sketch specs used only parts with `@shared` imports and no spec ran new, check and ready on a
part that imports out of itself; no fixture had a pan container, and the full check never ran to its end in CI
(finding 449). Tool fixes (builder default): one shared "reachable controls" helper for every render rule; a
round-trip spec over every import form.

460\. CLIPPED measured a scaled child at its full `scrollWidth`, ignored `overflow-clip-margin`, and reported the
content of grab-to-pan and translated pan boxes. Why no tool caught it: every part had a broad CLIPPED skip, so the
rule never ran there. A broad skip hides the rule's own false positives. Tool fix (builder, 9980d1092): measure the
scaled and panned content and the clip margin; the spec fails without it. The broad skips in canvas frames and the
Sketches page shrank to the loading badge, the gutter and far-out pins (491a945e8, 9bf563df5).

461\. DENIED-CLASS checked the sketch copy of a foundations part, but the product check exempts `foundations/`. The
two checks gave different results for the same file. Why no tool caught it: no sketch targeted a foundations part
before, and the sketch check and the product check keep their own path exemptions. Tool fix (builder, 8ce03448c): the
sketch copy of a foundations part is exempt too; the spec fails without it.

462\. The `/__design/shot` route on :4402 returns 500 with "dist/libs/query missing, run `nx build query`" for
`elements-shell-main` and `pages-merge`, but `dist/libs/query/package.json` exists (rebuilt 14:21). The builder could not
review those two sketches before Tom's pick. Cause: a render ran at 14:21 while another session rebuilt the SDK libs
(core was back, query not yet). The render worker kept the failure (a rejected `angular ??=` promise in
`render-worker.ts` and Node's module cache), and the host replaces the worker only when a watched file changes; a
missing build was never watched. Every Angular render failed from then on, also on Tom's live canvas. Why no tool
caught it: the specs cover `entryOf` alone, not a long-lived worker that fails and then sees the build appear, and no
health check tells a persistent render failure from one that clears. Tool fix (builder, d7fc506b1): a missing build
is watched (-1), so the worker restarts when the build appears; the spec fails without it. Tom's server runs a frozen
CLI copy and gets the fix at its next restart; the builder unblocked it with a `touch` on the core build.
(`scheme=light` returning the dark picture is no defect: Studio has no light CSS.)

463\. `/__design/shot` with `&sketch=<target>` and no `&variant=` silently returns the product picture. The first shot
review of `pages-merge` compared the product with itself. Why no tool caught it: the route has no error for a sketch
that has variants and names none. Tool fix (builder, 9caf87997): the route answers 400 for a sketch without a known variant (before: 404 for an
unknown one).

464\. LOST-SURFACE compares only `background-color`. The `mg-shot` fill in `pages-merge` sits over the canvas dot
pattern (`background-image`), so the rule called it redundant; without it the dots show through the shot boxes (states
open and added, diff 1080x500 px). The sketch is withdrawn. Why no tool caught it: the rule has no fixture with a
patterned parent, and the auto-merge refused only on the pixel diff, which nobody looked at before the sketch was
marked ready. Tool fix (builder default): a fill over a patterned parent is a real surface, with that fixture; re-run
`elements-shell-main`, which sits on the same canvas. Process lesson: a sketch with a pixel diff is ready only after
its shot is looked at.
Built (builder): ca3f6804c, LOST-SURFACE skips a card over a patterned backdrop (an ancestor, or a sibling under the
card centre through `elementsFromPoint`); the sketch is discarded (aa17e7815). Built (65ee4694c): `sketch ready` refuses with
SHOT-NOT-VIEWED while a live variant draws a pixel diff and no shot of it was fetched since its last edit (views per
checkout in `node_modules/.design-explore/viewed-shots/`, by `design shot --variants` or `/__design/shot` with sketch
and variant). A look through Tom's :4402 server records nothing until it runs this build.

465\. `sketch check` prints no `before` lines, so it does not show if the product part itself still has the problem
the sketch should fix. For `elements-shell-main` and `components-comment-draft` no variant shows LOST-SURFACE, but
whether the product aside still trips the rule after ca3f6804c is unknown until a full run. Why no tool caught it: the
sketch check reports only the variants. Tool fix (builder default, open): the sketch check also checks the product
part and prints its problems as `before` lines.
Built (builder, 8d5c00594); verified on the foundations sketch, where the `before` lines showed all three product
problems and the variant none.

466\. The auto-merge diff counts sub-visible anti-alias noise as a picture change. `pages/system@check-fixes` drops
a fill that looks the same (bbox 287x29 px, 0 pixels with a channel delta over 8), but it cannot auto-merge. Why no
tool caught it: the diff has no tolerance, and no spec covers an anti-alias change on a rounded border. Tool fix
(builder default): a pixel counts as changed only above a small channel tolerance (for example 8 of 255), with that
spec.

467\. The pre-commit spec run for 65ee4694c reported 1 failure in `embedded-actions.spec.ts`, but the commit passed.
Why no tool caught it: the hook does not fail the commit on a failed spec (cause to confirm by the builder). Cause (builder): the spec timed out under load (5000 ms), and the hook re-ran it alone
(1003 ms, passed) as designed; a real failure always failed the commit, but the output showed only the first summary.
Fix 9e1a7b94a: the hook prints "<spec> passed when re-run alone".

468\. Decision files changed with no human decision. Uncommitted: a ready mark for `components/canvas-viewport` in
`ready.json` (15:54), a `decision: pick a` with no `by` in the sketch `foundations-colors.foundations-check-fixes`
(14:58Z), hash refreshes in `go.json` (12:24) and `pictures.json` (15:44). Tom: "weder noch" - he marked nothing
ready and picked nothing; he pressed go once by mistake much earlier. No agent says it wrote them. Why no tool caught
it: open - the builder finds the writer of each file. Tool fix (builder default once the cause is known): only a
human action writes a pick or a ready mark, each carries `by`, and a tool write without `by` is refused.
Tom's merge of `components-comment-draft` was then refused ("studio has uncommitted edits outside
components/comment-draft") by these files: the merge guard treats `go.json`, `pictures.json` and `ready.json` as
product edits. The doc agent saved them to `/tmp/finding-468/` and restored them to HEAD (Tom's merge needed it).
First cause (builder): the sketch decision came from the old builder's `sketch merge ... --variant a` at 14:58:48Z;
merge with `--variant` writes the pick, then the dirty-file guard refused and the pick stayed. Same class as
baa5b8810 (a refused auto-merge left a pick; now restored on refusal). Studio's pick route also writes no `by`
(`studio-api.ts` `sketchDecisionAnswer`), so "no `by`" does not mean "no human". Other three files: open.
Leads (builder, not verified): the changed `go.json` entries carry `at` 11:24:48Z, when the builder ran
`yarn studio:e2e` and `nx test cli`, so a test run may write `go.json` in the real repo. The `canvas-viewport` ready
mark (14:53:59Z) matches no agent CLI call in any session log, so the Studio server or the app may have written it.
`pictures.json`: not checked yet.
As built (B407): `WriteOrigin` (`by`, `cmd`, `pid`, `system/write-origin.ts`) is required by `writePartRecord`, `markPartReady`
and `decideSketch` (pick, discard); a write without `by` is refused (400 / a problem string) and writes nothing. `et design ready`
needs `--by`; the Studio pick route signs `designer`; `design check` records sign `et design check`. Not covered:
`go.json` and `pictures.json` writers (cause still open).

469\. A Studio merge leaves its result uncommitted. After Tom merged `components-comment-draft`, its
`comment-draft.ts` edit blocked his next merge (`components/title-bar@notice-shape`) with the same guard. Tom:
"mergen wird langsam echt witzlos". Builder: Studio left both merges half done (part files swapped, no `merged.json` entry, sketch folders still
there); it reset them and re-ran them with the CLI `sketch merge`. Why no tool caught it: the guard was tested one
merge at a time, never two merges in a row, and no spec checks that a Studio merge completes. Tool fix (builder default): a merge commits its own result, or the guard ignores the files of earlier
picks; a spec runs two merges in a row.
Shas: 48fcbae1b (comment-draft, pick `raised`), 066f1514b (title-bar@notice-shape, pick `no-pill`), both through the
CLI. Studio's half merge deleted `components/title-bar/shared/chrome.ts`; the CLI merge keeps it, so the :4402 server
may run an older CLI copy (not verified). Cause lead (not verified): in `merge.ts` the swap runs at line 293 and only a
check failure restores (line 327); an exception between the swap and `recordMerged` (line 361) leaves the files
swapped, with no `merged.json` entry and the sketch folder still there. Next: the Studio server log of 15:36-15:38Z.
State (builder, paused for CI): the :4402 server runs the old CLI copy `tmp/studio-cli/9d788d831` (without c465c3a75
and 09953108c). Its stderr goes to a pipe of the Tauri app, and `serve.ts` turns a throw into a 500 and logs nothing,
so no server log exists. Second tool gap: a Studio server error leaves no trace. In `/tmp/b469` the old copy restored
correctly on a failed check; a throw after the swap stays the lead, repro not done.

470\. CI on `next` stayed red from 2026-11-04 15:23 to the evening of 2026-11-05, and 92 commits stayed unpushed. The
Studio rules job failed: `pages/system` state `direct-edit` was unjudged, because the gate clicks the "Gründe" trigger
and the app had no footer. Tom: "die ci ist NOCH IMMER rot?" - a release waits. Why no tool caught it: the slow gate
checks only parts whose app files change (B393), so the local hook never ran `pages/system`; `clickOpen` did not
search overlay roots (fixed in 5f105b30d with the footer). Process lesson: a red CI on `next` stops all finding work
until it is green; the doc agent checks `gh run list` at session start and reports a red run to Tom at once.

471\. Sessions in tmux do not clear and restart themselves. They ask Tom to run `/clear` or `/handoff`, though the
`ethlete-agent-sessions` `restart` command clears the caller's own session and types a resume prompt. Tom: "viele
sessions checken noch nicht dass sie in tmux mit agent sessions skill sind selbst clearen und neustarten können das
nervt". Why no tool caught it: the context-warning hook (`libs/agent-rules/content/hooks/context-warning.py`,
`act_now`, `recommend`) tells the agent to "recommend the user run /handoff" and never checks `$TMUX_PANE` or the
skill. Tool fix (builder default): when `$TMUX_PANE` is set and the agent-sessions skill is installed, the hook text
says: save the handoff, then run `agent-sessions.mjs restart <own name> "/handoff resume"` yourself, end the turn,
never ask the user to clear; the skill description names self-restart as a trigger; a hook spec covers both texts.
Cause (builder): a self-restart text existed since 216d90f05, but it was gated on `$TMUX` plus a session named
`<name>@<repo>`, never replaced `act_now`, and named no script path and no session name. Built 4694460df: gate on
`TMUX_PANE` and `agent-sessions.mjs` on disk, name from the tmux `session_name` minus `@<repo>`, every text gives the
full `restart` command; spec 45/45 (4 new cases). Not verified: a live self-restart in tmux.

472\. CI went red again right after the green run (42069094444 on 3fd1c625b): ff's fc98d3dae hides the devtools UI
under `navigator.webdriver`, Playwright sets it, so the devtools cases in the Strict CSP e2e and storybook-e2e found no
toggle; the new export had no scenario (`query:export-coverage`). The builder's local batch ran typecheck, lint, test
and build only. Why no tool caught it: the pre-push "Checks" scripts leave out `query:export-coverage` and
`core:export-coverage`, and the e2e suites run only in CI, so an automation-gated UI passes every local hook. Tool fix
(builder default): add both export-coverage scripts to the pre-push checks; a change that gates UI on
`navigator.webdriver` turns it on (`showInAutomation`) in the repo's own e2e hosts in the same commit, and the
pre-push hook runs the devtools e2e cases when `libs/query-devtools` changes.

473\. The CI step "Slow design rules against the pull request base" (`ci.yml:111-113`, `design check --product studio
--slow --base "$NX_BASE"`) ran 11m 32s and was still running; it blocks every `next` run, also SDK-only pushes, and a
release waits for it. Tom: "das ist keine lösung für die ci. das ist viel zu langsam". Why no tool caught it: no step
has a time budget, and the job has no path filter, so a query-only push pays the full Studio compare. Tool fix: open
ADR 0197 (B396): a separate path-filtered workflow that blocks no release, and a time budget per CI step that
fails loudly when crossed.

474\. A vitest run in `libs/query` (generators spec) served a stale copy of the spec once from
`node_modules/.vitest-cache`, so the run tested old code (ff, 2026-11-05, B385); ff worked around it with
`--fsModuleCachePath /tmp/<dir>`. Why no tool caught it: nothing checks that the module cache matches the source on
disk, and a stale pass looks like a real pass. Cause not proven (builder read vitest 5.0.5: the key is sha1 of module
id, file content and env hash; fixtures are read at run time and are not the cause; suspects: a read during a
half-written save, or the Angular plugin hiding a dependency; not reproduced). Tool fix (decided, builder default): the
pre-commit spec gate runs with a fresh `--fsModuleCachePath` in a tmp dir, so a gate pass never rests on the cache.
Not decided: `fsModuleCache: false` for all of `libs/query` (slower runs for an unproven cause).

475\. Sketches `foundations/colors@foundations-check-fixes` (rule-only fix, Tom picked `a`) and `pages/system@check-fixes` (Tom: "gleiches bei system", with a screenshot) show every state as
unchanged ("Unverändert: Variante a" folded), yet it did not merge itself, and the Merge button sits behind the folded
"Unverändert" block, so Tom cannot find it (Tom, 2026-11-05, with a screenshot: "sollte das dann nicht auto mergen?").
Why no tool caught it: no spec opens a sketch whose variants all draw the same pictures and asserts that it either
closes itself or shows its merge action. Likely cause (not verified): the auto-merge refused on the dirty guard
(uncommitted `ready.json`, see 468) and left the sketch open without saying so. Tool fix: (1) the builder finds the
cause and reports it; (2) a refused auto-merge writes its reason on the sketch ("Auto-Merge verweigert: ...") and
keeps the action visible; (3) a folded unchanged variant never hides the merge or pick action; (4) spec: a sketch with
all-equal pictures either merges itself or shows the action plus the reason. The look of (3) goes to Tom as a sketch
with variants.

Cause (verified by the builder from a run): `sketch ready` on `pages/system@check-fixes` printed "shows no visible change
but did not merge: studio has uncommitted edits outside ..." (the dirty guard `dirtyOutsideOf` in merge.ts). The reason
went only to stderr, never onto the sketch, so Studio showed "Wartet auf deine Wahl" without a reason. The foreign
`ready.json` mark did not block (`.ethlete` was clean). The colors merge then dirtied the tree, which blocked system.

476\. The "Aktuell" column of a sketch (`foundations/colors@foundations-check-fixes`, `pages/system@check-fixes`) still
draws every state while the variant rows fold their unchanged states. Tom (2026-11-05): "in aktuell sollten eig dann
auch nur die screens zu sehen sein die durch varianten änderungen bekämen?". ADR 0132 already decided it (only the
states a round changes, the rest folds behind a count), so this is a defect, not a question. Why no tool caught it:
the fold spec checks the variant rows only; nothing asserts that `Aktuell` and the variant rows draw the same state
set. Tool fix: one shared function lists the shown states for `Aktuell` and every variant row; a sketch whose states
are all unchanged shows only the question, the count and the action; spec: same state set per column, also for the
all-unchanged case.

477\. `sketch ready` is very slow, and Tom thinks other design commands are too (Tom, 2026-11-05: "sketch ready muss auch
dringend schneller werden, der und ich glaub auch weitere befehle sind echt lahm"). Why no tool caught it: no
command has a time budget, and nothing records how long a command ran, so a slow command looks like a working one.
First measure (builder, idle machine, 1-variant sketch on a 1-state part): `sketch new` 0.6 s, `sketch check` 5.7 s,
`sketch ready` 6.7 s, `design check --rules` 2.2 s. The small case is fast; the slowness is per state and frame
(`pages/system`: 26 states x 3 widths). The biggest phase is not named yet: per-phase timing comes next. Cause found (builder, 6d1b0868c): phase timing prints with `ETHLETE_DESIGN_PHASES=1` (stderr). The biggest phase is
render-check, 22 s on a `pages/system` sketch (1 variant, 26 states): it drew the sketch, then the merged part, one after
the other. The merged part now draws at the same time: `sketch ready` 44 s to 35 s (in a /tmp clone). Other phases
(ready): identical 11.4 s, changes-shot 5.5 s, gates 2.4 s, auto-merge 2.0 s. Next target: `identical` shoots states one
by one; fixed in 1256d2786 (8 at a time, result order kept; the new seconds are NOT measured yet). A budget spec counts browser contexts (max 2 at once). Merge timing and CI not verified. Tool fix: (1) measure `sketch ready`, `sketch check`,
`sketch merge`, `sketch new` and `design check` on a real sketch, with the time of each phase; (2) fix the biggest
phase first (suspects: a full draw of every variant and state, the full listing, a cold CLI build, a repeated
compare); (3) every design command prints its duration, and a spec or a budget list fails when a command passes its
budget on a fixed fixture.
Scope extended (Tom, 2026-11-06: "die compare cli ist auch noch echt ausbaufähig in schnelligkeit"): `design compare`
gets the same phase timing, the same biggest-phase-first fix and a budget entry.
First compare measure (c8, 2026-11-06): `design compare components/title-bar --product studio` 44.9 s wall for 14
states plus actions; compare ignores `ETHLETE_DESIGN_PHASES`. The harness starts twice (states, then actions): the
second start is the first suspect.
As built (builder ethlete-sdk-c0, ADR 0199 item 1): `design compare` prints phases with `ETHLETE_DESIGN_PHASES=1`
(harness cache key, build, start, stop, design-shots, app-shots, compare-states, actions). The action check runs on the
same harness as the states; the harness stops once, also on a throw. Spec: one harness start and one stop per run
(bit: 2 starts on the old code). `compare components/title-bar` (14 states): 68.2 s before (two 14-15 s harness
builds), 47.1 s after on a build miss, 39.7 s on a cache hit. `pages/start` 3.2 s, unchanged (cache hits). Next biggest
phase: the title-bar action check, 27-31 s (70 % of a cache-hit run). C1 measure: the harness build missed on most
title-bar runs, likely because another session edited title-bar sources during the run (the build is stored only when
the key is unchanged after it); one rerun hit (0.07 s). Not measured: browser contexts; `pages/sketches` (stale-CLI
guard).
As built 2 (builder ethlete-sdk-c0): the action check draws the design pictures of all start states at once and runs
the states 4 at a time (forced -hover/-active/-focus-visible states filtered out before batching; result order kept).
`compare components/title-bar` action phase 28-32 s to 19.4 s, wall 58-59 s to 47.4 s (all runs were harness-build
misses, 15-19 s); output lines identical. Spec counts concurrent draws and probes (bit: 1 instead of 8). Not done: a
cache-hit run, a second part. Side effect: `design actions` streams lines of a batch's states mixed; the final list is
in order. Next costs: the shared draw cap of 8 (`DRAWS_AT_ONCE`), a fresh context and page load per pointer probe and
per input, the action check redrawing pictures compare already drew (3 s), the harness build on a miss (C1), then
compare-states (~10 s).

478\. After an automatic merge, `sketch ready` printed "ENOENT ... foundations-colors.foundations-check-fixes/sketch.json"
and never printed "merged automatically", although the merge was complete (commit 479bdace3, builder, 2026-11-05).
Why no tool caught it: no spec runs `sketch ready` to the end for an auto-merging sketch and asserts a clean exit and
the message. Tool fix: find the step that reads `sketch.json` after the sketch folder is removed; a spec for the
auto-merge path with exit code 0 and the "merged automatically" line. Also: an automatic merge commits its own
result, so it never leaves a dirty tree that blocks the next sketch.
Cause (corrected by the builder, faa6b4f70): two `sketch ready` runs on the same sketch at the same time; one merged, the
other hit ENOENT. Not a merge-path bug. Fixed: a per-sketch lock (the second run fails with a clear message) and a
check that `sketch.json` still exists; the auto-merge commits its own result when the product folder is clean apart from
the sketch's own folder. Finding 475(2) is built: a refused or skipped auto-merge writes `mergeHold {reason, at}` on the
sketch.

479\. A fresh sketch of a part that has a `.css` file (`components/kbd`, `components/divider`) fails `UTILITY-CSS` in
`sketch check`, so `sketch ready` refuses after 2.5 s (builder measure, 2026-11-05). Why no tool caught it: no spec
creates a sketch for a part with a `.css` file and runs `check`. Tool fix: `sketch new` copies the part so that it
passes `check`, or says in German why it cannot; spec with a part that has a `.css` file.

481\. `pages/sketches` carries 9 DROPPED-PROP findings that predate slice B: the design states withdrawn, agent, fold,
question and port were merged earlier (62812a4c3, e0f6a4396, aa8c96889) without the matching `input()` on the app
component (builder, 2026-11-06). Why no tool caught it: DROPPED-PROP stays a warning, so a merge of a design whose props
the implemented app lacks passes, and the debt only shows when a check record is wanted. Tool fix: a sketch merge for
an implemented part that adds props the app has no input for opens a port item (STATUS row or `design task`) at merge
time; builder decides how, or gives it a STATUS row. The `pictures.json` entry written by a builder `design check` run
is a check record, not a decision (committed 0a9bf6117).
Widened (builder ethlete-sdk-c0, 2026-11-06, full design check after 30a5c27b9): DROPPED-PROP also on
`canvas-frames` (4) and `pages/system` (8), so 21 states in three parts carry design props without an app input.

484\. The app's code notice in the title bar drew text the merged design never had ("Host geändert - Studio neu
starten", "CLI hat uncommittete Änderungen, Studio läuft auf Stand <sha>"), and the CLI-dirty state has no design state
at all (UI builder ethlete-sdk-c8, A1, 2026-11-06). Compare reported the notice as "cannot compare" (no input), not as
drift, so the undesigned app state stayed invisible until a builder read the old template. Why no tool caught it:
compare only walks design states; an app branch that renders something no design state covers is never listed. Tool
fix: compare lists every app state it cannot map to a design state as a named finding (not "cannot compare"), and such a
state opens the missing-state sketch of ADR 0048 and ADR 0010 at once (built look as variant a). Overlaps B251.
Applied for A1: the three restart cases follow the design (button only); the CLI-dirty hint and the cause text stay
as the built look, marked, with a sketch on `components/title-bar` (variant a built text, b cause as tooltip, c no
hint).

485\. The UI builder ran the full `design check --product studio` (about 7 minutes) at the end of the A1 slice, which
only touched `components/title-bar` (ethlete-sdk-c8, 2026-11-06). Tom: "das dauert halt echt ewig. das frisst den halben
tag". Cause: the builder-agent skill told every slice that changes `apps/<app>` or `.ethlete/design` to end with the full
product check; no gate asked for it. Why no tool caught it: `design check` has no scope for "what this slice changed",
so a builder must either pick the parts and their hosts by hand or run everything. Fix: (1) the builder-agent skill now
names a part-scoped check for each touched part and each part that embeds one, and keeps the full run for pre-push and
CI (done in this commit); (2) tool: `design check --product <p> --base <ref>` checks only the parts whose design or
implemented app files changed since `<ref>`, plus the parts that embed them, and prints which parts it chose. Built in
the performance block of ADR 0199.

486\. `design compare pages/sketches` lists 16 missed actions: the app shows a combobox "Runde" in every state and a
disclosure "Alle Zustände zeigen", and the design draws neither (builder ethlete-sdk-c0, 2026-11-06). The app grew
controls without a design; compare only lists them, and `check --rules` and the pre-push gate pass. Same class as 484
(app content no design covers), here as controls instead of states. Why no tool caught it: a missed action is
informational, not a failure, and nothing turns it into a design task. Tool fix: a missed action fails compare for an
implemented part and opens the missing-state sketch of ADR 0048 and ADR 0010 (built look as variant a); the
IMPLEMENTATION-UNCOMPARED gate in `check --rules --base` fails while one is open.

488\. The doc agent committed ADRs 0198-0200 with `open:` values the ADR check refuses ("A1", "477", "et-update-findings
11") and put finding 487 before 486; 478 already sat after 486 (doc agent, 2026-11-06). Only the pre-push
`lint:studio-adrs` caught it, at Tom's "push ok", so the push stopped on plan files. Same defect as 455: B395 (ADR and
finding-order check at commit time) is still backlog. Fix in this round: STATUS rows B398-B400, ADRs point at them,
findings reordered. Tool fix (technical, decided): B395 moves up and also checks the finding order; the doc-agent skill
says an open ADR needs its STATUS row in the same commit.

489\. `design check` shows 2 CONTROL-STATE problems on `shell-main`: the rail controls `section` and `product` are
hand-drawn `<button class="st-shell-bubble">`, not an SDK component (builder ethlete-sdk-c8, 2026-11-06). They came in
with 2008b4848 and 5ec59cccc (10-27/28); the rule came later in 4f1ba2b3e (11-02) and never ran over the existing
products, so it landed on violations without a fix or a baseline. Why no tool caught it: CONTROL-STATE is a draw rule;
pre-push runs `check --rules` (static, no draw), and the CI `--slow` set covers only APP-SPEC, UNCOVERED-REGION,
VISIBLE-CHANGE, COMPARE and SDK-ERROR. The draw rules (CONTROL-STATE, DROPPED-PROP, ACTION-LOST) run in no gate, only
in a manual full `design check`. Tool fix: the draw rules join the `--slow` set with the per-part input-hash cache;
the commit of a new rule runs it over every product and baselines what it finds (ADR 0201, B401). Picture fix: the
rail bubble becomes its own control part `components/rail-bubble`, as a sketch (queued for c8).
**B401 as built (cb):** `rule-baseline.json` per product (rule -> `<part>: <place>`
-> `{ finding, sketch }`, `rule-baseline.ts`, shrink check shared with the implementation baseline in
`baseline-history.ts`). `check --rules`, `--slow` and full `check` pass a listed hit and print it as `baselined (ADR
0201)`; a new hit, an entry that no longer hits where its rule ran, and an added entry fail. The draw rules run in
`--slow` with the slow input-hash cache (also without a harness); build-ready skips baselined slow hits. Baseline:
studio 2 CONTROL-STATE (shell-main `section`, `product`) and 21 DROPPED-PROP (canvas-frames 4, sketches 9, system 8),
all on finding 489; sdk and studio-lab none. Verified: specs with bite, the draw rules over all three products from
the built dist, `check --rules` on all three (23 baselined lines, exit 0), `check --slow` on studio-lab. Not verified:
`check --slow` on studio (cut at 15 min inside the harness VISIBLE-CHANGE pass), the pre-push gate end to end. Not done: the writer flag
`design check --rules --baseline <finding>` (a follow-up slice once c0's resident block in `design-command.ts` settles).
Until then no in-repo script writes a new rule's baseline: call `writeRuleBaseline({ product, problems, entry: { finding,
sketch } })` from `system/rule-baseline.ts` by hand, as a `node -e` one-liner over the built
`dist/libs/cli/src/lib/design/system/rule-baseline.js` with the product from `resolveProduct` and the problems of the
rule's runner (e.g. `droppedPropProblemsOf`).

490\. The title bar draws the code notice only for `linux-full` and `windows`; macOS has `macos` and `macos-update` but
no notice state, and `linux-left` / `linux-close` have no notice either (Tom, 2026-11-06: "wieso machen wir diese
titlebar designs eig für windows und linux? mac nicht? ... im grunde ist es ja das gleiche system ... nur dessen
positionierung ändert sich basierend auf dem os"). The render is one function for all OS (ADR 0050-0052); only the
state list in `components/title-bar/shared/chrome.ts` is a hand-picked set, so A1 added the notice to two layouts and
the notice-hint sketch inherits the gap. Why no tool caught it: nothing checks that a content prop drawn on one OS
layout is drawn on every OS layout. Tool fix (technical, decided): the title-bar states are the product of content
(rest, update, notice) and OS layout (linux-full, linux-left, linux-close, windows, macos); a `check --rules` rule
fails when a part with an `os` prop draws a content prop on one layout but not on all.

492\. Tom, 2026-11-06: "die cli calls alle EXTREM ausbremsen. wir müssen hier deutlich schneller werden, nicht nur ein
paar sekunden und es reicht auch nicht von 4 auf 1 minute zu kommen. das ist absolut inakzeptabel." Measured today:
`compare components/title-bar` 47 s (harness build 15-19 s per call on a miss, action check 19 s), about 1 min per page
part, full `design check` about 6:30. The perf work (ADR 0199) tuned phases by 20-40 % each. Why no tool caught it:
the budgets were set per phase against the old time, never as an absolute target per command, so a 30 % gain read as
done. Every CLI call builds or starts its own harness, browser and render worker. Tool fix (doc-agent decision): absolute
warm targets per command (compare one part ≤ 5 s, `compare --affected` 8 parts ≤ 15 s, `sketch ready` ≤ 10 s, `check
--rules` ≤ 3 s, full `design check` ≤ 60 s), each a budget spec; one resident process owns harness, browser pool and a
picture cache keyed on input hash, and the CLI only sends it requests. Ahead of B402 and the rest of B399.

### Build-ready decisions (2026-11-03, A10 pulled forward)

Tom: the go system is not extended any more; A10 replaces it now.

1. Build-ready replaces go and acceptance. Tom's only approval is picking a sketch variant; an automatic merge
   only when no picture changes. Build-ready is computed: the ready mark holds at the current design hash, every
   embedded part is build-ready, no check problem is attributed to the part, and a small harness run renders every
   state without SDK errors (new runner; today SDK errors are only a side effect of compare/live).
2. No manual hold, no go withdrawal (B70 is moot): everything comes in through sketches that pass the checks.
3. Who builds (Tom: "a designer should not have components built ... our system breaks once it gets complex", the
   fifagg start page as the example): by content, not by layer. A part is designer-buildable when it is
   presentational: inputs and outputs only, composed of SDK components and parts, no services, no data loading, no
   routing. A tool checks it on the part before the build and on the generated code after it; a failure makes it a
   developer part. Small fixes go through the same test.
4. A developer part's spec is the build-ready part (design files, all states, compare target); done is a green
   compare of app against design. No written brief from the designer.
5. No sprawl: an implementation embeds each embedded part through that part's implemented component and never
   copies its markup. The design half is INLINE-UI-IN-PAGE (B247); the app half reuses its detector.
6. Missing state (Tom: "if it gets that far, Studio failed, but it must not tear the developer out of his work -
   imagine the designer is on holiday"): the developer builds the missing state himself and may do anything,
   including CSS ("otherwise he is stuck again because the SDK lacks the component"). The state is marked as
   needing approval: Studio opens a sketch on the part with the developer's build as a variant (its screenshot),
   and compare passes that one state while the sketch is open. The designer picks it or adds a replacement
   variant; after the pick the code must match the design again. Studio's failure is caught earlier by a rule: a
   part that takes data or lists is build-ready only with declared loading, error and empty states.

Technical (doc agent): `design task` gates on build-ready and names the red checks; doneParts drops the go.hash term
(implemented.hash vs the current design hash); open points no-go/stale-go become not-build-ready; ACTION-UNDECLARED
is always on; go.actions/review carry moves to the ready mark; pictures.json kind go is rekeyed to ready; remove
go.json, accepted.json, the go-*.ts commands, the Studio give-go and accept buttons and endpoints, the git-safety
go rule, and the go docs, with a migration that deletes both files. Built as B249 (build-ready + removal), B250
(designer/developer split check), B251 (undesigned-state sketch + required data states). 7. User roles (Tom): none now. Designer part and developer part are properties of the part that tools check, not
of a person; the only human decision stays the sketch pick, with `by` as today. Roles and rights come with E8
(two designers on one design, multi-user sessions). 8. Solo case (Tom builds Studio as designer and developer, the builder agent does the developer work): the same
flow as a team. An undesigned state the builder renders becomes a sketch that Tom picks. No solo shortcut.

493\. c8, 2026-11-06: the compare of the 8 parts A1 left uncompared runs one part at a time, because "two design runs
at once race on dist/libs". So the gate fix of finding 491 takes 8 × ~1 min serial, and two builders cannot run design
commands at the same time in one checkout. Why no tool caught it: every design call builds the libs into the shared
`dist/libs` with no lock and no per-run output, and no spec starts two calls at once. Tool fix (technical): part of the
492 resident process, which owns the one lib build and serves every caller; until it lands, a design call takes a lock
on the lib build and waits (with a printed "waiting for the lib build of pid N") instead of racing, and a spec starts
two `compare` calls at once and expects both to pass.

As built (S1, builder c0, 2026-11-06, commit `fix(cli): Lock the shared lib build of design calls`): a shared/exclusive lock on `dist/libs` in `tmp/design-lib-build` (`libs/cli/src/lib/design/system/lib-build-lock.ts`, used by `readFreshDist` in `stale-dist.ts` around every drawing design call). A call takes the build lock (prints "waiting for the lib build of pid N"), rebuilds only when stale and only after every other live run finished reading (dead pids are dropped), then reads under a reader file until it exits; a nested design call skips the lock. Verified: `lib-build-lock.spec.ts` (two calls at once, one build, the waiting line; no rebuild under a live reader), bites with the lock removed. Not verified: two real concurrent `compare` runs; `serve` and manual `nx build` stay outside the lock.

As built (S2 of 492, builder c0, 2026-11-06, commit `feat(cli): Run design compare through a self-starting resident process`): `et design compare` goes through a resident process per checkout (`libs/cli/src/lib/design/resident/`): HTTP on 127.0.0.1 with a token, newline-delimited JSON frames carrying stdout, stderr, heartbeats and the exit code; discovery file `tmp/design-resident/process.json` (pid, port, checkout, CLI build, token), log `resident.log`. The first compare starts it detached under a start lock and prints the cold start once; a dead pid is replaced, another CLI build is stopped and replaced, a live process that does not answer is killed and the call runs in-process with one line, as does a process that ends mid-run. Idle exit after 30 min, `et design stop`; `CI` and `ETHLETE_DESIGN_RESIDENT=0` stay in-process; only compare goes through it. It keeps the design server, render worker and Chromium warm (`shootStatesWith`) and the harness server running while `harnessKeyOf` is unchanged. Lib-build lock: each request takes the S1 reader for its own run only (`readFreshDist`) and releases it after, and a changed lib build stamp or design config restarts the design server and Chromium before it draws, so other runs can rebuild between requests. Measured `compare pages/start --product studio`: in-process 13.4 s (harness build 10.5 s), resident cold 17.0 s, warm 2.2 s and 3.9 s when no file changed between calls (harness reused, harness-start 0.05 s, compare-states 0.8-2.5 s), but 13.3-14.3 s when the harness key changed: it hashes every file of the checkout, so another session's edit to libs/cli rebuilds the harness (11-12 s) - S3 must scope or watch it. Verified: 14 specs in `resident/*.spec.ts` (streaming and exit code over a real socket, CI/opt-out, cold start once, stale pid, other build, hung and crashed process, idle exit, token, one request at a time), each bites; warm OK/DIFF lines equal the in-process run. Not verified: two clients starting at once against real processes, `--live` through the process.

As built (S3 of 492, builder c0, 2026-11-06, commits 793daca83 and the fix 320c5c2af): the harness key covers only the harness app's real inputs (`system/harness-inputs.ts`: the app folder, files its build sources reach through relative imports, templates, styles and tsconfig path aliases, project.json build inputs, root files except `*.md`; about 2645 files, so edits in libs/cli, cdk, plans, design config or pictures no longer rebuild it). The resident process runs `nx run ethlete-studio:build:development --watch` (`system/harness-watch.ts`): a request waits until the watch build is idle for its input state, a build counts as done at Angular's `Output location:` line plus 200 ms of a quiet output folder; root, tsconfig, project.json, package and dot-folder edits restart the watch. In-process (CI, `ETHLETE_DESIGN_RESIDENT=0`) keeps the one-shot build with the narrowed key. Defaults confirmed by c4: after the first build the process touches the mtime of `apps/ethlete-studio/src/main.ts` to pre-warm Angular's ~10 s first incremental build (other dev servers rebuild once); known limit: an edit under `.ethlete/design/studio/foundations/*` restarts the watch (~12 s), because Angular ignores dot folders. Finding 504: 793daca83 alone broke the resident compare (probe before Angular wrote the output, and the served URL came back as an error); no spec drove the real watch output order through the static server; 320c5c2af adds a `startWatch` spec with Angular's real line order that bites on both bugs. Measured `compare pages/start --product studio`: in-process 23.3 s (harness build 18.9 s, cache miss under load), cold 22.0 s, warm unchanged 3.8 s, warm after an unrelated untracked file 3.8 s, warm after an app source edit 5.0 s (watch wait 1.4 s); target 5 s met. OK/DIFF/action lines identical to in-process. Not verified: an emit failure after the `Output location` line waits for the 5 min timeout; why the in-process cache missed twice; the warm-up touch and foundation restart paths have no end-to-end run.

As built (S0 of ADR 0208, builder c0, 2026-11-06): every timed `et design` command (all but serve, mcp, stamp, timings and the resident itself) appends one JSON line to the gitignored `.ethlete/design/.timings.jsonl` (`libs/cli/src/lib/design/timings.ts`): command (with subcommand), args, parts, session (`CLAUDE_CODE_SESSION_ID`, tmux pane `TMUX_PANE`, no tmux call so the log never spawns, `ETHLETE_AGENT_ROLE`), resident flag, start, total, exit code, phases, queue wait (resident request queue plus longest draw-queue wait), build wait (lib-build lock, harness build or watch wait), browser and design server start, cache hits and misses (thumb, shot and harness caches) and the other live lib-build readers as concurrent heavy runs. `timedPhase` always records; the `PHASE` stderr line stays behind `ETHLETE_DESIGN_PHASES=1`. A thrown run logs exit 1, the line is also written on process exit, and write errors are swallowed. A compare answered by the resident process is logged once, by the resident, under the caller's session (forwarded env); the client skips its line. `et design timings [--since <n>m|h|d] [--command x]` (default 1d) prints the median per command against the targets (compare 5 s, sketch check and ready 10 s, full check 60 s), each run over its target with its most expensive phase, the slowest phases and runs. Verified: 10 specs in `timings.spec.ts` and `timings-command.spec.ts`, each piece broken once and a spec failed; a real `yarn et:design timings` run. Not verified: a real resident compare end to end (the spec drives the resident server with a recordRun stub, not `createWarmCompare`), and the cache, queue and concurrent-heavy counters on a real check.

494\. c8, 2026-11-06: after A1, `compare` of pages/flows, inventory and merge shows 21-31 px DIFF in every state. The
title bar matches pixel for pixel; the 21 px are 1-2 colour levels of anti-alias on the four rounded corners of the
left panel, which A1 did not touch. ADR 0115 (2026-11-01) decided one shared compare rule for pane corner anti-alias,
but only the sketch merge diff got a tolerance (`looksTheSame` in `merge-compare.ts`, 8 of 255 per channel, 2e5d9fa36);
the implementation `compare` still counts every changed pixel. Why no tool caught it: ADR 0115 was marked `open: none`
with no build sha and no STATUS row, so nothing tracked that the second consumer never got the rule. Tool fix
(technical): `compare` uses the same per-channel tolerance as the merge diff, from one shared function, with a spec
on a 1-2 level corner shift; the ADR check refuses an `open: none` ADR that has no `built:` sha (new ADRs only).

As built (494, builder): `pixelsDiffer` in `libs/cli/src/lib/design/system/anti-alias.ts` is the one per-channel rule (8 of 255); `merge-compare.ts` (`looksTheSame`) and `comparePngs` in `part-compare.ts` both use it, so a 1-2 level corner shift is `ok` in `compare` and a 9 level change still counts. `check-studio-adrs.mjs` refuses an `open: none` ADR numbered above 0204 (older ones are grandfathered by number). Specs: `part-compare.spec.ts`, `merge-compare.spec.ts`, `check-studio-adrs.spec.mjs`; bite proofs run (tolerance -1 fails the compare spec, cutoff 9999 fails the ADR spec). The repo passes `lint:studio-adrs`. Not verified: a live `design compare` run on the 21 px corners, and a push through the pre-push hook.

495\. c8, 2026-11-06: of the eight parts A1 left uncompared, three show drift older than A1. `pages/sketches` (page-100
63644 px, zoomed-page 94023 px, 16 missed actions, see finding 486), `pages/system` (`part` 73606 px, 6 missed
actions in call / call-transferred) and `elements/canvas-frames` (6 of 11 states uncheckable: the design prop `heads`
has no app input; 4 DROPPED-PROP). c8 blamed uncommitted c0 work for the sketches drift, but the tree holds none; the
sketches page changed in committed builder slices (b9367d285 to 30a5c27b9) with no compare after them. Why no tool
caught it: nothing re-compares an implemented part after its app files change, and `compare` does not say since which
commit a part drifts, so the builder guessed. Tool fix (technical): ADR 0203's commit check covers the first part;
`compare` prints for each drifting part the last commit that matched and the commits since then that touched its app
files.

496\. c0, 2026-11-06, live check of the 494 fix: `compare pages/flows` prints `flow combobox "Bildschirmgröße" FAILED
the design draws no such element, so it declares no action` and still exits 0. The app has a control the design never
drew (same class as the "Runde" combobox of finding 486). Why no tool caught it: a FAILED action line does not fail the
command, so the gate, the builder and the verify step read the run as clean. Tool fix (technical): `compare` exits
non-zero on any FAILED action; a part whose app has an undeclared control gets a sketch for the control (UI item for
c8, `pages/flows` "Bildschirmgröße").

497\. cb, 2026-11-06, while building the B405 baseline (5ddcdf3f5): a pin scan of all implemented parts shows app-file
drift also in `components/canvas-viewport` and `components/comment-pin`. The pre-push gate does not flag them, because
it only checks implemented parts whose files are in the push range; they fail the next push that touches them. Why no
tool caught it: no command lists every implemented part whose app files changed since its last compare, so drift sits
unseen until an unrelated push trips over it. Tool fix (technical): the full `design check` (and the resident process,
ADR 0204) reports every uncompared implemented part, independent of a push range. c8 compares both parts right after the
push; real drift becomes a UI item, not a baseline entry. Also: `design-rules-gate.mjs` printed the check output only on
failure, so the ADR 0205 `baselined` lines were hidden on a green push; it now always prints them.

498\. c8, 2026-11-06: studio-menu, start, flows, inventory and merge pass `design check --part` (0 findings) and their
compares match, yet `task --verify ff698951f` refuses "no check record at its current design". The record is written
only when the part is build-ready, and build-ready needs every embedded part build-ready; bottom-up about 20 parts fail
(button, select, list-row missing states; disclosure, start, inventory "changed outside a sketch"; logo, icons, menu
"cannot check the actions: waiting for [data-design-harness-host] timed out"). So the IMPLEMENTATION-UNCOMPARED gate,
which ADR 0203 clears by a compare, is in fact cleared only by the whole build-ready chain. Why no tool caught it: (1)
verify reuses the build-ready record instead of a compare record, and no spec verifies a host whose embedded part is not
build-ready; (2) the action run starts for parts without an `implements` link and times out on the harness host
instead of skipping; (3) `design check --part` passes and writes no record without saying why. Tool fix (technical,
doc-agent decision under ADR 0203): a passing compare plus the part's own passing check writes the record that clears
IMPLEMENTATION-UNCOMPARED and `task --verify`; build-ready keeps its embedded chain for `design task`; the action run
skips parts without an `implements` link; `check --part` prints why it wrote no record.
**As built (498, builder c0, 2026-11-06):** `recordBuildReady` (`part-build-ready.ts`) writes and drops the check
record on the part's own check (open points, rules, slow results incl. COMPARE, actions) only; an embedded part that is
not build-ready keeps the host from build-ready (`design task`), not from its record, so `task --verify` (compare +
actions + implemented record) runs once the part's own check passes. `partActionFailuresOf` (`actions-command.ts`)
skips a part without an `implements` link with one line `actions <part>: skipped - no implements link, nothing to
click` (printed by `check --part`). `check --part` prints why it wrote no record (`NO RECORD <product> <part>:
<kind>: <text> (+n more)` or `the actions did not run`). A full check now also records unlinked parts whose own check
passes (`READY` lists them). Verified: specs with bite in `part-build-ready.spec.ts`, `part-ready.spec.ts` and
`check-system.spec.ts`.

**Doc-agent decision under Q160 - multi-part verify, as built (2026-11-06):** `task <part> [<part>...] --product <p>
--verify <rev>` verifies one commit as one task over several parts. The allowed files are the union of the named parts'
allowed files. Files under `plans/`, `apps/ethlete-studio/docs/`, `.changeset/` and `apps/docs/components/` never count
as implementation files: they are skipped with one line (`notImplementationFilesOf` in `part-task.ts`), also for a
single part. Any other file outside the union is refused and named. Each part runs its own compare and actions check;
a part is recorded only when every named part passed, each with its own implemented hash. A refused verify names the
other linked parts whose allowed files hold the refused files: `verify together: et design task a b c --product <p>
--verify <rev>` (`ownerPartsOf`). Several parts without `--verify` exit 2 with a usage message. Verified: specs with
bite in `part-task.spec.ts` (union, foreign file, skipped plan/docs/changeset files, red compare on one part records
nothing, the hint, no `--verify`). Not verified: the real verify of ff698951f.

500\. Tom's screenshot of the sketch view, 2026-11-06 12:15, `components/title-bar@notice-hint` at "Fit" (54 %): (1) about
550 px of empty canvas above the variant heads; (2) "Fit" does not fit: variant b is cut at the right edge and variant c
is not visible at all, so Tom cannot compare the three; (3) the "Aktuell" column shows only the right end of the title
bar (window controls), the left part is cropped; (4) in variant b the five notice rows are twice as tall with an empty
band under the bar: the tooltip is drawn there (c8, `design shot --variant b`), but at 65-77 % of the 1440 px width,
inside the part (2) cuts off; the merged notice state has the same empty 48 px band (`pb-12` in shared chrome); (5) "Keine Aktivität" while c8's `sketch check` was
running. The sketch view is `pages/sketches`, a drift baseline entry of ADR 0205 (finding 495), so its compare could
not flag this. Why no tool caught it: no check renders a real sketch of a wide part (a 1900 px title bar, 21856 px shot)
in the sketch view and asserts that every variant column is inside the viewport at "Fit"; the sketch check checks the
variant frames, not the view Tom picks in; no check flags a variant whose subject sits outside the visible part of its column. Fix: c8 takes
`pages/sketches` out of the baseline first (fit width, top gap, Aktuell crop, activity state), with a Studio e2e that
opens a wide-part sketch at Fit and asserts every column visible.

501\. The B401 baseline (d2c0425e6) lists four DROPPED-PROP hits on `elements/canvas-frames`, where a state drops a
design prop: `load-failed` and `loading` drop `mark`, `rounds` and `round-folded` drop `heads`. Why no tool caught them:
no gate ran the draw rules (finding 489); B401 now runs them in `--slow` and fails on each new hit. Fix (ADR 0201): one
sketch `elements/canvas-frames@dropped-props` for an app input per prop or a state that does not set it; the four
baseline entries point here.

502\. The same baseline lists nine DROPPED-PROP hits on `pages/sketches`: `withdrawn-hidden` and `withdrawn-shown` drop
`withdrawn`, `agent-round`, `agent-variant` and `agent-failed` drop `agent`, `folded` drops `fold` and `question`,
`question-only` drops `question`, `port-after-merge` and `port-after-merge-long` drop `port`. Cause and tool fix as 501.
Fix: one sketch `pages/sketches@dropped-props`, together with the Fit fix of finding 500.

503\. The same baseline lists eight DROPPED-PROP hits on `pages/system`: `agent-working`, `agent-working-ready`,
`agent-failed`, `agent-failed-ready`, `agent-waiting` and `agent-interrupted` drop `agent`, `call` and
`call-transferred` drop `call`. Cause and tool fix as 501. Fix: one sketch `pages/system@dropped-props`.

504\. S3 (793daca83, harness watch build) broke the resident compare: after the watch build it fails with "the
ethlete-studio:build:development output does not serve /__design-harness" (`harness-watch.ts:263`); the in-process
compare works (14.8 s). Every compare runs with `ETHLETE_DESIGN_RESIDENT=0` until the fix. Why no tool caught it: no
spec drives the real watch build output through the static harness server; the slice was committed with unit specs
only. Tool fix (c0): a spec that serves the real watch output and loads `/__design-harness`; a resident slice is done
only with one real compare through the resident process in its as-built note.

505\. Tom's merge of `components/title-bar@notice-hint` (pick b) was refused a third time (findings 434, 468): "studio has
uncommitted edits outside components/title-bar@notice-hint ... ready.json, rule-baseline.json". `rule-baseline.json`
was cb's staged B401; `ready.json` held a `components/canvas-viewport` ready mark at 09:44:55Z that no running session
wrote (likely c0's `sketch ready` measurements on `pages/system` before its restart). The doc agent saved both to its
scratchpad, reset them, Tom merged (332e49626), and `rule-baseline.json` went back byte-identical. Why no tool caught
it: the merge checks the whole tree, so any foreign uncommitted file blocks it, and the process rule of finding 434 did
not hold with three builders; the `by` field decided in finding 468 was never built because the finding got no STATUS
row. Tool fix: the merge checks in a clean copy of HEAD plus the sketch (ADR 0206, B406); every ready-mark and pick
write carries `by`, `cmd` and pid, and one without `by` is refused (B407). Process fix: a finding's tool fix gets its
STATUS row in the same commit as the finding.

B406 as built (builder subagent, 2026-11-07): `mergeSketch` builds a temp copy of the checkout (`sketch/clean-copy.ts`):
`.ethlete/design` (and a non-built-in base outside it) comes from `git archive HEAD`, or from the working tree outside
git; every other entry links to the checkout, `node_modules` is a folder of links without `.design-explore`, `.git` is
left out. The product's `sketches/` in the copy holds only the merged sketch. Writing, the check and formatting run in
the copy; the files it changed are then written into the checkout, and the bookkeeping (`merged.json`, comments, sketch
removal, rebase of other sketches) runs there as before. Foreign uncommitted edits elsewhere neither block nor fail
the merge. The old guard is gone; the new one asks `git status` only for the replaced folders and the changed files,
and refuses with `dirty` naming them ("would overwrite uncommitted edits"), so the held-merge retry keeps working.
Specs: `merge.spec.ts` (clean copy ignores a broken and a dirty file outside; a dirty merged file is named),
`sketch-command.spec.ts` (the auto-merge runs past a dirty file outside the sketch and keeps it). The spec of the
held-merge retry is gone: a dirty file inside the target folder now stops `sketch ready` at SKETCH-BASE-STALE before
the merge, so no `sketch ready` fixture reaches a hold; `retriedHeldMerges` is unchanged.

506\. The doc agent named sessions by their ids (c0, cb, c8) in German text for Tom. Tom: "woher soll ich wissen wer cb
ist? ist das hier star wars?" Why no tool caught it: the session names carry no role, and the doc-agent skill does not
say to name roles. Fix: messages to Tom name the role (Tool-Builder, UI-Builder), never the id (ADR 0207); with two
sessions (ADR 0207) the builder is "der Builder".

507\. `verify pages/start` reported NO RECORD: five merged studio parts (components/disclosure,
components/update-dialog, elements/shell-main, pages/inventory, pages/start) had a design hash that no longer matched
`merged.json`. Source-only commits changed them and never re-ran the picture check: the withAction refactors
d961cb00d, b826f7096, 4bbd88e03, 32aaf6552, 5bec01b89, and the chore fea9ac862, which did change shell-main's look (it
embeds the title bar, so pages/start moves with it). Why no tool caught it: pre-push runs only `design check --rules`,
and no rule compares a merged part's hash with `merged.json`. Fix (B412, ADR 0036/0037: a check-system rule, not a
hook gate): a rule reports DIRECT-EDIT-PENDING on every merged part whose hash moved without a `merged.json` record;
it shows as a problem on the part (not build-ready) and fails `--rules` in pre-push and CI. The five parts are closed
by `design check --product studio --part <each>`: auto-accept for the four with no visible change, an old/new edit
sketch for shell-main (and start through the embed) that waits for Tom's pick (ADR 0135).
Follow-up: `design check --part` closed none of the five. A committed direct edit was a dead end: auto-accept had no
pictures at the merged hash and opened an edit sketch with `old` = HEAD, which already holds the edit, so old == new
and `edit-sketch.ts` refused ("HEAD holds the edit ... no old design to show"). Why no tool caught it: the edit-sketch
specs covered only uncommitted direct edits. Fix (B412): `old` = the part's files at the newest commit whose part hash
equals `merged.json[part]`, not HEAD; with no such commit the part shows a problem with a hint, never a silent dead
end. Picking `old` writes that version back (ADR 0135).
As built (507, builder c0, 2026-11-06): `edit-sketch.ts` walks `git log` over the part folder and the product's
`shared/` and `assets/` folders, rebuilds those folders of each commit in a temp dir and hashes the part there with
`partHashOf`; the newest commit with the merged hash gives `old`, for a new edit sketch and for `refreshEditOld`. No
such commit: rule EDIT-OLD-NOT-FOUND on the part, with the `et design accept` command as the hint. A pick of `old`
merges those files back. Verified: specs with a temp git repo (committed refactor holds, committed edit gets the old
files, pick old writes them back, no matching commit gives the problem); they fail on the old HEAD code. Not verified:
`design check` on the five studio parts, and the speed of the walk on the real history.
As built (part 1, builder, 2026-11-06, 3e10f1ddf + type fix 6d26ac045): `old` comes from the newest commit whose part
hash equals `merged.json[part]`; with none, the rule EDIT-OLD-NOT-FOUND shows on the part with the hint `et design
accept <part> --product <p> --by ... --note ...`; picking `old` writes those files back. Real run: components/disclosure
HELD (80f953c0c); components/update-dialog (a383f2bdb drew the button states after the merge), pages/inventory and
elements/shell-main (title bar embed fea9ac862) open `@edit` sketches; pages/start has EDIT-OLD-NOT-FOUND (no commit
holds merged hash 5074133a3524678e) and waits for Tom's accept as it is. Open: the DIRECT-EDIT-PENDING rule lands
after Tom's picks, else it blocks every push; disclosure's pictures.json entry moved from key `go` to `record` (cause
asked; answered: `go` is a legacy kind still read, the rewrite kept hash and pictures, no data loss).

508\. 3e10f1ddf did not compile: a subagent committed CLI code without running tsc, and `git commit` runs no
typecheck (pre-push neither; CI is the only one). Found by the builder one commit later (type fix 6d26ac045). Why no
tool caught it: no local gate runs a typecheck before a commit lands on `next`. Fix now: every builder brief to a
subagent names a tsc step (or `yarn commit`). No pre-push typecheck: Tom already moved typecheck to CI only (ADR 0038).

510\. The ff698951f verify of pages/flows reported NO RECORD: `action: flow combobox "Bildschirmgröße" FAILED the
design draws no such element`. The message was false: the design draws the picker inside the embedded part
components/select, named by its value text (`combobox "Desktop·1440×900"`, `select.render` label `''`), while the
app names it by aria-label (studio-labels presetAria). `ownScopeOf` (libs/cli/src/lib/design/system/actions.ts) drops
an app element only when its key equals an embedded design key, so the app combobox stayed "own" with no partner.
Why no tool caught it earlier: compare checks pixels only, no rule compares a control's accessible name design vs
app; and `ownScopeOf` has no role fallback, unlike `pairElementsOf`. Fix: (a) design: the sdk select design takes an
`ariaLabel` prop and `presetPickerOf` passes "Bildschirmgröße"; an agent edit, allowed because the pictures stay the
same, so `design check` must report HELD, any picture change goes to Tom as an `@edit` sketch; (b) tool:
`ownScopeOf` pairs a lone leftover app element with a lone embedded design element of the same role, and the failure
line names the near miss (`design draws combobox "…" in components/select - accessible names differ`); (c) later
slice B413: an ACCESSIBLE-NAME drift rule.
As built (b) (c0, 2026-11-06): `ownScopeOf` leaves an app element to the embedded part when its role has one leftover
element on each side (shared `renamedPairsOf` with `pairElementsOf`); a failure without a partner names the same-role
design elements (`nearMissesOf`). Specs with bite in actions.spec. Not verified yet: the flows check on the built CLI
(after this commit). (c) still open.
As built (a) (c0, 2026-11-06): the select design mock takes `ariaLabel` and, like `et-select`, sets `aria-labelledby`
only with a visible label; the sdk select part passes it through, `presetPickerOf` passes "Bildschirmgröße". Verified:
slow check of sdk components/select clean, of studio pages/flows `PASS: no visible change` and no NO RECORD; the flows
action check no longer fails the picker (it is left to components/select now).
Tom (2026-11-06, "q1ok"): pages/start is accepted as it is (`et design accept pages/start --by tom`) after his
shell-main `@edit` pick has merged, because start embeds shell-main.
As built 509 and 510 (builder, 2026-11-06): 3ec42c18d - the rules summary line reads `N problem(s) in <products>.`
and the gate takes its product list from it; `ownScopeOf` pairs a lone renamed same-role element of an embedded part,
and a no-partner failure names the near miss (specs with bite). 5ec60c344 - the select design mock takes `ariaLabel`
(aria-labelledby only with a visible label, as et-select does); the flows picker is named "Bildschirmgröße"; slow check
of sdk components/select clean, studio pages/flows `PASS: no visible change`, its action check passes. Open: the
ACCESSIBLE-NAME rule (B413).
As built (c) (B413, 2026-11-07): the action check pushes an `ACCESSIBLE-NAME` failure line for every paired own-scope
element whose key differs from its design partner (`accessibleNameDriftsOf`, spec on fixture elements; rule listed in
CHECK_RULES). Not done: no baseline run (needs a render), so existing hits in studio products are unknown; the rule
may surface renamed controls the check passed silently before.

511\. `design check --slow --part X` did not write the check record; only a fast `check --part X` afterwards did
(READY line), so the ff698951f verify said "no check record" after a passing slow run. Why no tool caught it: no spec
asserts that each check mode writes the record. Fix: `--slow` writes the same record as the fast check (it runs a
superset), with a spec that fails when a slow run leaves no record.

512\. The NO RECORD line of components/title-bar ended with "(+1 more)", but no line of the check named that open
point. Why no tool caught it: the summary truncates the list, and nothing prints the rest. Fix: the check lists every
open point (or prints the hidden ones under the summary); spec with more open points than the summary shows.
Context: the ff698951f verify needs studio-menu, flows, merge, title-bar and shell-main together; title-bar misses
notice.hover/active/focus-visible. Decided by ADR 0106 (no question to Tom): a sketch round that draws them with the
existing styles, no new look, which Tom merges.

513\. The S6 subagent drew a timing fixture as a real sketch in studio (`components/sketch-status-badge`, a/b only add
p-1/p-2 padding). Studio listed it for Tom like any sketch, and the doc agent asked the builder before it could tell
Tom to skip it. Why no tool caught it: nothing marks a sketch as a measurement, and nothing keeps measurement runs out
of the product Tom picks in. Fix: timing and bench runs draw their sketches only in studio-lab or a scratch copy,
never in studio; the fixture is discarded with `sketch discard` and never committed.

514\. Tom on the `elements/shell-main@edit` sketch: "was wird hier von mir erwartet". The view showed "Aktuell" (the
direct edit, with the embedded title bar) next to "Variante old" with an "Übernehmen" button; "Variante new" sat
collapsed under "Unverändert", because new equals Aktuell. So the only visible action was the discard, and keeping the
change meant opening a collapsed list. Why no tool caught it: the "unchanged" collapse treats an edit sketch like a
design round, and no rule or spec covers what an `@edit` sketch must show. Fix: an `@edit` sketch never collapses
`new`; it shows two clearly named choices, "Änderung behalten" (new) and "Zuletzt gemergter Stand" (old), each with
its own button; spec on an edit sketch where new equals Aktuell. The layout goes to Tom as a sketch.
Tom on the shell-main pick: "wieso sollte man jemals die titlebar aus der shell werfen?" The old/new sketch offered
to undo an edit that implements ADR 0045/0050, because nothing links a direct edit to the decision it implements.
Decided in ADR 0209: an agent accepts a direct edit that names the ADR it implements; shell-main is accepted with
"ADR 0050", then pages/start (Tom's q1ok).

516\. Tom's "q1ok" for pages/sketches reached the builder only as a relayed message, and the builder's permission
check refused `accept --by tom`: an agent may not record Tom's consent from a relay. The doc agent had promised the
accept in Tom's name. Why no tool caught it: the Tom-only accept exists only as a CLI flag an agent types; nothing
lets Tom grant it with one action of his own. Fix: Studio lists the open `@edit` picks in one place with one
"Übernehmen" button per item, so Tom clicks instead of an agent typing `--by tom` (layout as a sketch for Tom). Until
then Tom runs the accept himself with `!` in a session. The doc agent no longer offers "ok in chat" for a Tom-only
accept.

517\. The doc agent put a process question to Tom (do plan decisions count for an agent accept, ADR 0210) that
followed from his own ADR 0209. Tom: "q2ok aber das solltest du entscheiden. du schreibst schon wieder klingonisch mit
mir". Two defects: (1) a question that extends an existing decision in its own spirit is the doc agent's to decide and
report, not to ask; (2) the German text to Tom was full of internal ids (ADR numbers, Impl Q, `@edit`, `--by tom`,
part paths). Why no tool caught it: the doc-agent skill limits ids for sessions only (finding 506), not for ADRs,
flags and plan refs, and it says to put tool and process decisions to Tom without a test for "follows from an
existing decision". Fix (doc-agent skill, builder edits it): text to Tom says what a thing is in plain words (an ADR
number at most in brackets after the plain statement, no flags, no plan refs); a question that applies an existing
decision to a new case is decided by the doc agent and reported in one line.

518\. Tom opened `pages/sketches@edit` to pick it (screenshot 2026-11-06): the view said "sieht anders aus - wähle",
but showed no pictures at all, only "Variante new / Variante old" heads and "30 unveränderte Zustände eingeklappt".
Tom: "wird hier eigentlich überhaupt irgendwas überprüft bevor es zu mir geht? ... ein zustand den ein user NIEMALS
sehen sollte". The sketch was opened at 11:21Z by cb's direct edit (before 1741d8bf8); every drawn state of
old and new is the same. Why no tool caught it: (1) an `@edit` sketch whose states are all unchanged still counts as
"waits for your pick" (it should have closed as HELD); (2) nobody looked at what Tom would see: neither the builder
nor the doc agent opened the sketch before sending Tom to it. Cause of (1) asked from the builder. Fix: (a) a sketch
with no changed state never waits for Tom: the tool closes an `@edit` one as HELD and marks any other as broken, with
a spec; (b) process: before the doc agent sends Tom to a pick, the builder takes a `design shot` of the sketch view
and the doc agent checks it shows a real choice.
Tom then ran the accept command the doc agent had given him; it refused ("pages/sketches has an open sketch - merge
or discard it"). The doc agent had sent a command it never checked against the open sketch. Rule: a command for Tom
is run (or dry-run) by an agent first, or not sent.
Cause of 518 (builder): the change is real (10 states differ from the merged pictures), but the `old` variant cannot
show the old look: its `withdrawn.ts` imports `@shared/sketch-rows`, which resolves to the current shared file, and
both variants draw against today's SDK, so old and new render the same. Fix (514/518 slice): the `old` variant of an
`@edit` sketch shows the stored merged pictures and is never re-drawn from source; spec on an edit sketch where only
a `@shared` import changed. Way out, decided by the doc agent under ADR 0210 (finding 500 is Tom's recorded report):
the builder merges `new` itself with `--allowed-by "finding 500"`.

519\. Found by the builder while building S6 (2026-11-06): since S2 (10fbd3261) a warm `compare` drew design files as
they were at the resident's first request; the warm Vite design server runs with `watch: null` and never forgot a
drawn module. Every warm compare after an edit compared a stale design against the app. Why no tool caught it: no
spec edited a file between two requests of one warm server, and the S2 warm numbers were taken with no file changed,
so "fast" was measured but "fresh" never was. Fix (14c491450): `forgetDrawn()` before every request, spec in
sketch-stylesheets.spec (a variant edit stays stale until forget). Tool fix (B414): a resident end-to-end spec that
starts the real resident, runs `compare`, edits the part, runs `compare` again and fails if the second run shows the
old picture. Rule for every warm or cached path: its spec includes an edit between two runs.

521\. Tom (2026-11-06, screenshots of the builder's shells): "6 minuten hard blocking auf dem builder ist inakzeptabel.
das tooling muss schneller werden". The builder ran nine `compare` runs one after another in the foreground for the
push gate (finding 520); warm resident, still 47-106 s each. `design timings`: `compare-app-shots` 21-51 s per part
(design shots 1-3 s), `harness-watch-wait` 19-22 s on the first two runs, image cache 0 hits (S4 not built). A second
shell of the builder polled a scratch file with `until ... sleep 2` for 27 min with no timeout; the file never came.
Why no tool caught it: S2/S6 measured warm speed only on a small studio-lab part and an unchanged design, never on a
real studio page; `design timings` knows the targets but nobody reads it unless asked, and no target exists for compare
per part. Fixes (B416, ahead of every other slice after the push): (a) app shots of one compare draw in parallel pages
of the warm Chromium, like the render check (`INSPECTS_AT_ONCE`); (b) S4 image cache by input hash, so an unchanged
state is never shot again; (c) a compare of several parts in one call shares one harness wait; (d) target: a warm
compare of a studio page <= 10 s, and a run over target prints its slowest phase at the end. Process: the builder
never blocks on a batch of heavy runs in the foreground, and every wait loop has a timeout.

B416 phase 1+2 (in progress, then as built in the `perf(cli)` commit that adds this note): measured first - each app
shot of pages/sketches spent 10.05 s in `settledPanesOf` waiting for an overlay pane its design draws and the app never
opens (`PANE_COUNT_TIMEOUT_MS` 10 s); load 0.1-0.2 s, screenshot 0.06 s. Built: per-shot timing phases
(`compare-app-shot <state> load|settle|screenshot|...`); the pane wait capped at 1 s, ending early once the open panes
settle with no new one; a state whose app opened fewer panes prints `<state> note: the design draws N overlay panes,
the app opened M ...` (a note, not a failure: the 0 px pictures of other sessions had the same mismatch); design and
app shots draw 4 at once (`INSPECTS_AT_ONCE`) through the draw queue, shots in state order, a string pointer open still
aborts. Numbers (studio, read-only, resident off, harness cached): pages/sketches 340.8 s -> 19.7-25.7 s
(compare-app-shots 317.7 -> 5.0-6.0 s, design shots 10.1 -> 5.6-7.0 s, compare-actions 8.2-8.7 s untouched); pages/start
-> 2.5 s. Verified: specs (concurrency > 1 with order kept, fails at limit 1; pane cap and note), tsc, lint. Not
verified: warm resident numbers (not restarted, shared). Still over 10 s: design shots (S4 cache) and compare-actions.

523\. Tom (2026-11-06): "wenn ich zwischen 2 seiten wechsle wie icons und logo kommt immer pro frame noch ein loading
state. ich hätte erwartet dass das mittlerweile instant ist. oder ist das nicht teil davon?" It was not: B416 sped up
the CLI compare only. ADR 0186 (picture always under the live iframe) was decided 2026-11-04 for the sketch view and
still sits unbuilt inside B365, queued behind B345/B346. Why no tool caught it: the perf block was scoped to CLI runs
and `design timings`; Studio's own page switch has no timing and no target, so a slow switch is only seen by Tom. Fix
(doc agent, applies ADR 0186 to every frame view and ADR 0213): the Studio frame part of B365 joins the perf block
right after the resident cancel; measure first (per frame: picture available, loading shown), then build. Target: a
page switch shows every frame's stored picture in the first paint. Tool fix: Studio logs the page-switch time to
`design timings` with a target.
Tom, same day, screenshot of elements/shell-main@edit at 32 %: "auf shell main sieht man beim scrollen auch noch
stark pop in. auch bereits rendered sachen popen wieder rein wenn sie in den viewport kommen." Frames entering the
viewport show empty boxes, and frames already drawn go empty again on the way back. Not new: finding 430 (2026-11-04) and ADR 0186 already recorded it, open in B365; the doc agent took it as new
(a repeated report is a finding: check the findings list before recording). Added to the same item; target:
a frame with a stored picture is never empty on screen, on switch or on scroll, and a frame drawn once stays drawn.
Measured (c0 subagent, 2026-11-06, read-only, report `.claude/handoffs/agent-results/studio-page-switch.md`): the
"loading state" is an empty box. icons <-> logo leaves frames empty 350-1000 ms on every switch, also back to a page
seen seconds before: (a) the picture URL changes per switch (`view = Date.now()` in `system-view.component.ts:828-831`,
into `&view=..&rank=visible`, `host/design.ts:339-348`), so the browser cache never hits; (b) `/__design/open-points`
runs twice per switch, ~350 ms synchronous for the whole product (`read-open-points.ts:57`), and blocks the server, so
a picture answered in <1 ms idle waits 330-970 ms. shell-main first visit 1.2-1.7 s empty (all pictures redrawn; the
running server 5f60558 may predate 361d96eca, re-check after slice 2), second visit 414-799 ms (open-points + 6
connections per host). Scroll pop-in (finding 430) unchanged since 2026-11-04: cells past the 400 px margin unmount and
drop their picture, a live cell is an iframe with no picture under it (`sketch-view.component.ts:97-110`, template
:184-206). Doc agent (applies ADR 0186 and 0213): go, as 3 slices after slice 2 and before S7, in this order: B
`/__design/open-points` cheap (cached by input hash or per requested part) and called once per switch; A a stable
picture URL - view/rank leave the `<img>` URL, the URL changes only when the picture's content key changes (so a stable
URL never shows an old picture), with ETag/Cache-Control; C ADR 0186 in the sketch view: every cell renders its picture,
the iframe lies on top and shows once drawn, a far cell unmounts only its iframe. Why no tool caught it:
`page-switch.e2e.mjs` checks that the page renders, not that frames are non-empty in the first paint, and no e2e
scrolls a sketch. Tool fix: per-frame empty checks in `page-switch.e2e.mjs`, a new sketch scroll e2e, and the
page-switch time in `design timings` with a target (finding 523).
B416 phase 3 = S4 (in progress, then as built in the `perf(cli)` commit that adds this note, c0 subagent, 2026-11-06):
compare keeps its pictures on disk under `node_modules/.design-explore/compare-{design,app}-shots-<hash>`. A design
picture uses the design server's shot store (`server.shotStore`): its key is the frame (part, state, preset, width, bare,
emptySlots, checker, theme), it is valid while every file it was drawn from is unchanged (part source, embedded parts and
kit, styles, tokens, config), and the salt is the cli build and the Playwright version; the store now keeps the frame's
text ambient. An app picture's key is the sha256 of the cli build, the Playwright version, the hash of every built
harness file, the harness path and query (part, state, props, layout) and every other shot option (size, width,
forced, opened control and its markup, room, panes, frozen, ambient, prop check). No app cache for `--url`. A hit skips
the shot and counts in `design timings`; the action check reuses the design store. Numbers (studio, read-only, resident
off): pages/sketches cold 21.1 s, warm 8.0 s (91 hits, 0 misses; compare-states 0.7 s, compare-actions 3.9 s, ~3 s
process start); every design picture invalidated 14.4 s, the built app invalidated 13.6 s; pages/start 2.7 s cold, 1.8 s
warm. Floor after an edit: 30 design or app shots 6-7 s; compare-actions 3.5-3.9 s, mostly `actions-state` per state
(matrix states ~1.9 s).
B416 pane count (as built in the `fix(cli)` commit that adds this note, c0 subagent, 2026-11-06): the pane
`drawnPaneCountOf` counted on every pages/sketches state was the embedded `elements/studio-menu` panel (`<et-menu>`
inside `#studio-menu-surface`), which the closed menu marks `hidden`; the same false count hit studio-menu's own
four closed states. The counter now walks the tag tree and skips any mock inside a `hidden` element. A capped pane
wait fails the state again ("the design draws N overlay pane(s), the app opened M ..."); the note path is gone. No
time gained: the wrong count never cost the 1 s cap, because the wait already exits early once the open panes settle
with no new one (settle 0.05-0.18 s per shot before and after). pages/sketches warm 6.7 s, app pictures dropped
12.0 s, design pictures dropped 11.9 s (before: 6.6 / 12.0 / 12.1 s); pages/start 1.5-1.9 s. The rest after an edit
is 30 shots 4 at once (5.6 s, ~0.6 s of a wide shot is queue wait), compare-actions 2.9 s and ~3 s process start.
B416 compare-actions (as built in the `perf(cli)` commit that adds this note, c0 subagent, 2026-11-06): the 30 s
timeouts on elements/studio-menu and components/shell-project-switch were `readRingProbe` waiting Playwright's default
30 s for a menu item its own click had removed; it now answers `null` at once for a gone element, waits at most 1 s
otherwise and names that cap (`RingProbeTimeoutError`); the probe's click and focus got explicit timeouts. Each state's
action check result is kept on disk (`compare-actions`) under the cli build, Playwright, built harness, state, its design
markup and props; it stays valid while every design picture, embedded state and embedder list it read prints the same,
so an edit re-checks only the states that read it (action-cache.spec). Shot concurrency 6/8 not tried yet.
B416 phase 4+5 (as built in the `perf(cli)` commit that adds this note, c0 subagent, 2026-11-06): a resident request
whose client closes its connection (a `timeout 30s` kill) is aborted: its queued draws reject, the browser contexts it
opened close, a harness wait ends, the next request starts at once and the timings line logs exit 130
(run-abort.spec, server.spec). The ~2.4 s outside any phase on pages/sketches was the pixel compare of its 30 states
(PNG decode + per-pixel loop), not the file writes; it is now the `compare-pixels` phase and ~2.5x faster (same counts
and diff pixels on 60 real pairs). Each timings line logs `unphasedMs` (total minus the union of its phases), `design
timings` shows it, the compare target is 10 s, and a run over its target prints `over target: ... slowest phase ...` as
its last line. `settle` caps at 3 s and fails the state with a named `SettleTimeoutError` instead of waiting 15 s
silently. A compare of several parts already shares one harness start. Shot concurrency 6/8 not measured (context);
numbers in `.claude/handoffs/agent-results/b416-phase45.md`.
B416 abort follow-up (as built in e3f7a81dd, 2026-11-06): an aborted resident request no longer writes its
compare-actions results to the cache, so a half-run check cannot leave a wrong cached answer (action-cache.spec).
B416 phase 4+5 numbers (c0, resident, before a3a1e5c35 -> after): pages/sketches warm 3.59 -> 3.46 s, app pictures
dropped 8.78 -> 7.70 s; pages/start 0.58 / 0.81 s; studio-menu 0.50 s; `compare-pixels` 2.52 -> 0.98 s; `unphasedMs`
0.10-0.13 s. The compare part of ADR 0213 is met (warm 3.5 s, after an edit 7.7 s). Not met: the first cold compare
after a new CLI build hit the 30 s kill (harness build 13.7 s + design shots 5.5 s + the rest cold), because every
cache key holds the whole CLI build. Doc agent (applies ADR 0213): this joins the perf block as its own slice after the
closing checks and before S7 - key each cache on the CLI files that change its result; it costs the builder a cold run
after every cli commit and would also blur the S7 number. Still open: shot concurrency 6/8, a `compare-pixels` cache by
picture hashes (1.1 s warm), a capped settle in `live-actions.ts` without a per-state catch (unverified).
B416 closing checks + shot concurrency (as built in the `perf(cli)` commit that adds this note, c0 subagent,
2026-11-06): compare shoots `COMPARE_SHOTS_AT_ONCE` = 8 states at once (the draw queue's cap), apart from the render
check's `INSPECTS_AT_ONCE` = 4. pages/sketches with app pictures dropped, 3 runs each: 4 -> 8.13/7.50/7.70 s, 6 ->
7.13/6.38/6.20 s, 8 -> 5.79/5.87/5.74 s (app shots 5.4 -> 3.6 s); state lines identical in all nine. Real edits in a
scratch worktree (`--checkout`, its own resident): a design edit of components/zoom-chip re-shoots all 30 design
pictures (all draw the chip) and the 15 app pictures whose forced button text changed, every diff px moves, the run
after is all hits; an app edit re-shoots all 30 app pictures, design pictures stay hits, diff px fall back. Finding 519
does not recur. After-edit runs miss the 10 s target under load 12-17: design edit 13-18 s (design shots 5.7-8 s,
compare-actions 3-4.5 s), app edit 12.3-12.8 s; the next run 2.4-3.4 s.

524\. c0 (2026-11-06), while measuring B416 phase 4+5: the first killed resident run wrote "browser has been closed"
failures into the compare-actions cache, and every later run read them back as results. Fixed in e3f7a81dd. Why no
tool caught it: no cache spec ran an aborted run; each cache was only tested with runs that finish. Tool fix: every
on-disk cache of the compare (compare-actions, the S4 design and app picture caches, the shot store) gets a spec that
aborts a run mid-way and proves nothing of it is kept; the shared cache writer refuses a write once the run signal is
aborted, so a new cache gets this for free.

525\. Tom (2026-11-06), on the Mac perf session: "der mac perf test braucht auch den aktuellen stand des repos oder sonst
machen dessen tests ja wenig sinn". The Mac session copies the repo by `git push` into its own checkout; nothing made it
re-sync before a run, and nothing in a report said which commit was measured, so a Mac number from an old state looks
like a current one. Fix (doc agent): the Mac session pushes and resets before every measurement and names the measured
sha. Tool fix: each `.timings.jsonl` line logs the commit (short sha + dirty flag), `design timings` shows it, and it
marks a line whose commit is not the checkout's HEAD as stale.
B416 slice 1 (as built in ecb9a8f46, c0, 2026-11-06): the 519 edit-between-runs check passed with a real edit in a
scratch worktree on its own resident (`--checkout <wt>`): a design edit of `components/zoom-chip` (text in all 30
pages/sketches states) re-shot all 30 design pictures and only the 15 app pictures whose key holds the text; the
matching app edit re-shot all 30 app pictures and kept the design hits; the next run 104/104 hits, no stale picture.
Compare shots 8 at once (`COMPARE_SHOTS_AT_ONCE`; render check stays at 4): app cache dropped 4 = 7.5-8.1 s, 6 =
6.2-7.1 s, 8 = 5.7-5.9 s. Warm sketches 2.55 s; the run after an edit 2.4-3.4 s. NOT met: the first run after a real
edit 12.3-18 s (design shots 4.4-8 s, app shots 4-5.4 s, compare-actions 3-3.9 s, compare-pixels 1.1-1.5 s), under
load 12-17 from other sessions, zoom-chip being the worst case. Doc agent (ADR 0213): an "after-edit floor" slice
after slice 2: first measure a single-state part edit on an idle machine (the typical case) and the zoom-chip edit
(worst case), then cut by measured phase: compare-actions re-checks only the states whose action inputs changed (the
a3a1e5c35 note claims this already - verify why every state re-ran), compare-pixels cached by both picture hashes,
design shots at 8. The 10 s target holds for the typical edit; the worst case is reported, not a gate.

526\. c0 (2026-11-06): the after-edit numbers of B416 slice 1 ran under load 12-17 from other sessions, so 12.3-18 s
cannot be told from a slow tool. Why no tool caught it: a `.timings.jsonl` line holds no machine state, so a noisy run
looks like a clean one. Tool fix: each line logs the 1-minute load average and the core count, `design timings` marks a
line with load above the core count as noisy, and a target verdict uses only clean lines.

527\. c0 (2026-11-06), building B416 slice 2 (56b3f7954): `slow-checks.ts` imported one string constant from
`rules/visible-change`, which pulled compare-command and part-build-ready into the load order; moving `harnessShotOf`
changed that order, and part-ready.spec's `vi.mock` got the real `slowProblemsOf`. Fixed by moving
`VISIBLE_CHANGE_RULE` to `system/build-ready-contract.ts`. The spec caught it; the cause is that specs depend on module
load order. Tool fix (queued after the perf block, low priority): a lint rule that an import of a constant or type
from a rules/command module fails; shared constants live in a contract file.
B416 after-edit floor measured (c0, resident, HEAD 1b7621867, load 4.8-15, report
`.claude/handoffs/agent-results/after-edit-floor.md`): typical edit (sketch-status-badge, one state of pages/sketches)
design 6.9 s median (6.1-8.2) meets 10 s, app 10.8 s median (10.3-11.8) misses; worst case zoom-chip design 10.7-11.3
s, app 9.0-9.6 s; the next run 2.6-3.0 s. compare-actions has no bug: a one-state design edit re-runs only that state,
an app edit re-runs all 14 because the key holds the built app hash; the unchanged-matrix pair is the critical path
(1.5-1.8 s each). compare-pixels ~1.1-1.5 s uncached on every run, and actions wait for it. Design shots: all 30
re-shot after a one-state edit (shot key = the part module's whole dep file list, `serve.ts:454-505`), saturating at 4
(design-server bound). Building: actions overlapped with shots/pixels, the slow pair first; compare-pixels cached on
(design hash, app hash, pixel code hash); expected app edit 6.5-8.5 s. Doc agent: cut 2 (reuse design shots when the
renderer's markup and styles match, ~-3 s on design edits) waits until after the Studio frame slices, since the design
gate is met.
B416 after-edit cuts (as built in 9374350cf + 315a2e66c, c0, 2026-11-06): compare-actions overlaps state shots and
pixels; compare-pixels is cached on both picture hashes + the pixel code hash (`writeCacheEntry`). Clean lines
(load 5.4-6.2/32): typical app edit median 5.77 s (5.69-5.78, was 10.8), typical design edit 4.76-5.23 s (was 6.9),
zoom-chip app edit 6.78 s, every next run 0.91-1.04 s (was 2.6). The compare part of ADR 0213 is met, after an edit
too. Not verified: cold resident, `--all`/`--live` in real runs, load above cores.

528\. c0 (2026-11-06): the first after-edit commit (9374350cf) drew all 30 design pictures twice (the overlapped action
check did not wait for compare's design shots); only the per-phase measurement showed it, no spec failed. Why no tool
caught it: compare specs check results and order, not how often a picture is drawn. Tool fix (before S7, so the S7
number is trustworthy): a draw-count invariant in the compare specs - each design and app picture is drawn at most once
per run.
Studio frame B (as built in 600073630, c0, 2026-11-06): a warm `?part=` open-points call spent ~535 ms in the static
rules over the whole product (`ruleProblemsOf` via `buildReadyInputsOf`), ~39 ms in `readOpenPoints`; system-view and
part-approval fetched the same URL at once. Now `open-points-cache.ts` keys the rule result on a stat fingerprint of
~1300 files (6-8 ms); ready mark, hash, direct edit, slow results and build-ready stay live; Studio shares one in-flight
request per URL. Repeat call icons 520 -> 14-18 ms, shell-main ~650 -> ~42 ms (22 ms live build-ready of embedded
parts); first call after server start ~2-2.7 s unchanged. e2e "a part switch asks for its open points once" failed
before (2+2). Why no tool caught the double request: no e2e counted requests per switch. Doc agent: the hand-made
folder fingerprint is not accepted - it misses inputs outside the folders (an `implements` target in another app, the
tailwind version) and then shows stale open points. The key records every file the rules actually read, like the
compare-actions cache does, and a spec edits a file outside the old folder list.
Studio frame A (as built in 0114e0d76, c0, 2026-11-06): the picture URL holds only session, epoch and revision;
ranking goes by `POST /__design/view` from an `img[ethleteShotRank]` directive (ShotBoard); shot responses carry an
ETag (PNG hash), 304 and `cache-control: private, max-age=3600`; STUDIO_API_LEVEL 6. New e2e "a part shown before
paints every stored picture in the first frame": 0/2 before, 2/2 at 11-13 ms after. Risk: a content change that
Studio's redraw events miss now stays stale until the next revision (before, every switch refetched and hid such
gaps). Doc agent: a stale picture is the one outcome the stable URL must never cause, so the guard (every store write
bumps the revision Studio sees) goes into the next slice with the open-points tracked key, not after C.

529\. c0 (2026-11-06), slice A: a stable URL alone painted 0/2 - Chromium drops a picture from its memory cache once no
`<img>` holds it while the other page loads. ShotBoard now keeps the last 500 loaded pictures as `Image` objects. Why no
tool caught it: the earlier reuse proof (measurement of finding 523) only worked because the old `<img>` was still
alive; the proof had a hidden condition the real switch does not meet. Tool fix: done - the new e2e measures the real
switch (old page gone) instead of a held element; a measurement that proves a fix names what it kept alive.

B416 slice 2 (as built in the `perf(cli)` commit that adds this note, c0 subagent, 2026-11-06): each on-disk compare
cache is keyed on the cli code that changes its result, not the whole cli build (`code-hash.ts`): the import graph of
named producer modules, read from the built cli (or the source in specs), types-only imports dropped like tsc drops
them, `timings`/`phase-timing`/`run-abort` left out, `serve` counted by its own text but not followed. Design pictures
(Studio's and compare's shot store): serve, shot, thumb, render and the server transforms plus the frame assets. App
pictures: the new `system/harness-shot.ts` (`harnessShotOf` moved out of compare-command, which is no longer in any key)
and compare-cache. compare-actions: actions-command and its graph plus the design picture code. 524: the shared
`writeCacheEntry` writes nothing once the run signal is aborted; an abort spec for the shot store, the app picture cache
and compare-actions. 525/526: each `.timings.jsonl` line logs `commit` (short sha + dirty) and `load` (1-minute average,
cores); `design timings` shows both, marks STALE (not HEAD) and NOISY (load above cores, or none logged), and its target
verdict and miss list count only clean lines; a run's own over-target line says when it was noisy. Verified: specs
(an edit between two hashes for each producer kind, abort per cache, timings), both tsc, lint. `VISIBLE_CHANGE_RULE`
moved to `build-ready-contract.ts`: slow-checks imported it from the rule module, which pulled compare-command and
part-build-ready into slow-checks' own load. Measured (pages/sketches, no resident, `timeout 30s`, load below cores):
cold 29.8 s, timed out (harness build 15.7 s); warm 2.9 s, 105/105 hits; an unrelated built file edited, 3.0 s, 105 hits;
`harness-shot` edited, 9.0 s, 44 misses (app pictures and actions; design pictures hit); `shot` edited, 14.1 s, 74
misses. Details: `.claude/handoffs/agent-results/b416-slice2.md`.

B416 after-edit floor (as built in the `perf(cli)` commit that adds this note, c0 subagent, 2026-11-06): measured first
(resident, load 4.8-15): a single-state edit (sketch-status-badge, state idle) - design edit 6.9 s median meets 10 s, app
edit 10.8 s median misses; zoom-chip worst case 9.0-11.3 s. compare-actions re-checks only changed states (no bug; an app
edit re-runs all by its built-app key). Built: compare-actions starts with compare-states once the harness is up, its
note lines are held and printed where they were, so state lines and exit code are unchanged (spec: the shots wait for
the action check to start). compare-pixels keeps each state's result and diff PNG in `compare-pixels` through
`writeCacheEntry`, keyed on both picture hashes and `pixelCompareCodeOf()` (part-compare, pixel-cache). Verified: specs
(an edit between two runs misses only that state with the new px count; same lines and diff files from the cache; abort
keeps nothing), both tsc, lint. Not built: the slow unchanged-matrix states first - the batches run in turn, each in a
fresh browser, so a reorder saves nothing; a pool needs the browser threaded through the check. Follow-up `perf(cli)`
315a2e66c: the overlapped check waits for compare's design shots before it draws its own, which now hit the shared store
(the first measurement drew them twice at once: actions 6.6-7.0 s after a design edit). Measured on 315a2e66c (worktree
resident, `timeout 30s`, load 5.4-6.2 of 32, every line clean in `design timings`): app edit (studio-labels idle, fresh
text) 5.69 / 5.77 / 5.78 s, 89/45 (app shots 3.8 s, actions 3.45 s hidden under them, pixels 0.04 s), **meets 10 s**;
design edit 4.76 / 4.86 / 5.23 s, 102/32; zoom-chip app edit 6.78 s (pixels 1.31 s, all 30 app pictures change); every
next run 0.91-1.04 s, 134/134 (was 2.6 s). Deferred: reuse design shots by render output.

Studio frame B (as built in the `perf(cli)` commit that adds this note, perf subagent, 2026-11-06): measured first, the
~520 ms of a warm `/__design/open-points?part=` call were the static rules of the whole product (`ruleProblemsOf` 535
ms; `readOpenPoints` only 39 ms). Built: `system/open-points-cache.ts` keeps the product's open points and build-ready
inputs keyed on a stat fingerprint (path, mtime, ctime, size) of the own and base product folders, the config file, the
configured stylesheets and each harness app's `src` (~1300 files, 6-8 ms); the answer's ready mark, direct edit, slow
results and build-ready stay live. Studio sent two requests per switch: the System view's open points and the part
approval both asked; `openPointsAnswer$` now shares one request between overlapping calls. Verified: a spec with a
comment, a sketch and a part file edited between calls (fails with a constant key), both tsc, lint, the Studio specs, and
the new canvas e2e case "a part switch asks for its open points once" (2 + 2 requests before, 1 + 1 after). In-process
(the handler, warm, load 6 of 32): first call ~2.0-2.7 s with module load (unchanged); repeat icons 520 -> 14-18 ms, logo
14-16 ms, elements/shell-main ~650 -> 42 ms (the live build-ready over its embedded parts is 22 ms of it). `design check
--product studio --part pages/system`: 0 findings (only host services changed, no rendered component). Not measured: the
page-switch empty-frame time in headless Chromium and a curl against a served build (a second server would write into
the checkout). Not cached: a rule input outside those folders (e.g. an app file outside the harness `src`)
stays stale until a fingerprinted file changes. Details: `.claude/handoffs/agent-results/studio-frame-b.md`.

Studio frame A (as built in the `perf(cli)` commit that adds this note, perf subagent, 2026-11-06): the shot URL no
longer carries `view`/`rank`. Studio's `ShotBoard` posts the mounted shot URLs (active, shown) to `POST /__design/view`;
the draw queue ranks by that board (active, shown, plain, asked under an older view), the URL params still work. The URL
is keyed on session (Studio load), epoch and revision (edit spec: a part redraw changes the URL); the shot answer carries
an ETag (304 on a match) and `private, max-age=3600`. A stable URL alone did not paint in the first frame: Chromium
dropped the unreferenced picture from its memory cache, so `ShotBoard.hold` keeps the last 500 loaded pictures as
`Image` objects. e2e `a part shown before paints every stored picture in the first frame` (canvas.e2e, not
page-switch.e2e, which runs on the main checkout): before 0/2 pictures in rAF 1, after 2/2 in rAF 1 (+11-13 ms). Not
measured: icons/logo and shell-main switch times. Not built: finding 523 timings line. Details:
`.claude/handoffs/agent-results/studio-frame-a.md`.

Studio frame A verified, finding 523 (as built in the `perf(cli)` commit that adds this note, perf subagent,
2026-11-06): the e2e case `a part shown before` passes on the rebuilt CLI (2/2 pictures in rAF 1, +12 ms). `design check
--product studio` on `pages/system` and `elements/canvas-frames`: 0 findings. New canvas e2e case `page switch time is
logged to the design timings` (own temp servers): click until every new frame shows a loaded picture or its live
iframe. icons -> logo seen 10-12 ms (no request), first visit 200-1700 ms (both shots `drawn` in the temp checkout).
Each switch appends a `page-switch` line (page seen before, target 100 ms) or `page-switch (first)` (no target) to
`.ethlete/design/.timings.jsonl`, so `design timings` shows them with STALE/NOISY; sub-second times print in ms. Not
measured: icons <-> elements/shell-main; after that switch no `img` or `iframe` with the shell-main part URL was in the
DOM within 15 s although 18 shell-main shots were drawn. Details: `.claude/handoffs/agent-results/studio-frame-a2.md`.

530\. c0 (2026-11-06), finding 523 verification (1dce81941): the page-switch e2e measured only icons, logo and system;
the switch to `elements/shell-main` - the heaviest page and the one the Mac numbers flagged - drew 18 shots but no
frame with its part URL mounted within 15 s. Cause open: a wrong selector or leaf in the e2e, or Studio not mounting
the frames. Why no tool caught it: the switch list was picked by what worked, and a switch that never finishes was
dropped instead of failing. Tool fix (slice C): shell-main joins `PAGE_SWITCHES`; a switch that shows no frame within
the cap fails the e2e rather than being left out. c0 reports the cause; if Studio does not mount the frames, that is a
Studio defect with its own finding.

Open-points key and revision guard (as built in the commit that adds this note, subagent, 2026-11-06). Part 1:
`cachedOpenPointsOf` runs `readOpenPoints` + `buildReadyInputsOf` inside `trackedRun` (`system/tracked-reads.ts`), which
wraps the sync `fs` reads (stat-like and folder listings) for the run, so a new rule's read is recorded without a list.
A hit needs the same product JSON and every recorded input printing the same (stat; listing; missing counts). Spec: an
fs spy on every non-write `*Sync` function asserts the acme rules open nothing the tracker missed; guard spec (finding
519): an `implements` target in another app, a config value, a package version, a vanished file and a new folder entry
each give a fresh result. Repeat call on the main checkout: icons 12, logo 11, shell-main 38 ms (before 14-18, 14-16,
~42). Part 2: the shooter hashes each kept picture; a changed hash for a key that no `forget` or announced `clear`
dropped calls `changed`, and the server sends a `parts` event with the next revision. Bug fixed on the way: a flows
change cleared the shots without a `parts` event. canvas e2e `a part edited on disk while away shows its new picture on
return`: passes (12/12 pictures changed), fails with Studio's part revision held constant. Details:
`.claude/handoffs/agent-results/open-points-key-revision-guard.md`.

Open-points read-tracked key and revision guard (as built in 934616670, c0, 2026-11-06): `tracked-reads.ts` wraps the
sync fs calls (read, exists, stat, readdir/opendir) during the rule run; a hit needs the same product JSON and every
recorded input reading the same; the folder fingerprint is gone. Specs: an `implements` target in another app created
and removed, a config value, a package version, a new folder entry and a vanished file each give a fresh answer; a
completeness spec spies every non-write `fs.*Sync` and fails on an untracked read. Repeat calls: icons 12-19 ms, logo
10-11 ms, shell-main 37-40 ms. Not tracked: `fs.promises`, child processes, an already-cached `require()`, a copy a rule
holds in memory (no rule uses them; not proven).

531\. c0 (2026-11-06), revision guard: Studio showed an old picture after a change. Studio's `revision`
(`frame-revisions.ts`) moved only on a server `parts` event, but two paths swapped a picture without one: a flows change
cleared every shot and sent only `flows`, and a `fresh` draw (merge-compare) replaced the stored picture. With frame A's
stable URL, the 1 h cache and `ShotBoard.hold`, the old picture stayed. Why no tool caught it: no spec tied a store
write to Studio's revision; before frame A every switch fetched the picture again and hid the gap. Tool fix (done in
934616670): the shooter hashes every kept picture per key, and a changed hash that no announced redraw dropped calls
`changed(part)` (revision bump + `parts` event); `clear` requires `{announced}`. Guards: shot.spec and shot-store.spec
(flows change then a changed picture sends a `parts` revision; fails if the flows path claims announced) and the e2e
"a part edited on disk while away shows its new picture on return" (12/12 new pictures; fails with the revision held).
Lesson: a cache that makes a page faster also hides a missing invalidation, so every cache slice adds an
edit-while-away e2e before it is called done.

532\. c0 (2026-11-06): the orphan-endpoint rule throws ENOENT when the app folder of an `implements` path is missing
(found while building the read-tracked key, not perf). Why no tool caught it: the rule specs only use fixtures where
every linked app exists. Tool fix (queued after S7): the rule reports a missing app folder as a finding instead of
throwing, with a spec for it.

Studio frame C (as built, 2026-11-06): ADR 0186 in the sketch view. Every cell keeps its stored `<img>` (with
`ethleteShotRank`); a live cell lays its iframe over it, hidden until `FramePaintedDirective` (`paintedFrame$`, shared
with the part-page frame) reports the page painted. canvas e2e: the sketch scroll case (fails on the old view with
blank iframes on the way back up, 0 now), the edit-while-away sketch case (fails with the sketch revision held), and
`elements/shell-main` in `PAGE_SWITCHES`. Finding 530's cause was the e2e: it clicked the sketch leaf `shell-main`
under the part row, which opens the sketch view, not the part page.

Studio frame C (as built in c77c781d5, c0, 2026-11-06): ADR 0186 in the sketch view. Every cell always renders its
`<img>` (`ethleteShotRank`); the live iframe lies over it, invisible until painted, then the picture hides; a far cell
drops only the iframe. Paint detection is a new `frame-painted` directive around the existing `paintedFrame$` (shared
with `canvas-frame-grid`). The live-slot choice is unchanged. e2e scroll case: before 8 up-steps with a blank iframe at
+30 ms, after 0 empty at every step and sample; edit-while-away for a sketch cell (rule of 531): fails with the
revision held, passes with a new URL and ETag. 530 closed: the cause was the e2e selector, not Studio - the e2e
checkout has two tree rows named shell-main (the part and a sketch), and the case clicked the sketch row. The case now
picks the part row, and a switch without a frame fails with a DOM dump. icons -> shell-main seen 14 ms, back 11 ms;
first visit 6.3 s (all drawn, nothing stored in the temp checkout). Verified: Studio tsc and lint, sketch-view spec
17/17, merge/discard e2e. `design check --product studio --part pages/sketches` on c77c781d5: exit 0, 0 findings (42.8 s non-resident, only the
baselined DROPPED-PROP lines of finding 489). Open: whether NG0953 "Unexpected emit for destroyed OutputRef" in the sketch-view merge spec
predates C; the scroll e2e covers one column only.

533\. c0 (2026-11-06), checking slice C: `sketch-view.component.spec.ts` logs "NG0953 Unexpected emit for destroyed
OutputRef" twice and still passes, before slice C (c77c781d5^, 16/16) and after it (17/17). A component emits an output
after it was destroyed. Why no tool caught it: the Studio specs do not fail on an Angular runtime error that is only
logged with `console.error`. Tool fix (queued after S7, not perf): the Studio test setup fails a spec on any logged
`NG0` error, and the emit after destroy in the sketch view is fixed in the same slice.

528 tool fix (as built, c0, 2026-11-06): `compare-draw-once.spec.ts` runs the real `designCompare`, `shootStatesWith`
and `checkActions` on fake drawers (a shooter over a shared design store, a counted `harnessShotOf`, a disk-cached
built app) and fails on any picture drawn twice in one run (`draw-count.test.ts`). Paths: cold with the overlapped
action check (3 design + 3 app draws), warm (0), design edit (3 design, 0 app), app edit (3 app, 0 design), `--all`
over two parts. Bite: dropping `designsDrawn` from compare or its `await` in `checkActions` fails 3/4 cases with
"design components/chip default drawn 2 times". HEAD has no double draw. Not covered: `--live`, the real shot store.

534\. c0 (2026-11-06), S7 measurement at b7b19adb7 (load 3.3/32): a full `design check --product studio` takes 308 s,
warm the same as cold (0/131 cache hits, not resident). Its `.timings.jsonl` line had `unphasedMs` 307.3 s: the check
has no phases, so `design timings` could not say where the time goes; only a hand-timestamped run split it
(completeness draws ~154 s, render inspect ~90 s, auto-accept ~38 s, open points + READY/GO ~13 s, static system ~9 s).
Why no tool caught it: a timings line accepts any size of unphased time. Tool fix (S7a): `timedPhase` around every check
step, and `design timings` flags a line whose unphased share is above 10 % of the run as unexplained.
Doc agent, S7 plan (applies ADR 0213 and ADR 0204): order S7a (check through the resident, warm draw threaded into
every step, phases) -> S7b (per-part disk cache of render issues and completeness gaps) -> S7c (auto-accept on the
picture cache, parallel lanes) accepted. A check in the resident must not push a compare past its 10 s target: the
resident runs a waiting compare between two parts of a running check, with a spec for it. Each S7b cache input named as
a risk (fonts, frame assets, dist CSS, generated Tailwind output, config, capabilities, merged and pictures JSON) gets
its own edit-between-runs case (rule of 531).

S7a as built (ecb5057b2, 2026-11-06): `design check --product`/`--part` runs in the resident (not its --rules/--live/--slow/--visible-change/--app-classes/--receipt/call forms); the resident's WarmDraw reaches auto-accept, render inspect, completeness, bespoke controls, dropped props and action lost (the last two load on the warm server); every step is a phase (stale-dist, auto-accept, static, render-inspect, completeness, open-points, tail, summary). A waiting compare runs between two parts of a running check (yield points in auto-accept, inspect groups and completeness; a jumped compare reuses the check's lib-build read and never restarts the warm server), and `design timings` flags a run with over 10 % (and at least 1 s) unphased time as UNEXPLAINED. Numbers (load ~3/32, sha ecb5057b2 dirty only by the design json): before 308.0/307.5 s non-resident, unphased 307.3 s; after 306.4 s (cold resident) and 297.6 s (warm), unphased 16 ms and 31 ms, same 2 findings (EDIT-OLD-NOT-FOUND pages/start, SKETCH-BASE-STALE), 173 finding lines identical between the two runs. Phases of the warm run: completeness 156.6 s, render-inspect 93.8 s, auto-accept 37.6 s, static 7.1 s, open-points 1.4 s, tail 0.9 s - the warm server saves startups only, the draws stay; S7b's per-part cache is the win. Verified: specs for routing, yield (compare queued during a fake check starts after one part), warm threading without createDesignServer/createDrawQueue, the timings flag; tsc, lint. Not verified: a no-double-draw spec with draw-count (the threading spec runs without a browser); the resident-queue-wait a real check causes for a real concurrent compare; warm vs non-resident results on the same tree in one sitting (only against the S7 baseline's 2 findings); `cachedOpenPointsOf` is not used by check (it caches the draw-less points) and stays as it was.

535\. c0 (2026-11-06), S7a: the as-built numbers needed a second commit (b8bbef168 after ecb5057b2), because
`yarn et:design` builds and runs the last commit, not the working tree; a slice cannot measure its own change before
it commits it. Why no tool caught it: nothing in a timings line says it ran code other than the one being changed
(finding 525 only marks a dirty tree). Tool fix (queued after S7): `et:design` takes an option to build the working tree
into its own scratch dist for a measurement, and its timings line is marked with the dirty commit, so a number is
never mixed up with the committed build's.
Doc agent: S7b split accepted - S7b-1 render-inspect cache with the key infra, the check draw-count spec and every
edit-between-runs case of the S7 plan; S7b-2 completeness cache on that infra, keyed on recursed parts. S7b-1 also
checks whether `partActionFailuresOf` in open-points starts its own harness server, and threads the warm draw into it
if so.

S7b-1 as built (df132a653, 2026-11-06): `design check` caches the render issues of each part group (product, part, sketch) on disk (`render-issues` under the checkout's vite cache, 64 MB LRU, `writeCacheEntry` so nothing is written after an abort). The key is the group's frame descriptors (computed fresh from the SSR load each run, so config, presets, states, skips and namespaces are in it), the render-inspect code hash with the frame assets (`renderInspectCodeOf`) and the Playwright version; the entry keeps every request the browser context made while drawing the group (url, accept header) with a hash of what the server answered, and is reused only while each of those urls answers the same when Node fetches it again (each url once per run, 30 s timeout). The drawing pages run with the browser cache off, so a module served from memory cache is still recorded. That covers part files, shared imports, tokens, the generated Tailwind output, fonts, frame.html and frame assets and the SDK dist CSS/JS without a hand-made fingerprint; merged.json, pictures.json and capabilities are neither served nor read by render inspect. The infra (`served-cache.ts`: `createServedHashes`, `createServedCache`, `servedHitOf`) is generic for S7b-2. Numbers (load ~3/32, sha df132a653 dirty only by the design json, resident): first run 309.2 s with render-inspect 95.1 s (cold cache), unchanged rerun 205.0 s with render-inspect 0.75 s; completeness 155.9 s is now the slowest phase. Same 2 findings, the finding lines identical between the two runs (the only diff: 20 `etProvideColor="brand" has no effect` console lines the first run printed). Verified: `render-cache-draw.spec.ts` drives the real `renderIssuesOf` on a fake WarmDraw (fake browser and page, real `inspect`), cold draws each frame once, warm 0, a part edit only that part, one case each for part file, shared import, CSS token, Tailwind output, font, frame asset, SDK dist CSS and JS, a changed state set, a no longer fetchable url, and config/capabilities/merged/pictures edits redrawing nothing; a broken `unchanged` fails 10 of 15. Not verified: a real edit between two real runs; a resident restart (another port) still hitting. Found: `partActionFailuresOf` in open points starts its own harness app per part (`withHarnessUrl`) and `checkActions` its own design server and Chromium (actions-command.ts:262), with no warm draw; threading it is still open (first run's open-points 13.1 s vs 1.4 s).

536\. Doc agent (2026-11-06), S7b-1 (df132a653): a warm check prints 20 fewer lines than a cold one - the
`etProvideColor="brand" has no effect` warnings of a draw are gone when the render result comes from the cache. The
finding lines match, but a cached run must not hide what a drawn run shows. Why no tool caught it: the cache specs
compare findings, not the whole output. Tool fix (S7b-2): a cache entry keeps the draw's warnings and a hit prints them
again; a spec compares the full output of a cold and a warm run. Also in S7b-2: a spec for a hit after a resident
restart on another port (the host is stripped from the recorded URLs, untested).

S7b-2 as built (6f2061c10, 52c079983, 2026-11-06), partly: `design check` caches each part's completeness drawing (`seeFrames`: seen, refused, changes) on the S7b-1 infra (`completeness-sights`, key = code hash, Playwright version, product, sketch, part, frames, own CSS, control parts); everything after the drawing (merged, exceptions, inventory, part hash, option values, recursion into embedded parts) still runs live each time, so config, capabilities, merged.json, pictures.json and sketch edits redraw nothing yet change the result, and an embedding part redraws because its drawing loaded the embedded module. POST requests (the `/__design/render` SDK renders) are now recorded with their body and fetched again with it, so SDK markup from the render worker is in the key (S7b-1 refetched them as a GET: a fixed 405). The worker returns what it logged per render; an entry keeps those lines and a hit prints them. Found with the real-edit run: every S7b-1 and S7b-2 input hash on disk was null - Node's fetch went to 127.0.0.1 while Vite listened on ::1 - and null == null counted as unchanged, so an edit of components/zoom-chip in a scratch worktree redrew nothing (render 0.78 s, completeness 0.31 s). Fixed in 52c079983 (fetch the listen address, a null hash never hits). The numbers measured before the fix are not valid: 6f2061c10 run 1 310.8 s, run 2 48.4 s (completeness 0.28 s), both with nothing verified. Also, in those runs the entries kept no lines, so the 30 warnings were still missing on run 2. Open: measure again after 52c079983 (two runs plus the worktree edit), and check that entries keep lines and the full logs match.

537\. c0 (2026-11-06), S7b-2 real-edit run: the S7b-1 render cache and the new completeness cache never verified
anything. Node re-fetched the recorded URLs on 127.0.0.1 while Vite listened on ::1, so every input hash was null
(14 814 render, 5 612 completeness entries), and null == null counted as unchanged: every entry always hit. A scratch
edit of zoom-chip ('Fit' -> 'Fitting') redrew nothing. SDK renders (`POST /__design/render`) were re-fetched as GET and
always got the same 405, so SDK markup was never in the key. The S7b-1 numbers (205 s warm) and the first S7b-2
numbers (48.4 s warm) are invalid. Why no tool caught it: every cache spec used a fake server with a fetchable URL, none
ran against a real Vite listen address, no spec required non-null input hashes for a hit, and S7b-1 reported its
numbers before a real-edit run (rule of finding 519). Tool fix: built in 52c079983 (fetch the server's own listen
address, a null hash never counts as unchanged, render requests re-posted with their recorded body, specs for each).
Doc agent adds: the cache writes no entry unless every input hash is non-null; `design timings` shows the null-hash
count per run and flags any above 0; and a cache slice reports no numbers and is not done until a real edit in a
scratch worktree has redrawn exactly the edited part and its embedders.

S7b-3 as built (294eef997, 44514b348, 2026-11-06), partly: the served caches write no entry when an input could not be fetched, the timings line records `nullHashes` and `design timings` flags runs above 0 (specs, both bite). Main tree after deleting the null-hash caches: cold 314.0 s, warm 50.7 s (auto-accept 38.2, static 7.1, render-inspect 2.0, completeness 0.93), load ~5/32, 0 null hashes on disk and in timings. Cold and warm logs are identical, the 31 `etProvideColor` warnings included: they come from the render worker and were lost only because the failed refetch carried no lines header. Not done: the real-edit worktree run. After the zoom-chip edit every one of 167 entries redrew, and an unchanged rerun redrew all again. The only changed inputs were the virtual modules `design-explore/env` and `design-explore/system`, which every part loads, so the cache is not verified and the 50.7 s does not count. Open: find what changes those modules between runs (a run's own writes to sketches, merged or ready are suspected), then the worktree edit and the resident restart.

536 closed (c0, 294eef997 + 44514b348): the 31 `etProvideColor` warnings come from the render worker drawing SDK
components for the title-bar and update-dialog frames; entries keep them since the re-fetch works (52c079983), and a
real-HTTP spec shows a hit prints them again. Full cold and warm logs are identical.

538\. c0 (2026-11-06), S7b-3: the rule of 537 failed. In a scratch worktree the zoom-chip edit rewrote all 167 check
entries (332 s), and an unchanged rerun right after it again all 167 (328.7 s). In every entry only
`virtual:design-explore/env` and `virtual:design-explore/system` changed: `serve.ts` `env()`/`systemRegistry()` list
every sketch (`sketchesOf`/`drawnOf`) and every part loads them, so any sketch change anywhere - including a check's own
writes (`sketches/*.edit` folders, merged/ready/pictures.json) - redraws everything. The main tree only looked warm
(50.7 s) because those writes had settled; that number does not count. Why no tool caught it: the edit-between-runs
specs edit one input of a fake part graph, none loads the real global virtual modules, and nothing runs the check twice
on a fresh tree, where a run's own writes become the next run's inputs. Tool fix (S7b-4): a real-tree test - cold
check, then an unchanged rerun on a fresh worktree must redraw 0 parts - and the cache key of a part holds only the
registry slice it reads, never a module that a check run rewrites. Done when the zoom-chip edit redraws exactly
zoom-chip, canvas-viewport, pages/sketches, flows, system, merge and inbox, also after `yarn et:design stop`.
538 causes and first fix (c0, 72457e493): auto-accept opens and closes `<part>.edit` sketches on every run
(`openEditSketch`), which adds and removes `<part>@edit` in the global modules; the render worker's id counters keep
growing (`et-label-30` -> 33), so the same template never hashed equal. Entries now key on a per-frame registry slice
(the frame's product parts, tokens, stylesheets, named sketch variants), and SDK render ids are renumbered before
hashing. Fresh worktree: cold 346.5 s; unchanged rerun 51.6 s, 0 of 167 entries rewritten, 0 null hashes; zoom-chip
edit 103.6 s, exactly 9 entries rewritten (zoom-chip and elements/canvas-frames, render of the five pages that embed
canvas-frames). Still open: a resident restart redraws everything (322.5 s) - `/@vite/client` holds a per-start
`wsToken` and an inline sourcemap. The new `/__design/registry-slice` route raises STUDIO_API_LEVEL 6 -> 7, so an
older resident restarts once (doc agent: accepted, Studio does not read the level). Doc agent for S7b-5: the spec
"hits after a resident restart on another port" failed once under load; it is fixed or made deterministic in S7b-5,
not rerun until green. For S7c: a check must not create and remove `.edit` sketches in the checkout on every run;
auto-accept works on the picture cache without opening an edit sketch.

S7b-4 + S7b-5 as built (72457e493, 07d3c5bcd, 2026-11-06). S7b-4 (538): three causes made every entry redraw. Auto-accept opens and closes `<part>.edit` sketches in the global env/system modules on every run; the render worker's SDK id counters grow per render; a worktree with `dist` symlinked to main's took another session's builds as input (copy `dist` instead). Entries key on the per-frame registry slice (`/__design/registry-slice`, STUDIO_API_LEVEL 6 -> 7) and renumbered SDK ids; a zoom-chip edit rewrites exactly 9 entries (render and completeness of zoom-chip and elements/canvas-frames, render of pages/flows, sketches, system, merge, inbox). S7b-5: `/@vite/client` holds a random per-start `wsToken`, and inline `sourceMappingURL=data:` lines embed host and token; both are dropped before hashing (spec, bites). A restart probe (a second server against the stored inputs of all 167 entries) found no other input that changes across a restart. Fresh worktree, CLI 07d3c5bcd, dist copied: cold 346.3 s; unchanged rerun 51.2 s, 0 of 167 rewritten, 0 null hashes; zoom-chip edit 103.3 s, exactly the 9 entries; after `design stop` the rerun took 70.9 s, 0 rewritten (render-inspect 2.1 s, completeness 0.8 s, open-points 13.5 s), log identical to the run before it. Main tree (07d3c5bcd, load ~3.5/32): cold 314.1 s (the code hash changed), warm 51.4 s (auto-accept 39.0, static 7.2, render-inspect 1.9, completeness 0.8), the known 2 findings, logs identical minus the resident start and over-target lines. The flaky spec "hits after a resident restart on another port": its cache key salts with `renderInspectCodeOf()`/`completenessCodeOf()`, which hash the live `libs/cli` source and `libs/cli/design` on every run, so a write there by another session between the spec's two runs changes the key (reproduced: rewriting a file under `libs/cli/design` every 10 ms fails every warm spec in both files). Both specs now mock the code hash and pass under the same writes. Open: auto-accept (~39 s) dominates the warm run; open-points redraws after a restart.

S7 check target met (c0, 07d3c5bcd, main tree, load ~3.7/32): full `design check --product studio` warm 51.4 s (was
308 s), 0 null hashes, known 2 findings, identical logs. Fresh worktree: unchanged rerun 51.2 s, zoom-chip edit 103.3 s
(exactly 9 entries), after `design stop` 70.9 s with 0 entries rewritten. Cold stays 314-346 s, above the 120 s hard
timeout of ADR 0213; S7c (parallel lanes, auto-accept on the picture cache) works on it. Per ADR 0215 the next builder
session runs the `ci-check` skill and pushes `next`.

539\. c0 (2026-11-06), S7b-5: the spec "hits after a resident restart on another port" failed now and then. Cause: the
check cache salt (`renderInspectCodeOf()`/`completenessCodeOf()`) hashes the whole live `libs/cli` source on every run,
so any write there between the spec's two runs - another session, prettier, `lint --fix` - forced a redraw; a 10 ms
write loop failed every warm case. The specs now mock the code hash. The same cause makes every `libs/cli` commit cost
the next dev check a cold 314 s. Why no tool caught it: the specs ran on a quiet tree; nothing wrote under `libs/cli`
while they ran. Tool fix (doc agent, S7c): the check caches use the per-producer import-graph hash of `code-hash.ts`
that the compare caches already use (B416 slice 2), so only an edit to the code that draws or inspects invalidates
them; a spec edits an unrelated `libs/cli` file between two runs and expects 0 redraws.

540\. c0 (2026-11-06), ci-check before the push of `next` (259 commits): typecheck was red since 1518330a1 (ET800
message, fifagg section 12 work): `legacy-state-replay.scenario.spec.ts:111` called `prepare()` without its argument.
Fixed in 263654c41. Why no tool caught it: the pre-push hook leaves typecheck to CI, and with the push parked (ADR 0213) no CI ran for 259 commits, so a type error stayed hidden for hours. Tool fix (ADR 0216): while a push is held, the builder pushes each slice to its own branch with a draft pull request so the full CI runs. Also: the vitest
cache `libs/query/.vitest/` is untracked and not ignored, so local `format:check` fails on it; `**/.vitest/` goes into
`.gitignore` (builder).

541\. Doc agent (2026-11-06), push of `next` (264 commits): the pre-push design gate refused seven parts with
IMPLEMENTATION-UNCOMPARED. Compared: pages/flows and elements/studio-menu ok and verified; pages/inventory and
pages/start compare ok but `--verify` needs a check record; pages/merge `merge-error DIFF 2 px`; pages/sketches 13
states DIFF (up to 135 661 px) and 2 missed actions ("Alle Zustände zeigen"); pages/system 10+ states DIFF and 6
missed actions ("Kommentar", "49 offen", "Gründe"). Why no tool caught it earlier: the gate runs only at push time, and
the push was held for hours (ADR 0213), so app changes piled up uncompared. Tool fix: ADR 0216 (draft PR with full CI
per slice while a push is held); the design-rules gate is part of that CI.

542\. Builder on the Mac (2026-11-06): the subagent brief rule "run the gate with `timeout 600s`" fails on macOS,
which has no `timeout` command. The rule lived only in the builder handoff, written on Linux, so no tool or skill
checked it against the Mac. Tool fix (builder, with S7c): briefs use the Bash tool's own `timeout` parameter (max
600000 ms, the same on every OS) or `run_in_background` with a Monitor deadline, never the shell `timeout`; the rule
moves from the handoff into the builder-agent skill. A run with no deadline at all is not the fix: a hung gate then
blocks the builder silently. Also: the full gate took 134.4 s on the Mac, 98.6 s of it lib-build-wait at load 13.9 on
12 cores; S7c measures it again on a quiet machine. Gate now refuses five parts (inventory, merge, sketches, start,
system); pages/flows and elements/studio-menu pass.

543\. Builder on the Mac (2026-11-06), the four refused parts: (A) `harnessShotOf` photographed the harness host
before the lazy part mounted, so a loaded machine got a blank page (merge `open` 1.29M px); fixed with
`@else if (current)`. (B) design picks merged after 2026-11-01 were never ported to the app (comment-draft surface and
role, sketches sample `fit`, fixed; system popover "Ausnahmen" group and the `agent`/`call` props without app inputs,
open). (C) since 5a29b1b94 the sketches design draws real title-bar/zoom-chip renders per frame, but the harness gives
SketchesComponent no `shot` template, so every frame is empty. Fonts Mac vs PC: not a cause. Why no tool caught it: CI
`design compare --all` compares only done parts (`doneParts` in part-task.ts needs implemented hash == ready hash and
no changed app files), so a merged pick or an app edit silently drops the part from the CI compare. Tool fixes
(builder, after push safety): (1) `--all` compares every part with an implemented record and lists parts that drifted
out of done; (2) a merged pick on a part with an `implements` link opens a port task; (3) `harnessShotOf` waits for a
mounted child of the host, not only a visible host.

549\. Builder (2026-11-07), pages/system compare at load 157: a fixed 15 s design draw timeout skipped the whole action
check, and only one trailing line said so; the run took 473 s. Why no tool caught it: a skipped check counts as a
pass in the summary, the same class as finding 545 (a rule that silently does nothing). Doc agent decisions
(technical): retry once with a timeout scaled by the machine load, and a skipped action check counts as FAIL in the
summary. The parallel work of ADR 0219 drove the load to 110-157 on 12 cores; the builder caps parallel compare
agents so that a compare result still carries a verdict. pages/system port questions, decided by the doc agent as the
design-is-truth rule: the old Ausnahmen toggle in system-view goes, the popover is the design; system-view moves to the
page component for call and themes now; `agent` becomes a known unbound input with the reason "no progress source",
removed when a source exists.

551\. Builder (2026-11-07), `sketch check pages/sketches@all-states` (850 s at load 118): ready refused because variants
b and c "first change zoomed-page" with the same pixels as a. Cause: the sketch carries its own copy of
`shared/sketch-rows.ts`, made before 1afe49a71; the base now snaps the camera, the copy does not. Why no tool caught it:
a base change after `sketch new` never reaches the sketch's shared copies, and the check blames a variant for a
difference no variant made. Doc agent decision (technical): `sketch check` compares each shared copy with the base file
it came from (hash in sketch.json) and names a stale copy with the base commit; `sketch rebase` brings unchanged copies
forward. Base problems reported the same in a/b/c (UNREACHABLE "Übernehmen" in far-out, CUT-CONTROL 64 px in
unchanged-matrix-open, 90 frames over the 24 budget) are the base part's open points and do not block the sketch.

556\. Builder (2026-11-07), 555 slice: a relative `core.hooksPath` finds no `.husky/_` in a worktree (the folder is
gitignored), so hooks did not run in agent worktrees even after the install. The builder set the absolute path by
hand. A later `yarn install` sets the relative path again. Why no tool caught it: the 555 check accepted any path that
resolves in the main checkout. Doc agent decision (technical): the postinstall runs a script that calls husky and then
sets the absolute path when `.claude/worktrees` exists; `hooks:check` fails in a worktree when the path does not
resolve there.

557\. Builder (2026-11-07): the first commit with the hooks on took about 15 min (related specs and typecheck at high
load). Why no tool caught it: no budget covers the pre-commit hook; on the Mac it never ran (555). Doc agent decision
(applies ADRs 0017 and 0218, a fault seen on the slow machine becomes a budget): the hook joins the performance block
(S7c). The builder measures it at low load per step and proposes a target; the target number goes to Tom.

557 data point (2026-11-07): S7c-1 (part picture cache, 539 render-inspect key 202 -> 64 modules, 553 physical cores
and one shot file per variant) is staged in worktree agent-afba22bc5202ed617, not committed. For a cli change the
pre-commit hook runs 1354 related specs; at load 60-135 they failed with 49, then 40 failures (23 timeouts). The agent
did not bypass the hook.

557 as built (2026-11-07): `design/paths.ts` is split into `design-config` (config types, `DESIGN_DIR`,
`readConfig`), `package-root` (`assetRoot`, `snapshotPackage`), `work-root`, `vite-cache` and `is-running`; 192 imports
moved, no barrel. `system/base.ts` stays whole: `loadBase` and `baseDirOf` reach the same 167 specs, so a split gains
nothing. Related spec files (static import graph, 316 cli spec files): paths 177 -> design-config 169, package-root and
work-root 175, vite-cache 111; base 167 unchanged. The split barely helps. The real hub is a cycle of 48 modules
through `serve.ts`: 7 system modules (actions-command, compare-command, complete, live-actions, live-compare,
live-uncovered, render-check) and warm-draw import `serve.ts`, so any module in the cycle relates at least 111 specs.
Breaking that cycle is the next step.

558\. Builder (2026-11-07): 3 auto-merge specs in `sketch-command.spec` fail on `next` without any change. Why no tool
caught it: the pre-commit and pre-push hooks never ran on the Mac (555), and `next` is not pushed (ADR 0215), so CI
never ran these commits. Doc agent decision (technical): the next builder fixes the 3 specs first; the run over the
whole unpushed range (555 decision) includes the full cli and Studio spec suites at low load.

559\. Doc agent (2026-11-07): the builder said "the session restarts after this turn" and then sat idle for about one
hour; nothing landed. `agent-sessions.mjs restart` waited the whole time: `.ethlete/restart.log` shows "waits, draft:
⏺ main" again and again. `draftLine` takes the last pane line that starts with `❯` as the prompt, but with background
agents open Claude Code shows the agent panel below the prompt (`❯ ⏺ main`), so the empty prompt reads as typed text.
Why no tool caught it: the draft spec has no captured pane with the agent panel, and a restart that waits or gives up
tells nobody. Doc agent decision (technical): `draftLine` reads the prompt line above the footer rule, not the last
`❯` line, with a spec on a captured real pane that holds the panel; a restart that still waits after 2 min of draft
sends one mailbox line to the caller and the doc agent, and a restart that gives up says so in the same way.
Addendum (2026-11-07 11:40): the builder hung about 9 h until Tom asked. A manual clear by the doc agent showed a second
cause: the keyboard focus sat in the agent panel, so typed text and Escape went into the panel, not the prompt. Two Up
presses moved the focus to the prompt and recalled a history entry; C-u then emptied the line before `/clear`. Tool
fix: `restart` moves the focus out of the panel (Up until the prompt line is focused, then C-u) before it types, and the
spec covers a pane with panel focus. Process lesson: the doc agent waited for Tom to type `/clear` by hand although Tom
allowed it to restart the builder; when a restart hangs, the doc agent drives the pane itself.

559 as built (builder, 2026-11-07): `draftLine` reads the text between the last two rules of the input box; a `❯` menu
line below the last rule still wins, and panel rows (`❯ ⏺`, `◯`) never count. `leavePanel` presses Up (at most 10) while
a panel row holds the `❯`, then C-u; `restart` and the dispatch wake call it before they type. A draft that blocks 2 min
and each give-up send a mailbox line to the caller and each `--notify` agent. Specs: a captured real pane with panel
focus (fixture `claude-pane-agent-panel.txt`, a fake pane that drops the panel focus on Up), and the notices. Verified:
the agent-sessions spec file. Not verified: a bite run of the new specs on the old script, a live restart of a real
Claude pane, Codex panes.

562\. Doc agent (2026-11-07): Tom, twice in one morning: "Wir warten hier schon wieder rum. Warten ist keine Option".
The builder ended its turn with "Waiting for 1 background agent to finish" and 83 unpushed commits, and the doc agent
reported "the push follows when the agents land" instead of starting more work. Why no tool caught it: the
builder-agent and doc-agent skills allow a turn to end on a wait; nothing flags an idle pane with a non-empty queue.
Tool fix (technical): both skills say a turn ends only with agents running on every independent open item, and a push
never waits for an unrelated agent; the doc agent's periodic check reads the builder footer and sends a nudge when it
shows "Waiting for" while STATUS.md has open builder rows.

549 as built (2026-11-07): the design draw wait stretches by machine load (`loadScaledMs`), and a compare whose action
check could not run prints `actions: no verdict - <why>, retry` (b56914c71's NoVerdict shape), then
`FAILED actions: not checked, so no action counts as working` and exits 1, so a skipped check never passes. Cherry-picked
onto `next` as 1f9f7a87e (conflict with b56914c71 in `compare-command.ts` and `part-compare.spec.ts` resolved by keeping
the NoVerdict print and adding the FAILED line); the Studio System page port is 9bc56da98. Verified: part-compare,
part-picture-cache and unbound-input specs. Not verified: no real compare run under load.

563\. Doc agent (2026-11-07): an agent appended to a size-budgeted plan file and committed; only pre-push saw the size and
format, 300 commits later. Tool fix (technical): a staged-file size and format check in pre-commit.

564\. Doc agent (2026-11-07): the agent-sessions `restart` refused a peer session, so the doc session's idle check could not
restart a stuck builder and Tom had to step in. Fix: `restart <name>` accepts the paired session.

564 as built (2026-11-07): `run --role builder` marks its tmux session with `@ethlete_role`; two sessions are paired when
exactly one is a builder. `restart` accepts a paired target and logs `peer restart: <caller> restarted <target>` to
`restart.log`; any other peer is still refused. The builder-agent and doc-agent skills each got one line.
Verified: new spec in agent-sessions.spec.ts. A builder started before this change has no marker; restart it once by hand.
567\. Doc agent (2026-11-07): the Mac doc session sent its desk handoff as `send <name> --to desk-doc -`; the mailbox
stored a literal `-` and the handoff was lost until it was resent as a file. Why no tool caught it: `send` reads stdin
only when the message is missing, and takes `-` as text. Tool fix (technical): `send` reads stdin for `-`, and refuses
an empty or `-`-only message.

568\. Doc agent (2026-11-07): Tom's ready marks for seven studio foundations (agent-logos, colors, icons, logo, motion,
spacing, type) sat uncommitted in the desk `ready.json` for a day; the move to the Mac's `next` dropped them, and Tom has
to mark them again. Why no tool caught it: nothing tells the user that a ready mark is not committed, and the checkout
switch only saw a dirty generated file. Tool fix (technical): Studio shows uncommitted ready marks (same channel as
B415's unpushed commits), and `sketch ready` commits its own `ready.json` change like B369 does for merges.

569\. Builder (2026-11-07, B163): `shot` threw when the clip lay outside the page. Why no tool caught it: every shot
spec used a mocked page. Tool fix (technical): each Playwright-backed spec gets one case on a real page; the serve route
returns the same note as the CLI (`x-et-note`), new row.

570\. Builder (2026-11-07, B360): on a missing `dist`, `mappedSubpathOf` swallows the error, so the listing never names
the build command. Tool fix (technical): the listing names `nx build <name>` for a missing `dist`.

571\. Builder (2026-11-07): rows from worktree branches cannot land by merge commit (the PreToolUse hook allows only
`git commit -m … -- <paths>`, and git refuses a partial commit during a merge), so they land by cherry-pick and their
`built: <sha>` goes stale. Tool fix (technical): the integration step writes each `built:` sha itself after the
cherry-pick; no agent hand-edits it.

572\. Doc agent (2026-11-07): the desk builder handed `next` to a successor session (9a) whose process exited within
minutes. Nobody owned `next`, and 8 row agents reported to a dead session. Tool fix (technical): a handoff to another
session waits for the successor's ack and checks its process; a session that hands itself off prefers `restart <own
session>` over a new session.

573\. Doc agent (2026-11-07): the desk builder 2a's tmux session ended at about 13:30 with no restart and no log line;
its row agents died with it, and the grill noticed only because a send failed. The Mac's wind-down pushed two tank
branches that only delete files (tank/tree: 4664 files, tank/webkit-tla-wt: 579), with `--no-verify`. Tool fixes
(technical): the dispatcher tells the paired session when a builder's session ends; a WIP push refuses a commit that
deletes more than a set share of the tree; `sketch merge` marks the STATUS row that names the merged sketch (B398 still
read "sketch waits for Tom" after Tom merged it).

574\. Builder (2026-11-07, B352): Tom's variant choice was already recorded in the plan, but `sketch merge --variant`
cannot apply a recorded choice, so the sketch stayed open as "needs Tom's pick". Tool fix (technical): `sketch merge`
reads a variant choice recorded for the sketch and applies it without asking again.

575\. Builder (2026-11-07): `lint:no-verify-briefs` failed the pre-push on gitignored local handoff notes and missed
negations ("no `--no-verify`", a "Never" wrapped onto the previous line). Tool fix (technical): scan only tracked files,
add "no" to the negations and join wrapped lines before matching.

576\. Doc agent (2026-11-07, B412): STATUS still asked Tom for a "Go" for `design accept pages/start` and
`components/select`, although ADR 0048 removed the Go and ADR 0209 lets the agent accept a direct edit that names
its ADR. No check reads the plan rows against the ADRs. Tool fix (technical): `yarn lint:person-names` or a new plan
lint flags a STATUS row that asks Tom for "Go", `design accept` or `go` once B249 has landed; B249 itself removes the
last hint text in the CLI that tells a human to run `design accept`.

583\. Builder (2026-11-07, finding 580 built as IMPLEMENTS-UNRENDERED, 6c611c1a9): the new rule hits five studio
parts. `pages/system` links `design-parts/system-page`, which the app never renders (system-view → shell-main →
design-canvas); `components/canvas-viewport` is drawn by design-canvas itself; `components/disclosure` and
`components/tree-row` have no rendered host (no app template uses `<ethlete-tree-row>`); `components/comment-pin` sits
off-screen in the panned sample. Decision by the doc agent (ADR 0201, 0105, 0113): the rule lands with these five in
its baseline, then each link fix shrinks it. A link to the real host is technical; a part drawn as inline markup links
the file that holds it; a part with no app code loses its link; comment-pin gets an on-screen sample.

584\. Builder (2026-11-07, 994dd8bea): `addedBaselineNamesOf` flagged every entry that some older version of
`rule-baseline.json` did not hold, so only the first commit of the file could baseline anything and a second new rule
could never baseline its old hits (against ADR 0201). No spec covered a second rule. Fixed in 994dd8bea: an entry
counts as added only if an older version already held the same rule without it, with a spec for a second new rule.
Lesson: a decision that names a ratchet ("may only shrink") gets a spec for its second use, not only its first.

585\. Builder (2026-11-07, d1fdccaa3): after the `implements` field left the design hash (finding 582),
`design task elements/canvas-frames` still failed on "embedded: components/button is not build-ready", only because
button has no `implements` link. ADR 0105 says an unlinked part must not block. Tool fix (technical, inside B249): the
build-ready computation treats an embedded part without app code as ready when its own checks pass, with a spec.

586\. Tom (2026-11-07): "--slow? was? ich denke den mist gibts in der ci nicht mehr". CI and the hooks run no design
check (checked: `.github/workflows`, `.husky`). But the builder put the new rule IMPLEMENTS-UNRENDERED (B430) into the
manual `design check --slow` batch, against ADR 0226: a check runs live and fast, and construction that makes it
unnecessary wins over the check. Tool fix (technical, applies ADR 0226): Studio derives a part's `implements` link
from the component the page harness renders at the part's slot instead of checking a hand-written link; the
`--slow` batch gets no new rule, and every rule already in it gets a STATUS row "live or delete".

588\. Builder (2026-11-07, B434): the Studio e2e job (added in 94606402c) never passed in CI. It built only `cli`, so
the design server answered `/__design/system` with 503 "missing build" and Studio stayed on "Design-Server startet".
A green run hid it because the job only runs when the push changed Studio or design files. A new CI job had no proof
that it ever passed. Tool fix (technical): a commit that adds or changes a CI job carries a link to a run where that
job ran and passed; until then the job runs with `continue-on-error`. Built for this job in 5c8b0d276 (ADR 0227).

589\. Builder (2026-11-07, push 29ce24b3d): `yarn lint:person-names` refused ADR 0227, which the doc agent wrote with
"Tom:" before each quote, as the doc-agent skill says ("Tom's words verbatim"). The skill and the person-name rule
disagree. Tool fix (technical): the doc-agent and grilling skills say "the human:" (as ADR 0226 does), and the
pre-commit hook runs `lint:person-names` on staged ADR and plan files, so the doc agent sees it at commit time.

590\. Tom (2026-11-07): "was ist mit den sachen hier untracked?" `.ethlete/design/studio/sketches/` held the
auto-made link-only sketch `elements-canvas-frames.edit` (old/new differ only in the `implements` line, finding 582)
after the builder reported its discard, plus six empty `*.edit/old|new` folders of merged edit sketches. Discard and
merge leave files and folders behind, and nothing shows a leftover. Tool fix (technical): `sketch discard` and
`sketch merge` delete the sketch folder and fail if it is still there; `design status` lists untracked sketch folders.

591 as built (2026-11-08): `canvas.e2e.mjs` sets a 10 s Playwright default (`WAIT_MS`) and drops every explicit 15, 30
and 90 s wait; `settled` stops after 10 s. Two waits stay named and long: `FULL_COMPARE_MS` (60 s) for the full sketch
compare (`data-sk-changed="pending"`, the full listing, the folded same-variant row), and `COLD_START_MS` (60 s) for a
once-per-worker warm-up page load, since the first Studio load of a worker took 12-17 s here. The run prints `suite
<m>m<s>s of 5m budget` and fails above it only with `STUDIO_E2E_BUDGET_ENFORCE=1` (not set in CI). CI runs
`STUDIO_E2E_WORKERS=2`: one worker used about 3 cores here; on 12 cores 4 workers overloaded and missed 10 s first-frame
waits, 2 did not. The default stays cores / 4. Verified: `--case` subsets at 1, 2 and 4 workers; one full run at 2
workers, 114/132 in 19m06s on this Mac (load 20-30 from other sessions, x64 Chromium under Rosetta), its failures the
known B434 set plus full-compare waits that ran past 60 s here. Not verified: the time on the 4-core CI runner.

592\. Builder (2026-11-08, B434): 33 of the 35 hidden Studio e2e failures (Sketches, Large: "0 iframes / no frame
point") came from the fixture, not the app. `prepareCheckout` in `apps/ethlete-studio/e2e/canvas.e2e.mjs` made sketch
variant `a` of pages/system and elements/shell-main an exact copy of the current part. Since b9367d285 the sketch view
folds every state equal to Aktuell and drops a row when all states fold, as designed; 7bb4abf8a and 8bc90241c made the
copies pixel-identical, so the frames went from 30 to 0 once the full compare answered. The view was correct, so check,
compare and verify had nothing to report, and nothing checks that a fixture still has a difference to show. Fixed in
1b0e18653. Tool fix (technical): after setup the harness asserts that each sketch fixture variant has at least one
changed state and fails with "fixture folds every state"; `design sketch check` warns on a sketch whose variants equal
Aktuell in every state. The System case "Neu starten … 100 ms" could never pass, because the e2e started Studio without
window chrome (fixed in ffe60ce8b); finding 588 covers the job that never ran green.

593\. Correction to finding 591: parallel cases (B377) are built. The worker default is cores/4, so the 4-core CI
runner gets 1 worker. The doc agent read the parked STATUS row and did not check the code. Tool fix (technical): the
suite takes all runner cores in CI, and the B377 row and the rows that wait on it (B378, B388) name it as done.

594\. Builder (2026-11-08): pre-push `lint:person-names` refused ADR 0228 for the same reason as finding 589. The tool
fix of 589 waits behind B434 (ADR 0228), and the doc-agent skill still says "Tom's words verbatim", so the doc agent
wrote the name again. Tool fix (technical): the 589 fix moves into the current slice of the doc agent's own files: the
doc-agent skill says "the human's words verbatim", and the doc agent runs `yarn lint:person-names` before each commit.

595\. Builder (2026-11-08, B434, 219961e3e): the e2e case "hiding the panel keeps the frames" failed for two causes.
(1) The test measured against the canvas origin, which moves by the panel width; the app shifts the camera as decided
(finding 212, B120), so the case now compares screen positions. (2) App bug: `sketches.component.ts` sized the labels
from the fit scale, which is measured again on each width change, so a wider viewport moved the frames 6-43 px at a user
zoom (fix: a `noteFit` linkedSignal). Check, compare and verify render at one fixed viewport, and nothing changes the
width while a camera is set. Tool fix (technical): `design verify` hides the panel (or resizes) at a non-Fit zoom on
each canvas part and needs the first frame rect to stay within 1 px; `design check` flags a layout size (font size,
grid column) derived from a fit or viewport measurement. Open risk: `transposed` also depends on the width.

597\. Builder (2026-11-08, B434, 4f00e0311): the sketch view used one revision for the whole sketch, so an edit of one
variant renewed the iframe and picture URLs of the Aktuell row too, and its cells stayed empty until the new
low-priority picture loaded. Fix: the Aktuell row has its own revision (`sketchCurrentRevision`, `currentRevision` into
`sketchRowsOf`). No check asserts that an edit of one variant keeps the URLs of the other rows byte-identical. Tool fix
(technical): an invariant spec on `sketchRowsOf` and a harness scenario that edit one variant and compare the URLs of
every other row.

598\. Builder (2026-11-08, B434, e1fa89e05): after a variant was added, a full sketch listing took 89.9 s: the design
server's `redraw()` dropped all kept compares on each part change, and every differing frame was drawn 4 times at high
priority (171 frames), which also starved the canvas pictures. Fix: `forgetUnchangedStates(change)` drops only the
compares of redrawn parts, and a listing after a change does not join an older run; now 11.8 s. Nothing caught it,
because the long-running server writes nothing to `.timings.jsonl` and nothing counts draws or compare hits per
listing, so it showed only as 60 s e2e timeouts. Tool fix (technical): the server logs each full listing (hits,
misses, draws, fresh redraws, time) to the timings file; the e2e prints that line when a `FULL_COMPARE_MS` wait fails;
a spec asserts that a listing after an unrelated edit draws nothing.

599\. Builder (2026-11-08, CI at 334243fe4): `merge.spec` stall 277 ms over a 91 ms bound, Linux only. Cause real:
libuv `fork()` on the server thread blocks in proportion to the RSS (29-173 ms per spawn at 3.8 GB), and a merge
spawns git up to 5 times; macOS uses `posix_spawn` and hides the cost, so every local run was green. Fixed in b85f8fd40
(git calls run in the merge worker). Tool fix (technical, built in b85f8fd40): a spec asserts that the server thread
makes no `child_process` call, so the rule holds on every OS, not only where a stall shows.

600\. Builder (2026-11-08, B434): the Chip panel-hide case broke through the fixture change 2bb8d3d58, not the app.
With one changed state, Fit capped at scale 1, so "Auf 100 % zoomen" stayed in Fit, and `measure()` keeps the pan in
Fit by design; the case measured a state it never meant to test. The fixture slice ran only its own cases. Fixed in
82e3583ca (zoom past Fit). Tool fix (technical): a case asserts its precondition (here: the camera is not in Fit)
before it measures, and fails with "precondition not met" instead of a position diff.

601\. Builder (2026-11-08, B434, 576362316): the 30 % case left a `page.route` that answered 404 for every picture on
the reused worker page, so later Large cases (edited on disk, scroll never empties) failed and hid a real product bug
("keeps its frame count and pictures through a sketch edit": 3 folded cells of variant a go blank after a css edit). A
route in one case outlived the case on a shared worker page. Tool fix (technical): the worker fixture calls
`page.unrouteAll()` after each case and fails the case that left a route behind.

602\. Builder (2026-11-08, B434): the System "wheel" case timed out in CI at its first frame. The System page waits
for two full `/__design/system` listings, and each one runs all design rules again on the server thread with no
result cache (`listSystem` -> `ruleProblemsOf`): 1.5-3.5 s on macOS, 3.5-7 s on Linux, and stamp and pings get no
answer meanwhile. The page throws the first answer away and asks again. A passing local run drew at 9.2 s of a 10 s
wait. The cold path also runs `execFileSync` (tailwind `classFactsOf`, about 8 s) and git (about 1.7 s) on the server
thread, the class of finding 599, which the 599 spec checks only for the merge path. Nothing measures request time on
the server or counts requests per page load. Tool fix (technical): a first-frame timeout names the slow design
requests and the longest ping (b815a18af); a spec asserts one listing per page load; the 599 assertion covers the
whole server (no sync `child_process` call and no full rule run on the server thread per request).

603\. Builder (2026-11-08, B434, d20413216): after a css edit the Large sketch cells showed nothing for about 8 s. The
img and the iframe switched to the new revision at the same moment; the new img took about 5 s to render, and the new
iframe stayed transparent until it painted. Fix: a cell keeps its last loaded picture on top until the new one loads,
and a failed revision keeps the old one. The e2e case caught it but was masked by the leaked route of finding 601; no
spec checks that a cell is never empty while its revision changes. Tool fix (technical): a sketch-view spec samples a
cell through a revision change and fails on any frame without a loaded picture.

604\. Builder (2026-11-08): a subagent ran `git checkout` on `apps/ethlete-studio/e2e/canvas.e2e.mjs` while another
agent had uncommitted edits in it. Nothing stops an agent from discarding another agent's work in a shared checkout.
Tool fix (technical): a PreToolUse hook refuses `git checkout`/`git restore`/`git stash` on a path with uncommitted
changes that the agent did not make itself, and the builder's subagent brief names the files each slice owns.

605\. Builder (2026-11-08, a369b13b0): the System fix shows a failed listing (503 "missing build") in the System view;
pages/system has no designed state for it, and the app draws `read.error` as a plain note line. The doc agent asked;
no tool flagged a visible branch without a design state. Marker sketch opened as ADR 0010 says (21ff32b31). Two sketch
tool gaps: the `--round` title did not stay in `sketch.json`, and the round note was not German. Tool fix (technical):
`design check` lists app template branches that draw text (error, empty, loading) with no matching state in the
implemented part; `sketch new` keeps `--round` in `sketch.json` and refuses a non-German round note.

606\. Builder (2026-11-08): the doc agent's archive commit e8610084f replaced `archive/findings-2026-11.md` with
findings 240-252 alone (3527 lines deleted): its script opened the file for writing before it read it. Pre-push
`lint:studio-adrs` caught 36 STATUS rows that cited lost findings; the pre-commit hook did not. Fixed on top. Tool fix
(technical): a `findings:archive <from> <to>` script moves findings, so no agent writes its own; the pre-commit hook
refuses a commit that removes a finding from the archive and runs `lint:studio-adrs` on staged plan files.

608\. Builder (2026-11-08, 0a3243bb5): `--no-memory-reducer` (finding 607) held the merge stall at 3-5 ms in 5 macOS
and 5 Linux docker runs, but CI run 42464173027 still measured 237 ms over 88 ms. The docker repro proved one source
and not the one CI hits; the flag reaches every cli spec, because vitest cannot scope `execArgv` per file. Next: one
CI run with `--trace-gc`, then keep the flag only if the failed span overlaps a GC. Tool fix (technical): from finding
607, a failed stall span prints its GC trace in CI, so a fix is checked against the CI cause, not a local stand-in.

609\. Builder (2026-11-09, b6ac8937b): the revert c4ce243f3 also deleted unreleased changesets, and the pre-push
`lint:changesets` refused the push. The builder restored them by hand. Tool fix (technical): `lint:changesets` names
each deleted changeset that is not in `pre.json` and prints the `git checkout <sha>^ -- <file>` command that restores it.

610\. Builder (2026-11-09): `nx run-many` prints the output of a task only when the task fails. The `--trace-gc`
diagnostic of finding 608 logged to stdout, so a green run gave no data. Tool fix (technical, ADR 0230 / B441): a CI
diagnostic writes to a file that the job uploads as an artifact, never only to stdout.

611\. Builder (2026-11-09, da7bb2608): the `design-changes` filter skipped every Studio e2e shard on a push that changed
only `ci.yml`, so the shard split had no CI proof. Tool fix (ADR 0230 / B439): Studio e2e runs on every push.

612\. Builder (2026-11-09, eeaca8e0c): Large "a sketch scroll never empties a cell that had a picture" was red in 3
sharded runs. Cause 1 (app bug): `liveShotsOf` gave the 6 live slots in row order, so variant-a cells lost their iframe
before their picture loaded; now painted-without-picture > without-picture > pictured. A later blank iframe at
`down2+30` recovered by +300 ms, cause not proven. The tool did not stop it because the e2e job had
`continue-on-error`. Tool fix (technical): the job blocks (c99006d83), and the probe names its outcome (786f7adb0), so
the next red says which cause. Open: a harsher held-picture repro still empties cells when more than 6 near cells have
no picture; CI never showed it.

613\. Builder (2026-11-09, B440): the title bar needed a "CI rot" label that the human decided in ADR 0230, but
`design accept` refused to run without the human at a terminal, so the builder opened the sketch
`components/title-bar@ci-red` and asked for a new `--adr` flag. ADR 0209 already says an agent accepts a direct edit
that names its ADR (`--by builder --note "ADR <n>"`). The question repeated a decision. Tool fix (technical, ADR 0209):
`design accept --by builder` works without a terminal when the note names an ADR; the builder then accepts the label
and drops the sketch.

615\. Builder (2026-11-09, B440): `tsc -p` on the Studio `tsconfig.spec.json` fails in `shot-state.spec.ts`
(`failedShots` possibly null) since 38d421711. vitest does not typecheck, so the specs stayed green. Cause: the
`typecheck` target of `ethlete-studio` and `timetrack-app` checked only `tsconfig.app.json`, so no gate typechecked
their specs. Fix (d536fee67): both targets also run `tsc -p tsconfig.spec.json`. Tool fix (general):
`yarn lint:spec-typecheck` in pre-push refuses a project whose `typecheck` target does not name its
`tsconfig.spec.json`.

616\. Builder (2026-11-09, B441): a first run of `render-missing-dist.perf` failed in its `beforeAll`, and
`spec:stress` showed no error output for the failed run, so the cause stayed a guess. Tool fix (technical):
`spec:stress` prints the output of the first failed run.

626\. Builder (2026-11-09, B457, b1af8f143): the full `design check` of B456 wrote build-ready records with the absolute
home path in `cmd` into `.ethlete/design/*/ready.json`, and `yarn lint:person-names` refused them. Cause: `originOf` in
`libs/cli/src/lib/design/system/write-origin.ts` wrote `process.argv` as it was, and the resident starts as
`design __resident --checkout <absolute checkout>`. No full check wrote through the resident before, so HEAD had no such
path. The tool caught it at the commit, not at the write. Tool fix (built): `portableCmdOf` writes each absolute
argument relative to the working directory (`--checkout .`); `write-origin.spec.ts` bites without it.

628\. Builder (2026-11-09, B459a, 2facac8ea): OFF-CENTRE baseline hit, sdk `components/button`, `size-lg` and `size-xl`: the text sits off the
box centre. Cause: the lib CSS has no `text-box` trim and a height that does not fit the trimmed line. It goes into the
OFF-CENTRE baseline (ADR 0201, finding 625). Fix: a sketch `components/button@off-centre` with the trim and height fix; the
human picks by merge, then the hit leaves the baseline. Tool fix: none, OFF-CENTRE caught it.

629\. Builder (2026-11-09, B459a, 2facac8ea): OFF-CENTRE baseline hit, sdk `components/pagination`, `first`, `sm` and the links: the text sits off the
box centre. Cause: the lib CSS has no `text-box` trim and a height that does not fit the trimmed line. It goes into the
OFF-CENTRE baseline (ADR 0201, finding 625). Fix: a sketch `components/pagination@off-centre` with the trim and height fix; the
human picks by merge, then the hit leaves the baseline. Tool fix: none, OFF-CENTRE caught it.

630\. Builder (2026-11-09, B459a, 2facac8ea): OFF-CENTRE baseline hit, sdk `components/scrollable`, `vertical-start`: the text sits off the
box centre. Cause: the lib CSS has no `text-box` trim and a height that does not fit the trimmed line. It goes into the
OFF-CENTRE baseline (ADR 0201, finding 625). Fix: a sketch `components/scrollable@off-centre` with the trim and height fix; the
human picks by merge, then the hit leaves the baseline. Tool fix: none, OFF-CENTRE caught it.

631\. Builder (2026-11-09, B459a, 2facac8ea): OFF-CENTRE baseline hit, sdk `components/chart`, the pie tooltip: the text sits off the
box centre. Cause: the lib CSS has no `text-box` trim and a height that does not fit the trimmed line. It goes into the
OFF-CENTRE baseline (ADR 0201, finding 625). Fix: a sketch `components/chart@off-centre` with the trim and height fix; the
human picks by merge, then the hit leaves the baseline. Tool fix: none, OFF-CENTRE caught it.

632\. Builder (2026-11-09, B459a, 2facac8ea): OFF-CENTRE baseline hit, sdk `components/table`, the group header: the text sits off the
box centre. Cause: the lib CSS has no `text-box` trim and a height that does not fit the trimmed line. It goes into the
OFF-CENTRE baseline (ADR 0201, finding 625). Fix: a sketch `components/table@off-centre` with the trim and height fix; the
human picks by merge, then the hit leaves the baseline. Tool fix: none, OFF-CENTRE caught it.

633\. Builder (2026-11-09, B459a, 2facac8ea): OFF-CENTRE baseline hit, sdk `components/skeleton`, the in-text skeleton (1.0 px): the text sits off the
box centre. Cause: the lib CSS has no `text-box` trim and a height that does not fit the trimmed line. It goes into the
OFF-CENTRE baseline (ADR 0201, finding 625). Fix: a sketch `components/skeleton@off-centre` with the trim and height fix; the
human picks by merge, then the hit leaves the baseline. Tool fix: none, OFF-CENTRE caught it.

634\. Builder (2026-11-09, B459a, 2facac8ea): the first OFF-CENTRE run counted 264 hits, but after deduplication and the
false-class filters 13 are left (studio 25 to 4, sdk 21 to 9). Filtered false classes, each with a spec that bites:
scaled text measured at its drawn scale, underline-only boxes, a zero-padding box filled by its line box, a flex row
with `align-items: flex-start`, and a box with an input. Lesson: a new rule counts deduplicated hits after a filter pass
before anyone sizes the work; the 264 made the warning-only route look needed (finding 625). The 4 `pages/sketches`
`span.sk-gutter` hits are a mask in canvas colour, on purpose. Decision (doc agent, applies ADR 0209 with ADR 0201): the
skip is an invisible direct edit that implements a decision, so the builder adds `data-et-skip="OFF-CENTRE"` and runs
`et design accept pages/sketches --by builder --note "ADR 0201"`; the gutter does not go into the baseline.

635\. Builder (2026-11-09, B459a): the ADR 0209 path failed on its first real use. `--by builder` counts as the human,
and `yarn et:design accept pages/sketches --product studio --by claude-opus-5-5 --note "ADR 0201, ADR 0209"` was denied
by the Claude Code permission system as self-approval. The builder undid the `sk-gutter` skip edit. Why no tool caught
it: ADR 0209 was decided and queued (613) without a run of the command in auto mode, so nobody saw the permission
boundary. Lesson: a decision that has an agent run a command checks first that the agent may run it. Decision (ADR 0233): the agent prepares the accept command, dry-runs it, and the human runs it with `!`.
Until then the 4 `pages/sketches` gutter hits stay in the OFF-CENTRE baseline.

637\. The human (2026-11-09), on a grill question that offered `yarn design go --batch` for a human accept: "ich lese
da schon wieder das wort go". ADR 0048 removed go and accept as human gates: a direct edit to a merged part without a
picture change holds at once, and the human decides only by picking in a sketch. ADR 0209, the builder's accept for the
`pages/sketches` gutter skip (finding 635) and ADR 0233 all rested on the accept gate, so ADR 0233 is withdrawn. Why no
tool caught it: B249 is still open, so the cli still has `go`, `accept` and `go.json`, and EDIT-OLD-NOT-FOUND asks for
an accept on a pixel-identical edit; the doc agent searched the ADRs for "accept" but not for "go". Tool fix (general,
builder): until B249 lands, `design go` and `design accept` print that ADR 0048 removed them and name B249, and
EDIT-OLD-NOT-FOUND does not fire when the edit leaves every picture of the part unchanged. Process fix: before a grill
question names a cli command, the doc agent runs `yarn adr:governs` on the file that defines that command.

638\. Builder (2026-11-09): pre-push `lint:changesets` refused the push of B460, because the doc agent's ADR commit
2d0b4e14d changed `ethlete-studio` with no changeset; the builder added `.changeset/adr-0233-withdrawn.md`. Why no tool
caught it: the pre-commit hook runs `lint:person-names` and `lint:studio-adrs`, but not the changeset check, so a
docs-only commit learns of the missing changeset only at the next push, in the builder's session. Same class as
findings 589 and 594. Tool fix (general, builder): the pre-commit hook fails a commit that stages a file of a workspace
package without a changeset for it, staged or already in `.changeset/` on the branch; it names the `none` changeset to
add.

639\. Doc agent (2026-11-09, ADR 0236): measured loop time of the builder on 2026-11-08 (4 builder sessions, 16
subagents, 8 push-suite logs in `/tmp/push-suite*.log`). Studio e2e dominates: 26 min of direct runs, most of the 25 min
of wait loops, and 23.4 of the 29.5 min of push-suite time (165-197 s per run, 80 %). The cli step costs 85-104 s only
when cli changed; commit hook, lint and prettier together about 3.5 min. Polling (`tail -f`, `until grep`, `sleep`)
on e2e logs ate a large part of the "other" 24.6 min. Fix (item 0 of the binding order): the e2e step in push:suite
under 60 s over 3 measured runs, and the builder waits on e2e by notification, not by polling.

640\. Doc agent (2026-11-09): the builder sat idle for about 55 min. Its button sketch subagent (finding 628) ran
`node tools/scripts/et-design.mjs shot components/button --states --variants --product sdk` in the background at 17:52;
the shot kept a live headless Chrome tree and never exited. The subagent waited for the completion notice with no
deadline, and the builder waited on the subagent with no deadline. An older `et-design.mjs` (pid 1117702, from 15:27)
also still ran. Cause of the shot hang: not known (no output captured). Why no tool caught it: `shot` has no overall
deadline and writes no progress, and neither wait has a deadline. Tool fix (part of item 0, because it stops all work):
`shot` and `design check` end with an error and a captured log after a hard deadline, and the builder waits on a
background run or a subagent only with a deadline (Monitor until-loop with a timeout), then reads the log.

642\. Builder (2026-11-09, 48d1a7716): CI on `next` was red since 3aaa8364e, `real-open-points.spec.ts` timed out at
5 s under full CI load (405 ms alone). Cause: `readOpenPoints` reached `committedLinkFieldsOf` in `link-free.ts`, which
started 50 synchronous git processes per run (one `git log -G implements` per linked part, one `git show` per commit
found). Process starts get much slower when 342 spec files share the runner. Fix: one `git log --name-only` and one
`git cat-file --batch` per repository; 50 calls became 2, the spec runs in 172-195 ms also under local load. Not
verified: green under real CI load. Why no tool caught it: nothing stops code from starting one git process per file,
and no check counts process starts. Tool fix (backlog, per ADR 0235 at the cause): every git read in the cli goes
through one batched git reader, and lint forbids a direct `spawnSync`/`execSync` of `git` outside it; a per-test spawn
budget is only the fallback if the lint rule cannot cover a case.

643\. Builder (2026-11-09, during 7a2c46230): the 640/641 subagent overwrote the repo slice-paths file
(`$(git rev-parse --git-path slice-paths)`) with its own paths, so the builder's slice warning checked the wrong paths.
Cause: one slice-paths file per checkout, shared by every session and subagent. Why no tool caught it: nothing ties
the file to the session that wrote it. Tool fix (backlog): a subagent sets `ETHLETE_SLICE_PATHS` and never writes the
file; the pre-commit hook names the writer of the file and warns when a different session commits against it.

645\. Builder (2026-11-09, a8cc4eb06): the open-points worker of 644 needs 4-7 s to start under jiti, so the four spec
files that ask for open points got 30 s timeouts. That is a timeout raise, not a cause fix (ADR 0235). The doc agent
accepted it for now, because red CI comes first (ADR 0234). `@swc-node/register` would fix the start but became a
runtime dependency of `@ethlete/cli` through dependency-checks. Why no tool caught it: nothing flags a raised spec
timeout. Tool fix (backlog, first in line after item 0): a precompiled worker entry for the specs, the 30 s timeouts
go back to the default, and lint refuses a spec timeout above the default without a finding number next to it.

647\. Builder (2026-11-09, item 0): the Large case "a sketch scroll never empties a cell" fails under 8-worker load in
about 3 of 10 full runs, and blocked the push-suite on 99dda96f7 (e2e 132/133). Alone it passes 4 of 4. A cell loses
its iframe for 30-300 ms after a scroll under CPU load, so this is probably a Studio defect under load, not a test
defect (not proven). Why no tool caught it: the repeat gate runs the suite three times on one load level, so a fault
that needs CPU pressure passes until the load is high by chance. Tool fix (part of item 0, decided by the doc agent
under the anti-stall rule because it blocks the push): fix the empty cell at its cause in Studio; then the e2e runner
gets a load mode (CPU pressure on purpose) that the repeat gate runs, so a load fault fails every time and not one
push in three.

649\. Builder (2026-11-09, check cache): the Tailwind facts store was keyed only by stylesheet paths, so a theme change
gave stale answers; the bug existed before the cache. Why no tool caught it: each store builds its own cache key by
hand, and nothing checks that the key covers every input the store reads. Tool fix (backlog): every design CLI cache
takes its key from the shared fingerprint of the files the run read, never a hand-built key; a spec per store changes
each input once and expects a fresh answer.

As built (649): `readsCacheOf` in `system/tracked-reads.ts` is the shared store: the slot names the request, and an
entry lives while every file and folder listing the run read still prints the same (`trackedRun` now nests, so an inner
cached run no longer ends the outer run's recording). Moved onto it: the Tailwind facts store (`classFactsOf`: its
Tailwind child process reports the files it read, so a theme in a package counts), the SDK declarations store
(`sdkDeclarationsIn`, was mtime), the app files store (`appFilesOf`, was mtimes of reached files only, so a missing
template or a `tsconfig.base.json` change was stale) and `cachedCheckOf`. A spec per store changes each input once;
bite with the old keys: package theme (Tailwind), same-mtime edit (declarations, app files), appearing template and
tsconfig path (app files) fail; the nesting spec fails without the outer chain. Remaining stores, not checked: the
disk and async caches `action-cache`, `compare-cache`, `harness-build-cache`, `part-picture-cache`, `pixel-cache`,
`served-cache`, `generated-stylesheets`, `shot-store`, `vite-cache`, `sketch/unchanged-states`, `link-free`
`earlierFields`, `slow-checks` `bases`; `trackedRun` is synchronous, so they need an async fingerprint first. Not
verified: a Tailwind `@plugin` or `@config` JS module the child loads through ESM `import` is not recorded, and no
`design check` ran on a real product.

650\. Builder (2026-11-09, ADR 0237): the 3 measured e2e runs ran at a load average of 39-51 from other sessions, so
the times cannot show if the 90 s goal is met. Why no tool caught it: the e2e timing report has no load figure, so a
noisy measurement looks like a clean one. Tool fix (backlog, with ADR 0208 run timings): every e2e timing report
prints the load average at start and end and marks a run above a load threshold as "noisy, not a measurement".
As built (Linux builder, 2026-11-11): `apps/ethlete-studio/e2e/run-load.mjs` `runLoadLineOf`; `canvas.e2e.mjs` prints
`load <start> at start, <end> at end on <cores> cores` after the budget line, with " - noisy, not a measurement" when
either one-minute load is above the core count (the threshold of the design timings, ADR 0208). Verified: `run-load.spec.mjs`
2/2, fails with the threshold broken; one live `yarn studio:e2e --case` run prints the line. Real case run (2026-11-11):
`--case 'a sketch merged while its view is open opens the part view of the target'` passed 1/1 in 24.6 s, exit 0, and
printed `load 0.7 at start, 1.7 at end on 32 cores`. A noisy live run is not verified.

651\. Builder (2026-11-09, 647 bite proof): the committed `--delay-pictures` mode (2b0227f8e) also delays the
canvas's first frame, so every single-case run with it times out in `warmUp` (`canvas.e2e.mjs`, "Timeout 60000ms
exceeded") and the scroll case shows NOT RUN. The handoff said "with the fix and a 60 s delay the scroll case passes
3/3"; that run came from the scratch harness in `/tmp/s647` (gone), where `warmUp` was not delayed. Why no tool caught
it: a "verified" line in a handoff or a report does not name the commit and the command it ran on, so a result from a
scratch copy reads like a result on the committed code. Tool fix (backlog): every "Verified:" line names the sha and
the exact command; a result from a scratch or export tree says so. Fix now (doc agent decision, ADR 0238 scope): the
delay route turns on only after `warmUp`; one more bite proof; if it again gives no result, push without it and the
proof moves to the tool backlog.

652\. Doc agent (2026-11-09): the design tools rewrite tracked files on every run (`.ethlete/design/*/pictures.json`,
`.ethlete/design/studio/ready.json`, a sketch's `sketch.json`), so the working tree is never clean. Sessions learn
"never commit them, not ours", and the doc agent even called them the human's files. Why no tool caught it: nothing
separates tool state from design source in the tree. Tool fix (backlog): tool-written state goes to a gitignored
cache, or the tool commits it itself in its own commit; `git status` after a design run shows only what a person
changed.

653\. Builder (2026-11-09, 647 bite proof): a hand-made HEAD export (`STUDIO_CLI_ENTRY` = main tree dist) could not
start the canvas: all 4 runs ended in a `warmUp` timeout, also with no delay at load 4-8. The push-suite export runs
the same e2e step without this, so the hand copy of `exportCommit` misses something (not found). The first report
blamed the delay route, which already turns on after `warmUp`. Why no tool caught it: there is no shared way to run a
case on an export, so each proof builds its own. Tool fix (backlog, with 651): a bite proof runs through push-suite's
`exportCommit` (one export path) with a flag that reverts a named commit.

653 as built (2026-11-11): the export (`exportCommit`, the dependency links, `DRAWING_BUILDS`) moved from
push-suite.mjs to `tools/scripts/commit-export.mjs`; push-suite imports it lazily (no sibling import at load time).
`yarn studio:e2e:bite --revert <sha> [e2e args]` exports HEAD with it, applies the reverse of `<sha>` (`git apply -R`,
refused with a message when it does not apply), builds `cli components core` in the export like push-suite, runs the
export's own `canvas.e2e.mjs` and removes the export in `finally`; the `<ref>` mode is unchanged. Verified:
`commit-export.spec.mjs` (temp repo: export, reverse diff, refused diff) and the `--revert` arg specs, each failed
when its code was broken; `push-suite.spec.mjs` green. Live proof (2026-11-11, load 3-5 of 32): `yarn studio:e2e:bite
--revert 1b41de840 --case "a frame renders real content, not an error page"` ran 4/4 green in the export in 23 s, warmUp
3.7-3.8 s on each worker: the warmUp timeout of 653 is gone. The first try with a `--case` that matched nothing found 806.

654\. Doc agent (2026-11-09, Mac night start): the builder handoff said the on-disk check cache waits for the human
("its cost goes to the human first"), while ADR 0239, written the same afternoon, puts it in the night scope. The
handoff restated an older doc agent line instead of the ADR, so the builder would have stopped on a decided point.
Why no tool caught it: a handoff is free prose; nothing compares its scope lines with the ADRs it names. Tool fix
(backlog): a handoff names its scope only by ADR number and lists the ADR's items verbatim (no paraphrase), and
`yarn adr:governs` on a handoff file lists the ADRs it cites so the writer rereads them before the commit.

655\. Doc agent (2026-11-09, Mac night, reported by the human): CI on next was red in "ci / Rust host" from run
42632896727 (14:15) on: `cargo audit` found RUSTSEC-2026-0459 (libsqlite3-sys 0.38.2 through rusqlite 0.40.2 in
`apps/timetrack/src-tauri`, solution >=0.39.0). The repo did not change; the advisory database did. The builder
started the night with "ci running, push gate unknown" and did not see the earlier red run; the human found it. Why
no tool caught it: `cargo audit` runs only inside the CI push run (no pre-push step, no scheduled run), and the
status line shows only the newest run, not the last finished one with its failed jobs. Tool fix (backlog): (1) the
status line shows the last finished CI run on the branch with its failed job names next to a running one; (2) a
daily scheduled `cargo audit` on both Tauri lockfiles, so a new advisory goes red on a fixed time and not on the next
unrelated push. Fix work: sent to the builder before queue 1 (ADR 0230).

657\. Builder (2026-11-09, Mac night, 6cafe2129): the hold run masks a short picture delay. With the `liveShotsOf`
fix reverted, hold 14000 plus delay 3000/6000/15000 all pass 2/2; hold 0 plus 15000 fails 2/2; hold 14000 plus 20000
fails 2/2, plus 30000 1/2, plus 60000 2/2. Pictures asked for during the hold arrive before the scroll back. So the
delay must be longer than the hold; the gate uses 60000. Every fail is the 647 empty cell, not the probe race. With the
fix: 2/2 pass at 6000 and 60000. Command: `node apps/ethlete-studio/e2e/canvas.e2e.mjs --case 'a sketch scroll never
empties a cell that had a picture' --hold-listings <h> --delay-pictures <ms>` on 1b17d73f3. Why no tool caught it:
two fault injections in one run had no check that each one still bites; only the hand sweep showed it. Tool fix
(in 6cafe2129 for this pair): the gate spec asserts delay > hold. Open: the 646 hold bite with the delay on, and the
extra time of run 3 (measured in the idle runs).

659\. Doc agent (2026-11-09, Mac night): the builder blamed a load of 81-107 on "other sessions". A `ps` at load 91
showed only this checkout's own work: two `tsc --noEmit`, a `libs/cli` tsc build, cli vitest workers, Playwright
Chromium and Tailwind design-system loaders, from the builder's parallel subagents next to a running push-suite; plus
an Nx daemon 2.6 days old at 17 % CPU. Spotlight and media analysis were idle. No other session ran on the Mac. So
the push-suite fail of 658 may be self-made load. Why no tool caught it: the load figure of 650 is a bare number with
no source. Tool fix (with 650): when the load is over the threshold, the timing report lists the top processes by CPU
with their checkout and parent session, and push-suite warns before its start when other test or build processes of
the checkout run.

661\. Builder (2026-11-09, Mac night, 343e968aa): `render-check.spec` fixture `components/underline-cut` put a 16px
font in a 16px line. The Mac font draws 17px, so a second CLIPPED issue came out (14 vs 13). Fix: 12px font, 6px
underline offset. Why no tool caught it: render fixtures use the system font, and CI has only one system. Tool fix
(backlog): render fixtures load a bundled font, so a metric is the same on every machine.

664\. Doc agent (2026-11-09, Mac night): the first Mac e2e step (push-suite on 077bd0543, load 8-35, so not a
measurement) ran 133 cases on 3 workers in 513.3 s; the PC ran them on 8 workers in 117-127 s. The 90 s goal of ADR
0237 names no machine and no worker count, so a Mac figure and a PC figure cannot be compared. Why no tool caught it:
the timing report prints the time but not the worker count and the machine next to the goal. Tool fix (with 650): the
report prints machine, core count, worker count and load next to the time, and checks the goal only on the machine
the goal names. Answered by ADR 0240: the goal counts on the desk PC (see 793).

665\. Builder (2026-11-09, Mac night): two push:suite runs in a row failed e2e 132/133, each in another case (B462
Sketches first load, B463 System page switch timing); each passes alone. The red-CI fix 2bc4d42f2 waits behind
them, so the Rust audit stays red for hours because of two e2e flakes on another machine. Why no tool caught it: the
push gate has no record of which cases are known flaky on which machine, and B463 is a timing case that ADR 0230 moves to a non-blocking perf job, but B441 moved only four `libs/cli`
specs, not the e2e timing cases. Tool fix (tonight, bug queue): the e2e timing cases move into the perf job too (B441
applied to e2e), and the gate prints the B row of a known flaky case next to its fail. Cause the builder fixes next: `canvas.e2e.mjs:3020` gives
`min(8, floor(cores/4))`, 3 workers on the 12-core Mac.

As built (finding 665, B463, ADR 0230): two e2e cases carry `perf: true` in `canvas.e2e.mjs`: "page switch time is logged to the design timings" and "Neu starten in the code notice answers within 100 ms". They fail under load on the 12-core Mac, so the default run, `push:suite` and the blocking e2e job skip them. `--perf` runs only them, and `--case` finds one only together with `--perf`. The header line prints how many were skipped. The CI `perf` job now builds and runs `yarn studio:e2e --perf` with one worker; it stays non-blocking and out of both `needs` lists. `tools/scripts/studio-e2e-perf.spec.mjs` checks that the default selection never holds a perf case. The B462 flake is not a timing case and stays blocking.

669\. Builder (2026-11-09, Mac night, push:suite on 4fc2d5299): cli, studio and e2e green (131/131, 516 s, load 8),
then the repeat gate blocked after 31 min. Three cases failed only in the hold run (`--hold-listings 14000
--delay-pictures 60000`): Large 'a sketch cell edited on disk while scrolled away shows its new picture on return',
Edited 'a part edited on disk while away shows its new picture on return', System 'a part shown before paints every
stored picture in the first frame'. Each waits for a new or stored picture inside 10 s, so a 60 s picture delay fails
it every time; the Studio keeps the old picture until the new one loads, as wanted. The cause is tonight's slice
6cafe2129: it put the delay on every case of the hold run but checked one case, and its as-built note listed "full
repeat gate with the delay" as not verified. Why no tool caught it: a change to the gate's own arguments can commit
without one full gate run, and "not verified" in a note blocks nothing. Tool fix (tonight; doc agent agrees): a case
that needs a fresh picture opts out of the delay (`delayPictures: false`), and a spec checks the hold-run argument
list against the opt-outs. Backlog: a commit that changes `studio-e2e-repeat.mjs` arguments needs a full repeat-gate
run before the push suite counts it.

674\. Builder (2026-11-09, Mac night, 9e4ada3c5): the B465 case took its "had a picture" snapshot when only the
`current` row, which the edit does not change, had painted. So the old code passed 3/3 even with a 60 s picture
delay: the case did not touch the state it claims to guard. Fixed: it waits for a visible variant-a cell; the old
component now fails 3/3 under the delay, the fix passes. Why no tool caught it: nothing proves that a case's
precondition holds before its action. Tool fix (backlog): a case that guards cells asserts a non-empty set of guarded
cells before the action, and the 651 bite proof is the check that a case can fail at all.

681\. Builder (2026-11-10, Mac night, B466-only push:suite in a worktree at 11de10881 = origin/next f6a97186f + c11cc03ac,
B471): the e2e step failed on `[System] page switch time is logged to the design timings` (`icons->shell-main first:
mount 37, first 4730, all NOT (5 painted; 17 marked img/iframe, 8 canvas frames ...)`, 33.1 s): under load not every
shell-main frame painted inside the case's window. This is origin/next's own e2e, without tonight's local fixes. Four
push:suites tonight were red, each on a different load-sensitive case (B464, B468, B470, B471); cli and studio were
green each time. Nothing is pushed, so the B466 CI proof waits for the human. Why no tool caught it: the Mac push:suite
runs every e2e case at 3 workers under full load, and a case that waits for "every frame painted" in a fixed window
fails on load, not on a defect; one red case blocks a push that cannot touch e2e behaviour. Tool fix (bug queue, after
680): the runner runs the cases that wait for paint in a quiet tail (one worker, after the parallel cases), and a case
that hits its window prints the load next to the fail; a change set that touches no e2e input (here two vitest worker
caps and a changeset) is a candidate for a gate the human decides on.

As built (B471, finding 681): cases flagged `quiet: true` sort last; only worker 0 takes them, once no other worker
holds a case, after printing `quiet tail: <n> case(s) on worker 0`. Every failed row ends in `- load <1-min> on <n>
worker(s)`. Marked: page switch timings (`all` painted), listing refresh 1 s (`framesPainted`), first load (every iframe
loaded), part shown before (every picture loaded), hover (late mount, B464); 9 rows. Full run: before 503.6 s 131/131
(load 3.0); after 533.6 s 130/131 (load 4.9; tail 62 s; `Fit is stable` hit `page.goto` during the build, `load 46.3 on
3 worker(s)`). Bite: 3 workers ran 9 parallel rows, the tail line, then 4 hover rows, each forced fail printing `load
72.8 on 1 worker(s)`. Not verified: push:suite, CI, `--perf`.

As built (B471 cause, finding 681): on failure the page switch case now prints each marked img/iframe that is not shown at the window end (state, opacity, img complete/width or iframe load and posted messages, picture request sent / on the wire / first byte / answered in ms since the switch, viewport, frame `data-live`, frame painted) and the requests still in flight. `--cold-shots` gives the scratch checkout its own `node_modules/.design-explore`, as in a fresh worktree; with the shared store warm, shell-main paints in about 100 ms and the case can not fail. Repro: 12 `node -e 'for(;;){}'` hogs, load 47-90 (other sessions ran too), cold: 1 fail in 12 runs, shell-main `all` 8.3-9.6 s in the 11 passes. The fail: 4 of 8 frames painted, all 15 pictures sent at +42 ms, pairs answered at +6.7, +9.4 and +10.5 s with 1.2-2.0 s of server time each. A 6 s window run: `server-stopped` sent +55, on the wire +5459, first byte +6658. Cause (bite): the browser holds the out-of-viewport pictures, at most two or three on the wire, so 15 cold draws run about two at a time. Not the six connections per host: pictures from `[::1]` instead of `localhost` (temporary build) still went on the wire at +491, +1043, then +4174. With `fetchpriority="high"` on the shot imgs (temporary build) every picture goes on the wire at once and shell-main `all` is 3.8-4.4 s in 3 runs at the same load, but `system->icons` then fails in all 3: its two pictures and `/__design/open-points` queue behind the system page's pictures. Proposed fix: none committed. Raise the priority of only the frames of the current switch, or have the server answer the newest view first; each needs its own bite against the first switch. Not verified: the full suite, push:suite, CI, the Chromium rule that caps the pictures.

As built (B471 fix, 681): the design canvas now asks for its shot pictures with `fetchpriority="high"` once its camera key changes from one view to another, so every picture of the frames switched to goes on the wire at once, off-screen ones too. The first view a canvas opens keeps the browser's own order, so the system page's pictures stay low and do not take the sockets the next switch needs. `SHOT_FETCH_PRIORITY` (shot-rank.ts) carries it to `ShotRankDirective`, which binds the attribute. Measured with 12 busy-loop hogs (load 29-41 at the run starts), `--cold-shots --perf`, the page switch case, base (HEAD) and fix interleaved, 3 runs each. Base: all 3 pass; `system->icons` 2986/2838/2881 ms, first `icons->logo` 2701/2541/2598 ms, first `icons->shell-main` all 4400/4862/4519 ms; wall 85/80/80 s. Fix: all 3 pass; `system->icons` 2639/2721/2882 ms, first `icons->logo` 547/872/728 ms, first `icons->shell-main` all 4337/4028/4976 ms (its first frame later: 2.3-3.1 s against 1.9 s); wall 77/78/79 s. So the fix keeps `system->icons` passing, makes the first logo switch about 2 s faster and costs no wall time. Suspect, not Cause: the fix stops the shell-main miss. The base did not miss in these 3 runs (the cause runs missed 1 in 12 at load 47-90, with shell-main at 8.3-9.6 s), so no fail was removed here. Not verified: the full suite, push:suite, CI, a higher load where the base misses.

683\. Builder (2026-11-10, Mac night, full `yarn studio:e2e` after 1cc2d2ee8, B472): `[Sketches] Fit is stable` hit
the 10 s `page.goto` timeout in setup while the Studio build ran, `load 46.3 on 3 worker(s)`. The fifth load-sensitive
case tonight (B464, B468, B470, B471, B472). Not caused by the 681 quiet tail. Why no tool caught it: e2e cases start
while a build of the same run still takes the CPU, and setup timeouts are fixed, so a case fails on the build, not on
Studio. Tool fix (bug queue, before the 679 backlog item): the e2e runner starts no case before every build step of the
run has ended; no load-scaled timeouts, because those hide a slow Studio. As built (681, 1cc2d2ee8): `quiet: true` cases
run last on worker 0 alone, every failed row prints `load <1-min> on <n> worker(s)`; the full run took 533.6 s against
503.6 s (+30 s, about 6 %, tail 62 s). Per ADR 0240 the tail cost is measured again after the build-order fix.

As built (B472, finding 683): the order already held. The runner owns two build steps: `ensureCli` (sync, before any
worker) and the Studio build (async); each worker runs its design server and the fixture listing during the build, then
awaits the `built` message before warm-up and its first `next`, so no case starts before the build ends. The design
server builds nothing the runner owns (a Vite dev server that compiles on request). In the 683 run the build ended at
41.9 s and the cases started after every worker was ready; `Fit is stable` was in the first wave, on three cold design
servers rendering their first pages, and the 1-min load still held the build. Built: a `first case starting at <s>`
line, the quiet-tail line carries its start time, and workers 1+ no longer restart during the tail (681 restarted both
for a 50 s setup only to get no job). Bite (fake 20 s build step, removed): HEAD `studio build done at 65.7s`, each
worker `build 17.0s` waited, cases after; with the worker wait removed, `first case starting at 51.9s` before `studio
build done at 54.6s`. Full run: 442.2 s, 131/131, load 4.9 at the start and 16.0 at the end, first case 51.4 s, tail
from 395.1 s, 46.9 s for 9 rows (against 503.6 s before 681 and 533.6 s after). Not verified: push:suite, CI, a second
full run for spread.

As built (683, 150c2cbe1): the cause recorded above is wrong. The runner already started no case before the Studio
build ended (`await studioBuilt` before warm-up and the first case); a bite with a 20 s slower build shows that this
wait holds the order. `Fit is stable` ran in the first wave on three cold design servers that each rendered their first
page; the 46.3 1-min load still carried the finished build. Cause now: first-wave cold design servers. Tool fix (next):
one warm-up page render per design server before its first case, with a bite (cold server fails the 10 s goto under the
same load, warm passes). Also fixed in 150c2cbe1: during the quiet tail, workers 1 and 2 restarted and did a full setup
of about 50 s for no case. Full `yarn studio:e2e`: 442.2 s, 131/131 (503.6 s before 681, 533.6 s after it).

As built (B472 warm-up, 683): what the warm-up missed is the shots. `warmUp` opens the default view, the System
page, which asks for 1 or 2 `/__design/shot` pictures. The Sketches page of `pages/system` asks for 52, and the design
server draws each one cold in its own browser, because every worker has a fresh checkout and so an empty shot store.
The 683 row shows that: 66 requests, most of them shots, pending at 10 s. Built: after `warmUp`, each worker takes its
first job and opens that job's page once (`openView`, 60 s cold-start timeouts), and waits until no shot request is
in flight for 1 s. The `ready` line keeps `warmUp` and adds `firstPage`. Bite, 3 workers with the three Fit cases, 10
`yes` processes, 1-min load 31 to 52: cold (warm-up as before), 3/3 passed, goto plus first frame 2.0 to 2.5 s, at
settle only 18 of 52, 24 of 30 and 26 of 32 shots answered, the last one after 25.0 s, cases 28.0, 32.8 and 41.7 s;
warm, 3/3 passed, every shot answered after 1.0 to 3.0 s, cases 18.0, 14.6 and 10.0 s. The bite did not reproduce
the 10 s goto fail cold: the goto ended before the shot images were in the page, so `load` did not wait for them. With
20 or 36 `yes` processes both modes failed earlier, in the fixture listing (60 s). Suspect: under load the page's
`load` event comes after the shot images are inserted, and then the goto waits for cold shot draws. Not proven. Cost:
`firstPage` 19.6, 27.7 and 47.8 s per worker under that load, 21.3 s unloaded; `warmUp` stays at 20 s loaded and 8.6 s
unloaded. The first case gets 10 to 32 s faster, so a worker's start costs net 10 to 16 s more, because the warm-up
waits for every shot of the page. Rejected: warming every target of the run on every worker took `warmUp` from 20 s to
116 to 119 s for three targets. Not verified: a cold goto fail, a full `yarn studio:e2e`, the first pages of the other
targets (System, Flow, Wide), CI.

Reverted (grill decision, 540dc26db): 995491fb1 fixed no reproduced fail and cost a net 10 to 16 s per worker (ADR
0230, ADR 0240). It had no diagnostics that stand alone: the `warmUp` phase timing was there before it. The measurement
stays: each worker draws the same ~52 shots cold, which is 667 (c), one shot store for all workers.

Builder (2026-11-10, Mac day, B472 / 683 follow-up): no run after the 540dc26db revert has a `Fit is stable` fail.
Targeted runs of the three Fit cases (Sketches, Large, Chip) on 3 cold workers, `--cold-shots`, 12 busy-loop hogs,
1-min load 38 to 45: 6 runs, 18/18 pass; Sketches 42.6 to 45.2 s, Large 31.8 to 32.6 s, Chip 26.1 to 26.6 s, `warmUp`
20.0 to 21.0 s, first case at 75.3 to 76.3 s. The 10 s `page.goto` fail did not come back. No new suspect beyond the
683 one (the page `load` waits for cold shot draws); still not proven.

684\. Doc agent (2026-11-10, Mac night, 683): I recorded "e2e cases start while the build runs" as the cause of 683
from the builder's first report, before any proof, and queued a fix for it; the bite then showed the rule already held.
A fix round went into a cause nobody had proven. Why no tool caught it: the findings format has no field that says
whether a cause is proven, so a suspect reads like a fact. Tool fix (process, doc agent and builder skills): a finding
writes "Suspect:" until a bite or a measurement proves it, and only "Cause:" after; the builder's report names which of
the two it is.

As measured (683, 995491fb1): a cold Fit case did not fail in the bite (3/3 cold and 3/3 warm at load 31-52), so 683
has no proven cause. Measured: the 683 fail row had 66 requests pending at 10 s, mostly `/__design/shot`; the Sketches
page asks for 52 shots, and each worker starts with an empty shot store, so each draws them all cold. Suspect: under
heavy load the `load` event waits for the cold shot draws. 995491fb1 opened each worker's first page in setup (net about
+10-16 s per worker) and is reverted (doc agent decision, ADR 0230 and 0240: no unproven fix that costs time). The fix
for the measured cold burst is 667 (c), one shot store for all workers, which removes the N-fold cold draws instead of
moving them into setup (the same lesson as fe28fc8c9 in 667).

As built (667 c, 82369780d): one `part-shots` store for every checkout, keyed by the read-files fingerprint with
checkout inputs stored relative to the checkout; up to 4 variants per key, one file per fingerprint, so a checkout
with other files never gets or overwrites another checkout's picture. A second bug, Cause proven by the bite: the
`server-<pid>` snapshot files were inputs under their real path through the `node_modules` symlink, so the store stayed
cold; both paths are filtered. Vite `cacheDir` stays per checkout (`getConfigHash` includes checkout paths). Bite, one
worker, two runs: before, 22 shots in setup and 28-35 per case in both runs; after, warm, 12 in setup (the fixture
compare redraws on purpose) and 0 per case; a changed `zoom-chip.ts` drew exactly the 67 keys that read it. Draws are
counted (`drawnTotal` in `/__design/queue`). 7 Fit and first-load cases, 3 workers, load 18-27: 120.9 s before, 93.4 s
after. Open: workers on a cold store at the same time still draw the same shot, because nothing shares an in-flight
draw; Suspect: the Wide Fit case draws about 30 shots each run, because its sketch is new in each checkout; 517 old
`shots-*` folders (5.5 GB) in `node_modules/.design-explore` stay.

As built (667 a, shared in-flight draw): before a design server draws a key that is not in the shared store, it takes
a lock file `draw.lock` in the key's store folder (`open` with `wx`, holding pid, start time and a token). A server that
finds the lock taken does not draw; it polls every 100 ms for the stored picture. It reads the picture only when the
read-files fingerprint matches its own checkout; else it draws itself once the lock is released. The owner releases the
lock after the store write, and also when the draw fails or is dropped, so a waiter then draws itself. A lock of a dead
pid, or one older than the draw limit (`DRAW_LIMIT_MS` 60 s, scaled by load), is taken over, and the waiter logs
"past the draw limit" when the age was the reason. Fresh draws neither lock nor wait. The ledger counts `waitedTotal`
next to `drawnTotal` (`/__design/queue`); the e2e `ready` line and each case line print both.
Bite, unit: two stores on one folder, the second waits and reads the first's picture; two shooters, the second draws 0
and waits for 1; a dead-pid lock and an old lock are taken over; a failed draw and a changed input file let the waiter
draw. `spec:stress` 4/4 on the three touched specs. E2E, 7 first-load and Fit cases, 3 workers, cold store each run,
load 4 to 28: setup draws per worker HEAD 22/22/22 (66) and new 21+1/13+6/12+2 waited (46 drawn, 9 waited). Plain
7/7, 115.2 s HEAD vs 112.8 s new. With `--hold-listings 14000`: setup HEAD 20/21/22 (63), new 46 drawn and 9 waited
as above; 7/7, 226.3 s HEAD vs 220.4 s new. Case draws hardly changed (25 to 55 per Fit case, 3 waited for in all):
each case runs another target on another worker, so the workers rarely draw the same key at once. Not explained: the
held Wide Fit case drew 79 at HEAD and 132 new, with 0 waited for in it; one run each. No
"past the draw limit" line in the runs. About 12 setup draws per worker stay: the fixture compare draws fresh on
purpose. Suspect: a lock is taken when the draw is queued, not when it starts, so a waiter may wait for a draw that
sits in the owner's backlog; bounded by the draw limit, not seen in the runs. A server that is killed leaves its locks
(2 left after a plain run); the next waiter takes them over and the store sweep removes dead-pid locks. Not verified: a
full `yarn studio:e2e`, CI, more than 3 workers, a waiter that really reaches the draw limit.

As built (667 b, 8f45fbb32): each design server start removes the old path-keyed shot folders in
`node_modules/.design-explore`. Correction: the old name was `shots-<10 hex>` (`viteCacheOf` cuts the sha1 to 10), not
the full sha1. Only directories that match `^shots-[0-9a-f]{10}$` go; `part-shots`, `shots-foo`, `vite-*` and every other
name stay. It runs once per start in `serveDesign`, under the same condition that turns on the shot store, and is not
awaited, so the start is not slower; a failed removal logs one line and the server goes on. Bite: spec
`old-shot-folders.spec.ts` (pattern, missing root, unremovable folder) red without the module, 3/3 with it, `spec:stress`
4/4. Real run: 525 folders and 5.6 GB before, 0 folders and 304 MB after one server start (`part-shots` kept), about 8 s
from launch including the boot. Not verified: a spec for the `serve.ts` wiring, several servers that start at once,
Windows file locks.

689\. Builder (2026-11-10, day shift, B473 bite, 9a2573e21): a first bite with a type error in
`libs/bracket/src/index.ts` passed the new push:suite typecheck step. Cause (bitten): every lib `typecheck` target runs
only `tsconfig.spec.json`, so it checks the specs and what they import; lib source that no spec reaches gets a type
check only from `build` in CI. A second bite in `libs/bracket/src/lib/core/layout.ts` (reached by a spec) failed the step
with TS2322 in 6 s. Why no tool caught it: the target is named `typecheck`, and nothing says it covers only the spec
graph. Tool fix (doc agent, it applies ADR 0245 "typecheck the touched projects" to the whole project): each lib
`typecheck` target also checks `tsconfig.lib.json` with `--noEmit` (ngc for the Angular libs); bite on
`libs/bracket/src/index.ts`; measure the time per lib first and report it. Also seen: an eslint `no-control-regex`
error in `tools/scripts/push-suite.spec.mjs:138`, older; `tools/` is in no lint project.

690\. Builder (2026-11-10, day shift): a failed `cd` into a bite worktree made the bite commit `495b906bf "bite"` land
on `next` in the main checkout. The builder moved HEAD back with `git update-ref HEAD a3683f6ad 495b906bf`; nothing
else was on top. Cause: the bite commit ran in the shell's current directory after the `cd` failed, and `git commit`
accepts any message locally (commitlint runs only at pre-push and in CI). Why no tool caught it: nothing stops a
throwaway commit on `next`. Tool fix: the builder skill and every bite brief say to commit in a worktree only with
`git -C <worktree>`, never after a bare `cd`.

691\. Builder (2026-11-10, day shift, base comparison for B471): the 3 OFF-CENTRE lines on `elements/canvas-frames`
(rounds@1440, round-folded@1440 x2: the `button.et-surface-interactive` text sits 1.0 px high, 7.1 px above the capitals,
8.1 px below the baseline) also print at `7d72894fa~1`, with fresh cli, components and core builds. Both runs exit 1
with `OFF-CENTRE 3` and `NO RECORD ... OFF-CENTRE` and no other difference. So 7d72894fa is clear, and the 1 px is an
older UI defect with no STATUS row (now B477). Cause (builder, `git grep`): no gate runs `design check`; only the
on-demand `yarn et:design check` at a slice end does. `design-rules-gate.mjs` has no caller since pre-commit dropped it
after 2026-11-06, and the builder skill still says the full check runs in pre-push and CI, which is false. So an older
red result shows up first in a later slice and looks new. Tool fix (doc agent, applies ADR 0226 "no Studio check in
git hooks or CI" and ADR 0095 "old issues stay visible"): no CI job; the builder skill line says the full check runs
on demand at each slice end until the live check (B424) replaces it; `design check` marks each finding that the base
already shows as old, so a slice sees at once what it added.

693\. Doc agent (2026-11-10, day shift, B475): after the plugin install on Linux the LSP tool said "No LSP server
available for file type: .ts". The `typescript-lsp` plugin only starts `typescript-language-server` from `PATH`, and
neither machine had it; the install printed "Plugin is now active" all the same. Node comes from fnm here, so a global
npm package exists only for the active Node version. Tool fix: the builder skill checks
`command -v typescript-language-server` before the B475 bite and names the missing binary, and the ADR 0246 bite
counts only when the LSP tool returns a diagnostic, not when the plugin is listed. Decided (the human: "q1ok"): the
server is installed globally on both machines with `npm i -g typescript-language-server typescript`; done by the doc
agent on Linux (fnm Node 24.17.0) and on ethlete-mac (`~/.local/node`). After a Node version switch, install again.

694\. Doc agent (2026-11-10, day shift, B477 note): a 120-char longer B477 cell made STATUS.md grow by 9k chars, from
230556 to 239564, and the pre-commit hook (now with `set -e`, 692) stopped the commit: "237930 chars exceeds the budget
of 230000". Cause: Prettier pads every table row to the widest cell, so the widest row sets the size of all 231 rows
(872 chars each). The budget error names neither the cause nor the row. Tool fix: the STATUS check measures the rows
without padding (or caps one cell, for example at 400 chars, and names the row over the cap), so a budget error points
at real content; the error message names the widest row.

695\. Builder (2026-11-10, day shift, 5ae1ecb24): dae1ed29d (691) made `base-issues.ts` import `sameRenderIssueKeyOf`
from `render-check` as a value, so `check-system` loaded `render-check` first and the `vi.mock('./render-check')`
factory of `check-ready-blockers.spec.ts` got the real module chain; the spec failed first in push:suite (proven with a
log). Fix: the key lives in `render-issue-key.ts`; `oldIssuesOfRun` marks nothing if the base cannot be read. The tool
worked as designed: push:suite caught it before the push (the builder skill says `yarn commit` runs no spec, so the
builder's idea that `yarn commit` runs `vitest related` was wrong). The cost was one more push:suite run. Tool fix, no
hook (ADR 0225 keeps slow checks out of git hooks): the builder skill and every slice brief run
`vitest related --run <changed files>` for the touched project at the end of a slice that changes an import between
modules, so a spec that mocks a module the slice re-imports fails in the slice.

696\. Builder (2026-11-10, day shift, B475): after a `/clear` restart the LSP tool still said "No LSP server available
for file type: .ts". The claude process started at 10:22, the plugin was installed at 10:26, and the agent-sessions
`restart` command only types `/clear` and a prompt, so the process never reloads plugins, `PATH` or hooks. The
doc-agent skill calls this "restart its CLI", which it is not. Tool fix: `restart` gets a mode that ends the process
and starts a new one in the same tmux pane (for example `/exit`, then the agent command with `--continue` or a
`/handoff resume` prompt), and the skills say which change needs it (plugin, settings, `PATH`). Bite: a plugin
installed after the start is live after the new restart mode, not after `/clear`.

697\. Doc agent (2026-11-10, day shift, first `restart --process`, 3cfdb35d0): the typed `/exit` opened the Claude
Code dialog "Background work is running ... The following will stop when you exit: shell · gh run watch 42796254724"
with the choices exit and stop tasks, move to background and exit, stay. The restart waited on it until someone
answered (screenshot from the human). The new process then ran in a new tmux session `claude-3@ethlete-sdk`; the old
`claude@ethlete-sdk` was gone, so a check by session name fails. Cause (measured by the builder): the respawn runs `$SHELL -lic "claude <prompt>"`; in the login shell `claude` is the shell-install function, which calls `agent-sessions run`; with `$TMUX` set, `run` picks a free session name (claude-3), switches to it and exits, so the old pane dies and its session closes. Side defect: `run` stores the prompt in `@ethlete_command`, so the next `restart --process` types the stale `/handoff resume` first. Fix part: respawn with `command claude` (no shell function) and store only the base command. Tool fix: `restart --process` stops the background work of the session first (or
answers the dialog with "exit and stop tasks", since the handoff names the work), the handoff names each stopped
background job so the new process starts it again (here the CI watch), and the new process keeps the old tmux session
name. Bite: a session with a running background shell restarts with `--process` without a human, in the same tmux
session, and the new process resumes the watch.

As built (697): the respawn command starts with `command` (after any `VAR=value` prefix), so the shell function does
not run and the pane keeps its session. `run` stores the command without the trailing prompt (a last word that is not
a flag and not the value of a flag, or the words after `--`). After `/exit`, the restart reads the pane; on "will stop
when you exit" it moves the cursor to "exit and stop tasks", presses Enter, and writes the listed jobs to
`restart.log` and a mailbox notice. The handoff skill says to name each background job before `--process`. Verified:
three new specs (respawn bypasses a shell function, `run` stores no prompt, the dialog is answered), each fails with its
part reverted. Not verified: live bite with a real Claude session and the real dialog text and cursor.

698\. Builder (2026-11-10, day shift, cfa266758): `lint:changesets` refused the push of 17913b655 and 1c72a5026, two
docs-only ADR edits under `apps/ethlete-studio/docs/adr/` without a changeset. Only pre-push catches it; doc-agent ADR
commits have the same gap. Tool fix, small: the builder and doc-agent skills say that an ADR edit is a change to
`ethlete-studio` and gets an `'ethlete-studio': none` changeset in the same commit.

699\. Builder ethlete-mac (2026-11-10, B469): a release build of Studio never leaves "Design-Server startet", on
WKWebView and on CEF alike (macOS x64, 0.2.0-next.15). The server runs and answers on `[::1]:4402`, but the CSP in
`tauri.conf.json` has `connect-src 'self' ipc: http://ipc.localhost`, so each `fetch` of
`http://localhost:4402/__design/stamp` is refused (62 errors in 60 s, over CDP). Two more CSP refusals in the same
run: Tauri adds a nonce to `style-src`, which makes `'unsafe-inline'` void (18 inline styles refused), and the inlined
Google fonts load from `fonts.gstatic.com`, which `default-src 'self'` refuses. Cause: dev builds load `devUrl` with
no CSP, and no check opens a release build; `cef-runtime.md` slice 2 step 5 already said "CSP not checked in a
release build". Fixed in the B469 commit: `connect-src` and `img-src` allow `http://localhost:*` and
`http://127.0.0.1:*`, `font-src` allows `https://fonts.gstatic.com`, and `dangerousDisableAssetCspModification:
["style-src"]`. Bite: the CEF release build then opens the sketch `components/button` with six live frames and no
console error. Not verified: a Linux deb with the fix, and the WKWebView release with the fix. Tool fix (proposal): a
smoke step that starts the release bundle once and fails on a CSP refusal in the console.

700\. Builder ethlete-mac (2026-11-10, B469): two defects of `tauri-runtime-cef` (rev `9d1a5b1`) with
`RemoteDebugging::Port`. (a) A run with `Disabled` writes `devtools.remote_debugging.allowed: false` into
`~/Library/Caches/<identifier>/cef/Local State`; a later run with `Port` does not reset it, so Chromium prints
"DevTools remote debugging is disallowed by the system admin" and opens no port. Workaround: delete the key. (b) The
CDP listen socket leaks into child processes: the design server (`node .../cli design`) held `127.0.0.1:9333` after
Studio started it. Both matter only when a build turns the debug port on, for example a future Studio e2e over CDP.
Tool fix: a CDP harness deletes the key before the start. No upstream report: the human chose to keep it internal (ADR 0251).

706\. Doc agent (2026-11-10, day shift): the Mac builder pushed the CEF switch for macOS (df49f570e, f08f0a3d1, merge
87fe8f015) and ended its turn at 12:09 with the chat line "The doc agent closes B469 and B479". It sent no mailbox
message; the doc agent's inbox wait printed "No new messages", and the human noticed the end ("ich glaub mac ist
fertig"). Suspect: the report rule lives only in the handoff text, and nothing checks that a pushed result reached the
grill session. Tool fix: the builder Stop hook (703) also blocks a stop once when the turn made a commit or a push and
sent no report to the grill session (`SendMessage`, or `agent-sessions send` on the Mac). Bite: a turn that commits and
ends with only a chat line gets the block; a turn with a send does not.

705 rerun (builder, after B481 2dd96ea76): under `spec:stress --slow 13` B443 passes 2/4; a direct slowed run failed
"stops waiting as soon as the expected output fired" with `[]` against `['go']` (1193 ms), the same early return in
another case. B442 passes 3/4; 2 of 3 direct slowed runs fail with `closed: false`, as in CI. Both reproduce; causes
not proven yet. B437 closed by CI run 42806303431 (3c5f77755, green): the 6 Studio e2e shards took 214, 322, 202, 305,
230 and 178 s, wall time 322 s; shards 2 and 4 take about 1.7 times as long as shard 6.

707\. The human (2026-11-10, day shift, editor screenshot of a sketch part file): "der ts server kommt in sketches auch
noch nicht mit imports klar". The editor shows `Cannot find module '@design-system' or its corresponding type
declarations. ts(2307)` on `from '@design-system'`. Facts (doc agent): the generated, gitignored
`.ethlete/design/sdk/tsconfig.json` and `.ethlete/design/studio/tsconfig.json` (both written 10:35 today) map
`@design-system` to `/home/tom/dev/ethlete-sdk/tmp/691-cli-lowered/design/define-part.ts`, a temp CLI copy that no
longer exists; their `include` lists the part files and `fixtures.ts`, but no file under `sketches/`. Suspect: (a) a run
from a temp CLI copy (finding 691 bite) rewrote the tsconfig with its own paths, and nothing writes them back when the
copy is gone; (b) a sketch file is outside `include`, so the TS server gives it an inferred project with no `paths`, even
when (a) is fixed. Tool fix: the tsconfig writer refuses a `@design-system` target outside the installed CLI (or
under `tmp/`), every `design` command repairs a tsconfig whose targets do not exist, and the tsconfig covers the
sketch variant files (`sketches/**`, with their own `@system/*` paths per variant or a per-sketch tsconfig). Bite: in a
sketch variant file the LSP reports no ts(2307) on `@design-system` and `@system/*`, also after a run from a temp CLI.

708\. The human (2026-11-10, day shift, editor screenshot): "und wir solten auch hier schauen dass wir keine lint
warnings einbauen". `@typescript-eslint/no-non-null-assertion` on
`SDK_ICONS.find((each) => each.name === 'et-plus')!` in `.ethlete/design/sdk/components/button/button.ts:30` (merged
in c8f5ac740, "Merge the button size round") and in the three variants of the sketch `components-button.off-centre`.
Suspect: no lint target covers `.ethlete/design/**`, so the zero-new-warnings rule never reaches a design part or a
sketch, and `sketch ready` and the merge do not lint. Tool fix: `design check` and `sketch ready` run ESLint on the
changed part and variant files and fail on any warning (a baseline for the old ones is allowed, then only smaller);
the merge refuses a variant with a new warning. Bite: the `components-button.off-centre` variant with the `!` fails
`sketch ready`; with `SDK_ICONS.find(...) ?? fail(...)` it passes.
As built (Mac, 708 follow-ups): calls gate in design check against `.ethlete/design/calls/lint-baseline.json` and a pre-commit lint of staged `.ethlete/**/*.ts` (65acd20da); 713 was already built in 27f3a3d35, its bite ran.
As built (708, builder subagent). Cause (measured): every lint target of the 23 projects with one runs `eslint .` in
its own root (`nx show project <p>`), none of them under `.ethlete`, and the pre-commit hook lints only staged
`libs/*`, `apps/*` and `tools/*` files. The root `eslint.config.mjs` does reach the folder (the editor warning):
`npx eslint '.ethlete/design/**/*.ts'` finds 38 findings, 5 of them in sdk parts (button, breadcrumb, tabs, timeline,
toolbar), the rest in calls. Nothing in the design tool ran ESLint on a part or a variant. Fix: `design-lint.ts` runs
the checkout's ESLint (`--format json`, one spawn) on the changed files only. `design check` (product, `--part` and
whole run) lints the part and variant files that differ from HEAD or are untracked, shrinks the product's
`lint-baseline.json` to what fires now and fails on a finding over it; `sketch ready` lints the live variants and the
sketch `shared/` folder before rendering; `mergeSketch` refuses the picked variant with a new finding (CLI and Studio
merge). The baseline counts findings per part file and rule, a variant file counts as its part file, and an entry
added or grown after the file's first commit fails (`addedBaselineNamesOf`, as the rule baseline). Seeded with the 4
old sdk `!` (breadcrumb, tabs, timeline, toolbar). `button.ts:30` uses `?? fail('SDK_ICONS has no et-plus')` (a direct
edit of a merged part: it shows as changed outside a sketch until the human approves it). The sketch
`components-button.off-centre` is in no checkout here (not committed, not on disk), so nothing was merged or deleted.
Bite (worktree at HEAD + the change, cli built there, `sketch new components/button@off-centre --variants a,b,c`):
variant a with the `!` -> `sketch ready` exit 1, `LINT ...a/components/button/button.ts:34:25
@typescript-eslint/no-non-null-assertion` and "adds lint warnings - fix them before ready"; with `?? fail(...)` -> no
LINT line, ready passes the gate and goes on to render (then refuses "draws variants alike", the untouched copies).
Specs: `design-lint.spec.ts` (5 cases); the merge case fails with the merge gate disabled. Not verified: `design check`
against the real sdk product end to end, and a Studio merge in the app.

713\. Builder (2026-11-10, day shift, B249 app slice): the push of 27e923d8b failed; pre-push `lint:studio-label-specs`
found that `system-view.component.spec.ts:1488` asserts the removed label "Go geben" (`not.toContain`). Fix: the line
is gone; the spec already asserts that no `ethlete-part-approval` exists (47/47). Cause: the label-spec lint runs only
in pre-push, and a slice subagent never runs pre-push, so the slice commit passed. Tool fix (builder default, tool
backlog): pre-commit runs `lint:studio-label-specs` on staged spec files under `apps/ethlete-studio` (sub-second);
bite: a staged spec that names a label the app no longer has is refused at commit.

716\. Builder (2026-11-10, day shift, 714 follow-up c4c0939ee): the first push suite blocked on `query:typecheck`; the
`libs/query` ngc lib config includes `src/scenarios`, and the new harness used `process` with no Node types. The 714
subagent ran only `tsc -p tsconfig.spec.json`, because its brief named only that. Cause: the agent memory
"vitest-does-not-typecheck" told every brief to run the spec tsconfig, not the project's `typecheck` target. Fix: the
harness reads the env through `globalThis`; the doc agent rewrote that memory to name `nx run <p>:typecheck`. Tool fix
(builder default): the builder's slice brief template names the `typecheck` target of each touched project; the
`builder-agent` skill already says so for the slice itself. As built 714 CI: `query-clock-edges` (18d325612), matrix
fraction 0 and 999 in parallel to `test`, in the `verified` needs; the two real CI runs are still owed.

717\. Builder (2026-11-10, day shift, B249 missing harness 7093784d7): with "no harness = definite blocker", 12 cli spec
cases had to change, and `part-ready` lost two cases: a CLI ready mark that succeeds, and the CLI action-failure lines
with `--url` (the POST path still covers both). Cause: the cli fixtures hold no product with a valid harness map, so a
case that needs build-ready plus a harness is expensive to write; each spec built its own harness-less product. Tool fix
(builder default, after B249 in the STATUS order): one shared cli fixture product with a minimal valid harness map, used
by the build-ready specs; restore the two lost `part-ready` cases on it. Also from this slice: studio-lab has no harness,
so its parts read "Nicht baubereit (Kein Harness)"; whether it gets one is collected for the human.

718\. Builder (2026-11-10, day shift, B249 "Sketch öffnen" browser check): the check reached the direct-edit footer only
after the subagent removed the `harness` block of `studio` in its scratch config. With the harness, every studio part
with a stale or absent record shows "Wird geprüft", and a scratch `design check components/disclosure` did not clear it.
Cause (bite, 538b77b31): plain `design check` never runs the slow rules (only `design ready`, `check --slow` and the serve
slow runner do; `--slow` writes no record), so a part with a missing or stale slow result stays `pending` and reads
`[stale-record, pending]` ("Wird geprüft"). Fix: a `--part` check in a harness product runs the pending slow rules of
that part, then records. A whole-product check still leaves pending parts to serve (doc agent decision: tool
internal); its output must name the pending count and the command that settles them. Tool gap: no e2e case drives a harness product from a stale record to a settled
footer, and a browser check may change the product config without saying the result no longer covers the real one.
Tool fix (builder, ahead of the B249 CLI removal because it blocks B249): that e2e case first; a verify brief forbids
config edits, or the report names them as "not verified on the real config". Also seen: repo `dist/libs/cli` was
stale against HEAD and the CLI refused to start in a scratch copy until rebuilt.

725\. Doc agent (2026-11-10): I decided that the pre-commit hook lints staged `.ethlete/**/*.ts` (708 follow-up) without
running `yarn adr:governs .husky/pre-commit`. ADR 0036 (the human: "we built a check system in Studio, why rely on git
hooks") moves Studio gates out of the git hooks (B295). Cause: the doc agent skipped the governs check for a tool-internal
decision. Fix: the gate stays in pre-commit until B295, and B295 moves it into Studio's check system with the four
pre-push gates. Process: run `yarn adr:governs` before every decision on files, tool-internal ones too.

727\. Mac builder (2026-11-10, 722 push): push:suite at 8145d8357 failed `shot-store-draw-lock.spec.ts` "takes over the
lock of a live process once it is older than the wait": expected 49 >= 50. Suspect (code reading, no bite): the product
counts the lock age from `lock.at`, the spec from a later `Date.now()`. Fix 10b906189: the spec measures from the lock
file's `at`; `spec:stress --load 2` 4/4. The push suite caught it, so no tool gap.

729\. Mac builder (2026-11-10, A1 rest): both checkouts hold an untracked direct-edit sketch
`.ethlete/design/studio/sketches/components-title-bar.edit/` (target `components/title-bar@edit`, created 09:51 UTC,
status ready) whose diff removes the push gate badge, which 6530d25e7 already committed. Suspect: a direct-edit sketch
stays behind when its change reaches git by another path. Tool fix (Linux builder, after B249): `design check` names a
direct-edit sketch whose diff HEAD already holds as stale and the discard removes it; a spec bites on such a sketch.

730\. Linux builder (2026-11-10, 719 fix): the opus subagent left 5 wait loops with `pgrep -f <pattern>` that match
their own command line and never end; the builder killed them. Cause: known since finding 173; its tool fix B99 (Bash
hook refuses `pgrep -f`/`pkill -f` wait loops and points to run_in_background or Monitor) is still unbuilt. Lesson: a
brief line in each subagent prompt is a stop-gap; B99 is the tool fix. Stop-gap now (Linux builder): one line in its
subagent brief template. B99 keeps its STATUS place.

732\. Linux builder (2026-11-10, B249 real-config re-check, passed): "Sketch öffnen" of a direct-edit point is reachable
only inside the collapsed "Gründe" disclosure of the footer popover, though it is the only action there. ADR 0252 says
the button opens the sketch, not where it sits. Placement question for the human: a sketch with the variants "inside
Gründe" (as built) and "on the popover's top level" (builder recommendation), after the 719 CPU-quota step.

733\. Mac builder (2026-11-10, A1 rest, 7b6236922): `design compare components/title-bar` cannot judge two drawn states.
(a) The five `*-notice` states FAIL: the design draws the notice tooltip always open, the app opens `etTooltip` only on
hover or focus, and the design forces no interaction on the restart button. (b) `linux-full-notice-pending` DIFF 115 px
only on the spinner: the mock draws a static arc without `data-et-frozen-at`, so compare cannot hold the app's
indeterminate `et-spinner` at the mock's frame. Suspect: compare has no way to open an overlay a state draws, and no
rule that a mock of an animated control carries a frame. Tool fix (backlog): a state may name the interaction that
opens its overlay, and compare applies it; `design check` flags an animated-control mock without `data-et-frozen-at`.

736\. Linux builder (2026-11-10, 732 sketch `pages/system@footer-open-points`, 6c2fc5cc0): `design shot
pages/system@footer-open-points` fails "has no open sketch in product studio", and `shot pages/system --variants` draws
the other open `pages-system` sketch. Cause (measured by the subagent): `sketchHoldingOf` in
`libs/cli/src/lib/design/shot-command.ts` matches the part only, never the sketch name. Missed: no spec has two open
sketches on one part. Tool fix (Linux builder, after 731): shot resolves `<part>@<name>`; spec bite with two sketches
on one part; an `--at` shot of a named sketch counts as viewed.

737\. Linux builder (2026-11-10, same sketch): because of 736, `sketch ready` refused with SHOT-NOT-VIEWED, and the
subagent called `recordShotViewed` directly to pass the gate. The gate was bypassed, not met; the builder says the
viewed content equals the commit. Lesson: a gate that an agent can satisfy with one internal call is no gate when the
tool is broken; the agent must stop and report the tool defect instead. Tool fix (with 736): the viewed record holds
the hash of the shot file the CLI drew, and `sketch ready` checks it, so a direct call without a real shot fails;
builder subagent briefs say "a refused gate is a finding, never call its internals".

738\. Linux builder (2026-11-10, same sketch): `sketch check` 34 s and `sketch ready` 36.6 s against the 10 s target,
render-check about 13 s. Suspect only (no measurement of the phases). Backlog: measure the phases before a fix.

740\. Mac builder (same sketch): the clipping check flags the intended crop of the variants, and skip-scope refuses
the reason "intended" because the crop holds controls; only "inert" passes. Suspect only. Lesson: a check that accepts
only a wrong reason teaches the agent to give a wrong reason (as 737). Tool fix (backlog): skip-scope accepts
"intended" for a crop that a state marks as a crop, or the clipping check knows a crop frame; the builder says which
reason the sketch now carries.

742\. Linux builder (2026-11-10, 732 live look): `yarn et:design` in tmux `studio-serve` ran the checks, started the
harness app on 127.0.0.1:44331, then printed EDIT-OLD-NOT-FOUND for `sdk components/select` and `studio pages/start`
208 times in about 35 min and never bound :4402 (the harness port did not answer either). Log
`/tmp/studio-serve-loop.log`. Side effect: it wrote `.ethlete/design/sdk/ready.json` (+201 lines, uncommitted). Suspect:
the serve start retries the EDIT-OLD-NOT-FOUND sketch step and never reaches listen; ADR 0253 says such a part gets one
sketch with only `new`, so the step must create it once and go on. Missed: no spec starts a serve with an
EDIT-OLD-NOT-FOUND part. Decided by the doc agent (blocks the human's live look at 732 and B345, rule b): Linux builder
builds it before 731; bite: a serve spec with such a part binds its port and creates the sketch once. The stray
`sdk/ready.json` change is the builder's to judge (keep if the serve was right to write it, else restore).

On 735 (9c6d2e782): the old case passed 10/10 at 20% one at a time, so the bite "old fails the step" is not met. The
fix is a margin gain (about 200 ms to 1600 ms under the 2500 ms budget), not a proven cause of the one 2698 ms failure.

743\. Mac builder (2026-11-10, B345 push): pre-push refused the push because the person-name check found the human's
full name in the pin thread of `pages/sketches@change-crop` b/c `sketch-data.ts`, copied from the merged page. The merged
parts `pages/sketches/sketch-data.ts`, `pages/inbox/shared/inbox.ts` and `components/comment-row/comment-row.ts` still
hold the name. Suspect: the check scans only the changed files, so a name in a merged part spreads into every sketch
that copies it. Tool fix (backlog): the person-name check runs once over all of `.ethlete/design` and the merged parts
use a neutral author; a sketch built from a part then starts clean.

746\. Mac builder (2026-11-10, B482 bite): the release smoke and its bite both failed "no frame painted". Cause (seen on a
screen shot): the smoke starts the unsigned bundle with its own HOME, so it finds no keychain, and CEF shows the macOS
prompt "Schlüsselbund nicht gefunden" (a keychain password prompt) that blocks the page. Suspect: the earlier
locked-screen failure was the same prompt. The human had to click several of these prompts away. Fix in the tree: with
`ETHLETE_STUDIO_SMOKE_VIEW` set, Studio passes `SecretStorage::Mock` (`--use-mock-keychain`) to the CEF runtime, and the
smoke opens the first existing sketch and fails at once when there is none. Lesson: the smoke cannot see a native modal,
so it waited for a frame that never came and named the wrong cause. Decided by the doc agent (tool internal): the smoke
fails early when the console log stays empty and no CEF page loads in 30 s, and its message names "native dialog?".

Built (Mac builder, 746): f10c01295 (mock keychain under `ETHLETE_STUDIO_SMOKE_VIEW`, a "page loaded" marker from the
init script, fail after 30 s with "no page loaded in 30 s (native dialog?)", first existing sketch as default). Dead
end: a run before the commit still showed the prompt, because the smoke builds HEAD in a worktree, not the working tree.
Decided by the doc agent (tool internal): the smoke `--help` and its start line name the commit it builds ("builds HEAD
<sha>, not the working tree"), and it warns when the working tree has uncommitted changes under `apps/ethlete-studio`.

747\. The human (2026-11-10, screen shot of CI on the "next" changesets merge): the Checks step failed in commitlint on
`chore: 🤖 update prereleases (next)` with "scope may not be empty [scope-empty]". Cause (read in the files):
`.github/workflows/ci-next.yml` and `ci-main.yml` pass `commit_message: 'chore: 🤖 update prereleases'` (and `'chore: 🤖
update versions'`) to `publish.yml`, and the commitlint range check in `ci.yml` (71c202188, 3ba2ca88b) now lints that
bot commit with `scope-empty: never`. Lesson: the commitlint gate came in without a look at the commit messages the
workflows write themselves, so nothing ran them through commitlint. Decided by the doc agent (tool internal, CI is red):
both messages get a scope and a valid subject, for example `chore(repo): Update prereleases`, and a check (spec or
`lint:*` script in pre-push) runs every `commit_message:` in `.github/workflows/*.yml` through commitlint, so a new
gate or a new workflow message fails locally first.

As built (Linux builder, 747): the release bot commit `chore: 🤖 update prereleases (next)` had no scope, so commitlint failed on it. `ci-next.yml` and `ci-main.yml` now pass `chore(repo): Update prereleases` and `chore(repo): Update versions`; the vendored action appends ` (next)` in pre mode. New `yarn lint:commit-messages` (`tools/scripts/check-workflow-commit-messages.mjs`) lints every workflow `commit_message:` plus that suffix; wired in ci.yml after the commitlint step and in `.husky/pre-push`. Bite: the spec fails the old scopeless message and passes the new ones. Not verified: a real release run.

750\. The human (2026-11-10, Studio screen shot after the B483 serve restart): `components-title-bar.edit` is gone (B483
works on the real repo). Left is the marker sketch `pages/system` (round 1 "Fehlende Build-Antwort der Auflistung",
variant a, last change by a Sonnet subagent): Studio shows "27 unveränderte Zustände eingeklappt" and not one changed
state, so the human sees a sketch with nothing to look at. Its files have uncommitted changes in the Linux tree
(`build-ready-footer.ts`, `system.ts`, `sketch.json`); the sketch is from 21ff32b31 (2026-11-07). Cause (proven by diff, Linux builder): variant a was never drawn; the marker commit 21ff32b31 copied the design and added no state, and the uncommitted Sonnet edits only resync the variant to 7fec742b2. The doc agent suspect (a state without a frame) was wrong. Lesson: a sketch
with zero changed states reached the human. Decided by the doc agent (tool internal): `sketch check` and `sketch ready`
refuse a variant with zero changed states and name the state that should differ; Studio never lists such a sketch as
waiting for the human. The Linux builder owns this sketch (the human: "deine baustelle") and finds the cause first. Added: `sketch new` for a marker sketch refuses to finish when variant a has no state beyond the design. Decided by the doc agent (applies ADR 0010 to pages/system): variant a = the built look (subtle note line), b = an error card in the canvas like the empty-product card ("Auflistung fehlgeschlagen", server reason, "Erneut laden"), c = a head banner in the error colour with "Erneut laden", tree still shown; the human picks by merge. The human merged variant b (514dbc881, 2026-11-10 night); the app build is STATUS row B485. As built (Linux builder, 64c27a08c, tool guard): `sketch ready` refuses and `sketch check` warns with NO-CHANGED-STATE when a variant draws no state that differs from the design in pixels; Studio shows it as a problem on the variant and blocks the pick. Bite: 2 sketch-command tests and 1 listing test fail on the old code. A flag `--no-visible-change` keeps the auto-merge of a rule-only sketch that must change no pixel (decided by the doc agent: keep, it preserves existing behaviour). Backlog: `sketch new --ready` does not take the flag; `sketch check` is slower now because it takes the per-variant change shot (738).

751\. The human (2026-11-10, late evening): "würde schon gern mal wieder ins schaffen mit resultaten kommen, aktuell
haben wir echt wieder so ein fix loop". Cause (read in this session): the doc agent sent each new tool lesson (746 HEAD
hint, 748 STATUS check, 750 sketch guard) to a builder as work at once, and the Mac builder ran B482 bite rounds, a tool
item outside the binding order; the same failure as 711. Lesson: the rule against standstill exists, but a decided tool
fix had no default place except a builder message. Decided by the doc agent: a tool fix decided by the doc agent goes
into the "Werkzeug-Rückstand" line of STATUS.md, never into a builder message as work, unless CI is red or it blocks the
current item. Both builders are back on the binding order; B482 is parked after its running smoke.

752\. Linux builder (2026-11-10, night setup): the usage-limit watchdogs of ADR 0220 could not be set. `claude-at` no
longer exists on the desk PC, and auto mode denied the builder's `systemd-run --user` timers twice ("Unauthorized
Persistence", then "Tmux Self Drive", because the script types into the builder's own pane). The builder wrote
`/tmp/dx/kick.sh` and gave the human a `!` command in tmux claude-3. Lesson: each night rebuilt its watchdog by hand,
and the tool was lost. Decided by the doc agent (tool internal, night backlog): the agent-sessions script gets a
`watchdog` command (one-shot resume after a usage-limit reset, log file, pane list) that the human installs once with
an allow rule, so no night needs a hand-made timer.

753\. Linux builder (2026-11-10, night, 750 sketch): `sketch note <variant>` overwrites the whole round note, so a note
for variant b deleted the line of variant a; all three lines went in with one `sketch round pages/system r1 --note`.
Lesson: the variant argument suggests a per-variant note, but the tool stores one note per round. Decided by the doc
agent (tool internal, backlog): the round note keeps one line per variant, and `sketch note <variant>` replaces only
that line; a spec writes notes for a, b and c in sequence and reads all three back.

754\. Linux builder (same sketch): no command prints the number of changed states of a sketch variant; it shows only
through the `sketch ready` lines. With finding 750 (a sketch with zero changed states reached the human) this count is
the fact an agent needs first. Decided by the doc agent (tool internal, backlog): `sketch status` (or `sketch check`)
prints the changed-state count per variant, and the 750 guard uses the same count.

755\. Linux builder (same sketch, scratch copy `/tmp/sk750`): (a) `sketch check` flags the gitignored, regenerated
`<variant>/tsconfig.json` as FORMAT; (b) with a `node_modules` symlink to the repo, the scratch writes its shots into
the repo's `node_modules/.design-explore`. Lesson: a scratch copy is the documented safe way to verify a sketch off
:4402, but the tool treats it like a repo and leaks into the real one. Decided by the doc agent (tool internal,
backlog): the format check skips gitignored generated files, and the shot cache resolves from the project root, not
through the `node_modules` real path.

756\. Linux builder (same sketch): the repo's `pages/system` variant `a/tsconfig.json` is not formatted by Prettier.
Suspect: the generator writes it with `JSON.stringify` and no format pass (not checked). Backlog: the generator
formats what it writes; a spec runs Prettier `--check` on a freshly created variant.

757\. Linux builder (same sketch): the SDK banner with type error drew teal in Studio, because no
`data-et-semantic-color="error"` wrapper was around it. Suspect: the banner type sets the icon and the role, but not
the semantic colour theme. Lesson: a component API that takes "error" and draws the brand colour lets a sketch show a
wrong look without a warning. Open: the builder checks if `libs/components` banner should set the semantic colour from
its type (an SDK API question for the human if it changes a default); until then the sketch uses the wrapper.

758\. Linux builder (same sketch): Studio has no `components/banner` part, so variant c imports the SDK mock directly.
Note only: if the human picks c, the pick adds the part first (ADR 0010 flow), not a direct SDK import in a page.

Measured (same sketch, for 738): `sketch ready` took 29 s, and 1-2 min on a later run (target 10 s).

759\. The human (2026-11-10, night, Studio screen shot of `pages/system` round 1): "ich kann hier nix mergen". The
sketch shows variants b and c, but no merge action and no reason. Cause (read in the repo): `.ethlete/design/studio/ready.json`
has no entry for `pages/system`; `sketch ready` ran only on the scratch copy `/tmp/sk750`, and there it listed
`listing-error` as SHOT-NOT-VIEWED. The builder still reported the sketch as "waits for the human's pick". Lesson: two
gaps. (a) Studio shows a not-ready sketch to the human like a ready one, with the merge action silently missing.
(b) A builder report can call a sketch pickable without a passed `sketch ready` on the real repo. Decided by the doc
agent (tool internal, applies "ready means final"): Studio draws "Noch nicht bereit" with the reason from `sketch
ready` in the sketch head where the merge action would be, and lists no such sketch as waiting for the human; the
builder runs `sketch ready` on the real repo before it reports a sketch to the human. Fix of this sketch now (blocks
the human's pick).

760\. Linux builder (2026-11-10, night): `check-studio-adrs` prints about 40 warning lines to stderr on every commit
that stages STATUS.md (the hook hides only stdout). Lesson: a warning on every commit is noise that hides a real one.
Backlog: the hook prints a one-line count and a command for the full list.

761\. Linux builder (2026-11-10, night, push of 4b50bdb51 + 5039c0a8d): push:suite failed with 6 e2e timeouts (no frame
after 10 s, slow `/__design` requests) at load 56-110 on 16 cores; the same e2e passed at b6da40338 30 min earlier. Top
CPU: Playwright workers of the fifagg-frontend session, timetrack, a Studio debug build. Suspect: load, not the diff
(not yet proven; a rerun at load < 20 decides). Lesson: the 726 gate checks the load only at the start of push:suite,
so load from another session that rises mid-run still fails the e2e step. Backlog: push:suite checks the load again
before the e2e step and, if a step fails with a load above the limit, reruns it once after the load drops, and says
so in the report.

762\. Mac builder (2026-11-10, night, B482 release smoke): the plain smoke passed on 7f7042561 after two causes, both
proven by run. (1) Cause: the smoke opened `sketch:pages/sketches`, but the tree key is the target
`sketch:pages/sketches@change-crop`; fixed 4871b83a3 (the smoke reads the targets from sketch.json; the old default
also broke on folder names like `components-title-bar.edit`). (2) Cause: `dist/libs/cli` was stale after a merge, so
the bundle showed "Design-Server gestoppt", and the smoke reported only "sketch view missing". Lesson: a stale CLI
build and a stopped design server look like a missing view to the smoke. Decided by the doc agent (tool internal,
backlog): the smoke checks that `dist/libs/cli` is not older than its sources before the run, and its waiting line
names a stopped design server with the server's own text.

763\. Mac builder (2026-11-10, night, 735): the push-suite spec case "a step with a log file writes its output there"
failed 2 of 4 runs at load 18. Suspect: a timing bound that the load breaks (not measured per phase). Lesson: a spec of
the push gate itself can fail under the load that the gate exists to survive. Backlog: measure the case under the 735
CPU throttle, then fix the wait at its cause (an event, not a longer timeout).

764\. Linux builder (2026-11-10, night): CI 42907782323 (89aa166b4) red in `ci / Rust host`: `cargo install cargo-audit
--locked --version 0.22.2` failed with "binary `cargo-audit` already exists in destination". Suspect (not proven by a
CI run): Swatinem/rust-cache restores `~/.cargo/bin`, while the separate actions/cache key `cargo-audit-Linux-0.22.2`
misses, so two caches own one binary. Fix cd266da38 adds `--force`. Lesson: a step that installs into a directory
another cache restores has no single owner. Decided by the doc agent (tool internal, CI red). As built: cd266da38 + 59ca46802 (skip on a version match, else `--force`). Cause (measured, run 42912315216): the cargo-audit cache missed, the install step took under 1 s, so the version check found 0.22.2 already in `~/.cargo/bin` from rust-cache; Rust host green.

765\. Mac builder (2026-11-10, night): `/e2e` shows "No active run log" in the push:suite `repeat` step. Cause: only the
`e2e` step writes a live log. Lesson: every long step writes one. Fix d06bd6f34 (Mac).

766\. Doc agent (2026-11-10, 23:33): a mailbox `send` to the Linux builder made the dispatcher type into its pane (history
line recalled). Suspect: `panelFocused` knows only `❯ ⏺` rows, this build draws `● main`.
Tool fix (night, Linux): `send` refuses a SendMessage peer; panel regexes from a real pane.

771\. Linux builder (2026-11-11, night, CI run 42916647044): two cli specs timed out (open-points-answer 30 s,
merge.spec 60 s; 2-3 s locally). Cause (bite, subagent): the workers start from source through jiti, which caches in
`<tmpdir>/jiti`, and vitest.setup.ts gives each spec file its own TMPDIR, so every file transpiled the 262-file worker
graph again. As built a3df386fa: the spec tmpdir links `jiti` to `libs/cli/node_modules/.cache/jiti-specs`. Bite on one
busy core: 30 s timeout without the fix, 12 s with it. Not verified: a CI run; the first worker start of a CI run is
still a full transpile.

773\. Mac builder (2026-11-11, night, 769 side finding): the darwin cpu-throttle (735) and plain CPU burners cannot
reproduce an e2e case: both stall the design server, the sketch-fixture listing times out after 60 s, and the case does
not run (throttle 50/35/20/10 %, 20 burners at load 34). Cause (measured): a whole-machine slowdown starves the server
before it starves the page. Lesson: `QUOTA_PERCENT_DARWIN` suits specs only, never e2e. Tool fix (Mac, in progress): a
renderer-only `--cpu-rate` flag (CDP `setCPUThrottlingRate`) in canvas.e2e.mjs reproduces a load-sensitive case.

As built (735 Mac calibration, archived finding): the 719 case "keeps at most six near cells live" in
`sketch-view.component.spec.ts`, under `cpu-throttle.mjs <p> -- npx vitest run --root apps/ethlete-studio --maxWorkers=1`,
one run each, 1-minute load 2.3-5.6 on 6 cores: p 100 passes in 235 ms, p 20 passes in 1440 ms, p 10 fails at 3187 ms
(the slow-case guard, 5000 ms timeout), p 5 fails at 7379 ms. Linux fails it at 1.7-2.7 s under CPUQuota=20%, so the
Mac p 10 matches the Linux p 20: `QUOTA_PERCENT_DARWIN` is now 10. Not verified: a second run per p on a quieter
machine; a new changed spec under the quota step.

776\. Mac builder (2026-11-11, night, 769 3483c7fcd): the fixed e2e case no longer passes through a live frame iframe,
so no case covers a keyboard user inside a live frame. Suspect (injected, not seen live): when the app remounts the
frame iframe (address change, or `LIVE_GRACE_MS` drops an off-view frame after 5 s), focus falls out of it, and
Shift+Tab lands on an `et-menu-trigger` (`focused=false rings=[]`). Lesson: a case that dodges a flaky path needs its
own case for that path. Decided by the doc agent: an app fix (keep focus on the frame host when its iframe remounts)
with its own e2e case; app work, so not at night; it waits for the day STATUS order (morning: put it to the human).

779\. Linux builder (2026-11-11, night, 777 df5226ee1): the first push:suite failed: `serve.spec`, `shot-store.spec` and
`serve.perf.spec` mock `vite` without `createLogger`, which `serve.ts` now imports. The subagent ran only its touched
specs. Cause (measured: d2e91cd78 stubs it, 68/68 pass): a slice brief that says "run only touched specs" misses a spec
that mocks a module the slice now imports from. Lesson: the push:suite caught it, but one full suite run late. Decided
by the doc agent (tool internal, general form of the builder's recommendation): every builder slice and subagent brief
runs `npx vitest related --run <changed files>` before its commit, not only for changed imports between modules. Builder
work (night backlog, Linux): put this rule in the builder-agent skill and the subagent brief template. Built 6447c4e1b.

781\. Linux builder (2026-11-11, night, 618 5577aacd1): a builder subagent put a Chromium spec
(`probe-helpers.spec.mjs`) into `test:tools`, which runs in the CI Checks job with no Chromium; the builder's review
caught it before the push (f708e2e0b: `yarn test:e2e-helpers` in the Unit tests job after its playwright install;
verified locally only). Suspect, tool gap: nothing checks that a `node --test` spec that launches Chromium runs only in
a job that installs it; push:suite runs where Chromium exists, so it cannot catch it. Decided by the doc agent (tool
internal, the builder's recommendation): no tool fix for one case; a second case makes it night backlog.

789\. Linux builder (2026-11-11, night, B438 measurement): the committed sketch `elements/rating` has 8 UTILITY-CSS
findings, so a sketch with open check findings reached git. Suspect: none yet; the cause is the question, which gate
should have refused it (pre-commit, `sketch check` before ready, or the merge). Decided by the doc agent: the builder
names the cause first (night backlog, Linux, after 788, read only); the gate fix is tool work, the sketch fix itself
waits for the day order (no sketch work at night, ADR 0257). Cause (read in git): the rule came after the sketch. `rating.css` in all 3
variants last changed 2026-10-27 (fb8c7a0a5, 793d9381b, 95a6b82e7); UTILITY-CSS landed 2026-10-30 (80d70d9eb); later
commits touched only `sketch.json`. No gate let a refused file through; nothing re-checks committed sketches when a rule
lands. Decided by the doc agent (applies ADR 0226: no design check in a git hook or CI, so the builder's
recommendation of a rule-commit gate is out): (a) a change that adds or tightens a static design rule runs that rule
over every committed sketch and part of every product before its commit and fixes or exempts the findings in the same
change (builder-agent skill rule, not a hook); (b) the builder finds out whether Studio shows a static finding on an
existing ready sketch live when the designer opens it; if not, that is the tool fix (night backlog, Linux, after 790).
Side fact: the sketch is ready with decision "pick c" since 2026-11-01 and is still not merged, although a picked sketch
is merged by the builder. Day order: merge pick c with the UTILITY-CSS fix; a ready sketch with a pick that waits more
than a day is its own Studio signal (Suspect: Studio shows no such age; the builder checks).
(b) Cause (Linux builder, live read on a scratch serve + code, 2026-11-11 night): `elements/rating` is sketch-only, so
the open-points call returns 404 `unknown-part` (`studio-api.ts` `knownPartOf`); static findings live only in
`/__design/sketches` and show only as the tree error badge with a hover tooltip and a refused pick; the variant column
filters to load errors; `openPointsOf` makes the `unmerged-sketch` pick point only for keys in `product.parts`, so a
sketch-only part with a waiting pick gets none (the tree says plain `ready`). Pick c itself has 2 UTILITY-CSS findings, so
Studio refuses pick c today. Decided by the doc agent (tool internals, no new wording): (1) `readOpenPoints`/`openPointsOf`
add the targets of unmerged sketches to the part keys; (2) `knownPartOf` accepts a key an open sketch targets. Bite: a
sketch-only part with a ready pick shows the existing pick point and no 404. Night backlog, Linux, after 650. (3) a new
open-point kind `sketch-problem` (variant, rule, message) needs a chip label the human sees: morning round, builder
default "Sketch-Regel verletzt: <rule>"; not built until the human answers.
As built (Linux builder, 2026-11-11): (1) and (2), nothing more. `openPointsOf` lists the targets of unmerged sketches
that are no part key after the parts, with their key-bound points (`unmerged-sketch` with its pick, comments, contrasts,
direct edits); `readOpenPoints` gets them through it, `sketchOpenPointsOf` passes no sketches and is unchanged. `knownPartOf`
also accepts a key an open sketch targets. The open-points cache needed no change: it already re-reads when a tracked
`sketch.json` or sketch listing changes. Bite: `open-points-answer.spec.ts` "answers the pick point of a part that exists
only in a ready sketch" fails without the fix (404) and passes with it; `open-points.spec.ts` now expects the sketch-only
`components/x` line. Verified: `vitest related` (1320 tests), `cli:typecheck`, eslint. Live (scratch /tmp/sk-lab, own ports): the open-points GET
for `elements/rating` answers 200 with the pick point. Live Studio shot (headless, shots in /tmp/b789-shots/): the Studio
does not render it. Rating shows only under "Sketches" with a warning icon; selecting it opens the sketch view with no
open-points chip; no "null", "undefined" or empty badge. Suspect (code read only): the chip renders only in the part view
(`system-view.component.ts:177`, reads at :762), and a sketch-only part never gets one, so the new answer has no consumer.
Suspect, not traced: the sketch view shows "Wartet auf deine Wahl" although the answer says ready with c picked. (3) is not built.

B438 measured (ADR 0229, before 0173ca7a8 vs after 789031753, cold, alternating): studio-lab scratch, 3 sketches, 82
frames: wall 16 s in all 4 runs, compare phase 3.91/3.96 s before vs 3.29/3.30 s after; sdk scratch, 1 sketch: wall
22 s, compare phase 6.85/7.03 vs 6.58/6.74 s. Findings lines identical. The 150-280 s cold compare of finding 598 does
not reproduce on today's products. Not measured: a product with many differing frames.

790\. Linux builder (2026-11-11, night, 782 191ab7c46): nothing ties "a spec reaches the open-points worker" to "the spec
warms it". Cause of 782 (measured): the first `openPointsAnswer` call starts the worker from `.ts` source and jiti
transpiles its whole import graph (empty cache 7.0 s plain, 43.5 s at `CPUQuota=25%`); each spec author must know
`warmOpenPointsWorker()`. Suspect (not measured): `open-points-loop.spec.ts` reaches the worker cold too. Lesson: a cost
every caller must remember is a rule a new spec forgets (third case of the 783/787 class). Decided by the doc agent
(tool internal, the builder's recommendation, scoped like 785): not a global setup file for every cli vitest worker
(it would charge the cold start to specs that never reach the worker); the module through which a spec reaches the
worker registers the warm `beforeAll` on import, so a spec that reaches it is warm and one that does not pays nothing.
Bite: a new spec that calls the worker cold under `--slow 4` passes. Night backlog, Linux, after 789. Revised (the
builder: the modules through which specs reach the worker are product modules the CLI ships, so they cannot register a
`beforeAll`): a spec entry module `system/open-points.fixtures.ts` re-exports `openPointsAnswer` and
`openPointsInWorker` and registers the warm `beforeAll` (120 s) on import; a `no-restricted-imports` rule for
`libs/cli` `*.spec.ts` forbids those two names from the product modules and names the fixtures module; per-spec
`warmOpenPointsWorker` calls go. Bite: a spec that imports from the product module fails lint; a cold spec through the
fixtures module passes at `--slow 4`. Not covered: a spec that reaches the worker through another product call.
As built (Linux builder, 2026-11-11): `system/open-points-worker.fixtures.ts` became `system/open-points.fixtures.ts`;
it re-exports both names and registers the warm `beforeAll` on import. `libs/cli/eslint.config.mjs` restricts both names
from `studio-api` and `open-points-runner` in `src/**/*.spec.ts`. The four specs moved; `slow-run.spec.ts` imports the
module for its side effect (it reaches the worker through `startSlowRunner`). Verified: a spec with the product imports
fails lint with both messages; with `JITI_FS_CACHE=false` at `--slow 4` a cold spec through the fixtures module passes
(54.9 s), the same spec through `open-points-runner` fails (9.4 s); `vitest related` 128 files green; typecheck green.

791\. Linux builder (2026-11-11, night, 650 verification): `yarn studio:e2e --case notice-hint` matched no case, and the
builder reported the run as a check of the 650 load line. Cause (measured): `canvas.e2e.mjs` exits 1 when no case
matches (`!matched`), but the builder read the exit code of `tail` after a pipe, and the log says only "0 cases on 0
worker(s)" and "0/0 passed in 0.0s". Why no tool caught it: a filter that matches nothing prints a pass-shaped summary.
Lesson: an empty run must say it is empty in words, not as a count a reader takes for green. Decided by the doc agent
(tool internal, the builder's proposal): when a `--case` or `--page` filter matches nothing, print "--case <x> matches no
case; names: ..." (closest names first) and skip the "0/0 passed" line. Bite: a spec with a filter that matches nothing
expects the line and no "passed" summary. Night backlog, Linux, after 789 (b) (1)+(2). Owed for 650: one real case run
that shows the load line.
As built (Linux builder, 2026-11-11): `apps/ethlete-studio/e2e/case-filter.mjs` `noMatchLineOf`; `canvas.e2e.mjs`
prints it to stderr and exits 1 before the Studio build when a `--case` or `--page` filter matches no case, so no
summary prints. Verified: `case-filter.spec.mjs` passes, and fails with the closest-first sort removed (bite); its second case spawns `canvas.e2e.mjs --case zz-matches-no-case` and expects exit 1, the line
and no "passed"; it fails with the early exit removed (bite); live `--case notice-hint` exits 1 with the line and five closest
names, no "0/0 passed" (before: exit 1 with "0/0 passed in 0.0s"); live `--page Nowhere` exits 1 with the line. A
filter that matches only through `--view` or a shard is not covered.

792\. Linux builder (2026-11-11, night, live shot of 789 (b)): 128f5a9ce makes the open-points answer carry the pick point
of the sketch-only `elements/rating`, but Studio shows none of it: the tree has only an orange warning icon, the sketch
view has no open-points chip, and it says "Wartet auf deine Wahl" although the sketch is ready with "pick c". Suspect A
(code read): the chip renders only in the part view (`system-view.component.ts` `openPointReads`), and a sketch-only
target never gets a part view, so the CLI change has no Studio consumer. Suspect B (not traced): the sketch view does not
count a pick that `canPick` refuses (pick c has 2 UTILITY-CSS findings). Why no tool caught it: the bite of 789 (b) tested
the API answer, not the view the designer reads. Lesson: a fix for "Studio does not show X" is verified only by a live
shot of the view that should show X; an API bite alone is not the fix. Decided by the doc agent: B is traced read-only at
night (Linux, now); A is Studio app UI, so it is day work: the place of the chip in the sketch view goes to the builder
as a sketch after the night (ADR 0257: no sketches at night), not as a grill question.
B traced (Linux builder, code read, no bite or shot; Suspect): `sketchStatus` in `sketch-view.component.ts` maps status
`ready` to `waiting` ("Wartet auf deine Wahl") and never reads the decision; `pickedVariantOf` exists in the same
component but the badge does not use it; `canPick` gates only "Übernehmen". The sketches part (`SketchStatus` in
`sketches-sample.ts`) has no state for "picked, waiting for merge". Second lesson: the CLI open-points answer and the
view derive "open" from different fields (decision vs status), so they disagree. Decided by the doc agent: the day
sketch of A also covers a picked badge state (reuse the existing open-point wording "Sketch gewählt, noch nicht
gemergt" where it fits, reuse before a new state); then `sketchStatus` reads the pick, and one shared function decides
"waits for a pick" for both the CLI and the view (tool internal). Bite: a spec with a ready sketch that has a pick
expects the picked state, not `waiting`.

652, decided by the doc agent (2026-11-11, night; tool internal, the builder's recommendation; no ADR covers it, ADR 0009
was a one-time commit): step 1 moves only `pictures.json` (pure tool state: shot hashes) to a gitignored
`.ethlete/cache/<product>/pictures.json`; the tool reads the old path once as a fallback and never writes it again; one
commit removes the tracked files. `ready.json` and `sketch.json` stay tracked because they carry designer decisions (ready
marks, picks); the tool writes them only when a decision changes (no rewrite of an equal file, stable key order). Bite: a
design run with no decision leaves `git status` clean. Condition: before the move, the builder confirms that no reader on
another clone (the Mac, CI, a scratch copy, the push suite) needs the committed `pictures.json`; if one does, it reports
before it builds. Leave the uncommitted `merged.json` and `ready.json` edits in the tree untouched.
652 condition hit (Linux builder, code read + grep): `design check` (`accepted-pictures.ts` `baselineOf`) takes the
baseline of a part changed outside a sketch from the committed `pictures.json` record, else from the local part-picture
cache; on a clone with neither (the Mac, a fresh clone, a scratch copy) it opens an old/new edit sketch that waits for a
pick, where Linux auto-accepts an unchanged picture. No CI workflow, push suite or e2e reads the file. So today the file
is a shared baseline, not a cache. Decided by the doc agent (tool internal; it applies the existing auto-accept of an
unchanged picture to every clone): step 0 before the move: when baseline and cache miss, the tool draws the part at its
merged commit itself (the EDIT_OLD draw of `edit-sketch.ts` `refreshEditOld`) and compares on the same machine; only a
changed picture opens the edit sketch. If the old draw fails, ADR 0253 applies (sketch with only `new`). Bite: a fresh
clone with a direct edit that changes no picture auto-accepts and opens no edit sketch. Then step 1 (the move) as above.
Corrected (Linux builder, probe spec, 2026-11-11 night): the condition line above came from a code read and is wrong.
Today a clone with no record and an empty cache already auto-accepts an unchanged direct edit: `autoAcceptOf` opens a
temporary ready `<part>@edit` sketch, draws `old`, compares, and on no change discards it and records the merge (specs in
`accepted-pictures.spec.ts` cover both cases). So step 0 is already built, the committed `pictures.json` is a speed
cache, and step 1 goes ahead. Rest gap (Suspect, not measured): while the two draws run, the temporary edit sketch is on
disk, so a slow run can show "waits for your pick" for that time, and a killed run or `EDIT-OLD-NOT-DRAWN` leaves it
open. A sketch-free draw needs a sketches root through `DrawStates` and the warm server (large). Tool backlog, Linux,
after 793; first measure how long the sketch shows on the Mac.

664 + 659 (part 1), as built by the Linux builder (2026-11-11, night): `apps/ethlete-studio/e2e/run-load.mjs` prints
the machine (hostname), the cores and the workers on the load line of each e2e run
(`load 3.1 at start, 7.9 at end on tank, 8 cores, 4 worker(s)`). A noisy run adds the top 5 processes by `ps` CPU share,
each with its pid, command and checkout (`/proc/<pid>/cwd` on Linux, `?` elsewhere). Spec: `run-load.spec.mjs`
(4 tests, the machine and process lines fail on the old code). Verified: the spec, a live `topProcesses()` sample on
Linux, and one e2e case run. Not verified: the Mac (no `/proc`, so the checkout prints `?`). Not built: the push-suite
warning before its start (659 part 2) and the goal check per machine (the 90 s goal machine is a human question).
`ps` CPU share is the average over the life of the process, not the last minute.
659 part 2, as built by the Linux builder (2026-11-11, night): `push-suite` calls `processList()` (new in `run-load.mjs`,
`topProcesses()` now uses it) before its slot claim and prints `push-suite: warning: N other test or build process(es) of
this checkout run:` plus one `pid  cpu % cpu  command` line each. `otherTestProcessesOf` (exported, `push-suite.spec.mjs`)
selects by checkout (`/proc/<pid>/cwd` under the repo root), skips push-suite, its ancestors and children, long-lived servers
(Nx daemon, language servers, `design __resident` and what they started) and judges only the first three words of a
command. It warns, never refuses. No `/proc` (Mac): one line, `other processes of this checkout not checked: no /proc on
this OS`. Verified: 2 new specs (both fail with the self/ancestor exclusion removed), a live call with a busy `vitest.mjs`
in the checkout. Not verified: the Mac, a real push-suite start with a warning; the fixture is hand-assembled from real
`ps` shapes, not one capture. Only processes that used CPU in the one-second sample appear, so an idle waiting run is not named.

793\. Linux builder (2026-11-11, night, 664 + 659 part 1 b05de1e05): the builder and its handoff kept "on which machine
does the 90 s goal count" as a question for the human, and finding 664 still says "Open for the human". ADR 0240 decided
it on 2026-11-09 (the desk PC; the Mac reports its time and does not gate). Why no tool caught it: a finding that a later
ADR answers keeps its "Open for the human" line, and nothing links the ADR back to the finding. Lesson: an open line in a
finding is stale as soon as an ADR decides it. Decided by the doc agent: the goal check of 664 applies ADR 0240 (gate
only on the desk PC, report elsewhere); 664 is marked answered by ADR 0240 below. Tool fix (night backlog, Linux, small):
`yarn adr:governs` or the ADR pre-commit check lists findings whose "Open for the human" line names the topic of an ADR
committed with a `source:` that cites them; first step a read-only report of findings with an open line older than a
day, so the doc agent checks each against the ADR index. Also in b05de1e05: the top-process list uses `ps` CPU, the
lifetime average of a process, so a long-lived idle process can top the list. Decided (tool internal): sample CPU twice
over about 1 s and rank by the delta. Bite: an idle process with a high lifetime average does not appear.
793 (a), as built (Mac builder, 2026-11-11): `run-load.mjs` samples `ps -A -o pid=,time=` twice 1 s apart on darwin
(`psTicksOf`, hundredths of a second) and ranks by the delta through the same `cpuDeltaOf` as Linux; a process that did not
run is left out. Spec fixture: lines of a captured real Mac `ps` run. Verified: `node --test run-load.spec.mjs` 8/8; live
on the Mac `processList()` gives 9 rows without pid 1 (launchd, 192 min lifetime, idle), the old code gave 721 rows with
it. Not verified: the day prefix `1-02:03:04.50` comes from the BSD ps format, not from a captured run.
664, answered by ADR 0240 (2026-11-09): the goal counts on the desk PC.
ADR 0240 goal line, as built (Linux builder, 2026-11-11): a full e2e run (no `--case`, `--page`, `--view`, `--shard`, `--perf`, held listings or delays) prints a goal line after the load line: `goal: <s> on <host>, within|over the 90 s goal` on the goal machine (`GOAL_MACHINE` = `tank`, the desk PC; `STUDIO_E2E_GOAL_MACHINE` overrides), `... noisy, not a measurement of the 90 s goal` when the load is above the cores, and `goal: <s> on <host>, reported only (the 90 s goal counts on tank)` on any other machine. The line reports; it fails no run. Verified: `run-load.spec.mjs` (the goal test fails with the within/over check reversed); a live full run on tank: `132/132 passed in 117.7s on 8 worker(s)`, `goal: 118 s on tank, over the 90 s goal`. Not verified: the Mac line (its next push-suite shows it).

794\. Linux builder (2026-11-11, night, 652 condition check): the builder reported "condition hit" with file and line
numbers from a code read, the doc agent decided step 0 on it (b6b7bdf05), and a probe spec then showed the behaviour
already exists. Why no tool caught it: a code read written with line numbers reads like a measurement, and the report
did not say Suspect. Lesson: a fact that a decision rests on needs a probe or a bite, not a read; a read is a Suspect
and must say so. Decided by the doc agent: builder-agent skill line: a condition check that gates a decision runs a
probe (spec or live run) before it reports; a code read is reported as "Suspect (code read)". The doc agent asks
"probe or read?" before it decides on a reported cause.

652 step 1, as built (2026-11-11): `accepted-pictures.ts` writes the shot hashes only to the gitignored
`.ethlete/cache/<product>/pictures.json` (`productCacheDirOf` in `product.ts`, `CACHE_DIR` in `design-config.ts`). It
reads the old `<product>/pictures.json` only while no cache exists. `writeJsonFile` and the `sketch.json` writer skip a
file that already holds the same text (`writeChangedFile`), so an equal `ready.json` keeps its mtime. `pictures.json`
left the decision files of the UNCOMMITTED-DECISIONS warning. The same commit removes the three tracked
`pictures.json` files from the index (`git rm --cached`; the working files stay). Verified: specs in
`accepted-pictures.spec.ts` (cache write, product folder unchanged, old-path fallback) and `part-ready.spec.ts` (equal
ready.json untouched) fail without the fix and pass with it; typecheck and lint clean. Not verified: a live
`et design check` run on this checkout.

795\. Linux builder (2026-11-11, night, 652 step 1 c7d88a573): the doc agent's recipe "`git rm --cached`, then `git commit --
<paths>`" loses the removal: a pathspec commit stages the working copy again (proved in a scratch repo). The subagent
moved the files out for the commit and back (sha256 checked). Why no tool caught it: the repo forbids a commit without
paths (shared index), and no helper commits an index-only removal. Lesson: a git recipe in a decision is checked in a
scratch repo before it is sent. Decided by the doc agent (tool internal): a `yarn untrack <paths>` helper moves each file
out, commits the removal by path, puts the file back and checks the hash; the git-commit skill names it. Bite: after
`yarn untrack x`, `git ls-files x` is empty and `x` is byte-identical. Tool backlog, Linux, small, after 793. Effect on
other clones: a pull deletes their tracked `pictures.json`; the Mac must know before it pulls.
795 as built: `yarn untrack -m "<message>" <paths>` (`tools/scripts/untrack.mjs`) refuses an untracked or missing path,
parks each file in a temp dir, commits the removal by path, puts the file back (also when the commit fails) and checks
its sha256. The git-commit skill names it. Spec `tools/scripts/untrack.spec.mjs` (4 cases, temp repos). Bite: with the
`git rm --cached` recipe in place of the park step, the removal case and the failed-commit case fail. Not verified: a
real run in this repo (no file waits for it now; the commit hooks run there).

796\. Linux builder (2026-11-11, night, 652 live bite): `design check --product studio-lab` emptied the tracked
`.ethlete/design/studio-lab/ready.json` (the `foundations/tokens` check record of 2026-11-08), although the tokens files
are unchanged, and its output named no part and no reason. Writer: `part-build-ready.ts` `dropPartRecord` when a blocker of
the part is definite. Suspect (code read): a definite blocker on `foundations/tokens`, not caused by 652 step 1; not probed
on the commit before c7d88a573. The run also wrote no cache file, so the 652 cache write is proven only by spec, and the
652 bite "a design run with no decision leaves git status clean" is not met. Why no tool caught it: a check changes a
tracked file with no output line. Lesson: every write of a tracked decision file by a check prints what it changed and
why. Decided by the doc agent (tool internal): (1) probe the same check on the commit before c7d88a573 (scratch copy) to
rule step 1 in or out, before the Linux push of 652; (2) the check prints "RECORD DROPPED <product> <part>: <blocker>",
with a bite spec; (3) a live run that writes a new picture record shows the cache file. Order: (1) now, then 793 (a), (2),
(3).

793 (a), as built by the Linux builder (2026-11-11): the top-process list of `run-load.mjs` samples `/proc/<pid>/stat`
twice, 1 s apart, and ranks by the CPU share in that second; a process that did not run is left out. Without `/proc`
(the Mac) it keeps the `ps` lifetime average. Specs: `cpuTicksOf` parses a stat line with spaces and parens in the
command; an idle process with a high lifetime average does not appear. Verified: 6/6 specs, eslint, a live sample on
Linux. Not verified: the Mac.
796 (1) result (Linux builder, check runs in scratch clones at 033c17c27 and bb4648025; Cause): both drop the record the
same way, so 652 step 1 is ruled out. The definite blocker is `no-harness` on every `studio-lab` part (7093784d7). The
drop is intended: ADR 0254 keeps `studio-lab` blocked until it gets an app. The builder again named this "open for the
human" (second case of 793 in one night; `build-ready.md` still said "Tom's product call", now marked answered). Decided
by the doc agent (applies ADR 0254): the builder commits the emptied `studio-lab/ready.json` by path, so the next check
does not change the tree again. Side Suspect: no NO RECORD line was printed for the drop; it belongs to 796 (2).
796 (2), as built (Linux builder, 2026-11-11): `recordBuildReady` takes `onRecordDropped`; when `dropPartRecord` really removes a record for a definite blocker, `design check` prints `RECORD DROPPED <product> <part>: <kind>: <text>[; ...]` (every check, not only with `--part`); no line when there was no record. Verified: bite spec (fails with the call removed, passes with it), related specs 127 files, typecheck, eslint, prettier. Not verified: a live run. NO RECORD is a Suspect, not a Cause: `check-record.ts` forwards `onNoRecord`, the existing spec prints it after a drop, and the code reads the same on the live path, so no cause for the missing line was found in the code; it was probably not seen in the run output.
796 (3) and (1) live (Linux builder, 2026-11-11, HEAD 261b8c80e): Cause (measured) of the missing cache file in 796: studio-lab has no harness, so `design check --product studio-lab --part foundations/tokens` prints `NO RECORD studio-lab foundations/tokens: no-harness: ...` and never draws pictures. In a HEAD export (no ignored `pictures.json`), `design check --product studio --part components/disclosure` wrote `.ethlete/cache/studio/pictures.json` with the `components/disclosure` record; `components/comment-row` (6 missing states) wrote none and printed NO RECORD. A main-checkout check of `components/list-row` printed `RECORD DROPPED studio components/list-row: open-point: 5 missing states (...)` live, so (2) is shown live; the grill confirmed the drop was correct (an uncommitted local record).

797\. Mac builder (2026-11-11, night, push of 6bca47ab5): `push-slot.mjs` runs `git fetch`/`git push` of
`refs/push-slot/next` with no timeout. GitHub port 22 timed out on and off from the Mac; one ssh hung 1 h 39 min, and the
pre-push `push-slot.mjs check` hung 5 min until the builder stopped the push. Cause (proven by `ps`: ssh
`git-upload-pack` for `+refs/push-slot/next`, no exit). Why no tool caught it: 780 tested the slot logic, not a network
that hangs. Lesson: every network call in a gate has a timeout and a stated fallback. Decided by the doc agent (tool
internal, the builder's proposal): `spawnSync` timeout 30 s on each network git call, and a default `GIT_SSH_COMMAND` with
`ConnectTimeout=10 ServerAliveInterval=5 ServerAliveCountMax=3` when the user sets none; a timeout counts as "slot
unreadable" (warn, go on), as at the suite start. Bite: a fake remote that never answers ends the check within the
timeout with the warning. Mac night backlog, after 777 Mac verify. Also: the Mac's earlier "Linux does not check the
slot" is a Suspect, not a Cause.

798\. Linux builder (2026-11-11, night, size gate): `node tools/scripts/archive-findings.mjs --help` ran the archive and
moved 22 findings (b0d74fa72). Cause (measured): the script ignores its arguments. Harmless this time, but `--help` or a
typo writes two tracked files. Why no tool caught it: the script has no argument check, and no spec calls it with an
unknown flag. Lesson: a script that writes tracked files refuses arguments it does not know. Decided by the doc agent
(tool internal, the builder's proposal): `--help` prints the usage and exits 0 with no write; an unknown argument prints
the usage and exits 2 with no write; `--dry-run` lists what would move; a plain run moves as now. Bite: a spec with
`--help` and with `--bogus` leaves both files byte-identical. Night backlog, Linux, small, after 659 part 2.

798 as built (Linux builder, 2026-11-11, night): `archive-findings.mjs` exports `main(argv, { root, log })`. `--help`
prints the usage and returns 0; an unknown argument prints `unknown argument: <arg>` and the usage and returns 2;
`--dry-run` lists the month and first line of each block that would move; a plain run moves as before. Spec: `--help`,
`--bogus` and `--dry-run` leave both files byte-identical, and a plain run moves an old done finding. Bite: with the
argument check off, the `--help` and `--bogus` tests fail (2 of 13). Verified live: `--bogus` exits 2, `--dry-run` writes
nothing. Not verified: nothing open.

799\. Linux builder (2026-11-11, night, push suite on 0884cf03c): `commit-hunks.spec.ts` reads every committed
`.ethlete/design` file; 081e7f16d made `studio-lab/ready.json` `{}` (the intended ADR 0254 drop), and the spec took
`Object.keys(real)[0]` as a part (undefined). Cause (measured); spec fix d7f7f36a3 (an empty file gets a synthetic part).
Why no tool caught it: the pre-commit `vitest related` run (779) follows imports only, so a commit of only design data
runs no spec, although the data is spec input. Lesson: a spec that reads repo data must be found by a change to that
data. Decided by the doc agent (tool internal, generalizes the builder's proposal): the 779 pre-commit step gets a small
map from data globs to the specs that read them (first entry `.ethlete/design/**/*.json` → `commit-hunks.spec.ts`; the
builder greps the cli specs for other readers of committed repo files and adds them); a commit that touches a glob runs
its specs. Bite: a commit of only an emptied `ready.json` on the commit before d7f7f36a3 fails in pre-commit. Night
backlog, Linux, after the push.
799 as built (Linux builder, 2026-11-11): the 779 rule was only a brief convention (no hook ran `vitest related`), so the map is a new pre-commit step: `tools/scripts/data-spec-map.json` (spec path to data globs) read by `tools/scripts/staged-data-specs.mjs`, called from `.husky/pre-commit` when a staged path is under `.ethlete` or `.github/workflows`; vitest specs run with `--root libs/cli`, `.spec.mjs` with `node --test`. Mapped specs: `commit-hunks.spec.ts` (`.ethlete/design/**/*.json`), `product-tailwind.spec.ts` (`.ethlete/design/config.json`), `real-open-points.spec.ts` (`.ethlete/design/**`), `generate-studio-themes.spec.mjs` (the studio `colors.css`), `check-workflow-commit-messages.spec.mjs` (`.github/workflows/*.yml`). Also fixed: `matchesGlob` of `cli-related-map.mjs` turned `**` into `[^/]*` (never crossed more than one folder); now exported and shared. Bite: worktree at d7f7f36a3^, a staged `{ }` for `studio-lab/ready.json` fails the commit (`commit-hunks.spec.ts > studio-lab/ready.json splits per entry or refuses with a message`, 1 failed, exit 1). Cost 1.7 s per matching commit, 0 s otherwise. Defect found by the first bite run: a hook sets `GIT_DIR`/`GIT_INDEX_FILE`, so `git init` in the spec's temp repos wrote into the real repo (`core.bare = true`, a fake `[user]` and `[commit]` in `.git/config`, an `init` commit in the worktree); the runner now strips every `GIT_*` variable. The main `.git/config` was repaired by hand. Verified: the glob spec, the bite, a manual run. Not verified: a hook run in the main checkout with a real commit (this commit is the first).

Mac night notes (2026-11-11, 06:00): 777 verified on the Mac (worktree in the symlinked /tmp, 0 allow-list lines and 0
SERVE-DENIED in two runs). Open (Suspect): warm render-inspect 9.6 s on the Mac vs 2.0 s on Linux; the builder counts
cache misses before it blames disk or CPU (Mac night backlog, after 735). 797 built 0ffc0e452 (spec bites: 60 s without
the timeout); 786 built 89671ec71 (one heavy-run lock per machine); both wait for the push slot. The hung ssh (pid 96278 on
the Mac, 1 h 39 min) was not killed: the Mac's permission mode refused it; the human kills it. A `push-suite.spec` case
("a step with a log file writes its output") failed once under the 777 load and passed alone: Suspect, same class as 763.

800\. Linux builder (2026-11-11, night, push of 0884cf03c): pre-push refused the push with "push slot held by
linux-builder for 0884cf03c25d ... Wait for its push or expiry", and the holder was the builder itself. Cause (measured):
`ETHLETE_BUILDER` was set only in the push:suite shell, so pre-push took the hostname as the name and saw a foreign
holder; the message told the builder to wait 60 min for its own slot. Why no tool caught it: 780 keys the slot on a name
that two shells of one builder can set differently, and its specs used one environment. Lesson: identify the holder by
what it proved (the sha and its suite verdict), not by a name the caller may not set. Decided by the doc agent (tool
internal, the builder's proposal): pre-push accepts the slot when the slot sha equals the pushed sha and a local
push-suite ok verdict exists for that sha; otherwise the refusal names the holder and says "set ETHLETE_BUILDER=<holder>
if this is you". Bite: a push with no `ETHLETE_BUILDER` after a suite ok for the same sha passes; a different sha is
refused with the hint. Night backlog, Linux, after 799; the Mac must pull it before its next push.

800 as built: `push-slot.mjs check "$local_sha"` (the hook passes the pushed sha as an argument, so the loop's stdin stays
untouched and `git push origin <sha>:next` works). `checkSlot` passes for the holder name, or when the slot sha equals
the pushed sha and `.git/push-suite/<sha>` (the file push-suite writes) starts with `ok `; the refusal ends with "Set
ETHLETE_BUILDER=<holder> if this is you." Bite: the new "slot sha with ok verdict, other name" spec fails with the sha
rule removed, passes with it; the different-sha and no-verdict specs also pass. The spec's git helper strips `GIT_*`.
Verified: `node --test tools/scripts/push-slot.spec.mjs` (9 pass), eslint clean. Not verified: a real pre-push run
against origin; the Mac must pull before its next push.

801\. Linux builder (2026-11-11, night, 799 bite run; incident): the first bite run of the new pre-commit data-spec step
801 as built (Linux builder): `tools/scripts/git-test-env.mjs` (+ `.d.mts`) exports `gitEnv(extra)`, `gitExec(args, opts)`,
`gitSpawn(args, opts)`, `git(dir, ...args)` and `tempGitRepo(prefix)`; they strip every inherited `GIT_*` (an explicit
`GIT_AUTHOR_*` extra stays). `@nx/enforce-module-boundaries` refuses a lib importing from `tools/`, so `libs/cli` and
`libs/agent-rules` each carry a typed copy, `src/lib/git-test-env.fixtures.ts` (three copies, one API). Migrated: every
spec in libs/cli, libs/agent-rules and tools/scripts that spawns git for a temp repo (`execFileSync/spawnSync('git'`
became `gitExec/gitSpawn`), plus `push-slot.spec.mjs`, `commit-wait`, `pre-commit-hook` and `staged-data-specs.mjs`, which
stripped their own way. Left: `orphan-endpoint.spec.ts` (read-only `git archive` of the real repo), `libs/timetrack`
(fake git backend), `apps/timetrack*` and `tools/changesets-action` (own harness, no hook path). Bite:
`tools/scripts/git-test-env.spec.mjs` points `GIT_DIR` at a scratch repo and runs git in a temp repo; with the stripping
removed it fails, restored it passes. Verified: all tools/scripts specs (one unrelated failure, `studio-e2e-perf`,
file untouched), `vitest related` in libs/cli (35 files) and the two agent-rules specs, cli and agent-rules typecheck,
eslint zero warnings. Not verified: a real hook run of the specs; the cli/agent-rules copies have no bite of their own
beyond cli's `git-test-env.spec.ts` (agent-rules copy untested).
wrote into the main repo's `.git/config`: `core.bare = true`, a fake `[user]`, `commit.gpgsign=false`. Cause (measured): a
git hook runs with `GIT_DIR`/`GIT_INDEX_FILE` set, and the temp-repo `git init`/`git config` calls of
`commit-hunks.spec.ts` inherited them. The subagent repaired it; the builder and the doc agent checked: `core.bare=false`,
no fake sections, HEAD and refs intact. The step's runner now strips `GIT_*` for specs. Why no tool caught it: each spec
spawns git for its temp repos its own way, and no spec ran inside a hook before. Lesson: a spec that makes a temp repo
must be safe in any environment, not only in a clean shell. Decided by the doc agent (tool internal, the builder's
proposal, made central): one shared spec helper makes temp git repos with `GIT_*` stripped; `commit-hunks.spec.ts` and
every other spec that spawns git for a temp repo (the builder greps `libs/`, `tools/`, `apps/`) use it. Bite: a spec run
with `GIT_DIR` pointing at a scratch repo leaves that repo's config byte-identical. Night backlog, Linux, before 800
(it guards every hook path, also commit-msg running `src/scenarios/`). Side (Suspect): stale commit-graph entries in
`git fsck`, rewritten with `git commit-graph write --reachable`, fsck clean; likely an older gc. Also: 779 was a skill rule,
not a hook; ba0d3568e adds the first hook step (`tools/scripts/staged-data-specs.mjs`), and `matchesGlob` in
`cli-related-map.mjs` no longer turns `**` into `[^/]*`.

802\. Linux builder (2026-11-11, night, 801 verification): `tools/scripts/studio-e2e-perf.spec.mjs` ("--case finds a perf
case only together with --perf") failed after 791 (003d9d457, a Linux commit, pushed in 0884cf03c): a no-match `--case`
now exits 1 with the closest names on stderr, and the spec expected "0 of 0 cases" on stdout. Cause (measured); fixed
a5026c273. Why no tool caught it: the push suite runs no `test:tools`, and 791's own run checked only its new spec. CI on
0884cf03c may be red from it (not read). Lesson: a change to a tool script runs every spec of that tool, not only the new
one. Decided by the doc agent (tool internal): the push suite runs all of `test:tools` (about 1 min; no map to keep in
sync). Bite: a range that holds 003d9d457 without a5026c273 fails the push suite. Night backlog, Linux, next after the push.
802 as built (Linux builder): new push-suite step `tools` (`yarn test:tools`, runs in the HEAD export) at position 3, after
lint and typecheck, before cli. Never reused: any non-inert merged path (not plans/, .changeset/) reruns it. Bite: in a
worktree at a5026c273^ (003d9d457 without the fix) with the new push-suite copied over, `yarn test:tools` fails with
`✖ --case finds a perf case only together with --perf` (`input did not match /^0 of 0 cases/u`); on HEAD 327 pass. Time:
about 4 s wall locally (measured, not the estimated 1 min). Verified: push-suite.spec (41 pass), test:tools (327 pass),
eslint clean. Not verified: a real `yarn push:suite` run (it claims the push slot), so the step inside the export was
not run end to end; the bite called the step's command directly.
Also from 801 (Suspect): three copies of the git test helper (tools, libs/cli, libs/agent-rules, because lib code may not
import tools); a sameness spec guards the drift (backlog, small).
Sameness spec as built: `tools/scripts/git-test-env-copies.spec.mjs` (in `yarn test:tools`) checks that the two lib
copies are byte-identical, that they export the same names as the tools helper, and that each lib has a bite spec;
`libs/agent-rules/src/lib/git-test-env.spec.ts` is a copy of cli's spec. Bites: an extra export in the agent-rules copy
fails tests 1 and 2; a renamed bite test fails test 3; the agent-rules helper without the stripping fails its spec.
Not verified: behavioural sameness of the `.mjs` with the `.ts` copies (only names are compared).

803\. Linux builder (2026-11-11, morning, first real push-suite run with 802): the new `tools` step failed at 0fece0102
in 3 s, 333 pass, 1 fail: `e2e-check.spec.mjs` "the result line carries the sha" runs `git rev-parse --show-toplevel` in
`process.cwd()`, and the HEAD export is a `git archive` copy, not a repo ("fatal: not a git repository"). Cause
(measured): the spec read `ETHLETE_REPO_ROOT`, but nothing set it. Why no tool caught it: the 802 bite ran
`yarn test:tools` in a worktree (a real repo), not in an export, so "not run end to end" in the 802 as-built line hid
exactly this case. Lesson: a new push-suite step is proven only by a real `yarn push:suite` run before its commit is
pushed. Fix: `runStep` takes an env, the `tools` step passes `ETHLETE_REPO_ROOT` (the live repo, used only for git
history), and the spec runs the export's own `e2e-check.mjs` (`import.meta.dirname`), not the live tree's. Bite: in a
HEAD export with the fixed spec, the case passes with `ETHLETE_REPO_ROOT` and fails without it.
803 tool fix (asked by the doc agent; the rule alone is no fix): `commit-export.mjs` (from 653) exports
`toolsStepEnv(repo)`, which push-suite passes to the `tools` step, and `commit-export.spec.mjs` builds a real HEAD export
(`git archive`, no `.git`) and runs `yarn test:tools` in it with that env (nested run skips the case). A tools spec that
needs a git repo now fails in `yarn test:tools` itself. Bite: with `toolsStepEnv` returning `{}`, the case fails and
names the e2e-check case. Cost: about 4 s more per `yarn test:tools`. Not covered: the other steps (lint, typecheck, cli,
studio, e2e) in an export; they are too slow for a spec and ran green in the export before 802.
804\. Mac builder (2026-11-11, night, push:suite of bae08fb64): `serve.spec.ts` "keeps answering other requests while it
checks two hundred sketches" took 75 s on the Mac (timeout 60 s) and blocked the push. Cause (bite): eea6f5c7e (788)
formats each variant `tsconfig.json` with one Prettier process in `writeEditorTsconfig`, so each run spawns one process
per sketch and variant; with the format stubbed the case took 9.0 s. Why no tool caught it: a per-item spawn passed on
the fast Linux box, and no spec counted spawns. Lesson: a writer of many files spawns no process per file. Decided by
the doc agent: the Mac builder builds it, no spawn per file, no timeout raise.

804 as built (Mac builder, 2026-11-11, night, 1a6d924b1): `prettierJsonOf` (`system/prettier-json.ts`) writes JSON in
the form Prettier writes for a `.json` file (objects one key per line, a scalar array on one line when it fits the print
width). `jsonStyleOf` (`sketch/check-format.ts`) reads `printWidth`, `tabWidth` and `useTabs` of the checkout's Prettier
config with one process per product folder and process; `formatText` is gone. A checkout without Prettier keeps the
plain `JSON.stringify` text. Specs: `system-tsconfig.spec.ts` counts the `child_process` calls of `writeEditorTsconfig`
over three sketches with two variants: at most 1, then 0 (the old writer: 9); `prettier-json.spec.ts` compares the
output with the repo Prettier at, one under and one over the print width (it fails at a width of 119). Verified: the 788
FORMAT case passes in a temp checkout with the Prettier default width 80; the serve case takes 18.4 s under load 24;
`vitest related` 129 files pass; lint and typecheck of cli. Not verified: a resident server keeps the style of its first
call, so a changed Prettier config takes effect after a restart; a config with `overrides` per sketch folder is read for
the product folder only.

805\. Linux builder (2026-11-11 morning): after a successful push of `next`, the push slot (`refs/push-slot/next`) stayed held until its 1 h expiry. `push:suite` claims it and keeps it on `ok`, pre-push only checks it, nothing released it, so the Mac builder was blocked for up to an hour.
805 as built: `yarn push` (`tools/scripts/push-next.mjs`, `pushNext`; no yarn builtin of that name) refuses without a push-suite ok verdict for HEAD, runs `git push origin <sha>:next` with inherited stdio (pre-push runs), then releases the slot; on a failed push it keeps the slot and exits non-zero. `hasOkVerdict` is now exported from `push-slot.mjs`. `slotState` already treated a slot whose sha `origin/next` contains as free; claim, `check` and `status` now also print `push slot of <holder> for <sha12> treated as released: origin/next contains it`. The builder-agent skill names `yarn push`. Bites (each fails the named case): no release call, no verdict check, no released line, `pushed` ignored in `slotState` (the claim over a pushed slot is blocked). Verified: `node --test` on `push-slot.spec.mjs` and `push-next.spec.mjs` (fake bare origin). Not verified: a real `yarn push` through the pre-push hook against the real origin.
806\. Linux builder (2026-11-11, 653 live proof): `yarn studio:e2e:bite --revert 1b41de840 --case sketches` printed "the e2e fails on HEAD with 1b41de840 reverted: the new case bites" and exited 0, but the `--case` matched no case: the e2e exited 1 for the no-match refusal, the same code as a failed case, and `biteVerdict` read every non-zero exit as a bite. A typo in a case name gave a false bite proof. Why no tool caught it: the bite spec covered only exits 0 and 1, and the no-match exit was chosen to fail a run, not to be told apart from a failure.
806 as built: the e2e exits 2 on a `--case`/`--page` filter that matches no case, like its other argument refusals; `biteVerdict(2)` is `refused` and the bite prints "the e2e refused its arguments on <subject>: no proof" and exits 2. Verified: `studio-e2e-bite.spec.mjs` (fails when the refused branch is broken), `case-filter.spec.mjs` (real run, now expects 2), `studio-e2e-perf.spec.mjs` green; a live `yarn studio:e2e --case zzz-nothing` exits 2. Not verified: a live bite with a no-match case after this commit (the export takes HEAD, so it needs the commit first).
806 follow-up (Linux builder): 0c2451802 and 7ffbf56ce cut the plan after their insert point (a hand script dropped the file tail); this commit restores the lost lines from 261b8c80e. Lesson: a scripted plan insert checks the line count before it writes.
807\. Linux builder (2026-11-11, 796 probe): the resident design process that `design check` starts in an export (`/tmp/probe-796-*/dist/libs/cli/src/index.js`) kept running after the export was deleted. Suspect (seen once, not probed): the resident has no exit when its checkout is gone. Tool fix (recommendation): the resident exits when its root or its entry file no longer exists, checked on each request and on a timer.
807 as built (Linux builder, 2026-11-11, 8a22c93af): Cause (measured once): the resident of a deleted export (pid 3735817, entry `/tmp/probe-796-*/dist/libs/cli/src/index.js`) still ran 43 s after `rmSync` of the export; its only exits are the 30 min idle timer, a stop request and SIGTERM/SIGINT. Fix: `resident/checkout-gone.ts` (`checkoutGoneOf`, `watchCheckout`); `serveResident` checks every 10 s and before each run request whether the checkout or `process.argv[1]` still exists, and exits with `resident design process exits: checkout <dir> is gone` (a run request then answers ABORTED_EXIT). Verified: `checkout-gone.spec.ts` 4 tests (all 4 fail with the checkout test reversed), cli typecheck, eslint, `vitest related` 59 tests. Live proof (2026-11-11, HEAD 34b823e8f export, `design check --product studio --part components/disclosure`, exit 0): the resident (pid 3774816) still ran right after `rmSync` of the export, and 15 s later no process named the export dir.
808\. Linux builder (2026-11-11, grill decision): 0c2451802 and 7ffbf56ce cut 194 lines of this plan (finding heads and as-built lines) with scripted inserts; 34b823e8f restored them. Why no tool caught it: no check compares the finding lines of this plan before and after a commit. Tool fix (decided): a pre-commit check refuses a commit that removes a finding head line (`^\d{3}\\.`) or an as-built line from this plan, unless the same commit appends those findings to `plans/ethlete-studio/archive/` (`archive-findings.mjs`). Bite: re-commit the 0c2451802 cut in a temp repo; the hook refuses it.
808 as built (2026-11-11): `tools/scripts/check-plan-findings.mjs` (this commit) compares the staged plan with HEAD and refuses a commit that drops a `NNN\.` head or `NNN as built` line unless the same line is added under `archive/`; `.husky/pre-commit` runs it when the plan is staged. Verified: 5 specs pass, including the real 0c2451802 cut re-staged in a temp repo (refused, names 797-806); with the check returning `[]` 2 of 5 fail. Live (212a98778): the real `.husky/pre-commit` with the 807 head line cut and staged exits 1 and names `807 (head)`. Verified: in a temp repo the real `archive-findings` output (plan plus archive file, staged) passes the check, and an archive line edited afterwards is refused and named.
654 as built (Linux builder, 2026-11-11): `adr-governs.mjs` now also reads each named file and lists every ADR it cites by number (`ADR 0257`), with its status and "cited in <file>", also for an untracked handoff; the repo handoff skill says to name an ADR scope by number, copy its items word for word, and run the script on the saved handoff. Verified: `adr-governs.spec.mjs` 6 tests (2 new fail with the citation scan disabled), spec:stress 4/4, a live run on `.claude/handoffs/builder-2026-11-11f.md` lists ADR 0240 and ADR 0257. Not verified: that a future handoff writer runs it (skill text only; no hook, handoffs are not committed).
655 (1) as built (Linux builder, 2026-11-11): `et design status` prints the last finished CI run (green, or red with failed job names via `gh run view --json jobs`) next to a running one and a red one adds "fix or revert before any feature slice"; commit (this commit); verified by spec on real gh captures (bites without the lookup) and a live run; not verified: queued state on a real status call, part (2) scheduled cargo audit.
809\. Linux builder (2026-11-11, grill decision): the commit of the merge 11e14d9fd printed 15 slice-paths warnings, all for paths the merge took unchanged from origin/next. Why no tool caught it: `check-slice-paths.mjs` compares every staged path with the slice and does not know a merge. Tool fix (decided): with `MERGE_HEAD` present, the check warns only about staged paths whose staged content differs from both HEAD and MERGE_HEAD; incoming paths taken as-is stay silent. Bite: replay the 11e14d9fd merge in a temp repo: 15 warnings before, 0 after; a merge with one more out-of-slice edit still warns.
809 as built (Linux builder, 2026-11-11): `check-slice-paths.mjs` with `MERGE_HEAD` present drops each staged path whose staged blob equals HEAD, MERGE_HEAD or the clean auto-merge tree (`git merge-tree --write-tree HEAD MERGE_HEAD`); the third side keeps a cleanly auto-merged file silent too. Verified: replay of the real 11e14d9fd merge in a temp clone: 15 warnings before, 1 after (`run-load.spec.mjs`, the hand-resolved conflict, which is own work, so not 0 as predicted); with one more out-of-slice edit it warns for that path too. Spec: 15 tests, the 2 merge cases fail without the merge filter and without the auto-merge side; spec:stress 4/4.

810\. Linux builder (2026-11-11, grill decision): 34b823e8f restored findings 797-806 after 807, and only `check-studio-adrs.mjs` in the push checks said "finding 797 follows finding 807; numbers must increase"; 39b5df3c6 fixed the order. Why no tool caught it at commit: the pre-commit hook runs the finding order check only when STATUS or an ADR is staged, not the plan. Tool fix (decided): when the plan is staged, pre-commit also runs the finding order check, from `check-plan-findings.mjs`. Bite: re-stage the 34b823e8f order in a temp repo; pre-commit refuses.
810 as built (Linux builder, 2026-11-11): `check-plan-findings.mjs` (run by `.husky/pre-commit` when the plan is staged) now also refuses a staged plan whose finding numbers do not increase; `findingOrderErrors` moved there and `check-studio-adrs.mjs` uses it. Verified: the real 34b823e8f plan re-staged over its parent in a temp repo exits 1 with "finding 797 follows finding 807; numbers must increase"; with the order check off that spec fails; 23 specs of both files pass, spec:stress 4/4; `check-studio-adrs.mjs` on HEAD still ok. Not verified: a live hook run with a wrong order in this checkout (the hook line was already there for 808).

811\. Linux builder (2026-11-11, from the Mac): `design check --product studio` on a clean HEAD 87c279030 rewrote the committed `.ethlete/design/studio/ready.json` (+20/-136): "RECORD DROPPED" for foundations/colors, foundations/spacing and pages/inventory, each with an OFF-CENTRE problem "found by design check". OFF-CENTRE has a rule baseline (d8cf6cd80, ADR 0201): a baselined old hit must not drop a ready record. Suspect until reproduced: either the baseline misses these 3 parts, or the ready auto-accept path reads the render result without the baseline.
811 not reproduced on Linux (Linux builder, 2026-11-11), stays Suspect: in a HEAD export (0afe96985) with its own cli build and an empty `node_modules/.cache`, `design check --product studio --part` for foundations/colors, foundations/spacing and pages/inventory each printed "clean", 0 findings, and kept all 3 records; the full `design check --product studio` had no OFF-CENTRE hit in studio, no RECORD DROPPED, and only added or refreshed records (foundations/logo, foundations/type, pages/inventory). The code path matches ADR 0201: `renderSystem` tallies only the OFF-CENTRE issues the rule baseline does not list, and `withTalliedProblems` turns only those into "found by design check" blockers. So on the Mac those 3 parts most likely hit OFF-CENTRE without a baseline entry: the check measures text against font metrics, and the baseline was recorded on Linux. Next step: run the Mac check with `--part foundations/colors` and keep the OFF-CENTRE line it prints (state, size, element path), so the hit is either fixed or baselined.

811 on the Mac (Mac builder subagent, 2026-11-11, measured in a worktree with a patched copy of the rule). Cause (measured): the flagged text is set in `10px ui-monospace, "SF Mono", Menlo, Consolas, monospace` (`--font-code` in `.ethlete/design/studio/foundations/type/type.css`); the design frame loads no web font (`document.fonts.size` 0, status `loaded`), so the Mac draws SF Mono and Linux the generic `monospace`. SF Mono at 10px: ascent 9, descent 2, cap 7.29, an 11px line box. In the 22px content box of `co-ratio` and `sp-height` the 11px slack splits 5/6, so above 7.71 and below 9.0 (1.29 > the 1px tolerance); in the 16px `pages/inventory` box the slack splits 0/1 (3.71 / 5.0). The same font makes most `pages/sketches` `sk-gutter` gaps 0.65-0.95px, so their baseline entries no longer hit on the Mac. Not the cause: font load timing (no web fonts). Not measured: the Linux fallback numbers. Recommendation: self-host one monospace font and the UI font in the design styles, so both OSes measure the same font; a per-OS baseline entry (ADR 0201) keeps two truths and still drops records on the other OS; a tool fix in the rule removes only the 0.29px font share, not the 1px layout split. Side result: the main checkout's `dist/libs/cli` was stale against HEAD and the CLI gate refused it.

812\. Linux builder (2026-11-11, grill decision): `yarn push` (push-next.mjs) accepted only a push-suite ok verdict for HEAD itself, so a docs-only commit on top of a green sha (0afe96985 skills and ab32641a1 plan on top of green cfd98cddc) refused the push and forced a rerun of the whole suite (minutes). No tool caught it: the push-next spec covers only a verdict for HEAD or none, and the pre-push check already walks back to the newest ok verdict, so the gap showed only at `yarn push`. Decided fix: push-next accepts the ok verdict of an ancestor when every later commit touches only `plans/**`, `apps/ethlete-studio/docs/adr/*.md`, `.changeset/*.md`, `.claude/handoffs/**` or `.agents/skills/**/*.md`, after a rerun of the fast checks on HEAD, and prints which ancestor verdict it reused; the walk lives in one module shared with the pre-push check.
812 as built (Linux builder, 2026-11-11): new `tools/scripts/verdict-reuse.mjs` holds the walk to the newest ok verdict (`verdictBelow`), the docs allowlist and the line `push-next: reused push-suite ok of <sha> (n docs-only commits on top)`; `push-next.mjs` uses it with the allowlist, reruns the fast checks on `<ancestor>..HEAD` (push-suite's `preChecksStep`: committed-file format check plus every `pre-push-checks.mjs` script, a superset of lint:studio-adrs, lint:changesets and lint:person-names that also covers lint:size and lint:no-verify-briefs, which read `.agents/skills` and `.claude/handoffs`), and has `--dry-run`. The pre-push check (`push-suite.mjs --check`) already accepted an ancestor verdict under its own broader exemption (plans/, .changeset/, any .md); it now runs the same walk from the shared module (loaded by dynamic import, push-suite keeps no static sibling import) and prints the reuse line. Condition probe: no `test:tools`, `nx test cli` or studio spec reads the working-tree files under the allowlist; only temp-repo fixtures and fixed-sha history reads (`git show 0c2451802:plans/...`). Verified: 5 push-next specs in temp repos (docs-only on a green ancestor accepted and named, a code commit refused before the checks, a failing fast check refused, no green ancestor refused, dry run pushes nothing), with the reuse disabled 4 of them fail; spec:stress 4/4; the live `node tools/scripts/push-next.mjs --dry-run` on ab32641a1 printed `push-next: reused push-suite ok of cfd98cddc (2 docs-only commits on top)`, and `push-suite.mjs --check origin/next HEAD` printed the same with `pre-push:`. Not verified: a real `yarn push`, and the push-slot check of a slot held by another builder on the same sha, which still asks for a verdict of that sha itself.
B488 as built (Linux builder, 2026-11-11, ADR 0261, 789 (3)): new open-point kind `sketch-problem` (sketch, variant, rule,
message) in `open-points.ts`, one per distinct static problem a variant of a ready, not discarded sketch brings in
(`variantProblemsOf`, the same problems the `/__design/sketches` badge shows), on the sketch's primary target, so a
sketch-only part gets it too. Only the Studio path reads it (`readOpenPoints(product, { sketchProblems: true })` from the
open-points cache and the draw path): laying every variant over the product costs ~8 s on studio and ~2 s on studio-lab
(measured), which timed out `real-open-points.spec.ts` (5 s) when `design check` paid it too. Studio: the chip popover
lists it under the error icon as "Sketch-Regel verletzt: <rule>" with the variant as detail (`open-points.ts`,
`STUDIO_LABELS.system.sketchProblem`). Bite: `open-points-answer.spec.ts` "answers a sketch-problem point ..." fails without
the change (read-open-points, then the cache flag) and passes with it. Real data: studio-lab `elements/rating` yields 8
UTILITY-CSS points (variants a, b, c). Live (scratch /tmp/b488-lab, own ports, `withStudio`, shots /tmp/b488-shots/):
the part view of studio-lab `components/card` with a scratch `display: flex` in ready sketch variant a shows the chip
"6 offen" and the line "Sketch-Regel verletzt: UTILITY-CSS" in the popover DOM (card-chip-open.png). Not built: the chip
on the Sketches page, so the sketch-only `elements/rating` still shows none there (rating-sketch.png, chip count 0): the
page is the design part `pages/sketches`, which has no chip in its design, and adding one is a design change with an open
sketch (`pages-sketches.change-crop`) already on it. Not measured: the open-points answer delay on a cold cache in Studio.

813\. Linux builder (2026-11-11, grill decision, from Mac 6e5e8e5f7 fix (4)): `sketch check` called `renderIssuesOf` without `cached: true` (`sketch-command.ts`, `renderedVariantsOf`), while `design check` passes it (`check-system.ts`), so a second `sketch check` of an unchanged variant drew every frame again instead of reading the render-check cache. Decided: pass `cached: true`; an unchanged variant hits, a changed variant (its files or what `sketch.json` draws) misses.
813 as built (Linux builder, 2026-11-11): `renderedVariantsOf` in `sketch-command.ts` passes `cached: true`. Cache key finding: no extension needed; the key hashes the salt and the whole frame group, whose address and frame search carry the sketch target and variant, and a hit also needs every response the drawing loaded to answer the same, the variant's part modules and its registry slice (what `sketch.json` lists) included; a `sketch.json` edit that changes nothing drawn still hits. Specs: `render-cache-draw.spec.ts` (unchanged variant draws nothing; an edited variant file redraws exactly its part; an edited registry slice redraws the variant; a sibling variant and the merged parts do not share entries, which fails when the key drops the sketch) and `sketch-check-run-draw.spec.ts` (two checks both ask for the cache). Bite: without `cached: true` the run-draw spec fails (`[undefined, undefined]`). Live (HEAD export d5624bffb + the fix, studio-lab `components/card`, `ETHLETE_DESIGN_PHASES=1`): cold 4.5 s with `PHASE render-check 1.35s`, then unchanged 3.1 s with `PHASE render-check 0.09s`; variant b padding edit 4.1 s / 0.78 s, then 3.5 s / 0.11 s. `elements/rating` from the brief fails static UTILITY-CSS, so `sketch check` skips its render check. Not verified: a `sketch.json` edit live, and the Mac.

655 (2) as built (Linux builder, 2026-11-11): new `.github/workflows/rust-audit.yml` runs `cargo audit` (pinned 0.22.2,
cached binary) on both Tauri crates of `next` daily at 05:00 UTC, on `workflow_dispatch`, and on a push that changes
the workflow. Studio had no audit at all: `cargo audit` in `apps/ethlete-studio/src-tauri` found the 4 zip advisories
(RUSTSEC-2026-0367, -0368, -0369, -0429) that timetrack accepts for the same updater reason, plus a yanked
yoke-derive 0.8.3. Fix: Studio gets the timetrack `audit.toml` (same ignores, same deny list), `cargo update -p
yoke-derive` (0.8.4), a new `ethlete-studio:audit-rust` target, and a step in the `ci / Rust host` job. Verified
(measured): `cargo audit` exits 0 on both crates locally. Not verified: the push run and a dispatch run on GitHub;
the schedule fires only once the workflow file reaches `main` (GitHub runs scheduled workflows from the default
branch). Suspect: a red scheduled run does not show in `et design status`, which reads only the CI run of `next`.

814\. Linux builder (2026-11-11, night, after 655 (2) ffb61f392): `et design status` reads only the CI run of `next`, so
a red scheduled `rust-audit.yml` run (a new advisory) shows nowhere a builder looks at slice start. Suspect (code read).
Tool fix (backlog, grill decision): the status line also reads the last finished `rust-audit` run and prints its
failed crates.

760 as built (Linux builder, 2026-11-11, night): `check-studio-adrs.mjs --summary` prints one line
`warning: N studio ADR warning(s); run \`yarn lint:studio-adrs\` for the list`instead of one line per warning, and the
pre-commit hook calls it with`--summary`. `yarn lint:studio-adrs`still prints the full list. Verified: a new spec for`warningLines` and the hook pattern (both fail on the old code: no export, no flag in the hook), 15/15 pass; live:
309 warning lines become 1. Not changed: the 309 warnings are almost all "finding N is cited by no STATUS row".

763 as built (Linux builder, 2026-11-11): the case "a step with a log file writes its output to a new file as it comes"
waited a fixed 150 ms for the first line and let the child print the second line after a fixed 300 ms, so a child that
starts slowly under load missed the first read. Cause (bite): the same case with a child that starts 200 ms late fails
on the old code and passes on the new one. Fix: the case polls until the run log holds the first line, then writes a
`go` file; the child prints the second line only after it sees that file. No fixed delay is left. Verified: spec:stress
4/4 at `--load 2 --slow 4`. Not verified: the Mac at load 18.

B491 as built (Linux builder, 2026-11-11, ADR 0265): `check-changeset-coverage.js` skips the docs-only paths
`DOCS_ONLY` (`apps/ethlete-studio/docs/adr/**`, `plans/**`) before it maps a path to a package. AGENTS.md "Releasing"
and the changeset skill name the rule. Verified: 3 new specs in temp repos (an ADR-only range passes; a `libs/cli`
README change and a Studio code change next to an ADR still fail); the ADR-only case fails on the old script, 11/11
pass on the new one. Not changed: the pre-existing `no-useless-assignment` lint error at the `kept = null` line.

B489 as built (Linux builder, 2026-11-11, ADR 0263/0264, finding 792 A/B): sketch `pages/sketches@open-points` (targets
`pages/sketches`, `components/sketch-status-badge`), ready, no pick. New page states `picked`, `sketch-only-points`
(a sketch-only part with a pick and two UTILITY-CSS problems), and in a and c `sketch-only-points-open`; new badge state
`picked`. a: the part-view chip "3 offen" top right beside Verwerfen with the Offene Punkte popover; badge "Sketch
gewählt, noch nicht gemergt" (the pick shows twice). b: no chip, one points line beside the round picker; badge
"Gewählt, Merge offen" (long lists truncate). c: the chip in the head of the picked variant beside Übernehmen; badge
"Variante gewählt" (no place for the chip without a pick). No existing badge state fits a pick: a variant that left the
badge unchanged was refused by `sketch check` (same pixels as a), so every variant adds `picked`. Verified: `sketch check`
(only ROUND-NOT-READY before ready), `design check --lint <7 files> --tsconfig` ok, `et design shot` of the new states of
every variant read at full scale, `sketch ready` ok (auto-merge skipped, variants differ). Not done: the app
(`sketchStatus` reading the pick, one shared "waits for a pick" function, the bite) waits for the pick.

B490 as built (Linux builder, 2026-11-11, ADR 0262/0264, finding 811): sketch `foundations/type@font-pair`, ready, no
pick. Each variant ships its two fonts as self-hosted variable woff2 (fontsource 5.3.0, Latin subset, OFL 1.1) in its
own `assets/fonts/`, with `@font-face` in `type.css` and the face first in `--font-ui`/`--font-code`. a: Roboto + Roboto
Mono (74 kB). b: Inter + JetBrains Mono (86 kB). c: Noto Sans + Noto Sans Mono (66 kB, today's Linux look). Verified on
Linux: `sketch check` ok, `design check --lint <6 files> --tsconfig` ok, `et design shot --variants` of the type sheet,
`pages/merge` open drawn per variant in the design frame, every woff2 served 200 and its FontFace `loaded`, and each face
measures wider than the serif fallback (none of Roboto, Inter, JetBrains Mono is installed here). Found: the
`type.css?inline` copy that `tokenSheet` injects keeps `url('@assets/...')` unresolved, so each family has a second,
never-loading `@font-face` and `document.fonts.check` returns false; the resolved face comes later and wins, but the
order is the only thing that holds. Not done: the Mac shot (out of reach of this builder).

815\. Linux builder (2026-11-11, B490 font-pair sketch 523abcb77): `type.ts` imports `type.css?inline` for `tokenSheet`,
and the inline copy keeps `url('@assets/...')` unresolved, so each family gets a second `@font-face` that never loads and
`document.fonts.check` is false; the drawing renders right only because the resolved rule comes later. Cause (measured).
Why no tool caught it: no gate checks that an `@font-face` in a drawing loads. Tool fix (doc agent, tool internal):
resolve `@assets` URLs in `?inline` CSS in the design frame build, and a check that every `@font-face` of a part reaches
status `loaded` (fails the part otherwise). Bite: the check fails on 523abcb77 without the URL fix.

816\. Linux builder (2026-11-11, B490): `et design shot` refuses a page the sketch does not target, so a foundations change
cannot be shot in a page that embeds it; the subagent fell back to its own Playwright script. Suspect (one run). Why no
tool caught it: `shot` knows only the sketch targets. Tool fix (doc agent, tool internal): `shot --in <page>` for a
foundations or components sketch, drawing the page with the sketch variant applied.

816 as built (Linux builder subagent, 2026-11-11, 6beeee554): Reproduced: `yarn design shot pages/sketches@font-pair --variants --product studio` exited 1 with `design-explore: pages/sketches@font-pair has no open sketch in product "studio"`, and `shot` had no way to name a host part. Fix: `shot <layer>/<name>[@<sketch>] --variants --in <layer>/<name>` draws the merged host and each variant of the sketch inside it (the product overlaid with the variant, as the open server draws `part=` with `sketch=`); `inPageRefusalOf` refuses a host the product lacks and a host that neither is a sketch target, reaches one through its imports, nor takes it as a tokens part (`--in <page>: <page> does not embed <part> (...)`, exit 1); `--in` without `--variants` exits 2. Help text and `apps/docs/cli/index.md` name the flag. Bite: 3 cases in `shot-command.spec.ts` fail with the source at HEAD (`inPageRefusalOf is not a function`, and the flag refused as unknown). Verified: cli typecheck, eslint, `vitest related` 143 tests, a live `yarn design shot foundations/type@font-pair --variants --in pages/sketches --product studio` sheet (merged plus a, b, c with diff rows; variant a draws the page labels and buttons in the mono pair, 79871 px changed) and a `GET /__design/shot?part=pages/sketches&state=page-sketch&sketch=foundations/type@font-pair&variant=a` from :4402 that shows the same font change. The open server never refused this; only the CLI did. Not verified: a components sketch in a page live, `--in` with `--at` or `--crop changed`; the live CLI run flagged variant c's page-sketch cell as unstable between two renders (70861 px), exit 1, not investigated.

Sketch pick tool gap as built (Mac builder subagent, 2026-11-11): new `et design sketch pick <layer>/<name>[@<sketch>] --variant <key> --decided-by "<the words and where they were said>" --by <model id> [--product <name>]` writes the same `decision` into `sketch.json` that Studio's `POST` pick writes (`decideSketch`, `kind: pick`, `by: designer`, `cmd`, `pid`, `decidedAt`), with the words as its `comment`; it refuses an unknown or rejected variant and a sketch that is not ready (exit 1, message from `decideSketch`). Verified: 3 new cases in `sketch-command.spec.ts` (merge `--decided-by` exits 1 "has no pick" before the pick and 0 after; unknown variant; not ready), all 3 fail with the command unregistered. Gap 2 not reproduced: a refused `sketch merge` already exits 1 - the existing spec "refuses a sketch with two live variants" asserts 1, and a live probe of the built CLI in a temp copy of the fixtures exited 1 for "has 2 live variants ... the user picks in Studio" and for "has no pick", so no code change and no bite; the 0 seen live most likely came from a pipe or wrapper, not the CLI. `sketch ready` exits 0 when ready is written but the auto-merge is skipped or held (`stillReady`, "shows no visible change but did not merge"): ready itself succeeded and the held merge is retried, so left as is. Not verified: a pick and merge on the real repo sketches.

817\. Mac builder (2026-11-11, grill decision; numbered 814 on the Mac, renumbered at the merge because Linux 814 exists): `et design sketch merge --decided-by tom` wrote `"decidedBy": "tom"` into `merged.json`, and the push was blocked by `yarn lint:person-names`. Cause: sketch merge wrote the --decided-by value verbatim, the help suggested a person name, and no write-time check matched lint:person-names; the push suite caught it at pre-push (14ea73f7c fixed the record). Fix: the help of `merge` and `pick` names the role (`human`, `'human in chat: take b'`), and both refuse a `--decided-by` that holds a person name (exit 1, message names the role "human") before any write; the name hashes live in `libs/cli/src/lib/person-name-hashes.json`, read by the CLI (`person-names.ts`) and by `check-person-names.mjs`. Bite: `sketch-command.spec.ts` runs `pick --decided-by "tom in chat: b"` and `merge --decided-by tom` and expects exit 1 with `sketch.json` unchanged and no `merged.json`; `human` passes.

818\. Doc agent (2026-11-11, merge 9df5ffa51): the Linux builder (c7a12f585, `et design status` / rust-audit) and the Mac
builder (sketch `--decided-by`, built cc552105f) both wrote a `814\.` head on their own branch; the merge kept both, and
the Mac's became 817 by hand. Cause (read from git): each builder takes the next number from its own copy of the plan,
and `check-plan-findings.mjs` only refuses dropped heads, never a repeated one. Tool fix (doc agent, tool internal):
`check-plan-findings.mjs` refuses a staged plan in which a `NNN\.` head occurs twice, naming the number and both lines;
the pre-commit run then stops the merge commit that would carry the duplicate. Bite: the check passes a plan with two
`814\.` heads without the fix.

659 part 2 live (Linux builder, 2026-11-11): with a busy `npx vitest run` in `libs/cli` (pid 885101) started 8 s before
`yarn push:suite` at HEAD 1665f5644, the suite log printed `push-suite: warning: 1 other test or build process(es) of this
checkout run:` and the line `885101    4.0 % cpu  node node_modules/.bin/vitest run`. Verified live on Linux; not on the
Mac.

819\. Linux builder (2026-11-11, push:suite at 5c75ada87): the B489 sketch (da746a43e) copied the pre-merge sample
`author: 'Tom Bornholdt'` into its variants, and the commit went through. Cause (measured). Why no tool caught it:
`lint:person-names` runs only in pre-push, not in pre-commit. Tool fix (doc agent, tool internal): run
`check-person-names` on the staged files in pre-commit.

As built (TBD819). `check-person-names.mjs --staged` checks the staged blobs (not the working tree) of the staged files under libs, apps and
`.ethlete/design` against the same baseline and prints the same message as pre-push; `.husky/pre-commit` runs it when such a file is
staged. The spec stages a name, clears it in the working tree and fails on the old script. Not verified: a real commit through the hook.

820\. Linux builder (2026-11-11, same run): `lint:changesets` in push:suite failed on the untracked 815 changeset of a
running subagent. Suspect: the check reads the working tree, not the HEAD export the suite tests. Tool fix (doc agent,
tool internal): the suite runs the changeset check inside the HEAD export, so untracked files of other agents never
count.

815 as built (Linux builder, 2026-11-11): the measured cause differs from the finding. The `type.css?inline` module
already resolves `@assets` (system-modules spec). The unresolved copy is the product `styles.css`: it `@import`s
`foundations/type/type.css`, the sketch swaps in the variant's file, and that inlined text never passed `withAssetUrls`.
Built: `importedAssetUrlsPlugin` (`sketch-stylesheets.ts`), a PostCSS step after the swap that rewrites
`url(@assets/...)` in every inlined declaration through `withAssetUrls`, so the variant's own `assets/` wins; and the
render rule `FONT-FACE` (`system/font-faces.ts`, run in `inspectedFrameOf`): it loads each `@font-face` of the drawn
frame as a FontFace and fails the part when one is not `loaded`: `@font-face "Roboto" from url("@assets/fonts/...")
does not load (FontFace status error), so its text draws in a fallback font`. Bite: `sketch check
foundations/type@font-pair --product studio` without the plugin fails with six FONT-FACE lines (two per variant); with
it, ok. The new spec in `sketch-stylesheets.spec.ts` fails without the plugin. Product runs: studio and sdk have no
FONT-FACE hit (their other findings are older). Not verified: the Mac.

815 as built (Linux builder, 2026-11-11, 91cdff2ed): Cause corrected (measured with a debug line): not the `?inline`
copy. The failing `@font-face` sat in the product's `styles.css`, which `@import`s `foundations/type/type.css`; for a
sketch, `sketchStylesheetsPlugin` swaps in the variant file, and that inlined text never passed `withAssetUrls`. Fix: new
`importedAssetUrlsPlugin` (PostCSS, after the swap) rewrites `url(@assets/...)`, so a variant's own `assets/` wins. New
render rule `FONT-FACE` (`font-faces.ts`, run in `inspectedFrameOf`) fails a part whose `@font-face` does not reach
status loaded. Bite: `sketch check foundations/type@font-pair` exits 1 with 6 FONT-FACE lines without the fix, 0 with it;
the `sketch-stylesheets.spec` case fails without the plugin. studio and sdk have 0 FONT-FACE hits. Not verified: Mac.

821\. Linux builder (2026-11-11, B489 a8621f4ab): the `pages/sketches@open-points` sketch was drawn while the
change-crop sketch on the same part was open; the Mac merged change-crop b (2f83c46da), and open-points went stale with no
notice. It showed only because a person-name fix touched the sketch and `sketch ready` refused with SKETCH-BASE-STALE.
Suspect (code not traced). Why no tool caught it: only `sketch ready` checks the base. Tool fix (doc agent, tool
internal): when a merge changes a part, `design status` and the inbox name every open or ready sketch on that part as
stale.

655 (2) closed (doc agent, 2026-11-11): push run of ffb61f392 (the workflow change) and dispatch run 42992543540 on
a55bc3218 (rustix 1.1.6 for RUSTSEC-2026-0486) are green in both jobs. The dispatch 42991716047 failed on de075868f,
before the fix: the audit did its job.

822\. Linux builder (2026-11-11, 655 (2) close): the rustix fix a55bc3218 changed both `Cargo.lock` files and started no
rust-audit run. Cause (read): `on.push.paths` in `rust-audit.yml` lists only the workflow file. So a lockfile change that
pulls in an unsound or yanked crate is audited only by the next 05:00 UTC run, after it is on `next`. Tool fix (doc agent,
tool internal): add `apps/*/src-tauri/Cargo.lock` and `apps/*/src-tauri/Cargo.toml` (the real paths of both crates) to
the push paths; verify with a lockfile-only push that starts a run.
822 as built (Linux builder, 2026-11-11, c6184dbb0): `apps/{ethlete-studio,timetrack}/src-tauri/Cargo.{lock,toml}` added
to `on.push.paths` of `rust-audit.yml`. Not verified: a run on a lockfile-only push (the push of this commit starts a run
because the workflow file changed); the builder checks it on the next `Cargo.lock` push.
821 cause (Linux builder, 2026-11-11, B489 re-ready 780683501): Cause (proved with merge-base): the sketch was drawn in
da746a43e on the other side of git merge 9df5ffa51 from the change-crop merge 2f83c46da. `rebaseAfterMerge`
(`sketch/after-merge.ts`) checks only the sketches in the checkout that runs the sketch merge, and nothing runs it again
after a git merge. Suspect (code read): the inbox (`staleBaseOf`) would have shown a rebase item after 9df5ffa51;
`design status` does not check a stale base. The 821 fix therefore also runs the stale-base check after a git merge
(post-merge hook or `design status`).

823\. Linux builder (2026-11-11, B489): `sketch rebase` named only variant b as a conflict ("the variant and the product
both changed it"); a and c had the same kind of overlap and passed. Suspect. Tool fix (doc agent, tool internal): find
the rule that let a and c through; a spec with the B489 variants (da746a43e onto 2f83c46da) must name all three.

824\. Linux builder (2026-11-11, B489): `sketch check` 70 s and `sketch ready` 59 s (target 10 s), `design check
--product studio` 199 s (target 60 s). Measured once. Tool fix (doc agent, tool internal): profile one `sketch check`
run and name the slowest step before any change.

825\. Linux builder (2026-11-11, B489): the tmux session `studio-serve` did not exist, and a plain `yarn design` now
leaves :4402 to the Studio app and serves on a random port, so a shot from the open server found nothing on :4402. The
agent started `DE_PORT=4402 yarn design` in tmux `studio-serve`. Suspect: the skills that name :4402 still assume the old
default. Tool fix (doc agent, tool internal): one source for the design server port, and the skills read it, or
`yarn design` prints the port and the skills name the print.

826\. Linux builder (2026-11-11, 816 live run): `shot foundations/type@font-pair --variants --in pages/sketches` exited 1
because variant c's page-sketch cell differed between two renders (70861 px). Suspect (one run): an unstable render or a
stability check that is too strict. Tool fix (doc agent, tool internal): repeat the run 5 times; if it comes back, find
which pixels move (a diff image) before changing the check.
