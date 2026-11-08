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

253\. B145 step 2 (builder, 2026-11-03) brought the comment write path back, but the designs leave gaps the builder
would otherwise have had to invent: thread, reply, resolve and withdraw are drawn nowhere (comment-reply, -done
and -withdraw have no caller), the draft field is drawn unfocused, and leaving comment mode by key (Esc, `C`) is
not drawn. The capability list (B157) names these actions, but a capability without a drawn place only shows as
"missing", not as a blocker of the slice that builds next to it. Fix: B189 - one Studio sketch (opened pin as a
thread card in pages/system and pages/inbox with reply/resolve/withdraw, the draft drawn focused, the key exit),
variants where there is a choice; Tom picks. The inbox "Senden" button that the live inbox does not wire is
B173.

254\. ORPHAN-ENDPOINT (B147) missed `/__design/comment` after 8cf715654 deleted `writeComment$` (builder,
2026-11-03): the app builds the path from a bare segment (`productUrl(address, 'comment')`), so a grep for the
full path finds no caller and none is missed either - the check matched strings, not calls. Lesson: a caller
check resolves calls through the functions that build the path, not text. Fix: B190 (technical) - resolve
callers through the host functions that call `designAnswer$` with the segment; a spec on the 8cf715654 tree
reports all four comment endpoints, and after 4221e7cb3 still reports reply, done and withdraw (known list).
Correction (builder, 2026-11-03, after B190 2b91b06b6): the old rule did report all four endpoints on the
8cf715654 tree, but they sat on the known list under B145, so they came out as known warnings, not errors. The
real gap: a known entry silenced a regression - an endpoint that had a writer and lost it looked the same as one
that never had one. Lesson: a known entry names the state it expects. Fix: B195 (technical) - each ORPHAN-ENDPOINT
known entry says "never written" or "written by <fn>"; losing a writer reports the endpoint again. The builder
lists the other known lists where an entry can hide the same flip.
Builder list (de36e4795): UNBOUND-INPUT and SAMPLE-DEFAULT do not hide the flip - a fixed entry fails
until it leaves the list, so a later regression is a new error. Two lists do: a per-part `unreachable` state
pair (motion rule) still passes once it becomes reachable, and a `data-et-skip` hides every later problem on
its element. Fix: B202 (technical) - an `unreachable` pair that becomes reachable is an error; each skip names
its reason class (CLIPPED, ...) and the check reports a skip whose reason no longer holds (B187 first case). B190 still landed (calls resolved through
the host functions; an import no longer counts).
As built (B202, 2026-11-07): `MOTION-UNREACHABLE-REACHABLE` (rules/motion.ts) reports an `unreachable` pair that also has a
declared motion; `SKIP-CLASS` (rules/skips.ts) reports a `data-et-skip` in a part's strings that is empty, bare or names a
class outside `SKIP_CLASSES` (CLIPPED, WRAP, NESTED-SCROLL, NESTED-SURFACE, LOST-SURFACE, COVERED; skip-classes.ts also feeds
the render check's escape list). Specs for both; the real sdk, studio and studio-lab parts report nothing new. Not built:
reachability through a `rules` entry without a motion, a skip on `checks.skip` (typed), and a skip whose class no longer
holds beyond SKIP-SCOPE (B187). `design check` itself was not run: it refuses on stale components mocks (needs a components
build), the new rules are static and were run over all three products directly.

255\. B180 could not reproduce the `--out` + `--variants` refusal from finding 244: the source already accepted it
(now pinned by a spec). The refusal came from the shared cli `dist/`, which predates B172 (it still checked
withdrawn variant b) (builder, 2026-11-03). B94 guards the design libs' dist that shots draw from, not the cli's
own dist, so an agent ran an old CLI and reported its bugs as current ones. Lesson: a tool must say when it runs
older than its own source. Fix: B191 (technical) - in a repo checkout `et design` prints a first-line WARN
"cli dist older than libs/cli/src (built <time>, source changed <time>), run <rebuild command>" and repeats it in
every report header; rebuild the shared cli dist once the parallel slices settle.
As built (B191, rest): `design check` prints the warning again before its summary lines; the dist rebuild is left
to the coordinator.

256\. Sketching B178 (canvas frames, builder, 2026-11-03) the action vocabulary was too small for real interactions:
no double-click form for `data-et-action`; capabilities.json cannot say a capability happens automatically
(frame fit via ResizeObserver has no place to draw); instant state switches must each be declared `unreachable`
to pass ready, so the part lists all 90 pairs. Each gap pushes an agent to fake a place or to bulk-declare
exceptions that then hide real ones. Parallel agents also overwrote each other's scratch files. Lesson: when the
declaration language cannot say the true thing, agents write a false one that passes. Fix (technical): B192
`dblclick:` prefix read by CAPABILITY-PLACE; B193 `"automatic": true` with a required `why`, accepted without a
place but listed in every capability report (never silent); B194 an `instant` declaration replacing per-pair
`unreachable`. Scratch names are slugged per agent in the builder brief.
As built (B192): `parseAction` strips `dblclick:` and marks the action `gesture: 'dblclick'`; the actions and live-actions
checks press such an element with a double click only. CAPABILITY-PLACE matches the literal key, so a place names
`dblclick:<state>`. As built (B193): `"automatic": true` needs a non-empty `why` and no place (error otherwise), and
is a warning line in every `design check`.

259\. The sketch header read "Letzte Änderung von ·" with no name (builder, 2026-11-03): sketch title-bar has no report
file, `lastChange()` (`sketch-view.component.ts`) returns empty by/since, and the label renders the separators
anyway. Samples always carried a report, so no state showed the missing case. Lesson: a sample set includes the
missing optional data. Fix in B186: fall back to the newest variant's author, drop empty parts, red spec; a
sketch-view state without a report file.

263\. B173 (builder, 2026-11-03): the inbox `draftText` still falls back to the fixture text through `??`. The live
store holds `''`, so nothing shows it today, but an `undefined` would show sample text in the app. Why no tool
caught it: SAMPLE-DEFAULT only reads input initializers (`sample-default.ts`), not other expressions that fall
back to sample data. Lesson: sample data reachable through any fallback is the same defect as a sample default.
Fix: B205 (technical) - SAMPLE-DEFAULT checks every expression in an implementing component that falls back to a
sample identifier (`??`, `||`, ternary); the inbox fallback goes with B189.

264\. B186 cause (builder, 2026-11-03, 8d5d281cb): the pan clamps from 030fe2f36 (`clampPan`/room) and 5a29b1b94
(`Math.min(0, ...)` camera) stopped the Sketches canvas at the top-left edge. Why no tool caught it: canvas.e2e had
crashed before its first case since 5a29b1b94 - it pulled the deleted elements-shell-main sketch through
`git archive` - so it never ran on 030fe2f36, and a suite that crashes before any case reads like no suite.
CANVAS-CAMERA-OWN (B196) was never built. Lesson: an e2e suite that runs zero cases is a failure, not a pass, and
its fixtures come from the code, not from git history. Fix (technical): 8d5d281cb generates the fixture and adds
`--case <substr>`; new e2e "pan beyond every edge" (red on Sketches, Chip, Large before the fix). B197 maps
design-parts/sketches, components/design-canvas and system-view to canvas.e2e and fails a suite that crashes
before its first case; B196 also flags pan-clamp math outside design-canvas; B198 asserts iframe creations ==
frames (each of the 60 iframes is recreated once after the first render; 6 connections give a 15-20 s first
paint). The builder adds a pages/sketches design state with no report file. Not verified: the Tauri app, the
remembered camera after reload, the sticky column shadow while panning.
B197b (03d197841): e2e-check judges each suite (`judgeSuiteRun`): timeout, `N/0 passed`, a silent exit 0 and a
nonzero exit with no PASS/FAIL line are red; the runner's own `0/0 passed` exited 0 too and now exits 1 for
canvas, page-switch and studio-menu. The canvas suite alone runs over 9 minutes, long enough to get skipped.
Fix: B212 (technical) - split canvas.e2e by view so e2e-check runs only the touched views; the three suites without
a case count print `N/M passed`.
As built (B212, 2026-11-07): `canvas.e2e.mjs --view system|sketches|flow` runs the pages of one view (system: System, Edited,
Inbox; sketches: Sketches, Wide, Merge, Discard; flow: Flow); the file stays one file, so fixtures and the worker pool are
shared. `e2e-map.mjs` maps to `canvas-system`, `canvas-sketches`, `canvas-flow` (`suiteInvocation` turns a suite name into
script plus `--view`): flow-_.ts runs only flow, sketch-view and design-parts/sketches only sketches, system-view.component
only system, comment-_.ts system and sketches; design-canvas, design.ts, canvas.e2e.mjs and the rest of system-view run all
three (a `fallback` map entry applies only when nothing more specific matched). sketch-frame-cap, sketches-tree and
server-restart print `N/1 passed`; frame-load-failed still prints no count. Verified: e2e-check.spec (24 pass, new cases for
the mapping), `--view flow` 6/6 passed, `e2e-check --list` on two real commits selects the narrow view sets. Not verified:
the system and sketches views run, the three new count lines (edited, not run). The Studio app did not compile on this base
(TS2322 `ThemeSwitch.current` string vs undefined, system-view.component.ts:304); I widened the type locally to run the
suite and reverted it - not fixed here.

265\. CANVAS-CAMERA-OWN built (B196, 7a7caf5ff, f53a0a03e, e57fa1868): a local ESLint rule for
`apps/ethlete-studio/src/app/design-parts/**` flags pan/zoom/camera state, wheel and pointer-move listeners and
clamp math on pan values; red on the real 030fe2f36 and 5a29b1b94 components. HEAD is green only through a known
list: Sketches still owns its camera, flows owns a zoom copy. red-check said NOT RED on 7a7caf5ff because it cannot
stub `export default`. The rule skips external `.html` templates. Decided (technical): B213 - design-canvas owns the
Sketches camera and exposes zoom as a signal for the flows chip, the known list goes empty, the rule reads
`templateUrl`; red-check's default-export stub goes into B217.
As built (B213, 2026-11-07): `components/design-canvas/frame-zoom-camera.ts` (`frameZoomCamera`) owns the Sketches
pan, zoom (`'fit'` or a number), clamp and sticky-gutter offset; Sketches only reads it. Only the opening camera stays
inside the content (the design's `pan()`); a camera the user moved is free and follows the viewport's left edge
(the origin delta, as `hostLeft` in design-canvas), so hiding the panel no longer moves the frames. `CanvasViewport`
exposes `zoom` as a signal and the flows chip reads it. CANVAS_CAMERA_KNOWN is empty; the rule reads the `templateUrl`
file for event bindings (spec with a wheel fixture). The e2e case runs on System, Sketches and Flow. Verified:
frame-zoom-camera.spec (origin shift past the content edge), sketches/flows-page/canvas-viewport specs, rule spec,
lint. Not verified: the widened e2e case (0/5, every page timed out in `waitForFunction` under desk load, System and Flow too) and its red run on Sketches without the fix
(B120 saw it red there before).

266\. system-view.component.spec "on a flow" logs `ResizeObserver is not defined` 6 times (flows-page `mountCamera` ->
canvas-viewport.ts:199, since ea4459688) and the suite passes (builder, 2026-11-03). Why no tool caught it: vitest
passes a spec that logs `console.error`, so a real error is stderr noise. Lesson: a logged error fails the spec,
as in the Storybook test-runner. Fix: B215 (technical) - the Studio vitest setup stubs ResizeObserver and a spec
that logs `console.error` fails.

267\. B178 merge (e888db413): the merged column, group and reload buttons of canvas-frames carry `data-et-action` but no
`data-et-control`, so `design check` reports 5 CONTROL-UNDECLARED after the merge. Why no tool caught it: `sketch
ready` and the merge do not run CONTROL-UNDECLARED on the variants. Also: `sketch merge` on Tom's pick records the
agent in accepted.json, and a failed commit loop restored stale JSON backups over the working file twice (no
foreign hunk lost; the copy-aside risk B204 removes). Fix (technical): B216 - a follow-up sketch declares the
controls; B217 - `sketch ready` runs CONTROL-UNDECLARED per variant, `sketch merge --decided-by tom` records Tom.
A pairwise `unreachable` list costing 2n entries per new state goes to B194 `instant`.
As built (B217, 2026-11-07): `sketch ready` has an `undeclared` phase after `identical`: per live variant it draws the variant's changed parts at rest only (`partsCompletenessOf` with `undeclaredOnly`, on the shared warm server) and refuses with `CONTROL-UNDECLARED ... (variant <key>)`; the merged part is drawn at rest too, only when the variant has a finding, and a finding it draws the same way is not the variant's. `sketch merge --decided-by <name>` writes the name as `decidedBy` in merged.json (not with `--allowed-by`). red-check stubs `export default` (function, class, expression). Verified: specs for the added-controls check (complete.spec), the flag (sketch-command.spec) and the default stub (red-check.spec). Not verified: the time of the new phase on a real many-variant sketch; the pre-existing `sketch new` specs of sketch-command.spec that call the async `created` synchronously fail at next (not from B217).
As built (B211): `sketch variant` prints `  <new>: from withdrawn <from>` under the new variant when `--from` names a withdrawn variant.

268\. Committing Tom's by-tom lines (builder, 2026-11-03, 8dd3679b1, 2f6fcf90f): `design commit-hunks` fails at once on a
busy `.git/index.lock`, against the decision in finding 260 (B184 retries on the lock). Why no tool caught it: no
spec runs commit-hunks while the lock is held. Also: go.json holds uncommitted hash and file-list refreshes for 11
parts that are not Tom's (comment-pin, error-toast, shell-collapse, shell-project-switch, tree-row, zoom-chip,
shell-main, studio-menu, pages/merge, pages/sketches, pages/start), caused by the new icon assets of the title-bar
work; no one knows which run wrote them. Why: an automatic refresh records no writer. Lesson: every write to a
shared design file names its writer, or it becomes an orphan no agent may commit. Fix (technical): B218 -
commit-hunks waits with `waitForLock` from `tools/scripts/commit-wait.mjs`, spec holds the lock; B219 - a refresh
entry names `refreshedBy` and `cause`; the title-bar slice that added the icons commits the 11 refreshes.

270\. B169 report (builder, 2026-11-03): "Transform failed" did not reproduce in two private-outDir runs, but pages/sketches
state page-sketch fails to render ("design-explore: state failed"), so its render rules were NOT CHECKED, and
`design check pages/inbox` still checks all 29 parts. Why no tool caught it: an unrendered state reads as a note,
and the CLI accepts a part argument it never reads. Lesson: a check that could not run is red, and an ignored
argument is an error. Fix (technical): B221 - re-run page-sketch on tmp/b169-compile to tell a build problem from
a real one; a state that fails to render fails the check. B222 - `design check <part>` narrows the run; an
argument no command reads is an error. Full `yarn e2e-check 4221e7cb3` (B197): 104/105, the only FAIL is the
expected B198 case.

271\. `server-identity.spec` "reports no installed cli when the project has none" fails on a clean HEAD worktree too
(builder, 2026-11-03). The worktree used the symlinked node_modules, which may supply the installed cli, so the
spec depends on its environment. Why no tool caught it: specs run only in the main checkout, where the result
happened to pass. Lesson: a spec about "nothing installed" controls what is installed. Fix: B206 (technical) -
the spec stubs the installed-cli lookup instead of reading node_modules.

272\. Commit contention (builder agents and this session, 2026-11-03): the pre-commit hook runs related cli specs
against an index checkout for minutes while `.git/index.lock` is held, so parallel commits fail with "File
exists" and agents retry by hand (a docs-only commit here waited over 4 minutes). A Bash hook also denied a whole
compound command because it contained `git stash list`. Why no tool caught it: the hook was built for one
session. Lesson: in a multi-agent checkout a commit waits, it does not fail, and a ban targets the harmful
subcommand only. Fix (technical): B207 - a commit with no related spec starts none, and `yarn commit` waits for
the lock with a message; B208 - the stash ban covers only writing subcommands and leaves `list`/`show` alone.
Correction (builder, 2026-11-03): the >4 min wait was a foreign hook holding `.git/index.lock` (a docs-only hook
takes 0.1 s). `git commit -- <paths>` runs pre-commit on a temporary index of HEAD + those paths, but the specs
read the shared working tree with other agents' unfinished edits, and the lock stays held while they run. Landed:
19ec4dd67 (docs-only skip, timeout re-run), 74cf900b0 (`yarn commit` waits for the lock), b3c669203 (B206).
Decided (technical): B214 - `yarn commit` runs the related specs before it takes the lock, in a throwaway worktree
of HEAD + the paths; the hook then does not run them again. That fixes the lock time and the foreign edits at once.

275\. B214 (builder, 2026-11-03, 7593257f8, eba8f6885): the B207 timeout re-run never fired in the real repo. vitest
prints `FAIL |cli| src/x.spec.ts`; the parser regex had no room for the `|cli|` project prefix. Why no tool caught
it: the B207 unit spec fed made-up output without the prefix, never a captured real run. Lesson: a spec for a
parser of tool output takes its fixture from a captured real run of that tool. Fix: eba8f6885; the rule goes into
the styleguide/testing guidance (builder). Still unverified: a Studio-suite run through the B214 worktree.

277\. B204 + B218 (builder, 2026-11-03, 480a22119): commit-hunks now splits every shared design JSON per entry, writes
sorted keys, never commits a pure reorder, and waits for the commit lock. Why no tool caught the gap earlier:
commit-hunks was spec'd only on synthetic repos holding the first incident's files, never on the real
.ethlete/design files. Lesson: same as 275 - a tool's spec runs on the real inputs it will meet; here one spec
walks every real shared JSON and fails on an unclassified kind. Decision: accepted.json lists keep append order
(a log), they are not sorted. Not run yet: a live go.json commit through commit-hunks.

278\. B215 (builder, 2026-11-03, 43295ce99) and the B214 live check. B215: a console.error in a Studio spec fails it;
ResizeObserver, document.fonts and display:block for canvas/viewport/form-field hosts are stubbed in jsdom only
(decision: keep the display:block stub, the host list grows per observed host). The new rule caught 12 spec gaps
and no component bug; 20 failures stay, the same set before and after (foreign uncommitted sketch work). B214
live: `yarn commit` ran the studio specs in the worktree, then the pre-commit hook ran them again instead of
skipping, and `git add` of a new untracked changeset lost to index.lock contention. Why no tool caught it: the
B214 end-to-end spec committed only modified files, never a new untracked file next to them. Lesson: third case
of 275 - the rule covers the shape of a spec's input too (commit shape, file set), not only parsed text. Fix:
B214 reopened - find why the marker missed, `yarn commit -- <paths>` adds untracked paths itself, spec on that
real shape, one live commit where the hook skips.

279\. B201 (builder, 2026-11-03, 2afda8d28): reach sweeps pan positions and COVERED names the opaque cover first. Two
gaps. (1) The sub-agent never saw the two real Studio "Übernehmen" cases the slice came from and built synthetic
ones (pan-gutter, pan-header), so whether the real buttons now turn red is unchecked. (2) No spec had an opaque
pane with a transparent child, so the first draft's wrong blame passed its own specs. Why no tool caught (1): a
builder sub-agent brief names the slice, not the defect's real reproduction. Lesson: a fix is verified on the
real case that reported it; synthetic specs come on top. Fix: the builder sub-agent brief carries each defect's
real reproduction (part, state, element) and the slice report quotes the check on it; B201 stays open until
`design check` on the part holding the Übernehmen buttons reports them.
Real check (builder, rebuilt dist with 2afda8d28): `design check --product studio --part pages/sketches` gives 94
findings, the same as base; nothing on emit:merge (Übernehmen, sketch-rows.ts:205) or emit:discard (Verwerfen,
sketches.ts:328) in any state, while far-out (finding 242) and the 228/235 state should flag them. So the fix is
proven only on synthetic specs. Hypotheses (unverified): the reach check does not list emit:merge/emit:discard
as declared actions of pages/sketches, or a hidden head is skipped before the visibility test. Next slice starts
from this repro and is done only when check reports the Übernehmen button UNREACHABLE or COVERED.

### Stash hook and settings order decisions (2026-11-03)

- B208 (Tom: yes): `.claude/hooks/ethlete/git-safety.py` lets `git stash list` and `git stash show` pass; every
  writing stash subcommand (push, save, pop, apply, drop, clear, branch, create, store) stays refused.
- B224 follow-up (Tom: yes): the builder restores `.claude/settings.json` with `git checkout .claude/settings.json`
  (the diff was hook order only); a later `yarn agents:sync` must then leave it unchanged.

281\. B205 + B225 (builder, 2026-11-03, 4247f5042, 21bc27863). B205: SAMPLE-DEFAULT flags `??`/`||`/ternary fallbacks to
sample constants; the real hit is inbox.component.ts:72 `this.draftText() ?? this.DRAFT_TEXT`. Decision: the
line-based match stays; an AST walk only after a real multi-line miss. Not run: a full `design check` with the
final code. B225: the hook ran the specs again because HEAD moved during the run (485dbbd76 landed 2 s before the
commit), so marker tree != staged tree. Why no tool caught it: the B214 spec never had a concurrent commit. Fix:
the hook also skips when the files between marker and staged tree select no specs; `yarn commit` adds untracked
given paths itself. Accepted gap: a mid-run commit whose files select no specs is skipped, the same blind spot
the selection rule has for staged files. Not verified: git-add retry under lock contention.
Title-bar r3 (2026-11-03): Studio asked Tom to rebase for d961cb00d, a declarations-only change that draws
nothing, while `sketch rebase` only rewrites baseline hashes (B220 not built). Lesson: a "needs rebase" signal
says whether the change draws anything. Into B220: rebase ports new states; Studio marks a draw-free base change
as "base refreshed, no visual change" instead of blocking the pick. title-bar is B220's real reproduction.

### Title-bar rebase and canvas-frames merge decisions (2026-11-03)

- B208 + settings restore: Tom typed the approval into the builder session himself.
- Title-bar r3 (Tom): components/title-bar changed since the sketch was cut; the builder rebases the sketch onto the
  current part. The uncommitted pick `"variant":"f"` is not committed: it was made on a stale base. Tom picks again
  after the rebase. B220 (`sketch rebase` ports new states) is built first, with title-bar as its real reproduction;
  a hand rebase is not a substitute.
- B199 (Tom: "yes, I think"): the builder confirms that the tree is byte-equal to variant c and that the Studio
  merge record names c. Both true -> commit c and migrate canvas-frames to `instant` (B194) in the same commit.
  Either false -> report, commit nothing.

studio` on the new commits.

### Unrecorded merge decisions (2026-11-03)

- pages/system (Tom: merged): HEAD's sketch records pick b and the tree equals variant b, so the builder commits
  the merge.
- canvas-frames (Tom does not remember merging it; no recorded pick): the builder restores the element and the sketch
  to HEAD, and Tom picks again in Studio. The merge, the `instant` migration and the B226 real repro follow that
  pick. This case is B228's real reproduction.

### Pace decision (2026-11-03)

- Tom: slow down. No new sub-agents until 15:00 today. Running sub-agents finish their current slice and get no
  follow-up. The builder works the queue alone, one slice at a time: TS2345 fix check, then B229, B220
  (title-bar), B227/B228.
- canvas-frames (Tom, 13:09): Tom merged it again in Studio and confirmed it in chat. The tree equals variant c, and
  the merge deleted the sketch dir again, so Tom's chat message is the only record of the pick (B228's second
  repro). The builder commits c together with the `instant` migration and quotes B226's real repro.
- pages/system: Tom gave the go. go.json holds hash 9117d961d91424fa, which is neither the old nor the merged hash.
  The builder checks it before committing.
- canvas-frames: Tom also gave the go. The builder commits it with the pages/system go, after checking the hash.

287\. B198 (builder agent, 2026-11-03, f31d50339). The spec edit adds only a jsdom clientWidth mock, so red-check is
not red. The red proof is the e2e case "first load creates one iframe per frame and aborts no frame request":
HEAD 0/3, fix 3/3. canvas 107/108. Still red: "Large: listing refresh every 1 s for 6 s re-navigates no iframe"
(60 re-navigations). That is a separate refresh-path bug, B232. sketches-tree failed in the full run (reload
47767 ms) and passed alone; load from the parallel canvas suite is the guess, unproven. Why no tool caught the
refresh bug: the e2e case existed and was red, but nothing tied a red e2e case to an open B-item. Rule: a red
e2e case in an e2e-check quote names its B-item, or the report proposes one.

288\. B231 + canvas-frames commit (builder a6, fresh session, 2026-11-03). B231 7f431e9f1: the parser reads top-level
fields only through PARSED_PART_FIELDS, and a spec asserts that list ⊆ keyof Part plus a tsc fixture. ⊆ rather
than == is right, because Part also carries render-only fields the static parser never reads. red-check was not
run (owed). canvas-frames c + instant landed in b0996d580, 4aa34ad7e and 4c0336b02. Tom committed the go
(206b65635). B179's diff landed in dd5ff755d. part-go.spec "stores a go with an open point" failed once inside
`yarn commit` and passed alone; it gets a B-item if it recurs. B221-nobrowser: 7566ed0e9; red-check not proven
(killed twice under load); a full studio check is owed. Three tool decisions (doc-agent, technical):
(1) DROPPED-PROP on canvas-frames: the app component has no `mark` (loading/failed) or `heads` input, so compare
cannot check 4 states. The tool did its job. B233 adds the inputs after B216.
(2) CLASS-GLUED-INTERPOLATION at canvas-frames.ts:100 is a false positive: every branch of the hole starts with
whitespace. B234 lets such a hole pass, and the part stays unchanged after the go.
(3) Stale dist: `nx compile cli` does not refresh dist/libs/cli/design, so a TYPE-ERROR came from a stale build,
and only a separate WARN line said so. B235: with a dist older than its source, `design` exits 2 "dist stale -
nx build cli" before it prints any finding.

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

336\. Two corrections from Tom (2026-11-03). (a) The grill session asked Tom which states a sketch round shows, but
that was decided several times: unchanged states fold away (finding 77, b879f640e), each variant row stacks its
states with unchanged ones dimmed and the first change marked (pages/sketches round 2, variant e), and a round
names its question states (`sketch round --asks`, default the states the round added) with `ready` refusing
variant pairs below ~2 % visible diff. Why no tool caught it: the grill session asked without searching the
plan for the topic first; the builder recommended the same without checking either. Rule: before any grill
question or recommendation, grep the plan for the topic and quote the earlier decision; if it exists, the
question is "why does the tool not do what was decided", sent to the builder. The pages/system and
sketch-status-badge views (findings 332, 335) show all states unfolded and identical variants, so the decided
behaviour is missing or regressed; the builder finds which commit and why no spec held it. B281 and the "touched
states" part of B284 collapse into that. (b) The B256 variant c draws a "Mocks veraltet" popover with an
`nx build components` command. A designer can do nothing with it; stale mocks must never reach the Studio UI.
Decision (Tom): no banner, no variant of it. Studio and the design server rebuild stale SDK mocks themselves
before they draw; the CLI refusal for agents (check, ready, shot) stays. Why no tool caught it: nothing checks
that Studio UI text is for a designer. Fix: a rule flags command text (`npx`, `nx `, `yarn `, `--flag`,
env assignments) in a studio product drawing or app template. The pages/system sketch 2862bad2e is withdrawn.

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

358\. Builder (2026-11-04, S1): a PreToolUse hook blocks every Bash call whose text contains "design ready", also a
heredoc or a commit message. Why no tool caught it: the hook spec tests only commands that should be blocked,
not free text that only names the command. Tool fix (technical, B305): the hook matches the command position
only; the spec gets cases with the words in a heredoc, a quoted string and a commit message.
As built (B305, 2026-11-07; closes B126 too): `libs/agent-rules/content/hooks/background-design-commands.py` splits the command into simple commands (heredoc bodies and quoted text removed, `$(` and separators split) and matches a long command only when the segment starts with a launcher (yarn, npx, node, nx, timeout, env assignments and the like). The spec has cases for a commit message, echo, unquoted echo and grep, heredoc and `$(cat <<EOF)` commit messages, plus command-position forms that must still deny. Bite proof: the old hook denied `echo design ready` and an unquoted grep. The `.claude` copy was written by hand with the generated header, not through `yarn agents:sync` (build too heavy on the loaded desk); a later sync should produce no diff. Not verified: other agents' hook copies (Codex), a launcher missing from the list lets that command through.

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

388\. Builder (2026-11-04, B325): 5fd088c7c (A10 S2) removed `go` from the open-points answer, but two cli specs
still expected it. They failed at HEAD and blocked every later cli commit until 586c115a9. Why no tool caught it: the
pre-commit gate runs only the specs related to the staged files, and these two specs read the answer through a path
the related map does not link. Fix (B334): a field name or string literal that the staged diff removes pulls every
spec that contains it into the gate run, as finding 376 does for labels. Also seen: `list-system.spec.ts` failed once
under load; if it is bound to wall-clock time, it goes into the B268 fake-clock work.
As built (B334, w3-gates-b): no hook change. ADR 0225 keeps slow checks out of the hooks, and the spec-selecting
pre-commit gate is gone (d67c98f91). The CI `Unit tests` job runs every spec on every push, so a removed field or
literal that a spec still expects fails there; a related-spec subset in a hook would only repeat it.

389\. Builder (2026-11-04, B325): dd708ee4a committed `started-by-studio.spec.ts` with a type error;
`tsc -p libs/cli/tsconfig.spec.json` fails. Why no tool caught it: vitest does not typecheck, the pre-commit gate
runs only vitest, and S7 moved typecheck to CI. Fix (B334): when a staged file is a spec, the gate also runs
`tsc --noEmit -p <lib>/tsconfig.spec.json` for that lib, inside the 60 s budget of S7; if it does not fit, it runs
only the staged specs through vitest typecheck mode.
As built (B334, w3-gates-b): no hook change. The CI `Checks` job runs `nx run-many -t typecheck`, which covers
`tsconfig.spec.json` of `libs/cli` and every other lib. A `tsc` per commit takes tens of seconds, so by ADR 0225 it
stays in CI.

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

394\. Builder (2026-11-04, B326): `verify-webkit-frame-wheel.swift` ran over SSH on the Mac but no setup got any event
(canvas 0 of 10, iframe 0 in all six rows), and it still printed "FAIL the shielded iframe took wheel events".
Cause: events sent with `web.scrollWheel(with:)` reached neither document, likely because a process started over SSH
has no key window or event routing; the verdict logic read zero events as a failure of the fix. Why no tool caught
it: the harness has no positive control, so a blind run looks like a result. Fix (B338): a check reports BLIND when
its control target (here the unshielded canvas) gets no event, and never PASS or FAIL; build it with the B321
WebKit tooling once wip/b321 lands. B326 stays verified in Chromium only.
As built (B338, 2026-11-07): the B321 tool was already on next (c348db743, newer than `wip/b321-stacking-fix`), so
nothing was taken from that branch. `verify-webkit-frame-wheel.swift` is now the `frame-wheel` mode of
`tools/scripts/verify-webkit-studio.swift` (same three rows); `verify-webkit-studio.mjs` runs it by default and alone
with `--checks frame-wheel`, without a build or design server. Positive control: a fixed 60 px element on top of the
page with its own wheel listener takes a 4-step gesture before and after the probes; zero events there ends the run
as BLIND (exit 3), never PASS or FAIL. The `edges` check had the same blind spot (no wheel event reads as "no
bounce", a false PASS) and now runs the same control. `webkitVerdict` (verify-studio-headless.mjs) folds the check
exits: any failure fails, else any blind run gives BLIND. Verified: the verdict spec (fails without the BLIND branch).
Not verified: the Swift was not compiled or run (no Swift on the Linux desk); a Mac run is open, and whether
`web.scrollWheel(with:)` reaches WebKit from an SSH session is still unknown - the control now says so instead of
guessing.

395\. Builder (2026-11-04, B326): the Studio e2e case "Sketches: no state is marked before the compare answers"
(21dcfc17f, 2026-11-03) fails, also on the build before B326. Inferred cause, not run: d2eaac782 (B329/B324 listing
tiers) lets the quick listing return `unchanged` states kept from an earlier full comparison
(`keptUnchangedStatesOf`), so Studio marks them early on purpose, and B329's fold depends on it; 2a1a52628 is a weaker
candidate. Why no tool caught it: `canvas.e2e.mjs` runs only through a manual `yarn studio:e2e`, in no hook and not in
CI; CI on `next` was red on other jobs at that time and nobody triaged it. Fix (B339): `studio:e2e` runs as a CI job.
Tom (2026-11-04): kept `unchanged` marks from the last full comparison may show from the quick listing; a new mark
shows only after the full listing. The case is updated to this rule and still fails on an early new mark.
As built (B339 rest, w3-gates-b): `ci.yml` has a `studio-e2e` job (cli build, Chromium, `yarn studio:e2e`). It runs
when `apps/ethlete-studio` or `libs/cli/src/lib/design` changed (the `design-changes` job), counts in `Verified`, and
does not gate `deploy`.
As built (B339, 2026-11-07): `deploy` needs `studio-e2e`. Its `if` became `!cancelled() && inputs.deploy && no failed
need`, because `studio-e2e` is skipped when no design path changed and a skipped need would skip `deploy` with the plain
`inputs.deploy` condition. Verified: prettier on `ci.yml`. Not verified: a CI run of the changed `if`.

396\. Builder (2026-11-04, B323): `GET /__design/shot` with `sketch=components/title-bar.code-notice` (the sketch's
folder name) answered 404 "variant a ... has no part components/title-bar", a wrong cause: the sketch exists, only
under the id `components/title-bar@code-notice`. Why no tool caught it: no spec covers the shot route with a sketch
name in the wrong form. Fix (B341): the route accepts the folder name as a sketch id, and an unknown sketch answers
"no sketch <x>; did you mean <id>" from the listing. Lesson: an error must name the input it could not resolve, not a
cause further down.
As built (B341): the shot route reads `sketch=` as an id, `<layer>/<name>.<sketch>` or a folder name
(`sketchIdOfName`); an unknown sketch answers 404 `no sketch <x>; did you mean <ids>`.

397\. Builder (2026-11-04, B323): the ready sketch `components/title-bar@code-notice` has a round note that says
"b = Punkt am Update-Bereich", but variant b draws the dot on the "Neu starten" button. Why no tool caught it:
`sketch ready` does not compare the round note with the variants, and that is not checkable by a tool; and no command
corrects a round note without reopening the sketch. Fix: the `sketch note --round` part of B114 edits a round note
of a ready sketch and keeps it ready. Until then the doc agent tells Tom the correct text when it shows the sketch.

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

403\. Tom (2026-11-04, screenshots of the same sketch): (1) the variant header card ("Variante a · Opus 5.5", note,
"Übernehmen") keeps its size when he zooms out, so at 30 % it is a large empty teal frame above the grid; (2) in the
first column a black block labelled "part" covers the frames, likely the frame cap's empty far cell. Cause not yet
confirmed by the builder. Why no tool caught it: the sketch-view e2e measures frames, not the chrome around them at
other zoom levels. Fix (B346): the header card and the empty far cell follow the canvas zoom or collapse below a
readable size, and the e2e takes the sketch view at 30 % and 100 % and fails on a box with no visible content.
Builder (S6a check): the empty cell in Tom's screenshot is not a missing state (all 26 states ok in a/b/c); it is
the frame cap's far cell, an empty div at 10 % zoom. Suspect for the "part" block: a near cell past the cap renders
`<img [alt]="key">`, and a picture that does not load shows its alt text on a dark block. Step 1 of B346 confirms it
with a 30 % shot.
As built (B346, 2026-11-07, part 1): the canvas e2e case "the sketch view at 30 % and 100 % draws no failed picture
and no empty head at 100 %" (Sketches, Chip, Large, Wide) checks heads at 100 %, pictures at 30 % and 100 %, and a
third pass that answers every `/__design/shot` with 404. With the old build a refused picture showed its alt text
(`a reset-active`, `current linux-left-cli-dirty`) over the frames, Chip and Wide failed; the sketch view now hides a
picture that failed to load. Not proved: that Tom's black "part" block was this alt text; no failed picture showed
without the 404 route. Reproduced but not fixed: at 30 % the head is an empty 427x40 box (Sketches, Large) and 85x60
(Chip). The design draws the same box (`rowHead` in `pages/sketches/shared/sketch-rows.ts`,
`in-data-sk-head-hidden:invisible`), so the change is the open sketch `pages/sketches@head-zoom` (a collapse, b
scale the whole head, c tag); the 30 % head check goes into the case with the pick. Not built: the state-name floor
(finding 431 (2)).
Found on the way (2026-11-07): `sketch new` wrote 9 `../` instead of 6 into the canvas-math import of a copied
`shared/sketch-rows.ts`; it rebased imports leaving `shared/` for the variant folder, then lifted the folder three
levels up. Fixed: it rebases them for the place they end up (`settledIn`), with a spec that fails on the old code.
The head tag (c) built on desk/B346 (4f56e7893) is held: the sketch `pages/sketches@head-zoom` is still in progress
and has no pick, and its e2e case failed 0/4 under load.

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

406\. Builder (2026-11-04, S6a check): the product shot of `blockers-open` answered a non-image before the merge, so
the builder could not compare that state. Likely cause (not proven): the product had no `blockers-open` state yet, and
the shot route answers an unclear text for a state the part lacks. Why no tool caught it: the route names a missing
part, but not a missing state. Fix (B341): a state the part lacks at HEAD answers 404 with "state <s> not in part <p>
at HEAD".
As built (B341): a state the merged part lacks answers 404 `state "<s>" not in part <p> at HEAD - it has: ...`
(the state check already existed; its wording now matches).

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

410\. Mac perf session (2026-11-04, B348): the ~60 s waits of findings 408 and 409 are a missing `dist`, not a cold
cache. `render.packages` maps `@ethlete/*` to `dist/libs/*`; when that folder is missing, `render-packages.ts` polls
every 500 ms up to `BUILD_WAIT_TIMEOUT_MS = 60_000` (`entryOfBuilt` with `Atomics.wait` in the render worker,
`entryOfBuiltAsync` in Vite `resolveId`), then throws. Nothing starts a build, so the wait always runs to the timer,
once per drawing module, and the Vite SSR transport times out after another 60 s while the worker blocks: about 120 s
for the first listing. With a full `dist` and a cold harness cache the desk answers in 651 ms (listing) and 2 s
(system). It hits every fresh clone and every consumer repo that maps to an unbuilt `dist`. Why no tool caught it: the
desk checkout always has a built `dist`, and the wait logs only a "waiting for the build" line, no error. Fix (B351):
a missing `dist` fails fast with an error that names the package and the build command (`nx build <pkg>`), one check
per package, not per module; budget: a fixture with `render.packages` on a missing `dist` answers the first listing
within 5 s with that error.
Built (B351, 7a7c37b30): a missing `dist` throws at once with "<dir> missing, run `nx build <folder>`"; the poll is gone.
The poll came from 1d116d6b8, so a render survived a package mid-rebuild; now such a render fails once and the watcher
redraws after the rebuild. Gap: the 5 s budget runs on the resolve path only, not through the compiled render worker or
a real Vite listing. Fix (B360): a check or e2e runs the real render path against a fixture whose `dist` is missing.
As built (B360, 2026-11-07): `libs/cli/src/lib/design/render-missing-dist.spec.ts` compiles the CLI with `tsc` into
`tmp/`, starts the compiled `createDesignServer` on a free port against a fixture with `render.packages` on a missing
`dist`, and asserts over HTTP: `/__design/calls` answers within 5 s with an error entry, and `POST /__design/render`
(the real compiled worker) answers within 5 s with a 500 naming `nx build components`. Bite proof: with the pre-B351
`render-packages.ts` and `render-worker.ts` both tests hit the 5 s limit (the listing waits, Vite's transport
disconnects). Not verified: the Vite listing does not itself name the missing package, because `resolveId` swallows the
`entryOf` throw and falls back to `node_modules` (here Vite reports an unexported subpath); only the render answer
carries the build command. Recommendation: let `mappedSubpathOf` surface the missing-`dist` error to the listing.
As built (B361, 2026-11-07): `entryOf` (`render-packages.ts`) asks `isBuildRunning` (`system/build-running.ts`) before it throws
for a missing dist: an `nx build <folder>` process whose working folder contains the dist (read from `/proc`, `ps` as
fallback with no cwd check) turns the error into `design-explore: wird gebaut … (nx build <folder>)`; with no build the
red error stays. `libs/cli/design/web/frame.ts` shows that line as grey monospace text on a dark box (`data-et-building`
on `<html>`, no `data-et-error`, so the frame does not count as errored) instead of the red box. Specs: build-running,
render (entryOf says building), frame-bootstrap (building state). Not verified: the real redraw after the build finishes
(relies on the worker restart of d7fc506b1 and the watcher; no e2e), the Studio-side look next to the existing loading
state, and macOS (`ps` path has no cwd check). The visual (grey text, no spinner) is a placeholder, not a designed state;
no sketch was built. Tool gap: the same as 410, no check runs the real render path against a missing dist (B360).
As built (B361 look, 2026-11-07): Tom chose variant C, the placeholder shows the elapsed build time. `showBuilding` (`libs/cli/design/web/frame.ts`)
appends `<n> s` to the line and re-paints it every second (counted from when the frame first shows the placeholder, not from
the build process start, so a frame opened mid-build starts at 0 s); the colors are now `--et-surface-color-muted-solid` on
`--et-surface-background-solid` instead of hardcoded greys. Spec: frame-bootstrap (first paint 0 s, 12 s after the fake clock
advances). Not verified: the look in a real Studio frame (no `design check` part touches it; the frame is CLI chrome, no design
part draws this state) and the real-build redraw. Tool gap: none new.

411\. Tom (2026-11-04): "der neu starten button tut nach klick nichts. wenns ne weile dauert sollten wir da nen spinner
zeigen". Builder (code read, not reproduced): almost surely the title-bar code notice ("CLI geändert - neu starten");
the "Design-Server gestoppt" panel shares its handler. The click runs host `design_server_restart`, which answers only
after the old server is killed, the new one listens (up to 90 s) and is judged. The button has no pending state;
`server()` keeps the old "listening" state until the answer, so the "starting" screen does not show; a second click
returns silently; `catchError(() => of(null))` swallows a refusal (finding 145). Duration not measured. Why no tool
caught it: no gate asserts that a click shows a visible change, the title-bar design draws the button at rest, hover,
pressed and focus but not pending, so compare has nothing to compare, and no e2e case clicks the code notice. Fix
(B352): a design check rule warns on an `emit:` action with an async handler (host invoke or HTTP) whose part draws no
pending state; an e2e helper `expectFeedbackWithin(click, 100 ms)` covers every async button (code notice, update
dialog, server panel, merge); a sketch of the pending state on the button (spinner, disabled) and an error toast on a
failed restart.

As built (B352, 2026-11-07): `PENDING-STATE-MISSING` (warning, `rules/pending-state.ts`) traces each `emit:` action from
its binding on the component's tag through methods, re-emitted outputs, service subjects and `kind` branches to a host
invoke or HTTP call; on studio it names 10 actions in 5 parts, title-bar `emit:restart` among them. The update dialog's
restart is missed (bound via `outputBinding`). e2e case "Neu starten in the code notice answers within 100 ms" with
`expectFeedbackWithin`, marked `open` (passes while it fails). Sketch `components/title-bar@restart-pending` a/b/c drawn,
not checked or readied (stale `dist/libs/components`). Not run: the e2e case end to end (first run broke on a type error,
since fixed), `design check`.

As built (B352 close, 2026-11-07): Tom chose variant a (recommendation: SDK busy button). Brought by hand into part `components/title-bar` (the `restart: 'pending' | 'failed'` prop, states `linux-full-notice-pending`/`-failed`, `loading` button, failed toast; sketch dir deleted) and the app `ethlete-title-bar` (`restart` input, `dismiss` output, `ethlete-error-toast` under the bar). `code-watch` holds the restart state (`pending` on act, `failed` on a refused server restart or quit, dismissed by the toast); `studio-view.restartServer` reports into it, so finding 145's swallowed refusal now shows. The e2e case lost its `open` mark. Verified: specs (title-bar, code-watch, shell-main, studio-view), lint; `design check --part components/title-bar` shows no PENDING-STATE finding and re-drew the two new pictures. Not verified: e2e case end to end, `design compare`, `task --verify`. Tool gap: `sketch merge` refuses while variants b/c live and the sketch is in progress (rejected b, c; the merge then needs the sketch ready), so the variant was copied by hand and `design check` opened a direct-edit sketch `components/title-bar@edit` (old/new) that Tom must pick in Studio; the sketch dir `restart-pending` was kept. Recommendation: let `sketch merge --variant` accept a recorded user choice from the plan, or let an agent ready a sketch.

412\. Mac perf session (2026-11-04, B348, full `dist`): `et design check --product studio` takes 1 083 s on the Mac and
615 s on the desk (36 parts, 767 findings). The per-part loop is 694 s vs 410 s; the slowest parts (Mac/desk) are
pages/sketches 97/33 s, textarea 36/11 s, slider 35/17 s. Likely cause: render-check `inspect()` runs every frame in
sequence in one Chromium page (~0.5 s per frame on the desk; pages/sketches has ~50 frames), and Node waits idle on the
round trips. Why no tool caught it: no budget on the check's own run time, and the frame count per part is not logged,
so a growing state matrix looks like a slow machine. Fix (B353): frames render in parallel pages; budget at a fixed
commit: no part over 20 s, the full check under 300 s on CI; the check logs and caps the frame count per part.

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

414\. Builder (2026-11-04, triage of finding 407): the baseline "only the known case red after c348db743" was false.
At c348db743 the known-red case crashed the whole e2e runner (`route.fulfill: Route is already handled!`), so every
later case never ran and looked green. Why no tool caught it: the runner reports the crash, but not the cases it
skipped, and nothing compares the case count with the last run. Fix (B355): an async throw in a case marks that case
FAIL and the runner goes on; the summary names every case that did not run; a run with fewer cases than the file
declares fails. Also (B339): `studio:e2e` runs as a gate on commits that touch `system-view` or `design-parts/sketches`.
As built (B355): the per-case try/catch (FAIL, run goes on), the worker-exit FAIL and the `rows < total` red already
existed; added the `NOT RUN` list in the summary naming every declared case without a result.
Then (2026-11-07): an unhandled rejection or uncaught exception thrown outside the awaited case fails the running
case, and the lead forks a fresh worker while cases remain. Between cases such an error ends the worker with exit 1
instead of being swallowed. Proved with two throwaway cases (`--case zzz --workers 1`): FAIL, then PASS, exit 1.

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

419\. Builder (2026-11-04, B343): a top-level await in `libs/cli/src/lib/design/started-by-studio.spec.ts` (dd708ee4a)
broke `tsc -p libs/cli/tsconfig.spec.json`, which then blocked every cli commit in the hook. Why no tool caught it: no
gate ran the spec typecheck on the commit that added it (vitest does not typecheck). Fix (B358): the commit gate runs
the spec typecheck for every staged spec file.
As built (B358, 2026-11-07): no hook change, same as B334 (388, 389). ADR 0225 moved the spec-selecting pre-commit gate (d67c98f91) out of the hook on purpose; `libs/cli` has a `typecheck` target on `tsconfig.spec.json` and the CI `Checks` job runs `nx run-many -t typecheck` on every push. A per-commit `tsc` over the staged specs' projects would take tens of seconds and bring back the slow hook. Not verified: a local timing of that `tsc`. If Tom wants it back, it belongs behind `yarn commit` (commit-wait), not in `.husky/pre-commit`.

420\. Builder (2026-11-04, B343): `list-system.spec.ts` fails only in the pre-commit temp tree (ENOENT on
`design/web/rebuild-probe-*.txt`). Why no tool caught it: the spec shares a probe path with the tree it runs in, and no
check runs a spec in both trees. Fix (B359): the probe tolerates a missing file, or the spec uses its own temp dir.

421\. Tom (2026-11-04, screenshot of the port-mark sketch on pages/sketches): "wann kümmern wir uns um diese ugly ui
hier?" The state labels (`agent-round`, `port-after-merge`, `port-after-merge-long`) float in plain monospace far left
of their frames on the empty dot grid, and the frames stand cut off at the right. Cause (builder): a part wider than
1/4 of the view uses the transposed matrix (`isTransposed`, `shared/sketch-rows.ts`). The design draws the state names
as a `font-code` gutter column, each centred on its state row. The design's only sample for this layout is the 32 px
tall title-bar, so for a page-sized frame of about 900 px the label sits at the middle of a tall frame. The cut-off is
likely `matrixFit`: it fits 2 columns after the label column and does not count the `auto` column of folded variants
(not measured). The app matches the design, so the compare check stayed green. Why no tool caught it: no check
compares the sample shapes of a design with the real input range of the product. Fix (B362): a design-coverage check.
For each layout branch of a part, the design draws the widest and the tallest real input from the listing, and the
check warns when the samples do not cover the real range. The layout itself goes into the B346 sketch (Tom picks).

422\. Tom (2026-11-04, screenshot of the sketch view zoomed far out): "noch nen ui ding bei extrem zoom". A frame
that an agent still draws shows its placeholder ("Opus 5.5 zeichnet diese Variante", "Der Rahmen füllt sich, sobald
die erste Ansicht steht.") at full screen size next to a tiny finished frame. The placeholder card is larger than the
frame it stands for, and its title wraps into three lines. Second screenshot (Tom: "das sieht auch wild aus"): next
to a column of 12 finished frames, the variant that an agent still draws is one tall empty card over all 12 state rows.
The title wraps into three lines in the middle of the card, and the pulse dot stands outside the card's left edge.
Cause (builder): the canvas zoom sets each frame's width and
height to part size × scale (`applyScale`) and uses no CSS scale. The placeholder is a card with fixed type sizes
(`text-ui-lg`, `text-ui-sm`) and a fixed `min-h-24` that the zoom never touches, in a column only a few px wide. The
design (`drawingStage()`) draws the same card, but only at `camera: 'fit'`, so the compare check stayed green. Why no
tool caught it: the design states cross the zoom extremes (below-fit, far-out) only with finished frames, never with a
status state. Fix (B362): the coverage check also crosses the status states (drawing, paused, failed) with the zoom
extremes a part declares. The look (placeholder scales with the zoom, below a readable size only the pulse dot and the
model logo) goes into the B346 sketch (Tom picks).

423\. Tom (2026-11-04, screenshot of variant a while the agent draws it): "die zeichnet line oben im variant header
kann dann wohl weg?" The variant header shows "● zeichnet" in its own line, and the frame below shows "● Opus 5.5
zeichnet diese Variante". The same state stands twice in one variant. Why no tool caught it: no check finds the same
status shown twice in one view. Fix: the B346 sketch draws the header without the line (Tom picks); the check joins
B362 as a rule.

424\. Builder (2026-11-04, port-mark sketch `pages/sketches@merge-port`): ADR 0183 says the same state of the same
variant carries the same sample marks in every page state. After B357, `narrow-part` and `comparing-narrow` still mark
the fit-* states of variant a as changed. Why no tool caught it: the sketch check does not compare the marks of one
variant state across the page states of a design. Fix (B363): a sketch check rule that warns when the same variant
state carries different sample marks in two page states. B357 stays open until all page states match.

425\. Tom (2026-11-04, two screenshots of `pages/sketches@merge-port` at 24 %): "zudem rendert die app für eine gewisse
zeit immer alle zustände bis wohl die berechnung durch ist welche varianten nicht verändert sind und dann springen die
raus." At first the view shows every state, most of them as empty frames. After a short time "27 unveränderte Zustände
eingeklappt" appears, and the folded states jump out of the layout. Above the frames stands a large empty band. Cause
(builder, code read): the first listing has no `targets`, so every shot has `changed: null`. `foldedStatesOf` folds
only states where every variant has `changed === false`, and `null` never folds. When the full listing arrives, 27
states turn `false` and fold in one step; `sameRows` has the same delay. The empty band is probably the placeholder
height of unmeasured rows (`tallestOf(state)` or `MEASURING_HEIGHT`); the B345 build proves it. Why no tool caught
it: the design states and the e2e specs wait for the settled listing, and no check compares the first paint with the
settled one. Fix (B362): a coverage rule that a view which reads an async mark draws the "mark unknown" state, plus an
e2e that fails when the frame count drops after the first paint. The look while the fold is unknown goes into the
B345 sketch (Tom picks).

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

428\. Tom (2026-11-04, screenshot of `pages/sketches@merge-port` far zoomed out, while the builder aligns the sample
marks): "und dann waren die bilder auf einmal weg". A moment before, the column showed 12 finished frames. Now it
shows 28 state rows, and all but four frames are empty boxes. The fold is gone again, and the drawing card stands over
all rows. A short time later (Tom: "und wieder da") the 12 folded frames with their images are back. So each
refresh of the listing seems to repeat the first paint of finding 425 (no marks yet, so nothing folds and the shots
are not shown). Cause (builder, code read): the quick listing carries the kept `unchanged` marks (c0035f241) only
while the sketch content equals the kept comparison. The builder's edits changed the sketch, so the next listing had no
valid marks: every shot got `changed: null`, nothing folded, and the frames re-rendered without a picture until the
full compare answered. Finding 425 is probably the same path with a cold cache (not proved). Why no tool caught it:
the c0035f241 e2e only proves that a quick mark equals the full mark, not the frame count or the pictures across a
refresh. Fix: the B362 e2e also edits the sketch after the first paint; B345 keeps the last shots and marks until the
new ones stand.

429\. Builder (2026-11-04): `sketch ready` without `--by` printed only the usage text and exited 0, so a script or an
agent sees success. Why no tool caught it: no spec runs a sketch subcommand with missing arguments and checks the exit
code. Fix (B364): every sketch subcommand exits 1 on a usage error, with a spec per subcommand.

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

442\. CI run 41924354824, job WebKit (builder, 2026-11-05): `.github/actions/setup/action.yml` read `/etc/machine-id` on
the macOS runner (from e6b59bdf4). Fixed in f30bb3b81 (machine id per `RUNNER_OS`, macOS through `ioreg`; only the
Linux branch and the fallback were run). Why pre-push missed it: no local gate runs a macOS step. Tool fix (B379,
builder default): a lint check for `.github/actions` and workflows that flags Linux-only paths (`/etc`, `/proc`) outside
a `RUNNER_OS` branch.
As built (B379): `yarn lint:runner-os` (`tools/scripts/check-runner-os-paths.mjs`) flags `/etc`, `/proc`, `/sys`, `/var/lib` and `/usr/lib` paths in `.github/actions` and `.github/workflows` unless the line names Linux (a `Linux)` case branch) or the step has a `runner.os == 'Linux'` guard. Part of the pre-push checks.

443\. CI run 41924354824, job Unit tests (builder, 2026-11-05): only `cli` failed. The `motion-shot.spec` fixture raced a
re-render under load (reproduced with a 300 ms delay; the repro bites on the old code). The `merge.spec` flake (B373)
did not come back in 24 local runs; its assertion now prints the check findings. Fixed in b770d4222. Why pre-push missed
it: CI is much slower (the merge spec file takes 17 s locally and 143 s in CI). Tool fix (B380, builder default): a
stress script that runs the touched specs N times in parallel under CPU load, part of the slice end.
As built (B380): `yarn spec:stress <specs> --runs N [--load M]` (`tools/scripts/spec-stress.mjs`) runs every spec N times at once next to M busy-loop processes (default one per CPU) and reports flaky (some runs failed) apart from broken (all failed). Step 5 of the builder-agent skill.

444\. CI run 41924354824, job Studio rules (builder, 2026-11-05): the job built only `cli`, so `design check` refused on
stale dist mocks. Fixed in 4de41ac2e (builds `cli,components` first). The check now runs and fails on the 3 real
problems of finding 438. Why pre-push missed it: no local gate runs `design check`. Tool fix: part of B372 (slice end
and pre-push run `design check --product <p>`). Tom (2026-11-05): B372 comes before the push and before B377 (ADR 0193).

445\. The tooltip swap for Studio (finding 116, row A8) also changed `libs/components` (e73234f6e, 661ce4cca, Tom
2026-11-05: "das war nie der plan"). Several bundles grew by up to 23 KB. Cause (builder): 4c60be59e added
`ethlete/no-native-title` as an error to the plugin's recommended template config, which `libs/components` also uses.
Lint then failed on the lib templates, and e73234f6e "fixed" them 26 minutes later. aa6fcba2f took the rule out of
recommended but left the lib edits. Reverted in 40a92b60b (ADR 0194). Why no tool caught it: a slice has no declared
path scope, and nothing stops a lint-driven fix from leaving it. Tool fix (B382, builder default): a new lint rule for app
code starts in an opt-in config; a slice brief names its allowed paths, and the commit gate warns when a commit touches
paths outside them (for example `libs/` in an `apps/` slice).

As built (B382): `tools/scripts/check-slice-paths.mjs`, called from `.husky/pre-commit`, warns (exit 0) when a staged path is
outside the paths in `ETHLETE_SLICE_PATHS` or the worktree's `slice-paths` git file; one `git diff`, silent when none are
declared. `.changeset/` and `plans/` are always allowed. The opt-in rule policy is a step in
`libs/eslint-plugin/CLAUDE.md`.

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

480\. Live check of slice B (builder, db25edee8, 2026-11-06): (1) at "Fit" in the wide layout the fold column is off-screen
(x=1432), `matrixFit` ignores it; (2) the fold label wraps to 3 lines with a lone "c"; (3) `compare` gives DIFF 157142px
in the `unchanged` state and flags 58 missed actions (a new aria-label): the app drifted from the merged design and
nothing ran it. Why no tool caught it: no spec checks the fit width with a fold column, and `check --rules` does not
look at an implemented app file that changed after its design merged. Tool fix: `check --rules` flags a changed
implemented app file when `compare` would fail (cheap path, builder decides how); a spec for the fit width with a fold
column and for a fold label at the narrowest width.
Built by the builder: 70488a4d9 (fit width counts the fold column, non-breaking space in the fold label, the extra
aria-label is dropped from the app, the design stays as merged), 5273e92bf (`design check --rules --base <range>` fails
with IMPLEMENTATION-UNCOMPARED for an implemented app file that changed after its recorded hash; the pre-push gate passes
base..head; bite proof done). Open: `pages/sketches` cannot be cleared (`task --verify`: "no check record at its current
design"; `design check` leaves 9 DROPPED-PROP findings, so no record is written), and the next push is flagged until it
is. Risk of the new check: a shared file such as `studio-labels.ts` flags 7 parts.

481\. `pages/sketches` carries 9 DROPPED-PROP findings that predate slice B: the design states withdrawn, agent, fold,
question and port were merged earlier (62812a4c3, e0f6a4396, aa8c96889) without the matching `input()` on the app
component (builder, 2026-11-06). Why no tool caught it: DROPPED-PROP stays a warning, so a merge of a design whose props
the implemented app lacks passes, and the debt only shows when a check record is wanted. Tool fix: a sketch merge for
an implemented part that adds props the app has no input for opens a port item (STATUS row or `design task`) at merge
time; builder decides how, or gives it a STATUS row. The `pictures.json` entry written by a builder `design check` run
is a check record, not a decision (committed 0a9bf6117).
Widened (builder ethlete-sdk-c0, 2026-11-06, full design check after 30a5c27b9): DROPPED-PROP also on
`canvas-frames` (4) and `pages/system` (8), so 21 states in three parts carry design props without an app input.

482\. The builder made a sketch with two variants for the state "all variants unchanged, auto-merge refused" and put it
in front of Tom. Tom (2026-11-06): "die beiden varianten für den pages/sketches sind doch beide quatsch. wieso sollte es
jemals zu diesem state kommen. wieso sollte jemals der user manuell einen unveränderten sketch mergen." He is right:
variants that draw the same pictures offer no choice, and the user never merges them by hand. The state exists only
because the auto-merge was refused (dirty guard, 475) and nothing retried it. Why no tool caught it: nothing asks
whether a state can happen before it is designed, and the refusal had no recovery path, so the UI invented a manual
one. Tool fix: (1) an unchanged sketch never offers a manual pick or merge; (2) a refused auto-merge shows a notice with
the reason and what clears it, and the CLI and Studio retry the auto-merge by themselves when the guard clears (clean
tree); (3) the sketch `pages-sketches` is discarded; (4) the builder lists the cause of a state in the sketch round note
before it draws variants for it.
As built (builder ethlete-sdk-c0, 2026-11-06): (3) `sketch discard pages/sketches` (the sketch was untracked, nothing to
commit). (1) The sketches part offers no merge for a variant whose every shot is unchanged, folded or open; the
`[data-sk-same-action]` blocks are gone. (2) A dirty-guard refusal stores `mergeHold.dirty` (the uncommitted paths); the
header shows one `[data-sk-merge-hold]` notice with the paths and "committen oder verwerfen, dann läuft er von selbst".
`retriedHeldMerges` re-runs the auto-merge (with its own commit) before every sketch write command, `ready`, `check`, and
before each `/__design/sketches` listing (Studio), once the held paths are clean. Only dirty-guard holds retry.
Verified: CLI spec (held while dirty, merged and committed after the commit; bites without the retry call), 4 Studio
specs, lint cli + ethlete-studio, tsc/ngc. `design check --product studio`: no new problem (DROPPED-PROP 481 on
pages/sketches, canvas-frames, pages/system; CONTROL-STATE on shell-main from the UI builder's open work). `compare
pages/sketches`: only the 9 DROPPED-PROP states differ; 16 missed actions (combobox "Runde", button "Alle Zustände
zeigen") are not from this slice (not proven against the base). Not verified: a live Studio shot on :4402 (server down);
Studio retries on the next listing, not at the commit itself.

483\. `design compare components/title-bar` compared 16 states and silently skipped the 12 forced interaction states
of the rows linux-left, linux-close, windows and windows-update (UI builder ethlete-sdk-c8, A1, 2026-11-06). Cause:
`forcesOnlyUnchangedControls` / `drawnStateNamesOf` (`libs/cli/src/lib/design/system/unchanged-rows.ts`, used by
`compare-command.ts`) drop a row's interaction states when every forced element is a plain SDK component from `ng()`
without class or style. They ignore the design stylesheet: `title-bar.css` restyles
`.et-window-control-button[data-shape='caption']` (hover, focus, active), and a wrapper span gives the Windows close its
error fill. So the Windows hover and red close states are never drawn or judged, nothing says they were skipped, and
`--state windows-hover` answers "has no state". Second defect: the design invents `shape="caption"`, a value the SDK
button does not have, and `check` lets a design add attribute values or private `--_et-*` vars to an SDK component that
the app cannot reproduce without an SDK change. Why no tool caught it: the unchanged-row shortcut trusts the markup alone
and reports nothing about what it drops; no rule compares a design's selectors on SDK classes with the SDK's declared
inputs. Tool fix: (1) a forced SDK element counts as changed when a design stylesheet rule matches it or a wrapper sets
`--et-*` vars or a semantic colour on it; (2) compare prints "skipped n interaction states (unchanged SDK controls)" with
their names; (3) `check` fails a design rule that targets an SDK component class with an attribute value the SDK does
not declare. For A1 the UI builder adds a real `caption` shape to the SDK button.
**B397 as built:** (1) `forcesOnlyUnchangedControls` takes the part's own stylesheet (`sdk-selectors.ts` resolves
nested rules into compounds): a rule whose `et-` compound matches the forced element (an absent attribute counts as a
possible default) or an ancestor with `data-et-semantic-color` or an `--et-*` var in class or style keeps the row's
states drawn. Compare, accepted pictures and the system list pass the part's `.css`. (2) compare prints `skipped n
interaction states (unchanged SDK controls): ...` and `--state <skipped>` says why. (3) `SDK-ATTRIBUTE-VALUE`
(static, `check --rules`) reads the inputs, host-directive inputs and declared values of each `et-` selector from the
built `@ethlete/components` declaration file and fails a `[data-<input>='<value>']` outside them; no file means a
`missing-input` skip. Specs on fixtures (a captured d.ts excerpt), no renders. Not verified: the rule over the real
products against a built dist (the grep shows no invented value since A1 added `caption`, so no baseline). Needs a
render run in CI: the newly drawn states (title-bar windows/close rows and any part whose CSS selects its SDK
controls) have no accepted pictures yet and may show compare drift; those old hits go to the ADR 0205 baseline.

**As built (B419, 2026-11-07):** `SDK-PRIVATE-VAR` (`system/rules/sdk-private-var.ts`, static, in `check --rules`) walks
each part stylesheet of a product other than `sdk` and fails every `--_et-*` declaration, once per selector and
property, with its line. It does not look at the selector: a private variable set on an SDK component is never
reproducible by the app, a wrapper's or an own class's set included. Spec on inline CSS; not run over the real
products. By reading, it hits `title-bar.css` (`--_et-window-control-button-border-radius`, `-icon-size`) and
`canvas-viewport.css` (`--_et-focus-ring-offset`); both need a public input or token in the SDK, or the override
dropped, and stay open until then.

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

491\. Tom, 2026-11-06: "der builder der die ui themen macht hat noch immer nicht eine sache fertig bekommen. das ist alles
echt noch viel zu langsam." The UI builder had one commit, A1 (ff698951f, title bar), and A1 left eight implemented
parts uncompared (elements/canvas-frames, elements/studio-menu, pages/flows, inventory, merge, sketches, start, system);
the pre-push gate found it at Tom's "push ok". The compare run then took about 1 min per part, one harness each, and
pages/flows, inventory and merge showed 21-31 px DIFFs in every state (the new title bar inside each page). The rest of
the time went to tool investigations. Why no tool caught it: the commit check does not refuse uncompared implemented
parts, and no command compares every part a shared change affects. Tool fix: ADR 0203 (B402, `design compare
--affected`, commit check, done means compared); process fix: ADR 0202 (B403).
As built (B402): `et design compare --affected --product <p>` takes the own implemented parts whose app files moved
since their `implemented.json` record (`affectedPartsOf`), compares them in one `withHarnessUrl` run (the resident
process when it runs), checks each green part's actions on that harness and records it again; a part whose design
moved is left to `task --verify`. The refusal stays a record read, no render: IMPLEMENTATION-UNCOMPARED now points
to `compare --affected`, and `design-rules-gate.mjs` (CI and `--staged`) adds one line naming the uncompared parts.
No hook change: ADR 0036 and finding 560 keep Studio gates out of `.husky/*`, so the commit-time refusal is
`check --rules --base` in CI plus the problem on the part. "Done means compared" is step 5 of the
`studio-design-part` skill. Specs: compare-affected.spec, stale-parts.spec, design-rules-gate.spec. Not run: a real
`--affected` run (load 113-129, over the 60 limit), so the ≤ 15 s target for 8 parts is unmeasured.

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

499\. Tom, 2026-11-06 12:08: "den hat er schon seit 71m gezeichnet aber danke... du merkst selbst wie lahm wir schon
wieder sind". The sketch `components/title-bar@notice-hint` had its variants written at 10:56; at 12:07 c8 still waited
on `sketch check` (4:42 min in, in-process, while cb ran a full `design check --slow` for 14 min on the same machine),
and the doc agent told Tom it would show the sketch "once it is ready". Why no tool caught it: nothing reports how long
a drawn sketch waits before Tom sees it, the doc agent relied on the builder's "ready" message instead of the sketch
files, and two heavy design runs from two builders share the CPU with no queue. Fixes: process (doc agent) - a sketch
goes to Tom as soon as its variants are drawn, checks run behind it; tool (c0/cb, ADR 0204) - sketch check/ready go
through the resident process (S6, ≤ 10 s), which queues heavy runs of all callers instead of running them side by side,
and Studio shows a drawn sketch at once with its check state beside it.
As built, part 1 (c0, 2026-11-06): the render check of the slow check inspects up to four frames of a part at once
(`INSPECTS_AT_ONCE`, one page each, render-check.ts). Verified: render-check.spec 29/29, lint, typecheck. Not measured
yet: the slow-check time before/after - read `design timings` after the next slow check. S6 built 14c491450 (below).
As built (S6 of 492, builder c0 subagent, 2026-11-06, 14c491450): `et design sketch check` and `sketch ready` go through the resident process like compare (`runsInResident` in `resident/client.ts`, `createWarmRuns` in `resident-process.ts`), one request at a time in the same queue as compare; CI and `ETHLETE_DESIGN_RESIDENT=0` stay in-process. Every draw of both commands (render check, load, mark drift, identical, changes shot, Aktuell) uses the one warm design server and Chromium through `warm-draw.ts` (`drawingOn`, `loadingOn`, `WarmDraw` moved out of compare-command); in-process each still starts its own. Defect found: the warm design server of the resident (port 0, `watch: null`) never saw a design file edit, so since S2 a warm compare drew the part as it was at the first request; `forgetDrawn()` on the design server (system registries plus module graphs) now runs before every request. Why no tool caught it: no spec edited a file between two requests of one warm server, and the S2 warm numbers were taken with no file changed. Measured (finding 513: bench sketches only in studio-lab; the studio fixture `components/sketch-status-badge` was discarded): before, studio `components/sketch-status-badge` (drawn into pages/sketches and more) check 47.6 s and ready 41.6 s in-process, render-check 35 s of each; after, studio-lab `elements/list-row` check in-process 5.4 s, resident cold 4.9 s, warm 2.7 s; ready (full run up to SHOT-NOT-VIEWED) in-process 3.7 s, warm 1.6 s (1.1-1.4 s inside the process). Verified: `resident-process.spec` (routing, refusal, one forget per request), `warm-draw.spec` (warm server and Chromium stay open, own ones close on a throw), `sketch-stylesheets.spec` (a variant edit stays stale until `forgetDrawn`), each broken once and failed; a real warm `ready` with variant b set equal to a refused as alike, and after editing b back the next warm run did not. Not verified: a warm run of a wide studio sketch (the 35 s render check draws ~40 affected states, so <= 10 s is not shown for it); slow full checks and other in-process heavy runs still run side by side with the resident; Studio showing a sketch's check duration and what it waited on (ADR 0208) is not built.

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

509\. The pre-push design-rules gate refused the push of next with 27 IMPLEMENTATION-UNCOMPARED hits, all in studio,
but its failure line said "fails for studio-lab, sdk, studio". Why no tool caught it: no spec checks the product list
of the failure line against the products that have hits. Fix: the line names only products with problems, with a spec
that has a clean product next to a failing one. Push state: the verifies of ff698951f run for studio-menu, flows and
merge; inventory and start wait on Tom's picks and accept, no baseline (ADR 0205 covers only drift older than A1,
the gate still fails on new drift).
As built (c0, 2026-11-06): the rules summary line names the failing products (`27 problem(s) in studio.`) and
`design-rules-gate.mjs` takes its product list from that line (`failingProductsOf`). Specs with bite: a clean product
next to a failing one (gate spec), a missing product next to a failing one (check-system.spec).

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

515\. ADR 0209 could not be carried out: `design accept elements/shell-main --by builder --note "ADR 0050 ..."` printed
"Only Tom grants an accept; agents report ready instead (--by builder refused)" and still exited 0. Why no tool caught
it: ADR 0209 was decided without a tool path, and no spec asserts a non-zero exit on a refused accept. Fix (B412): an
agent `--by` is allowed only with a `--note` naming an existing accepted ADR (`ADR \d{4}`, file in apps/*/docs/adr);
the record stores `by` and `adr: [...]`; without an ADR it is refused as before; every refusal exits 1. Specs for all
three. A Tom finding is not an ADR: pages/sketches stays Tom's accept (in chat or Studio).
Tom (2026-11-06, "q1ok"): pages/sketches@edit is accepted without opening it (`--by tom`, finding 500).

As built (515, builder c0 subagent, 2026-11-06): `system/decision-refs.ts` holds one matcher (`ADR \d{4}` with a file
in `apps/*/docs/adr`, `Impl Q\d+`, `finding \d+`). `acceptStepOf` allows an agent `--by` (not tom, not designer) when
`--note` holds a ref and `accepted.json` stores `refs`. `sketch merge <part>@edit --variant X --allowed-by <ref>` picks
either live variant through the same matcher (`editRefOf` in `merge-step.ts`); non-@edit sketches and refless calls
keep the one-live-variant rule. A refused accept already returned 1 from `designAccept` in the working tree, and specs
now assert it. Specs (accept-command.spec.ts, sketch/merge-step-edit.spec.ts): agent plus ADR, agent plus Impl Q, agent
without ref or with a missing ADR (exit 1, nothing written), @edit merge with a ref, without, non-@edit still refused;
each bitten by a mutation. Verified: both tsc gates, lint, those two specs. Not verified: a real CLI process exit code
(spec calls `designAccept`), `finding n` refs, `--allowed-by` through `sketch-command.ts` (only `mergeStepOf` is
specced), nothing run against the studio product.
Built in 8ae283f82. Cause of the exit 0 (builder, 2026-11-06): no tool defect. The builder piped `accept` through
`| tail -15` and read tail's exit code; `designAccept` already returned 1. The exit-code part of 515 is closed as a
builder error. Rule: never read the exit code of a pipe; use `set -o pipefail` or `${pipestatus[1]}`. Rest of 515
(agent accept with a decision ref, @edit merge with `--allowed-by`) is built; the real refused-accept process exit
and the `sketch-command.ts` wiring are still unverified until the stale-part accepts run through them.

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

520\. Tom (2026-11-06): "wolltest du nicht auch mal pushen? vor stunden?" 158 commits of next sat unpushed for hours.
The doc agent had parked the push behind the five stale parts and those behind the 515 slice, and nobody reported the
wait to Tom. The pre-push design rules gate (design-rules-gate.mjs origin/next next) fails with
IMPLEMENTATION-UNCOMPARED on pages/inventory, merge, start, sketches and more. Why no tool caught it: nothing shows
how long a branch has been unpushed or that its push gate is red; a blocked push only shows when someone pushes.
Fix: process - a red push gate goes first in the builder queue, ahead of any feature slice; the builder runs the gate
after each slice and pushes when it is green. Tool fix (B415): `design status` (and Studio) shows the unpushed
commit count, the age of the oldest one and the gate result of the range.
As built (B415, CLI part): `design status [--json]` without a call prints the unpushed commits against the upstream
(`origin/next` without one), the age of the oldest, and the push gate result for this exact head (green, red, or unknown
when the head moved since the gate ran). `design-rules-gate.mjs` leaves the result as a receipt in the checks folder of
the temp dir. Studio UI not built: it needs a new visual element with no design - sketch needed.
Then (2026-11-07): the sketch `components/title-bar@push-state` (a chip right, b banner, c inline text) was
rebased onto the restart busy state (181b604bf, ported by hand) and readied; the three variants draw visibly different.
As built (B415, 2026-11-07): Empfehlung gebaut: variant a, a small SDK badge before Update (count and age of the oldest,
check/warning/error icon; tonal, warning theme when the gate did not run, filled error theme on red, title says fix before
any feature slice). b (full-width banner under the bar) and c (red inline text) rejected. Merged into
`components/title-bar`; the app follows: desk/B415's data path (`studio-code.mjs state` -> `push`, host passthrough,
`injectCodeWatch().push`) carried over, its left-group `et-chip` replaced by an `et-badge` in the right cluster
(`push` input `{ unpushed, age, gate }`). Landed alone earlier: the `SDK_CONTROLS` et-chip fix. Verified: title-bar,
code-watch, shell-main specs, `studio-code.spec.mjs`. Not verified: `design compare` of the push states, `cargo check`.

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

