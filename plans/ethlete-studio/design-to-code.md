# Design to code

Status: decided (Tom, 2026-10-31), not built.

## Goal

A merged design becomes code under the control of the system, not of the agent. Tom: "Das System muss machen was
geht, der Agent hat sonst zu viel Freiraum." No implementation without Tom's go (Q153).

### Design to code decisions (Tom, 2026-10-31)

- Q154 check, not generate: the agent implements the design. The system renders the real Angular component in the
  same states and compares it pixel by pixel with the merged design. The goal for SDK components is one shared
  source (the design draws the real template and CSS); the mocks with the real component CSS are close to it today.
- Q155 open points: the system computes a list of open points per part. Studio shows it on the part, and
  `et design check` prints it. A part can be set `ready` only when the list is empty. The system enforces this.
- Q156 the list counts:
  1. A missing state, against the state list for that kind of component (a button without `focus`).
  2. A contrast under the rule: under 3:1 for frames and icons, under 4.5:1 for text.
  3. An open comment on the part.
  4. A sketch in progress, or ready but not merged.
  5. An open question in a plan that names the part. Built last (the system must read the plans).
  6. A part with no linked component (Q157).
  7. The implementation differs from the design (Q159), or the part has no go (Q158).
  8. A missing transition or motion between states.
- Q157 link: the part names its component itself, for example
  `implements: 'apps/ethlete-studio/src/app/…/tree-row.component.ts'`; a page part names its route. No name-based
  guessing. A part without a link is an open point.
- Q158 go: an explicit "Go" action per part in Studio. It stores the design state Tom released. The CLI refuses an
  implementation of a part without a go. A new design change needs a new go.
- Q159 compare: the part declares the inputs per state; the system forces hover, focus and active in the browser.
  Both sides render in the same Chromium with the same fonts. Tolerance 0 px; an exemption per state (for example an
  animation) only with Tom's OK, and it shows as an open point.
- Q160 task: the system gives the agent a fixed task: the part, the released state, the states changed since the
  last implementation, the allowed files, and the target "compare green". The system rejects an implementation that
  changes other files or has a red compare.
- Q161 SDK too: the same flow for the `sdk` product and `libs/components` (go, task, compare). A lib change also
  needs a changeset and docs; the system checks both. This replaces the hand edit after an SDK merge.
- Q162 MVP scope: only the open-point list (Q155, Q156) and the link (Q157) are in the MVP. Go, task and compare come
  after the MVP, before the first implementation. The motion editor is not in the MVP. Tom: the global chat was not
  MVP either ("da haben wir nun schon den Salat"); keep the MVP strict.

- Q164 state list (Tom, 2026-10-31): open point 1 reuses the control requirements of `et design complete`
  (`libs/cli/src/lib/design/design-command.ts:96`); new kinds go into that table. A component part that declares no
  `controls` gets the open point "no controls declared"; page parts are exempt.

- Q165 foundations (Tom, 2026-10-31): foundations count as linked. They implement tokens, not a component, so they
  never get the "unlinked" open point and can become ready.
- Q166 sketch without a part (Tom, 2026-10-31): a sketch for a part that does not exist yet gets no open point. Leave
  it until Studio lists sketches as their own entries.
