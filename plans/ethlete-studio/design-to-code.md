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
    with slots `[shellMainStudio]`, `[shellMainSide]` and the canvas; rail buttons are `et-button`s, the picker the SDK
    `etMenu`. Compare now forces each `data-et-force` element, found in the app by its `aria-label`. Compare
    `elements/shell-main` 14 of 15 states 0 px (`project-picker` off by the font token, fixed in Impl Q12-Q14);
    `pages/inbox` 0 px in all 7. Not verified: the real Studio on :4402.
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
417 closed (Linux builder, 2026-11-13, B499 S6): guard e2e case "a sketch opens with one /__design/system request until its first cell".

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

435 -> archive/findings-2026-11.md, backlog STATUS.md Werkzeug-Rückstand

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

441\. B367b (3c67d2143, builder 2026-11-04): the two new e2e cases "Merge" and "Discard" pass, but they also pass on the
old view code, so they do not bite. Only the new vitest spec fails without the fix. Cause: part a (e459da21e, CLI) already
stops the overlay, and the e2e always runs the current CLI. Why no tool caught it: the bite rule covers specs, and the e2e
harness has no way to run a case against an old build. Tool fix (B378, builder default): for a bite run the harness takes
`STUDIO_CLI_ENTRY` from a CLI copy built before the fix, so a new e2e case must fail there first.
As built (B378): `yarn studio:e2e:bite <ref-before-the-fix> [--case Name]` (`tools/scripts/studio-e2e-bite.mjs`) builds the CLI of that ref in a temporary git worktree, runs `canvas.e2e.mjs` with `STUDIO_CLI_ENTRY` pointing at it, and exits 0 only if the e2e fails (the case bites). `canvas.e2e.mjs` and the headless harness already read `STUDIO_CLI_ENTRY`. Only the arg parsing and verdict are specced; the build and e2e run were not executed (load).

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

479 -> archive/findings-2026-11.md, backlog STATUS.md Werkzeug-Rückstand

481 -> archive/findings-2026-11.md, backlog STATUS.md Werkzeug-Rückstand

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

486 -> archive/findings-2026-11.md, backlog STATUS.md Werkzeug-Rückstand

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

495 -> archive/findings-2026-11.md, backlog STATUS.md Werkzeug-Rückstand

496 -> archive/findings-2026-11.md, backlog STATUS.md Werkzeug-Rückstand

497 -> archive/findings-2026-11.md, backlog STATUS.md Werkzeug-Rückstand

500 -> archive/findings-2026-11.md, backlog STATUS.md Werkzeug-Rückstand

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

519\. Found by the builder while building S6 (2026-11-06): since S2 (10fbd3261) a warm `compare` drew design files as
they were at the resident's first request; the warm Vite design server runs with `watch: null` and never forgot a
drawn module. Every warm compare after an edit compared a stale design against the app. Why no tool caught it: no
spec edited a file between two requests of one warm server, and the S2 warm numbers were taken with no file changed,
so "fast" was measured but "fresh" never was. Fix (14c491450): `forgetDrawn()` before every request, spec in
sketch-stylesheets.spec (a variant edit stays stale until forget). Tool fix (B414): a resident end-to-end spec that
starts the real resident, runs `compare`, edits the part, runs `compare` again and fails if the second run shows the
old picture. Rule for every warm or cached path: its spec includes an edit between two runs.
519 closed (Linux builder, 2026-11-13, B499 S6): guard `serve-host.spec.ts` "forgets what the serve drew before a hosted run" and `resident-process.spec.ts` "forgets what its warm design server drew before each request".

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

533 -> archive/findings-2026-11.md, backlog STATUS.md Werkzeug-Rückstand

535 -> archive/findings-2026-11.md, backlog STATUS.md Werkzeug-Rückstand

542 -> archive/findings-2026-11.md, backlog STATUS.md Werkzeug-Rückstand

543 -> archive/findings-2026-11.md, backlog STATUS.md Werkzeug-Rückstand

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

558\. Builder (2026-11-07): 3 auto-merge specs in `sketch-command.spec` fail on `next` without any change. Why no tool
caught it: the pre-commit and pre-push hooks never ran on the Mac (555), and `next` is not pushed (ADR 0215), so CI
never ran these commits. Doc agent decision (technical): the next builder fixes the 3 specs first; the run over the
whole unpushed range (555 decision) includes the full cli and Studio spec suites at low load.

562\. Doc agent (2026-11-07): Tom, twice in one morning: "Wir warten hier schon wieder rum. Warten ist keine Option".
The builder ended its turn with "Waiting for 1 background agent to finish" and 83 unpushed commits, and the doc agent
reported "the push follows when the agents land" instead of starting more work. Why no tool caught it: the
builder-agent and doc-agent skills allow a turn to end on a wait; nothing flags an idle pane with a non-empty queue.
Tool fix (technical): both skills say a turn ends only with agents running on every independent open item, and a push
never waits for an unrelated agent; the doc agent's periodic check reads the builder footer and sends a nudge when it
shows "Waiting for" while STATUS.md has open builder rows.

563\. Doc agent (2026-11-07): an agent appended to a size-budgeted plan file and committed; only pre-push saw the size and
format, 300 commits later. Tool fix (technical): a staged-file size and format check in pre-commit.

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
Lesson: a decision that names a ratchet ("may only shrink") gets a spec for its second use, not only its first. Built in 994dd8bea.

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
598 closed (Linux builder, 2026-11-13, B499 S6): guard `unchanged-states.spec.ts` "keeps the pixel compare across a change to another part, and drops it for a change to its own".

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

628 -> archive/findings-2026-11.md, backlog STATUS.md Werkzeug-Rückstand

629 -> archive/findings-2026-11.md, backlog STATUS.md Werkzeug-Rückstand

630 -> archive/findings-2026-11.md, backlog STATUS.md Werkzeug-Rückstand

631 -> archive/findings-2026-11.md, backlog STATUS.md Werkzeug-Rückstand

632 -> archive/findings-2026-11.md, backlog STATUS.md Werkzeug-Rückstand

633 -> archive/findings-2026-11.md, backlog STATUS.md Werkzeug-Rückstand

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

638 -> archive/findings-2026-11.md, backlog STATUS.md Werkzeug-Rückstand

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
640 closed (Linux builder, 2026-11-13, B499 S6): guard `run-deadline.spec.ts` (shot and check end with a log after their deadline).

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

649 -> archive/findings-2026-11.md, backlog STATUS.md Werkzeug-Rückstand

650 -> archive/findings-2026-11.md, backlog STATUS.md Werkzeug-Rückstand

651\. Builder (2026-11-09, 647 bite proof): the committed `--delay-pictures` mode (2b0227f8e) also delays the
canvas's first frame, so every single-case run with it times out in `warmUp` (`canvas.e2e.mjs`, "Timeout 60000ms
exceeded") and the scroll case shows NOT RUN. The handoff said "with the fix and a 60 s delay the scroll case passes
3/3"; that run came from the scratch harness in `/tmp/s647` (gone), where `warmUp` was not delayed. Why no tool caught
it: a "verified" line in a handoff or a report does not name the commit and the command it ran on, so a result from a
scratch copy reads like a result on the committed code. Tool fix (backlog): every "Verified:" line names the sha and
the exact command; a result from a scratch or export tree says so. Fix now (doc agent decision, ADR 0238 scope): the
delay route turns on only after `warmUp`; one more bite proof; if it again gives no result, push without it and the
proof moves to the tool backlog.

652 -> archive/findings-2026-11.md, backlog STATUS.md Werkzeug-Rückstand

653 -> archive/findings-2026-11.md, backlog STATUS.md Werkzeug-Rückstand

654 -> archive/findings-2026-11.md, backlog STATUS.md Werkzeug-Rückstand

655 -> archive/findings-2026-11.md, backlog STATUS.md Werkzeug-Rückstand

657\. Builder (2026-11-09, Mac night, 6cafe2129): the hold run masks a short picture delay. With the `liveShotsOf`
fix reverted, hold 14000 plus delay 3000/6000/15000 all pass 2/2; hold 0 plus 15000 fails 2/2; hold 14000 plus 20000
fails 2/2, plus 30000 1/2, plus 60000 2/2. Pictures asked for during the hold arrive before the scroll back. So the
delay must be longer than the hold; the gate uses 60000. Every fail is the 647 empty cell, not the probe race. With the
fix: 2/2 pass at 6000 and 60000. Command: `node apps/ethlete-studio/e2e/canvas.e2e.mjs --case 'a sketch scroll never
empties a cell that had a picture' --hold-listings <h> --delay-pictures <ms>` on 1b17d73f3. Why no tool caught it:
two fault injections in one run had no check that each one still bites; only the hand sweep showed it. Tool fix
(in 6cafe2129 for this pair): the gate spec asserts delay > hold. Open: the 646 hold bite with the delay on, and the
extra time of run 3 (measured in the idle runs).

659 -> archive/findings-2026-11.md, backlog STATUS.md Werkzeug-Rückstand

661 -> archive/findings-2026-11.md, backlog STATUS.md Werkzeug-Rückstand

664 -> archive/findings-2026-11.md, backlog STATUS.md Werkzeug-Rückstand

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

713\. Builder (2026-11-10, day shift, B249 app slice): the push of 27e923d8b failed; pre-push `lint:studio-label-specs`
found that `system-view.component.spec.ts:1488` asserts the removed label "Go geben" (`not.toContain`). Fix: the line
is gone; the spec already asserts that no `ethlete-part-approval` exists (47/47). Cause: the label-spec lint runs only
in pre-push, and a slice subagent never runs pre-push, so the slice commit passed. Tool fix (builder default, tool
backlog): pre-commit runs `lint:studio-label-specs` on staged spec files under `apps/ethlete-studio` (sub-second);
bite: a staged spec that names a label the app no longer has is refused at commit.

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

753 -> archive/findings-2026-11.md, backlog STATUS.md Werkzeug-Rückstand

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

759 -> archive/findings-2026-11.md, backlog STATUS.md Werkzeug-Rückstand

760 -> archive/findings-2026-11.md, backlog STATUS.md Werkzeug-Rückstand

761 -> archive/findings-2026-11.md, backlog STATUS.md Werkzeug-Rückstand

762 -> archive/findings-2026-11.md, backlog STATUS.md Werkzeug-Rückstand

763 -> archive/findings-2026-11.md, backlog STATUS.md Werkzeug-Rückstand

765\. Mac builder (2026-11-10, night): `/e2e` shows "No active run log" in the push:suite `repeat` step. Cause: only the
`e2e` step writes a live log. Lesson: every long step writes one. Fix d06bd6f34 (Mac).

766\. Doc agent (2026-11-10, 23:33): a mailbox `send` to the Linux builder made the dispatcher type into its pane (history
line recalled). Suspect: `panelFocused` knows only `❯ ⏺` rows, this build draws `● main`.
Tool fix (night, Linux): `send` refuses a SendMessage peer; panel regexes from a real pane.

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

B490 rest as built (Linux builder, 2026-11-11, 210235327): the Studio app build ships the design's `@assets`.
`ethlete-studio:build` copies `.ethlete/design/studio/assets` to `@assets/` in the output and marks `@assets` as an
external dependency, so `url('@assets/fonts/...')` stays relative to the emitted stylesheet and loads the copied file. The
recipe holds for any app that imports a product's design CSS: one asset glob from `.ethlete/design/<product>/assets` and
`externalDependencies: ["@assets"]`. The build inputs now name the foundations CSS and the assets instead of the removed
`tokens.css`, so a change there no longer hits a stale Nx cache. Verified on Linux: `build:production` passes; the built
CSS holds `url(@assets/fonts/noto-sans-...woff2)`, the copies equal the design files byte for byte; the built app served
statically loads `/@assets/fonts/noto-sans-latin-wght-normal.woff2` and renders the start view in Noto Sans (shot in
`.claude/handoffs/agent-results/b490-studio-linux-noto.png`); the 855-blocked e2e case passes normally (23 s) and with
`--hold-listings 14000` (135 s); `design check --product studio --part foundations/type` 0 findings. The `ty-specimen`
classes are not in `type.css`: they sit in the `styles` of `type.ts`, the foundation's own sheet, and never reach the app,
so they stay. Not verified: Noto Sans Mono in the app (the start view shows no code text), the Mac shots (Mac builder).

815\. Linux builder (2026-11-11, B490 font-pair sketch 523abcb77): `type.ts` imports `type.css?inline` for `tokenSheet`,
and the inline copy keeps `url('@assets/...')` unresolved, so each family gets a second `@font-face` that never loads and
`document.fonts.check` is false; the drawing renders right only because the resolved rule comes later. Cause (measured).
Why no tool caught it: no gate checks that an `@font-face` in a drawing loads. Tool fix (doc agent, tool internal):
resolve `@assets` URLs in `?inline` CSS in the design frame build, and a check that every `@font-face` of a part reaches
status `loaded` (fails the part otherwise). Bite: the check fails on 523abcb77 without the URL fix.

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
821 as built (Linux builder, 2026-11-11, 16f091042): Cause (spec `status-stale-base.spec.ts`, fixture product): with
a product part changed after an open and a ready sketch were drawn, `design status` printed no stale line; the inbox
already listed both as `needs rebase`. Fix: `staleSketchBasesOf` moved to `sketch/stale-base.ts` (one source for
SKETCH-BASE-STALE, check and status); `design status` prints one `SKETCH-BASE-STALE <product> <part>: ... sketch rebase
<ref>` line per open or ready sketch, `--stale` prints only those, without git or `gh`. `.husky/post-merge` runs
`tools/scripts/post-merge-stale-sketches.mjs`: `status --stale` from the built CLI copy, 0.46 s, always exit 0; when the
head's CLI copy is not built it prints a hint to run `yarn et:design status` and builds nothing (`ensureCliCopy` with
`build: null`). Verified: both specs red without the fix, green with it; live status names
`components/button@off-centre`. Not verified: the hook fired by a real `git merge`.

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
826 closed (Linux builder, 2026-11-13): not reproduced after R2.1-R2.3 (ba4321e8c 949e944ba 2ebc71d48). The
font-pair sketch was merged (aaeef909d), so the same command ran on the open tokens sketch: `et:design shot
foundations/colors --variants --in pages/sketches --product studio` 5/5 exit 0, no pixel change. Not verified on the
original sketch.
B498 as built (Linux builder, 2026-11-13): R2.1-R2.3 ba4321e8c 949e944ba 2ebc71d48; R3 bites on 597/603 (4c1a4b820)
and on a cell that leaves the DOM (b05693b31, 82497ff2c: a state in a crop group counts as shown); R3 green 2/2 and
under `--load 24` 2/2. The 32->4 cells after an edit is crop grouping by design (cropGroupsOf), not a defect. Fonts
suspect parked by the doc agent (CI 153.9 s after 436e3064d).
B499 S1 as built (Linux builder, 2026-11-13): Cause (probe): the Studio e2e checkout (`prepareCheckout` in
`canvas.e2e.mjs`) links every top-level entry of the main checkout, `libs` and `dist` included, and Nx does not find
projects through a linked `libs` (in such a copy `nx show projects` lists none, `nx show project types` says "Could not
find project types"), so the stale rebuild with `cwd: target` failed for a lib the main checkout's source had made
stale. Fix: `rebuildStaleDist` runs `nx build` in the Nx workspace that owns the real path of the build folder (nearest
`nx.json` above it, else the target). Running in the owner is right for both: a real checkout owns its `dist`, and in
the e2e copy the linked `dist` and `libs` are the main checkout's, so skipping them would draw from an old build. The
build stays `spawnSync`: async breaks `shot-stale-dist.spec.ts`, which mocks `spawnSync` and lies outside the slice
paths; S2 or a later slice takes it. Bite: a stale-dist spec with a linked checkout, red on HEAD (nx cwd was the linked
copy), green after. Verified: cases 128 and 129 green after touching `libs/types/src/index.ts`, `dist/libs/types` was
rebuilt during the run. Not verified: a full `yarn studio:e2e` run, CI.
B499 S2 as built (Linux builder, 2026-11-13): `design serve` hosts the resident (`hostResidentInServe` in
`libs/cli/src/lib/design/resident/resident-process.ts`): under the start lock it stops a standalone resident of the
checkout and writes the discovery file with `owner: "serve"`; compare, check and sketch runs draw with the serve's design
server, and serve's thumbnails, inventory, shots, app shots and the hosted runs share one Chromium
(`shared-chromium.ts`, a lease per draw queue). The client never stops a serve-owned process: `et design stop` says it
ends with the server, and another CLI build or a serve that does not answer runs in-process. A second serve leaves the
resident to the first; when the serve exits, the discovery file goes and the next call starts a standalone resident.
Flag `ETHLETE_DESIGN_SHARED_SERVE`: on locally, off in CI and with `ETHLETE_DESIGN_RESIDENT=0`; `0` turns it off, `1`
turns it on in CI (a CI call then uses a serve-hosted resident but never starts one). The flag goes after P5: Studio e2e
on CI green twice with `ETHLETE_DESIGN_SHARED_SERVE=1`. Bite: `resident/serve-host.spec.ts`, 5 of 7 red with the
serve-owner checks and the shared server taken out, 7 green after; `shared-chromium.spec.ts`; spec:stress 4/4. Measured
in a scratch copy (scratch marker moved aside, slow checks off), serve up, then sketch check
`components/command-palette`, `shot components/zoom-chip --state out`, compare `components/zoom-chip`, GET
/__design/shot on the serve: flag off 2 design processes and 2 Chrome roots, flag on 1 and 1. Reverse: a running
standalone resident was stopped by a starting serve (1 process); after the serve exited the next compare started a
standalone one. Not verified: Studio's own serve (`ETHLETE_DESIGN_EXIT_ON_STDIN_CLOSE`) with a CLI build other than the
agents' (calls then run in-process), the reload path after a CLI rebuild, CI, the Studio e2e. Suspect: a run in the
serve also captures the serve's own log lines while it runs, and a design config change no longer restarts the design
server for hosted runs (serve's own watcher has to cover it). `rebuildStaleDist` stays `spawnSync` (not taken).
B499 S3 as built (Linux builder, 2026-11-13): `createSketchChecker` (`system/sketch/sketch-checker.ts`) queues its
runs on the main thread and posts one at a time to the worker; a `rules()` or listing call for a product that is queued
or running joins that run. `rules({ signal })` stops waiting on abort; when the last waiter aborts, a queued run leaves
the queue and a running one ends with its worker (the next run starts a new one). `/__design/system` passes the request's
close signal and no longer falls back to the main-thread rule run after an abort. Idle ends: before the slice there was
one idle timer (`startResidentServer`, 30 min); Chromium, the design server, the harness watch and the worker had none
and end through the resident's exit. The serve-hosted resident armed the same timer with a no-op exit; it now passes
`idleMs: null`, so a serve (human or Studio started, ADR 0204) ends only with itself. A self-started resident reads
`ETHLETE_DESIGN_IDLE_MS` (default 30 min). Bite (P7): two specs with a fake worker, red on HEAD and red with the cancel
taken out (worker not terminated; queued `other` still posted), green after; idle specs in `resident/server.spec.ts`
red on HEAD (2 of 9), green after; spec:stress 4/4 each; vitest related 140 files green. P4 measured in a scratch copy
(marker moved aside), `ETHLETE_DESIGN_IDLE_MS=60000`, one `sketch check components/command-palette` (20.8 s, cold): right
after it 1 design process and 8 Chromium processes (1 root); 99 s after the run 0 and 0, log "exits: idle for 60 s".
Not verified: abort through a real HTTP close on a running serve, a serve-hosted resident over 30 min, CI, the Studio
e2e. Terminating a running rules worker drops its check cache (`cachedCheckOf`), so the next run is cold.
B499 S4 as built (Linux builder, 2026-11-13): `design serve` runs its slow runner in a worker of the S3 pattern
(`startSlowRunnerInWorker` in `system/slow-run-host.ts`, entry `slow-run-worker.ts`), not in the rules worker: a poll
runs minutes (harness build, shots) and would queue every rules run behind it. The worker posts its log lines and the
direct edits it holds (`onHeld` of `startSlowRunner`); the serve replaces its own held edits with them, so the
open-points worker sees them as before. A worker's `exit` listeners (harness build kill, temp folder) never run on
process exit or terminate, so on exit the serve asks the worker to run them and waits up to 3 s (`Atomics.wait`); the
worker stops when the serve's HTTP server closes. `createDesignServer` skips `process.chdir` when the cwd already is the
target (a worker cannot chdir). Class facts: a disk cache under `node_modules/.cache/ethlete-design/class-facts` (one
entry per stylesheet slot, with the stat prints of every file read) replaces the per-process in-memory `factsCache`
map in `rules/tailwind-classes.ts`, which each new rules, open-points or slow worker started empty and filled by
running Tailwind again; the reads of the cache go untracked (`untrackedRun`), a hit records its inputs. Bite: the
disk-cache case in `tailwind-facts-cache.spec.ts` and the `onHeld` case in `slow-run.spec.ts` red on HEAD, green after;
`slow-run-host.spec.ts` (log, held edits, poll, stop, and a worker that blocks 1.5 s leaves the caller's max tick gap
under 500 ms); spec:stress 4/4 each; vitest related 150 files green. P6 measured in a scratch copy (own git, slow cache
removed, cold) with an event-loop probe around two slow-checks polls of sdk and studio: before worst main-thread block
5021 ms (more blocks of 3096, 2801, 1469, 1389 ms), after 16 ms; same results (sdk 0, studio 30 problems). Not
verified: warm `/__design/system` and cold open-points on a live serve (P6 targets 300 ms and 1.5 s), the exit
handoff with a harness build running, CI, the Studio e2e. The class-facts entries put a `node_modules` into a target
that had none; jiti in a worker then caches there, so `serve.spec.ts` cleanup now retries its `rm`.
B499 S5 as built (Linux builder, 2026-11-13): Cause (sub-phase timings in a scratch copy, CI=1, cold): of the 12.9 s
`gates` of `sketch check components/command-palette`, 1.65 s were the product rules, 1.6 s the asked sketch and about
9.7 s the rule runs of the 8 other open sketches, which `checked` computed and then filtered away; `openSketchProblemsOf`
now takes `{ target }`. The two variant `tsc` runs (1 s each) ran one after the other after the gates; they now start
before the gates in child processes (`startVariantTypechecks`, at most 4 at once) and keep `--incremental` state next to
their tsconfig in `node_modules/.design-explore` (warm run 0.38 s instead of 0.98 s). Cause (CPU profile, CI=1 warm):
`optionValuesChecker` built a TypeScript program over every part with mock options, 443 ms on the main thread per run;
it now covers only the parts the render check inspects. The in-process run starts its design server right after the
typechecks (0.24 s `aktuell` gone). `sketch ready` already gated one sketch. P1 (`tools/scripts/design-server-proof.mjs
--only P1`; cold = no design process, no `node_modules/.cache/ethlete-design`, no tsbuildinfo), before -> after: local
cold 19.3 -> 7.3 s, warm 7.0/6.9/6.9 -> 2.5/2.9/2.3 s; CI=1 cold 19.3 -> 7.8 s, warm 9.1/9.1/9.2 -> 4.3/4.4/4.5 s.
`sketch ready` cold with CI=1 9.1 -> 8.7 s. The proof script runs P1 and lists P2-P7 as not built. Bite: new specs
`variant-typechecks.spec.ts` (start before return, limit, a throwing run) and the async incremental case in
`typecheck.spec.ts` (red on HEAD: the functions are new); `design-server-proof.spec.mjs` on a captured cold run; for speed
the numbers above. vitest related 143 files green, spec:stress 4/4. Not verified: the main checkout (30.4 s there
before), CI, the Studio e2e, `sketch check` with no sketch named (it still runs every sketch), `TSC=` native (no
incremental state). CI=1 warm has 0.5 s margin; the rest is render-check (2.3 s, a cold Vite per process).
B499 S6 as built (Linux builder, 2026-11-13): P5 local is built in `tools/scripts/design-server-proof.mjs --only P5
[--load <n>]`: it builds Studio once, runs the "B498 R3" case 5 times through `runOnce` of `studio-e2e-repeat.mjs` (the
last with `--hold-listings 14000`), and counts empty cell samples, empty columns and ECONNRESET (`p5RunOf`, `judgeP5`;
spec on a captured run). P5 local: 5 of 5 green, 0 empty cells, 0 ECONNRESET, both idle and with `--load 32` (32 busy
processes, load 36-52). P5's CI part (Studio e2e on CI green twice) is not run; P2, P3, P4, P6 and P7 still print "not
built yet". 992: the two shot ETag cases ran 3 times under `--load 32` (load 36-52), 6 of 6 green, 0 ECONNRESET; with
P5 that is 16 loaded case runs without a reset. Not reproduced on Linux, so no proof the cause is gone; `maxRetries`
was not added (it would hide the next reset, and no bite could be made). 992 stays parked; the P5 ECONNRESET count is
its guard. 986: a `design` serve in a scratch copy under `--inspect`, 200 shots in 10 rounds of 20, each round after a
`styles.css` edit, heap read after two forced GCs: shots only 92 MB at start, 145.1 MB after round 1, 147.0 MB after
round 10; with `/__design/system`, `/__design/sketches` and `/__design/open-points` per round 317.4 MB after round 1,
327.2 MB after round 10 (+1.1 MB a round). RSS rose 706 MB to 4.2 GB (outside the main heap: worker isolates and
native memory). The main-heap leak behind 941 is not reproduced in this load; 986 stays open (no guard added: the
planned bound over 200 shots holds today and a spec of it needs a real serve). Guards: 417 by the e2e case "a sketch
opens with one /__design/system request until its first cell" (red with a second fetch in `listedSystem$`: 2
requests; green: 1, also with `--hold-listings 14000`); 519 by the new `serve-host.spec.ts` case "forgets what the serve
drew before a hosted run" next to the `resident-process.spec.ts` one (both red with the forget taken out of `refresh`);
598 by "keeps the pixel compare across a change to another part" in `unchanged-states.spec.ts` (red when a change drops
every compare); 640 by `run-deadline.spec.ts` (red without the deadline). Not verified: CI, the full Studio e2e, the 986
leak over hours of real Studio use, 992 on the Mac.
B499 close-out as built (Linux builder, 2026-11-13): commits bd89a09e9 (CI `studio-e2e` sets
`ETHLETE_DESIGN_SHARED_SERVE=1`), 2b24b5b9e (P2-P7 in `design-server-proof.mjs`), 58ad5f0ef (close-out note),
d71e3fcb3 (`et design shot` runs in the resident: `runsInResident`, `createWarmRuns`, a `server-start` phase),
cb48a175e (the slow-checks worker kept out of the design server specs). One full run of
`node tools/scripts/design-server-proof.mjs --target <scratch copy>` (own git, scratch marker moved aside, CLI built in
the copy at cb48a175e, other `dist/libs` linked from the main checkout), exit 0:

| Proof | Result | Measured in this run                                                                                               |
| ----- | ------ | ------------------------------------------------------------------------------------------------------------------ |
| P1    | pass   | local cold 8.3 s, warm 3.0/2.3/2.4 s; CI=1 cold 7.8 s, warm 4.5/4.4/4.4 s                                          |
| P2    | pass   | shot runs 1.4 (resident start), 0.7, 0.7, 0.7, 0.6 s; one design process and one Chrome root in all 5              |
| P3    | pass   | serve up, sketch check 4.3 s, shot 0.7 s, compare 15.8 s; after them 1 design process, 1 Chrome root               |
| P4    | pass   | `ETHLETE_DESIGN_IDLE_MS=60000`: right after 1 process, 9 Chromium; 90 s later 0 and 0                              |
| P5    | pass   | "B498 R3" 5 of 5 green (43.6-43.7 s, the `--hold-listings 14000` run 71.9 s), 0 empty cells, 0 ECONNRESET          |
| P6    | fail\* | slow-checks poll 19.7 s, worst main-thread block 0 ms; warm `/__design/system` 47 ms (200); open-points 1 ms (400) |
| P7    | pass   | `sketch-checker.spec.ts` and `resident/server.spec.ts`: 13 passed, 0 failed                                        |

Earlier single runs agree: P1 local cold 7.3 s, warm 2.3-3.0 s; P2 0.6-0.7 s from run 2; P3 1/1; P4 0/0 at 90 s.
\*P6 cold open-points was not measured in this run: the script asked `/__design/open-points` with no `product`, and
the 400 in 1 ms counted as a pass. Fixed in the P6 commit after this note: the script asks `?product=studio` and judges a
non-200 answer of either request a failure (bite: the old `judgeP6` passes a 400). Rerun `--only P6` on a fresh scratch
copy at cb48a175e: FAIL, cold `/__design/open-points?product=studio` 11720 ms (200) > 1.5 s; poll 19.7 s, worst block
0 ms, warm system 61 ms (200). P6 is open: the B499 row stays until cold open-points meets 1.5 s. Verified: P1-P7
locally on Linux in one run, P1 also with CI=1, P5 idle only (the `--load 32` P5 run is from S6). Not verified: P5's CI
part (Studio e2e on CI green twice with `ETHLETE_DESIGN_SHARED_SERVE=1`, so the flag stays), cold open-points (above),
the Mac, the main checkout. `apps/docs/cli/index.md` now names every call that runs in the resident and the
serve-hosted resident (S2).
B499 flag removal as built (Linux builder, 2026-11-13): P5's CI part met (Studio e2e green on CI twice with the flag,
runs 43379234143 and 43383106354), so `ETHLETE_DESIGN_SHARED_SERVE`, `SHARED_SERVE_ENV` and the flag branches of
`sharedServeWanted` are deleted; `sharedServeWanted` is now `ETHLETE_DESIGN_RESIDENT !== '0'`, so `design serve` hosts the
resident everywhere (CI too) and `design-command.ts` needs no change. CI rule kept: a CI call uses a serve-hosted
resident but never starts one, because that comes from `residentWanted` (`!CI`), not from the flag. The old
flag-off paths had no code of their own. `ci.yml` lost the env line, the docs and `serve-host.spec.ts` drop the flag
cases. P6 stays open, so the B499 row stays and no ADR is `built:`. Verified: cli lint (no warnings), cli:typecheck, vitest related (11 files, 79 tests),
spec:stress serve-host 4/4. Not verified: Studio e2e on CI without the flag.