522\. Tom (2026-11-06): "wir sind noch immer nicht mit den perf themen durch?" ADR 0199 put the performance work
first, as one block, because a 44.9 s compare slows every step. The doc agent's queue then ran S6 -> 515 -> accepts ->
514/518 -> title-bar -> 511/512 -> B412 and only then S4, S7, S8, S5: feature and process slices that each came from a
fresh finding were put ahead of the open perf items. A warm studio compare still takes 47-106 s (finding 521). Why no
tool caught it: nothing checks a queue against a "comes first" ADR, and each new finding felt more urgent than the
open block. Fix: process - a finding's fix joins the queue behind an open "first" block unless it blocks the push or
Tom; the queue in a handoff names the ADR that orders it. New order: push -> B416 (with S4) -> S7 (full check in the
resident queue) -> S8 -> S5 -> then the rest. Perf is done when `design timings` shows a warm studio compare <= 10 s and
a full studio check within its target.
Cause of 521 (B416 step 1, c0, 2026-11-06): every app shot waits for the overlay panes the design markup counts
(`settled-panes.ts`, `PANE_COUNT_TIMEOUT_MS = 10_000`); pages/sketches' design counts panes the app state never opens,
so each of ~30 shots waited the full 10 s and the timeout was swallowed silently (340.8 s compare). pages/start: 0.25-0.33 s
per shot. Why no tool caught it: a wait that hits its cap logged nothing. Decided by the doc agent under ADR 0213: cap
the pane wait at ~1 s with early exit, shoot app and design states 4 at once, and every wait that hits its cap reports
a named problem ("design draws N panes, app opened M").
As built (B416 steps 1+2, c0 subagent, 2026-11-06, a1405e348): per-state sub-phases (load/settle/screenshot) logged
as they finish; pane wait capped at 1 s with early exit; design and app shots 4 at once (`createDrawQueue`).
pages/sketches 340.8 s -> 19.7/25.7 s (design 5.6-7.0, app 5.0-6.0, compare-actions 8.2-8.7 s); pages/start 2.5 s.
10 s not reached on sketches. Specs: compare-command.spec (fails at concurrency 1, order, early abort),
settled-panes.spec, part-compare.spec, 61/61. The capped wait prints a note, not a failure: `drawnPaneCountOf` counts
a pane in the sketches markup that is none (page-sketch and zoomed-page are 0 px green), so every state would turn red
for a counter bug. Why no tool caught it: the counter was never checked against a design embedding a part with a pane
mock. Agreed by the doc agent: note until the counter is fixed (spec on the sketches markup), then a failure; the fix
is perf work (each wrong count costs the 1 s cap per shot) and runs right after S4. Not in the perf block, queued:
pages/sketches differs on every state (far-out 2446 px), the same before the slice.
As built (B416 step 3 = S4, c0 subagent, 2026-11-06, 361d96eca): design and app pictures kept on disk by input hash
(`node_modules/.design-explore/...`; app key: built harness files, path+query, opened control + markup hash, prop
check, shot options, cli build, Playwright version; design key: every file drawn from). The action check reuses the
design store (compare-actions 8.5 -> 3.5-3.9 s). pages/sketches warm unchanged 8.0 s (91 hits, 0 misses; target met),
cold 21.1 s, all design pictures dropped 14.4 s, all app pictures dropped 13.6 s (over target; floor ~30 shots x 0.9 s
/ 4 + actions 3.5 s + ~3 s start); pages/start cold 2.7 s, warm 1.8 s. `design timings` counted each disk lookup of the
old store as a miss (fixed here). Verified: compare-cache.spec (6 cases, each key input mutated fails its case), cli
1144/1144, tsc, lint. Not verified: resident numbers, a real edit, Chromium binary not in the key. Before the block
closes: done-line numbers from the resident path, and a real one-part edit in a scratch copy with the finding-519
check that the next compare shows the new picture.
As built (B416 pane counter, c0 subagent, 2026-11-06, 0df8f2073): `drawnPaneCountOf` skips mocks inside `hidden`
elements (the closed studio-menu in shell-main), like `drawnSurfacesOf`; the capped wait is a failure again and a
failed state is not cached; spec on a reduced copy of the captured sketches markup. No speed: the doc agent's premise
(1 s cap per shot) was computed, not measured; the wait already ended after 0.05-0.18 s. Rule: the perf order follows
measured phases only. pages/sketches warm 6.7 s, app dropped 12.1 s, design dropped 11.9 s, both 17.8 s (resident
off). New: compare of elements/studio-menu and components/shell-project-switch hits the 30 s timeout in
compare-actions (`actions-input`, `actions-pointer-focus`). Next: compare-actions, measured in the resident path.
As built (B416 compare-actions, c0 subagent, 2026-11-06, a3a1e5c35), resident path, before c348e8af1: pages/start
1.73 -> 1.17 s; pages/sketches 7.00 -> 3.91 s (actions 2.9 -> 0.67 s); elements/studio-menu 30 s timeout -> 1.03 s
(cold 7.25 s); components/shell-project-switch timeout -> 1.01 s (cold 8.77 s). After an edit (app cache dropped):
sketches 9.38 s, start 3.89 s. Resident start ~0.65 s. Cause of the timeouts: `readRingProbe` (pointer-focus.ts) had
no timeout on an element the click removed, Playwright waited 30 s and `.catch(() => null)` swallowed it - the silent
cap again. Fix: a removed element returns null, else a 1 s cap throws `RingProbeTimeoutError` (FAILED line); per-state
action cache (`action-cache.ts`, compare only). Verified: state lines identical on four parts, pointer-focus.spec
(real Chromium, fails on HEAD), action-cache.spec, 77 tests, tsc, lint. Found: a compare killed by the client's
`timeout` keeps running in the resident and blocks the next run (breaks ADR 0213's timeout rule; fixed first in
phase 4+5); ~2.4 s on sketches outside any phase; `settle` in action-press.ts still swallows a 15 s cap; the
measuring script read a pipe's exit 0 again (515) - rule: exit and times come from `design timings`, never a shell
pipe.

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