- Q167 missing motion, open point 8 (Tom, 2026-10-31): follows `plans/ethlete-studio/motion.md` ("hover and press
  are states, so they are motions too"). Every state pair of the Q164 control table that a user reaches by an
  interaction needs a motion in both directions, for example rest <-> hover, rest <-> press, collapsed <-> expanded,
  closed <-> open, hidden <-> visible. A colour change is enough as a motion (a short token transition). One open
  point per missing pair and direction, for example "no motion collapsed -> expanded". Focus may have a motion but
  does not need one (no open point). Rest <-> disabled needs a motion too (Tom), although the app sets it, not the
  user. A state that shows ongoing work (loading, pending, indeterminate progress, a spinner) needs a looping motion
  inside that state, plus the motions into it and out of it (Tom). How a part declares a looping motion is a builder
  call.
- Q168 every state change is a motion (Tom, 2026-10-31), replaces the pair list of Q167: every ordered pair of a
  part's states needs a motion, including combined states (hover -> hover + disabled while the pointer stays), an
  element that mounts or unmounts (select body, dialog open and close), and a move inside the part (a tab underline
  that follows the active tab by FLIP, a sidebar that morphs into a detailed state on hover and back on exit). A part
  may mark a pair as unreachable, with a reason; only such a pair gives no open point. Focus stays optional. The
  looping motion for ongoing work and "a colour change is enough" from Q167 stay.
- Q169 contrast of frames and icons (Tom, 2026-10-31): the render check gets a 3:1 measure for borders and icon fills,
  as a follow-up of slice 2. Today it measures text only.
- Q170 large text (Tom, 2026-10-31): the WCAG large-text rule stays. Text from 24px, or from 18.66px bold, passes at
  3:1; other text needs 4.5:1. This refines Q156.
- Q173 states are user states (Tom, 2026-10-31): `states` holds only the states a user can reach in one instance.
  Showcase variants (size, theme, tone, group) move to the existing grid or variant axis, and motion points count
  only `states`. The builder migrates the design data of both products (studio, sdk), with `et design check` as the
  guide. Reason: point 8 gave about 3,750 motion points per product, mostly pairs of showcase variants that never
  animate into each other.
- Q175 which borders need 3:1 (Tom, 2026-10-31): only borders that identify a control (control boundaries, focus,
  state, and the frame that wraps a control such as the form-field) are measured, as WCAG 1.4.11 asks. Decorative
  panel, card and swatch borders give no finding. Icons stay as built. Tom: "we do not tell a designer that they may
  only build high-contrast apps" - the check enforces the WCAG minimum, never more.
- Q176 Studio interaction colours (Tom, 2026-10-31): the Studio Tailwind theme gets the surface interaction colours
  (hover, pressed), so `hover:`/`active:` utilities draw in Studio sketches. `et design complete` names an unknown
  utility class instead of reporting "draws no different pixel".
- Q177 menu vs select (Tom, 2026-10-31): the Q164 control table splits kind `menu` (action items: hover, focus,
  active; no selected) from `select`/`listbox` (selected look required).
- Q179 a product uses another product as its kit (Tom, 2026-10-31): a product may name another product as its kit
  (studio -> sdk). A control part a page uses (for example `components/switch`) resolves in the kit product when
  the product itself has no such part, so `complete --product studio` no longer reports "no part
  components/switch". Gaps of a kit part do not block the consuming page; they stay the kit part's own open points.
  No copies of kit parts in the consuming product (two sources drift). So a Studio page may keep an `et-switch`;
  in the pages/inbox round the switch, the toggle button (b) and the segment (c) are a variant pick by merge.
- Q181 control states belong to control parts (Tom, 2026-10-31): sketch `elements/shell-main` rendered the whole
  shell ~23 times only to show hover, focus, pressed and selected of the collapse button and of rows. Tom: "sowas
  muss das tooling erkennen das darf nicht passieren". Two checks:
  - Error (blocks the sketch and `complete`): interaction states (hover, focus/focus-visible, pressed/active,
    selected) are allowed only on a control part (a part whose root is a control: button, row, option, the Q164
    control kinds). On any other part (layout element, shell, page) such a state is an error that names the element
    to extract as its own part. No threshold.
  - Hint (does not block): a state whose pixel difference to the base state covers less than about 10 % of the
    frame reports "extract the changed element as its own part", for example a small badge that changes on a big
    card.
- Q185 old merged states under the control-state rule (Tom, 2026-10-31): interaction states that were already merged
  on a non-control part (sdk carousel, scrollable, match, table, bracket) are reported as an open point on the part
  but do not block a round that adds no new such state. A newly added violation stays a blocking error. Extracting
  the controls of those five sdk parts comes after the MVP (Studio uses none of them).
- Q182 a part shows every option value of its mock (Tom, 2026-10-31): the merged sdk button part shows only `md` and
  one `sm` row, while the lib has `xs`-`xl`; the sketch agent picked the values and no check caught it.
  - Tool check (error, blocks `ready` and `complete`): every mock option with a literal union type (for example
    `size`, `variant`) has each value on the part's grid. A value may be left out only with a stated reason.
  - Cleanup: builder 33 audits every merged sdk part against its mock and adds the missing values; button gets a
    size axis with all five sizes.
  - Re-merge: added values are new drawings, so the part goes to Tom as a new round; where a value follows only
    from decided rules (for example a size that scales a decided shape), the lead merges it under Q172.

- Q96 go and task (lead, 2026-10-31): go does not need ready. "No go" and "go is stale" are open point 7, so they
  block ready. Flow: design, go, implement, compare green, ready. The allowed files of a task are the folder of the
  `implements` file (component, template, spec, css), plus the changeset and the docs guide for sdk.
  `et design task --verify` rejects other files and records the implemented hash when compare is green.

## Not decided

- How compare renders the real component per state (a harness route in the owning app, or Storybook), and how a
  page part gets its data (a presentational component beside the route link). With Tom (lead 76).

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

3. Not started: the list on the part in Studio, and `sketch ready` / part ready refused while the list is not empty.
4. Last: point 5, open plan questions that name the part.

### Go, task and compare decisions (Tom and lead, 2026-10-31, Q192-Q195)

- Q192 order (lead, Q96): go does not need ready. "No go" and "go is stale" are open point 7, so they block ready.
  Flow: design done, go, implement, compare green, ready.
- Q193 allowed files (lead, Q96): the folder of the `implements` file (component, template, spec, CSS), plus for
  `sdk` the changeset and the docs guide. `et design task --verify` rejects a diff outside them and records the
  implemented design hash when compare is green.
- Q194 compare render (Tom): a dev-only harness route in the app that owns the component
  (`/__design-harness?part=&state=`). It mounts the `implements` component with the inputs the part declares per
  state, on the app's own dev server, so real providers and fonts apply. Studio: `apps/ethlete-studio`; sdk:
  `apps/docs-examples`. No Storybook path.
- Q195 page parts (Tom): a page part links a presentational component (data in, events out) for compare, beside its
  route link. The route container stays outside compare. The pilot builds `pages/inbox` and `elements/shell-main`
  this way.

- Q196 page motions (Tom, 2026-10-31): open point 8 (missing motion between states) does not apply to the `pages`
  layer, like open point 1 (missing states) already does not. Page states are data scenarios; the components and
  elements inside a page carry their own motions.

### Implementation phase decisions (Tom, 2026-11-01, Q250-Q255)

The Studio MVP (design done, 26 of 26 parts clean) is reached. The next phase implements the design in code. Planned
only; the builder starts when Tom gives the start.

- Q250 scope: first the 26 Studio parts. Then the lib port of checkbox and radio-group variant d to
  `libs/components` as its own SDK track. The 48 SDK parts with open points come later.
- Q251 order: first the pilot, end to end through go, `design task`, `design compare` and `task --verify`:
  `pages/inbox`, then `elements/shell-main`. Fix tool gaps on the way. Then the other parts in parallel, one
  subagent per part.
- Q252 components: every inline part (tree-row, part-tree, zoom-chip, comment-pin, canvas-viewport, the merge view)
  becomes its own component when it is implemented, as Q248 planned. Parts with no app code yet (disclosure,
  shell-collapse, shell-project-option, shell-project-switch, studio-menu, shell-main, pages/start) are built new. The
  `implements` link points to the new component.
- Q253 design freeze: a design change only when the implementation shows a design defect. Every other wish is parked.
- Q254 parked items: none before the implementation, also no system lesson. First the implementation, then the
  findings (system lessons and parked items in `backlog-parallel/decisions-latest.md`).
- Q255 done: every Studio part has an `implemented.json` entry, a green compare and is ready.
  `design check --product studio --complete` reports it as one number.
- Impl Q1 start (Tom, 2026-11-01): the implementation phase starts now with the Q251 pilot, `pages/inbox`, then
  `elements/shell-main`. Studio serve runs again in tmux.
- Impl Q2 pilot order (Tom, 2026-11-01): replaced by Impl Q3. Tom first chose `elements/shell-main` first,
  because the `pages/inbox` design renders inside `shellMain.render`.
- Impl Q3 pilot order (Tom, 2026-11-01): keep the Q251 order. The pilot inbox component
  (`apps/ethlete-studio/src/app/design-parts/inbox/`) draws a copy of the shell markup, so its compare works without
  the built shell (5 of 7 states 0 px). Finish the inbox with the copy, then build `elements/shell-main` at once. In
  that slice the inbox uses the shell-main component and the copy is deleted; compare shows if the swap breaks
  anything. Tom checks the inbox in the real Studio on :4402 after the swap.
- Impl Q5 real route (Tom, 2026-11-01): the pilot gets a slice 3 after the shell swap. The real Studio inbox view
  renders `InboxComponent` with live comment-store data in place of the old comment panel, and the real shell
  renders `ShellMainComponent`. Route `/` no longer shows the old `StudioViewComponent` parts that these replace.
  Tom checks the inbox on :4402 after slice 3, not after slice 2.
- Impl Q6 parallel findings (Tom, 2026-11-01): Q254 is partly lifted. Parallel to the pilot, the builder fixes tool
  and system findings that change no design and touch none of the pilot files (inbox, shell-main, `studio-view`,
  their harness). One subagent per item; commits pushed in batches. The items:
  1. Plain `design check` shows every blocker that today only `design ready` shows (missing states, contrast).
  2. `design check` and `design ready` warn when `dist/libs` is older than the lib sources.
  3. Forced interactions (hover, active) are not applied to disabled states.
  4. Studio says "restart the server" when the server runs an older `@ethlete/cli` than the installed one.
  5. Studio writes `inventory.json` in the format Prettier accepts. Done before Impl Q6 in 3dd71ffb3; the spec
     fails without the format step.
  6. Browser-backed cli specs that CI skips report the skip visibly.
  7. The canonical-class check also runs on the Tailwind classes in `apps/ethlete-studio/src`.
     Not now: the Inventory canvas, the sketch views (live iframe cap, changed-area context, multi-part title), and the
     word "go". They change the design or touch Studio views of the pilot.
- Impl Q7 restart notice (Tom, 2026-11-01): the "has no system view" case came when Tom opened the tomflix project
  in Studio. Tomflix has its own copy of `@ethlete/cli` in `~/dev/tomflix/node_modules` (built 2026-10-31 23:52,
  same version string `3.0.0-next.26`), so its design server ran an older cli than Studio expects. A restart does not
  help there. Item 4 therefore: the server reports its own build stamp and API level, Studio compares it with what it
  needs, for every server it talks to (own, tmux, other project). An older one shows a notice that names the cause
  and the fix: "restart the server" when the project's installed cli is newer than the running server, else "update
  `@ethlete/cli` in <project>". Studio shows the notice after pilot slice 3, when `studio-view` is free.
- Impl Q8 picker font (Tom, 2026-11-01): a design defect, fixed on the design side. The Studio frame no longer takes
  `--et-font-family` from the SDK foundations `colors.css` (`system-ui`), so the SDK menu in `elements/shell-main`
  state `project-picker` draws in the Studio font, like the app. Then the builder closes the remaining 29 px
  (antialiasing at the rounded corners of the transformed overlay pane) in the app.
- Impl Q9 picker autofocus (Tom, 2026-11-01): the real app keeps `autoFocus` on for the project picker menu, so a
  keyboard open focuses the first item. The design state `project-picker` means a pointer open; compare opens the
  menu by pointer, so no focus ring shows.
- Impl Q10 disabled guards (Tom, 2026-11-01): the new `DISABLED-INTERACTION` rule (0d1082d73) found missing
  `:not([disabled])` guards, mostly `backgroundColor`, in 8 sdk parts: button 2, calendar 2, carousel 6, chip 8,
  copy-button 2, pagination 4, scrollable 28, toolbar 2. Fix them now, beside the pilot, in one subagent slice in
  `libs/components` CSS, with a patch changeset. Where a colour also lives in the sdk design part (for example
  button), the slice changes that part too and rebuilds `dist/libs`, so design and lib do not drift. Done when
  `design check --product sdk` reports no `DISABLED-INTERACTION`.