B499 P6 as built (Linux builder, 2026-11-13): Cause (measured): cold `/__design/open-points?product=studio` took
11.4 s = 0.5 s product rules + 10.9 s rule runs over 18 variants of 8 ready Studio sketches (`sketchProblemsOf`), 8.5 s
of it CANONICAL-CLASS with a Tailwind child per variant. Fix: `prefetchClassFactsOf` puts the class facts of the product
and every fresh variant on disk in one Tailwind run (1.33 s); a class-facts cache write merges with the stored entry
(concurrent writers dropped each other's facts); one open-points worker per product, warmed at serve start
(`warmOpenPointsOf`, behind `ETHLETE_DESIGN_SLOW_CHECKS`) and ended when the serve's HTTP server closes
(`stopOpenPointsWorkers`); the fresh variants run in a sync worker pool (`system/sync-pool.ts`, min(4, cpus - 1)
workers, the open-points worker blocks on `Atomics.wait`; a failed pool falls back to the calling thread). The pool
starts before the prefetch, so its workers load meanwhile, and ends after each batch: an idle serve holds no pool
worker. P6 (`--only P6`, scratch copy, CLI built in it): before FAIL, open-points 11720 ms; after PASS twice,
open-points 506 / 556 ms, warm system 50 / 50 ms, worst main-thread block 0 / 0 ms (poll 19.8 / 6.7 s). RSS of the
serve process (all its worker threads; Chromium not counted) on the scratch copy, sampled every 10 s for 150 s: with the
pool peak 4.45 GB, idle after the poll 2.83-2.89 GB; same build with the pool off (`useVariantPool(0)`) peak 3.54 GB,
idle 2.59-2.66 GB, open-points 1782 ms. The pool's own peak (3 workers) is about 1.1 GB during the warm-up; the idle
gap of about 0.25 GB is heap the ended workers left to the allocator. Same thread count idle (106) with and without
the pool. The open-points answer with the pool is byte-identical to the one without (51 parts, fresh cache each).
Bite: `tailwind-facts-merge.spec.ts` red on HEAD (`p-other` lost), `sync-pool.spec.ts` red with a one-worker pool
(1616 ms > 1200 ms), `serve-workers.spec.ts` red without the close hook (2 live workers, not 0); vitest related
144 files green; spec:stress 4/4 each (the three new specs and `slow-run.spec.ts`, `--load 2`). Verified: P6 on Linux on a scratch copy, twice. Not verified: P6 in CI, the
Mac, the main checkout, a pool worker that dies mid-batch (only the stall timeout, 60 s, catches it).

ci-red 1113b as built (Linux builder, 2026-11-13): CI run 43362984133, Checks: `scratch-checkout.spec.mjs` left
`scratch-spec-*` in its spec TMPDIR, all 9 tests green. Cause (git-level probe, not reproduced at spec level): `git
commit` starts `git maintenance run --auto --quiet --detach` (GIT_TRACE, git 2.56); a repo made like `makeRepo` and
removed with `rmSync(force)` right after the commit stays in /tmp with its `.git` (no error thrown) in 2/200 and 3/400
runs under 32 busy loops, and 0/400 with `-c maintenance.auto=false`. Fix: the spec commits with
`maintenance.auto=false` and removes every temp dir in `t.after` instead of inline at the test end. Bite: the old spec
and the new one under 16 busy loops, 8 parallel loops each, own TMPDIR per run: 0/320 leaks both, so the spec-level
bite did not bite; the git-level probe is the bite. Verified: the spec green with the tmp-leak hook. Not verified: CI;
the orphan `sh`/`sleep` processes in the job end are not from this spec. Other specs that commit in a temp repo through
`gitEnv` may leak the same way.

B500 proof (ADR 0280, recorded 2026-11-13 by the doc agent from the builder's proposal). Baseline at a63679c1f, full
`design check`: studio exit 1, 162 s, 25 findings (UNBOUND-INPUT 14, OFF-CENTRE 5, DROPPED-PROP 3, LOST-SURFACE 2,
DISABLED-INTERACTION 1); sdk exit 1, 79 s, 1283 findings (ACTION-UNDECLARED 1041, NESTED-SURFACE 130, CONTRAST 59,
LOST-SURFACE 42, NESTED-SCROLL 5, CUT-CONTROL 3, SKIP-SCOPE 3).

- P1 full check exit 0 for studio and sdk, two runs in a row with the same finding list (VISIBLE-CHANGE included);
  the "base sdk" counts of the studio run equal the own sdk run (today ACTION-UNDECLARED 1111 vs 1041, NESTED-SURFACE
  65 vs 130, OFF-CENTRE 55 vs 0, CONTRAST 6 vs 59).
- P2 every kept rule has a planted-defect spec that turns it red, and 0 hits on the committed parts that a review
  calls false. A rule with one false hit in a review sample (20 hits, or all if fewer) is removed (B500 row: "eine
  Regel ohne null Fehlalarme fällt weg"); its removal names the findings it closes.
- P3 the full check runs as a CI gate for both products and is green twice on CI. (dropped under ADR 0226 (grill 2026-11-13))
- P4 wall time studio ≤ 180 s, sdk ≤ 90 s.
- P5 a full check leaves the tracked `.ethlete/design/*/{merged,ready}.json` unchanged (today it rewrites them).

Builder's direction (applies the row rule, not a new decision): review ACTION-UNDECLARED and NESTED-SURFACE first;
keep DROPPED-PROP, UNBOUND-INPUT, CONTRAST, CUT-CONTROL only if their sample is clean, and fix their true hits.

Group lines 2026-11-13 (doc agent, folded from the night shift; Suspect unless marked Cause):

- B499: harness-server, harness-watch and lib-build-lock register `process.once('exit')` cleanups that do nothing inside
  a worker; only the slow-run worker has the exit handoff. Suspect: leaked harness or lock state when a worker ends.
- B499: an in-process shot starts 2 Chromiums (the shooter has its own draw queue).
- B499: a worker must be owned by the serve lifecycle, not stopped by a spec env stub (Cause of the cb48a175e red:
  3 specs never stopped the slow-checks worker, 13.5 GB RSS).
- B499: shot-store.spec flaky under spec:stress ('drawn' vs 'disk', 0-2 of 4), also before the fix.
- B499: idle serve about 2.6 GB RSS without the variant pool; 986 not reproduced.
- B499: 992 ECONNRESET Cause (d910f48dc): Playwright reuses keep-alive sockets the serve closes after 6 s.
- B499 (second time after 826): the contact sheet draws b-row cells near `b / unchanged-matrix-open` partly grey; the
  same data differs up to 18.6M px between takes. multi-part-head warns "ready will refuse" from the same cell.
- B499 P6: the chip-wheel e2e went red with the variant pool (a10cda703) and green after its revert; not reproduced
  locally. Suspect: the Chip frame width switches from the 1440 fallback to its measured size inside the case window.
- B500: `design complete` keeps its own ACTION-UNDECLARED, not reviewed.
- B500: the serve start log at f0e2405f8 says the visible-change gate fails: title-bar 7 and update-dialog 4 states
  unjudged.
- B500: 12 rules removed with their findings (list in ee5000b5d); contrast decided in ADR 0292.
- B501: an idle `yarn design` serve rewrites tracked `.ethlete/design/*/ready.json` within 2 minutes (Cause, pid
  probe); its records said "by": "et design check".
- B502: the pages/sketches harness sample drifts from the design (no `zoom-chip@edit` tree row, avatar H vs TB, stack
  edges, fold row width); compare change-crop 20188 px, change-crop-whole 18322 px.
- B502: compare reported 140 missed actions in edit-sketch and all-unchanged (button names not found, click timeouts).
- B503: a sketch of foundations/type cannot be shot: type.css `@import './faces.css'` does not resolve once the
  variant stylesheet replaces it. data-et-skip keeps one named exception (its 2 OFF-CENTRE skips) until then.
- Parked (once): detached `git maintenance run --auto` keeps spec temp repos alive (git-level probe 2/200 -> 0/400);
  spec-level bite 0/320; orphan `sh`/`sleep` at the CI job end unexplained.
- B501: `sketch ready` 57 s and 70 s (target 10 s), phase "undeclared" 23 s and 37 s.
- B501: S1 dropped the "embedded X changed" hint of the `design ready` 422 (S4); `design ready` writes other parts'
  cached records (S2).
- B504: slow run fails every poll: `state "project-picker" of "elements/shell-main" failed`.
- B502 (day 13.11.): command-palette has no `implements` link; head drawn over another part's rows; Cause (measured):
  `sketch merge` does not run the product's `generated` command, so a colors merge fails the themes --check spec.
- B502: a merge that drops an action leaves ACTION-LOST in ready.json, clearable only by a hand edit.
- B504 (day): title bar binds no [part]; change marks read as content (column frames, dimmed rows); a round went
  ready whose pictures never show its subject (focus-tooltip, ADR 0293); `withdraw` refuses non-twins, no --reason.
- Machinery: Tom's colors feedback in a doc-agent chat was lost across a restart.

B500 P5 as built (Linux builder subagent, 2026-11-13, commit "fix(cli): Keep merged.json and ready.json unchanged in
design check"): `checkSystemRendered` runs inside `withStampsInMemory` (`stamp-files.ts`); `merged.json` and
`ready.json` reads and writes go through it, so the check sees its own record and merge stamps but the files stay as
they are. `design ready`, the design server and sketch merges still write them. Bite: `check-system-tracked.spec.ts`
(full and `--part`) red on the old code for both files, green after. Live: full sdk check with the old behaviour
rewrote `sdk/merged.json` and `sdk/ready.json`; with the fix `git status .ethlete/design` stays empty, the same 1353
findings, and the only report difference is the old run's own `UNCOMMITTED-DECISIONS sdk: merged.json` warning. Not
verified: a live studio run and a live `--part` run; a committed direct edit now stays in `merged.json` at its old hash
until a merge, so each check re-settles it (Suspect: no report change, the settle prints nothing).

ci-red 1113c (Linux builder, 2026-11-13): CI 43367125488 (a10cda703) and 43368509158 (a63679c1f) fail Studio e2e
shard 6/7 with the same numbers, "[Chip] wheel and ctrl-wheel over a frame centre move the camera iframe=true top 128
-> 248 width 802 -> 145"; 43361375340 at cb48a175e was green. Not reproduced locally in 10+ runs (hold-listings, load
12, cpu-rate 4, 4 cores by taskset, shared serve, open-points delayed 6 s). Suspect: the Chip frame width switches from
the 1440 fallback to the measured size inside the case window, and the variant pool's CPU in CI moves the size report
there. No cause in the time box, so a10cda703 is reverted (B499 P6 reopens, ADR 0280). A green Studio e2e after the
revert supports the suspect commit; P6 then needs a way that keeps that case green.

B500 S2 as built (Linux builder subagent, 2026-11-13): both rules fail the P2 sample and are removed from `design
check`. ACTION-UNDECLARED, one hit from each of 20 parts, 10 false: scheduler "Today" true (emit), input native
input false (the part is the field), slider thumb false (the part is the control), textarea native false, checkbox
et-checkbox false (the part is the control), calendar "Previous" true, form-field native input false, radio-group
et-radio true, otp-input native false, carousel "Previous slide" true, table sort header true, scrollable "Item 0"
false (demo filler), notification "Dismiss" true (emit), banner "View fixtures" false (consumer content), tabs trigger
true, breadcrumb link false (navigation, no state), stream "Allow and play" true, chart bar `g` false (focus for the
tooltip, no click), menu item true (emit), select trigger true. NESTED-SURFACE, all 130 hits are 5 elements (12
distinct lines), all false: card, stat-tile and toolbar on their `*-frame` stage, match card on `t-frame`, the
checkbox card variant on its part root; each stage paints `--et-surface-background-solid`, the page the component
sits on, not a second pane. Removed: `action-undeclared.ts` and its spec, the click-listener init script, the
"under go" warning branch in `check-system.ts`, both ids in `CHECK_RULES`, NESTED-SURFACE in `ESCAPABLE_RULES`; a sole
card in a same-fill pane is still skipped by LOST-SURFACE, so its count does not move (42 before and after). Specs:
the action and under-go cases are deleted, the surface case keeps `doubled` as a non-hit, the render-past-static case
plants a contrast instead. `design complete` keeps its own ACTION-UNDECLARED gap (not reviewed here). No apps/docs
change (docs name only the `design complete` gap). Findings closed: none of the B500 list (424 449 456 457 489 490
501-503 634 691 718 740 872) is about these two rules; the removal closes the parked suspect 971 (ACTION-UNDECLARED
count jump). Counts, full sdk check: before 1353 findings (ACTION-UNDECLARED 1111, NESTED-SURFACE 130), 81 s; after
112 findings, 79 s, exit 1 (CONTRAST 59, LOST-SURFACE 42 and every other count unchanged); `.ethlete/design` unchanged by both
runs. Verified: typecheck, lint, `vitest related` (141 files), two live sdk runs. Not verified: a studio run (its base
sdk part should lose the same two rules), CI.

B500 S3 as built (Linux builder subagent, 2026-11-13): all five remaining sdk rules fail the P2 sample and are removed
from `design check`. CONTRAST, 59 hits on 21 distinct lines: dialog alert "Cancel" false (1.16:1 reported, the dark
shot shows mint text on the dark pane, readable), chart bar-empty and pie-empty false (the whole plot svg read as an
icon; its grid lines are the Q98 values 1.26 / 1.73 the part note records); the other 18 lines (notification, menu,
select, select-panel, elevation, all dark scheme, 1.02-2.43:1) not shot one by one (Suspect: the same wrong fill as the
dialog). LOST-SURFACE, 42 hits on 6 elements, false: table cell (a cell, not a card), bracket match card, switch
selection card and accent-on-light choice field (bordered cards on their page, as designed), breadcrumb toggletip
pane. NESTED-SCROLL, 5 hits, one element, false: the stream consent and error card scroll on purpose (`overflow: auto`,
`safe center`) inside the 16:9 player box, which cannot grow to its content. CUT-CONTROL, 3 hits, false: textarea
`long-max-rows-scrolled` draws the scrolled state by clipping a translated textarea. SKIP-SCOPE, 3 hits, false: the
CLIPPED skips of textarea, floating-action and scrollable sit on the intended scroll crop (finding 740). Removed:
`contrast-check.ts` (scheme helpers now in `color-scheme.ts`), `surface-nesting.ts`, `nested-scroll.ts`, the CUT-CONTROL
and SKIP-SCOPE loops, the per-state exemption of SKIP-SCOPE in `uniqueIssuesOf`, the scheme merge of
`groupedIssueLinesOf`, the frame `contrast` options and pair checks, the `contrasts` producer of the drawn open points,
the four ids in `CHECK_RULES`, both rules in `ESCAPABLE_RULES`, the CONTRAST docs paragraph. Kept: `data-et-skip`
still accepts `LOST-SURFACE` and `NESTED-SCROLL` (the ready studio sketch foundations-colors carries them; removing
them made the sketch fail SKIP-CLASS, and dropping them from the part made its base stale); `definePart({ contrast })`
stays as a record of contrast debt, not measured. Specs: the rule cases are deleted; the sketch-baseline, before-pass,
render-past-static and report cases plant a CLIPPED crop instead. Findings closed: 457 (LOST-SURFACE and SKIP-SCOPE
noise) and 740 (skip-scope refuses an intended crop); 449 loses its LOST-SURFACE and SKIP-SCOPE share. Counts, full sdk
check: before 112 findings, exit 1 (this run 9 s; Suspect: render cache hit, S2 measured 79 s); after 0 findings,
exit 0, 86 s and 80 s in two runs (P4 ≤ 90 s, over the 60 s target line, render-inspect 42-44 s); `.ethlete/design` unchanged. Verified:
typecheck, lint, `vitest related` (145 files), two live sdk runs. Not verified: a studio run, CI; the `contrast` open
point kind stays in `open-points.ts` and the Studio app with no producer.
B500 open (doc agent, 2026-11-13): `design complete` keeps its own ACTION-UNDECLARED check (not reviewed).
B500 S4 as built (Linux builder subagents, 2026-11-13; 243c8aa21, 4610c2a8c and the commit "fix(cli): Drop the UNREACHABLE
and COVERED check rules and count base issues on the drawn part"): every remaining studio render rule with a hit fails
the P2 sample and is removed from `design check`; DROPPED-PROP stays. Start at c09b7b368: studio exit 1, 23 findings
(UNBOUND-INPUT 14, OFF-CENTRE 5, DROPPED-PROP 3, DISABLED-INTERACTION 1). UNBOUND-INPUT, all 14 false, removed (part 1):
`sketches` `pointsClosed` is a `model()` the open-points chip toggles, the 13 `design-canvas` inputs keep their app
defaults; `tagsOf`/`isBound` moved into `dropped-props.ts`. OFF-CENTRE, 5/5 false, removed: one element,
`div.st-title-bar` in the `*-cli-dirty` states, the 32 px title bar with search and buttons read as a one-line text box;
`sdk/rule-baseline.json` (its 18 OFF-CENTRE entries, findings 629-631 and siblings) is deleted, `BASELINED_RENDER_RULES`
keeps CONTROL-HEIGHT only. DISABLED-INTERACTION, 4/4 false, removed: title-bar `linux-full-notice-pending`, comment-draft
`busy`, merge `merging`, system `send-busy` are loading SDK buttons that keep their colours on purpose since 6700dfd3d.
P1 base attribution: Cause (probe, part 1): the studio run counted an issue as base when its innermost `data-et-part`
was a base component (`isBasePartKey(ownerPartOf(issue))`), so studio page issues on SDK buttons fell into "base sdk".
Fix: `check-system.ts` counts such an issue on the drawn part (`countedPartOf`); a base part drawn on its own stays base.
Bite: `check-system-render.spec.ts` "counts a render issue inside a base component on its own drawn part" red on the old
attribution (exit 0), green after; the report case now expects a base card defect drawn in `pages/home` on that page.
That surfaced UNREACHABLE 4 and COVERED 1 as studio findings, reviewed under P2 (all hits). UNREACHABLE, 4/4 false,
removed: `pages/inventory` open/approved ("Inventory freigeben"), loading ("Neu laden"), `pages/merge` merging ("Merge")
are disabled SDK buttons (`pointer-events: none`) that carry their action in every state; disabled is the design.
COVERED, 1/1 false, removed: `pages/sketches` `sticky-names` "Übernehmen" lies under the floating shell side panel
because the state's camera pans the row head there; the canvas runs under the panel by design (CANVAS-UNDER-PANEL) and
the user pans back. Live shot (2026-11-13, `GET /__design/shot?product=studio&part=pages/sketches&state=sticky-names` on the running serve at f0e2405f8): the sticky row heads (linux-close ... macos-update) and variant b's "Übernehmen" draw right of the panel; only variant a's column head, cut at the panel edge, lies under it. No real cover; COVERED stays removed. Both lived in `reach.ts`, deleted with its spec; `data-et-skip`
still accepts `COVERED` and `OFF-CENTRE` (ready studio parts carry them), they escape nothing. The docs drop the
reach paragraph and say where a base component's render finding counts. Findings closed: 634 and 691 (OFF-CENTRE).
Result: studio exit 1, 3 findings, the same in three runs (DROPPED-PROP 3), 136 s cold, 25 s and 19 s warm (render
cache); no "base product sdk" line, so base sdk = 0 = the own sdk run (P1 base part met). sdk exit 0, 0 findings, 77 s.
P4 met (≤ 180 s, ≤ 90 s). `.ethlete/design` unchanged by all runs. VISIBLE-CHANGE not measured: a slow rule a plain
`design check` does not run (finding 718). Open: DROPPED-PROP 3/3 true, app work, not built: `pages/sketches`
`change-crop` and `change-crop-whole` need a `screen` input plus harness crop data (finding 872); `pages/system`
`listing-error` needs a listing-error view. Until then studio P1 (exit 0) is not met. Verified: typecheck, lint,
`vitest related` (139 files), spec:stress 4/4. Not verified: CI, the COVERED verdict in a live shot.
B500 S5 as built, part 1 (Linux builder subagent, 2026-11-13): the `contrast` open-point kind is removed from the cli
(`open-points.ts`, `read-open-points.ts`, `studio-api.ts` doc, docs `cli/index.md`) and the Studio app (`design-open-points.ts`,
`system-view/open-points.ts`, label `belowContrast`); nothing produced it since CONTRAST left `design check`. The `state`
target and the `warning` icon stay: they come from the System page design (`system-page-sample.ts`). Not built, stopped at
a gate: the other two inputs need edits to merged parts, and `design check` says every change to a merged part goes through
a sketch (WARNING "changed outside a sketch", Studio `direct-edit` point). (a) `definePart({ contrast })`: chip, slider,
bracket, otp-input, notification (sdk), variant-cell, foundations/colors (studio), plus both variants of the ready sketch
foundations-colors, whose baseline pins foundations/colors (97f8b2eb627962a4); dropping the type field fails the sketch's
TYPE-ERROR check unless its variants change too. (b) `data-et-skip` with removed ids is carried not only by
foundations-colors (8 LOST-SURFACE) but by merged parts: foundations/colors LOST-SURFACE 4, pages/sketches COVERED
OFF-CENTRE 2, foundations/type OFF-CENTRE 2, pages/inbox NESTED-SCROLL 1, and by the ready sketches
pages-sketches.focus-tooltip and pages-sketches.multi-part-head (COVERED OFF-CENTRE 2 per variant). Refusing the ids with
only the foundations-colors exception breaks these. Open: decide whether the builder opens one-variant "no visible change"
sketches for the 7 parts and the 3 skip carriers (auto-merge, changes merged.json), or widens the exception.
`filled/UNBOUND-INPUT` in `pages/system/shared/capabilities.ts` and its app mirror is sample text, not an exemption; left.
Result: sdk exit 0, 0 findings; studio exit 1, DROPPED-PROP 3 only; merged/ready.json unchanged. Verified: typecheck cli
and ethlete-studio, lint, `vitest related` (cli 139 files, studio 27), spec:stress 4/4. Not verified: CI.
B500 S5 as built, part 2 (Linux builder subagents, 2026-11-13): decision A applied to the design data, and the cli
refuses the removed rule ids. Auto-merged one-variant "no visible change" sketches (`sketch ready --no-visible-change`):
6d4e49a61 sdk components/chip, slider, bracket, otp-input, notification (contrast field); 361976bea studio
foundations/colors (contrast field; its dead `const pairs`, which the sketch lint refused as no-unused-vars; LOST-SURFACE
4), elements/variant-cell (contrast), pages/sketches (COVERED OFF-CENTRE 2), pages/inbox (NESTED-SCROLL 1). That merge
rebased the ready sketches pages-sketches.focus-tooltip and multi-part-head (skip ids out of every variant); 9c04ccc7d
ported foundations-colors a and b by hand (contrast, `pairs`, LOST-SURFACE 4). 1b020194f (cli): `definePart` loses
`contrast` and `PartContrast`; SKIP_CLASSES = CLIPPED, WRAP, CONTROL-HEIGHT; one named exception: OFF-CENTRE on studio
foundations/type is ignored (no SKIP-CLASS finding) until B503. Shot compares (contact sheets, all states, ImageMagick
AE): chip, slider, bracket, otp-input, notification, variant-cell, colors, inbox, pages/sketches 0 px; foundations-colors
sketch a+b 0 px; focus-tooltip 0 px after a retake. multi-part-head reshoot: the old sheet shot in a scratch copy with the
e30915427 design data, five before- and five after-takes; the sheet itself is flaky (cells of the b row drawn partly, up
to 18.6M px between two takes of the same data), and before-1 = after-3, before-2 = after-4, before-5 = after-2 = after-5
at 0 px: no change, accepted. Bites: skips.spec on the old SKIP_CLASSES 7 of 18 red (LOST-SURFACE, NESTED-SCROLL,
OFF-CENTRE, COVERED, OFF-CENTRE on studio foundations/colors and on acme foundations/type, COVERED on studio
foundations/type), green on the new; the exception case red with an empty exception list. Open: the faces.css import
defect goes to B503 (a sketch target foundations/type fails every shot with "Can't resolve './faces.css' in
.ethlete/design/studio": type.css `@import './faces.css'` resolves from the product folder once the variant stylesheet
replaces it); foundations/type keeps OFF-CENTRE 2 until then. Checks after 1b020194f: design check sdk exit 0, 0
findings; studio exit 1, DROPPED-PROP 3 only (SKIP-CLASS 0). `sketch check` (studio) exit 1, no SKIP-CLASS, no pending
change, no READY-STALE: foundations-colors, pages-sketches.focus-tooltip and pages-sketches.multi-part-head stay ready; the
exit comes from the held components/zoom-chip@focus-tooltip (CLIPPED SEE-THROUGH in pages/sketches narrow states, its
hold reason); multi-part-head prints `ready will refuse: variant c first changes unchanged-matrix-open, which draws the
same pixels as variant b` (a warning; not checked whether it predates this slice).
Verified: cli and ethlete-studio typecheck, cli lint, `vitest related` (cli 144 files), spec:stress skips.spec 4/4.
Not verified: CI.
B500 DROPPED-PROP as built (Linux builder subagent, 2026-11-13): the 3 true hits fixed as app work, design unchanged.
(1, 2) `pages/sketches` change-crop and change-crop-whole (prop `screen`, finding 872): `screen` stays a design-only knob;
the harness sample consumes it and feeds `SKETCH_SCREEN_SAMPLE` (sketches-sample.ts: a 1440x900 pages/sketches sketch,
row a carries the change boxes of the two design groups, 16 unchanged states, round 2, tree with sketches selected). The
whole/crop toggle moved from a private signal to `wholeScreens = model<readonly string[]>([])`, bound two-way by
sketch-view, so the harness reaches change-crop-whole. The harness shot of a screen state is a blank 1440x900 stand-in.
(3) `pages/system` listing-error: `SystemPageComponent` gets `listingError` (reason) and `reload`; it draws the design's
error card (error icon, Auflistung fehlgeschlagen, the reason, Erneut laden) with an empty tree; system-view shows it on
the System section when the products listing read fails, and Erneut laden re-reads the listing. Specs:
design-harness-samples.spec (new), system-page.component.spec (new), a wholeScreens case in sketches.component.spec;
red on the old source (samples spec fails to load, 3 cases red), green on the new; spec:stress 4/4 each; vitest related 29
files green; typecheck, lint clean. Checks: studio exit 0, 0 findings; sdk exit 0, 0 findings. The change-crop states
are drivable now (app shot 200, before 422 "16 elements with the aria-label Einpassen"). Live shots (serve :43467,
source=app): change-crop shows the two groups cropped (2,3x and 3,1x) with locator, Ganzer Screen and the mark on
variant a, 16 states folded; change-crop-whole shows the first group whole with Ausschnitt; listing-error shows the
centred error card with "missing build: pages/system" and Erneut laden, empty tree. Compare change-crop DIFF 39581 px,
change-crop-whole DIFF 35643 px: the design draws mock screens with zoom chips inside the crops, the harness a blank
stand-in, and the reason reads "3 Zellen" in the design but "3 Stellen" in the app. Not verified: compare of
pages/system listing-error, the per-part checks (--part pages/sketches, pages/system), CI.

B500 P5 red, as built (Linux builder subagent, 2026-11-13): Cause (probe): no `design check` path wrote the files; the
design server's own slow runner did. Each `ready.json` entry carries the writer's pid, and every entry the earlier
probe and three new ones changed carries the pid of the `yarn design` serve (3659499) and `"by": "et design check"`,
the label `recordBuildReady` gives every record. Probes on `studio`: the serve alone, no CLI call, rewrote 2 entries
in 5 minutes; an in-process `--part pages/system` check (`ETHLETE_DESIGN_RESIDENT=0`) wrote nothing, the 8 entries
changed in its window all carry the serve's pid and none is `pages/system`; the same check through the serve-hosted
resident left `git status .ethlete/design` empty. The serve is out of P5's scope: the P5 note and the docs ("`et design
ready` and the design server write the record") keep its writes, so its behaviour is unchanged. Fix (a defect P5
caused, ADR 0280): `withStampsInMemory` held its map in a module global, so in the serve process a serve-hosted check
swallowed the slow runner's writes and showed it the check's own records, and of two overlapping runs the later one
wrote to disk once the earlier ended; the map now lives in an `AsyncLocalStorage` scoped to the run. The stale "as
`design check` does" in slow-run.ts and record-settled.ts is gone. Bite: `stamp-files.spec.ts` 2 of 3 red on the old
code (server write during a check, run ending after an earlier one), 3 of 3 green after. Not verified: a full-product
check through the serve with pid attribution, the fix live in the serve (its dist build predates it); the serve's
records still read `"by": "et design check"`, which is why the probe looked like a check write (open point, serve
scope).
Follow-up (B500 writer label, `fix(cli): Name the real writer on a ready record`): the ready record names its writer, `et design serve` from the serve's slow runner and `et design check` from a check; `recordBuildReady` takes `by`.

B500 change-crop sketches as built (Linux builder subagent, 2026-11-13): two sketches on `pages/sketches`. Sketch A
`pages/sketches@framed-screens` marks the mock screen of `screenOf` (shared/change-crop.ts) with `slot('screen')`, so
compare empties it like any framed region; before/after design shots of change-crop and change-crop-whole (serve
:43467, fit viewport 1472x932) differ by 0 px each (`compare -metric AE`). `sketch ready --no-visible-change` merged it
by itself (merged.json `auto: no visible change`) and rebased @focus-tooltip and @multi-part-head; commit 80b0447ab.
Sketch B `pages/sketches@stellen` (ADR 0271) changes the reason line to "1358 px in 3 Stellen" and, on the same line of
the second group, "2140 px in 1 Stelle" (the app prints `Stelle` for one place); ready, auto-merge skipped (variant a
changes change-crop, change-crop-whole), waits for the human pick. Compare after A: change-crop DIFF 39581 -> 20188 px,
change-crop-whole 35643 -> 18322 px. The rest is not only the Stellen text: the harness sample tree lists title-bar,
zoom-chip, system, sketches while the design also lists zoom-chip@edit (the tree rows below shift); the variant head
avatar reads H in the app, TB in the design; the stack edges under the first crop differ in shape; the fold row of the
16 unchanged states wraps in the design and runs on one line, 8 px wider, in the app. Design left unchanged. Checks:
`design check --part pages/sketches` exit 0, 0 findings; `design check --product studio` exit 0, 36 parts, 0 findings.
`sketch check --product studio` exit 1: @stellen ready, no pending change; @focus-tooltip and @multi-part-head are
READY-STALE after A's rebase. Re-running their `sketch ready` refused (SHOT-NOT-VIEWED, and `sketch check` warns that
@multi-part-head b and c draw like a at their first change) and set both to in progress; both sketch.json files were
restored to the committed ready state. Open: re-judge those two sketches after viewing their shots. Not verified: the
compare's 140 missed actions (edit-sketch, all-unchanged) predate this slice or not; CI.

B500 VISIBLE-CHANGE as built (Linux builder subagent, 2026-11-13, commit "fix(cli): Drop the VISIBLE-CHANGE slow rule"):
measured with the full check and slow rules on (`design check --product <p> --slow`, dist built at 08ded3827). Before:
studio exit 1 twice (124 s, 143 s), the same 2 VISIBLE-CHANGE hits both runs; sdk exit 0 twice (6 s, 7 s; no harness,
the rule never runs there). Range 08ded3827..HEAD: `harness.baseBranch` is `origin/next`, which equals HEAD, so base and
head are the same commit and no part can have changed. P2 sample (all 2 hits), 2/2 false: `components/title-bar` 7
states and `components/update-dialog` 4 states "unjudged: the design draws 1 overlay pane, the app opened 0". Design
shots on the serve (:43467) draw the hover tooltip "CLI geändert - neu starten" under "Neu starten" and the update
dialog anchored under "Update"; the harness renders the bare component, which opens neither pane (the tooltip needs a
hover, the dialog is opened by the title bar), and `design compare` of `update-dialog@open` and
`title-bar@linux-full-notice` fails the same way. The hits report a harness limit, not a visible change. Decision by
the row rule: VISIBLE-CHANGE is removed from `check --slow` and from the serve's slow runner (`rules/visible-change.ts`
and its spec deleted, the id dropped from check-rules and build-ready-contract, the base/merge-base input dropped from
the slow-input hashes, `--slow` no longer takes `--base`; a harness that does not start now reports on `(product)` as
COMPARE). The serve start "visible-change gate fails" line came from that runner and goes with it. The opt-in command
`check --visible-change` and `harness.baseBranch` stay. After: studio exit 0 twice (69 s, 73 s), 0 slow-rule problems,
the two outputs equal apart from the timing lines; sdk exit 0 twice (7 s each). P1 holds for VISIBLE-CHANGE; P4 met.
Findings closed: none in full. 924 (the gate judged pages/sketches shots that had not settled) and the title-bar /
update-dialog gate line of 981 no longer reach check or serve; they stay open for `check --visible-change`.
Verified: typecheck, eslint on the changed files, `vitest related` (211 files, 1937 tests), the four runs above,
`.ethlete/design` writes only by the running serve. Not verified: CI; the serve with the new dist (it still runs the
old build); title-bar and update-dialog overlay states are now judged by no slow rule (compare does not run them).
Open: remove `check --visible-change` too (recommended: it gives the same 2 false hits and 924's flaky shots), or keep
it opt-in; P3 CI gate.

B500 check --visible-change as built (Linux builder subagent, 2026-11-13, commit "fix(cli): Remove the check
--visible-change command"): the grill removed the opt-in command too, by the row rule (ADR 0279); ADR 0036 only moved
the gate into the check system and does not keep it. Removed: `check --visible-change` with its help block, mode flags
and argv handling in `check.ts`; `system/visible-change.ts`, `visible-change-command.ts`, `visible-change-parts.ts` and
their three specs; `picturesDirOf` and its spec in `base-checkout.ts`; `harness.baseBranch` (type, validation, and the
two `origin/next` entries in `.ethlete/design/config.json`); the `--visible-change` entry of the resident client's
draw-elsewhere list; the `--visible-change` entry of the `background-design-commands` hook (content, spec, synced
`.claude` copy); the gate's mentions in `apps/docs/cli/index.md`; the deleted spec's person-names baseline entry. Kept:
`baseCheckoutOf` and `baseCommitOf` serve `compare --base <rev>`; `baseCommitOf` now only resolves the given rev (the
merge-base and `origin/HEAD` fallback served only the gate). The temp folder keeps its `et-design-visible-change` name
so the existing reused clone is not orphaned. `sketch/no-visible-change.ts` and `--no-visible-change` are the sketch
feature and stay. Findings closed: 924, the gate line of 981. Verified: cli and agent-rules typecheck, eslint on the
changed files, `vitest related` (cli 212 files, 1955 tests; agent-rules 40 tests), `node --test` of tmp-sweep and
check-person-names, the person-names check. Not verified: CI; a live `compare --base`
run after the `baseCommitOf` change; the running serve (old build). Open: P3 CI gate.

B500 closed (Linux builder subagent, 2026-11-13, grill decision: P3 dropped under ADR 0226, which keeps every Studio and
design check out of git hooks and CI, and ADR 0281, which says a new gate is never the default fix). Proof: P1 met
(studio and sdk full check exit 0, 0 findings, two runs the same), P2 met (every removed rule failed its sample, the kept
DROPPED-PROP and CONTROL-HEIGHT have clean samples), P3 dropped, P4 met (studio 136 s cold, sdk 77 s), P5 met
(`.ethlete/design` unchanged). Commits: 7c87d6951 (P5), 8838cda38, 0035ddced, 243c8aa21, 4610c2a8c, cc3b26d5f,
392f10606, 1b020194f, fa79e1408, 3700677b6, 8e26db5a6, 17375e4f3, 7a3b5f378. Findings of the row:

- 424 parked: a sketch-check rule (same sample marks per variant state across page states, B363), not a full-check
  rule; no B500 removal or fix touches it.
- 449 closed: the full check exits 0 locally; its LOST-SURFACE, SKIP-SCOPE and COVERED rules are removed and the
  DROPPED-PROP hits fixed; the CI-gate half is dropped with P3 (ADR 0226).
- 456 closed: the per-scheme de-duplication was built in 8134c8d50; the render rules it counted are removed.
- 457 closed: LOST-SURFACE and SKIP-SCOPE removed (0035ddced).
- 489 parked: no removed rule or built fix touches it; the full check shows no CONTROL-STATE hit, and the picture fix
  (control part `components/rail-bubble`) is a separate sketch; its gate half is moot under ADR 0226.
- 490 closed, dropped under ADR 0281/0226 (grill 2026-11-13): it asks for a new `check --rules` rule on content props per OS layout; a new check is never the default fix, and deleting a check wins.
- 501 closed: its DROPPED-PROP hits are gone, the check lists 0 findings (see the DROPPED-PROP as built block).
- 502 closed: as 501; the 3 true hits left were fixed as app work (3700677b6).
- 503 closed: as 501; `pages/system` `listing-error` got its view (3700677b6).
- 634 and 691 closed: OFF-CENTRE removed (4610c2a8c).
- 718 parked: a whole-product check leaves pending slow rules to the serve (grill decision, unchanged); the removal of
  VISIBLE-CHANGE only left one fewer slow rule it concerns.
- 740 closed: SKIP-SCOPE removed (0035ddced).
- 872 closed for the change-crop states: they are drivable now (`SKETCH_SCREEN_SAMPLE`, 3700677b6); the general
  "list every undrivable state" tool fix is parked, no rule is left that could report it.
- 924 closed: the visible-change gate is removed (17375e4f3, 7a3b5f378).
- 971 closed: ACTION-UNDECLARED and NESTED-SURFACE removed (8838cda38).

B501 proof (ADR 0280, recorded 2026-11-13 by the doc agent from the builder's proposal). Baseline: the working tree holds
36 uncommitted ready.json records (sdk 1 new + 11 rehashed, studio 5 new + 19 rehashed), all `cmd: ""`; a pid probe ties
34 to the idle serve and its child. Suspect: `startSlowRunner` -> `recordSettledBuildReady` (record-settled.ts:39) writes
on a stale slow cache, and the writer pid in each record changes the file on a same-hash rewrite; `upgradeLegacyMarksOf`
(stale-parts.ts:194) bypasses the in-memory stamps, so `design check` can still write ready.json.

- P1 an idle serve leaves tracked files alone: scratch checkout, slow cache deleted, `yarn design` for 3 min, then
  `git status .ethlete/design` is empty.
- P2 only a named user action writes ready.json, merged.json or a sketch.json decision: a spec runs serve, check (with
  the legacy upgrade) and status, and every file stays byte-equal.
- P3 atomic steps: a spec kills merge, ready or pick at each step boundary, and the tree holds either the old or the new
  state.
- P4 uncommitted state is visible: `design status` and Studio name uncommitted ready marks and leftover or untracked
  sketch folders.
- P5 no false withdrawal: regenerated or reformatted files and a shared-copy base change keep a ready mark; only a
  variant edit takes it back, and the withdrawal is reported. A picked sketch refuses edits without `--reopen`.
- P6 generated files: every generated tsconfig passes Prettier (today 4 of 51 fail: sdk, studio, studio-lab, root),
  FORMAT skips gitignored files, and the tsconfigs point only at the installed CLI.
- P7 `design task` works once the part record exists, or names the blocker; every record has `cmd` in {check, ready,
  serve}.

Slices: S1 serve writes nothing tracked (468 rest, 981, the idle-serve line, task refusal); S2 atomic writer and a
per-product lock; S3 transactional merge, discard and rebase (416 434 469 590 574 889, the port Suspect); S4 ready-mark
lifecycle (551, all-states a, edit without `--reopen`); S5 visibility (568 729 919); S6 generated files (707 755 756).
Condition (ADR 0281): the S2 lock names what it removes. 755(b) (shot cache through the node_modules realpath, scratch
isolation) moves to B503.

B501 S1 as built (2026-11-13, 0a006a3c5): serve and `design check` write no tracked file. Cause (P2 spec): the serve's
`recordSettledBuildReady` wrote `ready.json`, and stale-parts `rewrite` bypassed check's in-memory stamps. Built:
`withStampsInCache` keeps a stamp write in `.ethlete/cache/<product>/stamps/` while the tracked text is unchanged; serve,
check and the legacy rewrite use it; task, status and Studio read it (task refusal (d)). No pid churn; `cmd` is
check/serve/ready (981). 468 rest: no writer left (b52ff697c, c7d88a573). Verified: P2 spec bites twice, vitest related,
typecheck, spec:stress 4/4; P1 live (scratch, 3 min): tree clean, sdk settled, studio slow run failed every poll (`state
"project-picker" of "elements/shell-main" failed`). Not verified: a live studio record, Studio UI. Changed: `design
ready` 422 loses the "embedded X changed" hint. Suspect: `design ready` also writes other parts' cached records.

ci-red 1113d (finding 992) as built (Linux builder subagent, 2026-11-13): CI runs 43372815104 and 43356130738, Studio e2e
"a part edited on disk while away shows its new picture on return" failed in its shot ETag fetch with ECONNRESET / socket
hang up. Cause (probe): Playwright's API request agent is `http.Agent({ keepAlive: true })` with no timeout, so Node
ignores the design server's `Keep-Alive: timeout=5` hint and keeps idle sockets forever; the server closes them after
5 s + 1 s buffer. In the case the two ETag batches (12 sockets) are 5-12 s apart; when the design server's event loop
lags under load at that edge, its idle timer destroys a socket whose new request already sits unread, and the kernel
answers RST. Probe: the case with a second ETag batch 6 s after a warm one and the design server SIGSTOPped from 5.7 s to
6.3 s: 2 of 2 red with the CI message `apiRequestContext.get: read ECONNRESET`; control with a 3 s gap and the same stall
green. Fix (case, not product: Chromium retries such a reset, the Studio app is unaffected): every `page.request.get` in
`canvas.e2e.mjs` sends `connection: close`, so no request reuses an idle socket; assertions unchanged. Bite: the same
probe after the fix 3 of 3 green. Verified: related e2e helper specs (61 pass), the clean case under `--load 8`. Not
verified: CI; the server-side 5 s idle close itself is unchanged.

819 as built (Linux builder, 2026-11-11, ffaf42f02): `check-person-names.mjs --staged` reads the staged blobs under
libs, apps and `.ethlete/design` (pre-push baseline and message); `.husky/pre-commit` runs it when such a file is staged.
Bite: a spec stages a name and clears it in the working tree; red on the old script. Not verified: a real refused commit.
820 as built (Linux builder, 2026-11-11, c373dcfd0): Cause (proved): `lint-changesets.js` read `.changeset` from disk in
the checkout, so an untracked file of another agent counted. Fix: `lint-changesets.js --rev <sha>` reads only the
changesets committed at that sha (`git ls-tree`, `git show`); pre-push-checks passes the pushed head, which covers
push:suite and pre-push. Deviation from the planned fix (run it in the HEAD export): the export has no `.git`; the blobs
are the same content. New script `lint:changeset-coverage`; `yarn lint:changesets` runs both. Bite: 3 cases red on the
old scripts; spec:stress 4/4.

827\. Linux builder (2026-11-11, push:suite at c373dcfd0): "Not formatted in c373dcfd0: package.json"; the 820 subagent
added a script out of key order and reported prettier clean without running it on `package.json`. Cause (read,
`.husky/pre-commit:43`): pre-commit runs prettier only on staged Markdown blobs, so an unformatted `.json` or `.ts` file is
caught one round later by pre-push or push:suite. Tool fix (doc agent, tool internal): pre-commit runs `prettier --check`
on every staged Prettier-supported blob. Bite: a staged unformatted `package.json` fails the commit.

828\. Large iframe flake (Mac builder, 2026-11-11; numbered 815 on the Mac, renumbered at the merge): "a variant equal to Aktuell keeps its iframes across a quick and a full listing" failed once at `--workers 5`, load 31.7 to 55, with "folded false; collapsed: iframe/row adds 2 removes 22". Cause: the case waited a fixed 60 s for the fold after its setup write, then measured anyway; under load the setup's full listing took longer, so the first fold of variant b (row b and the folded states leave the DOM, the `hidden` frames enter) landed inside the measured "collapsed" window. The case also counted a listing at its `response` event, but `sendHeldJson` sends the headers after the first 15 s keep-alive, so "answered" could mean "headers only": in loaded runs the full listing's body came 5 s after its headers, and in the failed run 25 s after. The product drops no iframe: the removes are the fold the setup expects. Fix (test only): the setup goes through the same `refresh` as the two measured phases, a listing counts on `requestfinished` and only when it was asked after the write, the deadline is 2 x `FULL_COMPARE_MS`, and the setup listings are part of `ok`. Bite: `--hold-listings 25000` failed before with the same "folded false, adds 2 removes 22" (setup full listing cancelled by the 60 s write, fold at 113 s in the collapsed window) and passes after.

829\. Linux builder (2026-11-11, CI runs 42992406760 on a55bc3218 and 42995939464 on be2aa4ff5): Studio e2e shard 6/6
fails twice in a row in "[System] open points chip pressed matches its popup" with status=null at load 9-12 on 2
workers; locally 3 of 3 green. Suspect: the case reads the status once, before the chip renders under load. Lesson: the
local push gates did not run the case under CI load, so a timing defect reached CI twice. Tool fix (doc agent, tool
internal, after the cause is proved): the fix keeps the assertion and carries a before/after proof under a CI-like
reproduction (shard 6/6, 2 workers, load); if the cause is a one-shot read, a lint or review rule flags status reads in
Studio e2e that do not retry. Builder holds feature slices and the 821 push until CI is green.
829 as built (Linux builder, 2026-11-11, a48464908, test only): Cause (measured): since e3008e59a (B488) an uncached
`/__design/open-points` applies each variant of each ready sketch and runs the full rule check (`sketchProblemsOf` in
`read-open-points.ts`); on studio, idle, 171 ms before and 8.6 s after (5 ms cached), 35.1 s at load 18. The case waited
a fixed 20 s, swallowed the timeout and read status=null. push:suite missed it: 32 idle cores show the badge after about
7 s. Fix: the case waits for the badge with `waitFor` at `COLD_START_MS` and no longer swallows the timeout; the
assertion is unchanged. Bite: a CI-like run (shard 6/6, 2 workers, 4 cores, 12 busy loops) red 3/3 before, green 22/22
after. Same kind of flaw as the Mac's 828 (1).
829 b as built (Linux builder, 2026-11-11, test only): `push:suite` run 3/3 (`--hold-listings 14000`) ended the chip case while a held listing was pending, since 830 made the answer fast. The case reads only the chip, popup and footer status, never the listing: `holdListings: false`. Waiting with `listingAnswered` did not help, since no `data-sk-changed` element of the System page tracks the held request (run 3/3 failed again with it).

830\. Linux builder (2026-11-11, from 829): the open-points answer got 50 times slower with B488 and no gate saw it.
Cause (measured): see 829 as built. Tool fix (doc agent, tool internal): cache `sketchProblemsOf` per sketch variant and
content hash, or send the open points first and the sketch problems when the check is done; target an uncached answer
under 1 s on studio. Bite: a spec or timing check that fails on the uncached 8.6 s answer.
830 as built (Linux builder, 2026-11-11, option (a)): `read-open-points.ts` holds the rule problems of
each ready sketch variant, keyed by the product print and the sketch, and reuses them while every file the variant's run
read still reads the same; the open-points cache shares one product rule run between the sketch problems and
build-ready (it ran twice). Narrower keys are unsound: a variant run reads all 91 studio part sources. Measured on
studio, idle: `readOpenPoints` with sketch problems cold 8.4 s (HEAD 7.8 s), repeat 82 ms (HEAD 5.9 s); open-points
cache miss with held variants 710 ms; same output as HEAD (byte-equal JSON). Live `curl /__design/open-points?product=studio`
after a server restart: cold 5.5 s, warm 15 ms; part `pages/sketches` 2.2 s first, 0.25 s after. Bite:
`sketch-problems-cache.spec.ts` counts rule runs, red on HEAD source (3 and 5 runs where 0 and 2 are due). Not met: the
cold first answer and the answer after any part edit stay over 1 s; only (b) meets it, and (b) needs a Studio change
(it asks once per part and re-asks only on its reload triggers), so it is left open. Not verified: Studio e2e.

831\. Linux builder and Mac builder (2026-11-11, 828 and 829): two e2e cases waited a fixed time, swallowed the timeout
and then measured or asserted, so a slow load showed as a wrong value instead of a timeout. Tool fix (doc agent, tool
internal): a harness rule or lint check rejects a `waitFor` (or other wait) followed by `.catch(() => undefined)` in the
Studio e2e files; fix every hit. Bite: the check fails on the old 829 case.
831 as built (Linux builder, 2026-11-11, this commit: fix(repo) "Reject a swallowed wait in the Studio e2e files"): lint
rule `no-restricted-syntax` in `apps/ethlete-studio/eslint.config.mjs` for `e2e/**/*.mjs`, selector in
`e2e/no-swallowed-wait.mjs`: a `.catch` on a chain holding `waitFor*`, `poll` or `click`. Three hits, all in
`canvas.e2e.mjs`: `showAllStates` (324) and the refused-check-record case (click and open wait, 1195/1200) now throw
as a timeout. Bite: `no-swallowed-wait.spec.mjs` lints the old 829 code and fails to see it without the rule; the
three callers of `showAllStates` and the refused-record case pass alone, plain and with `--hold-listings 14000`.
Not proven: `showAllStates` on a page where the folded-states button is legally absent (all three callers had it).
830 as built (Linux builder, 2026-11-11, dc37b06e8), warm only: each ready variant keeps its rule problems, keyed by
product and sketch, reused while every file its run read is unchanged; the product rules run once and are shared with
build-ready. Output byte-equal to HEAD. On studio, idle: repeat call 5.9 s to 82 ms; miss with held variants 710 ms;
cold 7.8 s to 8.4 s (no change). One variant run reads all 91 studio part sources, so any part edit reruns every
variant. Bite: `sketch-problems-cache.spec.ts` counts rule runs, red in 2 cases on HEAD, green after; spec:stress 4/4.
Not proven: the recordInputs replay. Cold path and first answer after a part edit: 832.

832\. Doc agent (2026-11-11, from 830): the cold open-points answer (about 8 s on studio) and the first answer after a
part edit stay far over the 1 s target. Tool fix (doc agent, tool internal, no change in what the human sees): the
server computes the sketch problems in the background at start and again after each file change it watches, so the
cache is warm before Studio asks; an ask during a run waits for that run, it does not start a second one. Rejected for
now: sending the sketch problems later with a push to Studio, because it changes what the human sees. Bite: a spec where
the first ask after start and the first ask after a part edit do not run the rules inline.
832 as built (Linux builder, 2026-11-11, this commit: perf(cli) "Warm the open points in the background"): `open-points-warmer.ts` warms the open points of every product in
the open-points worker at server start and 300 ms after each watcher event (add, unlink, change); a change during a run
queues one more run. `/__design/open-points` asks through the warmer: an ask waits for the run in flight (or starts a
pending one at once) and then hits the cache, so it never starts a second run. Only `et design` serve warms
(`warmOpenPoints`); check, shot and spec servers do not. Bite: `open-points-warmer.spec.ts` counts inline rule runs;
with the warm-up removed it is red in all 4 cases (2 to 4 inline runs where 0 are due), on HEAD the module is missing;
green after, spec:stress 4/4. Measured live on a scratch copy of the checkout (port 4517, from source): the start warm
takes about 17.5 s for all three products (studio 13.5 s, while Vite starts); an ask after it 20 ms (830 measured 5.5 s cold).
After a part edit the studio warm takes 6.5 s; an ask after it 11 ms, an ask during it waits the rest of the run (5.3
to 6.5 s, no faster than HEAD). The 1 s target holds only for an ask after the run. Suspect: Studio asks right after
start and right after its reload triggers, so its first answer still waits. Not verified: Studio e2e, the real :4402 server.
829b as built (Linux builder, 2026-11-11, 4ed2e6b96, pushed with 821, 829 and 830): after 830 the chip case ended before
its held listing ("ended while a held listing was pending", load 30.9). Fix: `holdListings: false` on the case; it reads
only chip, popup and footer status, never the listing. A `listingAnswered` wait did not work: 833. Bite: `--page System
--hold-listings 14000 --delay-pictures 60000` red before, green after; hold alone passed in 5 idle runs. push-suite ok
(repeat 3/3 of 26 System cases).

833\. Linux builder (2026-11-11, from 829b): `listingAnswered` returns at once on a page with no `data-sk-changed="pending"`
element for the held request, so a wait on it passes silently. Suspect (code read). Tool fix (doc agent, tool internal):
the helper fails when a hold is active and neither a pending marker nor an answered listing exists. Bite: the System page
chip case with `listingAnswered` and a hold fails with a clear message instead of passing.
833 as built (Linux builder, 2026-11-11, this commit: fix(repo): Wait for held listings in listingAnswered): the e2e route
counts listing requests per job and those still held; `listingAnswered` polls `listingWait` (`probe-helpers.mjs`) until no
pending marker exists and, with a hold active, a listing was requested and none is still held; otherwise it throws
"listingAnswered timed out: <reason>" after 60 s. Bite: the System chip case with `holdListings` on and
`listingAnswered` added, `--hold-listings 14000 --delay-pictures 60000`: the old helper ended with "ended while a held
listing was pending" (829b); the new one waits out the hold and the case passes (55.3 s). `listing-wait.spec.mjs` 5/5.
Verified: callers run alone, plain and held (see the commit message list in the result file). Not verified: the thrown
timeout message live (only the pure `listingWait` reasons are specced).
832 as built (Linux builder, 2026-11-11, 32330be11): `open-points-warmer.ts` computes the open points of every product
in the existing worker at `et design serve` start and 300 ms after each watched change; an ask waits for the run in
progress and never starts a second. Bite: `open-points-warmer.spec.ts` counts rule runs inside an ask (first after start,
first after a part edit, two concurrent asks, a change during a run): 2-4 inline runs without the warm-up, 0 after;
spec:stress 4/4. Live (scratch :4517): an ask after a run 11-20 ms; an ask during the run waits 5.4 s after start and
5.3-6.5 s after a studio part edit. Suspect: Studio asks right after start and after each reload, so its first answer
still waits 5-6 s: 835.

832 reverted (Linux builder, 2026-11-11, this commit): CI 43016617514 on a00d96078 went red in Studio e2e shards 1, 4
and 6: `sketch fixture check could not list the sketches: TimeoutError: apiRequestContext.get: Timeout 60000ms
exceeded.` The last green CI (43008876858, 4ed2e6b96) had no warm-up. Suspect: on a CI runner the warm-up runs of every
product (7 s each before 835) take the CPU from the server, so the first sketch listing outlasts 60 s. The local push
suite e2e on efe3e7832 passed, so the load did not show locally. Re-land the warm-up only with a bite that runs the e2e
fixture check under CI-like CPU limits.

834\. Linux builder (2026-11-11, 832 push-suite): the e2e build failed with TS2688 "Cannot find type definition file for
'@types'". Cause (seen): 93 self-links `node_modules/@x/@x -> node_modules/@x`, made at 12:01:55 while the 832 subagent
built a scratch copy in /tmp by linking scope folders into a `node_modules` that pointed to the repo. Tool fix (doc
agent, tool internal): one script makes the scratch checkout copy for live measurements (reuse the safe `node_modules`
link of `commit-export.mjs`), and subagent briefs name it; push-suite checks `node_modules` for scope self-links before
the build and names them. Bite: a planted self-link fails the check with its path.

834 as built (Linux builder, 2026-11-11, this commit: fix(repo): Add a scratch checkout script and a node_modules self-link check): `yarn scratch:checkout <dir>` (`tools/scripts/scratch-checkout.mjs`) copies the working tree (tracked files with uncommitted edits plus untracked unignored files) and links dependencies through `linkInstalledDependencies` of `commit-export.mjs`; it never writes in the repo `node_modules`. `preChecksStep` of push-suite now fails with `node_modules-self-links`, naming each `node_modules/@scope/<name>` symlink that resolves to its own scope folder or an ancestor (depth 2 only). The builder-agent skill has the brief line. Verified: `scratch-checkout.spec.mjs` 4 of 4 green; red (2 of 4 fail) with the check stubbed out; the real repo `node_modules` has 0 self-links. Not verified: a full `yarn push:suite` run.

835\. Doc agent (2026-11-11, from 832): one open-points run still takes 5-6 s on studio, so the first Studio ask after
start or a part edit waits that long. Tool fix (doc agent, tool internal): make the run itself faster first; one variant
run reads all 91 studio part sources (830), so find what the rule check needs per variant and profile the run before a
change. Target: a run under 1 s on studio. If that fails, sending the sketch problems later (830 option b) changes what
the human sees and goes to the human as a question.
835 as built (Linux builder, 2026-11-11, this commit: perf(cli) "Parse and scan each source once per text"): profile
first, on a scratch checkout of studio (91 parts, 2 ready sketches, 6 variants, 3 with `shared/`): one run is 10 full
rule runs (product 1, variants 6, merged layout 3) of 35 rules, about 600 ms each; cold 7.0-7.6 s, after a part edit
5.7-6.9 s. Cause (profiled): every rule run re-walks the syntax tree and re-scans the text of every source (definitionOf
1.0-1.5 s, Tailwind class texts 1.4-2.4 s, part rewrites 0.6-1.0 s with a fresh parse each call, command text 0.6-1.0 s,
reachable files 0.5-0.8 s, orphan endpoints 0.4-0.7 s over the 600 KB app source); plus, cold only, the Tailwind
class-facts subprocess 1.35-1.45 s. Why a variant reads all 91 sources: the rules are product-wide (imports, reachable
files, orphan endpoints, shared files) and the variant answer is the difference of two whole-product runs, so narrowing
the read set stays unsound. Built: `perSource` in `ts-source.ts`, a 512-text memo of a pure function of a source text,
on `sourceFileOf`, the node list, `textsOf`, `importsOf`, `calledNamesOf`, `definitionOf`, the Tailwind class texts, part
rewrites, command text, top-level awaits, stylesheet imports, inline UI, glued interpolations, phase unions and
hard-coded colours; the orphan-endpoint verdict is held per app while its sources read the same. Files are still read
each run, so the tracked inputs do not change. Measured (script over `readOpenPoints`, scratch, idle): after a part edit
5.7-6.9 s to 650 ms; cold 7.0-7.6 s to 2.6 s; repeat 35 ms. Not met: cold stays at 2.6 s, of it the Tailwind subprocess
1.4 s and the first parse 0.5 s (suspect: a disk cache of the class facts keyed by their read prints would fix it).
Output byte-equal to HEAD for studio, sdk and studio-lab. Bite: `open-points-reparse.spec.ts` records each syntax-tree
walk after a part edit; red on HEAD source (3 unchanged sources walked again), green after; spec:stress 4/4. Not
verified: a live `/__design/open-points` ask on a server, Studio e2e.

837\. Doc agent (2026-11-11): the Linux and the Mac builder take finding numbers from their own tree, so both used 828
and 833 today. Suspect: no shared source hands out the next number. Tool fix (builder pick, tool internal): a number
reservation that both builders read before they write a finding (for example `yarn finding:next`, reserved through
origin or the shared mailbox), and `check-plan-findings.mjs` fails on a duplicate number after a merge. Bite: a merge
that brings a second finding with the same number fails `check-plan-findings.mjs`.

839\. Doc agent (2026-11-11, Mac builder self-restart): `agent-sessions restart` gave up after 1800 s (restart.log
12:08Z) because it read the busy line "general-purpose Waiting for cli build log 14m 59s"; the same timer still showed
30+ min later, so the subagents were frozen and the restart waited on a line that never changes. Suspect: the busy check
cannot tell a running subagent from a frozen one. Tool fix (doc agent, tool internal): restart reads the subagent timers
twice; a timer that does not advance for 10 min counts as frozen, and restart names the frozen agent in its log and the
mailbox at once instead of waiting out 1800 s. Bite: a pane fixture with a fixed timer reports frozen within the check.

842\. Linux builder (2026-11-11, from 835): a cold open-points run on studio still takes 2.6 s; the Tailwind class-facts
subprocess is 1.4 s of it (profiled). Tool fix (grill decision): a disk cache of the class facts, keyed by the files
Tailwind read. Target: a cold run under 1.5 s. Bite: a second cold start runs no class-facts subprocess when no input
changed, and a changed input runs it. Build after 838 and 837. 830 option (b) stays off the human's list: the edit case
meets the target, and the start warm-up covers the cold ask.

843\. Linux builder (2026-11-11, CI 43016617514 on a00d96078): Studio e2e shards 1, 4 and 6 stopped at "sketch fixture
check could not list the sketches: TimeoutError ... 60000ms"; the local push-suite on the same code passed. 832 was
reverted (3ab01b2e6). Suspect (code read): the 832 warm-up loads the CPU at serve start and starves the first listing on
the CI runner. Lesson: this is the second CI-only e2e failure today (829 too); push-suite runs on 32 idle cores, CI on
2 workers under load, so the local gate cannot see a load defect. Tool fix (doc agent, tool internal): push-suite runs
its e2e pass under CI-like limits (the 829 recipe: 2 workers, 4 cores with `taskset`, busy loops), or adds one such pass
for changes under `libs/cli/src/lib/design`; the fixture check's fixed 60 s timeout (Mac builder, 828) gets a reason in
its error (which request, how long the server was busy). Bite: the 832 warm-up re-applied fails push-suite locally.
832 stays parked: re-land only with that bite green, and only if the cold run (2.6 s after 835) still needs it.
843 as built (Linux builder, 2026-11-11, this commit: Run a CI-like e2e pass in push-suite for design server
changes): Built: push-suite step `e2e-load` (after `e2e-quota`) runs shard 1/6 on 2 workers, pinned with `taskset` to
cores 0-3 beside 12 busy loops on the same cores (the 829 recipe, now `tools/scripts/ci-like-load.mjs`, also a CLI:
`node tools/scripts/ci-like-load.mjs -- <command>`); without `taskset` it runs unpinned and its note says so. It runs
only when the pushed range touches `libs/cli/src/lib/design/`, where the causes of 829 and 843 lived: always would add
about 2.5 min to every Studio push. The load generator takes the heavy run lock and holds it for its whole life (grill
decision), so busy loops never run outside it; inside push-suite it takes none. The fixture check's error names the GET
URL, the time waited against the 60 s limit, and a 2 s `/__design/queue` probe (answered, or busy/down). Suite time
added: 134-152 s per push that touches the design dir, 0 s otherwise. Verified: specs (`ci-like-load.spec.mjs`, the
STEPS and reuse cases in `push-suite.spec.mjs`) fail without the change; a second load generator refuses while the
first holds the lock. Bite: does not fail. Shard 1/6 under the recipe, 3 runs each in scratch copies: the 832 warm-up
re-applied 3/3 green, listing (`fixtures` phase) 36.5-40.2 s (median 38.6 s); HEAD 3/3 green, 32.8-43.1 s (median
34.5 s). The warm-up costs about 4 s here, far from 60 s, so this machine under the recipe does not reproduce the CI
timeout; the listing itself takes over half the limit under load with or without it. The bite of the lock rule ran in
the wild: the main push-suite hold run on 436fee399 failed 12 cases "no frame after 10 s" at load 9-14 while a bite
load of this slice ran; the same case alone passed 6/6. Suspect: the load outside the lock was two `nx` builds of
cli, components and core in the scratch copies (they ended at about 13:29 local), not the busy loops, which took the
lock first (847). Not verified: the new fixture error text
on a real timeout, the step inside a full push-suite run (only its pieces), a CI-like failure of any kind.

844\. Linux builder (2026-11-11, revert of 832): the revert deleted `.changeset/832-warm-sketch-problems.md`, and
pre-push refused it in lint:changesets (an unreleased changeset must stay). Cause (seen): `yarn revert:check` does not
name a changeset file the revert would delete. Tool fix (doc agent, tool internal): revert:check names each changeset the
revert deletes and says to keep it. Bite: a revert that deletes an unreleased changeset fails revert:check with its path.

846\. Linux builder (2026-11-11, from the 843 bite): under the CI-like recipe (`tools/scripts/ci-like-load.mjs`: 2
workers, 4 cores, 12 busy loops) the first `/__design/sketches?product=studio` listing of the e2e fixture check takes
33-43 s, more than half of its 60 s limit, with or without the 832 warm-up. Suspect: this is the margin that the CI
runners lost in 829 and 843. Tool fix (grill decision): profile the first listing under the recipe and cut it. Target:
under 15 s under the recipe. Bite: a timing check under the recipe that fails on today's 33-43 s. Build before 837.
Profile (Linux builder, 2026-11-11, two runs): first listing 40.8 s and 41.3 s, 13763 bytes, 6 items. Targets of
`components/title-bar@notice-hint` take 21-23 s (plain title-bar about 1 s); Suspect (timing only, no bite): it waits
behind 26 pictures in flight, not its own compute. Worker sketch check 9.2 s steady; `inTurns` (9a7a040eb) costs almost
nothing. Fix slice runs; it proves the wait first, keeps the answer byte-equal and does not reuse the 832 warm-up.

846 measured, not built (Linux builder subagent, 2026-11-11, no code change): `/tmp/s846` scratch, first studio listing
of the e2e fixture checkout under the recipe, cold shot store, `ETHLETE_DESIGN_SLOW_CHECKS=off` as the e2e worker sets it.
The earlier profile was wrong twice: the scratch had no `dist/libs/{components,core,query,types,bracket}` (CI builds them),
so every ng() picture failed, and it ran with the slow runner on. Baseline: 28.7 s / 29.5 s, 6 items. Cause (measured):
the listing is serial end to end - the worker sketch check (10-12 s: Tailwind class-facts `execFileSync` 5.9 s, variant
problems 2.4 s) runs before any target, then sketches, targets and variants each wait for the one before; the first ng()
picture waits for the render worker, which starts only on the first `/__design/render` (about 5 s to load Angular and
`@ethlete/components`). Experiments on the dist (answers JSON-equal; bytes differ only by the keep-alive leading space past
15 s): targets started beside the check 19.0 s; plus all sketches in parallel 16.7 s; plus `inTurns` parallel 15.3 s; plus
the render worker started at the listing start 13.8 / 14.2 / 14.1 s - under 15 s but with no margin, the check (12.4 s)
is now the critical path. Next step: build those four in `studio-api.ts`, `render.ts` (a `warm()`), `render-worker.ts`
(a warm message), `serve.ts`, then cut the check (run the Tailwind class facts async beside the other rules) for margin.
Side finding (measured, not the e2e cause): with the slow runner on, each 15 s poll's `slowInputsOf` blocks the main
thread about 14 s under the recipe (`app-files` `declaringFilesOf` regexes), which made the profiled listing 41 s.
846 as built (Linux builder subagent, 2026-11-11, commit: this one): the first full listing starts the targets beside
the sketch check, lists sketches, targets and variants side by side (`inTurns` keeps the order and still stops on abort),
and asks `renderer.warm()` when a full listing will draw pictures (a `{ warm: true }` message loads Angular in the render
worker; not at server start). Recipe, built scratch, cold store: before 28.7 / 29.5 / 30.4 s, after 13.5 / 13.9 / 14.2 / 14.7 s,
answer JSON-equal. The async Tailwind class facts were not built: with the check answered from a file the listing still
took 13.3 s, so the targets are the critical path and a faster check buys at most about 0.8 s. Margin is 0.3-1.5 s: the gate may flake; more needs
the targets (pictures) faster.
Gate (finding 852): `yarn studio:first-listing [<built checkout>]` and the push-suite step `first-listing` time the
listing under the recipe with a 15 s limit; it failed on the old code (30.43 s) and passes on the new. Specs:
`studio-api-listing.spec.ts` (3 cases, all fail on the old code), `render-restart.spec.ts` (warm), the tool specs.
Not verified: the e2e case runs, blocked because aaeef909d breaks the Studio production build (`styles.css:2184`
`@assets/fonts/noto-sans-latin-wght-normal.woff2` does not resolve).

847\. Linux builder (2026-11-11, 843 bite): heavy work in a scratch copy (`nx` builds of cli, components and core) ran
outside the heavy run lock while the main push suite ran its hold pass, which then failed 12 cases at load 9-14.
Suspect: those builds. Tool fix (builder pick, tool internal): heavy work in a scratch copy takes the heavy run lock
too, for example through `yarn scratch:checkout` builds or a wrapper that the briefs name. Bite: a build in a scratch
copy started while the lock is held waits or refuses.

850\. Mac builder (2026-11-11): `push:suite` was blocked three times in a row; each time the push slot expired, the
Linux builder took it again at once (dd1a4b2527fb, until 13:58:38Z), so the Mac commits 840 and 841 stayed local.
Suspect: `tools/scripts/push-slot.mjs` has no waiting list, so whoever polls first after a release wins, and a holder
that pushes back-to-back always polls first. Tool fix (doc agent decision, tool internal): a builder that finds the slot
taken enters a waiting list; on release or expiry the slot goes to the oldest waiter; a holder that just released cannot
take it again while someone waits; the busy message names the waiters and the queue position. Bite: a spec with holder A
releasing and re-acquiring while B waits gives the slot to B; without the fix A wins. Queue: Mac builder, after 845.

851\. Mac builder (2026-11-11): `push:suite` for 840+841 failed; `frame-bootstrap.spec` was 11/11 red since 4a4345f28
(836). Its fixture loads `frame.ts` by path into a vm context with stub modules; the stub lacked `markNgStyles` and the
context had no `window` (fixed in 6795d9e78). Cause (proven by the miss): `vitest related` does not reach a spec whose
fixture loads a source file by path into a vm, because there is no import edge, so the finding 779 rule passed on a
broken spec. Tool fix (doc agent decision, tool internal): a related map lists the vm-loaded sources per spec, the
related run adds those specs when a listed source changes, and a check fails when a spec loads a source path that the map
does not list. Bite: a change to `frame.ts` that breaks the stub selects `frame-bootstrap.spec` and fails; without the
map the related run skips it. Queue: Mac builder, after 850.

852\. Linux builder (2026-11-11, from 846): no check times the first sketch listing; the e2e fails only at 60 s, so 29-43 s
passed silently. Tool fix (doc agent decision, tool internal): the 846 timing gate (under 15 s under the CI-like recipe,
on a built scratch) becomes a `push:suite` step. Bite: the step fails on the code before 846. Queue: Linux builder, in
the 846 slice or right after it.

853\. Linux builder (2026-11-11, from 846), measured: with slow checks on, each 15 s poll blocks the Studio server main
thread about 14 s under the CI-like recipe (`slowInputsOf` → app-files `declaringFilesOf` regexes). Tool fix (doc agent
decision, tool internal): move this work to the worker. Bite: a main-thread stall probe under the recipe sees no block
over 1 s during a poll; before the fix it sees about 14 s. Queue: Linux builder, after 849.

856\. Linux builder (2026-11-11, from 855), measured: when the Studio build fails, the `canvas.e2e.mjs` lead process exits
but leaves its `--worker` processes and their design servers running. Tool fix (doc agent decision, tool internal): the
lead stops its workers and their servers on every exit path. Bite: a spec with a failing build leaves no worker or
server process; before the fix they stay. Queue: Linux builder, after 853.

857\. Mac builder (2026-11-11, 840 b): the Studio e2e "[Edited]" case passed with 1/12 pictures changed on broken code.
Cause (probe: 1/12 then 0/12 on HEAD; 12/12 twice with 840 undone): a warm page booted before a change kept its old
module (fixed in 39faaabd1). Tool fix (doc agent): the case requires every picture of the edited part to change. Bite:
with the 39faaabd1 fix undone the case fails. Queue: Mac, after 851.

858\. Mac builder (2026-11-11, 840 b): a change in `shot.ts`/`warm-pages.ts`/`thumb.ts` named no Studio e2e case, so the
840 slice did not run them. Tool fix (doc agent): the 851 related map also maps sources to e2e cases; the slice check
names them and refuses a commit without a green run. Bite: a `warm-pages.ts` change names "[Edited]". Queue: with 851.

861\. Doc agent and Linux builder (2026-11-11): the /tmp tmpfs (47G) filled up (ENOSPC); no Bash call of either agent
started, and the 859 push suite crashed in `commit-export.mjs` (symlink into `/tmp/push-suite-<sha>-*/node_modules`)
with no verdict line. About 20G was freed again before anyone could look. Suspect (not proven): a parallel e2e or repeat
run. Measured: a crashed or stopped suite leaves its export dir (two of 143M found). Tool fix (doc agent decision, tool
internal): the push suite checks free space on /tmp at start and refuses below 5G with a verdict line; it removes its
export dir on every exit path; at start it removes stale `push-suite-*` exports with no live owner. Bite: a spec with a
fake low free-space value refuses with the verdict line; a killed suite run leaves no export dir. Queue: Linux builder,
after 860.
Cause of the second block (measured, `df -i`): /tmp ran out of inodes (39 of 1048576 free) with 34G of bytes free.
The guard checks free inodes too (refuse below 50k). The human allowed deleting the leftovers (jest_rs, Playwright
profiles, push-suite exports, old tmp-<pid> dirs).

862\. Linux builder (2026-11-11, from 861), measured: /tmp held 1603 `playwright_chromiumdev_profile-*` dirs (83k inodes)
and about 81 `tmp-<pid>-*` dirs (about 208k inodes, 3355 each) from 2026-11-10 on, left by specs and tools. Suspect:
`browser.close()` and the tmp dir removal are not reached on a failure or kill path. Tool fix (doc agent decision, tool
internal): find the owners; each removes its profile and tmp dir on every exit path (also SIGTERM); the 861 start sweep
removes such dirs with no live owner. Bite: a killed run of the owner leaves no profile or tmp dir. Queue: with 861.

863\. Doc agent (2026-11-11): B480 (Windows spike on rack, ADR 0268: runs in a builder subagent) stopped silently. After
SAC was turned off at noon, no subagent ran it, the builder handoffs never named one, and the doc agent handoff said
"studio runs with CEF on rack" with no source. The human asked for the state and nobody had one. Suspect: the subagent
died with a builder restart, unnamed. Tool fix (doc agent decision, tool internal): a STATUS row in work by a subagent
carries the subagent's result file in its row; the builder `restart` refuses while such a row names no result file or a
result file older than the row's last start. Bite: a restart with B480 "in work" and no newer result file is refused.
Queue: Linux builder, after 862.
Cause (Linux builder, proven by the task notice): the subagent was not lost. A builder restart does not end the subagents
of the old conversation; the old B480 agent still ran beside the fresh one. The builder stopped the old one. The restart
guard of 863 and 864 also lists the live subagents of the session and refuses unless the handoff names each one.

864\. Doc agent (2026-11-11): a self-restart of the doc agent dropped an open grill question. At 15:22 the doc agent
asked the human Q1 "findings or STATUS rows first: one finding, then one STATUS row per builder from tomorrow". The human
did not answer. The handoff at 16:21 wrote "Open for the human: none", and the resumed session told the human "nothing
open". The human noticed. Cause: the handoff line is written from memory; nothing compares it with the questions the
session put in chat. Tool fix (doc agent decision, tool internal): `agent-sessions restart` reads the session transcript
and refuses while an assistant message with a `❓` question has no later human message, unless the handoff file names that
question verbatim under "Open for the human". Bite: a restart after an unanswered `❓` and a handoff with "none" is
refused. Queue: Linux builder, after 863.

865\. Doc agent (2026-11-11): two days after ADR 0234 (Studio work goes first, binding order), STATUS item 1 (B249) is
still open. On 2026-11-11 the builders made 80 code commits; 39 of them fix the agent machinery (push suite, /tmp, restart,
mailbox, archive), and 160 of 303 commits are plan notes. The doc agent sent the builder queues of findings only, and at
15:22 asked the human again "findings or STATUS rows first", which ADR 0234 already decides. The human: "irgendwie kommen
wir doch nicht weiter oder? fortschritt ist extrem lahm". Cause: the doc agent queues each new finding at once and never
checks the queue against "Gerade in Arbeit"; nothing in the tool does either. Tool fix (doc agent decision, tool internal):
a builder queue message names the STATUS item first; a finding in it carries "blocks: <item>" or "CI red", else it goes to
the tool backlog. Applied now: the Linux builder is back on B249 after 860. Queue: tool backlog.

866\. Doc agent (2026-11-11): the human saw STATUS still talk of "Go" after B249 removed the go system (ADR 0048). Eight
STATUS rows and bullets planned work on Go, go.json or Go hashes (B63, B70, B78, B83, B87, B98, B113, B175, B219, B280,
B319, update-dialog). Cause: the slices that removed `design go` and go.json never searched the plans for the removed
words; the doc agent did not either. Fix now: the doc agent deleted B70, B113, B219, B280 and reworded the rest. Tool fix
(doc agent decision, tool internal): the last slice that removes a concept greps `plans/ethlete-studio/STATUS.md` for its
words and closes or rewords each hit in the same commit; B249 slice 4 does it for Go. Side: machinery backlog for a
general check.

869\. Doc agent (2026-11-11): the 867 brief told the Linux builder to leave the design fix as a visible direct edit for
the human to merge. The human had already called the clip a defect and the canvas under the panel "as intended", so no
open choice existed; ADR 0211 and ADR 0256 say such an edit is committed and recorded as merged. The builder caught the
conflict with ADR 0256 before the commit. Cause: the doc agent wrote the fix line from the 228 pattern without the ADR
search it runs before a grill question. Lesson: a brief that routes a change to the human is a grill question in
disguise and needs the same ADR search. Tool fix: none (process; doc-agent rule already says search before asking).
Decision sent: commit all, name finding 867 and ADR 0211.

870\. Linux builder (2026-11-11, B480 Windows release CEF smoke on rack): Studio never leaves "Design-Server startet";
`design_server_state` stays `stale: true` for 230 s while `/__design/stamp` answers 200 with the same build. Cause (code +
measured body): `is_stale` (`apps/ethlete-studio/src-tauri/src/design_server.rs:242`) compares the whole JSON, but
`own_stamp` holds only {version, build} and the served body has eight more fields, so every served stamp reads as stale
on every OS. The spec near line 1012 uses a hand-written {version, build} body, so it never bit. Suspect: `judged_with`
caches a no-answer verdict per checkout+port until the port stops listening. Lesson: a spec for a parsed server answer
must take its fixture from a captured real body (AGENTS.md rule); the hand-written one hid the defect. Tool fix: compare
only version+build, spec with the captured body (bite first), never cache a no-answer verdict; rebuild on rack and re-run
the smoke. Side: user-facing; part of B480, which runs in parallel (ADR 0268). Built 2f8743432 (bites: real-body
spec and no-answer spec fail on old code); on rack `stale: false` now.

871\. Mac builder (2026-11-11, B345 slice 1, 82c6e3025): `et:design check` runs the committed CLI build, so it cannot see
an uncommitted server change; a builder checks the old server and reads the result as a check of its own change.
Suspect: the check resolves the CLI from the build output, not from source. Lesson: a check that cannot see the change
under test must say so, not pass. Tool fix: the check prints which CLI build it runs and warns when `libs/cli` has
uncommitted or unbuilt changes. Side: user-facing (every Studio project), after B249 (ADR 0269).

872\. Mac builder (2026-11-11, B345 slice 1): design check cannot drive the change-crop states of pages/sketches
("undrivable", 16 same aria-labels), so no design compare covered the new view before the live shot. Suspect: the harness
samples feed no crop data. Lesson: a state the harness cannot drive is a hole in compare, and it was found by the
builder, not reported by the tool as a gap. Tool fix: design check lists every undrivable state as a finding with its
part, and the harness samples carry crop data for the change-crop states. Side: user-facing, after B249 (ADR 0269).

873\. Mac builder (2026-11-11): `spec:stress` does not name the failing case, and `sketches.component.spec` first case
times out cold under load (2/4 stressed with cli specs, 4/4 alone; Suspect). Side: machinery backlog for the weekly
cleanup block (ADR 0269).
Cause of the spec flake (run-proved, 3a3e014f5): the first Angular JIT compile counted inside the first cases; pre-B345
code fails the same way. Fix: beforeAll warm-up, 3/3 runs 34/34. Machinery gap (same backlog): scratch:checkout copies
only the current checkout, so testing an older commit needs files overwritten by hand.

874\. Linux builder (2026-11-11, B480 after 870, rack): Studio still shows "Design-Server startet" after 241 s, 0 live
frames. Suspect (probe lost Studio mid-run): the page waits on `serverAnswers$` (`studio-view.component.ts:358`), which
fetches `http://localhost:4402/__design/stamp`; the server listens only on `::1:4402`; from PowerShell `localhost` gives
200, `127.0.0.1` is refused; an in-page CDP fetch to `localhost` got no answer in about 90 s. Lesson: no spec or e2e
fetches the server on both loopback addresses, so an IPv6-only bind passes on Linux and hangs on Windows. Tool fix: the
design server binds both loopback addresses (every OS); a spec or e2e fetches `127.0.0.1` and `::1` (bite first); re-run
the rack smoke. Side: user-facing; part of B480 (ADR 0268). B480 values after 870: runs yes, 0 live frames, installer
141.17 MiB, installed 467 MiB, NotSigned.
Cause (measured, 37eebcfda): not the bind. Chromium Local Network Access holds every fetch from http://tauri.localhost to
loopback for a `loopback-network` prompt that Windows CEF never shows (app fetch timed out 6 s with the permission at
`prompt`; a tab on localhost:4402 got 200 in 362 ms). Fix: `cef_runtime()` (`src-tauri/src/lib.rs`) allows
LOOPBACK_NETWORK by default; the test checks the runtime config, no real prompt (CI has no Windows CEF; backlog).
B480 values after 874: runs, stale false; live frames paint (12 frames, 100 pictures, shot
`.claude/handoffs/agent-results/b480/shot-874.png`); installer 141.17 MiB (old bundle), installed 453.2 MiB; NotSigned.

875\. Linux builder (2026-11-11, during 867): the tmux `studio-serve` (:4402) had crashed with a node stack trace; a
subagent restarted it. Cause unknown; the trace was not kept. Lesson: a crashed serve is visible to the human (Studio
waits on it) and leaves no record. Tool fix: `design serve` writes an uncaught error with its stack to a log file under
the project's design folder, and Studio shows "Design-Server abgestürzt" with the log path instead of waiting. Side:
user-facing, after B249 (ADR 0269).

876\. Doc agent (2026-11-11, live app shot of 867, `.claude/handoffs/agent-results/867/app-sketch-button2.png`): on
`components/button@off-centre` the "Aktuell" column label shows at x about 356 with no cells under it after a 20-25 s
wait, and only one block of state cells shows; the shot does not show where the variants a, b, c are. Suspect: the frames
of the "Aktuell" column did not load. Owed by the Linux builder: does the column stay empty after a full load, which
request is missing, and why the e2e does not fail on an empty column. Tool fix (if confirmed): e2e and render-check fail a
sketch column whose label has no cell under it after the listing is complete. Side: user-facing, after B249 (ADR 0269).

879\. Linux builder (2026-11-11, B480): `serverAnswers$` uses `fromFetch` with no timeout, so any hung request keeps
"Design-Server startet" forever (874 showed it). Lesson: a start screen that waits on a request with no timeout hides
every server fault. Tool fix: timeout plus retry, and after the timeout Studio says the server does not answer, with the
URL. Side: user-facing, after B249 (ADR 0269).

881\. Mac builder (2026-11-11, B345 slice 1): with several variant columns, the change crop is the union of all variant
boxes, but the reason text names the first variant only, so the reason of the other variants is lost. Accepted for now
by the human (ADR 0272). Tool fix: the reason line lists each variant's reason, or one line per variant under the crop.
Side: user-facing, after B249 (ADR 0269).

882\. Linux builder (2026-11-11, B249 5c-2 live): the merge view of an edit sketch lists nothing under "Geändert".
Suspect: the merge view reads the changed list from the variant compare, which an edit sketch does not feed. Tool fix: an
e2e case on an edit sketch merge view asserts the changed states. Side: B249 follow-up, after 5c.

884\. Linux builder (2026-11-11): CI red twice in one evening from apt, not from code: 04aebf37c at `yarn playwright install
--with-deps chromium` in about every job, 605ca993d at the Rust host apt fetch (404 for libsoup-3.0-dev_3.6.6-1ubuntu0.1;
the job runs `apt-get update` first, `ci.yml:370`). Cause: infra (mirror). Lesson: one mirror hiccup turns the whole run red
and costs a re-run plus a by-hand diagnosis each time. Tool fix: the apt and playwright install steps retry (3 tries,
`apt-get update` before each, `Acquire::Retries`); a step that still fails names the package and the mirror. Side: CI red
counts as blocking under ADR 0269, so the Linux builder builds it next after the B249 slice in work.

886\. Doc agent (2026-11-11): two ssh commands handed to the human for the Mac failed before the third worked: `zsh -lc`
finds no `yarn` (commit-msg hook), `zsh -ic` finds no `fnm` and `node` (pre-commit). Only `zsh -lic` loads both. Cause:
the Mac PATH needs the login profile (Homebrew) and `.zshrc` (fnm); the doc agent did not dry-run the command first. Lesson:
a command for the human costs a round trip per failure. Tool fix: the agent-sessions skill names `zsh -lic` as the one form
for a Mac command that runs git hooks, and the doc agent runs `ssh ethlete-mac 'zsh -lic "command -v yarn node"'` before
it hands a Mac command to the human. Side: process; no human decision.

889\. Linux builder (2026-11-11, B249 5c-2b e2e): a pick of `old` in a `<part>@edit` sketch does not write the exact HEAD
copy back: merge adds the variant authors to `madeBy` (`merge.ts:114`), and `old` has the author "design check", so the file
gains 'design check'. This breaks ADR 0135. Cause: e2e diff. Lesson: the 4b/4c e2e compared states, not the bytes against
HEAD. Tool fix: a merge of `old` in an `@edit` sketch adds no author, and the e2e case asserts `git diff --exit-code` on the
part after an `old` pick. Side: inside B249 (applies ADR 0135); the Linux builder builds it.

890\. Linux builder (2026-11-11, B249 5c-2b bite): `STUDIO_CLI_ENTRY` at an old cli is refused by `staleCliBuildMessage`
(`index.ts`), because the e2e checkout links the main checkout's `libs/cli`. Worked around with a scratch copy at the old
ref. Suspect: `yarn studio:e2e:bite <ref>` hits the same refusal (not run). Lesson: the bite path, the proof that a test
bites, had no test of its own. Tool fix: the stale check compares against the `libs/cli` the entry was built from, or bite
mode names its source dir; a spec runs bite mode on one old ref. Side: tool backlog.

893\. Linux builder (2026-11-11, 889 e2e): case 4c failed under `--hold-listings 14000` (pick timed out: the merge buttons
wait for the held listing). It also failed on the 5c-2b code, so the 5c-2b report "passes with hold" was wrong. Cause: e2e
run; fix 903adf5d0, pick waits for `listingAnswered` (hold 1/1, plain 1/1). Lesson: a "passes under X" claim in a report
had no log behind it. Tool fix: the e2e runner prints one result line with its flags (for example `hold=14000 4c pass`),
and a builder report quotes that line for each claimed run. Side: process plus e2e helper; Linux builder.

894\. Doc agent (2026-11-11): the grill round on app-wide button tokens recommended "put them in `@layer components` with
`:where()`", and the human accepted it. The SDK's own rule `libs/agent-rules/content/rules/app-styling.md:35` forbids
exactly that: SDK styles are injected into `@layer components` at runtime, after the app stylesheet, so an app rule there
ties on layer and specificity and loses on source order. fifagg-frontend caught it. Cause: the doc agent took the
recommendation from the docs page and did not search the agent rules. Lesson: a recommendation on app styling must be
checked against the shipped agent rules, not only the docs. Tool fix: the doc agent's fact check before a recommendation
greps `libs/agent-rules/content` too; and the docs page "Overriding component styles" names the runtime injection (it
says nothing about it today). Side: the decision is withdrawn; the Linux builder works out an SDK option; the human decides
again.
B249 investigation (report `.claude/handoffs/agent-results/b249-882-883-891.md`): 883 Cause (spec probe): only `@edit` sketches, so inside B249; `sketch-view.component.ts:775` emits the sketch name, `leaveGone` (system-view :1186) matches no part and falls back to the first. Fix: `leaveGone` picks `sketchPartOf(sketch)`; e2e asserts the open part per sketch kind (the e2e merge case merged by API, so the button path never ran). 882 Cause (live Playwright): Studio aborts every `/__design/sketch-compare` (17 aborts in 75 s) because the sketch revision keeps changing; Suspect: `sketchRevisionOf` (`frame-revisions.ts:109-118`) counts the redraws the compare itself causes. Second defect, Cause (API answer): every row has empty outlines, `merge-compare.ts:114/125` looks marks up by `sketch.target` instead of `targets[0]`. Tool fix: an e2e case asserts a "Geändert" row on an edit sketch. 891 closed as no defect: stale-record maps to "Wird geprüft" for about 2 min after a no-op edit (intended, build-ready.md); the 5c-2b API read and the shot were taken at different moments.

896\. Doc agent (2026-11-11): to shut `rack` down, the doc agent found its SSH target only by a grep over old session
transcripts: no plan, ADR or ssh config alias names it (`cef-runtime.md` says "over SSH" only). Cause: the B480 setup
notes leave out the address. Tool fix (tool internal): the builder adds the `rack` SSH target and the Windows host name
to the B480 setup notes in `plans/ethlete-studio/cef-runtime.md`. Queue: with the next rack batch (ADR 0273).

897\. Linux builder (2026-11-11): Claude Code killed the push suite of 903adf5d0 at about 20:31Z (system low on memory,
load 40), in the e2e step (log `.claude/handoffs/push-suite-e2e-20261111T203116243Z-3886201-0.log`). A spec helper
(pid 3335492, 8 h old, `node -e ... existsSync("/tmp/push-suite-log-vVycAR/go")`, polls every 10 ms) still runs.
Suspect (no code read yet): `push-suite.spec.mjs` does not kill its child when the "go" file never appears. Tool fix:
the spec kills the child in afterEach. Queue: tool backlog (ADR 0269, agent machinery).

899\. Linux builder (2026-11-11 night, B249 e2e 4c under `--hold-listings 14000`): the merged part's frame stayed empty.
Cause (probe + spec bite `canvas-frame-grid.component.spec.ts`): the `settledCells` linkedSignal of a state grid took an
inline source that read `grid()`; an equal re-read of the frames (held listing) reset the loaded count 7 -> 0, and loaded
imgs never fire `load` again, so the grid never revealed. Pre-existing, not from 487e24844. Built 57bac0dc0: the source is
a computed `shotsKey`. Suspect "aborted shot requests" refuted. Bite 883: with `leaveGone` reverted, 4c times out at the
open-part wait. Lesson: no spec set an equal grid input again while pictures load, and nothing flags a linkedSignal source
written as an inline function over an input (one more site: `loadedShot` in `canvas-frame.component.ts`, harmless). Tool
fix: a lint rule that asks for a computed source there. Open for the human (morning round): the rule would go into the
published `@ethlete/eslint-plugin`, so it changes lint for every consumer. Queue: tool backlog until decided.

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

901\. Mac builder (2026-11-11 night, B490 Mac shot): Chromium and WebKit equal, Noto Sans and Noto Sans Mono load from
dist and resolve for `--font-ui` / `--font-code`. But the Studio app body still renders Jost: `apps/ethlete-studio/src/styles.css:131`
body `font-family: var(--font-sans)` (Jost, `:66-67`, `--font-mono` IBM Plex Mono), `index.html:11` loads Jost + Plex
from Google Fonts, `canvas-frame.component.ts:122` uses `font-mono` (Plex). Text that inherits from body is Jost. The
Linux note "start view in Noto Sans" did not measure body. Suspect (code read): the compare missed it because every
design part sets `--font-ui` on its own root, so no part state sees the body font. Decided by the doc agent (applies
ADR 0262 + the design-part rule "the app implements the design, no drift" to the app root): body -> `var(--font-ui)`,
canvas-frame `font-mono` -> `--font-code`, drop `--font-sans`/`--font-mono` and the Google Fonts link, then compare the
embedding pages. Lesson: a part root that sets its own font hides the app's inherited font from every check. Tool fix
(builder default): the compare reads the computed font family of the app root and of each part host and fails when the
app root font is not the design's `--font-ui`; then a bite with Jost on body.

900 update (Linux builder, 785facf09): still Suspect, no Cause. Not reproduced in 7 runs (pair 2/2; pair + 6 heavy cases
on 8 workers 9/9; scratch with HEAD .ethlete + cold store 2/2; `--page System` 29/29 twice; pair --hold-listings 14000
2/2). The hang: `waitForSelector('ethlete-sketches [data-sk-state]', 120 s)` in `edit()` of `withEditSketch`
(canvas.e2e.mjs); 128 failed at 126.4 s, 41 pictures drawn vs 487 on a pass. Ruled out by runs: shared fixture, load,
dirty tree, cold store, 31d9002d7, 57bac0dc0. The failed case dropped the `design check` exit code and output; 785facf09
now names them, the sketch folder state and the page state on that timeout. Tool gaps (builder default, tool backlog):
on a failed case print the tail of the worker and design-server output; `studio:e2e --like-push-suite` for chosen cases.

903\. Linux builder (2026-11-11 night, 32b6013c6): after the merge of origin/next, `design check --product studio --part
pages/sketches` exits 1 with 42 OFF-CENTRE findings, all on `components/zoom-chip` text (1.5 px high, 1.2 px in
`narrow-below-fit`), across every pages/sketches state. The builder called it the known backlog 628-633; it is not
(those are SDK parts). Suspect: the B490 font switch (ADR 0262, 210235327) moved the zoom-chip text. ADR 0262 decides
the fix: the part's CSS. Work sent: measure at a commit before 210235327 vs HEAD, then fix the zoom-chip CSS. Lesson
(open until the builder reports): the B490 slice did not run a check over the studio parts that embed the changed font.

901 update (Mac builder, 44f8a4eeb): Cause (spec bite + live bite): compare copied the design frame root text style onto
the harness host before the app shot, so the part inherited the design font and the app body font was never seen. Fix:
`harnessShotOf` reads the computed font family of `document.body` and the harness host before that copy; a first family
that differs from the design root's first family fails the state with a problem line. Live bite: body Jost -> all 15
elements/shell-main states FAILED "app body renders in jost, design root font is noto sans"; reverted -> passes.

903 update (Linux builder): Cause (measured): OFF-CENTRE on studio `components/zoom-chip` is 0 at aaeef909d^ and 28 at
aaeef909d (B490 merge, `--font-ui` -> Noto Sans) and at HEAD; 210235327 only changes project.json. `apps/ethlete-studio/src/styles/sdk-token-map.css`
gives every `.et-button` line-height 1.5 at `--text-md` (13 px) = 19.5 px; Noto fills 18 px and Chromium puts the 1.5 px
spare below the text (pixel probe 8.75 above, 10 below). xs the same (17.25 px). A fix inside the chip trips
CONTROL-STATE and CANONICAL-CLASS; `--et-button-line-height` is `inherits: false`. Decided by the doc agent (applies ADR
0262: the hit is fixed in CSS; the cause sits in the Studio token map): whole-pixel `--text-*-line` line heights with
padding that keeps the heights, then compare --affected and new records. Why not caught: the B490 slice ran no rendered
check on a part that embeds zoom-chip, only static lint and two shots. Tool fix (builder default): a change to a global
style or font file counts as embedded by every part for the slice-end check.

908\. Linux builder (2026-11-12 night, 7c button tokens 6a29fdcb5, fifagg request): the new letter-spacing and
text-transform tokens are `@property` with `inherits: false` and initial values normal/none. On an `<a etButton>` these
used to inherit from the parent; now they reset. Suspect (code read, no before-measurement). The decision said "defaults =
today's values", so the doc agent sent: no `@property` for these two, `var()` with no fallback (invalid at computed time
-> inherit on `<a>`, UA normal/none on `<button>`), measured before/after on both hosts. Icon size: the existing
`--et-icon-button-icon-size` stays (doc agent, applies the decision). Lesson: a new token default was checked against
"today" by reading only; jsdom loads no component CSS, so no spec can see it. Tool fix (builder default): a
storybook-e2e case that reads the computed styles of a token default on every host element type (`<button>`, `<a>`),
run before and after a token change.

908 update (0db51f57b): Cause (measured, Chromium): the doc agent's no-fallback variant was wrong; an unset `var()` with
no fallback becomes `unset` and the author rule beats the UA sheet, so `<button>` inherited 2px/uppercase. Built: no
`@property`, `var(--et-button-letter-spacing, revert-layer)` (same for text-transform). Measured before = after on
`<a>` (inherited) and `<button>` (normal/none); token on host and on an ancestor applies. Open: WebKit and Firefox probe
before the push. Lesson: the doc agent sent a CSS mechanism it had not measured; send the intent and the probe, not an
unmeasured mechanism.
908: revert-layer fallback measured equal in Chromium 156, Firefox 157, WebKit 27.2 (Playwright builds); older iOS Safari not tested.

910\. Mac builder (2026-11-12 night, after 905): 19 "Alle Zustände zeigen" rows and 2 "Übernehmen" (2.) rows
(`withdrawn-hidden` / `-shown`) fail with "design draws no such element"; the props compare cannot check withdrawn,
agent, fold, question or port. Suspect: the design lacks elements the app draws, or the compare cannot match them. Probe
first: which side is wrong per row. Lesson: the props compare has no answer for app-only elements. Queue: Mac, after 909.

911\. Mac builder (2026-11-12 night, after 905): `apps/ethlete-studio/src/app/design-parts/inbox/inbox-sample.ts` and
`inbox.component.html` still hold the human's real name. Lesson: the person-name lint does not cover app sample data,
so 905 and 911 shipped a real name. Tool fix (builder default): `lint:person-names` scans app sources and samples
(`apps/ethlete-studio/src/**`), with a bite. Queue: Mac, first.

912\. Doc agent (2026-11-12 night): the batch 903-911 (8.5k chars) does not fit `design-to-code.md` (438558 of 440000);
`archive-findings.mjs --dry-run` moves 0. 229 findings have no STATUS row, 72 older than 5 days, none with a built line,
so the archive can never take them. Cause (measured: dry-run + `--orphans` counts). Lesson: the budget forces an archive
that has nothing it may move, so findings stop reaching the plan. Tool fix (builder default, after the 903 slice): old
orphan findings whose tool fix is a backlog row move to the archive with a one-line index entry; the archive names why
each old finding stays. Not: a higher budget.

903 update 2 (Linux, slice stopped, nothing committed): `--et-button-line-height` is an `@property` number, so a length
falls back to 1.5; the working fix sets `line-height: var(--text-md-line)` (xs `--text-sm-line`) on `.et-button` in
sdk-token-map.css plus padding. Measured: md 28 -> 28, xs 24 -> 24, xs with the kbd chip (title-search) 25.25 -> 26.5;
zoom-chip OFF-CENTRE 28 -> 0; pages/sketches 38 -> 1 (new: title-search text 1.3 px low). The visible-change gate refused
pages/sketches: states `sketch-only-points-open` and `edit-sketch` draw an overlay pane the app no longer opens, and the
look `[&_[data-camera-reset]_button]:font-ui-strong` matches nothing. Decided by the doc agent (applies ADR 0262 and
ADR 0209): the kbd chip in xs buttons sizes to the 16 px line; the two stale sketch states are fixed as a direct edit
naming ADR 0262 + 903; then the gate re-runs.

912 update (Linux, c35380b93): the archive tool now moves an old orphan finding when it has a built line or an entry in
the STATUS.md tool backlog paragraph, and prints why each old finding stays. Dry-run on the real plan: moves 0 (34 old
orphans have no built line and no backlog entry, 23 are open in STATUS, 4 are named in STATUS outside a row). The doc
agent classifies the 34 and adds built lines or backlog entries.

916\. Linux builder (2026-11-12 night, 903 slice): after the token-map patch, pages/sketches kept 1 OFF-CENTRE finding on
title-search. Cause (measured: the rule maths rebuilt at scale 0.2 gives the reported 1.4/0.1 px): OFF-CENTRE counts the
visually hidden "Control K" text inside `et-kbd`; its baseline sits below the 24 px button. At scale 1 the line-middle
test skips it, in the 0.2 thumbnail it does not. A false positive that blocked 903 (ADR 0202). Lesson: a render rule
judged hidden text only at one scale. Tool fix (builder default, built first): `libs/cli` `design/system/off-centre.ts`
skips text in clipped or visually hidden elements; spec with an xs button + `et-kbd` at scale 0.2.

919\. Doc agent (2026-11-12 night): an untracked ready sketch `.ethlete/design/studio/sketches/pages-sketches.edit`
(target `pages/sketches@edit`, createdAt 2026-11-11T23:42:43Z) appeared during the 903 slice; the builder did not know
its origin. Suspect: a step of the 903 direct edit wrote it. Lesson: a tool can leave a ready sketch with no owner and
no message. Tool fix (builder default, tool backlog): every sketch records the command and session that created it, and
`et:design status` names sketches no session claims.

919 update (Linux): Cause (code read + reproduced): `design check` (`accepted-pictures.ts` ~385) opens an old/new edit
sketch, author "design check", for every merged part whose folder differs from HEAD, and prints only a DIRECT EDIT line.
The 903 subagent restored the part; the sketch stayed. It is the intended ADR 0209 vehicle; deleted (untracked). Tool
fix (builder default, tool backlog): the check summary names each sketch it opened, and drops an edit sketch when its
part matches HEAD again.

921\. Mac builder (2026-11-12 night, 910 probe, group A): 19 "Alle Zustände zeigen" rows on pages/sketches are a design
defect. Cause (code read + compare): the app folds unchanged states per ADR 0132 (`foldedStatesOf`,
`sketches.component.ts:72`); the design draws the fold only with a hand-set `fold > 0` prop (`sketches.ts:644/689`),
although its own rows leave states unchanged. Lesson: a hand-set design prop can contradict the design's own data, and
no check sees it. Fix: a pages/sketches@all-states sketch that derives the fold from the rows and drops the prop; it
waits for the human's pick by merge. Tool fix (builder default, tool backlog): a design check flags a prop whose value a
sibling derived value contradicts, Suspect until a bite.

916 update (Linux): built in 516b5b8be (skips text under `clip-path: inset(50%)`, a zero clip, or overflow hidden on a
box of 1 px or less; bite: spec part components/visually-hidden at scale 0.2). OFF-CENTRE pages/sketches 38 -> 0,
zoom-chip 28 -> 0.

924\. Linux builder (2026-11-12 night, 903 slice): the visible-change gate refused the 903 commit: page-sketch 5744 ->
52852 px off the design over 238235493..HEAD (title-bar thumbnail rows about 15 px lower, a note wraps one more line,
"Übernehmen" shows twice). The first attempt passed with the same patch. Suspect: a commit in the range (7b/7c button
tokens) or the line-height patch. Next: bisect at 238235493, HEAD, HEAD + patch.

924 update (Linux): Cause (measured): the visible-change shots of pages/sketches are not deterministic; neither the patch
nor a commit in the range moves page-sketch. Two runs of the same code at 238235493: page-sketch 5744 vs 54552,
paused-reason 49443 vs 2573. At six bases (238235493 to 84c3f4926) the base app is 54552 each time, HEAD + patch 52852,
verdict PASS 6/6. What flips: the variant notes in the title-bar sketch header break at different words, and one more
line moves the rows about 16 px. Suspect (not traced): the note column width settles late (fonts, model chip load, or a
fit-zoom race in `design-parts/sketches`). Lesson: the gate judged one shot of a layout that had not settled. Tool fix
(builder default, tool backlog): shoot each state twice or after layout is stable, and report a state with two
different shots as unsettled, not judged.
924 closed (Linux builder, 2026-11-13, B500): no fix; the visible-change gate that shot pages/sketches is removed
(`check --visible-change` gone, its slow rule gone in 17375e4f3). See B500 check --visible-change as built.

911 update (Mac): design copy built in e1557311c (sketch merge, variant a, agent accept citing the doc agent's option A:
the existing no-real-name rule applied to the design copy of the same sample) + 08c6de8a3 (checker). The sketch also
covered components/comment-pin (9 hits in its shared file). Compare: only author text, initials and the pin glyph
changed, no layout shift. Checker: zero names under `.ethlete/design/<product>/{foundations,components,elements,pages,sketches}/`;
34 other files under `.ethlete/design/` stay baselined (31 comment records, capabilities.json, a call, a stale
sketch-data entry). Bite: the new case fails on the old checker.

903 update 3 (Linux, not committed): compare --affected against a HEAD baseline shows pages/sketches idle, paused and
paused-reason DIFF 2778 -> 49443, also without the token-map change; the variant-a note wraps 4 or 5 lines. Suspect: the
924 note-wrap flake (49443 is the exact flaky paused-reason value there); the builder repeats idle 4x with and without
the patch. edit-sketch FAILED on HEAD already (the zoom-chip look targets a missing element). The builder splits 903 into
two commits (finding 926).

903 update 4 (Linux, not committed): the patch causes the pages/sketches idle DIFF; not the 924 flake. Repeat: HEAD 2778
x4, patch 49443 x4. Cause (measured, bisect): each of the two app files alone moves it (`sdk-token-map.css` button
line-height, `title-search.component.ts` kbd leading); design files do not. The app's variant columns get about 5 px
wider and the rows move up 16 px; the design picture stays. Suspect (not checked): the shorter app page loses a vertical
scrollbar that the design frame keeps. Decided by the doc agent (applies ADR 0209 and the 903 decision; no look choice):
the design side gets the same button metrics as the app, from one source, then compare re-runs (finding 930).

930\. Linux builder (2026-11-12 night, 903 slice): a button metric fix in the app token map (`sdk-token-map.css`) moved the
app picture but not the design picture, so a correct fix showed as a 49443 px DIFF. Cause (measured): design and app
take button metrics from different sources. Lesson: an app-only token override makes design and app drift by
construction. Tool fix (builder default, tool backlog): design check flags a component token the app token map sets
that the design side does not, so a metric has one source.

933\. Linux builder (2026-11-12 night, 7d): the reported defect (a disabled filled et-button gets onColor.disabled ==
color.disabled, label and spinner invisible) does not reproduce. Measured in Chromium (story
components-actions-button-surface--default): the token chain falls back from `onColor.disabled` to `onColor.default`,
never to `color.disabled`; no generated `themes.css` in the repo has equal values. Not checked: a consumer theme that
spreads the colour map into onColor (`onColor: { ...COLOR_MAP, default }`). What reproduces is low contrast: Storybook
brand/surface about 3.0:1, Studio brand/danger/warning/surface 1.6-2.1:1. Cause (measured): Studio `colors.css` sets
`--on-*-disabled` very dark on dark muted fills, `generate-studio-themes.mjs` copies them, and `DARK_INTERACTION` has no
onColor, so the surface disabled label falls back to the surface background (15 15 15 on 56 56 56). Lesson: no check
measures disabled contrast (jsdom has no cascade, axe exempts disabled controls, design check skips disabled
elements, Studio themes are not in Storybook). Fix: a foundations/colors sketch with variants for the disabled label
contrast, waits for the human's pick by merge. Tool fix (builder default, tool backlog, Suspect until a bite): the theme
generators (`theme-css.ts`, tailwind-4, `generate-studio-themes.mjs`) warn when onColor.disabled vs color.disabled is
below 3:1, and when onColor spreads the colour map.

933 update (fifagg-frontend-52): the 7d defect is a consumer bug. Cause (named by the consumer, file
`libs/uikit/src/lib/presentation/theming/themes.ts` in fifagg-frontend): most themes set `onColor: { ...onColorDark,
disabled: '<same value as color.disabled>' }` by hand. fifagg fixes its theme file and drops its app token workaround;
no SDK fix. The generator warning of 933 (onColor.disabled vs color.disabled below 3:1) would have caught it.

930 update (Linux, withdrawn): the 930 Cause was wrong. Measured (Playwright on the app harness and the design
`frame.html`): one source holds already (`.ethlete/design/studio/styles.css` imports `apps/ethlete-studio/src/styles.css`,
which imports `sdk-token-map.css`; kbd line-height 14 px on both sides). The scrollbar Suspect is ruled out too. 930 has
no tool fix; the 903 DIFF Cause is below. Lesson (doc agent): it wrote "Cause" for its own inference from a bisect; an
inference stays "Suspect" until a measurement names the mechanism.

903 update 5 / 924 update 2 (Linux): Cause (measured): a font-load race in the pages/sketches matrix fit. The fit measures
the state-label gutter (font-code labels). The design `mountFit` (`pages/sketches/shared/sketch-rows.ts`) fits once while
Noto Sans Mono still loads (gutter 141.6 px, frames 205.6 px) and never refits; the app
(`design-parts/sketches/sketches.component.ts`) refits after the font on an Angular re-render (gutter 138, frames 206.5),
so the columns are 5 px wider and the rows move 16 px. HEAD matched only because neither side refit. Likely also the 924
flake. Trial `void document.fonts.ready.then(fit)` in mountFit: idle, paused, paused-reason 2785 (HEAD idle 2778). Fix
(builder default, direct edit naming 903 + 924): both fits re-run on `document.fonts.ready`; then 903 lands as commit A
(title-search + token map) and commit B (pages/sketches @edit merge). Tool fix (builder default, tool backlog, with 924):
the check shoots after `document.fonts.ready` and flags a layout that changes after the fonts load.

903 update 6 (Linux): built in c538efb84 (shared button metrics, title-search design + app, the app sketches fit refits
on `document.fonts.ready`), 1c0421859 (pages/sketches@edit merge, direct edit by ADR 0262 + 903 + 924) and cc0a514d1
(changeset). Measured: pages/sketches idle, paused and paused-reason 2785 (HEAD 2778); page-sketch 52852 -> 2785;
OFF-CENTRE 0 on title-search, zoom-chip and pages/sketches (was 38); xs + kbd 24 px. Not verified: a live shot of the
app's pages/sketches (asked for).

933 update 2 (Linux, not ready, not committed): the sketch `foundations-colors` (variants a >= 3:1, b >= 4.5:1, a new
`--on-surface-disabled` token that `generate-studio-themes.mjs` must read after a pick) is in progress. `sketch ready`
refused variant a: the part's contrast rule wants 4.5:1 for every ink chip. Decided by the doc agent (WCAG 1.4.3 exempts
disabled controls; the look choice stays with the human): variant a declares `definePart({ contrast: { exceptions } })`
for its 4 disabled chips, so the human compares both floors.

944\. Linux builder (2026-11-12 night, 933): `sketch new --name "..."` parses the name as a target. Tool fix (builder
default, tool backlog): `--name` takes a value, with a spec. Same class (Linux, 900): `yarn studio:e2e --help` has no help and
starts the full suite.

933 update 3 (Linux, 63d53b7b6): the sketch `foundations/colors` (studio) is ready, variants a (4 disabled-label chips
with a contrast exception, WCAG 1.4.3, ratios 3.1-3.4) and b (no exception, 4.7-5.1). It waits for the human's pick by
merge. After a pick, `generate-studio-themes.mjs` must read the new `--on-surface-disabled` token (DARK_INTERACTION onColor).
933 update 4 (Linux): landed. Variant c merged in ecd17055e; f8786104a makes `generate-studio-themes.mjs` read `--surface-disabled` and `--on-surface-disabled` (DARK_INTERACTION color.disabled and onColor). Live Studio, disabled filled buttons: brand 3.28, warning 3.48, danger 3.28, surface 3.28:1 on every elevation. Tool gap: `sketch merge` does not run the product's `generated` command, so a foundations/colors merge is red until the generated files match the variant.

894 update (Linux, 7e, measured in Chromium, table `.claude/handoffs/agent-results/7e.md`): the conflict exists only for
an app rule in `@layer components` or for tokens; an app rule in `@layer utilities` or unlayered beats every SDK rule,
the internal button rules too (pagination, scheduler today-button, scrollable-buttons, carousel play-toggle, toolbar
pressed icon-button). Option 1 (builder recommends): all SDK component CSS in one sublayer `@layer components.sdk` (236
files, mechanical); an app rule in `@layer components` then wins on every button in any injection order; behaviour
change for apps with low-specificity rules in `components`, changeset plus docs note, no migration; two sublayers fail
(measured). Option 2 (private tokens on internal buttons) misses the goal. Option 3 (public token first in a fallback
chain) is blocked by `@property --et-button-padding` (initial value, `inherits: false`). Short term the shipped rule
(`app-styling.md:33-38`, unlayered or `@layer utilities`) already works. Decision for the human in the morning round.

7f built (Linux, 6700dfd3d components + core, 00abccaea cli): a loading button keeps its normal colours; the
`aria-disabled` look skips `[data-loading='true']`. Bite: new e2e `button / loading look` failed 4/4 without the fix,
passed 4/4 with it. A disabled `<a>` that loads now looks normal (clicks stay blocked); decided by the doc agent: accept,
it applies the human's 7f decision (loading keeps normal colours) to a rare case.

879 update (Linux, 405ad80ee): `serverAnswers$` has a 5 s `timeout` per stamp request before `retry`; bite: the new spec
failed without the fix. The visible half (a "server does not answer, URL" screen) is new UI in elements/shell-main, so
decided by the doc agent (night shift, look questions go to a sketch): the builder sketches state `unanswered` on
elements/shell-main, marks it ready, and the human picks by merge in the morning; wiring (30 s wait, signal, spec) after
the pick.

879 update 2 (Linux, 150df1db6): the elements/shell-main sketch is ready, one variant `a` (state `server-unanswered`:
the `starting` screen plus one muted line "Design-Server antwortet nicht: http://localhost:4402"; no other state
changes). It waits for the human's pick by merge; wiring after the pick. The LOST-SURFACE lines for the project-picker
states are the known shell-main ones (line 541), no new finding.

A24 (Linux, 6fb0ba194): the pages/merge sketch is ready, variants a (one disclosure with part headings; builder
recommends), b (one disclosure per part), c (one disclosure with a nested one per part). It waits for the human's pick by
merge. After the pick: `sketch-view.component.ts:453` groups `compare.unchanged` by part, MergeUnchanged becomes a list
of parts, with a biting spec.

A24 app (Linux, 2026-11-12, as built): the merge page draws one disclosure per part (design b, 2014b27cd);
groups share one `unchanged` toggle. Verified: two biting specs; merge-error DIFF 2 px also at HEAD (known). Not
verified: a live compare.

921 update (Mac, b9802b4d6): the pages/sketches all-states sketch is ready, not merged. Variant a: no fold prop; the
unchanged states fold from the rows in every state except while comparing (what the app already does); 18 narrow states
redraw. Variant b (foldSame switch) drew the same pixels as Aktuell and was withdrawn. It waits for the human's pick by
merge (a, or reject and keep fold 3; the Mac recommends a). Screen mode still uses `UNCHANGED_COUNT = 16`.

955\. Linux builder (2026-11-12 night, 941): the sketch-check resident has no idle exit, so a resident started by a
subagent's `sketch check` keeps its Chromium (a 4.5 GB GPU process) after the subagent ends. Suspect (owner not checked,
not measured). Tool fix (builder default, tool backlog): the resident stops itself after N idle minutes, with a spec. Same class (Linux, 900): the e2e tool removes
a temp checkout without stopping its resident, so 3 `design __resident --checkout /tmp/studio-canvas-e2e-*` (about 0.75
GB each) stay and `design stop` cannot find them; the teardown must stop the resident first.

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

955 update (Linux, 6e15e4093): Cause of the e2e orphan residents (bite): at teardown the design server dies on `write
EPIPE` after the rmSync; the 875 crash log (4ca55ca3c) then mkdirs `<checkout>/.ethlete/cache` and writes its log, so
the checkout exists again and the resident's checkout-gone watcher (8a22c93af) never fires. Fix: crash-log.ts writes no
log when the target is gone. The spec fails without the fix; one e2e case on 4 workers left no resident and no checkout.

966\. Linux builder (2026-11-12 night, 955): older leftover dirs (for example `/tmp/studio-canvas-e2e-Ewd1tR`) hold
`node_modules/.design-explore/part-shots` written after the rm. Suspect (code read): the shot store recreates the checkout
like the crash log did. Tool fix (builder default, tool backlog): the shot store writes nothing into a removed checkout,
with a biting spec.

974\. Linux builder (2026-11-12 night, 927): with `dist/libs/components/design` missing, the design-mocks guard says the
folder "differs from" the source and lists 55 files; the build command it names is right. Cause (seen live). Tool fix
(builder default, tool backlog): a missing folder gives one line that names it missing, with a biting spec.

976\. Mac builder (2026-11-12 night, 926): a merge refusal advice ("run sketch rebase") could not fix its cause, and no spec
applied the advice. Tool fix (builder default, tool backlog): every merge refusal that names a remedy gets a spec that
applies the remedy and checks that the merge then passes. Suspect (code read): SKETCH-BASE-STALE (staleSketchBasesOf) loops
the same way when the dirty part is the drawn-on part; the new specs cover it.

979\. Linux builder (2026-11-12 night): CI on origin/next red (Unit tests, run 43153034062) from the Mac's 4a24296fd:
`run-load.spec.mjs` "the --load busy loops end when the run gets SIGINT" left 2 of 3 busy loops alive, though the Mac
push-suite passed. Cause (probe, 15 of 15 leaked): `ci-like-load.mjs` BUSY reads `process.ppid` in the child; if the
parent exits first, the child stores the reaper pid and spins forever. Fix (probe, 0 of 15): pass the parent pid as an
argument. Lesson: a timing race passes one local run; the push gate ran the spec once. Tool fix (builder default, Mac
builds it on origin first): the fix plus a spec:stress repeat that bites on the old BUSY.

979 fix (Mac, 95a46cf1b, pushed): `ci-like-load.mjs` BUSY reads the parent pid from argv[1]; startBusyLoops passes it
through pinnedCommand. Bite only on Linux (probe 15/15 -> 0/15); macOS never reproduced the race (0/10). No stress repeat:
spec:stress runs vitest only. CI run 43158747719 on 95a46cf1b was in progress at the report.

981\. Linux builder (2026-11-12 night, 946): a `ready.json` record's `cmd` holds the writer's argv, so 20 entries written by a
server read only "design". Cause (measured). Tool fix (builder default, tool backlog): record the command name
(check, slow-run, ready) in `cmd`, with a spec.

Ready records committed (Linux, da1ed6296) after a fresh `design check` (946 decision): studio 26 hits, sdk 1283; the check
dropped the records of studio foundations/colors and of comment-target, hold-trigger, list-row and comment-row (missing
states). Slow checks on :4402: components/title-bar (7 states) and components/update-dialog (4) fail the visible-change gate.
981 gate line closed (Linux builder, 2026-11-13, B500): the visible-change gate is removed from check, serve and the
CLI; title-bar and update-dialog no longer reach it. See B500 check --visible-change as built. 981 itself (`cmd`) stays
open.

986\. Linux builder (2026-11-12 night, 941): the design server heap leak behind 941 is not hunted. Suspect: the resident or
the shot browser pool. Tool fix (builder default, tool backlog): a heap snapshot diff over two hours of `design serve`
names the retainer; then a fix with a spec that bounds the heap over 200 shots.
986 update (Linux builder, 2026-11-13, B499 S6): not reproduced; main heap +1.1 MB a round over 200 shots with listings (see B499 S6 as built). Stays open.

988\. Linux builder (2026-11-12 night, 951): `sketch check` stays at about 30 s against its 10 s target; aktuell (~11 s)
and changes-shot (~7 s) take most of it. Cause (measured, 951). Tool fix (builder default, tool backlog): make the aktuell
and changes-shot steps faster, measured against the 951 numbers.

990\. Linux builder (2026-11-12 night): /tmp reached 99 % inodes (1,028,315 of 1,048,576) and ENOSPC failed unrelated
specs (commit-export, e2e-check, red-check). Holders: 1,647 playwright-artifacts-* dirs, node-compile-cache,
et-design-harness-cache, jest_rs, studio-verify*. Suspect: killed or crashed Playwright runs leave their artifacts dir.
Why no tool caught it: no run checks free inodes, and 906/907/965 cover only our own temp prefixes and residents. Tool fix
(builder default, tool backlog): the push suite and the e2e runners check /tmp inode use at start and stop with one clear
line past 90 %; Playwright runs get a private artifacts dir that the runner removes on every exit. The sweep itself needs
the human (the builder's sweep was refused by the permission check).

B494 timer part built (Linux, 7f71406ec): tools/scripts/tmp-sweep.mjs deletes /tmp top-level entries with our prefixes
(26 spec-only prefixes added) and old entries in ~/.cache/claude-tmp, only when the newest inner mtime is older than 6 h
and no process holds them (/proc). Caches and claude-1000 stay. `yarn tmp-sweep:install` writes and enables an hourly
systemd user timer (node by its resolved fnm path; rerun after a node change). agent-sessions `run`, `restart --process`
and the shell functions set CLAUDE_CODE_TMPDIR=~/.cache/claude-tmp. Spec bites. Not verified: installed units, a real
session in ~/.cache/claude-tmp. Not swept on purpose: yarn--_, xfs-_, playwright_chromiumdev_profile-_, e2e-tokens-_, and
tool-run dirs (the leak check decides on those).

901 as built: the app body now uses `var(--font-ui)` (Noto Sans) and the canvas frame uses `font-(--font-code)`; the `--font-sans` (Jost) and `--font-mono` (IBM Plex Mono) variables and the Google Fonts link in index.html are removed. Commit: see `git log` for "Render the app text in the design fonts". Verified: related specs, lint, production build and the measured body font (see the commit report).

901 tool fix as built: `et design compare` now reads the computed font-family of the app body and of the harness
host (before the design's text ambient is set on it) and fails each state with "the app's body renders in X, but the
design's root font is Y" when the first family differs from the design frame root's. Cause (proven by the bite): the
harness host is drawn in the design frame root's text ambient, so the part never inherits the app's body font. Verified:
a new spec fails on the old code; with the body set to 'Jost' the studio `elements/shell-main` compare failed every
state with the new line, and passed the check after the revert (its pre-existing project-picker pixel diff stays). No
sdk part has an `implements` link, so the check has no sdk hits.

911 as built: the inbox sample, its template pin and four specs under `apps/ethlete-studio/src` named a real person; they
now use "human" with the initials "H". `check-person-names` already scanned `apps/`, but the baseline let those files
pass, so it now ignores baseline entries for `apps/ethlete-studio/src/` and the entries were removed. A spec fails on the
old code. The design's inbox sample (`.ethlete/design/studio`) still draws the old name and initials; it is a design
file and was not touched.

911 design as built: the design's sample author in `components/comment-row`, `pages/inbox` and `components/comment-pin`
named a real person; it is now "human" with the initials "H", like the app samples. One sketch with the three targets,
merged as an agent accept on finding 911 option A (`e1557311c`); the shots showed only the author text, initials and pin
glyph changing (no layout shift). `check-person-names` now ignores baseline entries for design parts and sketches
(`.ethlete/design/<product>/{foundations,components,elements,pages,sketches}/`) and those entries were removed; comment
records, `capabilities.json` and old calls keep their baseline. A spec fails on the old checker. The three part checks
had 0 findings before and after.

922 as built: `SketchRow` has `withdrawn?: string` (the agent's reason, empty when it gave none) and
`SketchesComponent` a `withdrawn` model (`'hidden' | 'shown'`, default `'hidden'`). With a withdrawn row the picker
line shows the SDK switch "Zurückgezogene (n)" in an `et-choice-field size="sm" color="brand"`; hidden rows leave the
list before the fold and the same-row grouping, as in the design's `visibleRows`. A shown withdrawn row reads "Vom Agent
zurückgezogen: …" (the `systemTree` labels) in place of "Übernehmen", drops its pin and dims its stage to 60 %.
`sketch-view` fills `withdrawn` from `rejectionOf(...).status === 'withdrawn'` and binds `[(withdrawn)]`; the harness
sample marks variant b of the narrow sample with the design's reason. The two stale `withdrawn-*` DROPPED-PROP entries
left `rule-baseline.json`. Verified: the spec fails without the change and passes with it; compare turns
`withdrawn-hidden`/`withdrawn-shown` from FAILED (dropped prop) to DIFF 84596/88947 px; the shot shows the switch, mark
and dimming as drawn, the rest is the fold of the `fit-*` states that `narrow-part` (84885 px) has too. `design check`
for pages/sketches lists 4 DROPPED-PROP findings (points, screen) that HEAD has too; pages/flows has 0. Not verified:
a live shot of the Studio app with a real withdrawn variant, and no spec covers the `sketch-view` mapping.

921 in progress: sketch `pages/sketches@all-states` (`.ethlete/design/studio/sketches/pages-sketches.all-states`) is
ready and waits for the human's pick; nothing is merged and the app is unchanged. Variant a drops the `fold` count and
folds the states no variant row changes, from `unchangedStates(part)` in the sketch's `shared/sketch-rows.ts` (none when
every state is unchanged; then the same-row fold applies), in every state of the part except while comparing, as the
app already folds (the `fit-*` DIFF of `narrow-part` and `withdrawn-*` in 922). For the narrow sample that is `STEADY`
(fit-hover, fit-active, fit-focus-visible). Variant b, a `foldSame` switch for the `folded` state only, drew the same
pixels as Aktuell in every state (the last three states are exactly `STEADY`), so it is withdrawn: a code-only change
is no pick. The screen mode keeps `UNCHANGED_COUNT`: the page's own state list is not reachable from `shared/`.

925 as built: Cause (verified): `pre-push-checks.mjs` ran `yarn lint:person-names`, which lists `git ls-files` and
reads the working tree, so another session's uncommitted file refused a push of clean commits. The pre-push call is now
`check-person-names.mjs --range <base> <head>`: it checks the files `git diff --name-only <base> <head>` changed and
reads each one, and the baseline, with `git show <head>:<path>`, as `.husky/format-check-committed.mjs` does. Plain
`yarn lint:person-names` still reads the tree, `--staged` the index. Spec: `check-person-names.spec.mjs` (uncommitted
hit over a clean range passes, committed hit fails) and `lint-changesets.spec.mjs` (the pre-push wiring); both failed
before the fix. A 20-commit range takes about 3.5 s. Follow-up: the first wiring called
`node tools/scripts/check-person-names.mjs` relative to the cwd, and the push-suite checks fixture has no such file, so
`push-suite.spec.mjs` failed. `pre-push-checks.mjs` resolves the script from its own directory now; the yarn script is
no way out, since the fixture stubs it as `node -e 0`, which rejects `--range`. `yarn test:tools` would have caught it, and is the per-slice check for a change in `tools/scripts`.

929 as built: `yarn studio:e2e --load <n>` starts n busy loops once the run holds the heavy run lock, through
`startRunLoad` in `apps/ethlete-studio/e2e/run-load.mjs`, which calls `startBusyLoops` from
`tools/scripts/ci-like-load.mjs` unpinned. Each loop ends once its parent is gone, and the lead also kills them on
`exit`, so a failed, interrupted or killed run leaks none (`ps` showed 0 after every run). An invalid value exits 2;
failure lines and the start line name the busy loops, and the 90 s goal line is skipped under load. Spec:
`run-load.spec.mjs` (arg parsing, refusal, and the loops ending on stop, `process.exit(1)`, SIGINT and SIGKILL); with a
plain `for(;;)` loop the SIGINT and SIGKILL cases fail, and without the exit hook the exit case fails too. Picture cases:
"a sketch cell edited on disk while scrolled away shows its new picture on return" waited one 10 s window for a new
URL and a drawn picture; it now waits 10 s for the URL and 60 s for the drawing, and reports both times. Cause (probe):
under `--load 24` its new URL came at 21.2 s and the drawing 47 ms later; under `--load 12` at 5.4 s and 5 ms later. So
this case fails under heavy load on the URL stage, not the draw, and the split names that stage; whether the URL budget
should grow is open. Checked and left, no shared new-and-drawn window: "a part shown before paints every stored picture
in the first frame", "a sketch scroll never empties a cell that had a picture", "a sketch keeps its frame count and
pictures through a sketch edit" (a fixed watch window), "page switch time is logged to the design timings" (records
mounted, first and all painted separately), "the sketch view at 30 % and 100 % draws no failed picture ...".

904 as built: `write-build-info.mts` stamps `commit` (`git rev-parse HEAD`) into `build-info.json`; the copies
`yarn et:design` runs from `tmp/studio-cli/<sha>` already carried it as `pinned-commit`. `runningCliStaleWarning` in
`libs/cli/src/lib/design/stale-cli-dist.ts` now reads that commit and runs one `git diff --quiet <commit>` over the
built paths of `libs/cli` (specs and `.md` excluded); a change prints one stderr line naming the commit. A build made
from uncommitted sources stays silent while its `sourceHash` still matches them. Silent under `node_modules`, for an
unknown commit and outside git. Cause of the miss (probe): the B191 check (2086f4cda) returned null unless the CLI ran
from `dist/libs/cli`, and `yarn et:design` runs a copy under `tmp/studio-cli/`; `runningCliStaleWarning()` loaded
from the 448c47f16 copy returned null. Spec: `build-commit.spec.ts` (temp git repo); it also caught the build dir's own
`src` being taken for the source root.

963 as built: push:suite already held the heavy run lock (`tools/scripts/heavy-run-lock.mjs`, `$TMPDIR/ethlete-heavy-run.lock`,
`{ pid, name, started }`) from before its checks until its verdict, so over studio:e2e and the repeat runs; its
children inherit `ETHLETE_HEAVY_RUN_HELD` and take none. A dead holder's lock is taken over, and a signal before the
export leaves only such a stale file. studio:e2e, spec:stress and ci-like-load took it already. New:
`waitForNoHeavyRun` waits without taking the lock, and `tools/scripts/heavy-gate.mjs <name> [--no-wait] -- <cmd>`
wraps `yarn test:tools`, `yarn test:e2e-helpers` and the nx build of `yarn verify:webkit-studio`. It prints one
`<name>: waiting for push-suite (pid N, since T)` line and runs the command when the holder ends or dies; with
`--no-wait` (or `ETHLETE_HEAVY_NO_WAIT=1`), or after 60 min, it prints one line and exits 2. Default wait, as
studio:e2e and spec:stress do: the slice's check runs late instead of failing into a retry loop. Spec:
`heavy-gate.spec.mjs`; with the holder check removed the refuse, wait and limit cases fail, without the held-env check
the owner case fails. Still unchecked: `npx nx ...`, `npx vitest ...`, `node --test <file>` and `yarn design` (its
`nx build cli`). Suggestion: an Nx `preTasksExecution` hook in a local plugin in `nx.json` that calls
`waitForNoHeavyRun`; Suspect: under the Nx daemon the hook runs in the daemon process, so it would not see the
caller's `ETHLETE_HEAVY_RUN_HELD` and would block push:suite's own builds unless they run with `NX_DAEMON=false`
(push:suite sets that).

926 as built: Cause: the merge checks in a clean copy of HEAD plus the sketch and, for an @edit sketch, its own part
folder. A part the edit embeds (here `title-search`) with an uncommitted change stays at HEAD in the copy, so its hash
misses the baseline the sketch recorded from the checkout, and `sketch rebase` records the same checkout state again.
Choice: the refusal names the commit order, not a clean copy that takes the other changed parts, because a merge must
not pass on content its commit will not hold (ADR 0206). `merge.ts` `commitOrderRefusalOf`: each conflicting part
whose checkout state still holds the baseline hash is named as "holds uncommitted changes that <sketch> was drawn on
... commit <parts> first, then merge <sketch>"; a part that really changed keeps the rebase advice. Spec:
`edit-sketch.spec.ts` (an embedded `components/button` with an uncommitted change: refused with the commit order,
merges after the commit); before the fix it got the rebase advice.

973 as built: `tools/scripts/nx-heavy-wait.mjs` is a local Nx plugin in `nx.json` whose `preTasksExecution` calls
`waitForNoHeavyRun('nx')`, so a direct `npx nx ...` waits while push:suite or studio:e2e holds the heavy run lock. Probe
(Nx 24.0.2, `cli:lint` in a scratch copy): Cause: with the daemon off the hook runs in a plugin worker the CLI spawns,
sees the caller's `ETHLETE_HEAVY_RUN_HELD`, and its stderr reaches the caller. Cause: with the daemon on it runs in a
worker under the daemon that gets the caller's env per call (held `222`, `333`, then unset, each seen), but its stderr
goes to the daemon log, and Nx does not forward `TMPDIR`: the daemon's `os.tmpdir()` is `/tmp`, the callers' lock is in
the macOS per-user temp dir, so the first daemon-on refusal check ran the task. `lockFileOf` reads that dir with
`getconf DARWIN_USER_TEMP_DIR` when `TMPDIR` is unset; after it the daemon-on check refuses too. Cause: the worker
cannot exit the CLI with 2 (`process.exit(2)` reads "Plugin worker exited unexpectedly", exit 1), so the hook throws the
heavy-gate line instead: one `NX nx: heavy run lock held by ...; run again after it ends` line, exit 1. Cause: Nx fails
an isolated plugin call after 10 min, so the hook waits at most 9 min, then refuses. A lock-holder child, no lock or a
dead holder return at once; `ETHLETE_HEAVY_NO_WAIT=1` refuses at once. Exempt with `ETHLETE_HEAVY_EXEMPT=design`: `yarn
design`, `yarn design:check` and the cli/app builds of `studio-code.mjs` (et:design, studio app serve). Added time on a
cached no-lock `cli:lint`: about 450 ms daemon off (1.83 s to 2.28 s), 200-900 ms daemon on, nearly all of it the worker
start. Spec: `nx-heavy-wait.spec.mjs`; without the exempt check, the env handoff, the holder check or the no-wait flag,
or with `lockFileOf` ignoring the daemon case, a case fails. Suspect: two daemon callers at once share the worker's env,
so one may see the other's held or exempt flag.

### As built: 982

`lockFileOf` moved into `heavy-run-lock.mjs`; env `ETHLETE_HEAVY_LOCK_FILE` wins over the TMPDIR/darwin logic, and
every lock taker and waiter resolves through it. `takeHeavyLock` throws when `NODE_TEST_CONTEXT` is set and no file
option or env override is given. The lock specs, the spec-stress `--github` case and the push:suite checks case now
pass a private lock file (the last two took the real lock before). Verified: the guard spec fails with the guard off
(the child prints `took`); `yarn test:tools` 424/425, the one failure an e2e-check timing case that passes alone; the
real lock file was absent before and after. Not verified: a live `push:suite` or Nx daemon run with the moved resolver.

### As built: 976

Each sketch merge refusal that names a remedy has a spec that applies the remedy and then merges:
`merge-remedies.spec.ts` (not ready; no pick; rejected pick - reopen; no baseline - rebase; changed part - port and
rebase; uncommitted drawn-on part - commit; uncommitted edits in the way - revert, or commit then rebase; product not
in the committed config.json - commit it; another part imports @shared/ - move the code in; the three `mergeStepOf`
refusals), `merge-shared.spec.ts` (orphan shared/ file - delete it; target's own shared/ folder - rename it),
`design-lint.spec.ts` (new lint warnings - fix them). Through the API, rejecting the picked variant drops the pick, so
the "rejected - reopen it first" refusal only meets a sketch file that holds both; the spec builds that state.

Cause (bite in `sketch-base-stale-remedy.spec.ts`): a sketch drawn while its own part had an uncommitted change
records a baseline no commit holds; SKETCH-BASE-STALE names `sketch rebase`, `portBaseChanges` refuses "no commit holds
the state the baseline recorded, port it by hand", and the refusal said "then run sketch rebase again", so following it
ran the same rebase three times with the same refusal. Only `--ported` clears it. The refusal now names the full
`sketch rebase <target> --ported --product <name> --by <model id>` command; the spec follows the printed remedies, clears
SKETCH-BASE-STALE, and merges after the part is committed. Not verified: the "built-in base - --override" refusal has
no spec (the fixture has no built-in base).

### As built: 977

Cause: a refused `merge --allowed-by` kept its agent pick in `sketch.json`; a later `--variant b` merged the stale `a`.
Now a refused allowed merge and the `mergeStepOf` pre-check restore the sketch, and a pick by a model id counts as no
pick. Verified: three biting specs, related specs, lint, typecheck. Not verified: a live run; a non-model-id `--by`.

998\. Linux builder (2026-11-12, push round): CI on origin/next red (run 43190178268): timetrack-app:audit-rust fails on
RUSTSEC-2026-0502 (sqlcipher-src 419.0.6, advisory of 2026-10-30); fix rusqlite 0.41 -> 0.42 goes into the push round.
Second occurrence of 655: 655 (2) built a scheduled `rust-audit.yml` on 2026-11-11, and still nothing warned before the
push. Suspect: the scheduled run did not run, failed unseen, or `et design status` does not read it. Blocking (CI red),
so numbered. Tool fix (Linux, after the push): find which of the three, and make a red scheduled audit show in
`et design status` like a red push run.

998 update (Linux builder): Cause (proven with gh and git): the scheduled audit never ran. GitHub runs a `schedule`
trigger only from the default branch `main`, and `rust-audit.yml` exists only on `next`; `gh run list` shows no schedule
run. Second gap: nothing in tools/, libs/cli or Studio reads rust-audit runs. Fix choice goes to the human (a commit on
`main`).

B499 proof (ADR 0280, recorded 2026-11-13 by the doc agent from the builder's proposal), one script
`tools/scripts/design-server-proof.mjs`:

- P1 sketch check cold ≤ 10 s, warm ≤ 5 s (3 runs), also with CI=1 (today cold 30.4 s, warm 3.5-6.8 s).
- P2 shot 5 runs: from run 2 no server or browser start, each ≤ 2 s (today 8.9 s).
- P3 one owner: with `design serve` up, after sketch check, shot and compare, one design process and one Chrome root
  per checkout (today 2 servers, up to 3 browser roots).
- P4 idle end: idle 60 s in the test; after 90 s no server and no Chromium left.
- P5 e2e "B498 R3" case 5x through studio:e2e:repeat: 0 empty cells, 0 ECONNRESET; Studio e2e on CI green twice.
- P6 no main-thread block > 1 s during a slow-checks poll (today ~14 s); warm /__design/system ≤ 300 ms; cold
  open-points ≤ 1.5 s (today 2.6 s).
- P7 spec: two parallel rules() calls make 1 worker run; abort of the last waiter cancels the work.

Slices: S1 rebuildStaleDist from the owning Nx root, async; S2 `design serve` and `__resident` one process (CI flag
first; the slice names when the flag goes); S3 rules() shares an in-flight run, abort, one idle end; S4 slow-checks and
class facts into the worker (the disk cache for class facts names which cache or step it removes); S5 cold path of
sketch check and ready; S6 CI stability (992, 986, 519/598 guards). 417, 519, 598, 640 close with a guard only.

A8 as built (Linux builder, 2026-11-13): 16 native `title` bindings in apps/ethlete-studio/src became `etTooltip`
(`TOOLTIP_IMPORTS`); the two `role="button"` comment targets got an `aria-label` with the same text. The six `title`s
on `<iframe>` elements stay: they name the frame for screen readers. zoom-chip (2) and shell-collapse (1) keep their
`title`: the SDK tooltip also opens on keyboard focus, so their `*-focus-visible` states drew a tooltip the design
lacks and the visible-change gate failed; that is a design call (STATUS A8 rest). In .ethlete/design/studio six
drawings lost their `title` (comment-target keeps the text as `aria-label`); drawings draw a tooltip only as an open
state (`tooltip()` from `@ethlete/components/design/tooltip`), so the hover tooltips are not drawn. foundations/colors
keeps its `title` on the ratio chips: it is the chip's only label. B11 stays open.

A17 as built (Linux builder, 2026-11-13): the part tree list scroll position is stored as `treeScroll` in the remembered ViewState (one tree for all views) and written 150 ms after the last scroll. `RememberedTreeScrollDirective` on the tree scroller restores it after the first render whose content is tall enough (afterEveryRender, no timer), so a slow listing does not break it. Verified: unit spec (store and `canRestoreScroll`), e2e case "the part tree keeps its scroll position after a reload" red without the directive (0 after the reload, target 300), green with it, also with `--hold-listings 14000`. Not verified: other platforms, a tree shorter than the stored position (stays at the clamp until rows grow).

A23 as built (2026-11-13): Verwerfen in the sketch header opens an SDK anchored alertdialog (Abbrechen focused,
Verwerfen in the error theme); only that Verwerfen posts the discard. The comment draft's Abbrechen gets no confirm.
Verified: spec and e2e red without the confirm. Not verified: Tauri, a screen reader.

A2 as built (2026-11-13, 30f13ee56): title search click or Ctrl+K opens the SDK command palette; no drawn "neu zeichnen"
command; first Esc clears. Verified specs, typecheck, lint; no live shot.

A7 as built (2026-11-13, commit "Drag the side panel width"): shell-main edge handle (core `etDragHandle`, role separator, arrows ±8 px, 200-400 px, `sideWidth` model persisted in the remembered view).
Verified: specs, lint, typecheck, live shots (rest, hover, drag 312 px col-resize, min, max, focus, reload); DROPPED-PROP sideWidth gone. Not verified: Tauri window, touch, design compare.

A36 as built (2026-11-13, part-tree@parts-only a): part-tree takes `layers`, `sketches`, `legacy`; no states, hosts nest `nested` parts; Sketches first (`part@name`, status mark), Legacy last with one section per project, calls by slug.
Pencil gone (rail: System, Flows, Inbox). Not built: nested parts in the listing.

A26 as built (2026-11-13, studio-menu@entries a + shell-main@logo-menu c): logo menu has Projekt (radio) + Projekt öffnen…, Design-Server group, Erscheinungsbild and Hilfe & Einstellungen submenus; sidebar head is the system picker, the foot is gone.
Not built: Hell/Wie System (chrome has dark surface themes only), Einstellungen…, Tastenkürzel…, Hilfe, Über Studio… (no dialog, no docs URL or opener) - drawn disabled; Ctrl , and Ctrl / unbound.