544\. Builder (2026-11-06) asked Tom whether the design gets the "Alle Zustände zeigen" action that the app has. ADR
0010 already answers it: UI built without a design gets a sketch at once, built look as variant a, and Tom picks in
Studio. A repeated question, and a sign that the tool fix of finding 486 (a missed action fails compare and opens the
missing-state sketch) is not built: the builder still had to ask. Tool fix: build 486 with the slice of 543 (1).

Built (2026-11-06, Mac): dda42d946 harness waits for the mounted part (543 A), comment-draft pick ported, sketches
sample variant a changes only `fit`; merge `open`/`merging` and the five system comment-draft states compare ok, full
gate not yet run. ec316a94a opens sketch `pages/sketches@all-states` (ADR 0010, finding 544) with a = built look, b =
fold row at the bottom, c = count chip on the question line; waits for Tom's pick. Fact for 544: the app has one
`showAllStates` button, compare counts it twice (likely once per state); checked with 543 (1) and 486.

Built (2026-11-06, Mac): 4aef2e30f push safety. `.husky/pre-commit` runs `design-rules-gate.mjs --staged` (ADR 0011,
finding 541): 0.2 s with no staged design file, 4.3-7.6 s on a real staged part file at load 110 (< 5 s target not
confirmed). `yarn push:slice` pushes to `slice/<name>` and opens a draft PR into `next`; ci-pr.yml already runs on
every PR. Not verified: a real `yarn push:slice`, a CI run with `--base`, a partly staged file (judged by its disk copy).

