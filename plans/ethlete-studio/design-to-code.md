# Design to code

Status: decided (Tom, 2026-10-31), not built.

Older as-built and update notes: design-to-code-notes-2026-11.md

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
   - Missing motion (Q168): every ordered pair of `states` that an interaction connects (names differ only in
     interaction words; B297), static, on every check. A pair with a `focus` state is exempt. A loop is a motion with `from === to`; an ongoing-work state (name contains loading, pending, busy,
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
  - Impl Q12-Q14 as built (`a136928b4`, `1302cdc3a`, `87562073c`, `43f647c10`, `f7fe9b71c`): `--et-font-family:
var(--font-ui)` on `:root`; `translate3d(0, 0, 0)` on `.st-project-picker`; compare opens a state a control names in
    `surfaces` by a real pointer click on the matching `[aria-expanded]` element. Verified: compare shell-main 15 of 15
    and inbox 7 of 7 at 0 px; `part-compare.spec.ts` bites. `task --verify` without a revision checks HEAD.
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

Archived: Shell rail buttons decisions (2026-11-02), see [findings-2026-11](archive/findings-2026-11.md).

Archived: Findings 224-239 (2026-11-02), see [findings-2026-11](archive/findings-2026-11.md).

Archived: Findings 253-262 (2026-11-03), see [findings-2026-11](archive/findings-2026-11.md).

Archived: Findings 263-339 (2026-11-10), see [findings-2026-11](archive/findings-2026-11.md).

Archived: Findings 340-414 (2026-11-10), see [findings-2026-11](archive/findings-2026-11.md).

415\. Builder (2026-11-04, port of Tom's pick a of pages/sketches, e0f6a4396): `sketch report` refuses on a picked
sketch even with `--reopen` ("is decided (pick) - a report would reopen it"), so the rule "report before a variant edit"
cannot be followed for a port. Why no tool caught it: no test covers a report on a decided sketch. Fix (B342): a report
on the picked variant of a decided sketch is allowed and keeps the decision.
415 as built (Linux builder subagent, 2026-11-14, B503): `reportSketch` (`libs/cli/src/lib/design/system/sketch/sketch.ts`) takes a report on the picked variant of a decided sketch under the ready rules (`--reopen` moves it to in progress, the pick stays); another variant of a decided sketch is still refused. Cause: the refusal checked `decision` before the variant. Verified: the new case in `sketch.spec.ts` was red on the old code (refusal string), green after; Commit 2d27b0034; not run live.

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

427\. Tom (2026-11-04): "die sidebar/exporer frisst nun irgendwie auch mouse wheel events oft. man scrollt und es
passiert nichts und dann auf einmal scrollt er dann doch". The explorer in the sidebar often ignores the mouse wheel
for a moment and then scrolls late. "nun" points to a recent change. Tom, with a screenshot of the tree item
`title-search`: "der innere bereich eines tree items scheint die events zu fressen". The wheel fails over the inner
(highlighted) box of a tree item, not over the gap between items. Cause not yet known (asked the builder, with a
check of the wheel shields from finding 393 and of main-thread stalls such as B317). Why no tool caught it, and the
fix: pending the cause.

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
As built (B378): `yarn studio:e2e:bite <ref-before-the-fix> [--case Name]` (`tools/scripts/studio-e2e-bite.mjs`) builds the CLI of that ref in a temporary git worktree, runs `canvas.e2e.mjs` with `STUDIO_CLI_ENTRY` pointing at it, and exits 0 only if the e2e fails (the case bites). `canvas.e2e.mjs` and the headless harness already read `STUDIO_CLI_ENTRY`.
As built (435, 2026-11-15): the two e2e cases "a sketch merged/discarded while its view is open" bite, proved on an export of 98e80f14f with hand breaks (the old fix commits no longer revert). `leaveGone` a no-op alone: both pass, because `pickedPart` falls back to the target part. `leaveGone` a no-op and that fallback removed: both fail (frames 0, not-found note). The gone-sketch `drawnOf` fix (e459da21e) does not bite in the e2e, since the view never requests a gone frame; its proof is the `system-modules.spec.ts` case. Not verified: a live Tauri shot.

As built (479, 2026-11-15): no longer reproduces. Live probe on a scratch copy of 955001e9f: `sketch new components/kbd` and `components/divider` (sdk, both with a `.css` file), then `sketch check`: no UTILITY-CSS, only the expected NO-CHANGED-STATE and missing round note refusals of an unchanged sketch. Suspect (code read): the `sdk` product loads no Tailwind stylesheet, so `utility-css.ts` returns no problem for any of its files, sketch or product; the rule reads the same utilities for a sketch as for its product. The existing `sketch-new-ready.spec.ts` case already opens a sketch of a part with a `.css` file (acme `components/button`). No new spec.

As built (481, 2026-11-15): a merge now opens the port item. After `design sketch merge` and the `mergeStepOf` step, `printPortItems` (`sketch/merge-step.ts`) loads the merged parts' states and, for each part with an `implements` link whose component has no input for a prop the states send (the DROPPED-PROP logic, `droppedStatePropsOf` via the new `unportedPropsOf` in `dropped-props.ts`), prints `PORT <product> <part>: the merged design states send <props> - <component> has no input for it; add the input, see design task <part> --product <product>`. `design task <part>` lists the same props again as `port: no input on <component> for <props>`. No STATUS row is written. Verified: `merge-port-item.spec.ts` merges an acme `elements/hero` sketch that adds `withdrawn` to a part implemented by a component without that input and asserts the PORT line; with the `printPortItems` call removed it fails. Not verified: the Studio merge (worker, `studioMergeOf`) prints no PORT line; the `design task` line has no spec; the extra design-server start a merge of an implemented part now pays was not measured.

As built (486, 496, 2026-11-15): no longer reproduce. Live probe on df6ed7fa6: `compare pages/flows` exits 0 with "every declared action works" (the "Bildschirmgröße" combobox of 496 is gone or declared); `compare pages/sketches` lists no missed action (the "Runde" combobox and "Alle Zustände zeigen" disclosure of 486 are gone or declared). A missed or undeclared app control is a failure line ("the design draws no such element, so it declares no action", `actions-command.ts`), and any failure line exits 1 (`actions.spec.ts` "exits 1 on any failure") and records nothing in compare (`compare-command.ts`), so the part stays uncompared and IMPLEMENTATION-UNCOMPARED holds it. Not built: compare opening the missing-state sketch itself; ADR 0010 leaves that sketch to the builder who built the look. Not verified: a bite of a live undeclared control. `compare pages/sketches` exits 1 on a separate picture drift (change-crop, change-crop-whole DIFF 33 px).

As built (481 rest, 2026-11-15): no Studio UI and no sketch (c8: the human never ports by hand, the item belongs where the agent picks up work). `design task` computes its `port:` line from the merged design states and the component inputs, the same source as the `sketch merge` PORT line, so a Studio merge (`studioMergeOf`) reaches it without anyone reading the merge answer. New case in `merge-port-item.spec.ts`: a Studio merge, then `design task elements/hero` prints `port: no input on ... for withdrawn`; it bites when the port line is disabled. `et design status` lists no per-part work, so it gets no port line. Measured: the PORT check adds about 180 ms to a one-part `sketch merge` in the spec fixture (935 ms vs 755 ms, three runs each); the Studio merge adds nothing. Not verified: a live Studio merge.

As built (495, 2026-11-15): `compare` prints, for each implemented part that drifts, `drift since <sha> (<at>): <n> commit(s) touched the app files` with the ten newest commits and "and N older", or "no commit touched the app files (a design-side change?)" (`drift-since.ts`, `driftSinceOf` from the implemented record's `at` and `app` files, called in `compare-command.ts`). Spec: `drift-since.spec.ts` (bites when disabled; spec:stress 4/4). Live probe with `--working-tree`: `compare pages/sketches` prints `drift since a285ef0ab (2026-11-01T14:57:53.466Z): 207 commit(s)`. Not verified: the wiring in compare-command has no spec of its own, only the live probe.

As built (497, 2026-11-15): already built, no code change. The full `design check --product <p>` prints a `STALE <product> <part>: app <files>` line for every implemented part whose app files moved since its implemented record, with no push range (`stalePartsOf`, `check-system.ts`, since 3c0410ef6, before the finding); the 0205 `baselined` lines print on a green push since 5273e92bf. Live probe on 5093670c3, `design check --product studio`: 14 STALE lines, among them `components/canvas-viewport` and `components/comment-pin`, the two parts of the finding, both not in the implementation baseline. Spec: `stale-parts.spec.ts` "marks a done part stale when a file its app component reaches changes". Not built: the resident process (ADR 0204) has no STALE report of its own. Not verified: a bite of the full-check STALE wiring.

As built (500 rest, 2026-11-15): no code change; every point is closed. (1)-(3) by 1741d8bf8 and the Studio e2e case "Fit shows every column of a wide sketch, heads at the top" (every column inside the view, first head within 40 px of the canvas top, no frame content cropped), which runs on every push (ADR 0230). (4) is the tooltip, not an empty band: `design shot components/title-bar --state linux-full-notice` on 202181cd4 draws "CLI geändert - neu starten" in the 48 px `pb-12` band under Neu starten; it looked empty only because the old Fit cut it off. (5) cannot recur: the app's `sketchStatus` (`sketch-view.component.ts`) has no idle state since 5a29b1b94; a sketch is drawing, paused, not ready, waiting or picked. Not verified: a live Studio shot of a wide sketch at Fit in this session; the design part `components/sketch-status-badge` still draws an `idle` state the app never shows.

As built (533, 2026-11-16): the Studio test setup fails a spec on a `console.warn` line matching `NG0<n>` (`test-framework-warnings.ts`, own spec), next to the `console.error` check that let NG0953 through, since Angular logs it with `console.warn`. Two causes fixed in the app: `listWidthChange` in `sketches.component.ts` emitted after destroy, because `toObservable` completes on destroy and `debounceTime` flushed its pending value (now `switchMap` to a 500 ms `timer`); `merging` and `decide` in `sketch-view.component.ts` emitted from a `finalize` that ran on the unsubscribe at destroy (now `tap({ complete })`). With the guard on, before the fix: 109 failures in `sketches.component.spec.ts`, `sketch-view.component.spec.ts` and `system-view.component.spec.ts`. Bite: both app fixes reverted, `sketch-view.component.spec.ts` fails 30 of 34. Verified: `vitest related` 734 tests green, lint. Not verified: a live Studio run; `merging(false)` and `decide` no longer fire when the view is destroyed mid-merge.

As built (535 close, 2026-11-16): already built in 0ca01c706, no code change. `yarn et:design --working-tree <command>` builds the working tree's `libs/cli` into its own scratch dist, and each timings line records `cli <sha>+dirty` (see the 535 as-built paragraph further down). Struck from the Werkzeug-Rückstand.

As built (542, 2026-11-16): the subagent brief (`.agents/skills/builder-agent/subagent-brief.md`) now says: give a long run a deadline with the Bash tool's `timeout` parameter (max 600000 ms), never the shell `timeout`, which macOS lacks; merged into the existing wait line. Paid for by cutting a duplicate revert:check line and two redundant clauses from the builder-agent skill (net -7 words). The Mac gate timing of the finding is not measured again here.

As built (543, 2026-11-16): fix (3) was already built in ba4321e8c (`harnessShotOf` waits for a mounted part, `harness-shot-mount.spec.ts`). Fix (1): `design compare --all` compares every non-foundation part with an implemented record (`allComparePartsOf`, `stale-parts.ts`) and first prints `not done: <part> (design moved | app files changed | no holding check record)` for each that is not done. Fix (2): `stalePartsOf` also reports design files that moved since the implemented record (`port`), and the check prints `STALE <p> <part>: port <files> - run design task <part>`; `markImplemented` now writes the design `files` into `implemented.json`, and an older record without them prints `port files unknown: implemented before file lists`. Specs: `stale-parts.spec.ts` "names the design files to port when a part is checked at a new hash but implemented at the old one", `part-compare.spec.ts` "--all also compares an implemented part that is not done, and names why it is not" (both bite with the fix disabled; spec:stress 4/4). Live probe, `--working-tree check --product studio`: six new port lines (components/disclosure, shell-collapse, tree-row, zoom-chip, elements/part-tree, shell-main), all records from before file lists; the 14 earlier STALE lines unchanged. Not verified: a live `compare --all` run.

As built (point 0 rest, delayed pictures, 2026-11-16): already built in 6cafe2129 (the hold run of `studio-e2e-repeat.mjs` passes `--delay-pictures`), no code change. Still open: the idle measurement against 90 s (ADR 0237) and an on-disk check cache (the sketch check cache, `sketch-check-cache.ts`, lives in memory only).

As built (B520 ready fix, 2026-11-16): `design ready` (`ready-command.ts`) calls `settleCommittedEdits` for its part before `markPartReady`, so a direct edit HEAD holds is recorded in `merged.json` and no longer refuses as "changed outside a sketch"; `design check` stays read-only. Spec: `part-ready.spec.ts` "ready on a merged part edited outside a sketch" (red without the call, verified); an uncommitted edit still refuses. Unblocks ready for foundations/colors, foundations/type, comment-row, title-bar, studio-menu and pages/start besides the B520 parts. Not verified yet: a live `design ready` on a studio part.

As built (B520 disclosure, 2026-11-16): the disclosure part changed since its record of 2026-11-01 (hug option d1f722990, passed sketches action 32aaf6552, declared toggle actions f1fea4e17). The app component already had `hug` and rendered the same markup, so no code changed: `design compare components/disclosure --product studio` was green on all 12 states and `design task --verify` re-recorded `implemented.json`. Verified: compare, task verify, `design check` for the part. Not verified: other parts reached by the disclosure (no `compare --affected`).

As built (B520 tree-row, 2026-11-16): the tree-row part changed since its record of 2026-11-01 (tree roles 83ccabb8e, menu item text size b57fb9729, `text-ui-md` 37655a447, declared actions 4bbd88e03 and f1fea4e17, fired outputs 8d8496ce9, SDK tooltip df86a711f). The app component and `tree-row-item.component.ts` were already ported by those commits and by 66e540f97, so no code changed: `design task components/tree-row --verify` ran compare green on all 53 states and re-recorded `implemented.json`. Verified: that compare, `design check --part components/tree-row` and `compare --affected` (results in the commit report). Not verified: the unit spec was not re-run, as no app file changed.

As built (B520 part-tree, 2026-11-16): no app code differed; `design ready` (920dac953, settled the committed edit) and `design task elements/part-tree --verify` compared all 7 states ok and re-recorded implemented.json at 5cb438b5755f8332. `design check --part elements/part-tree`: 0 findings. Not run: the part-tree unit spec (no app file changed).

As built (e2e speed: merge case, 2026-11-16): no code change. Measured with timing marks in the merge worker ("a sketch merged while its view is open", 3 runs: case 18.4-18.6 s, server merge 12.3-12.5 s). Cause (measured): the app spec gate (`failingAppSpecsOf` -> `vitest related` in apps/ethlete-studio) takes 7.8-8.0 s of it; the specs themselves (`styles.spec.ts`, `system-tree.spec.ts`, named because they read `styles.css`) run 1.1 s, the rest is vitest start, of which 5.8 s is TypeScript (cpu profile: `@analogjs/vite-plugin-angular` builds the whole spec program before any spec runs). The rest of the merge: rule pass for `known` 1.9-2.2 s, check (rules + tsc) 1.5-1.8 s, lint gate 0.4 s, worker start 0.15-0.19 s, harness map 0.1 s, commit 0.03 s. A static pre-filter that skips vitest when no spec imports a merged file was built and dropped: in this repo `styles.spec.ts` always names the stylesheet chain, so it never skips (bench unchanged). Not changed: the cost sits in the Studio vitest config (apps/ethlete-studio/vite.config.mts, outside this slice). Suspect (not measured): a lighter analog setup for specs, or one long-lived vitest per server, removes most of the 8 s. The two edit-sketch cases (23-26 s, 20-21 s) logged no finished worker merge in the bench; their time was not attributed.

As built (e2e speed: studio spec startup, 2026-11-16): apps/ethlete-studio/vite.config.mts sets analog's `fastCompile: true`. In vitest analog already compiles specs JIT with type checking off; `fastCompile` keeps JIT and transforms per file (`jitTransform`) instead of building the whole spec program in `buildStart`. A small pre plugin works around an analog 2.9.2 fastCompile bug: its `resolveId` returns a `/@fs/<abs>.css?inline` id unchanged, so every `styleUrl` outside the app root (libs/core, libs/components) failed to load (most component spec files red before the workaround). Numbers: `vitest related --run src/styles.css src/styles.spec.ts` from apps/ethlete-studio, 3 runs each: before 7.95-8.00 s, after 1.70-1.71 s warm; the first run after a config change is 4.2-4.4 s (cold vite cache). Tried and dropped: `disableTypeChecking` (already the test default, 7.9-9.8 s), `jit` (already the test default, 8.2-8.4 s), `experimental.useAngularCompilationAPI` (8.5-8.7 s). Merge case "a sketch merged while its view is open": 14.2 s, 1 run (before 18.4-18.6 s). Verified: full ethlete-studio spec project 73 files / 745 tests pass; `nx typecheck ethlete-studio` passes (it runs `ngc` on tsconfig.app.json and `tsc` on tsconfig.spec.json, so type errors stay caught there, as before); mutations still fail: `overscroll-behavior: auto` in styles.css fails `styles.spec.ts` through the gate's `vitest related --reporter=json` call, a changed attribute in the title-bar template fails 12 of its 20 tests. Not verified: the full Studio e2e suite against the 90 s goal; the case saved 4.2-4.4 s, not the 6.3 s the warm numbers predict (Suspect, not measured: the e2e checkout runs vitest with a cold vite cache).

As built (e2e speed: edit cases and waits, 2026-11-16): apps/ethlete-studio/e2e/settle-wait.mjs reads the layout once before its first 250 ms wait, so `settled()` (every case start and each later call) still needs three equal reads over 750 ms but no longer spends a first wait before its first read. Measured with a temporary per-call-site `waitForTimeout` tally over a full run: 409 s of the ~670 s case sum is fixed waits; `settled()` polling was the largest (168 s), the 600 ms `settle()` next (144 s over ~240 calls), then sampling windows (scroll samples, page-switch, 6 s refresh window, 3 s gone-sketch window). After the change `settled()` polling is 129 s and the case sum 657 s (before 674 s, same instrumentation, idle). Critical path, measured: the build overlaps the workers' start (fixtures 9-13 s, then idle until the build), the first case starts 2.7-3.4 s after the build (warm-up), workers end within 10 s of each other (93-102 s of cases each), then the quiet tail adds ~9 s. Cause: the Studio build takes 11.3-11.9 s with 1-2 workers and 18.2-19.8 s with 8; nicing the workers (+10) left it at 18.4-18.8 s, so it is not CPU priority (Suspect: IO or memory bandwidth of the 8 workers' start; dropped). Edit-sketch cases, idle, phases: `design check --part` 7.7-9.5 s (auto-accept drawing 2.2 s, static 1.7 s, render-inspect 1.1 s, the rest CLI start, open points and summary), old pick merge rows 3.9 s, merge click to view closed 1.2-5.2 s, the warm listing after the restore 3.1-3.2 s; under the 8-worker load the cases take 63-70 s. Cause: all three are server or CLI work, not test waits; no change made there. Full runs after the change: 113, 120 and 117 s, all marked noisy (another checkout's Playwright run held load 21-51). Verified: settle-wait.spec.mjs (6 tests), 142/142 in each full run. Not verified: 3 idle full runs against the 90 s goal; converting `settle()` to condition waits (most calls precede camera or ring checks where the 600 ms is the window the assertion reads, so each needs its own condition); a faster `design check --part`.

As built (e2e speed: build before workers, 2026-11-16): not faster, no code change. Tried: `await build` at the top of `runWorker` in canvas.e2e.mjs, so the 8 workers fork only after the Studio build. Measured, one full run (load 6.1 at start): build done at 11.0 s (the 1-2 worker figure, so the workers do slow it), but the per-worker setup then takes 9.2-11.2 s (fixtures) plus 3.6-6.5 s warm-up, the first case starts at 25.6 s (before: build 18-20 s + 2.7-3.4 s, about 21-23 s), and the run is `142/142 passed in 115.6s`, `goal: 116 s` (before 107-113 s; load 25.9 at the end, other load on the machine). Cause: the build and the worker setup (checkout copy, design server, fixtures) are both heavy and the overlap costs less than running them one after the other; the serial sum is longer than the overlapped time. The other order (setup first, build after) has the same sum, so it was not run. Not verified: 3 idle runs of this variant (stopped after one, it was slower at the first case); a partial overlap (only some workers before the build).

As built (e2e speed: design check part, 2026-11-16): `design check --product --part` (libs/cli) scopes CANONICAL-CLASS and CLASS-UNDEFINED to the files of the part (and of its embedded parts for the build-ready inputs), skips `doneParts` with `--part`, and with `--part` runs the Tailwind class facts (child process) and `typecheckProductAsync` side by side in a new `static-prefetch` phase before `static`. Measured on a scratch copy in the e2e edit state, resident cold start each run: components/comment-row 7.11/6.96 s -> 5.44/5.42/5.41 s (static 2.36 s -> prefetch 0.84 s + static 0.62 s, summary 0.65 s -> 0.01 s); list-row 5.88 -> 4.37 s; command-palette 7.92 -> 6.78 s. Cause (cpu profile): the Tailwind child over every part's candidates (1.37 s, its cache slot is keyed by the checkout path, so an e2e copy always misses) and `doneParts` (0.63 s, unused with `--part`); the Tailwind child keeps a fixed ~0.85 s (canonicalize init), which the prefetch now overlaps with tsc. Verified: identical stdout and stderr (minus PHASE, cli and resident lines) on the three parts, two with open points; vitest related (153 files) green; lint and typecheck clean; `yarn studio:e2e --case "picking new of an edit sketch records the edit as merged"` passed, case 25.6 s (before 23-26 s, one run, so no gain shown at case level). Not verified: a part with rule findings in the scoped class rules, a full e2e run. Next targets, not profiled: render-inspect ~0.9 s, resident cold start ~1 s, tail 0.8 s.

As built (e2e speed: settle waits, 2026-11-16): apps/ethlete-studio/e2e/canvas.e2e.mjs gets `readUntil(page, read, done)` (`focusUntil` now uses it; polls every 50 ms up to `WAIT_MS`), and 19 of the 42 `settle()` sites wait on the exact condition the next assertion checks instead of 600 ms: `focusInto` (focus inside the frame), `drag` (dropped; its three callers wait for `moved`), the frame-centre wheel and ctrl-wheel (frame moved > 20 px, zoom > 1.05x), wheel over an iframe (camera moved > 20 px), ctrl-wheel drift (width changed and drift <= 2 px), Fit stable (chip within 1 % of Fit, then of 1.5x), window blur (the pointer mark after the click), click selects and selection outline, arrow key pans and pan beyond every edge (canvas focused after the click, then `moved` per edge), the redundant `settle()` before `settled()` in the 30 %/100 % case, and the setup wheels of the panned-and-zoomed hide-panel case (camera moved, first frame width changed). Measured with a per-site tally of a full run: those sites were 134 of 240 `settle()` calls (~80 s of the case sum). Kept, with reason: absence windows (`noRingAfterPointer` x3, window blur after the blur, hover edges x2, the remount reads of the live-frame focus case); smooth camera moves on the design canvas (Shift+1, double-click, zoom buttons, hide panel: the assertions read frame rects during the 250 ms transition); assertions with no awaitable target (text at four zooms, the first Fit percent, the canvas-under-panel clip, Fit columns, open points, quick listing, same frames); the Shift+1 setup wheel (it moves no camera on System, so a wait on it would time out). Numbers: full runs before 110.9 s (load 10.7 -> 26.7); after, all 142/142: 102.4 s (load 12.1 at start), 102.2 s and 100.2 s (load 5.8 and 5.7 at start), plus 99.5 s and 100.9 s marked noisy (each started on the previous run's tail). Still over the 90 s goal. Touched cases (65 runs) 3x green, 46.3-48.5 s; with `--hold-listings 14000` 62/65, the three "Fit is stable" fails also fail on the unchanged runner (`page.waitForSelector('[data-sk-state]')` after its reload times out under the hold; pre-existing, not changed). Bites (app source broken temporarily, restored): arrow pan at half step fails "arrow key pans" and "pan beyond every edge" on System, Inbox and Flow; no selection on click fails "left click on a frame selects it" and "selected frame draws the selection outline" on System. Not verified: a condition met early and lost before 600 ms now passes where the window failed (none of the replaced reads is known to flip back); the Sketches-page arrow and selection paths were not bitten (the bite hit only the design canvas); 3 idle full runs.

As built (e2e speed: check part 2, 2026-11-16): `checkSystemRenderedOn` (libs/cli) gets an `afterEdits` hook, called after the auto-accept loop for a single part or a product-wide run; `renderedAndLinted` starts `lintFindingsAsync` (eslint through `spawnPlainAsync`) there, so the lint runs beside static-prefetch, static and render-inspect instead of blocking after the tail. `afterPart` (may return a Promise, now awaited) uses the ahead findings only when `changedLintFilesOf` gives the same file list and every file's text is unchanged, else it runs eslint synchronously as before (also when the async run failed). `primeJsonStyles({target, dirs})` resolves every dir in one node process (a failing file still gives null), `jsonStyleOf` goes through it, and serve.ts primes `.ethlete/design` plus the product dirs (with listen) before `writeCallsTsconfig`, only when `editorAssetRootOf(target)` is set; this replaces four serial node+prettier spawns (~290 ms). Cause (measured): before, comment-row 5.41/5.18 s, list-row 4.30/4.08, command-palette 5.47/5.30; phases of comment-row: harness-map 0.16, auto-accept 0.09, static-prefetch 0.5, static 0.65, render-inspect 0.96-1.02, open-points 0.31, tail 0.82, lint gate 0.45 (blocking spawnSync eslint after the tail; the resident sat idle ~450 ms in static-prefetch waiting on tsc), cold start ~1.2 s. Numbers: A/B of 6 interleaved cold runs on comment-row, old median 5.78 s, with lint ahead 5.46 s (~-0.3 s); one prettier spawn, median 6.31 -> 6.02 s (~-0.2 s, load 7-9, noisy). After the build: comment-row 5.53 s, list-row 4.27 s, command-palette 5.49 s (first run after the rebuild was noisy: 6.5/4.7/12.7 s). Suspect (not measured, not built): lazy typescript import in the client (-100-170 ms, ~35 modules), a shorter client poll (up to -100 ms), vite transforms of the part during the idle static-prefetch window (up to -0.45 s of render-inspect). render-inspect (~850 ms main-thread vite CPU on an empty module graph) and the tail (real SSR renders) are not cuttable without a warm process, no change. Verified: stdout and stderr of `design check --part` on comment-row, list-row and command-palette are identical to the old dist runs (PHASE and resident lines dropped); the first run after the rebuild failed on comment-row with "outside of Vite serving allow list" for the removed dist/libs/cli-ab-new path (a resident still started from the old A/B dist), the repeat run is identical; 154 related spec files pass, lint and typecheck cli green; the e2e case "picking new of an edit sketch records the edit as merged" passes in 20.1 s (before 23-26 s, 25.6 s; load 13 at start), its first run failed on a stale dist because prettier reformatted serve.ts after the build. Verified after: two specs in libs/cli design-lint.spec.ts drive `checkDesign --part` on the acme fixture; one rewrites the lint file after the ahead eslint ran clean and the gate reruns eslint and fails on the new non-null assertion (with `sameFiles` forced true it misses it, exit 0), the other proves an unchanged file reuses the ahead findings (with reuse disabled it fails). A real non-null assertion in studio components/comment-row/comment-row.ts on a scratch copy gives the same `LINT ...comment-row.ts:98:25 @typescript-eslint/no-non-null-assertion` line, the same `studio adds lint warnings` line and exit 1 with the new dist and with a dist built from the 5096ef0f7 sources of the five changed files. Not verified: with a type-aware eslint config a .ts file outside the lint list written in that window would go unnoticed (this repo's config is not type-aware).

As built (e2e speed: check part 3, 2026-11-16): `preloadRenderModules` (libs/cli render-check.ts) loads the module of every drawn part of the checked products on the warm design server, one after the other in the order `renderIssuesOf` loads them, errors swallowed; `renderSystem` starts it (not awaited) at the start of `static-prefetch` with `--part`, so the vite SSR transforms run while the resident waits on the tsc and Tailwind children, and render-inspect finds the modules in the graph. Cause (measured): render-inspect loads all drawn parts of the product through `ssrLoadModule` (for the `checks.skip` of each) on the empty module graph of a cold resident; the Suspect held. Numbers, scratch copy in the e2e edit state, cold resident each run: A/B of 6 interleaved runs per part (libs/cli source swapped with the dist so the stale check passes; the swap misses the tsc cache, static-prefetch ~1.3 s in both arms): comment-row median 6.51 -> 5.59 s (render-inspect 1.11 -> 0.39 s), list-row 5.17 -> 4.62 s (0.97 -> 0.27 s), command-palette 6.59 -> 6.45 s (1.86 -> 1.81 s, its render-inspect is browser work, not module loads); 4 runs per arm in sequence (cache hits, static-prefetch ~0.5 s in both arms): comment-row 5.16 -> 4.57 s (render-inspect 1.04 -> 0.65 s), list-row 4.34 -> 3.87 s (0.94 -> 0.60 s), command-palette 5.60 -> 5.55 s (1.82 -> 1.72 s); static-prefetch did not grow in either set (load 5-11). Verified: stdout and stderr of the three parts identical to the old dist runs (PHASE, resident and cli build lines dropped), each new run against the old one; 151 related spec files pass; lint and typecheck cli clean; `yarn studio:e2e --case "picking new of an edit sketch records the edit as merged"` passes, case 21.2 s (before 20.1 s, one run each, load 4.6 -> 10.9, so no gain shown at case level). The identity runs used a build with the new function placed between the JSDoc of `renderIssuesOf` and its body; the committed source only moves it above that JSDoc (rebuilt, lint, typecheck and the e2e case ran on it). Not verified: a part whose module fails to load (the RENDER line comes from the second load in render-inspect; vite is expected to retry a failed module, not tested); a product-wide check (no preload without `--part`); a full e2e run.

As built (e2e speed: partial overlap, 2026-11-16): dead end, no code change. Tried: in canvas.e2e.mjs the workers with index >= K `await build` before `runWorker` (env knob for the experiment only), so K workers set up beside the Studio build and 8-K after it; the case queue is already shared (`giveJob` shifts from one queue), so late workers take fewer cases without a rebalance. Measured, 6 full runs alternated in one window, each started at load 5.6-6.0 (27-36 at the end, the run's own load), all 142/142: unchanged runner 105.1 s and 99.2 s; K=2 103.0 s and 103.5 s; K=4 101.0 s and 101.4 s. Marks: unchanged, build done at 18.5-20.2 s, all 8 workers ready at 21.3-23.4 s, quiet tail from 90.3-94.6 s; K=2, build 11.9-12.0 s, the 2 early workers ready at 15.0-16.1 s (fixtures 4.3-4.5 s instead of 9-12 s), the 6 late ones at 26.2-31.1 s (fixtures 9.5-11.4 s, warm-up 3.4-5.3 s), quiet tail from 94.1-96.2 s; K=4, build 13.6-13.7 s, early workers ready at 16.8-17.4 s, late ones at 30.0-33.7 s, quiet tail from 92.1-92.5 s. Cause (measured): the late workers' setup after the build still takes 13-17 s (fixtures and warm-up, slowed by the early workers' cases), so they start 5-12 s later than in the full overlap, and the 6-8 s the early workers gain does not make up for that; the sum of worker time lost is larger than the gain. Suspect (not measured): the worker setup (checkout copy, design server, fixtures) is bound by IO or memory bandwidth like the build (2 concurrent setups take 4.4 s of fixtures, 8 take 9-12 s), so a cheaper setup per worker, not a different order, is where the start time goes. Not verified: other K values (1, 3, 6); a start gated on the first K workers' setup done instead of the build.

As built (e2e speed: worker setup, 2026-11-16): built. apps/ethlete-studio/e2e/canvas.e2e.mjs: the lead makes one `studio-canvas-e2e-shots-` dir per run (not with `--cold-shots`, removed at the end) and every worker checkout links `.ethlete/cache/design-explore/part-shots` to it, so the 8 design servers share one part picture store for the run (the store already locks a key and lets other servers wait and read); and the worker checkout gets its own `tmp` instead of a link to the main checkout's. Per-step numbers (worker phase marks plus each worker's design server output): the checkout copy is 40 ms (16 MB, 810 files of `.ethlete/design` on tmpfs, every other entry a symlink), `ensureCli` 7 ms; the design server start ~0.5 s, but with the linked `tmp` all 8 servers took the resident start lock in `<checkout>/tmp/design-resident` of the main checkout one after the other (open at 0.8-6.1 s, ~1.1 s apart), one hosted the resident and the other 7 none, and each run rewrote the main checkout's `tmp/design-resident/process.json`; fixtures (the full `/__design/sketches` listing) 7-12 s with 8 at once, 3.8 s alone, each worker drawing the same 46 pictures (work root `<checkout>/.ethlete/cache/design-explore`, per worker, since node_modules is a link out of the checkout); warm-up 2.7-3.0 s. Cause (measured): the 8 x 46 identical drawings load the machine while the Studio build runs; with workers 1-7 skipping the listing (experiment only) the build finished at 11.6 s and the first case started at 14.5 s, but the run took 103.0 s because the drawings moved into the cases (case sum 692 -> 751 s). Shared store: setup drawings 368 -> 188 (20-29 per worker, 17-26 waited for), case drawings 1662-1676 -> 1240-1380 (149-176 waited for), case sum 685-696 -> 649-675 s. Numbers, full runs, each started at load 5.6-5.9, all 142/142 except one: unchanged runner 100.6 s, 101.4 s and 99.8 s (marked noisy), build done 18.3-19.0 s, first case 21.0-21.8 s, quiet tail from 90.8-92.5 s; shared store 97.2 s, 94.4 s and 97.8 s (after the knobs were removed), build 16.8-17.6 s, first case 19.5-20.2 s, quiet tail from 85.4-88.8 s; one shared-store run 125.4 s with 141/142 at load 58 from other sessions ("a sketch scroll never empties a cell that had a picture", one iframe with no answer in 250 ms at load 60.9; counted as noise, not repeated at quiet load); shared store with the linked `tmp` 95.6 s and 95.4 s, own `tmp` alone 102.6 s: the own `tmp` gives no speed, it is kept because the e2e run must not write the main checkout (verified: `tmp/design-resident/process.json` of the main checkout keeps its mtime through a run with it, a run without it rewrites it) and each checkout gets its own resident (ADR 0204). Suspect (not measured): the remaining fixture time (8.4-9.7 s with 8 at once) is the rule check and the listing's other per-server work, not drawings. A permanent spec (`shot-store-shared-checkouts.spec.ts`, 13d27be26) proves two checkouts on one shared part-shots store share a picture only when the file content is identical; forcing the content hash constant makes the differing-content spec fail (1 draw instead of 2). Not verified: `--cold-shots` runs (unchanged, no shared store); idle-machine runs.

As built (e2e speed: fixture listing, 2026-11-16): built. apps/ethlete-studio/e2e/canvas.e2e.mjs: after the fixture listing each worker starts a `GET /__design/system` (not awaited) before it waits for the Studio build. Profile (temporary marks in dist studio-api.js and an inspector profile of the sketch-check worker thread, removed): one fixture listing (`?product=studio`, 6 sketches) alone took 5.0 s: part pictures 56 asks from 0.35 to 5.0 s, part module loads 30 ending at 2.9 s, the rule check in the worker thread 4.2 s beside them (2.3 s of it one synchronous Tailwind child for 3864 class candidates, `classFactsOf`, because the class-facts slot holds the checkout path, so no worker checkout hits another's facts); the main thread is mostly idle. Under 8 workers (profiled run, load 6 -> 31): pictures end at 14.1-15.3 s, the rule check at 10.0-14.2 s, the rest (sketch list, rebase, body) < 0.2 s. Cause (measured): the fixtures end before the build (they wait 7-8 s for it), so their length is not on the critical path; the warm-up is. The warm-up did not repeat the fixture listing (its sketch listings are light, 3-116 ms), but its first frame waited on `/__design/system`, whose rule checks per product (`kind: 'rules'`, a new Tailwind child for the `studio-lab` slot, 342 candidates, ~1.1 s, then `studio` ~0.4 s) ran only after the build. Single worker A/B (2 each): warm-up 2.0 -> 0.3 s, run 19.2-19.9 -> 18.0-18.4 s. Numbers, full runs alternated, each started at load 4.8-5.8, all 142/142: unchanged 100.7 s and 99.1 s (build done 17.7/18.0 s, warm-up 2.8-3.3 s, first case 20.8/20.8 s); with the request 98.9 s and 97.8 s (build done 19.3/19.7 s, warm-up 0.4-0.5 s, first case 19.7/20.2 s). The rule checks now run beside the build and slow it by ~1.6 s, so the net gain is ~1 s at the first case and ~1.5 s per run; a third pair was stopped by the session's low-memory reaper and not repeated. Suspect (not measured, not built): the 8 identical Tailwind children per run (the class-facts slot and inputs hold the checkout path) and the class-facts cache under the linked `node_modules`: each run writes new entries into the main checkout's `node_modules/.cache/ethlete-design/class-facts` that no later run hits (1417 files, 239 MB at this point); sharing them within a run needs a path-free slot and a per-run cache dir. Verified: the listing code is unchanged (no libs/cli change); the 42 runner specs pass. Not verified: more than 2 runs per arm; idle-machine runs; a run where the build finishes before the fixtures (the request then runs beside the warm-up, which dedups the rule check in the worker).

As built (e2e speed: class facts, 2026-11-16): built. libs/cli tailwind-classes.ts: the class-facts slot holds the stylesheet and config paths relative to the checkout, not the checkout path; the stored inputs keep checkout files (outside `node_modules`) by relative path and content hash, every other input by its stat print as before, so a copy of the checkout with the same files hits the entry and a changed file misses it; `ETHLETE_DESIGN_CLASS_FACTS_DIR` names the facts dir (default unchanged); a `<entry>.lock` file (pid) lets one process run Tailwind for an entry while the others wait up to 30 s and read its answer (a holder in the same process is not waited for, a dead holder's lock is taken over). canvas.e2e.mjs makes one `studio-canvas-e2e-class-facts-` dir per run, gives it to every worker (and so to its design server, resident and merge checkouts) and removes it at the end. Removed: the path-keyed slot and the dead cache growth: `node_modules/.cache/ethlete-design/class-facts` of the main checkout (1557 entries, 262 MB, every e2e run wrote 16+ entries no later run hit) was deleted, and e2e runs no longer write it. Measured: mid-run the per-run dir holds 2 entries (studio, studio-lab) for all 8 workers. Baseline with the unchanged runner, 1 run (load 2.7 at start, 32 at the end): 107.4 s, build done 19.5 s, fixtures 9.0-10.3 s, first case 19.9 s, quiet tail from 98.4 s. After, 3 runs, each started at load 5.7-5.8, but other sessions (a fifagg shoot, a debug ethlete-studio app at 100 % CPU) drove the load to 41-87: 141.7 s (141/142, "a sketch scroll never empties a cell" at load ~50), 116.7 s (142/142, build done 17.5 s, fixtures 8.7 s, first case 17.9 s), 122.8 s (141/142, "a part edited on disk while away" at load 71, build 21.0 s); all marked noisy by the runner. Verified: two new specs in tailwind-facts-cache.spec.ts (a copy of the checkout answers from the first one's entry and misses after a changed theme; a sync call waits for a lock held by another live pid and reads its answer), each fails when bitten (local inputs kept by stat print; lock never taken); 153 related cli spec files pass; lint and typecheck cli clean; the 42 runner specs pass. Quiet proof (other sessions paused, 3 runs one after another, each started at load 3.1-5.8): 93.4 s, 91.0 s, 92.1 s, 142/142 each, against the earlier quiet pairs of 97.8-98.9 s, so about -6 s. Still above 90 s; the remaining levers are small (per-worker warm-up, edit-case balance over the 8 workers, the Studio build on the start critical path). The two red cases of the noisy runs were not repeated and did not fail in the quiet runs.

As built (e2e speed: quiet tail, 2026-11-16): no code change. Measured with temporary per-case start/end marks per worker (removed), one full run (107.4 s, load 2.7 at start, 32 at the end): the parallel phase is balanced, the 8 workers end their last loud case between 97.5 and 98.4 s, and the quiet tail (9 cases on 6 workers, `availableParallelism() / 5`) starts at once at 98.4 s and ends at 107.2 s. Cause (measured): the tail is the length of one case, "a listing refresh every 1 s for 6 s re-navigates no iframe and leaves no 150px frame" (Large, 8.8 s), which the longest-first order already starts first; 7 s of it are its assertion windows (6 s of refreshes, then 1 s before the height read), the rest is `framesPainted` (~1.8 s). The other 8 quiet cases (4x hover, 2.5 s each; 3x first load, ~4 s; the part shown before, 1.9 s) run beside it on the other 5 workers and end by 104.4 s. Not changed: shortening the windows is barred (never a shorter sleep for an assertion window), and running the case beside loud cases drops its quiet guarantee (it waits for paint under load, B464-B472). Suspect (not measured): the only room left is the ~1.8 s paint wait at its start.

As built (e2e speed: Studio build, 2026-11-16): built. Profile of the build alone (`NG_BUILD_DEBUG_PERF=1`, load 6-13, 2-3 runs each), Cause (measured): TS emit 4.9-6.7 s (full-program emit, `isolatedModules` not set), type check 2.0-2.3 s, create program 1.2 s, analyze 0.6 s, nx/npx overhead ~0.9 s; esbuild, CSS and minify ~1 s (Suspect, not split). 12428fdc2: canvas.e2e.mjs builds with `NG_BUILD_TYPE_CHECK=0`; the output is byte-identical to a checked build (`diff -r`), and the type check still runs in the `typecheck` target. Then `apps/ethlete-studio/tsconfig.app.json` sets `isolatedModules: true` and `emitDecoratorMetadata: false` (Angular warns that the two clash; Studio reads no decorator metadata), so release and e2e build the same way: bundle generation 12.0-13.4 s -> 4.2-4.5 s (3 runs, load 8-15). Two full runs, each started at load 5.8-6.0, 142/142: 93.3 s (runner: noisy, end load 34) and 90.8 s (end load 29); build done 12.5-12.6 s against 16.8 s, first case 12.9-14.0 s against 17.2 s. The parallel phase was 69 s against 65 s in the quiet proof (case sum 580 s against 547 s, higher end load), so the ~4 s start gain does not show in the totals yet. Verified: `nx run ethlete-studio:typecheck` clean; the production build has no warning; 84 runner specs pass (12428fdc2). Not verified: a run at quiet load after the change; the Tauri app bundle with the new tsconfig.

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

454\. CI 42016914765, Studio rules: the `--slow` step finds that the direct-edit state of `pages/system` has no
"Gründe" trigger. Cause (the first lead, B372, was wrong): the design state draws the build-ready footer with a "Gründe"
disclosure since 2e70dc149 (merge pick a of the build-ready sketch, design files only). The app never had it; building
it is row B288. The slow gate compares only parts whose app files change, so it first ran when 8f059ae72 touched
`system-page.component.ts`. Every app commit on `pages/system` fails this way until the footer exists. Why no tool
caught it: no gate runs the slow compare when only the design side of a part changes. Tool fix (B393, builder
default): a design-only change to a part also runs the visible-change gate for that part, and a merge that adds a
state the app cannot drive (missing trigger) fails and names the app row to build.

455\. The grill session closed B377 in `STATUS.md`, but ADR 0192 still had `open: B377`. The pre-push check found it
only at push time, and the builder fixed it in de53d8571. Why no tool caught it earlier: the check that matches ADR
`open:` rows against `STATUS.md` runs at pre-push, not when a plan file is committed. Tool fix (B395, builder
default): run that check at commit time for commits that touch `STATUS.md` or an ADR, and the doc-agent skill says to
set `built: <sha>` in the same commit that closes a row.

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
CLI. Cause lead: a throw between the file swap and `recordMerged` (`merge.ts`); closed by B501 S3.

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
**484 as built (Linux builder, 2026-11-14, B502):** decision: a static pass, not the live one - compare can only walk
design states, and a live pass would need a driven app state per branch. New slow rule `STATE-UNDESIGNED`
(`undesigned-branches.ts`, run with DROPPED-PROP, which already loads each linked part's states): it parses the linked
component's template with `@angular/compiler` and names every `@if` / `@else if` / `@else` branch that no design state
takes (state props as inputs, other inputs at their literal default; a computed, loop variable, required, sampled or
`TemplateRef` input counts as taken). The hit text points to the missing-state sketch with the built look as variant a
(ADR 0048/0010); a live state that names a missing design state fails as `STATE-UNDESIGNED` too. Verified: spec with
bite (the A1 title-bar template and states), and the real title bar with its `cli-dirty` states removed gives
`@if (!notice() && noticeText())`; with them, none. Over every part (finding 789): studio 3 hits, baselined on 484
(ADR 0201) - `pages/sketches` `@if (error())` and `@if (listError())` (the failed-listing look of ADR 0010),
`pages/system` `@else if (noted())`; sdk and studio-lab have no linked component, so none. The three sketches: B502a.
**B502a as built (Linux builder, 2026-11-14):** each of the three hits has its missing-state sketch, opened with
`design sketch new`, drawn, and set ready; all wait for Tom's pick. `pages/sketches@failed-listing` (state
`list-error`, prop `listError`): a the built look (Erneut laden in the head, Vergleich fehlgeschlagen: <reason> in
each comparing row), b per-row retry, c one head banner (the ADR 0010 alternatives). `pages/sketches@merge-error`
(state `merge-error`, prop `error`): a the built look (the server reason as xs error text in the head; it squeezes the
title, as in the app), b the reason under Übernehmen of the picked variant, c a head banner.
`pages/system@canvas-note` (state `canvas-note`, prop `noted`): a the built look (one muted line in the middle of
the empty canvas, tree empty, the no-server text), b a card like the empty page, c a strip on top of the canvas.
Each state prop is named like the app input, so a merged pick clears its hit; until then the three baseline
entries name their sketch. Verified: `sketch check` and `sketch ready` pass (warnings only: frame budget, unused
shared exports carried over from the merged part, and on canvas-note variants that look alike at fit zoom); every
variant's shot viewed; `design check --part pages/sketches` and `--part pages/system`: 0 findings each, the three hits baselined with their sketch, no part file rewritten. Not verified:
the built look against a live app screenshot (read from the templates only); variant a of canvas-note draws
`text-ui-sm` for the app's `text-small` (13 px).

**B502b as built (Linux builder subagent, 2026-11-14, commit "fix(repo): Draw the edit-sketch harness sample and fold no state when all are unchanged"):** Cause (measured): app harness drift, not a compare bug.
`compare pages/sketches --product studio` on f6231d4b8: 140 actions missed, 139 in `edit-sketch` (71 "the design
draws no element of this name", 68 click timeouts on title-bar buttons such as Sucheninstudio, Update, Minimieren),
1 in `all-unchanged` (AlleZuständezeigen, "no such element"). `design dom --app`: the design prop `part: 'edit'` had
no case in `DESIGN_HARNESS_SAMPLES['pages/sketches']`, so the harness drew 24 title-bar frames where the design draws
the 8-frame `components/zoom-chip@edit` sketch; and the app folded every state when no variant changes one, while the
design (`unchangedStates`, ff1213561) folds none and draws no fold row. Bisect: `edit-sketch` came with b685abce7
(ADR 0270) without a harness sample; the `all-unchanged` miss predates b9802b4d6. Fix: `SKETCH_EDIT_SAMPLE` (rows
old/new) for `part: 'edit'`; `foldedStatesOf` folds none when every state would; old of an @edit sketch is a base row
(the design's `isBase`), never folded. After: every declared action works; DIFF `edit-sketch` 96350 to 8805 px,
`all-unchanged` 64399 to 12474 px; 31 DIFF states before and after. Specs red on HEAD, green after; `design check
--part pages/sketches` 0 findings. Not verified: the real server's old row of an @edit sketch live; the other DIFFs; CI.

**B502c as built (Linux builder subagent, 2026-11-14, commit "fix(ethlete-studio): Draw the sketches harness sample
like its design"):** `compare pages/sketches --product studio` on 49e38b948: 31 DIFF states, sum 689346 px
(page-sketch 3063, narrow-part 17426, all-unchanged 12474, edit-sketch 8805, change-crop 19650, change-crop-whole
17950). After: 16 states ok, 15 DIFF, sum 358188 to 447115 px over three runs (page-sketch, narrow-part,
all-unchanged, edit-sketch ok; change-crop 1369, change-crop-whole 146); `compare --base HEAD`: 0 new failures, 17
fixed. Items, each measured with `design dom` vs `--app`: (1) zoom-chip@edit row, Cause: sample data; the design
tree lists every `PARTS` key (title-bar, zoom-chip@edit, zoom-chip), the app two, and its edit sample selected
zoom-chip; fixed (`componentsLayerOf`, sketches-sample.ts). (2) Avatar, Cause: sample data; the
design pin is `PAGE_PIN` with initials TB, `SKETCH_PINS` said H; fixed. (3) Stack edges, Cause: the design draws them
in the frame (`.sk-fit` border wraps shot and edges, 73.7 px), the app bordered only the 62.2 px crop, edges below;
fixed (border on the stacked wrapper); 1369 px residual on the edge corners, parked. (4)
Fold row, Cause: the design's disclosure button is `w-full`, the label shrinks to 166 px and wraps; the app's
`ethlete-disclosure` host is `block` at max-content; fixed (`class="w-full"` on it). Also: (5) the
collapse button sat 8 px left in every shell, Cause: `ShellCollapseComponent` carried the design's preview `p-space-2`
as host padding; moved to the components/shell-collapse harness sample; (6) the frame clipped focus rings
(`overflow-hidden`; design `overflow-clip`, 8 px margin), fixed, a crop clips on its scale box; (7) edit-sketch drew `round-1` and no edit hint,
Cause: no `round: 'edit'` in the sample, no "Kein Verwerfen" line (`data-sk-edit-hint`) in the app; fixed. Fallback removal (ADR 0235):
`DESIGN_HARNESS_SAMPLES['pages/sketches']` now throws `no sample for prop part=<value> of part pages/sketches` for a
`part` value without a sample; it removes the silent fallback to the title-bar rows that drew b685abce7's edit state
as 24 title-bar frames (spec in design-harness-samples.spec.ts fails on the old code). Parked: the wide head note
renders larger in the compare shot of some wide states (idle, paused-reason, new-part, comparing; varies per build;
`design dom --app` of idle measures the design's 190.5 x 64.8 px), not new at HEAD; the zoomed and matrix states
(zoomed-page, below-fit, far-out, narrow-far-out, unchanged-matrix(-open), withdrawn-hidden, unchanged-open) not
measured. `design check --part pages/sketches` 0 findings; vitest related 439 green; tsc, lint clean. Viewed: app
shots of page-sketch, idle, change-crop. `compare --base HEAD`: components/shell-collapse all ok; elements/shell-main 0 new, 19 fixed.
Not verified: other pages that embed the shell; CI.

**B502d as built (Linux builder subagent, 2026-11-14, commit "fix(repo): Fold the sketches states like the design"):**
`compare pages/sketches --product studio` on da9d62b3d: 13 ok, 18 DIFF, 63 actions missed (60 in edit-sketch, 3 fold
buttons), 7 states unchecked (design props agent, question, port have no app input). After: 13 ok, 18 DIFF, 0 actions
missed beside those 7. Per state before to after (px): edit-sketch 94936 to 4397, withdrawn-hidden 59791 to 4525,
all-unchanged 852 to ok, unchanged 4797 to 4384, unchanged-open 10233 to 9820, unchanged-matrix 34990 to 34639,
unchanged-matrix-open 40966 to 40865, comparing ok to 51440; unchanged: zoomed-page 82405, sticky-names 58240,
below-fit 63183, far-out 11733, narrow-far-out 29481, narrow-part, narrow-below-fit, withdrawn-shown, picked,
sketch-only-points, multi-part, multi-part-many 4525 to 4527, sketch-only-points-open 1476, change-crop 14054,
change-crop-whole 29041. (1) edit-sketch, Cause: 76fdeeca8 made new a base row, so `foldedStatesOf` saw no variant and
folded nothing, while the design's `unchangedStates` folds the states no row changes (4 fit states); fixed, base rows
count when no shot of theirs changes the state. (2) withdrawn-hidden, Cause: the app folded by the listed rows, the
design by every row of the part (`unchangedStates(full)`), so a hidden withdrawn variant's changed states folded (7
against 3); fixed, folding reads all rows. (3) Fold button name, Cause: `sameVariants` printed "Variante <label>", the
design names a labelled row by its label (Unverändert: Entwurf 2); fixed. (4) The 4525 px states, Cause: the fold
label wraps in the design (166 px, its disclosure button `w-full`) and not in the app (200 px), since b4b4e2fda set
the disclosure host `min-w-0` so a click beside it no longer opens all states; a design question, not changed: the
design should drop `w-full` from that fold button, or the app goes back to `w-full`. (5) zoomed-page, sticky-names,
below-fit, unchanged-matrix: measured `design dom` of zoomed-page, the design sizes gutter names and notes 12 px
(`--sk-note`, `--sk-label` at zoom 0.6 above its fit), the app 9 px and 7.8 px, the value `textAt` gives below a fit of
0.8 or more; Suspect: the app's `noteFit` holds a fit measured before the matrix layout settled. (6) comparing, Suspect:
the parked head-note size race (its notes wrap larger in this shot). Not verified: far-out, narrow-far-out,
change-crop-whole, sketch-only-points-open measured with `design dom`; the 7 unchecked states; CI.

**B502d follow-up (Linux builder, 2026-11-14, fbeb7c12d):** item (2), withdrawn-hidden folding by every row, reverted:
it made `comparing` DIFF 51440 px (2 of 2 runs; ok with the da9d62b3d sources in a scratch copy, ok again after the
revert). Cause unknown: `design dom` of comparing matches design and app after settle, only the compare shot's head notes
render larger; Suspect: reading `rows()` instead of `listedRows()` shifts the fit pass into the head-note race. Full
compare on fbeb7c12d: 13 ok, 18 DIFF, 7 FAILED (no app input for agent/question/port, finding 489), no action missed;
comparing ok, all-unchanged ok, edit-sketch 4397, withdrawn-hidden 59791 again. Open: redo the withdrawn fold without
touching the fit timing (e.g. `listedRows()` plus the withdrawn rows only) with a spec.

**B502e as built (Linux builder subagent, 2026-11-14, slices A-C):** (A) fold button, look pick "Empfehlung gebaut":
the pages/sketches design no longer stretches the fold row's "Alle Zustände zeigen" disclosure; `.replace(' w-full ',
' ')` on its markup was refused by `design check` (PART-REWRITE, it wants a `components/disclosure` option, outside this
slice's paths), so the design wraps the disclosure in a `min-w-0` span like the app's `min-w-0` host (b4b4e2fda) and the
button sizes to its label. `design check --part pages/sketches`: 0 new findings (4 OLD CANVAS-UNDER-PANEL). Full compare
before (1f0303837, px from the B502d notes, not re-measured here) to after: 13 to 19 ok, 18 to 12 DIFF, 7 FAILED (finding 489), every action works; to ok: narrow-part,
narrow-below-fit, picked, sketch-only-points, multi-part, multi-part-many (4525/4527), edit-sketch 4397, unchanged 4384;
withdrawn-shown 4525 to 131, withdrawn-hidden 59791 to 59779, unchanged-open 9820 to 9807, unchanged-matrix 34639 to
34623, unchanged-matrix-open 40865 to 40964, narrow-far-out 29481 to 24954, change-crop 14054 to 9510, change-crop-whole
29041 to 29182; unchanged: zoomed-page 82405, sticky-names 58240, below-fit 63183, far-out 11733; comparing ok.
(B) Fold specs of 78af9a6d5 bitten in a scratch copy with the da9d62b3d `sketches.component.ts` and `studio-labels.ts`:
"folds the states neither old nor new of an @edit sketch changes" and "names a folded variant by its label like its row
head" go red (with 4 label specs), all 51 green on the current code; nothing to strengthen, no commit. (C) withdrawn fold: `foldedStates` folds by `listedRows()` plus the withdrawn rows it hides. Attempt 1 passed
`[...listedRows(), ...rows().filter(isWithdrawn)]`: comparing and withdrawn-hidden ok (2 of 2), but paused-reason DIFF
52630 and new-part DIFF 14599 (2 of 2, ok with the f56f9a01c component swapped in), though neither state has a withdrawn
row, so the folded set was the same (new-part's diff shows the variant columns shifted).
Attempt 2: a `hiddenWithdrawnRows` computed that counts two empty lists as equal, and `foldedStates` passes
`listedRows()` itself while it is empty; `compare --state comparing,withdrawn-hidden,paused-reason,new-part` 2 of 2 runs
all ok, but the full compare 2 of 2 runs: comparing DIFF 51440 (as in B502d), withdrawn-hidden ok, 19 ok. Both attempts
reverted (no commit; spec "keeps a state a hidden withdrawn variant changes unfolded" was red on f56f9a01c, 2 folded
not 1, green with either attempt, reverted with it). Cause: a `foldedStates` that re-runs on anything beyond
`listedRows()` moves the fit result of comparing in a full compare and of paused-reason/new-part, though the folded set
stays equal; the state result also depends on the run order (targeted vs full). Suspect: the fit pass measures before
the fold re-layout settles (B502d's head-note race). Open: make the fit pass settle-safe first (`noteFit`/fit after the
last layout), then redo the fold. Not verified: CI, the 7 FAILED states.

**B502f as built (Linux builder subagent, 2026-11-14, e09bbf7ce and the withdrawn-fold commit after it):** Cause, measured
with a logging build and Playwright on the harness page (zoomed-page, below-fit, paused): (1) the first fit pass runs
before `listSize` is measured (list width 0, no rows rendered yet, since the rows wait for `listMeasured()`), so it
measures fit 1; `noteFit` keeps the first measured fit under a user zoom, so zoomed-page, sticky-names and below-fit
sized notes and gutter names by fit 1 (9 and 7.8 px) while the real fit is 0.143. (2) `document.fonts.ready` resolves
before Noto Sans Mono loads (it starts only once the gutter's mono text renders, about 15 ms later); the gutter
shrinks from 165.6 to 162 px, but no tracked signal changes, so whether a fit pass lands after the swap depended on
unrelated recomputations: the head-note race of B502d/B502e.
Fix: the fit pass waits for `listMeasured()`, `fontLoads` counts `fonts.ready` and every `loadingdone`, the fit
records the font count it was measured under, and `noteFit` takes a new fit after a font load. Full compare 2 of 2
runs: 19 to 23 ok (zoomed-page, sticky-names, below-fit, far-out). Then the withdrawn fold
(B502e C) again: 24 ok, comparing and withdrawn-hidden to ok, 7 FAILED (489). Bites: "sizes the notes of a user zoom by the fit of the
rendered matrix, not by a fit before the list is measured" (9 px not 12) and "fits the matrix again when a font loads
after the first fit" red on b9e040148, "keeps a state a hidden withdrawn variant changes unfolded" red on e09bbf7ce;
all green after. unchanged-matrix, Cause (`design dom`): the design's `matrixFit` ignores the fold column (`--sk-note`
9.886 px, fit 0.3035), the app subtracts it (fit 0.245, 12 px), a design/app rule conflict, not timing. Not verified: CI,
the 7 FAILED states, a font that loads after a user zoom in the live app.
As built (b1 approved "Empfehlung gebaut"): the design's `matrixFit` in `pages/sketches/shared/sketch-rows.ts` subtracts
the closed fold column plus one gap, like the app. Compare: 24 ok / 7 DIFF as before, unchanged-matrix 39861 to 13040,
the other DIFF states unchanged. Not verified: a live shot.

**B502g as built (Linux builder subagent, 2026-11-14, 67993cd08 and the design commit after it):** Full compare on
361d25ac7 (2 runs, same): 24 ok / 7 DIFF / 7 FAILED (489). After (2 of 2 runs): 27 ok / 4 DIFF. To ok: change-crop-whole,
narrow-far-out, unchanged-open; change-crop 9510 to 792. Causes, measured with
`design dom` and the diff shots: (1) the screen crop matrix (`screenWorld`) passes no `first` and has no `auto` fold
column, the app drew "erste Änderung" and an empty fold column (matrix 24 px wider, fold row 1084 not 1076 px); (2) the
app's stacked crop wrapper stretched to the grid row (91 not 73.7 px) and drew the stack edges unscaled (radius, 2 px
shadow), the design draws them inside the scaled shot box; (3) narrow-far-out: the fit pass wrote the full head width
(144 px) over the head-hidden `max-content` columns; (4) unchanged-open: the design offered Übernehmen on an unchanged
sketch, which the app never does since 30a5c27b9 ("an unchanged sketch never offers a manual merge"); the design's
`headOf` now drops it for `isSame` rows. Specs "draws the crop matrix like the screen design" and "sizes a hidden head to
its tag after the fit pass" red on 361d25ac7 sources in a scratch copy, green after (only the first assertion of the crop
spec is shown to bite). Left: change-crop 792, Suspect: sub-pixel offset of the first stack edge (1 px line at y 352);
withdrawn-shown 131, Suspect: the design switch track draws its `light-dark(ink, transparent)` inset ring (light edge),
the app's does not, so the color scheme differs at the switch; unchanged-matrix and unchanged-matrix-open not measured.
`design check --part pages/sketches`: 4 findings, all OLD CANVAS-UNDER-PANEL. vitest related 158 green; lint, tsc clean.
Not verified: no design spec for (4); CI; the live app.

**B502h as built (Linux builder subagent, 2026-11-14, 3ddb4efba, 52685c6f9, 006ab4a9c):** Full compare after (2 of 2
runs): 31 ok / 0 DIFF / 7 FAILED (489). Before to after (px): unchanged-matrix 13040 to ok,
unchanged-matrix-open 20408 to ok, withdrawn-shown 131 to ok, change-crop 792 to ok. Causes (`design dom`, shot pixels): (1) the design's start pan (camera x -4000) clamped against the world before the font load (room
2 px) and no later fit clamped it again, so the design stayed panned 2 px (`--sk-pan-x: 2px`, sticky gutter edge drawn)
while its matrix (1074 px) fits the list (1076 px); `fit` now calls `pan(0, 0)`. (2) the app world kept `min-w-full`
on a wide part, so the fold row was 1076 px, the design's `w-max` world 1074 px; the app drops it unless the screen-crop
matrix shows (the design's screen world is full width). (3) the design shot box (positioned) paints over the first stack
edge's top, the app drew the edges in their own box after the frame (rows 352/353 at 35/19 not 15,
row 358 at 35 not 45); the app now draws them in one scaled box after a shot-high spacer, under a `z-1` frame. (4) the
design's sdk switch drew the checked ink edge in dark too; Q102 and the lib draw it only in light
(`light-dark(ink, transparent)`), the design now does. Specs "sizes the world of a wide part to its matrix", "draws the
stack edges below a shot-high spacer" red on 9635fe92f sources, green after; vitest related 160
green; lint, tsc clean. `design check`: pages/sketches 4 CANVAS-UNDER-PANEL (same 4 as B502g), components/switch 0,
pages/inbox (embeds the switch) clean. Not verified: the cause split of unchanged-matrix-open (ok after (1)
and (2) together); no design spec for (1) and (4); CI; the live app.

**B502i as built (Linux builder subagent, 2026-11-14, d1f722990):** `components/disclosure` takes `hug?: boolean`:
without it the toggle keeps `w-full`, with it the toggle sizes to its label. pages/sketches passes `hug: true` to the
fold row's "Alle Zustände zeigen" instead of the `min-w-0` span of B502e. The app `DisclosureComponent` has a `hug`
input (`booleanAttribute`): button `w-fit` instead of `w-full`, host `contents` instead of `block`, so the button is the
fold row's flex item as in the design (a `block` host with `w-fit` drew unchanged-matrix-open DIFF 20408 px). A first try
glued `'w-full '` to `gap-space-2`: `design check` caught it (CLASS-GLUED-INTERPOLATION, an @edit sketch it removed
again once spaced). Compare: components/disclosure 12 ok, pages/merge 5 ok; pages/sketches in a scratch copy 31 ok / 0
DIFF / 7 FAILED (489), 2 of 2 runs; the main checkout's unchanged-matrix is DIFF 13030 px (app panned 2 px) with and
without this change; pages/system 26 DIFF identical on HEAD. `design check`: disclosure, merge clean, sketches 4
CANVAS-UNDER-PANEL (B502h), system 2 warnings. Spec red on HEAD app files, green after; vitest related 183 green;
lint, tsc clean. Not verified: the 2 px pan; the pages/system DIFFs; CI; the live app.

**B502i pan as built (Linux builder subagent, 2026-11-15, this commit):** Cause (compare shots,
matrix and fold edges x 340/481 app, 342 design, app gutter divider drawn): the app opened panned 2 px. Its start
camera (x -4000) clamps against the room `canvas.measure` reads, but that read effect did not track `fontLoads`; the
room was taken before Noto Sans Mono narrowed the gutter and never re-read. Fix: the measure effect reads
`fontLoads()`. Spec "clamps the start camera again when a font load narrows the content" red on HEAD, green after.
Compare: unchanged-matrix 13030 and unchanged-matrix-open 20408 to ok, 2 of 2 runs. Not verified: CI, live app.

**B502j as built (Linux builder subagent, 2026-11-14, 3d28a1e00):** (1) The e2e `settled()` (run before every case)
waited until no sketch row had `data-sk-unsized` (63399aedb), but after 10 s its loop ended and the case ran on with an
unmeasured row. Now `settleLayout` (`e2e/settle-wait.mjs`) throws `not settled after 10 s: row <key> unsized` (or `<n>
change mark(s) pending`); a layout that still moves keeps the old behaviour. Live: with every row forced unsized,
ctrl-wheel --view sketches passed 3/3 on HEAD (23 s each), now fails 3/3 naming `row current, row a`. Spec
`settle-wait.spec.mjs` red on the old loop, green after. (2) [System] switch time red. Cause (measured): the e2e fixture
adds an unnamed sketch on elements/shell-main, shown as a `shell-main` leaf in the Sketches group; since shell-main
is no longer a `part` row, the case clicked that sketch row (sketch view, 0 canvas frames) and recorded `all NOT` at
10000 ms. Fix in the e2e only: it picks a row outside Sketches/Legacy (`markPartLeaves`). icons->shell-main first:
NOT -> 1116 ms (15 frames), with `--hold-listings 14000` 1064 ms; the case passes 1/1 both ways; ctrl-wheel all 6 pages
pass under the hold. Not verified: the full e2e suite and CI (every case now fails on a row unsized past 10 s).

**B502k as built (Linux builder subagent, 2026-11-14, 7425e42bf, 2bf00b602):** pages/system 26 DIFF to 2 (2 of 2 full
runs, 27 ok). Causes, measured on the shots and `design dom`: (1) the app sample `SYSTEM_TREE` listed Components before
Elements, the design part-tree (3d2a32cf8) and the app's `SYSTEM_GROUPS` list Elements first; 24 states 13241-13639 to
ok or the 398 px group. (2) the app disclosure host was a `block` flex item shrunk to its label, so `ms-auto` pushed Gründe to the row
end; the design's `w-full` toggle is the row item. Host now always `contents`: the 398 px group (part, fit, part-focus-visible, one-blocker, agent-*), direct-edit-closed
1434 to ok. (3) the design's `blocked-checking` build sample (b685abce7, ADR 0270) had no case in `buildReadySampleOf`,
so the app drew no footer: 15860 to ok. Left, Cause measured: direct-edit 20848, blockers-open 1553: the SDK
`anchoredDialogOverlayStrategy` caps at `maxHeight: 80vh` (716 px, scrolls), the design's anchored-dialog has no cap
(769 px); a design/SDK conflict. Recommendation: the sdk
design dialog draws the lib's 80vh cap. Specs red on HEAD in a scratch copy, green after; vitest related 193 green; lint,
tsc clean. Compare: pages/sketches 31 ok / 0 DIFF / 7 FAILED (489), components/disclosure 12 ok, pages/merge 5 ok.
`design check`: pages/system 2 warnings, components/disclosure and pages/merge clean, pages/sketches 4 OLD
CANVAS-UNDER-PANEL. Not verified: CI; the live app.

**B502l as built (Linux builder subagent, 2026-11-14, 8fa1bbe24):** `design actions --product studio --live` on
2ab761101: 62 click timeouts ("locator.evaluate: Timeout 30000ms"), all on a control the click removed: 6
pages x the Studio-menu items and the page-switching nav/product/Hide-panel buttons. Cause (measured, spec): the
runner read the clicked control's toggle attributes with an unguarded `locator.evaluate`, which waits 30 s for a
removed element. Fix: `toggleStepOf` answers null when the control is gone. After: 0 timeouts (2 of 2 runs), failed
118 to 69 of 485; then visible: Erscheinungsbild/Hilfe close the menu (B502m), button System drift (B502n), and (a)-(c)
of B502o. Spec red, then green; vitest, lint, tsc clean. Not verified: CI.

**B502m as built (Linux builder subagent, 2026-11-15):** Cause (probe, spec): `tabAwayFrom` pressed Tab before each click, which closes the open Studio menu. Fix: `tabAwayFrom` presses Shift, Tab only while the element holds focus. After: `actions elements/studio-menu --live` 12 to 0 failed; full `--live` 69 of 485 to 57 of 513 failed: the
12 studio-menu checks gone, none new. Spec red on HEAD, green after. Not verified: CI.

**B502n as built (Linux builder subagent, 2026-11-15):** Cause (probe, spec): the runner. On merge and sketches the
section `Sketches` draws rail `System` current, so System is `aria-current=page` before the press and the outcome
listed only gained ones. Fix: `liveOutcomeOf` also names the pressed control when it is current
after the press. After: drift System ok; full `--live` 57 of 513 to 58 of 498, the rest one flaky
merge load. Spec red, then green. Unverified: CI.

**B502o as built (Linux builder subagent, 2026-11-15):** (a) studio (2.) productChange. Cause (probe, spec):
the runner scanned the unstyled `#root` design copy, so `nearestControlOf` paired the app picker with the design
rail bubble. Fix: the page picture is drawn
with `boxes`, `liveControlsScriptOf` places by `data-box`; `expandedOf` reads the control of a key that has one.
(b) separator sideWidthChange: `actionInputsOf` presses ArrowRight, ArrowLeft for separator, slider,
input-range (Cause, live run: Enter/Space only). (c) Sucheninstudio: Cause (read): `title-search.ts` declares no data-et-action; design decision. After: `actions elements/shell-main --live` 44 of 435 to 6 of 559 failed (the 6 search). Specs red, then green. Unverified: CI, the full `--live` run.

**B502p as built (Linux builder subagent, 2026-11-15):** the lib design mock `anchoredDialogStyles` (libs/components/design/anchored-dialog.ts) draws `max-block-size: 80vh` next to its `80vw`, like `anchoredDialogOverlayStrategy`; the pane grid already scrolls the content. Compare pages/system: direct-edit 20848, blockers-open 1553 to ok (after `nx build components`: check refuses stale dist mocks). `design check` clean but the old 4 CANVAS-UNDER-PANEL. Not verified: CI.

**B502q as built (Linux builder subagent, 2026-11-15):** `SketchesComponent` takes `agent`, `question` and `port` inputs and draws the design's agent line, question line (pickers to top-24, rows to top-37) and merge-port line; an agent not failed or a port shows zeichnet. B502r: sketch-view passes the open round's note as `question` (spec red without the binding); STATE-NO-SOURCE 7 to 5 (agent/port, parked in B154). The harness maps `agent`/`port` to samples. No host wiring (no data source yet), so `design check` adds 7 STATE-NO-SOURCE to the old 4 CANVAS-UNDER-PANEL. Compare pages/sketches: all 38 ok. Not verified: CI.

**B502s as built (Linux builder subagent, 2026-11-15):** `design dom --app` drives forced and click-opened states as compare does: `harnessShotOf` and `harnessDomOf` share one driver and `harnessDriveOf`/`harnessPropsOf`. The DOM lists open overlay panes after the host, a forced element carries `data-et-forced`. Refused only what compare cannot reach: a force other than hover/active/focus-visible, a click open without a single origin state. Live: error-toast close-hover marks the dismiss button, pages/system blockers-open prints the dialog pane. Specs red on HEAD, green after; lint, tsc clean. Not verified: CI.

**B502 ADR 0301 as built (Linux builder subagent, 2026-11-15):** `parseAction` reads `opens:<part>` (name or full
key, `openedPartKeyOf`); `--live` passes it when the press adds an overlay that holds the opened part's `implements`
component where it has one (`openedOf`); the harness check prints `ok (warning: …)`, as it draws the part alone.
`title-search` declares `opens:command-palette`. Specs red on HEAD, green after; lint, tsc clean; `design check
components/title-search` static clean. Not verified: the `--live` run (3 tries: the harness build waited 5 min on other
agents' `studio:e2e` heavy-run lock), and so the action record of title-search (RECORD DROPPED for the same reason), CI.

485\. The UI builder ran the full `design check --product studio` (about 7 minutes) at the end of the A1 slice, which
only touched `components/title-bar` (ethlete-sdk-c8, 2026-11-06). Tom: "das frisst den halben tag". Cause: the builder-agent skill told every slice that changes `apps/<app>` or `.ethlete/design` to end with the full
product check; no gate asked for it. Why no tool caught it: `design check` had no scope for "what this slice changed". Fix: (1) the builder-agent skill now
names a part-scoped check for each touched part and each part that embeds one, and keeps the full run for pre-push and
CI (done in this commit); (2) tool: `design check --product <p> --base <ref>` checks only the parts whose design or
implemented app files changed since `<ref>`, plus the parts that embed them, and prints which parts it chose. Built in
the performance block of ADR 0199.

485 as built (Linux builder subagent, 2026-11-14, B503): before, `check --product studio --base HEAD` exited 2 and ADR 0199 named no item. Built: `check --product <p> --base <rev|range>` prints `BASE <p> since <base>: <n> part(s)` and checks each chosen part; `--base` with `--part` exits 2. `base-parts.ts` reads one diff (`gitDiffChangesOf`, also behind `--rules --base`): design files via `touchedPartsOf`, app files via `appFilesOf`, plus embedders (`embeddedPartsOf`). `compare --base` chooses no parts. Verified: `check-base.spec.ts` (an app or design change picks hero + home) red before, green after; live `--base c230d01b3^` checked 17 studio parts, exit 0, in 627 s (slower than the ~7 min full check; see 485b). Skill line stays.

485b as built (Linux builder subagent, 2026-11-14): `check --product <p> --base <rev|range>` passes the chosen parts to `checkSystemRendered` as `parts`, which starts one design server and Chromium (`createRunDraw`), one stamp scope and one `tsc` per product, then the part-scoped check and lint gate (`afterPart`) per part; output as the per-part runs. Verified: `check-base.spec.ts` "starts one design server and browser and typechecks once" red on the old code (2 `createRunDraw` calls), green after; the hero + home run prints the same 193 lines byte for byte before and after; live `--base c230d01b3^` (17 studio parts, exit 0, same lines as the old build bar the launcher's build note): old build 486 s cold, then 127 s warm; new build 114 s warm. Cause (measured with ETHLETE_DESIGN_PHASES=1): the 486 s (and 485's 627 s) were `open-points` at 360 s, the slow checks of `recordCheckedBuildReady` on a cold check-record cache, not the per-run setup; warm, `open-points` is 4.7 s in both builds, server and browser start under 0.1 s, and the slice saves the 17 typechecks (`static` 16.7 s -> 8.3 s). Warm, 17 parts (114 s) beat the full check (~7 min, not run here). Suspect: the remaining per-part cost is `completeness` (53 s) and `render-inspect` (28 s), drawn per part; one `renderIssuesOf` job and completeness pass over the set would cut it. Not verified: a cold run of the new build.

489\. `design check` shows 2 CONTROL-STATE problems on `shell-main`: the rail controls `section` and `product` are
hand-drawn `<button class="st-shell-bubble">`, not an SDK component (builder ethlete-sdk-c8, 2026-11-06). They came in
with 2008b4848 and 5ec59cccc (10-27/28); the rule (4f1ba2b3e, 11-02) never ran over existing products, so it landed
on violations without a fix or baseline. Why no tool caught it: CONTROL-STATE is a draw rule;
pre-push runs `check --rules` (static, no draw), and the CI `--slow` set covers only APP-SPEC, UNCOVERED-REGION,
VISIBLE-CHANGE, COMPARE and SDK-ERROR. The draw rules (CONTROL-STATE, DROPPED-PROP, ACTION-LOST) ran only in a manual
full `design check`. Tool fix: the draw rules join the `--slow` set with the per-part input-hash cache;
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

Archived: Build-ready decisions (2026-11-03), see [findings-2026-11](archive/findings-2026-11.md).

493\. c8, 2026-11-06: the compare of the 8 parts A1 left uncompared runs one part at a time, because "two design runs
at once race on dist/libs". So the gate fix of finding 491 takes 8 × ~1 min serial, and two builders cannot run design
commands at the same time in one checkout. Why no tool caught it: every design call builds the libs into the shared
`dist/libs` with no lock and no per-run output, and no spec starts two calls at once. Tool fix (technical): part of the
492 resident process, which owns the one lib build and serves every caller; until it lands, a design call takes a lock
on the lib build and waits (with a printed "waiting for the lib build of pid N") instead of racing, and a spec starts
two `compare` calls at once and expects both to pass.

As built (S1, builder c0, 2026-11-06, commit `fix(cli): Lock the shared lib build of design calls`): a shared/exclusive lock on `dist/libs` in `tmp/design-lib-build` (`libs/cli/src/lib/design/system/lib-build-lock.ts`, used by `readFreshDist` in `stale-dist.ts` around every drawing design call). A call takes the build lock (prints "waiting for the lib build of pid N"), rebuilds only when stale and only after every other live run finished reading (dead pids are dropped), then reads under a reader file until it exits; a nested design call skips the lock. Verified: `lib-build-lock.spec.ts` (two calls at once, one build, the waiting line; no rebuild under a live reader), bites with the lock removed. Not verified: two real concurrent `compare` runs; `serve` and manual `nx build` stay outside the lock.

As built (S2 of 492, builder c0, 2026-11-06): `et design compare` goes through a resident process per checkout (`libs/cli/src/lib/design/resident/`): HTTP on 127.0.0.1 with a token, newline-delimited JSON frames carrying stdout, stderr, heartbeats and the exit code; discovery file `tmp/design-resident/process.json` (pid, port, checkout, CLI build, token), log `resident.log`. The first compare starts it detached under a start lock, printing the cold start once; a dead pid is replaced, another CLI build is stopped and replaced, a live process that does not answer is killed; then, as when one ends mid-run, the call runs in-process, one line. Idle exit after 30 min, `et design stop`; `CI`, `ETHLETE_DESIGN_RESIDENT=0` stay in-process; only compare uses it. It keeps the design server, render worker, Chromium (`shootStatesWith`) and, while `harnessKeyOf` is unchanged, the harness server warm. A changed lib build stamp or design config restarts the design server and Chromium. Measured `compare pages/start`: in-process 13.4 s, resident cold 17.0 s, warm 2.2-3.9 s, but 13.3-14.3 s when the harness key changed: it hashes every checkout file, so another session's libs/cli edit rebuilds the harness (11-12 s) - S3 must scope or watch it. Verified: 14 biting specs in `resident/*.spec.ts`; warm OK/DIFF lines equal the in-process run. Not verified: two clients starting at once against real processes, `--live` through it.

As built (S3 of 492, builder c0, 2026-11-06, commits 793daca83 and the fix 320c5c2af): the harness key covers only the harness app's real inputs (`system/harness-inputs.ts`: the app folder, files its build sources reach by relative import, templates, styles, tsconfig path aliases, project.json build inputs, root files except `*.md`). The resident process runs `nx run ethlete-studio:build:development --watch` (`system/harness-watch.ts`): a request waits for an idle watch build of its input state, done at Angular's `Output location:` line plus 200 ms of quiet output folder; root, tsconfig, project.json, package and dot-folder edits restart the watch. After the first build the process touches the mtime of `apps/ethlete-studio/src/main.ts` to pre-warm Angular's ~10 s first incremental build; known limit: an edit under `.ethlete/design/studio/foundations/*` restarts the watch (~12 s), because Angular ignores dot folders. Finding 504: 793daca83 alone broke the resident compare; 320c5c2af adds a `startWatch` spec with Angular's real line order that bites on both bugs. Measured `compare pages/start --product studio`: in-process 23.3 s, cold 22.0 s, warm 3.8 s, warm after an app source edit 5.0 s (watch wait 1.4 s); target 5 s met. Not verified: an emit failure after the `Output location` line waits for the 5 min timeout; the warm-up touch and foundation restart paths have no end-to-end run.

As built (S0 of ADR 0208, builder c0, 2026-11-06): every timed `et design` command (all but serve, mcp, stamp, timings and the resident itself) appends one JSON line to the gitignored `.ethlete/design/.timings.jsonl` (`libs/cli/src/lib/design/timings.ts`): command (with subcommand), args, parts, session (`CLAUDE_CODE_SESSION_ID`, `TMUX_PANE` without a tmux call, `ETHLETE_AGENT_ROLE`), resident flag, start, total, exit code, phases, queue wait (resident request queue plus longest draw-queue wait), build wait (lib-build lock, harness build or watch wait), browser and design server start, cache hits and misses (thumb, shot and harness caches) and the other live lib-build readers as concurrent heavy runs. `timedPhase` always records; the `PHASE` stderr line stays behind `ETHLETE_DESIGN_PHASES=1`. A thrown run logs exit 1, the line is also written on exit, write errors are swallowed. A compare the resident answers is logged once, by the resident, under the caller's session (forwarded env). `et design timings [--since <n>m|h|d] [--command x]` (default 1d) prints the median per command against the targets (compare 5 s, sketch check and ready 10 s, full check 60 s), each run over target with its costliest phase, the slowest phases, runs. Verified: 10 specs in `timings.spec.ts` and `timings-command.spec.ts` (each piece broken once, a spec failed); a real `yarn et:design timings` run. Not verified: a real resident compare end to end (the spec drives the resident server with a recordRun stub, not `createWarmCompare`), and the cache, queue and concurrent-heavy counters on a real check.

494\. c8, 2026-11-06: after A1, `compare` of pages/flows, inventory and merge shows 21-31 px DIFF in every state. The
title bar matches pixel for pixel; the 21 px are 1-2 colour levels of anti-alias on the four rounded corners of the
left panel, which A1 did not touch. ADR 0115 (2026-11-01) decided one shared compare rule for pane corner anti-alias,
but only the sketch merge diff got a tolerance (`looksTheSame` in `merge-compare.ts`, 8 of 255 per channel, 2e5d9fa36);
the implementation `compare` still counts every changed pixel. Why no tool caught it: ADR 0115 was marked `open: none`
with no build sha and no STATUS row, so nothing tracked that the second consumer never got the rule. Tool fix
(technical): `compare` uses the same per-channel tolerance as the merge diff, from one shared function, with a spec
on a 1-2 level corner shift; the ADR check refuses an `open: none` ADR that has no `built:` sha (new ADRs only).

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

511 as built (Linux builder subagent, 2026-11-14, B503): `check --slow` runs the check without `--slow` on the same scope after the slow rules (each `--part`, or the whole product), so it writes the check record through the same `recordCheckedBuildReady` path; correct by construction, no second record writer (`check.ts`, help, docs Slow rules). Cause: `--slow` returned straight from `checkSlow`, which stores slow results but never calls the record step. Verified: `check-slow-record.spec.ts` (record writer called with the part) red on the old code, green after; live `design check --product studio --part components/title-bar --slow`: "No slow-rule problem (21s)", then "READY studio: components/title-bar", 27 s in all. Not verified: a whole-product `--slow` run live (it now also runs the full check).

512\. The NO RECORD line of components/title-bar ended with "(+1 more)", but no line of the check named that open
point. Why no tool caught it: the summary truncates the list, and nothing prints the rest. Fix: the check lists every
open point (or prints the hidden ones under the summary); spec with more open points than the summary shows.
Context: the ff698951f verify needs studio-menu, flows, merge, title-bar and shell-main together; title-bar misses
notice.hover/active/focus-visible. Decided by ADR 0106 (no question to Tom): a sketch round that draws them with the
existing styles, no new look, which Tom merges.

512 as built (Linux builder subagent, 2026-11-14, B503): the NO RECORD line names every blocker, joined with "; " as RECORD DROPPED already did, and no longer ends in "(+n more)" (`part-build-ready.ts`, docs Build-ready). Cause: `noRecordLineOf` printed only the first blocker and a count. Verified: spec with three blockers, red on the old code ("... #fff (+2 more)"), green after; the `--part` spec in `check-system-args.spec.ts` now expects every blocker. Not verified live: the live title-bar run wrote its record, so it printed no NO RECORD line.

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

As built (Linux builder, 2026-11-14, recommendation built, pick decided): the Sketches page (app and design part) never folds `old` or `new` of an `@edit` sketch, names them "Zuletzt gemergter Stand" and "Änderung behalten" through the row `label`, drops an Aktuell row, and each row keeps its Übernehmen button; part note and edit header text updated. Verified: sketches.component spec (new case, 444 related tests pass), design tsc, `et:design check`. Not verified: a real `@edit` sketch in the running Studio; side effect: the first-changed state marker no longer shows on `new`.
Verified live (B504, 2026-11-14): a scratch checkout with a direct edit of studio-lab `elements/list-row` opened
`elements/list-row@edit`; the headless Studio shows "Änderung behalten" and "Zuletzt gemergter Stand", each with
"Übernehmen", no "Unverändert" fold and no Aktuell row.

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

521 closed (Linux builder, 2026-11-15, B499 close): compare on a studio page 15.8 s in B499 P3 (was 47-106 s), sketch check cold 8.3 s in P1; no compare target exists.

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
As built (583, B502 links, Linux builder, 2026-11-14): `components/tree-row` keeps `tree-row.component`, and the Flows
list now draws its rows through that component instead of its own `[ethlete-tree-row-item]` loop, so a page renders the
linked file (the stack marks a selected row `aria-selected`, as the Flows loop did). The part tree keeps its own rows: it
draws a nested tree with `etTreeNode`, not the flat stack. `pages/system` stays on `system-page` (open). A derivation of
a page's link from the innermost app component at or around the live host (shared host and shell skipped) was built and
measured: it linked `system-view`, the real host, and the part check then failed with 19 DROPPED-PROP, because the
harness draws the linked component with the design props and `system-view` takes none. Cause (measured): the app draws
the part state of the System page inline in `system-view`, and `system-page` is a second drawing of the same states
that only the listing-error and legacy-call states and the harness use. Not committed. Next step: `system-view` renders
`system-page` for every state with its canvas projected, as the call state already does; then the link is right as it
stands, and the page derivation can land with a guard that a candidate takes the design props.
Verified on a scratch copy: `design check --part` on tree-row, part-tree, flows, inventory, sketches and system has no
findings (only the copy's own "changed outside a sketch" points, as it has no git), and the live run prints no LINKED or
UNDERIVED. Not verified: the Studio e2e suite on the Flows list.
As built (583, B502 system page, Linux builder, 2026-11-14): `system-view` draws every System state through
`system-page` (listing error, call, the notes start-server, read error and sketch missing, empty, part); its inline
shell, toolbar and canvas states are deleted. The app projects what the design does not draw: the side tree with its
remembered scroll (`systemSide`), the live canvas (`systemCanvas`, `systemCallCanvas`), the note (`systemNote`) and the
inventory toggle and exception error (`systemActions`). `system-page` gained `section`, `noted`, `missingShots` and
`openPoint`. So `pages/system` → `system-page` is now true. The Inbox canvas keeps the part canvas only, without the
System toolbar (the Inbox design draws none). Verified: typecheck, lint, related specs, `design check --part
pages/system` (0 findings, no part rewrite), live shots of part, page part, sketch missing, inbox, listing error, empty
and call, `studio:e2e --view system --hold-listings 14000` (41/41) and `page-switch.e2e` (4/4). Not verified: the
start-server and call-error notes live; the empty state keeps the app's tree in the side panel, not the design's
"none" line.

584\. Builder (2026-11-07, 994dd8bea): `addedBaselineNamesOf` flagged every entry that some older version of
`rule-baseline.json` did not hold, so only the first commit of the file could baseline anything and a second new rule
could never baseline its old hits (against ADR 0201). No spec covered a second rule. Fixed in 994dd8bea: an entry
counts as added only if an older version already held the same rule without it, with a spec for a second new rule.
Lesson: a decision that names a ratchet ("may only shrink") gets a spec for its second use, not only its first. Built in 994dd8bea.

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

612\. Builder (2026-11-09, eeaca8e0c): Large "a sketch scroll never empties a cell that had a picture" was red in 3
sharded runs. Cause 1 (app bug): `liveShotsOf` gave the 6 live slots in row order, so variant-a cells lost their iframe
before their picture loaded; now painted-without-picture > without-picture > pictured. A later blank iframe at
`down2+30` recovered by +300 ms, cause not proven. The tool did not stop it because the e2e job had
`continue-on-error`. Tool fix (technical): the job blocks (c99006d83), and the probe names its outcome (786f7adb0), so
the next red says which cause. Open: a harsher held-picture repro still empties cells when more than 6 near cells have
no picture; CI never showed it.

639\. Doc agent (2026-11-09, ADR 0236): measured loop time of the builder on 2026-11-08 (4 builder sessions, 16
subagents, 8 push-suite logs in `/tmp/push-suite*.log`). Studio e2e dominates: 26 min of direct runs, most of the 25 min
of wait loops, and 23.4 of the 29.5 min of push-suite time (165-197 s per run, 80 %). The cli step costs 85-104 s only
when cli changed; commit hook, lint and prettier together about 3.5 min. Polling (`tail -f`, `until grep`, `sleep`)
on e2e logs ate a large part of the "other" 24.6 min. Fix (item 0 of the binding order): the e2e step in push:suite
under 60 s over 3 measured runs, and the builder waits on e2e by notification, not by polling.

647\. Builder (2026-11-09, item 0): the Large case "a sketch scroll never empties a cell" fails under 8-worker load in
about 3 of 10 full runs, and blocked the push-suite on 99dda96f7 (e2e 132/133). Alone it passes 4 of 4. A cell loses
its iframe for 30-300 ms after a scroll under CPU load, so this is probably a Studio defect under load, not a test
defect (not proven). Why no tool caught it: the repeat gate runs the suite three times on one load level, so a fault
that needs CPU pressure passes until the load is high by chance. Tool fix (part of item 0, decided by the doc agent
under the anti-stall rule because it blocks the push): fix the empty cell at its cause in Studio; then the e2e runner
gets a load mode (CPU pressure on purpose) that the repeat gate runs, so a load fault fails every time and not one
push in three.

665\. Builder (2026-11-09, Mac night): two push:suite runs in a row failed e2e 132/133, each in another case (B462
Sketches first load, B463 System page switch timing); each passes alone. The red-CI fix 2bc4d42f2 waits behind
them, so the Rust audit stays red for hours because of two e2e flakes on another machine. Why no tool caught it: the
push gate has no record of which cases are known flaky on which machine, and B463 is a timing case that ADR 0230 moves to a non-blocking perf job, but B441 moved only four `libs/cli`
specs, not the e2e timing cases. Tool fix (tonight, bug queue): the e2e timing cases move into the perf job too (B441
applied to e2e), and the gate prints the B row of a known flaky case next to its fail. Cause the builder fixes next: `canvas.e2e.mjs:3020` gives
`min(8, floor(cores/4))`, 3 workers on the 12-core Mac.

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

683\. Builder (2026-11-10, Mac night, full `yarn studio:e2e` after 1cc2d2ee8, B472): `[Sketches] Fit is stable` hit
the 10 s `page.goto` timeout in setup while the Studio build ran, `load 46.3 on 3 worker(s)`. The fifth load-sensitive
case tonight (B464, B468, B470, B471, B472). Not caused by the 681 quiet tail. Why no tool caught it: e2e cases start
while a build of the same run still takes the CPU, and setup timeouts are fixed, so a case fails on the build, not on
Studio. Tool fix (bug queue, before the 679 backlog item): the e2e runner starts no case before every build step of the
run has ended; no load-scaled timeouts, because those hide a slow Studio. As built (681, 1cc2d2ee8): `quiet: true` cases
run last on worker 0 alone, every failed row prints `load <1-min> on <n> worker(s)`; the full run took 533.6 s against
503.6 s (+30 s, about 6 %, tail 62 s). Per ADR 0240 the tail cost is measured again after the build-order fix.

Reverted (grill decision, 540dc26db): 995491fb1 fixed no reproduced fail and cost a net 10 to 16 s per worker (ADR
0230, ADR 0240). It had no diagnostics that stand alone: the `warmUp` phase timing was there before it. The measurement
stays: each worker draws the same ~52 shots cold, which is 667 (c), one shot store for all workers.

Builder (2026-11-10, Mac day, B472 / 683 follow-up): no run after the 540dc26db revert has a `Fit is stable` fail.
Targeted runs of the three Fit cases (Sketches, Large, Chip) on 3 cold workers, `--cold-shots`, 12 busy-loop hogs,
1-min load 38 to 45: 6 runs, 18/18 pass; Sketches 42.6 to 45.2 s, Large 31.8 to 32.6 s, Chip 26.1 to 26.6 s, `warmUp`
20.0 to 21.0 s, first case at 75.3 to 76.3 s. The 10 s `page.goto` fail did not come back. No new suspect beyond the
683 one (the page `load` waits for cold shot draws); still not proven.

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

733\. Mac builder (2026-11-10, A1 rest, 7b6236922): `design compare components/title-bar` cannot judge two drawn states.
(a) The five `*-notice` states FAIL: the design draws the notice tooltip always open, the app opens `etTooltip` only on
hover or focus, and the design forces no interaction on the restart button. (b) `linux-full-notice-pending` DIFF 115 px
only on the spinner: the mock draws a static arc without `data-et-frozen-at`, so compare cannot hold the app's
indeterminate `et-spinner` at the mock's frame. Suspect: compare has no way to open an overlay a state draws, and no
rule that a mock of an animated control carries a frame. Tool fix (backlog): a state may name the interaction that
opens its overlay, and compare applies it; `design check` flags an animated-control mock without `data-et-frozen-at`.

733 as built (Linux subagent, 2026-11-14, 8685aba7f): (a) a design marks a trigger whose overlay it draws open at rest with
`data-et-opened-by="hover"`; compare finds it in the app by aria-label or role and text, as `data-et-force`, and
dispatches a mouse `pointerenter` without a real hover, so the trigger stays at rest. The title-bar puts it on Neu
starten in every notice state that does not force that button. Cause of the FAIL (measured): besides the missing
interaction, `settledPanesOf` stopped waiting once a page with 0 panes was quiet for 3 frames, before the 300 ms tooltip
show delay, so even `linux-full-notice-hover` failed; after a forced or opened-by interaction it now waits up to 1 s for
the drawn panes. Specs red on the old code, green after (part-compare.spec: 3 tests). Live `compare
components/title-bar --working-tree`: the five `*-notice` states and notice-hover/active now DIFF 529-534 px instead
of FAIL; the rest is the tooltip itself: the mock draws `bottom-end` with the arrow near the button end, the app
centres the arrow under the button (design or app drift, not a tool issue). (b) not built. Cause (measured with `design
dom`): the mock spinner carries `data-et-frozen-at` with `--et-spinner-frozen-at: 0.3`, but the button mock goes
through `ng()` with LOADER_IMPORTS, the real `et-spinner` re-renders it, and its default `diameter` input (18 px,
stroke 2.25) overrides the mock's 12 px style; the app's xs button draws 12 px. `linux-full-notice-pending` is now
DIFF 187 px from that size. A frozen-at rule would not catch it. Tool fix proposed: `spinner()` in
`libs/components/design/loader.ts` also emits `diameter`/`strokeWidth` attributes, so an ng-rendered mock keeps its
size. Not verified: other parts with ng-rendered sized spinners; the finding-789 sweep (no rule built).

733(b) as built (Linux builder, 2026-11-14): `spinner()` emits `diameter` and `strokeWidth`. The design server reads
`dist/libs/components/design`, so the mock change needs `nx build components` before a live run. Live `compare
components/title-bar --working-tree`: `linux-full-notice-pending` DIFF 187 px -> ok; the eight notice states keep their
DIFF 529-534 px (the tooltip arrow, sketch). Only title-bar renders a sized spinner through `ng()` (grep of
`.ethlete/design`); every other spinner mock is plain HTML and keeps its picture. Related specs green.

740\. Mac builder (same sketch): the clipping check flags the intended crop of the variants, and skip-scope refuses
the reason "intended" because the crop holds controls; only "inert" passes. Suspect only. Lesson: a check that accepts
only a wrong reason teaches the agent to give a wrong reason (as 737). Tool fix (backlog): skip-scope accepts
"intended" for a crop that a state marks as a crop, or the clipping check knows a crop frame; the builder says which
reason the sketch now carries.

746\. Mac builder (2026-11-10, B482 bite): the release smoke and its bite both failed "no frame painted". Cause (seen on a
screen shot): the smoke starts the unsigned bundle with its own HOME, so it finds no keychain, and CEF shows the macOS
prompt "Schlüsselbund nicht gefunden" (a keychain password prompt) that blocks the page. Suspect: the earlier
locked-screen failure was the same prompt. The human had to click several of these prompts away. Fix in the tree: with
`ETHLETE_STUDIO_SMOKE_VIEW` set, Studio passes `SecretStorage::Mock` (`--use-mock-keychain`) to the CEF runtime, and the
smoke opens the first existing sketch and fails at once when there is none. Lesson: the smoke cannot see a native modal,
so it waited for a frame that never came and named the wrong cause. Decided by the doc agent (tool internal): the smoke
fails early when the console log stays empty and no CEF page loads in 30 s, and its message names "native dialog?".

756\. Linux builder (same sketch): the repo's `pages/system` variant `a/tsconfig.json` is not formatted by Prettier.
Suspect: the generator writes it with `JSON.stringify` and no format pass (not checked). Backlog: the generator
formats what it writes; a spec runs Prettier `--check` on a freshly created variant.

758\. Linux builder (same sketch): Studio has no `components/banner` part, so variant c imports the SDK mock directly.
Note only: if the human picks c, the pick adds the part first (ADR 0010 flow), not a direct SDK import in a page.

Measured (same sketch, for 738): `sketch ready` took 29 s, and 1-2 min on a later run (target 10 s).

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

811\. Linux builder (2026-11-11, from the Mac): `design check --product studio` on a clean HEAD 87c279030 rewrote the committed `.ethlete/design/studio/ready.json` (+20/-136): "RECORD DROPPED" for foundations/colors, foundations/spacing and pages/inventory, each with an OFF-CENTRE problem "found by design check". OFF-CENTRE has a rule baseline (d8cf6cd80, ADR 0201): a baselined old hit must not drop a ready record. Suspect until reproduced: either the baseline misses these 3 parts, or the ready auto-accept path reads the render result without the baseline.
811 not reproduced on Linux (Linux builder, 2026-11-11), stays Suspect: in a HEAD export (0afe96985) with its own cli build and an empty `node_modules/.cache`, `design check --product studio --part` for foundations/colors, foundations/spacing and pages/inventory each printed "clean", 0 findings, and kept all 3 records; the full `design check --product studio` had no OFF-CENTRE hit in studio, no RECORD DROPPED, and only added or refreshed records (foundations/logo, foundations/type, pages/inventory). The code path matches ADR 0201: `renderSystem` tallies only the OFF-CENTRE issues the rule baseline does not list, and `withTalliedProblems` turns only those into "found by design check" blockers. So on the Mac those 3 parts most likely hit OFF-CENTRE without a baseline entry: the check measures text against font metrics, and the baseline was recorded on Linux. Next step: run the Mac check with `--part foundations/colors` and keep the OFF-CENTRE line it prints (state, size, element path), so the hit is either fixed or baselined.

811 on the Mac (Mac builder subagent, 2026-11-11, measured in a worktree with a patched copy of the rule). Cause (measured): the flagged text is set in `10px ui-monospace, "SF Mono", Menlo, Consolas, monospace` (`--font-code` in `.ethlete/design/studio/foundations/type/type.css`); the design frame loads no web font (`document.fonts.size` 0, status `loaded`), so the Mac draws SF Mono and Linux the generic `monospace`. SF Mono at 10px: ascent 9, descent 2, cap 7.29, an 11px line box. In the 22px content box of `co-ratio` and `sp-height` the 11px slack splits 5/6, so above 7.71 and below 9.0 (1.29 > the 1px tolerance); in the 16px `pages/inventory` box the slack splits 0/1 (3.71 / 5.0). The same font makes most `pages/sketches` `sk-gutter` gaps 0.65-0.95px, so their baseline entries no longer hit on the Mac. Not the cause: font load timing (no web fonts). Not measured: the Linux fallback numbers. Recommendation: self-host one monospace font and the UI font in the design styles, so both OSes measure the same font; a per-OS baseline entry (ADR 0201) keeps two truths and still drops records on the other OS; a tool fix in the rule removes only the 0.29px font share, not the 1px layout split. Side result: the main checkout's `dist/libs/cli` was stale against HEAD and the CLI gate refused it.

827\. Linux builder (2026-11-11, push:suite at c373dcfd0): "Not formatted in c373dcfd0: package.json"; the 820 subagent
added a script out of key order and reported prettier clean without running it on `package.json`. Cause (read,
`.husky/pre-commit:43`): pre-commit runs prettier only on staged Markdown blobs, so an unformatted `.json` or `.ts` file is
caught one round later by pre-push or push:suite. Tool fix (doc agent, tool internal): pre-commit runs `prettier --check`
on every staged Prettier-supported blob. Bite: a staged unformatted `package.json` fails the commit.

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

879\. Linux builder (2026-11-11, B480): `serverAnswers$` uses `fromFetch` with no timeout, so any hung request keeps
"Design-Server startet" forever (874 showed it). Lesson: a start screen that waits on a request with no timeout hides
every server fault. Tool fix: timeout plus retry, and after the timeout Studio says the server does not answer, with the
URL. Side: user-facing, after B249 (ADR 0269).

879 as built (2026-11-14): `serverAnswers$` emits `waiting | answers | silent`; after 30 s without an answer (the wait the doc agent set) the start screen shows the elements/shell-main `server-unanswered` state with `http://localhost:<port>` and a restart button, and keeps retrying; the design state now takes `serverUrl` as a prop. Verified: studio-view and shell-main specs (bite: the new studio-view spec fails without the fix), lint, typecheck, design check. Not verified: a real hung server in the running app, design compare (`design task` refuses: shell-main not build-ready).

899\. Linux builder (2026-11-11 night, B249 e2e 4c under `--hold-listings 14000`): the merged part's frame stayed empty.
Cause (probe + spec bite `canvas-frame-grid.component.spec.ts`): the `settledCells` linkedSignal of a state grid took an
inline source that read `grid()`; an equal re-read of the frames (held listing) reset the loaded count 7 -> 0, and loaded
imgs never fire `load` again, so the grid never revealed. Pre-existing, not from 487e24844. Built 57bac0dc0: the source is
a computed `shotsKey`. Suspect "aborted shot requests" refuted. Bite 883: with `leaveGone` reverted, 4c times out at the
open-part wait. Lesson: no spec set an equal grid input again while pictures load, and nothing flags a linkedSignal source
written as an inline function over an input (one more site: `loadedShot` in `canvas-frame.component.ts`, harmless). Tool
fix: a lint rule that asks for a computed source there. Open for the human (morning round): the rule would go into the
published `@ethlete/eslint-plugin`, so it changes lint for every consumer. Queue: tool backlog until decided.

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

955\. Linux builder (2026-11-12 night, 941): the sketch-check resident has no idle exit, so a resident started by a
subagent's `sketch check` keeps its Chromium (a 4.5 GB GPU process) after the subagent ends. Suspect (owner not checked,
not measured). Tool fix (builder default, tool backlog): the resident stops itself after N idle minutes, with a spec. Same class (Linux, 900): the e2e tool removes
a temp checkout without stopping its resident, so 3 `design __resident --checkout /tmp/studio-canvas-e2e-*` (about 0.75
GB each) stay and `design stop` cannot find them; the teardown must stop the resident first.

955 built d4e6b1477 + 6e15e4093 (Linux builder, 2026-11-15, B499 close): one idle end; P4 pass, 90 s after the run 0 design processes and 0 Chromium.

955 update (Linux, 6e15e4093): Cause of the e2e orphan residents (bite): at teardown the design server dies on `write
EPIPE` after the rmSync; the 875 crash log (4ca55ca3c) then mkdirs `<checkout>/.ethlete/cache` and writes its log, so
the checkout exists again and the resident's checkout-gone watcher (8a22c93af) never fires. Fix: crash-log.ts writes no
log when the target is gone. The spec fails without the fix; one e2e case on 4 workers left no resident and no checkout.

986\. Linux builder (2026-11-12 night, 941): the design server heap leak behind 941 is not hunted. Suspect: the resident or
the shot browser pool. Tool fix (builder default, tool backlog): a heap snapshot diff over two hours of `design serve`
names the retainer; then a fix with a spec that bounds the heap over 200 shots.
986 update (Linux builder, 2026-11-13, B499 S6): not reproduced; main heap +1.1 MB a round over 200 shots with listings (see B499 S6 as built). Stays open.

986 update (Linux builder, 2026-11-15, B499 close): parked: the leak is not reproduced (B499 S6) and no P-proof covers RSS outside the heap; it needs a reproduction recipe first.

As built (B557 studio + sdk fill): 9fa99c42f studio (422 states, 37 parts); 810136f34, 5f5620ddf, 1fc186f9f, 9b2b62075 sdk (58 parts). Verified: design check studio and sdk, 0 STATE-SENTENCE, no new problem type; sdk live shot (accordion). Open: the refuse switch.

As built (B557 refuse, 20924b427): `definePart` requires `describe`, and STATE-SENTENCE refuses in `design check`, `sketch check` and ready instead of warning; `sketch new` stubs write an empty sentence per state. Finding 789 fill: the two variants of the sdk sketch components/badge@long-label (three long-label states each) and the shared studio pages/inbox definition. Verified: `check --rules` sdk, studio, studio-lab with 0 STATE-SENTENCE (studio still fails on 3 UTILITY-CSS in elements/canvas-frames, not from this slice); tsc of each product and the badge sketch; cli typecheck, lint, 193 related spec files. Not verified: a full `design check` with draw and `sketch check` on the badge sketch, and Studio showing the new badge sentences.

As built (B571): `et-bracket` reads `--et-bracket-journey-endpoint-outline` (a full `outline` shorthand, default `1px dashed` in the line color) for `.et-bracket-journey-endpoint`; `none` hides it. Documented in bracket.md (journey section and token table). Verified: on the SingleElimination story at :4400 with the rule injected, computed outline-style is dashed by default, none with the token `none`, solid with a custom value. Not verified: a real journey hover with the endpoint in the story, or the fifagg app using it.

As built (canvas-frames fixes): the `st-sgrid-description` width, min-width and white-space moved to Tailwind utilities in the canvas-frames markup (`check --rules` exit 0). Part-tree warnings are a list end to end (`TreeEntry.title`, `warns`, `TreeRow.warning` are `string[]`; the tooltip renders one `li` per finding). The frame label and sentence clip only horizontally (`overflow-x-clip` + `text-ellipsis`), so Noto Sans' 17px glyph box no longer loses a pixel to the 16px line box at 100 % and the rounded metrics at 800 % no longer cut the glyphs. The canvas text e2e case now checks each text's glyph box against its clipping boxes top and bottom; bite: fails on Inbox and System with the old classes, passes with the fix. Verified: studio-lab shots at min, Fit, 100 % and max (`.claude/handoffs/agent-results/canvas-clip-*.png`), vitest of the touched specs. Not verified: the Tauri/CEF app on a HiDPI screen; the scroll shards (item 5) did not reproduce headless.

As built (B462 stale picture): the e2e case „a sketch cell edited on disk while scrolled away shows its new picture on return“ read the first `img` of the cell, which is the old picture the sketch view keeps on top until the new one loads; under load the new shot drew in over 10 s (CI 44095404324). The census now also reports `wantedPictureSrc` (`img[data-shot-picture]`), and the case waits on it. Measured: the `parts` event names elements/shell-main 26-70 ms after the edit. Bite: shot responses delayed 12 s after the edit, old read 0/2, new read 2/2.

As built (B559, ADR 0331): PAGE-STATE-INNER draws each state of an own page outside a browser and splits the markup by owner: the page's own markup (including markup it passes into a part, `data-et-slot`) and each embedded part instance (`data-et-part`, the marked named exports included). A state fails when its page markup equals that of the default state, or of a state whose props it all repeats, and the differences sit in one part instance; the message names the innermost part holding them all. Two changed sibling parts, or any change to the page's own markup, pass. It is a draw rule in the `--slow` set (ADR 0201). Findings: studio pages/system `send-busy` (only components/comment-draft, which already has `busy`) dropped; pages/sketches `paused-reason` changed the page's own reason span, so the rule did not see it: the reason moved into components/hold-trigger (`reason` prop, its `open` state shows it), the page passes it and drops the state, and the capability `sketch-paused-reason` now sits on hold-trigger `emit:openChange`. sdk and studio-lab: no hits.

### B560 as built (ADR 0332)

`nestingHostOf` drops the same-layer limit; `treeOf` works hosts out once over every placed part, so a part with one
user nests under it in any group, with `TreeEntry.layer` (its layer label) when the host's layer differs. A host outside
the tree or in `unused` leaves the part in its layer; `unused` sections nest within their layer only; base parts and
parts with 2+ users never nest. tree-row draws the tag (`mark-layer`, `selected-layer`), part-tree shows it
(`cross-layer`: hold-trigger under pages/sketches); app tree-row/part-tree mirror it. Verified: vitest related 368 pass,
app tsc, check --part tree-row/part-tree 0 findings. Not verified: live Studio shot; `design task --verify` runs after
the commit (DIRECT EDIT open point blocks the check record before it).

As built (B558 sketch): sketch `elements/canvas-frames@diff-mark` (product studio), state `diff-mark` on the
hold-trigger grid (closed/open x rest/hover/active/focus-visible). `shared/diff-grid.ts` derives the marked region
of each cell from its difference to closed rest (interaction: the trigger, open: the reason, both: the whole part);
variants a outline + dim, b outline only, c dim only. Waits on the user's pick; no app code.

As built (B558): variant a (outline + dim the rest) of `elements/canvas-frames@diff-mark` built into the part canvas as
the builder's recommendation, without a pick round. The design server answers `/__design/state-diff` (libs/cli
`state-diff.ts`): it draws a cell's state in its interaction and the part's base state (first state, rest) and returns
the box around the changed pixels. `framesOf` gives every fitted table cell and every part `grid` cell but the base a
`diff` URL; the grid cell outlines the box (stroke `0.2rem * --et-design-canvas-label-scale`, so about 2 screen px at
any zoom) and dims the rest. Verified: vitest related (studio 369, cli 1618), typecheck, lint, live Studio shots of
components/hold-trigger at 100 %, fit (67 %) and 20 % (`.claude/handoffs/agent-results/b558-*.png`). Not done: the
sketch is not merged (the agent's merge was refused by the permission check; the human picks or merges it), so
`design task` still lists the open sketch; `design check --part elements/canvas-frames` not run; widths/page frames get
no mark.
Merged in 422e2e591: variant a picked as the builder's recommendation (ADR 0305). Ported in the commit that adds this
note: the harness sample turns the `diff` prop into a hold-trigger grid whose cells carry `diff` URLs, the app's own
data path, so the component needs no `diff` input; `styles.css` sources the state's `w-300` class. Known gaps:

- Parts with `widths` and page frames get no mark.
- Closed: the `diff-mark` cells are framed stills of `components/hold-trigger` (its part render inside a
  `slot('frame')` region), so compare no longer forces hover on "Pausiert"; `design check --part
elements/canvas-frames` now ends with only UNRECORDED (no compare stop).
- diff-mark cells now mirror the app: the hold-trigger still sits in a sized `slot('frame')` (the app's iframe), the
  mark is a sibling overlay. Compare DIFF 340978 -> 407 px; the rest was app side and fixed here: a grid frame showed
  "Lädt" forever (`loading` ignored that a grid frame wants no page), and the group head lacked the subtle text colour.
  Not verified: `task --verify` record; it waits for the pick of `elements/canvas-frames@edit` (refused to the builder).
- Glyph touch fixed: the outline sits one stroke outside the changed box, clamped one stroke inside the cell; a cell
  only as tall as its text still meets the outline at the cell edge (`b558-100b.png`, `b558-fitb.png`).

As built (B561): the system listing carries `problemStates` (a part problem whose `at` names the state, or whose
message names `state "<s>"`) and `changedStates` (`state-marks.ts`: pictures at the merged hash, from `pictures.json`
or the picture cache, against the cached pictures at the current part hash; nothing is drawn, ~15 ms per product).
Studio's fold keeps those states open next to the commented ones. No static rule places a hit at a state yet, so
`problemStates` is empty on today's data. Verified: specs, stress, typecheck, lint, a live shot on a scratch copy
with an edited `components/disclosure` (4 open-row states changed, 8 folded; `.claude/handoffs/agent-results/b561-shot.png`).
Not: a live problem state; a changed state whose current pictures no check has drawn stays folded; a grid part still
draws every cell in its grid frame.

As built (problemStates live, rest of B561): a `Problem` carries an optional `states` list; the rule baseline keys
on `at ?? message` and ignores it. STATE-SENTENCE (the missing states), DROPPED-PROP, STATE-NO-SOURCE,
PAGE-STATE-INNER and render issues (not `-`) fill it. `problemStatesOf` reads only `states` (the `at`/message
heuristic is gone), and the listing also reads the part's cached slow-check problems, so draw-rule hits count; the
slow input hash gained a format token, so every cache entry re-runs once. Live on a scratch copy: studio
components/title-bar (37 states) lists 10 problem states from STATE-NO-SOURCE (`uncommitted-push-hint`, the
linux/windows update hover/active/focus-visible states), the fold keeps them open and folds 27
(`.claude/handoffs/agent-results/problem-states-shot.png`). `design check` studio and sdk rule hit counts unchanged.
Not: a stale slow-cache entry still marks its states until the slow runner refreshes it.

## As built (B420, 2026-11-17)

Built: the System page part owns the canvas note card (warning icon, title, hint; inputs `noteTitle`, `noteHint`,
`sketchMissing`); system-view passes a title per kind (Design-Server läuft nicht, Lesefehler, call slug, Sketch nicht
gefunden with `data-sketch-missing`) and the hint; the harness `noted` sample gives the design's title and hint; the
bare `<p systemNote>` is gone. Verified: `compare pages/system --state canvas-note` ok (was DIFF 2312 px); the full
compare before and after differs only in that state (many-states 910 px and fit 2270 px fail both times, not B420);
`design check --part pages/system` shows only the existing UNUSED-EXPORT warnings; vitest related, typecheck, lint,
e2e canvas ("every declared action works"). Not verified: the call/read-error titles in a live app.

### As built 2026-11-17: pages/system sketch-missing state (builder)

- New design state `sketch-missing` (title only, no hint); `canvas-note` passes its hint as a prop, which clears
  STATE-UNDESIGNED of `@if (noteHint())`. Picked and merged pages/system@edit variant new, task verified.
- Verified: compare pages/system 32/32, design check --part pages/system without STATE-UNDESIGNED.
- Not done: `design ready pages/system` still refuses with 11 embedded parts: open points in anchored-dialog,
  badge, comment-draft, comment-row, comment-target, textarea (missing states/motions/controls), comment-flow,
  title-bar (19 parked STATE-NO-SOURCE), canvas-frames (load-failed action), shell-main, studio-menu (2 compares).
  The other 13 embedded parts were only stale and are ready again.

### B135 in progress 2026-11-17: `consumerAction` (builder)

- Slice 1: `definePart({ consumerAction: '<reason>' })` declares that the part is a control whose action its consumer
  decides; `design complete` (ACTION-UNDECLARED) and `design actions` then ask no `data-et-action` of its elements.
  Never inferred. Verified: complete/actions specs, vitest related (1680), typecheck, lint.
- Baseline before any declaration: `design complete` over the 58 sdk parts gives 361 ACTION-UNDECLARED in 37 parts
  (calendar 71, chart 36, scheduler 31, pagination 26, menu 14, ...). `design check --product sdk` reports none.
- Slice 2: 23 sdk parts declare `consumerAction` (button, checkbox, switch, radio-group, select, select-panel, chip,
  menu, toolbar, dialog, banner, card, empty-state, notification, action-sheet, floating-action, match,
  progress-steps, bracket, scrollable, anchored-dialog, accent-on-light, foundations/elevation). ACTION-UNDECLARED
  361 -> 227; `design check --product sdk` HELD all 23 (no pixel changed), 0 findings.
- Left: 227 hits in 14 parts with own behaviour, which need real `data-et-action` keys, not `consumerAction`:
  calendar 71, chart 36, scheduler 31, pagination 26, tree 12, grid 12, carousel 9, table 7, standings 6, tabs 4,
  query-error 4, stream 3, copy-button 3, breadcrumb 3. Every sdk part already reports PART-UNREVIEWED in
  `design complete` (query-error did before this slice too).

As built (B135 slice 3): breadcrumb overflow `overflow-open` (`long` when open); copy-button both buttons
`emit:copySucceed`; stream consent and error retry `loading`, pip "Back to player" `player`; query-error Retry and the
slot "Try again" `emit:retryRequest`; tabs triggers `emit:selectedIndexChange`; standings pick cards
`emit:orderChange`; table sort labels `emit:sortChange`; carousel previous/next/dots `emit:activeIndexChange`, play
toggle `autoplay-paused` / `autoplay-playing`. All in the design parts, no mock changed. ACTION-UNDECLARED in the 8
parts 39 -> 7, no new problem kind. Left undeclared, no key exists: the breadcrumb Home/Competitions links and the
query-error "Contact support" link (consumer navigation), and the table selection checkboxes and row expanders
(the features write the consumer's signal, no output, and no state draws the result). Verified: `design complete`
and `design check --part` per part. Not verified: `design ready` press checks (none of the 8 is ready-marked); an
emit on an unchanged value (active dot, selected tab) fires nothing.

As built (B135 slice 4): tree rows `emit:valueChange` (click, Enter and Space all select; `nodeActivate` misses
Space); pagination first/previous/page/next/last items, buttons and links, `emit:pageChange` (links intercept the
click); grid remove actions `emit:remove`. All in the design parts, no mock changed. ACTION-UNDECLARED in the 3 parts
50 -> 7, no other count changed. Left undeclared, no key exists: the disabled tree row legacy.ts (a press does
nothing) and the 6 grid tiles (click, Enter and Space do nothing; only drag, arrow keys and Ctrl+Delete move,
resize or remove a tile). Verified: `design complete` and `design check --part` per part (HELD, 0 findings).
Refused: `design ready components/pagination` before the commit ("changed outside a sketch - design check draws it"), so
the pagination mark is not renewed. Not verified: a press on the current page or the selected row fires nothing.

As built (B135 slice 5): the table part gets design-only states for what its selection and expansion write into the
consumer's signal: `selection-added` (Lena joins the two selected rows), `selection-removed` (only Ida stays),
`selection-all`, `selection-none` and `collapsed` (expander column, no row open). An unselected row's checkbox
reaches `selection-added`, a selected one `selection-removed`; the select-all checkbox reaches `selection-none` when
every row is selected, else `selection-all` (as `toggleAll` does); "Expand row" reaches `expanded`, "Collapse row"
`collapsed`. A key names the kind of result, not the row: Pia's checkbox and Lena's expander reach a state that draws
another row. The table mock takes `selectAllAttributes` and a row's `selectAttributes` for the keys. The names avoid
`-selected`, which `design complete` reads as an interaction state (CONTROL-STATE). ACTION-UNDECLARED in table 4 -> 0,
no new problem kind. The three consumer-target links (breadcrumb "Home"/"Competitions", query-error "Contact support")
stay undeclared: `consumerAction` is part-wide, so declaring it would also stop asking keys of breadcrumb's overflow
button and query-error's retry, which have own behaviour; the consumer owns only those links' targets.
The motions `expand` (collapsed -> expanded) and `collapse` (expanded -> collapsed) are declared, and the pairs between
`collapsed` and `rest`, `loading` and `busy` are unreachable: those tables have no expander column. missing-motion stays
at 20. `definePart` no longer infers state names from `unreachable` (it narrowed them and failed the type check).

As built (B135 slice 6): calendar previous/next `emit:activeMonthChange` (`stepUnit` writes `activeMonth` in every
view); header label to the state of the next view `zoomOut` sets: `year-view` from the month view, `multi-year-view`
from the year view, `selected` (month view) from the year grid; day cells `emit:valueChange`, or
`emit:rangeValueChange` in the `range`, `range-focus-visible` and `comparison` states; month cells `emit:monthSelect`,
year cells `emit:yearSelect`. All in the design part, no mock changed. ACTION-UNDECLARED 71 -> 15, no other count
changed. Left undeclared, a press does nothing: the 4 filtered days and the 9 out-of-range days (`selectDay` returns
early on a disabled day) and the natively disabled previous/next buttons in `limits`. Verified: `design complete` and
`design check --part` (HELD, 0 findings). Not verified: press checks (calendar is not ready-marked); a press on the
selected day fires nothing new.

As built (B135 slice 7): chart bars, line slices and pie slices `emit:markActivate` (`activate()` emits it on click,
Enter and Space), added to the drawn markup in the design part, no mock changed. ACTION-UNDECLARED 36 -> 0, no other
count changed. Verified: `design complete` and `design check --part` (HELD, 0 findings). Not verified: press checks
(chart is not ready-marked).
Scheduler: Today, previous and next `emit:focusedDateChange`; the four view-switch buttons `emit:viewChange`; "+3 more"
`opens:components/menu`; every unselected appointment `emit:selectedAppointmentIdChange`. ACTION-UNDECLARED 31 -> 4,
no other count changed. Left undeclared, no drawn state: "Add appointment" and the selected "Design review" (week,
month, agenda), which open the edit surface. Two check runs opened `components/scheduler@edit` with PICTURES CHANGED in
month, agenda and month-cell-focus-visible. Cause: the bare check picture's shrink-to-fit width wobbles between draws of
the same file (58 / 60 / 46 px over 5 `design dom` runs). HEAD and the edit draw the same HTML once the attributes are
removed, and their shots are pixel-identical. `sketch ready` closed the sketch as HELD. Not fixed: the width wobble, so
any scheduler check can reopen a sketch.

B135 done: all 14 parts with own behaviour declare their keys; ACTION-UNDECLARED in them 227 -> 29, each left
element named above with its reason (a press does nothing, the consumer owns the target, or no state draws the result).
No ADR records B135.

### B575 as built 2026-11-17: form-field text-align rows (builder)

The sdk form-field part draws `text-align-center` and `text-align-end` through `interactionRows` with the other rows,
so each gets a hover and a focus-visible state. `design complete components/form-field`: CONTROL-GRID-MISSING (input
and textarea) gone, only PART-UNREVIEWED left. The check opened `components/form-field@edit`; `sketch ready` closed it
as HELD (every existing state draws as before) and recorded the hash. Not verified: a look at the four new pictures.

### B574 in progress 2026-11-17: studio-menu harness data (builder)

As built: the harness sample `elements/studio-menu` hands the component `SHELL_SAMPLE.project/projects`, and the
non-bare host is `h-100 w-3xl` like the design frame. `design check --part elements/studio-menu`: the 3 option
COMPARE blockers are gone. `design ready` then fails 42 action checks (was 60 before the host size): submenu states
7 px wider in the design (500 vs 493), keyboard open/close focus states differ, and the app draws no
`emit:appearanceChange` / `emit:openShortcuts` elements (its appearance radios and help rows are disabled). Not
verified: a live Studio shot. Side fix: sdk `components/menu` re-marked ready (its hash changed with B135 slice 2);
the run committed 14 foreign serve marks, restored in a15b06a5b.

As built (B574, studio-menu): the app now emits `appearanceChange` (all three radios enabled, `(activate)`) and
`openSettings` / `openShortcuts` / `openHelp` / `openAbout` (help rows enabled); shell-page forwards them as
`ShellAction` kinds `appearance` and `studioDialog`, which no view acts on yet (no light theme, no dialogs, no URL
opener). The submenu open models are renamed `appearanceOpen` / `helpOpen` (a model `appearance` clashes with the
`appearanceChange` output, NG1054); the harness sample maps the design props onto them. Closing the menu closes both
submenus; the submenus take `offset { mainAxis: 11, crossAxis: -6 }` and `min-w-0` to sit at the design's place and
width. Design (merged via `elements/studio-menu@edit`, 6364e0ba0): `open-focus-visible` highlights ethlete-sdk, where
the SDK puts keyboard focus on open, instead of the generic second row. `design ready` went from 42 to 24 failures;
closed, open-focus-visible and all emit checks pass. Still failing (not ready): a submenu opened by click draws one
elevation up (SDK: backdrop-less overlay = parent + 1, bg 43 vs 32), while the design
draws it flat; and `studio-menu.stopped` -> Hilfe, where the design places the help submenu at a fixed `top: 279px`
although the row sits one row higher. Both need a design decision (draw the submenu elevated and row-anchored). Verified:
studio specs (231), lint, development build. Not verified: `design check` after the change, a live Studio shot.
Second slice: the design draws both submenus one elevation up (`data-et-auto-surface` on the submenu wrapper, so the
panel resolves parent + 2 like the SDK) and anchors each to its row (`anchor-name` on the row, `top: calc(anchor(top)

- 6px)`), 39e0bae54 (merged via `@edit`, 6273abdb1). An input-opened help submenu draws at the same elevation as a
click-opened one (compare `studio-menu.help`ok). The app kept a model-opened submenu open when the sibling opened;`setAppearanceOpen`/`setHelpOpen`now close the other, acc9db48a.`design ready`went from 24 to 15 failures, a
compare with the width fix below to 3 (help -> Erscheinungsbild, which the app commit addresses). Still open: the
design submenu was 180 px wide (SDK`--et-menu-min-width`) against the app's 176 (`min-w-0`); the fix
`.st-studio-submenu { --et-menu-min-width: 0px }`is uncommitted in`elements/studio-menu@edit`, whose `sketch ready
  --reopen`refuses "variants alike" (rebase --ported old copied the edit into old) and whose merge refuses "in
progress". Verified: studio specs (231), lint, compare of appearance/help/stopped with the width fix. Not verified:`design ready`passing,`task --verify`, checks of the embedding parts.
Third slice: the width fix merged through a fresh `@edit`(pick new, merge; no rebase), e1d1d2c0d, CSS 24aed8c88:
ready 15 -> 6. The 6 left were the check's goal picture, not the app: a probe in Chromium showed the app closes the
sibling submenu within 200 ms, while the goal adds the opener's keys to the start state and drew both submenus. The
design states now say`help: false`/`appearance: false`, 64199e401. `design ready`passes (4f2935e7c),`task --verify`recorded it (e7c06e5bf).`design check --base 9b716d32d` over the five embedding pages: no new problem (UNRECORDED on
  flows/inbox/inventory/sketches and the sketches canvas findings were there before); their ready stays blocked by
  embedded parts that are not build-ready. Not verified: a live Studio shot.

As built (B574, comment parts): comment-row and comment-target draw their control via `control()` with
`interactionRows` (hover, active, focus-visible; comment-row also selected via `aria-pressed`), like tree-row;
comment-draft declares its two buttons as `part: 'components/button'` controls (the button render owns them, so
`input:` left them undrawn). The app comment-row takes the same looks. `design complete` shows only PART-UNREVIEWED
for all three; `design check --part` 0 findings for the three and comment-flow. The direct edit opened
`components/comment-row@edit`; picked new and closed it by `sketch ready --reopen` (HELD). Not verified: compare or
`task --verify` of comment-row's new states, pages/inbox check (it renders the row too).

As built (comment-row record, 2026-11-17): `design task components/comment-row --product studio --verify` green in all
11 states and recorded in `implemented.json`. `design check --part pages/inbox`: only UNRECORDED (inbox recorded before
file lists); its `task --verify` stays red, 1-2 px in every state, twice: an anti-alias pixel on the switch thumb edge
and one on a round avatar. Not caused by this record (no code change); not fixed.

As built (B574, textarea): the sdk part marks `data-et-control="textarea"` and declares the control as
`part: 'components/form-field'` (form-field draws the textarea's hover/focus-visible rows; `input:` asked for an own
interaction grid), plus 14 `motions` for the hover and disabled pairs (the form-field CSS transitions them, so no
`instant`). a086d6a37 (with the lowered open-points budget), ready cab95afd9, hash 0c8304459. The edit drew as before
(HELD), so no sketch was needed. Not verified: a live Studio shot. Pre-existing: `design complete components/form-field`
reports CONTROL-GRID-MISSING for the textAlign center/end rows (no hover/focus-visible cells); textarea's ready does not
need it.

As built (B574, anchored-dialog): the filter options draw as `checkboxGroup` with each `et-checkbox-option` marked
`option`, declared `part: 'components/checkbox'`; Apply is marked `apply` via `control()` (it was undrawn). Picked new
in `components/anchored-dialog@edit`, 27b023bad (the merge's own commit hit an index lock; committed by hand; merged.json
records `decidedBy: "user"`, the merge default). `components/button` had gone stale (button.ts changed after 18:23):
re-marked 19d26a654, hash 30290c267. Ready 442e5df7c. Not verified: a live Studio shot.

As built (B574, pages/system): 17 embedded parts blocked. 13 only had stale marks and re-marked in place. sdk
`components/badge` declares `controls: {}` (25a18fcab, budget lowered); its `long-label` sketch picked b, one-line
ellipsis, because the built `et-badge` already truncates (`nowrap`, `--et-badge-max-width`); variant a wraps on purpose
(WRAP skipped); merged 08dac7545 with `decidedBy: "builder"`, ready 3ab1ecef9. `components/title-bar` failed
STATE-NO-SOURCE on 19 states: the app had a `force` input fed by no template, added only so compare could open the
uncommitted hint. The input is gone; the design marks the hint trigger `data-et-opened-by="hover"` (4036143a8, HELD: every
state draws as before). pages/system ready f5d42a622. Gotcha: after each ready, studio merged.json hash drift makes the
next embedded marks read stale; commit it between parts. Verified: design check title-bar 0 findings, studio app lint,
typecheck, 11 related spec files. Not verified: a live Studio shot of the hint on hover.

### B574 as built 2026-11-17: pages/flows, pages/inbox, pages/inventory build-ready (builder)

The stale-mark blockers of the handoff were gone; two embedded sdk parts were real. `components/select` (flows):
CONTROL-GRID-MISSING, the size sm/lg rows drew no hover/active/focus-visible; they now go through `interactionRows`
with a sentence per new state (79412ea21, HELD: every state draws as before; ready 0d77420db). `components/switch`
(inbox): CONTROL-UNCLASSIFIED on the et-choice-field, its control and the label area; a labelled switch now carries
`data-et-control="switch"` on the et-choice-field instead of the inner et-switch, since the whole field toggles it
(210d19028, HELD; ready cd995cd26, sdk merged.json drift committed as a chore). Ready: flows 3d37f7f5c, inbox
1c018a5a5, inventory 934271613. Dead end: a type fix made after `design check` opened the select @edit sketch left the
sketch stale for ready and merge; deleting the untracked sketch and re-running the check gave a clean HELD. Verified:
design check select and switch 0 findings, shots of every select state viewed. Not verified: a live Studio shot of
the three pages; the switch OPTION-VALUE-MISSING hints (size, variant, controlPosition) stay open as hints.

As built (pages/sketches ready): not ready. `design ready` marked it (254979f7b, which also took 5 marks a design serve
had written; restored 4677112b7; merged hash adeb6ffd0), but `design check --part pages/sketches` still finds
CANVAS-UNDER-PANEL and 2x ARROW-ANCHOR in `change-crop` and `change-crop-whole`, so the mark was dropped b4da6b459.
Cause (proven in a scratch probe): the mock screen draws 12 zoom chips, and both the frame aim
(`libs/cli/design/arrow-anchor.ts` `anchorOf`) and the check (`system/arrow-anchor.ts`) resolve
`data-et-arrow-anchor` with `root.querySelector`, so the Fit tooltip is measured against the first chip's fit button.
Resolving from the nearest ancestor that holds a match cleared both ARROW-ANCHOR hits. CANVAS-UNDER-PANEL: the aim's
device-pixel rounding gives the tooltip wrapper `translate: 0.25px -0.16px`; it is wider than its 42px span, and the
span inherits `cursor: grab` from the canvas, so `holdsPannedWorld` counts the tooltip above the button as a pan
world. Proposed: count a moved child as a world only when it overlaps the viewport box. Both fixes are libs/cli check
changes, which the builder slice may not make (refused); open for the cli owner.
Suspect, not probed: `design ready` passed on the same tree that `check --part` fails, so the ready gate may read a
cached or narrower render result. Verified: probe check in a scratch copy with the anchor scoping (ARROW-ANCHOR 0) and
a debug line naming the panned child. Not verified: the overlap fix, a cli spec, a live Studio shot.

As built (B182): `libs/cli/vitest.global-setup.ts` bundles `render-worker.ts` with esbuild once per run into the
run's private temp root and passes its path in `ETHLETE_SPEC_RENDER_WORKER`; `vitest.setup.ts` points
`packageFileOf('…/render-worker.js')` at it, so every cli spec config (default, dist, perf, proof) draws `ng()` parts
from source without `dist/libs/cli`. The per-spec worker builds in `font-proof.spec.ts` and
`ready-signal.proof.spec.ts` are gone. `real-part-render.dist.spec.ts` (cli-dist config, CI `cli:test-dist`) draws
studio `components/update-dialog` and expects no RENDER issue and drawn states; without the setup it is red with 10
"Cannot find module …/render-worker.js" RENDER issues (the 246 symptom, reproduced at bd6153d33). RENDER details
keep the whole error: `renderErrorDetailOf` strips ANSI codes and joins every line with `-` for a part that fails to
load (`render-check.ts`) and in the completeness sight (`complete.ts`); a spec loads a part with a syntax error and
expects the parse error and its `file:line:col`, red when the detail is cut back to the first line, which reads
only "Transform failed with 1 error:". Suspect, not probed: the post-B155 "Transform failed" (finding 270) was such a
real transform error whose cause line the first-line cut dropped. Still on the shared dist: `@ethlete/components` and
`@ethlete/core` come from `dist/libs/*` via `render.packages`, so the real-part spec stays in the dist config.

As built (B579, ADR 0338): ARROW-ANCHOR (cause, by probe) - the check and the frame aimer both resolved
`data-et-arrow-anchor` with `root.querySelector`, so the zoom-chip tooltip in pages/sketches measured against the first
of 12 fit buttons. Both now take the nearest match: the first ancestor of the pane, up to the root, holding a match
outside the pane (same code in `design/arrow-anchor.ts` and `system/arrow-anchor.ts`). CANVAS-UNDER-PANEL (suspect,
confirmed by probe) - the aimer's device-pixel `translate: 0.25078px -0.156958px` on the tooltip's absolute wrapper,
wider than the chip's `span.relative`, read as a panned world; `holdsPannedWorld` now ignores a nonzero translate under
1 px. Verified: `design --working-tree check --part pages/sketches` went from 2 ARROW-ANCHOR + 1 CANVAS-UNDER-PANEL to
0 + 0 (only the pre-existing UNRECORDED left); render-check.spec cases for 12 fit buttons and a nudged world, each bit
when its fix was reverted (check resolver, aimer, pan fix separately); 167 related cli spec files green. Not verified:
the published cli build (et:design without `--working-tree` still runs b5c2c3b03 until rebuilt), a live Studio shot.

As built (B578, ADR 0337): no app code acted on the appearance radios or the settings, shortcuts, help and about rows -
`runShellAction` in `system-view.component.ts` has no case for `appearance` or `studioDialog`. Both submenus and their
separator are gone from elements/studio-menu (states `studio-menu.appearance` and `studio-menu.help` with them) and from
the app component, with their outputs, the two open models, the shell-page bindings, the two `ShellAction` kinds, the
harness sample props and the labels. The project switch, Projekt öffnen… and the server actions keep their targets and
stay. Verified: `design check --part` before and after for studio-menu, shell-main, part-tree and pages/flows,
inventory, sketches, system and inbox - no new problem (only the pre-existing UNRECORDED); the app spec asserts that the
menu ends after the server actions with no submenu trigger and one separator, red against the old template; lint,
typecheck, 39 related spec files. Not verified: `design task --verify` / `compare` (the implemented record of
elements/studio-menu is STALE), a live Studio run (no `studio:e2e` case opens the menu); the picked `@edit` sketch of
elements/studio-menu still waits for its discard, which the session was not allowed to run.

As built (B576 slice 1, ADR 0335): cause (by probe) - `keepHeldStampsInFiles` composed a check run's ready.json onto
`diskStampTextOf`, which is the design server's stamp cache (`.ethlete/cache/<product>/stamps/ready.json`) while its
base matches the tracked file, so every serve mark in that cache landed in the tracked file. A `check --part
elements/part-tree` whose own record changed wrote 14 foreign marks (13 `cmd: serve`, plus studio-menu). The writer now
composes onto the tracked text and takes the asked keys (`check --part` / `parts`, `'all'` for a whole-product check);
an entry outside them is never written. `design ready` and the dropped-record commit commit HEAD's ready.json plus the
own entry only (`commitOwnEntry` in part-ready.ts); the working file keeps every other entry. A check still writes the
asked part's mark (ADR 0335 asks for "only", not "none"). Verified: stamp-files.spec (asked keys, no cache entry) and
part-ready.spec (ready commits only its own mark), each red with its fix reverted. Live, from the same clean ready.json
and stamp cache: the published cli (c510481c6) dropped part-tree and wrote 14 foreign marks; `--working-tree` dropped
part-tree only. Not verified: a live `design ready` commit (no ready-clean part to spend on it).

As built (B576 slice 2, ADR 0335): probe first, on the live studio product (37 holding marks). (1) Another part's
`merged.json` entry changed: no mark stale, no slow input pending - a ready mark does not cover merged.json, ready.json
or harness.shared; it covers the files of the part's import graph (`designHashOf`), each whole. Suspect not reproduced.
(2) An export nobody imports appended to `title-bar/shared/chrome.ts`: 9 marks stale (whole-file grain); export-level
hashing is not built (large, and a missed dependency would let a mark hold on a changed design). (3) Only `pid`/`at` of
another `ready.json` entry changed: the `(product)` slow hash flipped (cause, by probe) - `productInputsOf` hashed the
whole ready.json, so every mark write made `(product)` pending, and its settle makes serve rerun the product's slow
checks and re-decide every own part (`recordedPartsOf`). The `(product)` inputs now key on each part's recorded
`actions`, which is what ACTION-LOST reads. The stale page marks seen on 17.11. are real dependency drops (studio-menu,
B578; canvas-viewport/canvas-frames in d7d017cc2). Existing marks: the ready mark format is unchanged, so no mark goes
stale; the `(product)` slow result reruns once on the new key. Verified: slow-checks.spec, both directions red with
its half of the fix reverted. Not verified live: serve's re-decision of every part after a `(product)` settle.

As built (B576 slice 3, ADR 0335): cause (by spec bite) - `design ready` and `design check --part` drew the same
render issues but decided them apart. Check tallied each failing render issue (CANVAS-UNDER-PANEL, ARROW-ANCHOR and
every other render rule, after the ADR 0201 baseline) into the problems its build-ready record reads; ready kept only
the undrawn issues of its draw and gated on the static rule problems, so a render rule never blocked a ready mark. No
cache was involved: ready draws fresh. Both now decide through `renderFindingsOf` (render-findings.ts: base filter,
rule baseline, the rules per part) and `withFoundRules`; ready keeps its draw's issues and passes them through
`readyBlockersOf`. Verified: check-ready-blockers.spec (check --part fails a CANVAS-UNDER-PANEL part and ready refuses it
with `problem: CANVAS-UNDER-PANEL`), red with ready's old inputs restored. Not verified: a live `design ready` on a
part with a render issue (no such part at hand to spend a mark on); the rest of check's tally (edit problems, the tail
after the record) still reaches ready only where both read the same static rules.

As built (B577 slice 1, ADR 0336): cause (by spec bite) - `settleCommittedEdits` (accepted-pictures.ts) took only
undecided `@edit` sketches, so a picked one whose part HEAD holds (live: `elements/studio-menu@edit`, picked `new`,
committed) was named STALE EDIT SKETCH and left for a discard the classifier refuses, while status also printed
SKETCH-BASE-STALE with a rebase that `@edit` has no use for. Now the settle takes every ready `@edit` sketch, undecided
or picked, without hold or rejection (`isOpenOrPickedEditSketch`, edit-sketch.ts): check, ready and the design server
delete it once HEAD holds its part. `staleSketchBasesOf` skips a stale edit sketch, and status names it once as SKETCH
LEFTOVER with the check that clears it. Verified: accepted-pictures.spec (picked new + committed, picked old +
restored, a `writesTracked: false` run) and status-uncommitted.spec, red with the fix reverted. Live: status
printed one line for studio-menu@edit, and `design check --product studio --part elements/studio-menu` deleted it
(STALE EDIT SKETCH ... discarded). Not verified: a picked `old` whose HEAD holds the `new` edit also closes silently.