B417 as built (2026-11-07, ADR 0222): 4e869796c makes `compare` print a DIFF that an open sketch's `covers` names with
the sketch id and pass it. The follow-up commit adds `et design sketch covers <layer>/<name> [<state>[@x,y,w,h]…] --by`
(no state clears the list), keeps `covers` through every other sketch write (`writeSketchFile` dropped it), validates it
on read, and adds regions: `<state>@x,y,w,h` covers a DIFF only when every differing pixel lies in one of that state's
boxes, in pixels of the state's picture (the diff PNG compare writes); a size change is never covered by a region. A
pick ends the cover. Documented in the design CLI usage and the design-exploration skill. Specs: compare-covered.spec
and `sketch covers` in sketch-command.spec. Not done: `covers` on `sketch new`, a cover scoped to one target of a
multi-target sketch (a state name covers that state on every target), a check that a covered state exists on the part,
and Studio showing the cover. `pages/sketches@all-states` has no `covers` yet.

Built (2026-11-07, b417-target): `et design sketch covers` on a sketch with several targets needs
`<layer>/<name>:<state>[@x,y,w,h]`; a bare state exits 2, a one-target sketch takes both. Covered-DIFF matching uses the
part (`covered-diffs.ts`). As built (B417, 2026-11-07): WIP d3ebf148f cherry-picked onto next without conflicts; the
`vitest` dependency it added to `libs/cli/package.json` (an nx sync from `check-system.fixtures.ts`, unrelated) was
dropped. Specs and lint green on landing (cleanup group 1). Open:
`covers` on `sketch new`, a check that a covered state exists on the part, Studio showing the cover.

545\. Builder (2026-11-06): CI "Static design rules" ran without `--base`, so IMPLEMENTATION-UNCOMPARED never ran in CI,
although finding 541 assumed it did; fixed in 4aef2e30f. Why no tool caught it: no spec or check asserts which rules a
CI step really runs, so a rule that needs an input silently does nothing. Tool fix (builder): `check --rules` prints
the rules it skipped and why, and fails in CI (`CI=true`) when a rule is skipped for a missing input. Second gap: the
pre-push design gate also refuses a `slice/*` push, so the draft-PR path of ADR 0216 is closed exactly while a push is
held for the gate. Doc agent decision (applies ADR 0216): for `slice/*` refs the pre-push hook skips only the design
gate; the draft PR's CI runs it and stays red until fixed; pushes to `next` and `main` keep the full hook.

Built (2026-11-06, Mac): a277e1c3e, the pre-push hook skips only the design gate for `refs/heads/slice/*` with a
printed line (finding 545, ADR 0216). First real `yarn push:slice`: `slice/mac-push-safety`, draft PR #3170 into
`next`, hook ran without `--no-verify`; its CI design gate is expected red until the five parts pass.

Built (2026-11-06, Mac): 41b71448d, the sketches harness renders the app TitleBar and ZoomChip per state
(DesignHarnessSketchShotsComponent); title-bar root gets `st-title-bar`, zoom-chip buttons sit in `data-camera-*`
spans, the rows container clips. Compare after: 14 title-bar states smaller DIFF, 16 narrow states FAILED, none ok.
Open code gap: the app `SketchesComponent.move` does not clamp the start camera like the design `pan()` in
sketch-rows.ts (sticky-names 76k, zoomed-page 62k px).

546\. Builder (2026-11-06), sketches compare after the frames render: (a) 16 narrow states FAIL because compare tries
to drive forced hover/active/focus states that sit inside an embedded frame as page interactions; (b) the macOS frames
differ by ~720 px because compare keeps the stand-in traffic lights of an embedded title bar's `slot('traffic-lights')`,
while macOS draws them natively; (c) a look that targets a class the app lacks (`st-title-bar`) or a
`display: contents` span draws nothing, so the part's own compare could not see the missing look hook. Why no tool
caught it: the empty frames dominated every diff and hid all three. Doc agent decisions (technical): (a) compare does
not drive forced states inside an embedded `shot`; the app harness renders them with the same forced-state hook as the
design; (b) compare masks a slot stand-in of an embedded part exactly as it masks it on the part itself; (c) compare
fails when a selector a sketch look targets has no match in the app DOM. All three in libs/cli compare (builder).

Built (2026-11-06, Mac): d30029793, the sketches camera stays inside the content through `panInsideRoom`
(canvas-math.ts) and `panRoomOf` (frame-zoom-viewport.ts); sticky-names 76k -> 480 px, zoomed-page 62k -> 1.3k. The fold
DIFF (all-unchanged, unchanged-matrix*) waits for Tom's pick on `pages/sketches@all-states`.

547\. Builder (2026-11-06): the app sketches camera did not clamp like the design `pan()`, and an app spec asserted the
unclamped camera as intended. Why no tool caught it: the design and the app each carry their own camera math, so a
spec can pin the app copy while the design copy differs, and empty frames hid the offset in compare. Rest after the
fix: a fractional camera x (-853.2) gives edge smoothing that differs per side. Doc agent decisions (technical): accept
the helper route now; the move of SketchesComponent onto the shared canvas camera is its own queued slice (one camera
code path for design and app is the real fix); snap the camera to whole pixels in the shared helper used by both, not
a compare tolerance.

Built (2026-11-06, Mac): fd9213b04 (finding 545), `checkRules` prints every skipped rule; under CI a missing-input
skip fails. Found on the way: CLASS-UNDEFINED swallowed a Tailwind compile failure and silently found nothing, against
ADR 0008 (no silent catch). Open for the builder: why the no-silent-catch check did not flag that catch (tool fix in
the lint rule), and the same RuleSkip path in the slow/full check paths with S7c.

548\. Builder (2026-11-06), draft PR #3170 CI red (ADR 0216 caught it): `yarn test:tools` 16/151 fail in
precommit-specs.spec.mjs and commit-wait.spec.mjs, because 4aef2e30f added the `--staged` gate to `.husky/pre-commit`
and these specs run the hook in a temp copy without `tools/scripts/design-rules-gate.mjs`. The agent ran only the specs
it touched. Why no tool caught it: the related-spec map does not link `.husky/*` to the specs that execute the hooks.
Tool fix (builder, decided by doc agent): the related-spec map links `.husky/*` to precommit-specs and commit-wait
specs, so `yarn commit` runs them. Same CI run: a stale `KNOWN_UNBOUND_INPUTS` entry (title-bar `part`, bound by the
sketches port) fails UNBOUND-INPUT only in CI; cause of the local miss open (builder). `--slow` also fails
components/title-bar (5 states unjudged, design 1 overlay pane, app 0) and components/update-dialog (4 unjudged), new
to the list, queued.
As built (f548): nothing left to link. d67c98f91 removed `precommit-specs.mjs` and the spec runner from the
hook; `.husky/pre-commit` is now lint-changesets + lint-css-properties, and no spec executes a `.husky/*` hook
(commit-wait.spec no longer runs one). The only related map, `libs/cli/related-map.json`, covers cli specs, so
a `.husky/*` entry has no spec to point at. `yarn test:tools`: 140/140 pass. The title-bar `part` entry is
already gone from `KNOWN_UNBOUND_INPUTS`. Local miss: the UNBOUND-INPUT check reads app templates and only ran
in CI; the sketches port changed an app template, which maps to no spec, so the stale entry was never run.

549\. Builder (2026-11-07), pages/system compare at load 157: a fixed 15 s design draw timeout skipped the whole action
check, and only one trailing line said so; the run took 473 s. Why no tool caught it: a skipped check counts as a
pass in the summary, the same class as finding 545 (a rule that silently does nothing). Doc agent decisions
(technical): retry once with a timeout scaled by the machine load, and a skipped action check counts as FAIL in the
summary. The parallel work of ADR 0219 drove the load to 110-157 on 12 cores; the builder caps parallel compare
agents so that a compare result still carries a verdict. pages/system port questions, decided by the doc agent as the
design-is-truth rule: the old Ausnahmen toggle in system-view goes, the popover is the design; system-view moves to the
page component for call and themes now; `agent` becomes a known unbound input with the reason "no progress source",
removed when a source exists.

550\. Tom (2026-11-07): "all states sketch sehe ich ncht". The ADR 0010 sketch `pages/sketches@all-states` (ec316a94a)
stayed `status: in progress`: its second `sketch check` was never run, so it was never marked ready, and a pick needs
a ready sketch. Builder and doc agent both told Tom the sketch waited for him. Why no tool caught it: opening an ADR
0010 sketch ends at "in progress", and nothing says that a sketch meant for Tom is not visible to him yet. Tool fix
(builder): `sketch new` for an ADR 0010 sketch runs `sketch check` and marks it ready in the same command, or fails
loudly; a sketch that stays in progress for more than one builder step shows as an open point on the part, with the
missing step.

Built (2026-11-07, Mac, on local next): ab26d7433 (548 CI fix; the local miss: `test:tools` runs in no hook, so the
related-map fix of 548 stays needed), eb0546d31 (546 compare: forced states in embedded slots drawn statically, slot
stand-ins masked, an unmatched look class fails by name), 1afe49a71 (547 whole-pixel `panInsideRoom`, shared with the
design `pan()`), 1d776832f (`no-silent-catch-error` gets `{ tryCatch: true }`; cause of the ADR 0008 gap: the rule only
visited RxJS `catchError`, never a `CatchClause`). Doc agent decision, applying ADR 0008: `tryCatch` is on as an error
in apps/ethlete-studio (30 sites, each gets an error value or a disable comment with a reason, as in ADR 0008) and in
libs/cli for `design/system/rules`; the rest of the repo stays off. Load reached 215 on 12 cores during these runs.

551\. Builder (2026-11-07), `sketch check pages/sketches@all-states` (850 s at load 118): ready refused because variants
b and c "first change zoomed-page" with the same pixels as a. Cause: the sketch carries its own copy of
`shared/sketch-rows.ts`, made before 1afe49a71; the base now snaps the camera, the copy does not. Why no tool caught it:
a base change after `sketch new` never reaches the sketch's shared copies, and the check blames a variant for a
difference no variant made. Doc agent decision (technical): `sketch check` compares each shared copy with the base file
it came from (hash in sketch.json) and names a stale copy with the base commit; `sketch rebase` brings unchanged copies
forward. Base problems reported the same in a/b/c (UNREACHABLE "Übernehmen" in far-out, CUT-CONTROL 64 px in
unchanged-matrix-open, 90 frames over the 24 budget) are the base part's open points and do not block the sketch.

552\. Builder (2026-11-07), `sketch ready pages/sketches@all-states` refused on base problems: the "before" render of
pages/sketches hit RENDER-TIMEOUT (120 s at load 59-118), so the tool could not subtract the base problems and counted
them as sketch problems ("has problems"). Also: SKETCH-BASE-STALE (551) printed only after the builder fixed the copy,
not in the first check, and `sketch rebase` added a hunk that was already present (duplicate import). Why no tool
caught it: a failed render is reported as a verdict, the same class as 545 and 549. Doc agent decisions (technical): a
failed before render ends ready as "no verdict - base did not render, retry", never as "has problems"; the before
render timeout scales with load (as 549); SKETCH-BASE-STALE runs in every check; rebase skips a hunk already present.

Built (2026-11-07, Mac): 0adc15c06, VS Code, tsconfig.base and eslint ignore `.claude/worktrees` and `tmp` (VS Code
used about 3 cores on the 2.1 GB of agent worktrees). 193639700, sketch `pages/sketches@all-states` ready after 338 s
at load 30; auto-merge skipped, the pick waits for Tom (all three variants change `folded`).

553\. Builder (2026-11-07), `sketch ready`: the three `design shot --variant a|b|c` calls write the same file
(studio-pages-sketches.png), each overwrites the one before, and the command itself sets the "viewed" mark, so
SHOT-NOT-VIEWED proves nothing about a view of each variant. Also the load note counts logical CPUs ("> 12 cores" on a
6-core i7-9750H). Why no tool caught it: no spec asserts distinct shot files per variant. Doc agent decisions
(technical): one shot file per variant, and ready names each file it needs viewed; load thresholds use physical cores.

Built (2026-11-07, Mac, on local next): 07b96b302 (551, the all-states sketch copy of `shared/sketch-rows.ts` rebased
onto the snapped camera), 8c07ea875 (552: a failed before render ends as no verdict, shared type in
`libs/cli/src/lib/design/system/no-verdict.ts`; load-scaled before render timeout; SKETCH-BASE-STALE checked again
after the render; rebase skips a hunk already present). Left open from 551: `sketch ready` does not run the
SKETCH-BASE-STALE check, only `sketch check` does. Doc agent decision (technical, applies 551): ready runs the same
stale check and refuses with the base commit.

554\. Builder (2026-11-07), tryCatch slice (b54d82426): the agent named its new changeset file the same as the one of
1d776832f and overwrote the eslint-plugin changeset; 74808df43 restores it. Why no tool caught it: `yarn
lint:changesets` checks only that each changed package has some changeset, not that an unreleased changeset kept its
packages. Doc agent decision (technical, applies ADR 0038, a fast check that prevents a certain loss): `yarn
lint:changesets` fails when the pushed range removes a package entry from, or deletes, a changeset file that is not in
pre.json. A rewrite of the text stays allowed.

Built (2026-11-07): 48f1be06e + a6822ece4 (554). `check-changeset-coverage.js` compares each changeset file at the
merge-base of the range with the head, not per commit. Defect in the first version: it checked per commit and failed
wrongly on the real next range (the overwrite and its restore). Why no tool caught it: no fixture had a loss fixed
inside the same range; a6822ece4 adds it. Real run on origin/next..HEAD: exit 0.

555\. Builder (2026-11-07): the 552 changeset had 65 words, over the 40-word bar (fixed in 82dc69d09). The builder
found it only by a manual run of `lint-changesets.js`. The pre-commit hook already runs that script on staged
changeset files, so the hook did not fire for this commit. Cause (builder): no git hook ran on the Mac since the
move (ADR 0217). `.husky/_` did not exist and `core.hooksPath` was unset: package.json had `"prepare": "husky"`, and
Yarn 4 does not run a root `prepare` on `yarn install`. So pre-commit and pre-push never ran there, and every "hook
passed" in an agent report on the Mac was false. Also `git cherry-pick` (how worktree commits land) skips pre-commit.
Why no tool caught it: nothing checks that the hooks are installed; a missing hook is silent. Doc agent decisions
(apply ADRs 0218 and 0221, `next` and `main` keep the full hook): install the hooks now; `"postinstall": "husky"`
replaces `prepare`; the CI Checks job, `yarn test:tools` and the start of `design check` fail when `core.hooksPath` is
not `.husky/_`; after a cherry-pick of worktree commits the builder runs `yarn lint:changesets` and the design-rules
gate on the picked range. The push of `next` stays held by ADR 0215.

Built (2026-11-07): c0f079a74 (555). `"postinstall": "husky"`; `yarn hooks:check` in the CI Checks job; `design check`
prints HOOKS NOT INSTALLED at start. Not verified: full `test:tools`, CI, a real `yarn install`.

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

560\. Doc agent (2026-11-07): Tom asked "Wieso hängen wir eigentlich schon wieder bei git hooks? Hatten wir uns nicht
dagegen entschieden?" He had: ADR 0036 (Studio checks leave the git hook, open B295), ADR 0037 (build-ready stops a
defect, CI is the backstop), ADR 0038 (pre-push keeps only fast checks; lint and typecheck CI only), all 2026-11-04.
Since then the pre-commit hook grew a design gate (4aef2e30f), a sketch-round gate and a spec/lint/tsc gate, and the doc
agent sent hook timing work (557) and a hook target question to Tom without a search of the ADRs. Why no tool caught it:
an accepted ADR with `open: B<row>` has no link to the files it governs, so a builder change to `.husky/*` or a doc
agent question about hooks meets no warning. Tool fix (technical): ADR frontmatter gets `governs: <globs>`; a fast check
lists each open or accepted ADR whose globs match the staged files, and the builder and the doc agent read that list
before they change or ask. Process fix: the doc agent searches the ADRs before it sends work, not only before a grill
question. Applied at once: the slow pre-commit checks leave the hook; finding 541 becomes a problem on the part.
As built (ee935173c): ADRs 0036-0038 carry `governs: [...]`; `yarn adr:governs <files|--staged|a..b>` (tools/scripts/adr-governs.mjs) lists the accepted ADRs whose globs match; not wired to a hook.

560 rest as built (f560-rest): `governs:` globs now also on ADR 0033, 0216, 0221, 0224 (`.husky/pre-push`; 0216 also `.github/workflows/*`), 0039 (`.husky/pre-commit`) and 0197 (`.github/workflows/*`); 0222 skipped (it decides gate rules, not the files). The builder-agent and doc-agent skills run `yarn adr:governs <files>` before a slice changes files and before a decision on files.

561\. Doc agent (2026-11-07): the builder hit 85% context and could not restart itself: the auto-mode classifier denied
`agent-sessions.mjs restart` ("Tmux Self Drive"), so the 559 fix never gets a chance to run. The doc agent then typed
`/clear` into the pane while the builder still finished a turn ("Waiting for 2 background agents" looked idle); the
clear queued and ran at the end of the turn, which worked by luck. Why no tool caught it: no allow rule names the
restart command, and the restart skill does not say what to do on a denial; the pane state has no clear idle marker for
a turn that waits on background agents. Tool fix (technical): `restart` and the doc agent treat a pane as idle only
when the footer shows no "esc to interrupt" and no "Waiting for"; on a denied self-restart the builder sends one mailbox
line to the doc agent, which drives the pane. Tom: "Natürlich darf er das. Der Skill gilt für jeden." The allow
rule for `agent-sessions.mjs restart *` goes into the checked-in `.claude/settings.json`; auto mode refuses an agent edit
of the settings, so Tom adds it.
As built: `busyLine` in `libs/agent-rules/content/skills/agent-sessions/agent-sessions.mjs` (the only idle check, used by `restart`) now matches "esc to interrupt" or "Waiting for"; spec added. The denied self-restart cannot be caught in the script (the classifier blocks the command before it runs), so SKILL.md tells the builder to send one mailbox line to the grill session, which drives the pane when idle. Skill copies regenerated with `yarn agents:sync`; changeset `agent-sessions-idle-waiting`.

S7c-1 as built (c0 subagent, 2026-11-07, in the `perf(cli)` commit that adds this note): auto-accept keeps the state
pictures of each part drawn at a part hash under `node_modules/.design-explore/part-pictures` (`part-picture-cache.ts`;
key: design picture code, product, part, part hash; read only while every other file of its design hash is unchanged).
A direct edit and an open undecided `<part>.edit` sketch compare with the cached `old` at the merged hash: no
`refreshEditOld`, no old draw, and a rerun on an unchanged tree draws nothing and leaves `git status` and the sketch
as they were (spec bites on the old code). An edit sketch is still opened once when an edit draws differently (it holds
Tom's pick). 539: render inspect keyed on 202 cli modules because render-check -> list-system -> check-system pulled in
the whole check; `gridReportOf` moved to `grid-report.ts`, render inspect is now 64 modules, completeness 51, and a spec
asserts that check-system, list-system, accepted-pictures, slow-run and design-command are outside both. 553: every
load threshold (`timings` load line, `isNoisy`, `loadScaledMs`) uses `physicalCoresOf()` (sysctl hw.physicalcpu, lscpu,
else half the logical CPUs; 6 on this Mac). `design shot --variant a` writes `<product>-<part>-a.png`, and
SHOT-NOT-VIEWED names that file. Not verified: no real check numbers (load 13-27 on 6 cores the whole session, no
verdict) and no scratch-worktree edit run; pre-existing: 3 auto-merge specs in sketch-command.spec fail on `next` too.

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
565\. Builder (2026-11-07): `ethlete-studio:build` failed with TS2322 at the `[themeSwitches]` binding (`current` is `string | undefined`, `ThemeSwitch.current` is `string`) and it sat on `next`. Why no tool caught it: plain `tsc` does not check templates, and `ethlete-studio` had no `typecheck` target, so CI's `run-many -t typecheck` skipped it; only the post-push `build` job saw it. Tool fix (technical): an `ethlete-studio:typecheck` target running `ngc --noEmit`, picked up by that CI step.

565 as built (2026-11-07): `themeSwitches` drops a switch whose `current` is undefined (`flatMap` narrows it). Added `ethlete-studio:typecheck` (`ngc -p apps/ethlete-studio/tsconfig.app.json --noEmit`). Verified: `ngc` reproduced the error on `next`; `tsc` printed none. Not verified: pre-push still skips it.

565 as built (2026-11-07): `git push origin next` exited 141 after a green pre-push hook (VitePress "build complete in
484s", no check failed). Cause: git opens the SSH connection to GitHub before it runs the hook, the ~8 min docs build
leaves it idle, GitHub drops it, and git dies of SIGPIPE writing the pack. Why no spec caught it: the hook had no spec,
and no spec can hold an idle connection for minutes; the failure sits between git and the remote, not in the script.
Fix: the hook stamps the pushed sha in the git dir after a green docs build and skips the build for the same sha, so
the retry is fast (new `tools/scripts/pre-push.spec.mjs`). The tsconfig-paths noise was `vite-tsconfig-paths` scanning
`.claude/worktrees/*`; `apps/docs/.vitepress/config.mts` now names `tsconfig.base.json` as its only project. Not done:
an `ServerAliveInterval` for github.com in `~/.ssh/config` (the sandbox denied editing it); the first push of a docs
change still waits ~8 min and may still drop.

As built (B369, 2026-11-07), ADR 0188: `commitMergeResult` (`libs/cli/src/lib/design/system/sketch/merge-commit.ts`) commits what a merge wrote into the product folders, one commit `feat(repo): Merge <target> variant <v> into <product>` per merge, from `mergeAndRecord` (CLI, go-batch) and `sketchMergeAnswer` (Studio). It snapshots the dirty files with content hashes before the merge and commits only files that are new or changed after it, never another open sketch; a failed commit warns and leaves the files. `merge-commit.spec.ts` merges two sketches in a row in a git checkout (two commits, a stray edit stays uncommitted, tree clean) and bites without the call. Not verified: the Studio route by e2e; a file already dirty before the merge that the merge also writes (merged.json) is committed with the user's edit.

566\. Agents (2026-11-07): worktree commits ran the main checkout's hooks through an absolute `core.hooksPath`; an older
worktree lacked the scripts they call, and agents fell back to `--no-verify`. As built: `postinstall` sets the relative
`core.hooksPath=.husky` (tracked scripts, so each worktree runs its own), the hooks `cd` to `--show-toplevel`,
`check-hooks-installed` rejects an absolute path, and `lint:no-verify-briefs` (pre-push) fails a brief that tells agents to
skip hooks. Apply once in the main checkout: `git config core.hooksPath .husky`.
As built (B112): the report was already there (`CANONICAL-CLASS` in `design check` and `--app-classes`, from
Tailwind's own `canonicalizeCandidates`). Added `design check --product <name> --app-classes --fix`: rewrites
each flagged class in the app source and the product's parts, whole tokens only. Spec case added. Not built:
an ESLint rule for the app config (no Tailwind v4 canonical-class lint rule is available).

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

577\. Builder (2026-11-07, CI run 42402108781): all 50 serve.spec tests passed, but the afterAll in
`libs/cli/vitest.setup.ts` timed out after 10 s: serve.spec left about 300 MB of temp targets and `rmSync` took 8.4 s
on the Mac. Fixed in 282591127 (each test removes its own target in afterEach). No check caught a spec that leaves a
large temp tree. Tool fix (technical): `vitest.setup` warns when the spec tmpdir of one file passes 50 MB.

578\. Tom (2026-11-07): "was hier mit den 235 non pushed auf next?" Local `next` had no unpushed commits; its upstream
was still `origin/studio-mac-move` from the Mac move (ADR 0217), so the title bar counted 235. The doc agent set the
upstream back to `origin/next`. Tool fix (technical): the unpushed badge (B415) counts against `origin/<branch>`, and
`design status` warns when the upstream of a branch has another name.

579\. Builder (2026-11-07): two docs-only pushes of the doc agent (plans files) cancelled the running CI (Next) runs
42405979630 and 42408713788, so the CI fix waited for a third run. Tool fix (technical): CI (Next) skips a push that
changes only `plans/` and ADR files (`paths-ignore`), so it does not cancel a run in progress.

580\. Builder (2026-11-07, B426): `elements/canvas-frames` named an old `implements` component that the app no longer
renders at the part's slot; it only looked live through the system-page fallback and an inbox import. No rule checks
that the `implements` component is what the app renders there. Tool fix (technical): the page harness records the
host it renders at each part slot, and a check flags an `implements` file whose host never appears.

581\. Builder (2026-11-07, B426): the base clone of the visible-change check broke twice ("reference is not a tree",
missing alternates). Tool fix (technical): `baseCheckoutOf` fetches or clones again after a failed checkout.

582\. Builder (2026-11-07, B426): the `implements` fix in 13107a3b1 made `elements/canvas-frames` stale and opened an
"old or new" edit point, because `designHashOf` hashes the whole part file. Tom decided on 2026-11-01 that a link-only
change does not count (ADR 0113, carried over when ADR 0048 replaced the Go); the hash never followed it, and the
builder asked again. Tool fix (technical): `designHashOf` leaves the `implements` field out, with a spec that a
link-only change keeps the hash. Until it lands, the builder accepts the part once with ADR 0113 in the note (ADR 0209).

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

587\. Tom (2026-11-07, 23:20): "wie viele jahre dauert das hier bitte noch bis so ein absololut simpler task wie die
ci grün machen done ist???" CI was green at dfe6d7079 (20:01); the B426 commits pushed with f962d8b45 broke Studio
e2e, and the builder then built findings 580-585 while a subagent hunted the cause for 40+ minutes. Nothing stopped
feature work on a red next. Tool fix (technical): the builder skill says a red CI (Next) blocks every feature slice,
and a cause not proven within 15 minutes means revert the suspect commit first; `design status` (B415 badge) shows
"CI rot" and the builder start refuses a feature slice while it is red.

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

591\. The human (2026-11-08): "ci ist durch und grün aber 25m für studio e2e ist echt too much". Run 42421444909: the
`yarn studio:e2e` step took 24 min on 1 worker, 97/132 passed; the 35 hidden B434 failures each wait for a long timeout
(90 s "not settled", 30 s clicks, 15 s waits). Parallel cases (B377) were parked behind B376 (ADR 0191), and no budget
caps the suite time. Tool fix (technical): B377 moves up; the suite runs on all runner cores, a case fails at its first
missed wait within 10 s, and the run prints its time against a 5 min budget that fails above it once B434 is green.

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

596\. Builder (2026-11-08, run 42431195355): two cli unit specs with wall-clock stall budgets failed under CI load
without a code change: `serve.spec.ts:954` (two hundred sketches, no block over 50 ms, got 51.2 ms) and
`merge.spec.ts:151` (no stall over 250 ms, got 525 ms); run 42421444909 passed them. A plain time bound in a unit spec
measures the runner load, not the code, and a red Verified job skips Deploy and hides the e2e signal. Tool fix
(technical): the stall specs measure with `monitorEventLoopDelay` percentiles or a bound relative to a calibration run,
never a raised constant; a lint rule flags `performance.now()` differences compared to a literal in a spec.

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

607\. Builder (2026-11-08): the merge stall spec still failed on Linux (210 ms, 353 ms) after finding 599. Docker
profiles: a V8 memory-reducer major GC on the server thread (15-273 ms), triggered by the start of the jiti merge
worker that only the spec does (no-op merge 0/10, idle worker 1/5, real merge 6/15). A second source (322 ms CPU in an
847 ms span) did not reproduce. The doc agent decided: `--no-memory-reducer` for this spec, CPU time and threshold
unchanged; no GC subtraction, no wall-clock. Tool fix (technical): a stall spec prints the GC trace of a failed span,
so the next failure names its source without a docker session.

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

614\. Builder (2026-11-09, B440): the e2e runner overwrites its log when a run starts, so a watcher that greps the log
for "exit" can read the end of the previous run. Tool fix (technical): each run writes a new log file.

615\. Builder (2026-11-09, B440): `tsc -p` on the Studio `tsconfig.spec.json` fails in `shot-state.spec.ts`
(`failedShots` possibly null) since 38d421711. vitest does not typecheck, so the specs stayed green. Cause: the
`typecheck` target of `ethlete-studio` and `timetrack-app` checked only `tsconfig.app.json`, so no gate typechecked
their specs. Fix (d536fee67): both targets also run `tsc -p tsconfig.spec.json`. Tool fix (general):
`yarn lint:spec-typecheck` in pre-push refuses a project whose `typecheck` target does not name its
`tsconfig.spec.json`.

616\. Builder (2026-11-09, B441): a first run of `render-missing-dist.perf` failed in its `beforeAll`, and
`spec:stress` showed no error output for the failed run, so the cause stayed a guess. Tool fix (technical):
`spec:stress` prints the output of the first failed run.

617\. Builder (2026-11-09, B441): the `render-missing-dist` specs listen on a random port that can clash with a port in
use, the suspected cause of finding 616 and of the old unit flake. Tool fix (technical): the specs listen on port 0.
Decided by the grill session under ADR 0230: wait bounds that only tell "answers at once" from "waits for a timeout"
stay in the unit run; one moves to the perf job when it flakes.

618\. Builder (2026-11-09, B447, 90ef0eeb8): Large "a sketch scroll never empties a cell" printed `(iframe: null)`.
Cause (proven): `sketchCells` listed all cells and then probed each frame by position, so a frame removed in between
gave a null probe and the cell counted as empty. Why the frame left in CI is not proven (likely the cap of 6 live
frames against 8 visible cells); the detail now prints "frames gone before their probe". The tool did not catch it
because nothing tests the e2e probe helpers and the race never happened locally. Tool fix: a spec for the probe helpers
with a forced-race fixture page for each outcome.

619\. Builder (2026-11-09, B446, c3e136ae2): Sketches "wheel and ctrl-wheel over a frame centre" failed with "no iframe
frame". Cause: the case sampled the frames once after setup, but a sketch mounts its iframes only after the listing
arrives; in CI it was the first case of a shard on a cold server (slow listing not proven, the log has no listing
timings). Locally the listing always arrives inside the 2.5 s settle. Tool fix: an e2e mode `--hold-listings <ms>` that
delays design-server listings, so a case that samples once fails locally.

620\. Builder (2026-11-09, B445, c88cf6ebd): Merge "the sketch view stays open after the sketch dropped from the
listing" timed out. Cause (server bug): a request joins a running listing, and `serve.ts` detached running listings on a
part change but not on a sketch file change, so a request after the merge could get the deleted sketch back. Fix:
`signalLists` detaches running listings first. That CI took this path is not proven; it is the only stale path found.
The specs covered the join in studio-api but not the serve trigger on a sketch file change. Tool fix: a serve spec that
runs every watcher event kind against a gated listing and asserts a fresh answer.

621\. Builder (2026-11-09, B448, 49b3c969f): the full batch run before the push failed Large "a sketch keeps its frame
count and pictures from the first paint through a sketch edit" (2 frames at the first paint, 30 once settled), 1 of 2
runs alone. The B445 fix was not the cause (6 runs each with and without it). Cause: after a reload the `targets=no`
listing draws 30 pending cells, and the quick listing folds them to 2 about 270 ms later; the case sampled at a random
moment in that window, so it passed on the jumpy 30 and failed on the correct 2. The case is split, and the new case
"first paints the frame count it settles on" stays open under B345 (finding 425). The tool did not catch it because the
B445 slice ran only the Merge case, 2bb8d3d58 changed the fixtures without a re-run of this case, and one run of a
racy sample can pass. Tool fix: a commit that touches the e2e fixtures, `serve.ts` or `studio-api.ts` makes
`studio:e2e:bite` run each case of the affected page group 3 times and blocks when a result changes. The batch gate
caught it before the push.

622\. Builder (2026-11-08, B449): Unit "shows no other part while the remembered sketch is still being listed" timed
out at 5106 ms in CI run 42479812031. Cause: it is the first case of `system-view.component.spec.ts`, so it carried the
cold JIT compile of the whole System view tree inside `TestBed.createComponent` (232 of 292 ms locally; `whenStable()`
and the `settle` loop cost under 10 ms, and no stub fetch holds a pending task). CI ran the file about 13 times slower
(second case 1003 ms against 75 ms locally), which puts the compile near 5 s. A file-level `beforeAll` with a 30 s
budget now compiles the tree once; with `--testTimeout=150` the case times out without it and passes in 24 ms with
it. B442 (`shell-logo.spec.ts:140`) is not the same cause: it is an assertion (`closed: false` on Flows), not a
timeout. The tool did not catch it because `spec:stress --load 2` stays far below the CI factor (4/4 passed with and
without the fix), and nothing reports a case that runs close to its timeout. Tool fix: the vitest reporter of the Studio
unit run fails a case that uses more than half of its timeout, so a first case that holds a cold compile shows up
locally before it turns red in CI.
