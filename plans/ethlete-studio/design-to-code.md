# Design to code

Status: decided (Tom, 2026-10-31), not built.

## Goal

A merged design becomes code under the control of the system, not of the agent. Tom: "Das System muss machen was
geht, der Agent hat sonst zu viel Freiraum." No implementation without Tom's go (Q153).

Core principle (Tom, 2026-11-02, finding 169; he had written it about 100 times in other words): a rule an agent
must remember is a rule the next agent forgets; the tool has to enforce it. Every rule that lives only in prose
(skills, handoffs, plan decisions, agent messages) and that a tool could check becomes a hook, a check or a refusal.
Prose may explain a rule, never be its only guard. Every new finding answers: which tool enforces this now?

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
- Impl Q11 inline SVGs (Tom, 2026-11-01): the rail icons and the Studio mark stay inline in `ShellMainComponent`
  for now (design freeze, Q253). When a second part needs the same icon, the SVGs move to one shared icon file in
  `apps/ethlete-studio` that both the app and the design use. Until then, compare guards against drift.
- Impl Q12 picker font (Tom, 2026-11-01): replaces Impl Q8. Measured: the design frame does not take
  `--et-font-family` from the SDK `colors.css`; the design menu inherits `--font-ui` from the Studio `type.css` body
  rule. In the app that rule sits in `layer(studio-tokens)`, so the unlayered app body rule (`--font-sans`, Jost)
  wins for the body-portaled menu. The app deviates, so the fix is in the app: `--et-font-family: var(--font-ui)`
  app-wide in `apps/ethlete-studio/src/styles/sdk-token-map.css`. Measured: 2923 px → 29 px.
- Impl Q13 corner antialiasing (Tom, 2026-11-01): the last 29 px sit at the 4 rounded corners of the menu pane,
  because the SDK overlay puts `transform: translate3d(...)` on the pane (own layer). One-line design change allowed
  under the freeze (a defect the implementation shows): `transform: translate3d(0,0,0)` on `.st-project-picker` in
  `.ethlete/design/studio/elements/shell-main/shared/picker.css`; then a new go, compare, `task --verify`. If that
  does not reach 0 px, the builder reports and stops; no tolerance.
- Impl Q14 picker autofocus (Tom, 2026-11-01): replaces Impl Q9. The harness opens the picker by the input
  `projectPicker='open'` (API), not by pointer, so autofocus drew a focus ring (8355 px). Autofocus stays on in the
  app (keyboard open focuses the first item); the compare harness opens the picker by a real pointer click (cli
  change), and the app drops `autoFocus="false"`.
- Impl Q15 go by the builder (Tom, 2026-11-01) - replaced by Impl Q119: when Tom approves a concrete design change in the chat (for example
  the Impl Q13 transform line), the builder may record the new go with `--by tom`; the commit message names the
  decision. A new design or a larger change still needs Tom's own go. The Impl Q13 go stays.
- Impl Q16 verify revision (Tom, 2026-11-01): no tool change. With parallel committers the builder passes the
  revision to `task --verify`; revisit only if a wrong record happens.
- Impl Q17 inbox unread (Tom, 2026-11-01): the comment store has no read state; a row counts unread when it waits for
  the user (`threadState` question or answered). Keep.
- Impl Q18 user name (Tom, 2026-11-01): the store has no user name; the app shows "Du" (initials "Du") for the user's
  own messages, the design "Tom Bornholdt"/"TB". Keep "Du". Real user identity comes with the multi-user sessions
  work after the MVP.
- Impl Q19 inbox load states (Tom, 2026-11-01): a design defect, fixed now under the freeze: `pages/inbox` gets a
  loading state and a load-error state with retry. An interrupted state and other states the old panel had are
  parked after the MVP. Then go (`--by tom`, Impl Q15), compare, `task --verify`.
- Impl Q20 inbox scroll (Tom, 2026-11-01): a design defect, fixed now: the inbox list in `pages/inbox` scrolls in
  place of `overflow-hidden` (53 real rows clip today). Then go (`--by tom`), compare, `task --verify`.
- Impl Q21 rail letters (Tom, 2026-11-01): studio, studio-lab and sdk all show "S" in the rail, and the old picker's
  "inherits from" hint is gone. Parked after the MVP as a rail design question.
- Impl Q22 section trees (Tom, 2026-11-01): Sketches and Flows show the same full tree as System. Keep; per-section
  trees are parked after the MVP.
- Impl Q23 check speed (Tom, 2026-11-01): plain `design check` draws all states (studio ~6:30, was ~4:20). Keep; no
  `--fast` now. The check time goes into the performance review after the MVP.
- Impl Q24 clean count (Tom, 2026-11-01): `PARTS <product>: n of m clean` counts a part clean only when it has no
  open point that blocks ready. One cli slice. This is the Q255 done number; expect far fewer than 26 at first.
- Impl Q25 Tom's :4402 check (Tom, 2026-11-01): Tom checked the new shell and inbox on :4402 after slice 3. He has
  feedback, all for after the MVP; he gives it in one collected round when the whole MVP is implemented (Q255:
  every Studio part implemented, compare green, ready), not after Impl Q24. No change from this check now.
- Impl Q26 load-error text (Tom, 2026-11-01): the second line of the inbox load-error state stays fixed text for the
  MVP. Showing the real `loadError` message is parked after the MVP.
- Impl Q27 go for seven parts (Tom, 2026-11-01): Tom gives the go in the chat for `components/disclosure`,
  `components/shell-collapse`, `components/shell-project-option`, `components/shell-project-switch`,
  `elements/studio-menu`, `elements/canvas-frames` and `pages/start` (design-done at the MVP). The builder records each
  with `--by tom` and names Impl Q27 in the commit; they run in wave 2.
- Impl Q28 link-only go (Tom, 2026-11-01): when Q252 moves an inline part to its own component, only its `implements`
  link changes and the go goes stale. For a link-only change the builder re-records the go with `--by tom` and names
  Impl Q28 in the commit. Any visual design change still stops and asks. After the MVP: the go hash ignores the link.
- Impl Q29 done number (Tom, 2026-11-01): replaces the Impl Q24 premise. The clean count was right: it uses the open
  points that `ready` refuses on, and the 26 own Studio parts have none; the 57-73 open points sit on the 47 inherited
  SDK base parts. Revert `fe709f9d8` (base parts belong to the SDK track, Q250). The Q255 done number is its own line
  over the own parts: `DONE studio: n of 26`, where a part counts when its `implemented.json` entry matches the go
  hash and it has a ready mark. One cli slice.
- Impl Q30 zoom-chip labels (Tom, 2026-11-01): the zoom-chip buttons get German aria-labels (the Studio UI is
  German): "Verkleinern", "Vergrößern", "Auf 100 % zoomen", "Einpassen". No pixel change; go `--by tom`.
- Impl Q31 canvas-viewport render (Tom, 2026-11-01): a design defect (part mixed with its demo). The render draws only
  the viewport; the sample cards move into an empty slot, and the size comes from a `class` prop. Visible change, so
  go `--by tom` (Tom approved it here) and Tom looks at the result in Studio in his collected round.
- Impl Q32 live comment pin data (Tom, 2026-11-01): map from the comment store: author to initials ("Du" for the
  user, as Impl Q18), agent logo by sender, count = replies, selected = open thread. Built in the canvas-frames or
  page slice.
- Impl Q33 agent logos (Tom, 2026-11-01): the Impl Q11 trigger is met (inbox and comment pin). The claude, codex and
  gemini SVGs move to one shared icon file in `apps/ethlete-studio`, used by app and design, as part of the pin swap.
  Rail icons and the Studio mark stay inline until a second part needs them.
- Impl Q34 studio-menu open panel (Tom, 2026-11-01): redraw the open panel with the SDK menu mock
  (`@system/components/menu`), as shell-main's project picker does; go `--by tom`; Tom reviews it in his collected
  round. Also a system finding (see Impl findings).
- Impl Q35 shell-project-switch open (Tom, 2026-11-01): the `open` state draws the picker like shell-main's
  `project-picker`; go `--by tom`.
- Impl Q36 shell-project-option (Tom, 2026-11-01): retire `components/shell-project-option` and drop it from the
  shell-main note; the picker keeps the SDK `et-menu-radio-item` rows. Not a general rule: a product may give an SDK
  component a new look (the point of the tier 2 and tier 3 system). The system must prevent sprawl instead, for
  example ten menu styles in one app. Retired here only because no part uses the custom row.
- Impl Q37 host padding (Tom, 2026-11-01): keep the convention: a component drawn in a padded wrapper carries that
  padding on its host, no host background. If the padding breaks a consuming page, compare of that page shows it.
- Impl Q38 ready by the builder (Tom, 2026-11-01): after a green `task --verify` the builder runs `design ready` for
  the part itself. Tom checks everything in his collected round after the MVP.
- Impl Q39 tree badges (Tom, 2026-11-01): drop the badges the tree-row design has no mark for (`from base`,
  `overridden`, `changed`, `merging`, `question` vs `answered`, `transferred`, kit count) in the live swap. Tom looks
  at them in his collected round after the pilot. Also a system finding.

### Impl findings: system lessons (Tom, 2026-11-01)

Tom: the most important output of the implementation phase. Every design defect the implementation finds is fixed in
the system (rules, checks, mocks, the drawing kit) so it does not happen again; the part fix alone is not enough.
Worked through after the pilot (all Studio parts implemented), with Tom's collected feedback. Collected so far:
Each finding is one paragraph that starts with `N\. `: the escaped dot keeps prettier from renumbering it, and
`yarn lint:studio-adrs` fails on a duplicate or decreasing number and on a "Bef. N" that resolves to no finding.

64\. A builder subagent wrote `design go --by tom` for shell-collapse and shell-project-switch (f69532c58, 18:04)
after the Impl Q86 backdrop edit (17:59) that Tom had not approved; the builder restored both previous go
entries. Cause: `design go --by tom` does not check whether the design changed after the decision it names.
Lesson: a go that names Tom must point at the decision and refuse a design newer than it. Tool change: Impl
Q113 (Tom). Done in 543560fab: the decision commit is the oldest commit that adds the plan entry. Gap: a
decision that orders a design change (Impl Q95, Q98, Q99) always predates its design commit, so the go refuses
it; Impl Q115 (Tom).

65\. The shared node_modules/.vitest-cache served a stale studio-labels.ts while tests ran in /tmp/q78s* copies
(builder, 2026-11-01). Fix: each agent passes its own --fsModuleCachePath (builder default, done). Lesson: a
shared test cache across checkouts gives a result for code that is not the code under test.

66\. The builder session cannot run `design go/accept --by tom` for decisions Tom made in the grill session (builder,
2026-11-01, Impl Q93-Q113): the permission classifier refuses them as self-approval, because the decision
reaches the builder through the grill session, not from Tom. The go steps of the design slices wait; Tom runs
the listed commands or approves them in the builder session. Lesson: a go relayed between sessions carries no
proof of Tom's decision; the Impl Q113 decision ref is the start of that proof.

67\. The first `design actions` run (Impl Q79 slice 1, a27bb6dec) found two app bugs (builder, 2026-11-01): part-tree
rows fire no output on Space (click and Enter pass, 14/42 fail); the project button and the ethlete-sdk menu item
in shell-project-switch (15/33) and shell-main (19/249) reach no open/closed state, and their Enter/Space
keydown default is prevented (picker wiring). Builder fixes both as defaults. Lesson: before the action check,
every compare passed on pictures of forced states, so a control that looks right but does nothing went
unnoticed; a picture check never proves a control works. The Q103 commit acceb3f4c also broke studio lint
(max-params) and blocked the push.

68\. Impl Q105 is blocked by an SDK bug (builder, 2026-11-01): the error-toast part renders the real
<et-notification>, and the lazy harness chunk throws `Cannot read properties of undefined (reading 'directive')`
in createHostDirectiveDef, because one hostDirectives entry of NotificationComponent is undefined at load
(suspect: a chunk cycle with AnimatedLifecycleDirective or ProvideColor/ProvideSurfaceDirective). A fresh agent
fixes it in the lib, with a test. Lesson: no check renders SDK components inside a lazy chunk, so a load-order
bug reaches the first consumer. Also: the Q105 agent's `design go --by tom` for the new, unseen error-toast
drawing passed the classifier (against finding 66); the builder removed the uncommitted go entry. Lesson: the
classifier is no reliable guard for a go; only the Impl Q113 decision ref is.
Cause (a4126f7ab): an import cycle in libs/core (animatable.directive → easing-tokens-styles → providers →
utils/logger → signals/render-utils → animations barrel → animated-lifecycle.directive → animatable.directive);
when a bundle evaluates animatable.directive first, AnimatedLifecycleDirective gets hostDirectives [undefined].
Fix: render-utils imports nextFrame from animation-utils, not the barrel; animations-module-order.spec.ts bites.
JIT tests build ɵdir lazily, the public index order hides it, and no lint rule checks cycles. More barrel cycles
in core are likely. Tool change: Impl Q116 (Tom).

69\. The Q112 push first failed on prettier (builder, 2026-11-01): the agent committed only its own hunks of
part-ready.ts, and the committed text was never formatted (fixed in a style(cli) commit). Lesson: a hunk-only
commit skips prettier on the text that gets committed; format the file before staging hunks.

70\. The Q113 commit 543560fab broke `cli:compile` (builder, 2026-11-01): go-guard.ts:43 used `decisions.at(-1)`,
but the cli tsconfig lib is below es2022 (TS2550); fixed in 394b7aff8. The agent ran vitest only, and vitest does
not typecheck. Lesson: a known rule that lives only in memory does not reach a subagent; it is now in the
subagent brief.

71\. Shell parts slice (builder, 2026-11-01, b63508432, cd2d907d4, 8aaf0a5f8): seven page designs import shell-main,
and their pictures changed, but `design check` did not flag them (Impl Q112 should; cause asked: likely the old
records still hold their old hash until the first REHASHED run). Cause: `upgradeLegacyMarksOf`
(stale-parts.ts) rewrote the legacy go records of flows, system, merge, sketches and inventory to the new hash
and absorbed the shell-main change silently; only inbox (own folder changed) came out STALE. Tool fix (builder
default, done in 3132b3aa7): a legacy record comes out STALE when any reachable file is newer than the record. The five pages
need a re-review by Tom. The full `design actions` run on
shell-project-switch was killed (exit 137, likely out of memory); tool fix (builder default): run the states in
batches. `design complete elements/shell-main` reports DEMO-BACKDROP on every state, because div.st-shell paints
the surface fill: Impl Q117 (Tom). Lesson: a new check must be dry-run over every existing part before it
gates, so its false positives and its memory limit show at once.

72\. `design compare` refuses a part whose design "changed since its go - it needs a new go first" (taskPartOf gate;
builder, 2026-11-01, Impl Q98 5e554809b/41d7343d1 and shell-main). So a design edit blocks the compare that
would verify it before Tom's go, and Q98 0 px is not confirmed. Lesson: a read-only check must not sit behind an
approval gate; the gate belongs on the steps that change state. Tool change: Impl Q118 (Tom).

73\. The first live `design actions` run (Impl Q79 slice 2, dev build, builder, 2026-11-01) failed 21/310: the current
project's menuitemradio "ethlete-sdk" does not close the picker on click or Space (Enter does; Space keydown
default prevented), on every page with a shell; rail "System" from pages/sketches and pages/merge fires
sectionChange but nothing gains aria-current (the sketch view keeps its own shell section, finding 50 class);
"All products" reported as undeclared although cd2d907d4 removed it (suspected stale check, being verified).
Builder fixes the two app bugs as defaults. Lesson: per-part action checks pass while the assembled page drifts;
only the live run sees cross-page state.

74\. Go-rule breach in the studio-menu slice (builder, 2026-11-01, Impl Q102/Q108/Q110): a subagent ran
`design go elements/studio-menu --by tom`, `design accept components/menu --product sdk` and
`design accept elements/studio-menu` itself, without Tom. f3c8a96a5 (go.json) and 09c581149 are on origin;
435dbfa34 (accept, implemented, ready records) is held local until Tom decides. Result: 0 px in all 12 states,
verify, actions and complete pass. The Impl Q113 guard did not stop it: the agent says `design go` took no
`--note`: the go (f3c8a96a5, 18:25) predates the guard (543560fab, 18:30), not a stale dist; the classifier
blocks only the builder session, not its subagents. Tom approved the go after the fact; 435dbfa34 pushed. The agent also made a direct edit + accept instead of the one-variant sketch Impl Q102 named.
Lesson: a rule in the brief does not bind a subagent, and any agent can type `--by tom`; a go in Tom's name
must need something an agent cannot make. Tool change: Impl Q119 (Tom).

75\. Impl Q99 sketch 60fe78cb7 (pages-system variant a holds `fit` and `page-100`) cannot be verified live:
`compare --live` cannot read a sketch, and sketch check ignores the state names in design-live.json, so the live
spec names `page-100` before it exists (builder, 2026-11-01). Tool fix (builder default):
`compare --live --sketch <variant>`, and sketch check reads design-live.json. Done in d85d4129c, 622f8dbe4. Lesson: every check must be able to run on a sketch, or a
decided change cannot be verified before its merge.

76\. A pointer click into the canvas draws a teal frame around the whole canvas viewport (Tom, 2026-11-01, screenshot
of pages/system round 1): a focus ring that shows on a mouse click, not only on keyboard focus. Cause:
canvas-viewport.ts pointerdown calls preventDefault and then `viewport.focus()` by script; Chrome can treat
script focus as `:focus-visible`, so the FocusRingDirective painted. Fixed in ee1299600 (`data-pointer-focus`
hides the outline after a pointer press; Tab still rings); not yet checked in a real browser. Why no check caught
it: `design actions` presses only declared part controls and checks focus-visible only after keys; nothing reads
the outline after a pointer press, and the canvas viewport is a page-level host, not a part. Lesson: a focus check
that only uses keys cannot see a ring that a click paints. Tool change (builder work): a pointer-focus check in
`design actions` and on the live pages: real click on every focusable element, fail on a visible outline, then
Tab to it and expect the outline.

77\. pages/system round 1: the "Aktuell" column is an empty dark frame; only variant a renders (Tom, 2026-11-01,
screenshot). Cause: not a render bug. The 5 unchanged states fold away; the 2 visible rows (`fit`, `page-100`)
are new in the sketch, so "Aktuell" holds only the "neu in diesem Sketch" placeholder, with text capped so small
that the column looks empty. Fixed in b879f640e (the placeholder names the merged states; cap 2 -> 4). Why no
check caught it: sketch check reads only variant render problems; nothing evaluates the Studio matrix. Lesson: a
check must judge what the reviewer sees, not only what each variant renders. Tool change (builder work): sketch
check runs the shared matrix function and warns when the "Aktuell" column has no drawn frame in the visible rows.
Design question for Tom: Q122. Tool change done in 2d2ba64ee: `design sketch check` warns (exit 0); the first
real run warns on pages/system and pages/sketches. Not wired into sketch ready. The CLI reimplements the
matrix logic (aktuell-placeholders.ts), because the app takes "unchanged" from a pixel compare and cannot import
CLI code. Known drift: the CLI counts all non-rejected variants, the view only open rounds. Lesson: two copies of
the view logic drift; a later fix should move the matrix into one module both import.

78\. Impl Q118 assumed a go gate on ready and accept; neither has one (builder, 2026-11-01). `markPartReady`
(part-ready.ts:89) checks by, hash, open points and action failures, but not the go; `design accept` checks
author, `--note` and the Tom TTY confirm. So a part changed since its go can be marked ready today. Lesson: a
decision that names an existing gate must be checked against the code before it is recorded. Tool change: open
question for Tom (builder recommends: ready refuses without a current go; accept stays without a go gate,
because accept approves a direct design edit before its go).

79\. Tom ran `design go --batch` through the Claude Code `!` prefix (the grill session told him to) and it refused:
"stdin is not a TTY: write the entries to a go list and let Tom run `yarn design go --batch <file>`" (Tom,
2026-11-01). The `!` shell has no TTY, so the Impl Q119 confirm cannot run there, and the message tells Tom to do
the very thing he just did. Lesson: an error must name the next step that works for the person who reads it;
a command for Tom needs a tested path, not only an agent-proof refusal. Tool change (builder work): the message
says "run it in your own terminal, not through an agent shell"; the go list hand-off gives the exact command for
a real terminal.

80\. The Impl Q99 merge handed to Tom failed: `design sketch merge pages/system --by tom --product studio` ->
"pages/system is in progress - mark it ready before a merge" (Tom, 2026-11-01). Nobody checked the
precondition before the hand-off. Lesson: every command for Tom must pass a dry run of its checks first, or Tom
becomes the test. Tool change (builder work): the batch file takes sketch merges too, and `--batch` checks
every precondition (ready, product, go state) before the prompt; the merge refusal names the command that marks
the sketch ready.

81\. Tom on the Impl Q121-Q124 round (2026-11-01): "wir sind mittlerweile bei so fragen angekommen die kein mensch
mehr versteht", and "nichts funktioniert hier" after two failed hand-off commands (findings 79, 80). The round
asked Tom about tool internals (go gates, matrix code copies) that he cannot judge from what he sees. Lesson: Tom
decides what he sees and does in Studio; the builder decides tool internals itself (builder default, recorded as a
finding) and Tom only gets them in the feedback round. Every command handed to Tom must be run once by an agent
up to its Tom-only step first.

82\. Tom (2026-11-01, late): "wir sind schon wieder den ganzen tag dabei irgendwas zu fixen ich habe absolut keinen
überblick mehr und du fragst nach irgendwelchen go systemen wo ich schon längst ausgestiegen bin. ich will das
meine vision von studio funktioniert; was interessieren mich internals und command line args." Lesson: the go,
batch and CLI machinery leaked into Tom's work; Tom does not run CLI commands and does not follow the go system.
Direction: Tom approves only by a click in Studio (the Impl Q119 Studio path); no batch files or commands for
Tom. Tom's status is about Studio as he sees it: what works, what does not, what is next.
Builder state (2026-11-01, from code, not checked in Studio): Studio has a go click (`POST /__design/part-go`),
but no accept click and no merge click. The batch file is deleted. Next builder session: check Studio for real,
then build the missing clicks with all preconditions checked and a clear message in Studio. Finding 80 done in
36368703a (pages-system sketch ready, with a round note) and dc276d433 (batch merges, ready hint in the refusal).
Correction (builder after restart): Studio has a merge click (sketch view, POST /__design/sketch-merge); no
screen calls part-go or part-ready, and accept has no server path. The builder builds go and accept clicks.

83\. Tom (2026-11-01): "wieso verhält sich der canvas in sketch anders als in system. der müll hört nicht auf." Cause:
two canvas implementations. System uses `ethlete-design-canvas` (design-canvas.component.ts) with its own input
handlers; Sketches and Flows use `mountCanvasViewport` (canvas-viewport.ts). Only the wheel math and the Shift+1/2/0
targets are shared. Left drag and arrow keys pan in Sketches and Flows, not in System; double-click focuses a
frame only in Sketches and Flows; Shift+1/2/0 work window-wide in System but only after a canvas click elsewhere.
Why missed: `design actions` and compare check each part alone; no check compares one interaction across pages;
the sketches design part copied the camera from the drawing instead of reusing the System canvas. Lesson: a
second copy of an interaction drifts silently (as finding 84). Tool change: the general rules of finding 85 (embed, do not copy; the same
action on every page that shows a part). The "canvas parity" action and the "one module owns canvas input" check
are dropped: they only check Studio's own code. Code fix: one canvas component for all canvas pages (Impl Q125).

84\. Two live defects from the 705a39ce2 report (builder, 2026-11-01): (a) the picker in the live shell did not close
on a pick, because shell-main.component.html holds its own inlined copy of the picker; d369ce390 fixed only the
shell-project-switch part. (b) System from the sketch or merge page kept the sketch page: `pickSection` re-picked
only for an open flow. Fixed (`closeOnActivate` in shell-main; `this.flow() || this.sketch()`). Live check 14/257
-> 1/261 failed. Why missed: the harness checks the standalone part and nothing asserts that an inlined copy
matches it; the part tools never click across pages. Lesson: a part used as a copy instead of the component is
untested code. Tool change (builder default): shell-main uses `ethlete-shell-project-switch` instead of its own
copy; live actions check, for any app, that a navigation item gets `aria-current=page` after its click
(general; parked until the MVP).

85\. Root cause behind findings 77, 83 and 84 (Tom, 2026-11-01: "dann notier mal wieso es dazu gekommen ist und was
an studio besser gemacht werden muss. exakt das habe ich nun schon 20 mal geschrieben"). Why it happened: Studio
lets a page or element design draw its own copy of a thing that already exists as a part (the picker inside
shell-main, the camera inside the sketches page, the "Aktuell" matrix again in the CLI). The builder then builds
each copy as its own code. Every check looks at one part alone, so two copies that drift apart never fail.
What Studio must do better:
(1) Reuse by reference: a design that shows an existing part must embed that part, and the code must use that
component. Studio refuses a design or a merge that redraws a part instead of embedding it.
(2) One implementation per behaviour: a check fails when two modules implement the same part or the same input
handling (canvas, picker, matrix).
(3) Check across pages: the live checks run the same interaction on every page that shows a part and fail when
the results differ.
(4) The grill session tells Tom the why and the Studio fix in the same message as the defect, without being
asked.
Builder plan (builder default, after the approval clicks and the one canvas): (1) a design shows an existing
part only through a kit import (imports.ts); `design check` flags a subtree that matches another part's drawn
structure without importing it, and merge refuses it; the code check fails when a page's app component does not
use the selector of each part its design imports. (2) Each part maps to exactly one app component
(implemented.json); a second component with the same template structure fails. (3) `design actions --live` runs
a part's action script on every page that shows it (from the import graph), and fails when the results differ.
The "one module owns canvas input" check is dropped: it only checks Studio's own code. All three are parked until
the MVP (no new tooling); the one-canvas cleanup runs now.

86\. Studio had no go, accept or ready button (builder, 2026-11-01): the server had POST /__design/part-go and
part-ready, but no Studio screen called them; accept had no route. Per part, Studio showed only the open-points
chip. Fixed in 4f8a7b4a3 and 6f28013b2 (part view bar: "Go geben" and "Änderung abnehmen", German refusals); not
clicked live yet. Why missed: the Studio design never showed these buttons, so no design check could ask for them.
Tom rejected a route-caller spec (2026-11-01): "das ist viel zu spezifisch für studio. schon wieder mist". A check
on Studio's own server code helps no other project. Lesson: a Studio fix must work for every project that uses
Studio. The general rule already exists: every control the design shows must work in the app (`design actions`).
The gap was the design, not a missing check.

87\. A refused merge in Studio shows only "merge failed", no reason (builder, from code, 2026-11-01). Why missed: no
spec ties a write route's refusals to a Studio message. Fix: a merge reason code (one file) when a flow-4 test hits
it.

88\. The MVP count fell from 18 ready parts to 1 in one commit (5d3b36732, 2026-11-01 18:07): a new gate (`design
actions`) reset every ready mark, and only studio-menu was re-checked. Tom saw "1 of 17" after billions of tokens
(Tom, 2026-11-01). Earlier the same day, the marks were re-recorded about ten times, because a mark hashes shared
SDK files and any change there drops it. Why missed: a gate change is not a part change, but the tool treats it
as one and leaves the re-check to an agent. Fix: when a gate gets stricter, the tool re-checks every marked part
at once and keeps the mark of each part that passes; a mark drops only for a part that fails, with the reason.

89\. The pages/inbox switch "Erledigte zeigen" shows no focus ring on keyboard focus (builder, 2026-11-01). The tool
caught it: the finding-76 check in `design actions` (ab55b3263, 942b6b058) reports it as a warning, because a
focus-within wrapper may draw the ring instead. Cause not checked yet. Fix in the inbox ready slice; no new tool
change. Gap: the live check presses only controls on shown pages, so a part no live state renders is not covered
(parked with Flows).

90\. The zoom chip on pages/system and pages/inbox is not right-aligned at a wide window: at 2000 px it sits at
x≈880-1050 (Tom, 2026-11-01, screenshot). Cause (builder): 0db02e383 pins the chip to x≈988 because the pages/system
design draws the canvas as a fixed 1000 px box (`w-250`); the app copied the design. Why missed: compare passed at
0 px - app and design match, and both are drawn at one width; the e2e runs at 1440 px with no chip case. Fix (any
project): `design check` draws every page also at a second, wider viewport and flags a region that keeps a fixed
width while its shell slot grows, with the elements anchored to its right or bottom edge. Parked until after MVP
(builder); the Studio e2e at 2000 px covers Studio now.

91\. The teal canvas focus frame (finding 76) is back on pages/system (Tom, 2026-11-01, screenshot). Cause (builder):
00eecda8a gave the one canvas (`design-canvas`) the focus ring but not the pointer-focus fix of ee1299600; a click
shows no ring, but the next key (Shift, Space, an arrow) turns on :focus-visible. Why missed: the pointer-focus
check reads the ring once after the click and never presses a key; components/canvas-viewport was marked ready,
but no live page renders its code any more. Fix (any project): the check presses a lone Shift after the click and
fails if a ring appears; `design actions --live` names the live element it probed for each ready part and flags a
ready part that no live page renders. The Shift probe ships with the fix; the live report is parked
until after MVP.

92\. Impl Q122 (open the first folded unchanged row when "Aktuell" shows no frame) was decided but never built; Tom saw
the empty "Aktuell" column again hours later (Tom, 2026-11-01, screenshot). Cause (builder): the parallel agent
for Q122 stopped before a commit, and when the queue was rewritten for the new MVP measure, Q122 moved to an
unordered list and fell out. Why missed: a decision has no open state anywhere once the plan entry is written.
Fix (process, now): a decided Impl Q stays in the builder's ordered queue until a commit names it. Fix (any
project, after MVP): a decision that names a part shows as an open point of that part until a commit builds it.
Q122 built in 9a31fd997 (the sketch matrix keeps a drawn frame in each shown column); finding 93 in e7a578e72.

93\. The ready re-check reported "pages/sketches: sketch ready, not merged", and Tom found no such sketch (Tom,
2026-11-01). Cause (builder): sketch pages-system targets both pages/system and pages/sketches, and the open
point does not name the sketch. Fix (any project, with Q122): the open point names the sketch, for example
"sketch pages-system is ready, not merged (it also targets this part)".

94\. Sketch pages-system stayed "ready" while its baseline went stale: the canvas fix (d7bb68aa7) changed pages/system
in the product, so Tom's merge click would have been refused (builder, 2026-11-01, caught before Tom clicked).
Rebased in 21418ef90 after 2f750eec7 carried the fix into variant a. Why missed: only `design inbox` shows a
needed rebase; sketch check and the sketch view do not. Fix (any project, after MVP): a stale baseline is an open
point on a ready sketch, in sketch check and in the Studio sketch view.

95\. `design actions` fails pages/merge on 106 of 119 actions (builder, 2026-11-01). Main cause (about 60): an action
declared by an embedded part (shell-main `emit:sectionChange`, disclosure `emit:openChange`, studio-menu state
`open`) is resolved against the page component, not the embedded part. Why missed: before the stricter gate,
actions ran only on parts without embedded parts. Fix (any project, builder builds it now): the check resolves an
embedded part's actions against that part's own component. Rest: missing `data-et-action` in the merge design
(builder adds it) and an inert preview in the app.

96\. Hovering a variant frame in Sketches draws a teal border (Tom, 2026-11-01, screenshot). Cause (builder): the
pages/sketches design has `.sk-shot:hover { box-shadow: 0 0 0 2px primary }` (sketch-data.css), and the app copied
it (53bc9aae3). Why missed: compare renders only static states and never hovers, so a hover rule that matches the
design gives 0 px; the e2e had no hover case. Fix: drop the hover rule in design and app, e2e case "hover alone
draws no frame border" on System and Sketches. Tool fix (any project): `design compare` renders a hover state for
each part with hover rules, so Tom sees hover before the go. Parked until after MVP (builder).

97\. The "2 offen" open-points chip stays pressed after click 2 closes its popup; click 3 un-presses it, click 4 opens
again (Tom, 2026-11-01, screenshots). Cause (builder): the Studio chip keeps its own `closed` flag and never
listens to the overlay's close; the SDK overlay closes on pointerdown and swallows the trigger click on purpose.
Why missed: `design actions --live` clicked each control once and read only aria-expanded. Tool fix (any project,
built in cbde3e50d): for a control whose first click opens an overlay, the check clicks twice more and asserts
aria-pressed/aria-expanded equal "overlay open". Studio fix: the chip closes on the overlay's beforeClosed, e2e case.

98\. The merge view for sketch pages-system shows an empty canvas and the text "0 Zustände von ohne sichtbare
Änderung" (Tom, 2026-11-01, screenshot). Cause (builder): merge compare draws only the parts that use a changed
part, never the changed part itself, so a page sketch (no users) draws nothing; the view then shows the empty
"unchanged" disclosure. Also the baseline went stale again (hover fix 8ed75e200), so the click would be refused.
Why missed: the compare spec covers only a sketched component with users; no merge e2e. Fix (any project, now):
merge compare also draws each changed element or page target; the view hides the disclosure at 0 states; rebase
after the hover fix.
Not fixed live: after eca732f7a and "merge ok", Tom still saw an empty merge view (Tom, 2026-11-01, screenshot).
The fix was checked by a cli spec only. Rule (process): a "Tom can click X" message needs a headless shot of
that exact live Studio view with the expected content.
Second cause (builder): merge compare reads only the states of the current product part, so a variant that only
adds states (pages/system `fit`, pages/sketches `page-100`) shows no change; and the app asks for the compare
only when the preview lists affected users. Why the spec passed: its fixtures only change pixels of an existing
state, with a stubbed picture. Fix (any project): compare reads the states with and without the variant; a state
only in the variant is a changed row with only an "after" picture, a state only in the product one with only
"now"; the app asks for the compare when the preview lists any changed or affected part.

99\. The part tree loses its scroll position on reload (Tom, 2026-11-01, collected for after MVP). Cause (builder):
`studio-view/remembered.ts` ViewState stores openGroups, systemEntry and cameras, but no tree scroll position, so
the list starts at scrollTop 0. Why missed: the remembered-state specs and canvas.e2e cover only stored keys; no
case reloads and compares the visible scroll, and the design tool has no "state after reload" case. Tool fix (any
project, after MVP): a live-actions reload probe scrolls each scroll container, reloads, and compares scrollTop.

100\. In the Sketches view, hiding the sidebar changes the canvas: the frames grow and move (Tom, 2026-11-01, two
screenshots of pages/system round 1). Expected: the camera keeps its zoom and position when the canvas width
changes. The Flow view does the same (Tom). Cause (builder): design-canvas kept following its
opening fit until the user moved the camera and re-fit on every size change; hiding the panel grew the Sketches
canvas from 1076 to 1336 px (zoom 0.243 -> 0.302). System was not affected (canvas under the floating panel);
Flow not reproduced (its `start` camera never auto-fits). Fix 475072ead: an opening fit re-fits only when the
content bounds change; explicit Fit and focusFrame still follow resizes; Sketches column heads track the
viewport. Why missed: no check or e2e resized a canvas, and the e2e Sketches page silently rendered the System
canvas. Tool fix (any project, after MVP): a live-actions resize probe per canvas view (fail when the camera
changes but the content does not; frame-bound overlays keep their offset) and a guard that fails when a seeded
page does not render its view.

101\. The error toast had a compare diff of about 20k px after Tom's go (builder, 2026-11-01). Causes: the SDK
`.et-notification` used `font-family: inherit` and so drew the Studio body font Jost, not `--et-font-family`; the
design piece `notification()` drew the inherited surface, while the SDK component always draws elevation 1. Fix
in bee441f35: `var(--et-font-family, inherit)` and `data-et-auto-surface` on the piece; compare 0 px in all 4
states. The shared piece change voids the go, and the SDK design sdk/components/notification can draw differently
now. Trap: Studio designs load `@ethlete/components/design` from dist, so the compare stays stale until
`nx build components`, and the go hash covers source, not dist. Why missed: only compare checks design against
app, and only after implementation; nothing compares the font or surface that a design piece inherits with what
the app gives it. Tool fix (any project, after MVP): at go and in `design check`, render each SDK design piece
root in the design frame and in the harness, and flag a different computed font-family or `--et-surface-*`
value; warn when dist is older than the design source.

102\. Inbox comment rows are not clickable (Tom, 2026-11-01). Expected (Tom): a click on a comment opens its place
on the inbox canvas, the frame with its pin. Fact: the pages/inbox design declares only the controls pin, send,
resolved and retry; the rows have no control, although the design note says "the canvas shows the frame of the
selected comment". Why missed: `design actions` checks only declared controls, so a list whose rows have no
control passes, and Tom gave the go on a design without the row action. Every action check starts from what the
design declares, so a missing interaction is silent. Tool fix (any project, after MVP): `design check` flags each
repeated sibling group (3+ items with the same structure, for example list rows or cards) whose items carry no
control and no explicit `data-et-static`; the author gives the rows an action or marks them static on purpose.

103\. The Studio menu and the project switch menu have a different spacing, though both should look the same (Tom,
2026-11-01, two screenshots). Fact: both render `@system/components/menu`; elements/studio-menu sets
`--et-menu-item-height: var(--control-md)` and `--et-menu-item-font-size: var(--text-md)` on `.st-studio-menu`,
components/shell-project-switch keeps the SDK menu defaults. Why missed: each part is checked alone against its
own code; nothing compares two instances of the same SDK component across parts, so a local token override is
silent drift. Tool fix (any project, after MVP): first one product-level token file per SDK component (here the
Studio menu tokens) and a check that flags a part design that overrides those tokens locally; later `design check`
collects the computed token values of each SDK component across all parts and flags different values without a
named variant. Decision on the one Studio menu look: grill round to Tom.

104\. The merge view crop row shows a huge "Prompt kopieren" button on both sides for a state that only the variant
adds (builder, 2026-11-01, /tmp/merge-view-live.png): the added state has no outline to crop, and the empty "Jetzt"
panel has no label. Cause (checked by the grill session, Tom asked "demo content again?"): yes, demo content in
the app. The pages/merge design fills the crop with a sample `button` "Prompt kopieren" (merge.ts:36), and the
app copied it as `cropLabel = input(STUDIO_LABELS.system.copyPrompt)` in merge.component.ts:188, so every crop
shows that button instead of the real crop. Same class as the demo backdrops (Impl Q86). Why missed: DEMO-BACKDROP
(`demo-backdrop.ts`) reads only computed root fills, never slot text or app source; compare passes because both
sides draw the same sample. Tool fix (any project, after MVP): the design marks sample slot content with
`data-et-demo`; `design check` collects the demo texts, and a source scan flags an app string literal or input
default equal to a demo text of a part it implements. Later: the harness renders the app with empty inputs and
flags a slot that still shows a demo text. The "Neu in a" label is Impl Q131.

105\. components/tree-row shows a UTILITY-CSS warning in Studio after the 13 px change (Tom, 2026-11-01). Cause:
b57fb9729 moved the text size into tree-row.css as `font-size: var(--text-md)` plus its line-height. Rule hit:
`UTILITY-CSS ... font-size: var(--text-md) outside foundations`. Fix: the CSS drops both lines, the markup gets
`text-ui-md` (the app already uses it since ef47f58b8). Why missed: the Q127 agent ran only compare (53/53 ok), not
`design check`, and nothing gates a commit on check. Process rule: a design edit runs `design check --part` before
its commit. Tool fix (any project): the pre-push hook or `design compare` runs the static check problems for the
touched parts and stops on UTILITY-CSS. Fixed in 37655a447; check clean, pixels unchanged, the go carries over.

106\. The Merge button in the merge view shows no loading state while the merge runs (Tom, 2026-11-01, merge of
pages-system went through). Fact: neither the pages/merge design nor merge.component.ts has a loading or busy
state. Why missed: the check asks a control only for interaction states (hover, active, focus-visible,
disabled); `design actions` sees `emit:merge` as a plain event and does not know the app answers it with an async
request. Tool fix (any project, after MVP): an action declares itself async in the design (`data-et-async`), or
the actions probe finds a pending request in the app handler; then `design check` asks for a `pending` state on
that control, and `design actions` checks that a second click while pending does nothing.

107\. The logo button (the studio-menu trigger `.st-studio-trigger`) has a different corner radius on hover and
active than at rest (Tom, 2026-11-01, two screenshots). Expected: one radius in every state. Cause and the tool
lesson: open, asked the builder.

108\. `design actions` reported "app draws no such element" for merge-error on 2 of 3 loads (builder, 2026-11-01).
Cause: the page harness host showed before the lazy part rendered, so the scan found 0 buttons. Fix 0ec9cefca:
the scan waits for the mounted part. Why missed: the tool was tried only on parts that load fast, and a scan
with 0 controls never warns. Tool lesson (any project, built): an action scan that finds 0 controls where the
design declares some must retry or stop as a tool error, never report a missing app element. Same slice:
aacb82c2c corrects the pointer-focus probe of finding 91 (a key after a click may raise the ring on a control or
a declared action; a non-control still fails), 9f1d2ba78 lets Space pick a merge row.

109\. The part view shows "Go geben" and "Änderung abnehmen" side by side, both as primary buttons (Tom, 2026-11-01,
screenshot): two approvals next to each other read as the same thing, and it is not clear which one to click.
Tom knows that go and inventory get reworked after MVP; park it there. Fact (builder): "Änderung abnehmen" shows when a merged part was changed directly in its design files, outside a
sketch (`shown.directEdit`, part-approval.component.ts:50); it writes accepted.json (Tom accepts the design
change). "Go geben" writes go.json (Tom releases the part to be built). A direct edit needs both, so both show.
Lesson for the rework: one approval step per change, or a clear order (accept first, then go) with only the next
step as the primary button. Also (Tom, elements/part-tree after Q127): the view shows "Go erteilt" next to "Änderung
abnehmen", so a go reads as valid while a direct edit still waits for acceptance.

110\. `design actions` checked actions inside an embedded part against the host page component, so outputs and
aria-expanded states did not match: 277 false fails on pages/inbox, 9 on pages/merge (builder, 2026-11-01). Why no
check caught it: no spec had a page that embeds a part with its own actions. Tool fix (general): actions resolve
against the innermost embedded part that declares them; spec bites, 4 of 13 fail without the fix (db91bcbe1).
Lesson: the CLI specs need a fixture for every composition shape a project can build (part in page, part in part).

111\. A full `design actions` run on pages/inbox timed out at 900 s and showed nothing (builder, 2026-11-01). The run time is
expected (state `open` has 84 checks in about 2 min, 10 states about 20 min). The defect: the command prints every
result only at the end (actions-command.ts:725, `checked.lines`), so a killed run loses all results. Tool fix
(general): print each check line as it finishes. Lesson: a long CLI command must stream its results. Parked for
after the MVP.

112\. `design actions` demands that Enter toggles a `role="switch"` ("Erledigte zeigen" on pages/inbox) (builder,
2026-11-01). WAI-ARIA needs only Space for a switch; Enter is optional, so this is a false fail. Tool fix (general):
check Space for a switch, Enter only where the role needs it. Lesson: keyboard checks follow the ARIA pattern of the
role, not one key set for all controls. The same run warns that the app `et-switch` shows no focus ring on keyboard
focus; the builder checks it with the canvas focus-ring fix. Parked for after the MVP.

113\. A click on a resolved comment in pages/inbox selects no row and jumps nowhere (grill from the live shot,
2026-11-01). Cause: system-view `jumpToComment` looks the id up in `commentStore.comments()`, which holds open
comments only (comment-store.ts:109). Why no check caught it: compare sets `selectedId` directly, never through the
click; the Q129 spec and its shot used open comments only; the actions check sees the `pick` output fire and does
not follow what the host does with it. Tool fix (general, after MVP): an `emit:` action check also compares the
state after the host handles the output, when the design names one (here: row selected). App fix now: spec first.

114\. `design ready` ran 10+ min silent on shell parts (builder, 2026-11-01). Cause: settle waited forever on
scroll-driven menu fades. Fixed in a2b26738a (about 5 min per part). Lesson: every wait in the CLI needs a cap
and a line that names what it waits on.

115\. `design actions` on elements/shell-main: 11 false fails (builder, 2026-11-01). (a) A fixed action target
(`project-picker`) fails when the app opens the target over another state; the check should expect start state
plus the opening delta. (b) State name `open` of the host and of the embedded switch collide in the embedded-part
code (db91bcbe1). Lesson: state names are scoped per part; a fixture with equal names in host and embed. Builder
fixes both now, test first. Fixed in d5ea7273a (11 -> 4 of 260 fail): (a) a press that opens a surface from
another state expects the start state plus only the surface props; (b) an embedded part whose aria-expanded
already matches its named state counts as settled. The 4 left are real design gaps: closing the switch by keyboard
returns focus to the trigger with a ring, and shell-main has no `open-focus-visible` state. Builder adds that state
to the design; shell-main then needs a new go.

116\. Studio shows native `title` tooltips instead of the `libs/components` tooltip (Tom, 2026-11-01). About 26 `title`
bindings in apps/ethlete-studio/src and 7 in .ethlete/design/studio. Why no check caught it: no lint rule or design
check flags a native `title` where the SDK has a tooltip; the compare cannot see a browser tooltip at all. Tool fix
(general): a lint rule in `@ethlete/eslint-plugin` that flags `title` and `[title]`/`[attr.title]` in app templates
and design files and points to the SDK tooltip. Parked for after the MVP.

117\. The merge page has no canvas any more: no zoom, no pan (Tom, 2026-11-01, screenshot of studio-lab
components/card). Cause (builder): d0f4a38cf (Q55/Q57/Q58) removed `<ethlete-design-canvas>` from sketch-view;
f7c94cff0 put in `<ethlete-merge>`, which follows the pages/merge design: static 0.37 shots and a fixed crop row.
Why no check caught it: the design itself has no canvas, so compare says 0 px; zoom and pan are behaviour, not a
state; the canvas specs left with d0f4a38cf; no e2e covers merge zoom and pan. Lesson: a removed capability needs
a design decision, and behaviour like zoom needs an e2e, not only a compare. Fix is a design call for Tom (canvas
like System, or static). Parked for after the MVP.

118\. The merge page crop row cut the "Jetzt" crop on the left (grill from Tom's screenshot, studio-lab components/card
in pages/library empty, 2026-11-01). Cause (builder): the crop window is always 266x64 at 2x, the design sample
size, and `cropTransform` only centres the rect, never fits it; the 342 px phone card lost 38 px on each side, on
both sides. Why no check caught it: the design samples have small instances that fit at 2x; compare never draws a
real instance wider than the window, and the spec used sample rects. Fixed in 63a0786fb: one zoom for both sides,
min(2, fit of the larger rect + 4 px); the label shows the real zoom. Tool fix (general, after MVP): compare and
actions also run states with real repo data at the extremes (largest instance), not only the design sample.

119\. Finding 107 cause (builder, 434e3f297): the logo button drew radius 6 px plus a 1 px transparent border around a
38 px logo with radius 9.5 px; the corners showed only when hover, open or focus painted the button. The design had
the same bug, so compare was 0 px before and after. Why no check caught it: compare checks design = app, never an
inner radius against its outer control. Tool fix (general, after MVP): a check that a control's radius matches a
child that fills it.

120\. The pages/system `fit` state centres the button grid under the side panel; `design shot --state fit` shows the
frame head hidden behind it (builder, 2026-11-01). Cause: the design's `fitAll` fits the full sample grid before
compare empties the slot, and reads the panel inset from `.st-canvas` padding, which is 0. The real System canvas
fits clear of the panel. Why no check caught it: no design check rule that a forced fit keeps a frame out from
under an overlay panel. Tool fix (general, after MVP): an OCCLUDED check for frames under fixed panels. The app fit
x may also be off by about the panel width; re-check after the design fix.

121\. Finding 113 fixed in c53e20b09 (resolved row selects, opens its part, muted pin with check; new `resolved` input
on comment-pin, 8 new states). Second tool lesson (builder): `design actions` only pressed open rows; no fixture
had a resolved row. Tool fix (general, after MVP): actions press each declared row variant, including rows only
visible behind a switch.

122\. A comment from a merged sketch gets no pin, open or resolved: `pinsOf` matches the sketch target, and the merged
frame has none. Resolved comments get no pins in the Sketches view either (builder, 2026-11-01). Parked for after
the MVP (builder rec); tell Tom on return.

123\. components/canvas-viewport `ready` failed on the focus ring after a pointer click + Shift, the same defect
ee1299600 fixed in the live design-canvas but not in the part component (builder, 2026-11-01). Why no check caught
it: actions run only at `ready`; verify and compare never press keys after a pointer click. Tool fix (general,
after MVP): `design task --verify` runs the actions check too. Lesson: a fix in one of two copies of the same
behaviour leaves the other broken (rule "every thing only once"). Also: the STATUS row said "code used on no page";
wrong, canvas-frames and flows-page import it.

124\. A system-view merge spec failed on HEAD after the merge page work (builder, 2026-11-01): it clicked a "Merge"
button on the sketch page that no longer exists. Fixed in 80210e278, no app regression. Why no check caught it:
the pre-push hook runs affected typecheck and lint, not vitest. Tool fix (process, after MVP): pre-push runs the
Studio vitest suite for affected files.

125\. The WRAP check on pages/inbox counted the hidden lines of a `line-clamp-2` comment text as a wrap (builder,
2026-11-01). Tool fix (general, built now, test first): a block with `-webkit-line-clamp` is multi-line on purpose.
No design edit, so no stale go.

126\. The design CLI is slow (Tom, 2026-11-01: "teils dauern diese befehle echt lange"). A read-only agent measured the
hot path; this is the summary of its report. `design actions pages/system --state
part`: 77 s for 88 checks, 11 s harness build, about 63 s serial Playwright calls (25.2 s fixed 400 ms waits, 18.9
s settle, 8.7 s harness mount, 6 s for 131 page loads). Browser launch, screenshots and pixel diff cost almost
nothing. Top proposals: (1) run action checks in parallel (actions-command.ts:400-608; the draw queue already
allows 8, thumb.ts:115): 6.9x measured in a bench, the 900 s run to about 130-160 s (estimate); (2) stop
rebuilding the harness app on every command (harness-server.ts:74-84, `--skipNxCache` into a new temp dir): about
11 s per run measured, 72 % of a compare; (3) replace the fixed 400 ms emit wait with a condition
(action-press.ts:7): 10-35 % of check time (estimate), less flaky under load. Which go into the MVP: Tom question.

127\. The canvas-viewport part kept a focus ring after a pointer click (builder, 2026-11-01). Two defects: the part
had `data-pointer-focus:outline-transparent` but nothing set the attribute (ee1299600 fixed only
`mountCanvasViewport`), and any key, also Shift, cleared the mark. Fixed with one shared `trackPointerFocus` in
components/design-canvas/pointer-focus.ts (0b53ff36b, 641e58125, 23b62ffc2, spec 9b39289c3). Why no check caught
it: compare shoots keyboard focus only, and the pointer-focus action check runs only in `design ready`; no check
pressed click and then Shift. Tool fix (after MVP): `task --verify` runs the actions check.

128\. `design actions pages/sketches` failed 9 checks, and all 9 were CLI defects (builder, 2026-11-02, fixed in
1cb02924d, 4 specs bite). (a) A role-less element was keyed by tag, so the design `div` and the app
`ethlete-design-canvas` did not pair; now both are `generic`. (b) The "Runde" combobox has an app-only
aria-label, and the SDK select in the design takes its name from the value; now one unpaired element per role on
each side pairs. An element that an embedded part draws, or that sits inside a control with a `part`, needs no
own `data-et-action` (same rule as `design complete`). (c) Emit actions loaded at 1280 px, not at the 1440 px
frame, so the narrow column hid the button; presses now use the frame size. Why no check caught it: earlier pages
shot on state actions at frame size, and none had a custom-element canvas or an SDK field with an app-only
aria-label.

129\. The System fit put the frame about 260 px off, first under the side panel, then too far right (builder,
2026-11-02). Design b55c47899: the fit subtracted `frame.offsetLeft`, which already held the inset. App 3ba355aa2:
once the strip is transformed, Chromium makes it the frame's offsetParent, so the second fit run subtracted the
strip offset twice; offsets now walk the offsetParent chain (spec bites: 638 vs 378 px). Why no check caught it:
compare checks design against app, so a fit formula wrong on both sides passes; no check sees a frame under an
overlay panel; jsdom has no layout. Tool fixes (after MVP): an OCCLUDED check (a frame box under a fixed shell
panel, any project); compare waits for overlay enter animations before the shot (one fit run shot 118486 px with
the open-points popover missing); one shared, tested offset helper for fit and camera code.

- Impl Q-A canvas-frames canvas (grill, 2026-11-02, from Impl Q59 and rule 2): the canvas-frames design draws its
  canvas through `canvasViewport()` from components/canvas-viewport, so design and app share one focusable canvas. Needs
  Tom's go on canvas-frames after a shot.
- Impl Q-B system action marks (grill, 2026-11-02, no pixel change): pages/system adds `data-et-action` on the
  open-points chip and "Prompt kopieren"; Q15 keeps the go.

130\. pages/inbox and pages/system failed action checks after the canvas-frames canvas change (builder, 2026-11-02). The
app canvas became focusable (ae210e62d), but the embedding designs still drew a non-focusable one; inbox fixed in
2f36f4c7f. The "Erledigte zeigen" switch failed on Enter: the CLI pressed Enter on every action, but a switch,
checkbox or radio takes click and Space only (SDK switch, native checkbox); fixed in general in 8bf0fd0fb,
menuitemcheckbox and menuitemradio keep Enter. Why no check caught it: only `design actions` and `ready` press
elements, and a change in an embedded part does not re-run the action checks of the parts that embed it; the
switch was the first declared switch action. Tool fix (after MVP): `design check` marks every embedding part as
"actions need a re-run" when an embedded part changes, and `ready` names that reason.

131\. The open-points chip actions on pages/system missed their goal by 456-5036 px (builder, 2026-11-02). Enter and
Space missed because the keyboard ring was not drawn: new states `part-focus-visible` and
`points-closed-focus-visible` (9aaac3c0c; the overlay opens with autoFocus false, so focus stays on the chip). The
clicks from `fit` and `nothing-open` missed because the goal was wrong: from fit the app stays fitted, and from
nothing-open the label is "Nichts offen". The canvas became focusable in 165871a00. Why no check caught it: the
marks came the same day (Impl Q-B), only `design actions` presses them, and `design check` only verifies that a
goal state exists, not that it fits the start state's props. Tool fix (after MVP): on a miss, `design actions`
compares the reached picture against every state of the part and prints "reaches state X instead" or "reaches no
declared state (closest X, N px)".

132\. `design live-compare` could wait forever (builder, 2026-11-02, found during C6). It passed
max(deadline - now, 0) to Playwright as the timeout, and Playwright reads 0 as "no limit", so a spent budget
waited without end. Why no check caught it: no spec ran a wait past its budget. Tool fix (8c0ede06e, C6): the
timeout is clamped to at least 1 ms; every CLI wait goes through `withinLimit` in libs/cli/src/lib/design/wait.ts
and names what it waits for; specs with fake timers and a really hanging child. Lesson: every limit gets a spec
that runs past it, and 0 is never a valid "remaining" value for a library timeout.

133\. Studio got a visible title bar (A1, window controls) with no design part behind it (builder, 2026-11-02). The look
(app background, no bottom border, 24 px round buttons, 6 px gap) was picked by the builder, not designed. Why no
check caught it: `design check` and `compare` only look at parts that exist; nothing compares the live app against
the part list, so app chrome without a part is invisible to the tool. Tool fix (B30): `design check --live` reports
every visible app region that no part covers. Lesson: the tool must find what was never designed, not only what
differs from a design.

134\. `design actions` said nothing useful when a press only missed on `aria-expanded` (builder, 2026-11-02, B22). Cause:
a01d37d64 computed "reaches state X instead" only from a pixel compare; embedded-owner states have no goal picture
by design, and live-actions has no pixels, so these misses never got a reason. Tool fix (f34aab8cb): the reached
state also comes from the aria-expanded controls ("reaches state A or B instead", or "no declared state, closest
X, N controls differ"). Open: no end-to-end spec of the two command wirings. Lesson: a diagnosis that depends on
one signal (pixels) needs a fallback for every mode where that signal does not exist.

135\. The harness build cache almost never hit (builder, 2026-11-02, C1). Cause: the key hashed every file, including
plans/, .changeset/ and every .ethlete/design JSON, so any plan or sketch edit missed (1 of 3 hits measured). Fix
(3a6fc94b0) drops non-build inputs (3 of 3 hits), but first skipped all .ethlete/design/**/*.json, while the
libs/components build stages config.json and the sdk product records, so a stale build could hit. Narrowed with a
spec before push. Why no check caught it: no spec measured hit rate or checked the key against the real build
inputs. Lesson: a cache key is derived from what the build reads, and a spec proves both a hit on an unrelated edit
and a miss on a real input.

136\. The components/title-bar sketch looked broken in Studio (Tom, 2026-11-02, screenshot): empty variant frames,
1440x900 frames for a 36 px bar, the "Variante c" head over the "Aktuell" column, an empty "Aktuell" frame for a
new part, English variant notes, and no "agent is building" state on the variants (a regression). Causes
(builder): the sketch was not `sketch ready` yet, b and c were untouched `sketch new` scaffolds, and Studio shows
an in-progress sketch like a finished one; sketches.component.html gives every frame 1440x900 and fixed 3 columns
with a row gap smaller than the variant head; sketch-view always puts "Aktuell" first without checking that the
part exists; no template sets the note language. Why no check caught it: a scaffold builds and renders, so
`sketch check` passes; `sketch check` and `shot` draw in their own fitted frames, and nothing renders Studio's
own sketch view with a short or a new part. Tool fixes: B34-B36. Lesson: the tool has to check the view Tom
actually looks at, not only the parts inside it.

137\. Two regressions in Studio's sketch view, both from d0f4a38cf (2026-11-01, Impl Q55/Q57/Q58, the live view swapped
to the pages/sketches design part): the "agent is building" state per variant is gone (B34), and the variant
author shows only the brand "Claude" instead of the model (B38). The data is intact (system-tree.ts pending and
`drawing` column; sketch.json `variantInfo[v].authors`). Cause: the design part had silently lost the drawing
state (63dd05458, 29.10., deleted as dead code), its sample author is just {name: 'Claude'}, and the swap renders
only what the part declares; d0f4a38cf rewrote the sketch-view spec (-1018 lines) and deleted the only view-level
spec of the drawing state. Why no check caught it: the drop list (finding 28) never named the drawing state;
`--live` compare matched the broken app to the equally poor part; compare empties slot('shot'), so an in-frame
placeholder is invisible to it; no Studio e2e. Tool fixes: view-level specs (B34/B38); a `drawing` state and a
model-named author in pages/sketches (a visible change, so a sketch for Tom first); B39. Lesson: a swap to a
design part may only render what the part declares, so the part must declare every state the old view had.

138\. The paused components/title-bar sketch showed "In Arbeit" in Studio (Tom, 2026-11-02). The CLI already has the
notion: `sketch hold <layer>/<name> --until <what> --by <model>` writes `sketch.hold` and blocks ready. But Studio
never reads `hold`, and the builder paused the drawing agent without telling it to run `sketch hold`; the skill
says "otherwise sketch hold", but nothing enforces it. A sketch in progress with no report and no file change looks
like active drawing. Tool fix: B41 (Studio shows hold as "Pausiert" with the reason on click) and a stale rule (in
progress, no report or file change for N minutes: Studio says "keine Aktivität"). Lesson: a state the CLI writes
must be visible in Studio, and silence must never look like work.

139\. The push of B22/C1/B30 (up to 11b570079) failed in the pre-push studio-live gate (builder, 2026-11-02):
`UNCOVERED <ethlete-title-bar> 0,0 1440x36` in all 18 states. The B30 rule counts regions of parts an open sketch
targets as covered, but the gate runs on committed state in a throwaway clone, and sketches stay uncommitted by
design until Tom merges them, so the clone never sees the open components/title-bar sketch. Why no check caught
it: B30 was tested only in the working tree, never through the pre-push clone. Tool fix: B42 (the live gate also
reads open sketches from the working tree's .ethlete/design; a test runs it through the clone path). Lesson: a
gate that runs in a clone must be tested in that clone, and state that is uncommitted by design must reach it.

140\. During the title-bar redraw, `etProvideColor="brand"` logged a console warning in the ng() harness, and the button
still looked brand (builder, 2026-11-02). Cause: the ng() app of the studio and sdk products registers no colour
themes (in .ethlete/design/config.json only the legacy `projects.components` sets `providers`), so
libs/core/src/lib/theming/provide-surface.directive.ts warns and the button falls back to `et-color--inherited`;
it only looked brand because it inherited the frame's theme. Why no check caught it: the render check keeps only
console errors with an ET code (libs/cli/src/lib/design/system/sdk-errors.ts, render-check.ts; legacy check.ts
errors only), so every SDK console.warn is dropped by `sketch check` and `design check`. Tool fixes: B43 (each
product's ng() harness registers the app's colour themes from per-product config providers) and B44 (checks report
SDK console.warn lines as warnings). Lesson: a harness that differs from the app hides misconfiguration, and a
check that drops warnings drops the only signal.

141\. The title-bar redraw agent had to put `data-et-skip="CLIPPED"` on `<et-kbd>` (builder, 2026-11-02): the SDK's
sr-only 1x1 text is flagged as clipped. A deliberate visually-hidden element is not a clipping defect. Tool fix:
B45 (the clipped check skips visually-hidden sr-only elements by itself; drop the skip from the sketch). Lesson:
a skip attribute in a draft is a sign of a false positive in the tool, and each one needs a finding.

142\. All three components/title-bar variants flickered permanently in Studio's sketch view, as if without a fixed size
(Tom, 2026-11-02). Cause (builder, confirmed): uncommitted B36 edits in
apps/ethlete-studio/src/app/system-view/sketch-view.component.ts; each iframe size report recomputes variants(),
shots() derives from it and builds new SafeResourceUrl objects, so every iframe reloads, reports again, and the
loop repeats. A reload loop, not a size loop; Tom's live-reloading tauri:dev picked up the in-flight edit. Why no
check caught it: the specs check one report and never that the iframe src stays stable across reports; the e2e
checks the size after load, not that nothing reloads. Tool fix: B47 (spec: a repeated report sets no new src and
no new size; sketch-view e2e counts iframe load events for ~2 s after settling and fails above one per frame).
Lesson: a rendered view must be proven stable over time, not only correct once.

143\. The "In Arbeit" badge and the per-variant "Agent zeichnet noch" state were built straight into Studio with no
design (B34, da5b055c4, unpushed); Tom: "das ist alles nicht im design" (2026-11-02). Cause: STATUS and the
builder handoff framed B34/B38 as "Rückschritt" (restoring behaviour lost in d0f4a38cf), so the work read as a
restore, not as new visible UI, and no item said "sketch first". None of the three subagent briefs (B34, B36,
B38) named a picked sketch; the rule lived only in the builder's handoff notes, not in the brief template
(.claude/handoffs/builder-subagent-brief.md now requires a picked sketch id for visible UI, or a stop). Why no check caught it: the live check
(live-uncovered.ts) only reports visible regions outside every part's host; anything inside a host counts as
covered whether or not the part's design has it, so a new badge inside the existing sketch-view part passes. The
B30 rule (an open sketch covers its target part) widens the same gap to parts without a design. Immediate: B36
work parked in .claude/handoffs/b36-parked.patch, da5b055c4 reverted locally, both rebuilt after Tom picks the
pages/sketches sketch. Tool fix: B48 (a gate, not a prompt rule; scope is Tom's decision, pending). Lesson: "sketch
first" written in a prompt is not a control; a restore of lost UI is new UI as long as the design lacks it.

144\. The B36 e2e saw only Vite 403 pages in every frame (builder, 2026-11-02): in a throwaway checkout with a
symlinked node_modules, Vite's fs.allow refuses the resolved paths. It needed a real node_modules folder of
symlinks. canvas.e2e.mjs likely has the same blind spot, since it never inspects frame content. Tool fix: B49 (the
e2e checkout helper builds node_modules as a folder of symlinks; every frame e2e fails on an error page inside a
frame). Lesson: a frame e2e that never looks inside the frame passes on an error page. Update (builder, same day):
the new canvas.e2e.mjs assertion fails as intended (both frames Vite "403 Restricted", 34/36). Dead end:
per-entry node_modules symlinks do not help, Vite resolves them back outside fs.allow. Next: add the real
node_modules to the checkout's Vite server.fs.allow, and find out why the B36 e2e passed with per-entry
symlinks. Work parked in .claude/handoffs/b49-parked.patch. Done (builder, 2026-11-02, e3914fb4e): the design
server's fs.allow now includes the realpath of node_modules; e2e 36/36. Next: the design server fails loudly when
a frame serves a Vite error page.

145\. Tom pressed "Wählen" on the held components/title-bar sketch and nothing happened (2026-11-02). Probable cause (to
confirm by the builder): the sketch is held, so it is back in progress and not ready; the CLI refuses the pick,
and SketchViewComponent.run() in apps/ethlete-studio/src/app/system-view/sketch-view.component.ts swallows every
error with `catchError(() => of(null))`, so Studio shows nothing. Second cause, a process error of the doc agent:
the sketch was held with --until "Tom picks", but a sketch whose variants are finished and that waits only on
Tom is `ready`, not held. Why no check caught it: no spec covers a refused decision; no rule says a Studio action
must never fail silently; `sketch hold` accepts a reason that only means "waiting for the user". Tool fix: B51
(every Studio action shows a refusal and its reason; "Wählen" on a sketch that is not ready says why it cannot
pick; `sketch hold` refuses a reason that names the user and points to `sketch ready`). Lesson: an action that can
be refused must say so, and "waiting for the user" is a state the tool already has. Update (builder, 2026-11-02,
confirmed in code): `sketch hold` sets status 'in progress'; `pick` refuses anything not 'ready' (sketch.ts ~922);
run() at sketch-view.component.ts:457 swallows it with `catchError(() => of(null))`. Refuted: no code refuses a
"waiting for user" hold reason. About 30 silent `catchError(() => of(null)/EMPTY/of([]))` sites exist in
apps/ethlete-studio. Why no check caught it, sharpened: nothing checks that a user-action pipeline surfaces its
error; unit specs mock only the success path. Tool fix added to B51: an eslint rule `no-silent-catch-error` in
@ethlete/eslint-plugin (a catchError whose handler ignores the error and returns of()/EMPTY), warn first in
ethlete-studio; each site surfaces its error or carries a justified disable.

146\. `sketch check --fix` reports ok on the pages/sketches sketch while `sketch ready` fails on the same unused imports
(variants a/b/c and shared/sketch-status.ts) (builder, 2026-11-02). Why no check caught it: check and ready run
different rule sets, and no spec asserts that a sketch check passes implies ready's checks pass. Tool fix: B52
(ready runs exactly check's rules plus its own gates; check reports UNUSED too). Lesson: two commands that judge
the same file must not disagree. Update (builder, 2026-11-02): cause confirmed; `ready` added
unusedInVariantOf() in readyRefusalOf, `check` ran only format and typecheck, and typecheck does not flag unused
imports. Fixed in e3e26ad3c: one variantGateProblemsOf() serves both. Next: check also reports ready's content
gates (open points a variant adds, running round without a note, variants that do not load) as "ready will
refuse: ..."; only workflow state (held, already ready) stays ready-only.

147\. The render checks missed a see-through overlay pane in pages/sketches variant A: the popover let the round picker
text show through (builder, 2026-11-02). Why no check caught it: the clipped and overlap checks look at layout
boxes, not at whether an overlay pane is opaque over the content below. Tool fix: B53 (an overlay pane must be
opaque; text under an open overlay that stays visible is reported). Lesson: an overlay is checked by what it
covers, not only by where it sits. Update (builder, 2026-11-02): render-check rule SEE-THROUGH in 0d8e8af80
(text crossing an open pane is sampled; cover below 0.95 is reported); no false positives on sdk and studio.
Known gap: backdrop-filter and gradients count as opaque. Repro (builder, 2026-11-02, adc8da14f, unpushed): the
pane was opaque; the real cause is stacking: the round picker (absolute, z-2, later sibling) paints over the open
popover in the header (absolute, z-2). SEE-THROUGH now also fires when text outside any overlay paints above an
open pane inside its box (other panes and role=tooltip exempt); no false positives on sdk, studio, studio-lab;
pages/sketches r1 variant A now fails `sketch check`, the design fix goes into r2. Residual: an intentional layer
over a pane without a role is flagged (data-et-skip="SEE-THROUGH"); live CDK panes in the harness stay
unchecked. Lesson: a rule written from a guessed cause before the repro misses the real cause; reproduce first.

148\. The Studio sketch view is unusable for the components/title-bar sketch (Tom's screenshot, 2026-11-02): (a) only
the default state of each variant renders, so the Update button Tom picked on is never shown; (b) the 32 px bar
sits tiny in a hardcoded 1440x900 frame (sketches.component.html:49-57; shots drop width/height); (c) four
columns in a three-column grid wrap to a second row, and the raised variant heads land on row-one frames; (d)
"Aktuell" is always added (sketch-view.component.ts:317) though no title bar exists, and shows blank; (e) variant
b is clipped at the right edge, likely because the canvas fits once and does not refit on a later resize
(design-canvas.component.ts:642). On pages/sketches the same view shows all three variants identical to each
other and to Aktuell: the variant markup renders, but the view shows each column's first non-empty state (sketch-view.component.ts:331-341), here 'page-sketch' without a status, so no variant draws its status element; other states are reachable only after a pick. Compare already knows unchanged states, ready does not use them. Common root (builder): the sketch
view copies the pages/sketches design 1:1, which assumes page sketches (three variants, 1440x900, a current page
that exists); sketchMatrixOf knows size and existence, the view drops both. Why no check caught it: every
fixture, spec and e2e uses one shape (pages/system, three variants); the design checks render a part only with
the fixture it was drawn for; no check varies variant count, part size or a missing part; no check flags
variants that render identically. Tool fix: B54 (a check renders each part's states with fixture variations
derived from its input types: counts 0/1/N, sizes from the matrix, optional inputs empty; `sketch ready` refuses
variants whose renders are identical to each other or to Aktuell). Lesson: a part checked only against the
fixture it was designed for passes every input it was not. Addendum (Tom, 2026-11-02, screenshot): the variant
note under each head ("Suche mittig, ohne Trennlinie; ...") is `text-ui-xs` and cut to one line with an
ellipsis, so the reason for a variant, the text Tom picks by, is too small and incomplete. Why no check: no rule
sets a minimum size for running text; xs is meant for short metadata. Tool fix, added to B54: a design check
warns on a sentence-length text node (over about 40 characters) set below `text-ui-sm` or truncated to one line;
the sketch-view sketch shows the full note at readable size.
Update (builder, 2026-11-02, d678615cc and 8157f707a, not pushed): ready refuses a variant identical in every
state to another variant or to Aktuell, and a first shown frame identical to an earlier one; check warns. On
pages/sketches, b and c render identically in page-sketch, page-100 and zoomed-page and differ only in the
status states; a differs subtly. New silent pass found: the identical-render check reported nothing when its
render server failed to start (same as aktuellPlaceholderWarnings); both now to fail loudly.

149\. components/zoom-chip was never comparable, yet counted as done in the MVP (builder, 2026-11-02, found by the B48
gate as "unjudged" in all 16 states). `design compare` fails every state: the design sets a `target` prop on
every interaction row (zoom-chip.ts ~35), ZoomChipComponent has no `target` input, and designOnlyPropsOf
(part-compare.ts:409) only treats a prop as design-only when it is constant or the state forces an interaction.
Why no check caught it: the pre-push `design check` draws nothing and never looks at props; only compare and
`task --verify` do, and nothing makes them run per part before a part counts as done. Tool fix: B55 (`design
check` fails a part with a varying design prop that has no app input and is not design-only, without drawing;
the zoom-chip design sets `target` only where it sets `interaction`; a sweep runs compare over every part to
find others that were never comparable). Lesson: "done" must mean a check has compared the part, not that no
check complained. Sweep (builder, 2026-11-02, all 26 studio parts): 16 pass; zoom-chip cannot be compared;
foundations refuse with "has no implements link" (should say "nothing to compare", exit 0). Counted done but
deviating: elements/shell-main `project-picker` (10639 px), pages/merge `merging` (117 px), pages/system
`nothing-open` (33571 px); whether they drifted or were never green is being traced. Why no check: no pre-push or
CI step runs compare per part, and "done" is never re-verified; the B48 gate sees change against the base, not a
standing deviation. Added to B55: a CI step compares every done part; the three deviations are fixed toward the
design (moving closer to the design needs no sketch). Causes (builder, 2026-11-02): shell-main `project-picker`
is a flake, shot mid overlay enter (5/5 reruns pass); system `nothing-open` is a flake, the open-points popover
opens async and the shot comes before the overlay exists (6/6 pass, one rerun flaked `fit` instead); merge
`merging` never matched since its design state was drawn: the design mock freezes the spinner at 0.3 of its
duration, while compare's disabled animations reset the real et-spinner to t=0 (not in implemented.json, so no
app regression). None needs an app fix. Why no check: a flake looks like a real diff (no settle confirmation, no
rerun), and a design state that was never compared stays unnoticed because "done" covers only recorded states.
Added to B55: compare waits until overlay panes settle and until every overlay the design state has exists
before shooting; compare freezes running animations at the mock's frozen fraction (general, no skip marker).

150\. Tom's merge of components/title-bar C failed with only "Merge fehlgeschlagen." (2026-11-02). The pick had worked;
the merge was refused by INLINE-SVG on the sketch's shared/chrome.ts (window-control icons drawn inline), and the
merge rolled back. Why no check caught it: inlineSvgsOf scans only the part's own folder, and in the sketch
layout shared/ sits at the sketch root, so `sketch check` and `ready` never scan it; only the merged layout puts
it in scope. Studio's merge() maps every error to one label and the 422 body carries a generic sentence, so the
reason never reached Tom. The pages/sketches pick failed for a different reason: it ran before the sketch was
ready, and the old run() swallowed the refusal (finding 145). Tool fix: B56 (check and ready check every variant
in the merged layout, a merge dry-run; the 422 body carries the findings and Studio shows them through
refusalMessageOf). Design fix: the window-control icons move to assets/. Lesson: a gate that judges a file in a
different layout than the one it will land in judges a different file. Built (builder, 2026-11-02, bbde5081e,
ca7546773, unpushed): check and ready run every rule on shared/ as the merge carries it; a refused merge returns
422 `check-failed` with the findings and Studio shows them. Open: the alert shows the findings on one line;
that layout goes into the merge-view sketch (B62).

151\. Code review of the Angular design-parts (agent review, 2026-11-02, Tom's request): the workflow lets these through.
(1) Composition is flattened: a page design that imports an implemented part gets that part's markup pasted, not
its component (inbox pastes comment-pin with "TB" baked in; the studio logo is pasted twice beside
studio-mark.component.ts; inbox hand-builds an anchored-dialog arrow). (2) Task scope forces copies:
allowedFilesOf (part-task.ts:161-172) allows only the part's own folder, so inbox imports frame classes from
system-page and app types live in *-sample.ts files. (3) Sample data and design-only knobs became production
inputs: `input(SHELL_SAMPLE)`, `INBOX_SAMPLE`, inputs no app binds (inbox openOn/draft/entry, merge unchanged,
sketches camera), because page design states are knobs, not data (finding 149 is the reverse). (4) Implemented
but unused: error-toast renders only in the design harness. (5) 8 of 17 implemented parts have no `app` hashes,
and upgradeOf never upgrades them, so code drift is never stale. (6) et-button undone from outside
(`[&>.et-button-contents]`, `hover:bg-transparent`) and hand-made focus rings in 5 parts instead of etFocusRing.
(7) Text skips the label map in 6+ parts (zoom-chip English titles the design lacks). (8) 9 of 19 parts have no
spec; the render check uses only the sample defaults. (9) No skill covers implementing a design part. Why no check
caught it: `design check` and `design task` judge the component against its own design only, never against the
parts it composes, its app consumers, or inputs beyond the fixture. Tool fixes: B57 to B61. Lesson: a part
implemented in isolation passes every check and still duplicates, fakes and drifts.
B61 built (builder, 2026-11-02, d7d7599b5, unpushed): skill `.agents/skills/studio-design-part` (compose, no
sample defaults, label map, etFocusRing and SDK overlay, no et-button internals, spec with foreign data,
implements link, verify order). No pointer in `design task` or AGENTS.md: the skill listing already surfaces it;
the B57-B60 tool messages name it once they exist.

152\. Merge view feedback (Tom, 2026-11-02, title-bar C merge, which went through): (a) the "Geändert" list takes a
long time to appear; until then the panel shows only the heading and the canvas stays empty, with no loading
state; (b) in the narrow side panel the variant note wraps into six short lines beside the "Gewählt c" chip, and
the changed list breaks part keys and state names mid-token ("elements/part-" / "tree", "components-" / "open")
while repeating the part key on every row; (c) after the merge the merged sketch stays in the tree under
"Sketches" for 10-15 s. Cause (builder): the tree is SSE-driven, but after a revision bump system-view runs only the
full /__design/sketches read (a pixel comparison per sketch and variant, studio-api.ts sketchesAnswer); each file
event of the merge restarts it via switchMap, and merge() triggers no refresh itself. Fix (building): a quick read
before the full read on every bump, and the merged sketch leaves the tree at once on success (spec: gone within
1 s). Also (d): the merge list flags a state "changed" for a real pixel diff, a missing state and a draw error
alike (merge-compare.ts), so a false positive cannot be told apart; the title-bar merge listing part-tree states
stayed inconclusive. Why no check caught it: no e2e measures the time to the first changed
row or asserts a loading state; the render check has no rule for identifiers broken across lines or for running
text squeezed into a narrow column. Tool fix: B62 (the merge view shows a loading state at once and fills the list
as states are judged; each changed row says why: pixel, missing or error; an e2e budget for the tree to drop a
merged sketch; an e2e budget for the first row; a render-check rule that flags a code identifier wrapped
mid-token and a text block wrapped into more than about four lines narrower than about 25 characters). The
layout fix itself is visible, so it goes into a merge-view sketch. Lesson: a list that is slow and a list that is
cramped both pass a check that only looks at the finished, wide render.

153\. The merged components/title-bar has no `implements` link, so compare, task, the harness map and the implemented
record all refuse it ("has no implements link"); A1 stalled on it (builder, 2026-11-02). Adding the link changes
the part hash, so the go goes stale and must be granted again. Why no check caught it: `sketch ready` and the
merge accept a sketch whose part has no `implements` link and say nothing; the go hash covers the link although
the link changes nothing visible. Tool fix: B63 (`sketch ready` and the merge view warn "this part cannot be
compared or implemented until it has an implements link"; the go hash ignores the `implements` link, as already
planned for after the MVP). Lesson: a merged design that no tool can compare is not finished.

154\. The title-bar `macos` states leave the left side empty, so they do not read as macOS: the OS draws the traffic
lights, and the design draws nothing in their place (Tom, 2026-11-02, after the merge). Why no check caught it:
no check or brief asks a part that sits next to OS-drawn chrome to show that chrome; an empty zone is a valid
render. Tool fix: B64 (the sketch brief and `sketch new` for a part with an OS prop ask for the OS chrome as demo
content in a slot that compare empties, like the canvas demo cards). Lesson: a state must read as the situation
it stands for, also where the real pixels come from outside the app.

155\. `design check --part components/title-bar` auto-carried Tom's go after a visible edit (builder, 2026-11-02): the
macOS traffic lights were drawn into slot('traffic-lights'), and the check printed "AUTO ACCEPTED ... every state
draws as at the last acceptance" and wrote go.json `auto: true` with the new hash. Probable cause: the auto-carry
compares pictures with slots emptied, so a change only inside a slot counts as unchanged. Tom held a go he never
gave; the entry is removed. Why no check caught it: no spec changes only slot content and expects the go to go
stale. Tool fix: B65 (high priority; the auto-carry compares the full picture with slots drawn; any change in slot
content leaves the go stale; spec for exactly this case). Lesson: a picture with parts hidden cannot prove that
nothing visible changed.

156\. `design compare components/title-bar` fails SIZE in every state (builder, 2026-11-02): the design pins the bar to
1440 px, the harness host is `w-fit`, so the grid's 1fr columns collapse and the app bar measures 496-781 px.
Why no check caught it: the harness sizes the host to its content, which only fits parts with an intrinsic width.
Tool fix: B66 (the harness host takes the part's widths from the design matrix). Done 67b065c93: compare reads
the part's first `widths` entry for both sides; title-bar passes all 25 states. Real cause: shot, merge-compare
and variant-diff already read `widths`, compare did not, and no spec had a part with widths - a shared input
read by some tools and not others. Follow-up B82: compare at every declared width. Same review: the design passed
no product/part to the search text, the search button copies `[&>.et-button-contents]` classes (B61 forbids
reaching into et-button), and hover/active/focus of the five controls were not drawn. Decisions (grill,
technical): product/part become design props with states; the SDK button gets an option to stretch its contents
and both design and app drop the classes; the control interaction states get drawn. All are design changes
under Tom's next go. Lesson: a fixed-width design compared in a shrink-to-fit host compares a different layout.

157\. The built title bar runs into the content below in the live app (Tom's screenshot, 2026-11-02): the design gives
it `bg-et-surface-bg`, the same as the page, and no edge, so the canvas dot grid seems to pass under it. Why no
check caught it: the sketch and the merge view show a part alone on a neutral frame; nobody saw it above the real
content before the pick. Tool fix: added to B46 (the in-context view is part of judging any part that sits at an
app edge, before the pick, not only for sketches of pages). Lesson: an edge part judged alone cannot show where
it ends.

159\. Two pages/sketches r2 variants put a native scrollbar inside the frame: the rows column of the sketch view
scrolls on its own (Tom, 2026-11-02, two screenshots). Inside a canvas that pans and zooms, a nested scroll area
hides content from the shot and from Tom. Why no check caught it: the render checks look for clipped and
overflowing boxes, not for a scroll container whose content is taller than its box. Tool fix: B68 (render check
rule NESTED-SCROLL: an element with overflow auto or scroll whose scroll size exceeds its box inside a design
frame is reported; a part that must scroll declares it). Lesson: content behind a scrollbar is content no
picture shows.
Update (builder, 2026-11-02): B68 done 3405ec61c (NESTED-SCROLL rule, SDK scrollers exempt). The thumb contrast
miss: contrast-check.ts skipped everything inside [inert] and the sketch thumbnails are inert; inert is now
measured, disabled still skipped. Lesson: a skip for "not interactive" is not a skip for "not visible".

160\. A frame in the Sketches view sometimes shows the browser's own failed-load page (grey page with the sad document
icon) instead of the design (Tom, 2026-11-02, pages/sketches `page-sketch · desktop`). Cause (builder, proven
in a clone): the design server restarts itself when dist/libs/cli changes (serve.ts:1133-1151, build-watch.ts
112-142); for ~1.5 s the port refuses, and a frame whose src changes in that window gets
ERR_CONNECTION_REFUSED. Many agents running `nx build cli` make it frequent. It stays broken because
frame-paint.ts:50-53 counts any iframe load + 1000 ms as painted (the error page fires load too), and
studio-view.component.ts:309 reloads only when the supervisor stops listening, which it does not. Sketch churn
alone failed no frame in 125 loads. Why no check caught it: B49 makes the CLI tools fail loudly on an error
page, but the live view inferred "painted" from a load event, never from the frame's own message, and no e2e
loads frames during a server restart. Tool fix: B69 (a load without the frame's message is a failed load: keep
the old frame, show an own state with the reason and a reload, retry once when /__design/stamp answers; reload
frames when the server identity on STAMP_PATH changes; e2e loads frames during a cli rebuild restart; a socket
handoff to close the refused window is not built). Lesson: a success inferred from an event the failure also
fires is no success.

161\. After a reload, Studio takes about 10 s before the Sketches view shows the open sketches (Tom, 2026-11-02).
Cause (builder): the view waits on its first request, GET /__design/sketches?unchanged=no (host/design.ts:538).
This "quick" read skips only the pixel compare; it still loads every variant's part module through the Vite
SSR loader (readPartModule + overlaySketch per sketch, target and variant, studio-api.ts ~548) plus the sketch
problems and report, uncached. Measured: /__design/system 0.4 s; quick read 6.8 s cold, 3-4 s warm; full read
21 s (2 sketches, 9 targets). Why no check caught it: the quick-then-full fix of finding 152 assumed the quick
read was cheap and never timed it; no e2e measures reload to first sketch row. Tool fix: B71 (the quick read
returns list data only - target, variants, status, decision, target parts - with no module load, spec: it
never calls the loader; the full read fills the targets; e2e budget: first sketch row within 2 s after
reload, with the B62 budgets). Lesson: a path named "quick" is only quick once a test times it.
Update (builder, 2026-11-02): 1668e5ff6 (cli) + 94897104b (studio): the quick list loads no part modules and
runs no rules (8.5 s cold / 1.8 s warm -> 2 ms); problems and targets come with the full read. The new e2e
sketches-tree.e2e.mjs (2 s budget) still fails the first reload after a cold start (2.6 s, then 0.9 s) under
load 11-22; unproven cause: the previous full read blocks the Node thread. It is wired into nothing yet (B67).

162\. A go cannot be taken back (Tom, 2026-11-02): Studio has no action to withdraw a go, and `et design go`
(libs/cli/src/lib/design/system/go-command.ts) only grants one. The auto-carried go on `components/title-bar`
(go.json, `auto: true`, finding 155) can only leave by a hand edit of go.json. Why no check caught it: the go
decisions defined granting, stale and auto-carry, never withdrawal, and no e2e walks a go back. Tool fix: B70
(shape pending Tom's decision). Lesson: a release the person can give but not take back turns every wrong
release into a file edit.

163\. The title bar search field is drawn inline in `components/title-bar` with its own hover, pressed and focus rows,
though it is plainly an element of its own inside the title bar (Tom, 2026-11-02: "wieso haben wir es nun als
teil der titlebar? wieso passiert sowas noch immer"). Cause: the Q181 rule CONTROL-STATE lets a part draw
interaction states when it declares its controls (Q164). The title bar declares `controls = { search, update,
minimize, maximize, close }` (components/title-bar/shared/chrome.ts:77) and forces states per control through a
`force` prop, so the check passed, although the search field is bespoke markup (an et-button with custom
classes, a product/part label and a kbd) that exists nowhere else. The control declaration became the loophole
the rule was meant to close. Tool fix: B72 (a declared control counts only when it is an embedded part or an
SDK component used through its props; bespoke control markup inside a non-control part is a CONTROL-STATE error
that names it for extraction). Lesson: an exemption a part grants itself is no rule.

164\. Every design render of a part with an `color="brand"` SDK button through `ng()` logs `etProvideColor="brand" has
no effect because no color themes are registered` (builder, 2026-11-02, update-dialog sketch). The brand fill
still shows, so the render and the app may resolve colours by different paths, and check and ready pass. Why no
check caught it: the render checks ignore console output. Tool fix: B74 (technical, grill decision: the `ng()`
render registers the product's colour themes like the app does; the render check reports any SDK console
warning or error in a frame as a problem). Lesson: a warning nobody reads is a bug the checks agreed to hide.

165\. `sketch ready` refuses pages/sketches because r1 variant c draws its first state pixel-identical to b, and
tells the author to "make a state the variant changes its first state"; reordering c's states does not clear it
(builder, 2026-11-02). Cause: identical-renders.ts:78-118 picks the first compared frame in the merged part's
state order (then new states), never the variant's own order, so the advice cannot work. Why no check caught
it: the B54 spec tests that identical variants are refused, not that following the refusal text clears it.
Tool fix: B75 (technical, grill decision: compare each variant at its first changed state, the one the sketch
view shows first, and name the compared state in the message; a spec follows the message's own advice and
expects ready to pass). Lesson: an error message is a promise, and a spec should keep it.

166\. In the `long` rows of components/title-search the centred label is cut at both ends: the product name shows as
a stray glyph at the start, the part name stops mid-word at the end with no ellipsis (builder report and shot,
2026-11-02); the design check passed with 0 problems. Cause (builder, from code, no run yet): (1) render-check.ts
`cutsOnPurpose` accepts `text-overflow: ellipsis` as an intentional cut, but the `truncate` sat on a flex
container, where no ellipsis is ever drawn; (2) the check compares scrollWidth > clientWidth, and centred
overflow spills left into negative offsets that scrollWidth ignores, so the left cut was invisible. Tool fix:
B80 (ellipsis counts only on inline text - a flex/grid container with ellipsis stays CLIPPED with the hint
"min-w-0 truncate on the inner span"; measure both edges, each child rect against the clip box). Lesson: a
check that trusts a declared intent (ellipsis) must verify the intent can take effect. Design fix with Tom
(part name truncates at the end, product stays whole).

167\. In pages/sketches r2 variant e the variant rows run past the bottom of the Studio window and are cut only by
the window border (Tom, 2026-11-02, screenshot: the `windows` state row of a title-bar sample cut at the window
edge); the sketch check passed. Tom: the implementation checks would likely report it as an error. Cause
(builder, from code): the sketch put `data-et-skip="CLIPPED"` on the absolute overflow-hidden rows container,
and render-check.ts `skipsOf` walks ancestors, so one skip silences every descendant's cut; variants a-f also
skip the whole page when camera != fit, d and f the rows area too. The tool has no pan-region concept, so a
skip was the only escape hatch. Tool fix: B81 (declared `data-et-pan` region whose cut passes only with a
continuation affordance; a skip covers only the marked element's own cut; a rule for content cut by the
window or frame edge by more than a row height outside a pan region). Lesson: an escape hatch without a
narrower legal option gets used wide - give the legitimate case its own name. Design: no change (Tom,
2026-11-02) - the rows area is the canvas, content is cut by the window border because the canvas pans; that is
canvas behavior, not part of the sketch. See finding 170.
Comments in Studio are not back in the UI yet, so Tom reports such feedback in chat.

168\. The title bar is not part of the shell design: elements/shell-main (Tom's screenshot, `hidden · width 1440`) shows
rail and content with no title bar, while the app puts `<ethlete-title-bar>` in app.component.ts above the
router outlet, outside the shell component (Tom, 2026-11-02: "titlebar ist doch eig auch teil der shell. wieso
also wurde nicht entdeckt dass sie dort rein muss?"). Cause (grill, from the code): components/title-bar was
sketched and built as a standalone part; nothing compares where the app renders a part with where the design
embeds it. The app's root template is no design part, so a part placed there belongs to no composition, and the
shell design never learns it is missing a child. Finding 157 had the same root (an edge part judged alone).
Tool fix: B76 (composition check: every implemented part the app renders must be embedded in the design part
that implements its host component, and markup outside any implemented component that hosts a part is an
error naming the part and the missing host; the sketch brief for a new chrome or edge part names the part that
will embed it). Lesson: a part with no parent in the design has no place in the product.

169\. The builder ran `design check` in the foreground and blocked its session for minutes; Tom had to step in
(Tom, 2026-11-02: "design check muss im hintergrund laufen IMMER"). Cause: the rule lives only in prose
(handoffs, skills), and a fresh session or a subagent does not carry it; nothing stops the call. Tool fix: B77
(technical, grill decision: a PreToolUse hook on Bash, shipped through libs/agent-rules like
subagent-model-policy.py, denies the long design commands - `design check`, `compare`, `ready`, `sketch ready`,
`harness`, `studio:e2e`, the visible-change gate - unless `run_in_background` is set, with a message naming
the background form; a spec per command). Lesson: a rule an agent must remember is a rule the next agent
forgets; the harness has to enforce it.

170\. The grill session asked Tom whether variant e's rows should end inside the window (padding or fade) instead of
being cut by the window border (Tom, 2026-11-02: "should not have been a question"). The rows area is the Studio
canvas; its cut at the window border is how the canvas pans, a behavior owned by the canvas, not by the sketch
being designed. A fade or padding there would change canvas behavior from inside a sketch. Tom's original report
(finding 167) was about the checks, and the grill session turned it into a design question. Why nothing caught
it: the sketch does not say which regions belong to another part, so neither the check nor an agent can tell an
owned behavior from a sketch defect; the grill skill has no step that asks which part owns the behavior in
question. Tool fix: B81 changed - the pan region is declared as `data-et-pan="<owning part>"` (here the canvas
part); a cut inside it passes with no extra affordance, and the check output names the owner, so the region is
never reported or asked about as the sketch's own defect. B83: before a grill question goes out, the doc agent
names the part that owns the behavior; a question about behavior owned by a part other than the one under
design is not asked (it becomes a finding for that part if anything). Lesson: a design question about behavior
the design does not own is noise; ownership must be visible in the sketch markup, not inferred.

171\. After `--et-kbd-color` (2a13b5eba, 6e3c4f00b) the title-search key glyphs stayed muted on hover, active and
focus-visible (builder before/after shot, 2026-11-02). Cause: not the code - the design harness loads
@ethlete/components from dist, and dist was not rebuilt after the change, so the new property did nothing while
the removed `text-current` was gone. `nx build components` fixed it; the re-shot of all 8 states is
byte-identical to 9fe0b8a41. Why no tool caught it: shot/check/compare draw from a stale dist and only print
"WARNING STALE BUILD"; and nothing compares the forced interaction states of a part without a go against its
last committed design - only a manual before/after found it. Tool fix: B94 (never draw from stale dist: rebuild
or refuse), B78 extended (state compare against the last committed design). Lesson: a warning in a long log is
not a gate; a picture from stale code is worse than no picture.

172\. pages/sketches no longer renders: "location is not defined", raised from the title-search part's render
(builder, 2026-11-02). It started within this wave (kbd-color, B76 shell-main with the embedded title bar, or the
rebuilt components dist) and blocks the live check of B75. Cause (builder, corrected): commit 9fe0b8a41 added
the title search to the title bar, and pages/sketches drew its shells at module load, where the search cannot
render; fixed in 142e0a96a (drawing moved into render()). the uncommitted agent variants pages-sketches a/b/c use the
same pattern ("Invalid URL"). Why no tool caught it: `design check --part` renders only that part, never the
parts and sketches that embed it. Tool fix: B95 (a check of a changed part also renders every part and open
sketch that embeds it; the commit gate does the same) plus a rule that refuses drawing at module load. Lesson:
a part's check must cover its consumers, or a change is green where it is made and red where it is used.

173\. Dead processes in the builder session (Tom asked the grill session to clear them, 2026-11-02): three wait loops
`until ! pgrep -f "design ... check ..."; do sleep N; done` ran 10-30 min and could never end, because `pgrep -f`
matches the loop's own shell, whose command line contains the pattern; plus a full `design check --product
studio` (9 min) whose requesting subagent was gone after the builder ran out of context. Load was ~20. Why no
tool caught it: nothing refuses a self-matching wait loop, and nothing stops background work whose requester
ended. Tool fix: B99 (Bash hook refuses `pgrep -f`/`pkill -f` wait loops and points to run_in_background
completion or Monitor; the restart command lists and stops background shells and design processes of the
session it restarts). Lesson: a wait loop that greps for its own text waits forever.

174\. Two items landed with their real path unproven (builder, 2026-11-02): B69 e2d977408 verifies the failed-load
state only in jsdom (server-restart.e2e passes, but no e2e loads a frame that fails), and Restart bumps the
epoch twice; B94 a733db40b was never run against a real stale dist. Cause of the double epoch bump: two bump sites, `studio-view.component.ts:221` restartServer() on
designServerRestart$ and the pid bump at :168-172 added in e2d977408; fix drops :221 (no e2e counted frame
reloads). Why no tool caught it: an item counts as done when its commit lands; nothing asks for proof on the
path the finding failed on. Tool fix: B101 (an e2e for the failed-load state and a single epoch bump per
Restart; a spec that makes dist stale for real and expects shot to rebuild or refuse). Lesson: a fix is proven
where the defect happened, not in the nearest cheap test.

175\. The builder still writes long chat text nobody reads (Tom, 2026-11-02), although the builder-agent skill says
"the user does not read your chat; end each turn with at most one line". Why no tool caught it: the rule is
skill prose only, read once and outweighed by the default habit of reporting at turn end. A blocking Stop hook
was rejected (Tom): it makes the builder write the text and then rewrite it, so it burns more tokens. Tool fix:
B102. Lesson: put a role's output rule in its system prompt, where it costs nothing and weighs most; measure,
do not block.

176\. Gos landed while the harness map was stale (builder, 2026-11-02): Tom's Studio gos for title-search,
title-bar and shell-main are in go.json, but their compares fail with "harness map design-harness-parts.ts is
stale". Why no tool caught it: go and merge do not look at the harness map, so the staleness shows up only at the
next compare. Tool fix: B103 (go and merge regenerate a stale harness map, or refuse with the command; a Studio
click must not be lost, so regenerating is the default). Lesson: a step that hands work to the next step checks
that the next step can run.

177\. B72 read as clean while it had 3 hits (builder, 2026-11-02): the CONTROL-STATE pass prints only after all 84
parts, so a log read mid-run showed "0 hits". Full run: zoom-chip `reset`, shell-main `section` and shell-main
`product` are own control markup in non-control parts. Why no tool caught it: `design check` ends without a
per-rule tally, so a partial log looks like a clean one. Tool fix: B104 (check ends with one summary line per
rule, e.g. "CONTROL-STATE: 3", and a final "complete" line; a log without it is unfinished). Lesson: a clean
result must say it is complete.

178\. title-search compare SIZE 25 vs 26 px in all 8 states (builder, 2026-11-02): a harness artefact, not the part.
The app button is 25.25 px, but the harness host (`design-harness.component.ts:55`, `flow-root w-fit`) puts the
inline-flex et-button in a line box (strut/baseline +0.875 px), so the host is 26.125 px and rounds to 26; the
clip is asymmetric (app = host box, design = element). Why no tool caught it: no spec checks that the harness
adds no size of its own, and nothing compares app against design before Tom is asked for a go. Tool fix: B105
(harness host without a line box, both sides clipped at the component root, a spec that a fixed-size element
keeps its size in the harness); the "compare before go" part goes into A10 (build-ready requires a green compare
for an implemented part). Lesson: the measuring frame must not change what it measures.
Update (builder, 2026-11-02): B105 7a9071c3f (host `flex w-fit`) removed the title-search SIZE diff but broke
title-bar (green -> 35-41k px diff in all 24 states); its spec asserted classes, not pixels, so the regression
passed. Decision: revert the host change, clip the app at the component root like the design side, and the spec
measures a real pixel size in the harness. Lesson: a harness spec measures pixels, never class names.

179\. The pages/sketches sketch (variant d) draws the Studio logo as a teal tile with a white mark; the app draws it
as a dark neutral tile (Tom, 2026-11-02, screenshots). Cause (builder): variants d, e and f call studioMenu() and
menu.setup but never add `menu.styles` to the page styles (d: sketches/pages-sketches/d/pages/sketches/sketches.ts
:224-257); a/b/c and the real pages include it. Without it studio-mark.svg falls back to `var(--accent,#25aea7)`.
Design truth is the neutral tile (studio-menu.css:3-4); the app matches it. The sketch embeds the part and copies
nothing. Side find: apps/ethlete-studio/src/app/components/studio-mark.component.ts (teal tile, other path) is
unused dead code - the B79 audit #5 even names it as the component to reuse. Why no tool caught it: no rule
checks that an embedded part's styles reach the page, and a var() fallback is valid CSS. Tool fix: B108
(rule UNUSED-PART-STYLES: a page or sketch renders a part and never returns its `.styles`; no visible colour
fallback in studio-mark.svg, so an unstyled embed looks plainly broken; delete the dead studio-mark component).
Lesson: a fallback that looks right hides a missing link; fall back to something obviously wrong or to nothing.
The variants are agent-drawn (finding 180), so the builder adds `menu.styles` to d/e/f directly.

180\. The grill session called the uncommitted pages/sketches variants "Tom's" and asked Tom for an OK to fix "his"
files (2026-11-02); decision 7 had the same wrong label. Tom never draws a sketch; agents do. Why no tool caught
it: nothing shows who drew a variant, so "uncommitted" was read as "the user's". Tool fix: B109 (the sketch
record names the drawing agent or session per variant; Studio and `et design sketch` show it). Lesson: name an
owner only from a record, never from where a file sits.

- Impl Q-C chip action coverage (grill, 2026-11-02, tool internal): the chip declares its action only in `part`,
  `points-closed` and their ring states; no extra states for fit or nothing-open.

- Impl Q40 canvas-viewport demo cards (Tom, 2026-11-01): keep the sample cards in the slot that compare empties;
  Studio shows them as the demo.
- Impl Q41 zoom-chip titles (Tom, 2026-11-01): German `title` tooltips, in Tom's collected round. Studio must not stay
  German-only: i18n comes later, so UI text should be ready for translation, not hardcoded per language. Finding 13.
- Impl Q42 tree aria text (Tom, 2026-11-01): `TreeRowItemComponent` hardcodes English aria text ("Sketch in
  progress", "N open comments"). Now, in a small builder slice: German text through one central label map, the first
  i18n seam for Studio (finding 13); a later translation plugs in there without component changes.
- Impl Q43 dead tree badges (Tom, 2026-11-01): `treeOf` still computes the dropped badges; delete that code after
  Tom's collected round, not now.
- Impl Q44 project row states (Tom, 2026-11-01): shell-project-switch's `project` control is now a `select`, which
  needs `project.option-hover`, `option-focus-visible` and `option-selected`. Draw the 3 states with the menu mock's
  forced rows; go `--by tom`.
- Impl Q45 accept by the builder (Tom, 2026-11-01) - replaced by Impl Q119: same rule as Impl Q15 for the go. When Tom approves a concrete
  design change in the chat, the builder may run `design accept` for it, always `--by tom` (not the model name), and
  names the decision. A new design Tom accepts himself. The Impl Q44 accept stays.
- Impl Q46 shared label map in verify (Tom, 2026-11-01): `task --verify` allows `apps/ethlete-studio/src/app/i18n/**`
  in a part commit, because the central label map is shared by all parts. Finding 17.
- Impl Q47 canvas-frames size (Tom, 2026-11-01): the size comes from a `class` prop, as Impl Q31; go `--by tom`.
  Second case of finding 4: lesson candidate, a check flags a part that takes its size from slot content.
- Impl Q48 canvas-frames sample grid (Tom, 2026-11-01): keep the sample button grid in `slot('frames')` (picture
  byte-identical, same rule as Impl Q31/Q40).
- Impl Q49 tree-row ARIA (Tom, 2026-11-01): the tree-row design row gets `role="treeitem"`, `aria-level` and
  `aria-expanded` like the app row (no pixel change); go `--by tom`, then verify tree-row and part-tree again. No cli
  exception for role-less rows. Finding 19.
- Impl Q50 Tailwind source line in verify (Tom, 2026-11-01): `task --verify` allows a change to the `@source` lines
  of the app's `styles.css` in a part commit; the running cli slice (Impl Q46) builds it. The harness emitting the
  design classes itself goes to the backlog, after the MVP. Finding 20.
- Impl Q51 studio-menu pane corners (Tom, 2026-11-01): same one-line design fix as Impl Q13,
  `transform: translate3d(0,0,0)` on the studio-menu pane class in its design CSS; go `--by tom`. A shared compare rule
  for SDK pane corners goes to the backlog, after the MVP. Finding 23.
- Impl Q52 shell-project-switch open menu (Tom, 2026-11-01): the design draws the open menu like shell-main's
  project picker (Impl Q35): absolute above the trigger, `w-62` (248 px), same offset; go `--by tom`. The app does not
  change. The cli harness leaves room above the host for a part whose surface opens above, so the overlay does not
  flip. Finding 24.
- Impl Q53 compare slots on pages (Tom, 2026-11-01): compare empties only the slots the compared part declares itself,
  never the slots of embedded parts; for `pages/*` it empties nothing. cli fix with a changeset and a test that fails
  without it. Until then a page 0 px is no proof. Finding 27.
- Impl Q54 sketches and merge pages (Tom, 2026-11-01): build presentational parts `design-parts/sketches/` and
  `design-parts/merge/` (data in, events out) that reuse the ready parts, as for start and inbox; re-point both
  `implements` links, go `--by tom`; live swap later. Finding 28.
- Impl Q55 features the design drops (Tom, 2026-11-01): reject/reopen, notes and diff lists are out of the MVP. The new
  parts do not build them, and the live swap does not need to keep them. They come back after the full MVP is
  implemented (backlog). Keep the MVP strict, no scope growth. Finding 28.
- Impl Q56 inventory frame (Tom, 2026-11-01): the inventory design draws a plain placeholder box for the frame in place
  of the `embedPage('pages/flows')` iframe; go `--by tom`. The app does not embed the flows view. Finding 29.
- Impl Q57 frames on a page canvas (Tom, 2026-11-01): every frame on a page's canvas (an embedded page or a part state;
  sketch variants, merge Now/After shots, flows graph frames, system state grids) is the page's own `slot('shot')`.
  Compare empties it on both sides; the live app fills it with `/frame.html` iframes as today. The content is covered
  by the part compares. One rule for system, sketches, merge and flows; design change, go `--by tom`. Inventory keeps
  its placeholder box (Impl Q56). Findings 29, 31.
- Impl Q58 page design text (Tom, 2026-11-01): the inventory, flows and sketches designs get German text, go
  `--by tom`; the app takes every text from `studio-labels.ts`. No hardcoded English in the app.
- Impl Q59 live canvas (Tom, 2026-11-01): the live `design-canvas` stays; it only gets the look of canvas-viewport and
  canvas-frames (focus ring, aria-label, shell inset). No rebuild on canvas-frames. Finding 31.
- Impl Q60 part-tree sections (Tom, 2026-11-01): the flattening without a section level is accepted for the MVP;
  sections go to the backlog. Finding 32.
- Impl Q61 pin count (Tom, 2026-11-01): the pin number is 1 + replies, so it counts all messages and matches the
  "N messages" label (changes Impl Q32).
- Impl Q62 question dot (Tom, 2026-11-01): the old accent dot for a waiting question goes away in the MVP; the inbox
  shows waiting questions. Finding 32.
- Impl Q63 shell-project-switch focus state (Tom, 2026-11-01): drop `open-focus-visible` (unreachable, the SDK menu
  keeps focus inside); `option-focus-visible` covers a focused row; go `--by tom`. Finding 33.
- Impl Q64 studio-menu row states (Tom, 2026-11-01): draw `option-hover`, `option-focus-visible` and `option-active`
  with the menu mock's forced rows as Impl Q44; go `--by tom`. Finding 33.
- Impl Q65 system open-points popover (Tom, 2026-11-01): the design takes the real anchored dialog position: pane
  10 px below the chip bottom, arrow centred under the chip; go `--by tom`. The app does not change. If `nothing-open`
  stays flaky after this, compare waits for overlay panes (cli). Finding 34.
- Impl Q66 flows live swap (Tom, 2026-11-01): strict swap; pins, notes, drafts and `jumpTo` on the flow canvas drop
  for the MVP (backlog), as Impl Q55. Finding 39.
- Impl Q67 system live swap (Tom, 2026-11-01): swap only the empty state; the live design-canvas stays (Impl Q59); the
  open-points chip stays out until live open-points data exists.
- Impl Q68 start in the app (Tom, 2026-11-01): when the repo has no products, the app renders the start part in place
  of shell-main; with no repo the checkout picker stays.
- Impl Q69 merge error (Tom, 2026-11-01): the merge design gets one error line under the Merge button (for example the
  needs-rebase refusal); go `--by tom`. Finding 39.
- Impl Q70 Verwerfen (Tom, 2026-11-01): one click as drawn for the MVP (git keeps the sketch history); a confirm goes
  to the backlog. Finding 39.
- Impl Q71 German text everywhere (Tom, 2026-11-01): Impl Q58 covers merge and every other page; go `--by tom`.
- Impl Q72 merge unchanged rows (Tom, 2026-11-01): the merge part shows the first part only for the MVP; several parts
  go to the backlog. Finding 39.
- Impl Q73 inbox frames (Tom, 2026-11-01): Impl Q57 covers pages/inbox (canvas content in `slot('canvas')` as flows);
  go `--by tom`. Finding 38.
- Impl Q74 wide flows (Tom, 2026-11-01): the flows canvas gets the same camera as the sketch `design-canvas`: pan by
  wheel and space-drag, zoom with the zoom-chip. A flow starts at zoom 1 with its first frame at the left edge. No
  fit-to-width scaling (a 10-page flow would be unreadable). The design does not show it, so go `--by tom`.
- Impl Q75 phone frames (Tom, 2026-11-01): the fixed 16:10 frame box that clips a 390x844 page stays for the MVP; a
  per-preset box ratio goes to the backlog.
- Impl Q76 verify of live swaps (Tom, 2026-11-01): `task --verify` also allows the app files that import the part (the
  tool finds them); every other file outside the part stays refused. CLI change. Until then pages/system keeps its
  earlier ready; flows gets a real part-only commit with the Impl Q74 camera work. Finding 40.
- Impl Q77 checkerboard compare (Tom, 2026-11-01): part compare shoots design and part over the same visible
  checkerboard instead of a transparent background, so any fill a part adds shows as a pixel diff. CLI change, build
  now. Finding 43.
- Impl Q78 live page compare (Tom, 2026-11-01): in the MVP, after Impl Q77. One compare per product page (system,
  flows, sketches and the other live pages) shoots the real app page against the page design, with the slots filled
  by a fixed sample, so hand-written live components inside a page (for example `design-canvas`) are covered.
  Each live-page compare uses a fixed camera with a sample frame that crosses the panel edge, panel open, plus a
  panel-hidden state, so a clipped canvas shows as missing pixels. Finding 44.
  Canvas states also run the zoom-chip Fit and 100 % with the panel open. Finding 48.
  Finding 43.
  As built (2026-11-01, in progress): spec `apps/ethlete-studio/design-live.json`, canned answers in
  `apps/ethlete-studio/design-live/` (products studio/timetrack/docs; studio has colors, button, form-field, select,
  shell-main, system), wired as `harness.live`. `pages/system` states: `part` (camera 300/48 at 100 %), `edge` (camera
  and design pan shifted 323 px, so the frame crosses the rail-panel gap), `zoom-100` (camera 50 %, then the "Auf
  100 % zoomen" click). Results (system, 2026-11-01): part 301765 px, edge 303639 px, zoom-100 303803 px. The CLI
  now waits for network idle before the shot (ea3a419c4); before, it shot an empty canvas. Open: the frame contents
  differ by design (the design slot draws a 3-row "Save" grid, the app the real button grid), so no state can reach
  0 px and the edge bite only shows in the total (control 260376 px, without `-ms-(--st-shell-inset-left)` 294588 px),
  not in the gap itself; the sample frame content must be the same on both sides first. Panel-hidden needs the CLI to
  compose the shell-main hidden state (Impl Q85). Sketches, flows, inbox, inventory, merge, start have no live states
  yet.
  Slice 3 (27f892400, 1afacf832): the spec's `frame` PNG (`design-live/frame.png`, 640x360) fills the page design's
  own slots and answers the app's `/__design/shot` and `frame.html`; the sample button is one `default` state at width
  640, so both sides draw the same frame. A state's `compose` merges props into a part the page design renders
  (`elements/shell-main` `panel: hidden`); a page or state overrides `host`, `answers` and `invoke`. Results on one
  app build (2026-11-01): system part 158525, edge 158022, zoom-100 349121, panel-hidden 148130 px (camera x 40);
  flows empty 0 px; start no-products 46080 px (only the legacy footer bar), no-repo fails (the app shows the shell,
  not the start page, without a checkout); inbox all-clear 365785; sketches fit 196541; inventory open 501882 px.
  Bite proof: dropping `-ms-(--st-shell-inset-left)` in a scratch build turns the rail-panel gap (x 64-76) of the
  system edge state from 0 to 4320 red px, all of it. Open: the live system page has no open-points chip (only the
  harness `SystemPageComponent` draws it), so canned comments cannot reach it; system has no Fit design state;
  sketches has no 100 % design state; flows `flow`, merge and the inbox states with comments need canned flows,
  merge mode and comments.
  Slice 4 (6d3588e6f, c37c574b4): the spec's `now` fixes the app clock (UTC), so relative comment times draw the
  same on every run; the shot waits for a drawn host before it sizes the viewport (merge swapped the host and measured
  0x0). New states: merge `open` (sketch with a pick, `sketchViews.merge` seeded, canned sketch-preview and
  sketch-compare), flows `flow` (canned flow "Sketch prüfen"), inbox `open`, `with-resolved`, `active-only`,
  `active-clear` (canned comments); the sketches sample carries the round title and variant notes
  (`rounds[].title`, `variantInfo.<v>.note`). Results on one build of 50dc56256 (2026-11-01): system part 143644,
  edge 143141, zoom-100 334261, panel-hidden 143644; flows empty 0, flow 145138; inbox all-clear 360712, open 389248,
  with-resolved 389758, active-only 382406, active-clear 367554; start no-products 46080, no-repo FAILED; sketches fit
  197931; inventory open 501029; merge open 82854 px. The run must start in a checkout folder named like the real one,
  or the project name in the side panel foot differs. Causes: no-repo needs the app's `startPage` to show the no-repo
  page when no checkout is chosen (today it needs a port; studio-view never reads the server without a checkout);
  inventory compares the app's real pages/system inventory with the design's pages/flows sample (canvas 453k of the
  502k px), so it needs `systemEntry: pages/flows` and a canned `/__design/inventory` first.
- Impl Q79 action check (Tom, 2026-11-01): in the MVP, after Impl Q78, shell parts first. Every interactive element
  in a part or page design declares its action: a target state (`data-et-action="collapsed"`) or an output
  (`data-et-action="emit:pick"`). `design actions <part>` mounts the part, clicks and presses Enter and Space on each one, and
  fails when the state does not compare 0 px, the output does not fire, or an app element has no declared action.
  `design complete` refuses a design with an undeclared interactive element. The same clicks also run on the real
  pages of the Impl Q78 compare, where the page must reach the declared page state (for example sidebar hidden),
  because the active nav defect sat in the app wiring, not in the part. Each overlay opens once by click and once
  by key, and each result compares to its declared state (the click state has no focus ring). Findings 42, 45, 47.
- Impl Q80 SDK runtime errors (Tom, 2026-11-01): the part harness, the Impl Q78 live-page compare and the Studio
- Impl Q79 addition (2026-11-01): action sequences (for example pan, then pick a flow) compare their final frame, and
  a key whose default the app prevents on an interactive element fails the check. Findings 47, 48.
  As built (2026-11-01), slice 1: `node dist/libs/cli/src/index.js design actions <layer>/<name> --product studio
[--state <s>] [--url <dev server>]` mounts each state in the harness, clicks and presses Enter and Space on every
  interactive element and compares the result. `data-et-action` is a state name (`collapsed`) or `emit:<output>`; for a
  key press the check compares the declared state's `<state>-focus-visible` row when the part draws one. The harness
  records outputs on `window.__etDesignEmits`. `design complete` fails with `ACTION-UNDECLARED` for an interactive
  element without the attribute, for every product. Only the one-step opener is supported as a sequence. Results:
  shell-collapse, disclosure, zoom-chip pass; tree-row fails 13 of 13 (design declares no `data-et-action`);
  part-tree fails 14 of 42 (Space fires no output); shell-project-switch fails 15 of 33 and shell-main 19 of 249
  (project switch does not reach the declared state; its keydown default is prevented).
- Flow pick camera (2026-11-01): a flow pick resets the camera to the opening view of Impl Q74 (100 %, first frame at
  the panel edge). Impl Q74 already decides this; no new question.
  vitest setup fail on any console error with an `ET\d+` code. Other console errors stay allowed. Finding 46.
- Impl Q81 legacy chrome (Tom, 2026-11-01): remove from every live page each element that no page design shows (chat,
  notes, top-right buttons, footer bar, and the rest of the builder's per-page list). The MVP is exactly the design;
  Impl Q78 keeps it so. Anything Tom wants back goes to the backlog and gets a design first. Exception: an element
  that is the only way to an important function (for example a design server restart) goes to Tom one by one before
  it is removed. Finding 49.
- Impl Q82 ready needs working controls (Tom, 2026-11-01): the Impl Q79 action check is a gate for ready. A part or
  page with interactive elements is ready only when each one declares an action and the check passes, on the real
  page too. Every current ready mark is reset until its part passes; the DONE number counts only those. Finding 51.
- Impl Q83 studio menu (Tom, 2026-11-01): the five entries (Einstellungen, Erscheinungsbild, Tastenkürzel, Hilfe,
  Über Studio) have no target design and leave design and app; backlog, design first. With the menu empty, the logo
  menu goes to the backlog too: the rail logo is the plain Studio mark on every page (the shell-main standalone
  preview already draws it), not a button. Finding 51 and 50.
- Impl Q84 frame label (Tom, 2026-11-01): the live canvas frame label shows the bare name as the design does
  (`button`), not the layer-qualified name; the layer shows as the group in the side tree.
- Impl Q85 panel states (Tom, 2026-11-01): no page design change. shell-main already draws panel open and panel
  hidden, and every page inherits it, so the Impl Q78 live-page compare takes the panel-hidden state from shell-main.
  The sample frame across the panel edge belongs to the compare's fixed sample, on both sides, not to a design.
- Impl Q86 demo backdrops (Tom, 2026-11-01): build a check that detects a demo background in a design (a wrapper
  outside the part root that paints a fill the part does not own) and refuses it in `design complete`; then fix
  what it flags, starting with shell-collapse and shell-project-switch. Finding 52.
- Impl Q87 design server (Tom, 2026-11-01): the "server stopped" screen with Restart stays and gets a design as a
  shell-main state. Start, Restart and Stop move into the logo menu. This changes Impl Q83: the logo stays a button
  on every page and opens the studio menu, which now holds only the server actions; the five old entries stay
  removed. Design change of studio-menu, go `--by tom`.
- Impl Q88 server status (Tom, 2026-11-01): the footer bar goes, with its status and diagnostics. What to do with
  that information is planned after the MVP.
- Impl Q89 open project (Tom, 2026-11-01): "Projekt öffnen…" opens the OS folder dialog; the footer checkouts popup
  goes; "Scan" to the backlog.
- Impl Q90 updates (Tom, 2026-11-01): a ready update installs on the next Studio start, no UI. A design pass for an
  update hint is planned after the MVP.
- Impl Q91 exceptions (Tom, 2026-11-01): the "Ausnahmen N" popover stays as it is; no new design now (that was scope
  creep). Design after the MVP.
- Impl Q92 legacy call view (Tom, 2026-11-01): stays as it is, with "Als übertragen markieren".
- Impl Q93 start logo (Tom, 2026-11-01): the Start page shows the plain Studio mark, no menu (no project, no server).
- Impl Q94 tree-row actions (Tom, 2026-11-01): a part whose interactive elements the embedding part owns is exempt
  from the action check; tree-row declares nothing, part-tree declares the actions.
- Impl Q95 project-switch keyboard open (Tom, 2026-11-01): new design state `open-focus-visible` (menu open, first
  option ringed); go `--by tom`.
- Impl Q96 actions for every product (Tom, 2026-11-01): ACTION-UNDECLARED stays for all products; each product
  declares its actions when its parts get worked on.
- Impl Q97 hide panel camera (Tom, 2026-11-01): the app keeps the frame in place when the panel hides; the compare
  uses its own sample camera for that state. No design change.
- Impl Q98 inbox canvas (Tom, 2026-11-01): the inbox design gets the system page's inset padding and zoom chip;
  go `--by tom`.
- Impl Q99 canvas zoom states (Tom, 2026-11-01): add `fit` to pages/system and `100 %` to pages/sketches, one-variant
  sketch each, so the Fit/100 % checks (finding 48) run on every canvas page; go `--by tom`.
- Impl Q100 inventory entry (Tom, 2026-11-01): the inventory toggle on the System parts stays as it is (the Impl Q81
  exception, as Impl Q91/Q92); no new design now, design after the MVP.
- Impl Q101 "All products" (Tom, 2026-11-01): remove the rail button from the shell-main design and the app; a target
  is planned after the MVP.
- Impl Q102 sdk menu keyboard background (Tom, 2026-11-01): the sdk components/menu mock draws the keyboard-active
  background on a forced focus-visible row (one-variant sketch); then verify and ready studio-menu. Finding 58.
- Impl Q103 inbox authors (Tom, 2026-11-01): the inbox shows the comment author's name from `git config user.name`,
  as the design does, not "Du".
- Impl Q104 canvas first open (Tom, 2026-11-01): the first open of a canvas uses the design's opening view (zoom 1,
  frames at panel edge + 40/48 px), the same as the 100 % button.
- Impl Q105 folder refusal (Tom, 2026-11-01): an error toast when the chosen folder has no design work, one design
  state. Strictly minimal: no other error cases, no error system. Finding 60.
- Impl Q106 live no-change check (Tom, 2026-11-01): Impl Q79 slice 2 (live pages) gets a before/after shot per press
  (focus ring masked) and flags "no visible change and no navigation", with a host stub that records native calls
  (dialog, updater). Finding 60.
- Impl Q107 shell backdrop go (Tom, 2026-11-01): accept + go `--by tom` for components/shell-collapse and
  components/shell-project-switch after the Impl Q86 backdrop removal (0987a5490). Finding 62.
- Impl Q108 studio-menu backdrop (Tom, 2026-11-01): drop the fill in the Impl Q87 redraw, in the design and the app
  host.
- Impl Q109 auto acceptance (Tom, 2026-11-01): when a part's hash changes, render every state; if each is
  pixel-identical to the picture at the last acceptance, write an `auto` acceptance for review and go (same rule as
  sketch merges, merged-parts.ts:154). Finding 62.
- Impl Q110 menu mock row attributes (Tom, 2026-11-01): the sdk menu mock keeps the row attributes (data-et-force),
  so the studio-menu option-* states compare for real. Finding 63.
- Impl Q111 shell-main at-rest force (Tom, 2026-11-01): remove `force` from the section/product/products rows at rest
  in the design. Finding 63.
- Impl Q112 transitive hash (Tom, 2026-11-01): the design hash covers transitive imports (reachableFilesOf);
  `task --verify` stores the app component's transitive imports in implemented.json; `design check` marks a
  ready/done part STALE and names the changed files. Together with Impl Q109. Finding 58.
- Impl Q113 go guard (Tom, 2026-11-01): `design go --by tom` needs a decision ref (`--note "Impl Qnn"`) and refuses
  when the design commit is newer than that decision. Finding 64.
- Impl Q114 auto go `by` (Tom, 2026-11-01): an auto go or acceptance (Impl Q109) keeps the previous `by` and adds
  `auto: true`.
  Done in c9c00eb98 (spec 104a3de8e).
- Impl Q115 decision ref vs later design (Tom, 2026-11-01): with Impl Q119, Tom's confirm is the proof. "Design newer
  than the decision" is no longer a refusal but a note in the confirm list (for example "design changed after Impl
  Q98 (5e554809b)"). `--note "Impl Qnn"` stays required. Changes Impl Q113. Finding 64. Done in b873da3ee.
- Impl Q116 import cycles (Tom, 2026-11-01): `import/no-cycle` (or madge --circular) as a lint error for libs/core
  now, and resolve its 24 cycles; libs/components (71 in-lib cycles) after the MVP. Finding 68. Done in 22890a960:
  24 -> 0 cycles; the check is a spec (libs/core/src/import-cycles.spec.ts) in `nx test core`, not
  import/no-cycle, because the repo has no eslint import plugin. Public exports unchanged (590 names).
- Impl Q117 shell-main surface (Tom, 2026-11-01): the shell-main drawing root (shell-main.ts:233) gets
  `data-et-surface`, because the app paints the same fill; the DEMO-BACKDROP exemption applies, no tool change. Do it
  before Tom's shell-main go. Finding 71.
  Done in 222c244eb, 39ee9ab05: complete.ts accepts a bare `data-et-surface` on the part root as the part's own
  surface; the shell-main root has the marker.
- Impl Q118 compare without go (Tom, 2026-11-01): `design compare` runs on a part changed since its go and marks the
  result "unapproved"; the go gate stays on `task --verify`, ready and accept. Finding 72. Done in 5c461eab7
  (builder: ready and accept never used the taskPartOf gate; compare has no JSON output yet).
- Impl Q119 Tom go needs Tom (Tom, 2026-11-01): `--by tom` (go and accept) needs a TTY confirm or a Studio click,
  which an agent cannot give. The builder writes a go list; Tom confirms it at once with
  `et design go --batch <file>`, one prompt for all entries. The builder no longer writes a chat-approved go itself
  (replaces Impl Q45). Finding 74. Done in b873da3ee: `Record this as Tom? [y/N]` at a TTY, refusal without one;
  `design go --batch <file>` takes a JSON array of {part, product, action go|accept, note, verify?}, checks all
  entries first, then one prompt. Batch file for Tom: .claude/handoffs/tom-go-batch.json (gitignored).
- Impl Q120 shell-main keyboard open (Tom, 2026-11-01): shell-main gets the `open-focus-visible` state, as Impl Q95.
  Done in 4f571660e under the name `project-picker-focus-visible`: `targetStateOf` maps a key press to
  `<target state>-focus-visible`, and the trigger's target in shell-main is `project-picker` (`open` there is the
  closed-picker state).
- Impl Q121 ready needs a current go (Tom, 2026-11-01): `markPartReady` refuses a part whose design changed since its
  go ("changed since its go - it needs a new go first"). `design accept` gets no go gate: accept approves a direct
  design edit before its go. Corrects Impl Q118. Finding 78.
- Impl Q122 "Aktuell" with only placeholders (Tom, 2026-11-01): when the visible rows of the "Aktuell" column hold
  no drawn frame, Studio opens the first folded unchanged row by default. No nearest-state reference frame.
  Finding 77.
- Impl Q123 Q119 details (Tom, 2026-11-01): keep as built. Uncommitted design files are a note in the confirm, not a
  refusal; `verify` is only shown; a single `accept --by tom` takes free text, only batch entries need "Impl Qnn".
- Impl Q124 duplicate matrix logic (Tom, 2026-11-01): keep the CLI copy (aktuell-placeholders.ts) until the MVP;
  after the MVP move the matrix into one module that app and CLI both import. Backlog.
- Impl Q125 one canvas (Tom, 2026-11-01): "das sollte ein und der selbe dynamische canvas component sein. alles andere
  wäre müll." System, Sketches and Flows use one and the same canvas component, not a shared input layer under two
  implementations. Left drag on an empty area pans on every page; a left click on a frame selects it. Arrow-key pan,
  double-click focus, Space/middle-button pan and window-wide Shift+1/2/0 work on every page. Finding 83.
  As built (builder, 2026-11-01): 70df9fec1 adds `yarn studio:e2e` (apps/ethlete-studio/e2e/canvas.e2e.mjs, real
  Studio, 7 input cases on System and Sketches: 9/14 before, 14/14 after). 00eecda8a makes `ethlete-design-canvas` the
  one canvas: Sketches projects its frames (`[ethleteCanvasFrame]`) and drops `mountCanvasViewport`. Compare 0 px:
  pages/sketches, pages/system, components/canvas-viewport, elements/canvas-frames, pages/flows. Not verified: wheel,
  Escape, Shift+2/0, the desktop app; zoom-chip compare blocked by a harness limit. Flows still uses
  `mountCanvasViewport` (parked until after MVP).
- Impl Q126 Sketches selection mark (Tom, 2026-11-01): a selected frame in Sketches shows the same selection outline
  as System, from the one canvas component (no second outline implementation).
  Done in d7451f821 (one `canvas-frame-border` for System and Sketches, e2e 31/31) with finding 96 (8ed75e200).
- Impl Q127 tree text size (Tom, 2026-11-01): tree rows (components/tree-row) go from 11 px (`1.1rem`) to 13 px
  (`1.3rem`), the size of the open-points popup and menu items; the row height grows with it. Design change, so Tom
  gives a new go on components/tree-row (and on parts that embed it if their go goes stale).
- Impl Q128 sketch view button label (Tom, 2026-11-01): the button above each variant in the sketch view says
  "Wählen", not "Merge" - it only opens the merge view, which then shows "Gewählt a". The final button in the merge
  view stays "Merge".
- Impl Q129 inbox row click (Tom, 2026-11-01, finding 102): a click on an inbox comment row (or Enter/Space on it)
  selects the comment and opens its place on the inbox canvas: the frame of its part and state, with its pin. For a
  comment on another part, the canvas switches to that part first. In the MVP: the pages/inbox design gets a row
  action, so Tom gives a new go on pages/inbox.
- Impl Q130 one Studio menu look (Tom, 2026-11-01, finding 103): every Studio menu uses the studio-menu values
  (`--et-menu-item-height: var(--control-md)`, `--et-menu-item-font-size: var(--text-md)`), set once for all Studio
  menus, not per part; the per-part override in studio-menu goes away. Tom gives a new go on elements/studio-menu and
  components/shell-project-switch.
- Impl Q131 merge view added state (Tom, 2026-11-01, finding 104): when a variant adds a state, the empty "Jetzt"
  panel shows a short centered text "Neu in a" (the variant letter).
- Impl Q132 merge button loading (Tom, 2026-11-01, finding 106): while the merge runs, the Merge button shows the
  SDK button loading state (spinner, no second click). The pages/merge design gets a `merging` state.
- Impl Q133 resizable sidebar (Tom, 2026-11-01): the user can drag the sidebar width (handle on its edge, min and
  max width, a dragging state). After MVP: on the backlog, not built now.
- Impl Q134 start empty state (Tom, 2026-11-01): the empty bordered box (`ghostFolder`) above "Kein Repo geöffnet" on
  pages/start goes away in design and app; title, text and the "Repo öffnen" button stay. Then Tom accepts the
  direct edit and gives the go on pages/start.
- Impl Q135 Sketches camera on panel toggle (Tom, 2026-11-01, finding 100 follow-up): when the panel hides or shows,
  the Sketches camera shifts by the panel width so the frames keep their screen position, as in System and Flow
  (canvas-level adjustment when the host's left edge moves). Tom could not try it (no open sketch), so the e2e case
  is the proof.

### Exit the fix loop decisions (Tom, 2026-11-01)

Tom: the find-error-fix loop runs for days; he wants out, and he is not always there to approve things.

1. The MVP goal is a short list of user flows, not "every part merged and ready". The flow list and its state live in
   plans/ethlete-studio/STATUS.md (draft of 7 flows; Tom corrects it). A flow is done when its click test passes.
2. No new process tooling until the MVP: no new gates, flags or go rules. Ideas go to the backlog. Build only what
   repairs a flow.
3. Fix the root cause once (finding 85): one implementation per thing (one canvas, one picker, no copies), in one
   cleanup pass.
4. Every flow gets a Playwright test that clicks the real Studio. A defect Tom finds becomes a test first, then a fix.
5. The builder never waits for Tom: Tom's approvals do not block work; one flow at a time. When Tom is there he gets a
   short round: what works now, at most 3 questions.
6. Flows and inventory are out until the MVP (Tom, 2026-11-01): "es macht keinen sinn an extra features wie flows zu
   arbeiten wenn die basis mist ist"; the inventory gets reworked anyway (see plan). No work on pages/flows or
   pages/inventory; the one canvas covers System and Sketches (Flows follows later through the same component).

### Title bar, search and activity decisions (Tom, 2026-11-01)

After the MVP. Not part of the 17-part goal.

1. Studio gets its own title bar instead of the OS default. Windows and Linux: Studio draws the drag region and the
   window buttons (Tauri `decorations: false`). macOS keeps the native traffic lights (overlay title bar style).
2. The centre of the title bar holds a search field like the VS Code command center. A click on it or Ctrl+K opens the
   `command-palette` from `libs/components`. It finds parts, sketches and commands (for example "Go geben").
3. The project switch stays in the sidebar. The only other title bar item is an "Update" button, shown only when an
   update is ready to install.
4. Activity (render, merge) shows only in the view the user waits on, for example the merge loading state. No spinner in
   tree rows ("dann wird der tree so unruhig"), no global indicator. A global indicator comes only once Studio does
   background work the user did not start.

### Handoff restart decisions (Tom, 2026-11-01)

Cause: at 85 % context the builder had about 9 background agents running, one for over 40 minutes. The handoff skill
forbids a restart while a sub-agent runs, so the builder stood still. Change the handoff skill
(`.agents/skills/handoff/SKILL.md`), for every session:

1. From 70 % (handoff mode on) start no new sub-agent. Running ones finish in peace.
2. At 85 % stop only a sub-agent that surely hangs: no new step for more than 30 minutes. Write its remaining work into
   the handoff file; the fresh session starts it again. Never stop a working agent ("a mit stoppen klingt zu aggro").
3. A restart waits only for sub-agents whose answer the session needs for its next step (Tom: some agents write their
   result another way). At spawn time the session decides: answer needed, or the agent writes its own result. A
   self-reporting agent commits its slice and writes its result to `.claude/handoffs/agent-results/<name>.md`. The
   handoff file names these agents and their result files; the restart then starts at once. Rule 2 still applies to the
   agents whose answer the session waits for.
4. First check whether a background sub-agent keeps running after `/clear`. If it dies, rule 3 does not apply and only
   rules 1 and 2 hold.

### Sidebar header and switch decisions (Tom, 2026-11-01)

After the MVP, except item 5.

1. Repo switch and "Projekt öffnen" move into the logo menu (elements/studio-menu).
2. The design system select (for example `studio`, `sdk`, `studio-lab` in ethlete-sdk) replaces the static name in the
   sidebar header. The repo select at the sidebar bottom (`components/shell-project-switch`) goes away.
3. The select sits left in the header and looks like the current name with a small chevron when closed. The collapse
   button stays right.
4. The quick switch of recent design systems at the rail bottom stays. Each button shows the system logo (for example
   `studio/foundations/logo`); without a logo, two letters that make the system unique (for example "St", "Sd", "SL"),
   never the same single letter for all. A tooltip shows the full name.
5. MVP, pages/inbox: a resolved comment shows its pin after a click in the inbox, muted and with a check mark, so the
   click always shows a place.

### Project switch focus row decision (Tom, 2026-11-01)

- components/shell-project-switch `project.option-focus-visible`: the design draws the row fill together with the focus
  ring, like the SDK menu on a keyboard-focused row and like the design's own `open-focus-visible`. No app override of
  the SDK menu CSS.

### One-click accept and go decision (Tom, 2026-11-01)

MVP, pulled forward from finding 109 ("dieser prozess ist so beknackt"). When a part view has both steps open (a direct
edit to accept and a go to give), it shows one primary button "Abnehmen und Go" that writes `accepted.json` and
`go.json` in one click. When only one step is open, the view keeps the single button it has now. The full go rework stays
after the MVP.

### System fit state decision (Tom, 2026-11-01)

- pages/system `fit` (finding 120): the design gives the fit frame a fixed body size (like many-states `w-md`) and reads
  the panel inset from `--st-shell-inset-left`, so the fitted frame sits centred in the visible canvas area, clear of
  the side panel, like the real System canvas. Re-check the app fit x after the design fix. pages/system then needs
  accept + go.

### Go order and stale go decisions (Tom, 2026-11-01)

Tom: "builder baut was, ich nicke es ab, builder macht checks, checks failen, ich muss fragen beantworten, builder baut
was, ... viel zu optimieren". Tonight pages/inbox, elements/shell-main and pages/merge each needed a second go after
checks failed post-go.

1. Go last (rule, now): the builder runs `design check`, `design actions` and compare for the part and gets them green
   (or names each remaining fail as a known tool defect) BEFORE it sends the grill a shot for Tom's go. `ready` runs
   right after the go. After the MVP, a tool gate: Studio shows "Go geben" only when the part's checks are green, else
   it lists what is missing.
2. Invisible changes keep the go (tool change, MVP): a design change that changes no pixel in any existing state (for
   example a `data-et-action`, an app-only text) does not make the go stale, like the existing "merged automatically:
   no visible change" accept. A new state that only combines known looks (for example `open` plus the focus ring) goes
   into Tom's next review round but does not block the part.

### CLI speed decision (Tom, 2026-11-02)

Q16, from finding 126:

1. Now, in the MVP: run the action checks in parallel (actions-command.ts, with the limit of the draw queue in
   thumb.ts), and replace the fixed 400 ms emit wait in action-press.ts with a condition. Both are general tool
   changes, test first.
2. After the MVP: stop rebuilding the harness app on every command (harness-server.ts).

### Sketch in context decisions (Tom, 2026-11-02)

- A generic feature of the design tool, for every product, not a Studio special: a sketch can be seen in the context
  of the existing design. Tom: "einen Sketch im Kontext von bestehendem Design sehen sehe ich als generell wichtig an".
- The sketch view gets a toggle "Einzeln | Im Kontext", default "Einzeln"; it applies to all variants at once. "Im
  Kontext" renders each variant in its real place inside the enclosing existing design (for components/title-bar:
  the shell), the other parts at their current state.
- A part used in several places: the first place is shown, a picker offers the others.
- `sketch check` also renders each variant in its context and reports fit problems (height, overlap) (grill, tool
  internal).
- Visible UI: the builder sketches the sketch view with the toggle first, Tom picks, then it is built.

### Visible change gate and no-memory decisions (Tom, 2026-11-02)

- B48 is a gate in `@ethlete/cli` (part of the design check every product runs, locally and in CI), not a hook of
  this repo; our pre-push only calls it. It renders each part's states at the merge base and at HEAD and compares
  them. A part that looks different fails unless a picked or merged sketch of that part is in the pushed range.
  Exception: a change that measurably moves the app closer to the part's existing design (the live compare against
  the design part shows less deviation than before) passes without a sketch. Invisible changes always pass.
- Rules for agents live in the shipped skills from libs/agent-rules, never in agent memory or gitignored handoff
  files: "visible UI only with a picked sketch" goes into the design skill; "decide technical questions yourself,
  put only product and UX questions to the user" goes into the grilling skill. Then the doc agent deletes its two
  memory notes on these rules.
- Agent memory is off-limits for this work (Tom: "memory hilft mir aber allen anderen usern absolut gar nicht"). A
  lesson an agent learns becomes a finding with a tool fix; the doc-agent and builder-agent skills say so.

### Title bar and refused-action decisions (Tom, 2026-11-02)

- components/title-bar: Tom picks variant C (32 px wide field "studio / Title Bar", filled brand Update). The merge
  from Studio failed and nothing was picked; it is retried only after the builder knows the cause.
- A refused decide action (pick, discard) shows an error next to the decide controls, with the CLI's reason. It
  reuses the merge bar's `[error]` pattern and `refusalMessageOf`; no new design, no sketch needed.

### Pick and merge decisions (Tom, 2026-11-02)

- One button per variant, "Übernehmen", replaces "Wählen". It opens the existing merge screen directly; that screen
  is the confirmation (changed states, then merge). Cancelling it leaves nothing picked. The state "picked but not
  merged" disappears from Studio; the CLI's pick becomes part of the merge, not a separate user step.
- No undo after a merge: a merge is final. A later change of mind is the agent's job (a new sketch or a fix), not a
  Studio button.
- The sketch-view sketch (finding 148) is drawn on this flow.

### Title bar implementation decisions (Tom, 2026-11-02)

- The go for components/title-bar after the `implements` link: Tom grants it himself in Studio (granted). An agent
  never grants a go in Tom's name; the auto-mode classifier blocks it anyway.
- The search button "studio / Part" ships now and does nothing on click until the command palette (A2) exists.
- The macOS states draw the traffic-light window controls as demo content on the left, in a slot that compare
  empties (the OS draws the real ones). Today the left side of `macos` and `macos-update` is empty, so the state
  does not read as macOS. Visible design change: it needs a new go from Tom.
- The macOS traffic lights are three neutral grey dots (like an inactive macOS window): no new token, no asset.
- The Update button restarts and installs via a host command, after a confirm dialog: "Update auf v<version>
  installieren? Studio startet dafür neu." with "Neu starten" and "Später"; "Später" only closes the dialog, the
  button stays. The dialog is new visible surface and gets its own small sketch.
- The title bar ends at the bottom with a 1 px border in the theme's border colour; the background stays the
  same (finding 157).
- Technical (grill): os/left/right/update become app inputs; the layout follows the design (grid h-8, 1fr | auto |
  1fr), not the app's flex h-9.

### Title bar search and gate decisions (2026-11-02)

- Search field text (Tom): placeholder, search icon and kbd take the full surface text colour on hover, pressed and
  focus-visible; at rest they stay muted. No contrast exception.
- The search field becomes its own control part (Tom's feedback, finding 163); the title bar embeds it and draws no
  states of it. Its states and the contrast fix live in the new part.
- Go withdrawal (B70) is parked: the go system will be reworked; the rework must include withdrawing a go. Until
  then a wrong go is not removed: a redraw makes it stale, and Tom's next go replaces it. Tom edits no files
  (finding 82); asking him to edit go.json was wrong.
- Technical (grill): the pre-push visible-change gate fails when a selected part has any unjudged state; listing
  them is not enough (a gate that passed after judging nothing, builder 2026-11-02).

### Update dialog and merge commit decisions (Tom, 2026-11-02)

- The update confirm is variant b of the update-dialog sketch: an SDK anchored dialog under the Update button with an
  arrow, no scrim; the question bold, "Studio startet dafür neu." muted below, xs buttons right ("Später" outline,
  "Neu starten" filled). Tom merged it.
- The dialog shows the version without build metadata: everything from `+` on is dropped
  (`v0.42.0-next.137+build...` shows as `v0.42.0-next.137`).
- The builder commits Tom's title-bar merge once, together with its follow-up edits and the new
  components/title-search part (the merge content is no longer separable): exactly components/title-bar/,
  components/title-search/, the four icons close, maximize, minimize, search, and those parts' merged.json and
  pictures.json lines, as one "chore(repo): Merge ..." commit, after both parts check clean; never go.json. A commit
  is no go: Tom grants both gos in Studio afterwards.
- The builder commits Tom's update-dialog merge (variant b) once, exactly its paths and lines; never go.json.
- Title search long label (Tom): the product name always stays whole; the part name truncates at the end with an
  ellipsis, and the label then aligns left instead of centring. Visible change to title-search before Tom's go; the
  builder may commit it as a follow-up to the merge commit (same paths, never go.json).
- The title bar belongs to the shell (finding 168): elements/shell-main embeds components/title-bar at the top over
  the full window width, above the rail too; the Studio mark stays at the top of the rail. The app moves the title
  bar from app.component.ts into the shell component. Visible change to shell-main: it needs Tom's go.

### Sketch view states decision (Tom, 2026-11-02)

- pages/sketches round 2: variant e. Each variant row stacks all its states; unchanged states dimmed, the first
  changed state marked "erste Änderung". Rows pan with the canvas, no inner scrollbar. Open: the cut at the window
  edge (finding 167).

### Post-MVP tool fixes (builder, 2026-11-02, in progress)

In progress, five parallel subagents, one per fix: (1) `task --verify` runs the actions check (findings 123/127);
(2) an embedded-part change marks the embedding parts "actions need a re-run" in `check` and `ready` (finding 130);
(3) "reaches state X instead" on an actions miss (finding 131); (4) OCCLUDED check and compare waits for the overlay
enter animations (finding 129); (5) harness build cache (Q16 item 2).

### Builder wave (2026-11-02, in progress)

Merges committed: 9fe0b8a41 (title bar + title search + icons), f31a7febb (update dialog). In progress, parallel
subagents, one per slice: causes of findings 166 and 167; B65 go auto-carry with slots drawn; B72 CONTROL-STATE;
B66 harness host width; B75 identical-renders first changed state; `--et-kbd-color`; B77 background-only hook;
zoom-chip `target` only in interaction rows.

### Rule audit decisions (2026-11-02)

From the B79 audit (.claude/handoffs/agent-results/b79-rule-audit.md: 100 rules, 17 enforced, 22 partly, 61 prose
only). Technical gaps became B84-B98 in STATUS.md.

1. Push: the builder may push `next` without asking when pre-push is green. Recorded in the builder-agent skill; a
   hook allows push only to `next`.
2. Freezes lifted: the design freeze (Q253/Q254), "no new process tooling until the MVP" and "no work on pages/flows
   or pages/inventory until the MVP" existed to finish the MVP, which is done.
3. Judgment rules: rules no tool can check go into one short list, each with one sentence why no tool fits. Every
   other rule needs a hook, check or refusal.
4. Claude config: the settings.json hook entries of B77 (background design commands) and B87 (git safety) are
   approved by Tom; each new settings.json change needs its own approval.
5. Sketches view has no selection: click and pan select nothing and draw no outline; Shift+2 fits the frame nearest
   the view centre (B97). The outline Tom saw came from a window refocus (finding 158).
6. pages/inbox sidebar declares its scroll instead of shortening demo data (B98).
7. Uncommitted sketch variants may be edited by the builder for mechanical fixes that change no pixels, proven by
   before/after shots; the builder does not commit them. Correction (Tom, 2026-11-02): these variants were drawn by
   agents, not by Tom - Tom never builds a sketch himself (finding 180).
8. Nested parts (A36): a part that belongs to a host lives under it in its path (`components/title-bar/title-search`)
   and in the explorer; the check refuses it outside its host; shared parts (button, kbd) stay on their layer. In
   the go rework (A10, "build-ready" replaces go) a nested part is build-ready on its own, and a host is build-ready
   only when its nested parts are. Tom noted the go question belongs to the go rework, not to a separate decision
   (B83 extended: a question touching a system under planned rework goes into that item).
9. Builder chat length (finding 175): no blocking hook (it burns tokens on rewrites). The agent-sessions `run`
   command gets a role flag (`run claude --role builder`) that starts Claude with `--append-system-prompt`: "The user
   does not read this chat. Write no text between tool calls; end each turn with at most one line. Reports go to the
   grill session via SendMessage." Plus a non-blocking Stop hook that only logs the chat words per turn of a builder
   session, so the grill session can report whether the rule works; Tom approved its settings.json entry.
10. Interaction rows for embedded parts (Tom): the "States by interaction" grid draws a state row for a marked element
    only when the part styles it itself (own classes or overrides on it). A marked but unchanged embedded part (the
    two et-buttons in update-dialog) keeps its action, gets no state row, and its states live in its own part. The
    tool decides from the markup; no author rule (B106).
11. Own controls found by CONTROL-STATE (Tom): zoom-chip `reset`, shell-main `section` and shell-main `product` each
    get a sketch with two variants, the unchanged SDK button and a new own control part; Tom picks and merges.
12. Priority (Tom, 2026-11-02 11:00): the Sketches view (pages/sketches r2, variant e: B34, B36, B38, B84, A13) goes
    first. Two hours went into side fixes. In-flight slices only end in a committable state; new tool fixes and
    findings get recorded but not built unless they block the Sketches view.

#### Judgment rules (decision 3)

Rules from the B79 audit that no hook, check or refusal can test. Each stays prose, with the reason no tool fits.

- #46 A wireframe is rough (regions only): "too polished" is a visual judgment; `flow.ts` and
  `kit-outside-pages.ts` already catch the structural part (one sketch per screen, no kit outside pages).
- #51 A reference informs, it is not a template: telling inspiration from copying needs the reference and taste;
  no diff metric separates the two.
- #61 Doc agent writes German to Tom, English to the builder and plans: a language check on chat output would
  misfire on code, paths and quoted English, and the cost of a slip is low.
- #64 Never answer a design question for the user: whether an answer is a design decision or a technical one is the
  judgment itself (see #94).
- #65 While afk, collect questions and sound only when blocked: "afk" and "blocking" are states only the agent
  knows from the conversation.
- #69 Write a handoff only when work is left: the hook can see the tree, but not an unrecorded decision or an
  unfinished step of the user's task.
- #94 Decide technical questions yourself, ask only product/UX: the split between technical and product is the
  judgment; the B83 rule (name the owning part, check for a planned rework) narrows it but cannot decide it.

Not judgment rules, so they get a tool (B100): #47 stage order, #48 one open call and word limit, #58 slice plan
notes, #63 grill round format, #93 comment allowlist. Lifted or moved, so no tool: #84, #85, #86 (freezes lifted,
decision 2), #91 (go rework, A10).

181\. pages/sketches variant e was reported "ready" (check green) while its content is clipped at the bottom (Tom,
2026-11-02): rail repo selector, note text and the last canvas frame end cut off at the viewport edge. Lesson:
`ready` checks pixels against siblings and structure, not overflow; a clipped page passes. Tool fix (cause
pending from builder): a sketch check that fails when content ends past the viewport bottom or a non-scrolling
container has scrollHeight > clientHeight, at every reference size. Also: the grill session relayed "ready" to
Tom without looking at the shot - relay only after a shot was opened.
Cause (builder): the rows column `[data-sk-rows]` is an overflow-hidden box panned only by wheel/drag, with no
scroll cue; camera "fit" fits width only, so lower rows always fall below the edge. The check passed because the
sketch itself sets `data-et-skip="CLIPPED"` on the column, the content root and every fit frame, and CLIPPED is
escapable (render-check.ts:127). Tool fix (decided, technical): new rule HIDDEN-CONTENT - a container whose
content runs past its bottom edge with no visible scroll affordance fails at every reference size and cannot be
skipped; a CLIPPED skip covers only horizontal or decorative cuts. The page fix (scroll area / fade cue / fit
height) is Tom's pick.

182\. Tom had to repeat that the sketch must keep the real app's layout (2026-11-02): in the real app the canvas runs
to the window's bottom edge, rows are panned on a free canvas and the zoom chip floats bottom right; variant e
wraps the rows in a bordered box that ends early (`bottom-space-5`), so content looks cut. The grill session then
offered A/B/C fixes (scroll area, fade, fit height) that all change the real behaviour, instead of comparing with
the real app first. Lessons: (a) a sketch of a page that exists is measured against the real-app shot of that
page (live compare, line ~1926) for shell geometry before `ready`; builder to say why that compare did not run or
did not flag the bottom gap. (b) Before a grill question on an existing page, the grill session opens the
real-app shot and asks only about differences from it. HIDDEN-CONTENT (181) stays: it would have flagged the
early box edge too.

183\. Non-canonical Tailwind class in the design (Tom, 2026-11-02): `[&>*]:flex-none` where `*:flex-none` is the
canonical form, in `.ethlete/design/studio/pages/sketches/sketches.ts` and the pages-sketches variants a/b/c.
Only the editor's Tailwind IntelliSense flagged it; no lint or `design check` rule knows canonical classes.
Tool fix (decided, technical): `design check` (and the app ESLint config, if a Tailwind v4 canonical-class rule
is available) reports a class whose canonical form differs and auto-fixes it with `--fix`, using Tailwind v4's
own canonicalization rather than a hand list. Queued after the Sketches view (priority, decision 12).

- 181/182 follow-up (builder, 2026-11-02): e fixed (rows run to the window edge, page root clips, CLIPPED skip
  removed; check ok in 8 states). HIDDEN-CONTENT exempts a part that declares a canvas control (canvas-viewport):
  a cut at the window edge is correct there. 182 cause: the live compare runs only against the MERGED page design
  (r1), never a sketch variant (`compare --live --sketch` is no step of `sketch ready`), and it reports a pixel total
  that never reaches 0, so a 20 px strip drowns in ~200k px of by-design difference. Tool fix (decided, technical):
  the live compare measures named regions on both sides (canvas viewport rect and clip rect, header, zoom chip) and
  reports geometry deltas apart from pixels; `sketch ready` on a page sketch with `implements` runs that region
  check against the live app for every region the variant does not claim to change.

185\. Zoom-label round r3 (pages/sketches g/h/i/j) missed the question (Tom, 2026-11-02): the variants look almost
identical, because the states sat at moderate zoom (25 %, 200 % of the rows inside a fixed layout) where label
behaviours barely differ. Tom's reference: the real Sketches view at 197 % (frame far larger than the viewport,
head pinned top) and at 7 % (whole sketch a tiny cluster, no labels). Lesson: a behaviour question is drawn at
its extremes, where the options visibly diverge. Tool fix: cause and check pending from builder (candidate:
`ready` reports the pairwise pixel share between variants in the round's leading states and refuses below a
floor). Q2 decided by Tom: reject r2 b/c (--by tom) and add agent-only `sketch withdraw` for pixel-identical
own variants (finding 184).
Cause (builder): `ready` refuses only on exact pixel equality of the first changed state; no notion of the
round's question states, no threshold, so g-j passed with a few hundred px of note text and offsets. Tool fix
(decided, technical): a round names its question states (`sketch round --asks zoom-7,zoom-200`, default: the
states the round added); `ready` compares every variant pair in each and refuses below ~2 % visible diff of the
frame area, ignoring text-only diffs in the variant-note region ("g and h look alike in zoom-7"). Lands with the
withdraw slice. Both Q2 actions were blocked by the builder's permission guard as acts in Tom's name / self-
modification; Tom has to run or confirm them in the builder session himself.

### Sketches zoom label decisions (2026-11-02)

- Zoomed far out (7 %): a small constant-size tag (variant + model, e.g. "a · Opus 5.5") above each frame (r4 m).
- Zoomed far in (200 %): a compact sticky head at the canvas top - variant, model, "Wählen", no note - on a
  backdrop, kept short so it hides as little of the frame as possible (r4 k, made compact).
- Next round folds both into the e base with e's status states (drawing, paused, paused-reason, idle, new-part),
  which r4 k/l/m do not carry.

187\. Round r4 swapped the demo content from the title-bar rows (e) to a simple pages/system case without being asked
(Tom, 2026-11-02), so the zoom options were judged on other content than the page they belong to. Lesson: a new
round keeps its base variant's fixture unless the round says otherwise. Tool fix (decided, technical, after the
Sketches view): `sketch check` warns when a variant's fixture (the parts and states it renders) differs from its
`from` variant's and the round note does not mention it. Tom: not blocking now; get the fold round merged so the
Sketches view can be built.

188\. `sketch ready` reported pages/sketches ready, then Studio refused Tom's merge of e: "pages/sketches hat sich
seit dem Sketch geändert" (Tom, 2026-11-02). Lesson: ready must not pass a sketch whose base is stale - the user
hits the refusal only at merge. Tool fix (candidate, cause pending from builder): `ready` checks the base hash
the same way merge does, refuses on a stale base and names the rebase command.
Cause (builder): 142e0a96a (10:38) moved the systemPage() calls into drawPages() inside render; the sketch base
was 00:51. `sketch ready` never compares the baseline hash with the current part - only `design inbox` ("needs
rebase") and Studio's merge do. Tool fix (decided, technical): ready refuses on a stale base and names
`sketch rebase <part> --by <id> --product <name>`. Goes into B111.

189\. The merged pages/sketches variant e cannot be implemented to a 0 px compare (builder, 2026-11-02): `fitFrame` in
`.ethlete/design/studio/pages/sketches/shared/sketch-rows.ts` bakes 4 rows x 6 inline title-bar renders into each
frame and has no `slot('shot')` (the old pageShot had one), and the b/c looks reach into design-internal classes
(`[&_.st-title-bar]:h-10`, `[&_.w-2xl]:w-55`) that the app's title-bar does not have. The app shows design-server
iframes per variant/state, so only faked title-bars could match. Lesson: a sketch round may silently drop the slot
that lets live content replace demo content, and nothing flags a part styling another part's internals. Tool fix
(decided, technical, after the Sketches view): `sketch check` refuses a variant that removes a `slot(` its base
has (SLOT-DROPPED); `design check` flags an arbitrary variant `[&_.<class>]` whose class is not defined by the
same part (CROSS-PART-REACH). Unblock now: a one-variant sketch that only adds `${slot('shot')}` to the
`[data-sk-fit-inner]` div; Tom merges it and gives a new go.

190\. The slot sketch for finding 189 was "merged automatically: no visible change" (a0ac449e2), yet `design task
pages/sketches` then said "changed since its go", so Tom has to give a go for a pixel-identical change
(builder, 2026-11-02). Lesson: the decision "invisible changes keep the go" (Go last, point 2, an MVP tool
change) was recorded as a decision but never got a backlog item, so nobody built it. Tool fix (technical): B113 -
a change that `ready` merged as invisible refreshes the go hash instead of staling it. Process fix: every
decided tool change gets a STATUS B item in the same commit as the decision. Side note: `ready` warned about 4
unused exports left in `pages/sketches/shared/` by the merge (measureFrames, aim, projectColumn, holdReason);
cleanup rides with B113.

192\. The Sketches view looks wrong on real data (Tom, 2026-11-02, components/zoom-chip with 16 states): every frame
is full width (~1650 px) around a 200 px chip, and at 100 % the "Aktuell" row alone fills the window, so no
variant is visible. Design e was judged only on the title-bar fixture (6 wide states at 59 %), which hides both
effects. Lesson: a page that lists user content must be sketched with the extremes of that content, not one
convenient case (compare finding 187). Tool fix (decided, technical): `sketch check` on a page part warns when
the fixture renders only one part layer or one part width; the round must show a narrow part and a part with
many states. Product questions (frame width, start zoom) go to Tom.
Cause of the full-width frames (builder): the measured width was right (198 px), but the Fit frame box had
`w-full` with a null width, so it stretched to the stage column.

### Sketches view real-data layout decisions (Tom, 2026-11-02)

- Frame width: each state frame is as wide as the part's fitted size (B36), not the full row width.
- Many states: a narrow part wraps its states into several columns (about 4 side by side) inside its variant row; a
  wide part (for example the title-bar) keeps one column. Unchanged states stay dimmed, the first change marked.
- Start zoom: the view opens at Fit; after that the zoom is kept per sketch, like the other canvas views.
- Nothing else differs from design e.
- Text size (follow-up, Tom): variant head note 15 px and state labels 13 px at 100 %, scaling with the zoom, but
  never below about 12 px on screen (at Fit they stay readable without zooming).
- Text floor revised (Tom, finding 196): the 12 px floor applies only to the variant head (name, model, note,
  Übernehmen). State labels scale with the zoom and are hidden once they would render below about 9 px.
- Long state label (Tom, finding 198): a label longer than its frame wraps onto two lines; the whole grid row
  reserves the height of its tallest label, so the frames of one row stay aligned.
- Large parts transposed (Tom, finding 199): a part whose fitted width is more than a quarter of the view width (at
  100 %) is laid out transposed: one column per variant (Aktuell | a | b ...), one row per state, so the same state of
  every variant sits side by side. Fit fits the width of all variant columns; the user scrolls through the states.
  This replaces the "wide part keeps one column" rule (title-bar is transposed too). Narrow parts keep the variant
  rows with about 4 state columns. Dimming and the "erste Änderung" mark stay per cell.

### Sketches matrix and state name decisions (Tom, 2026-11-02)

- State names in the transposed matrix (pages/sketches round "Matrix und Zustandsnamen"): variant a - the name once
  per row in a left gutter at 12 px. Tom picks a via Übernehmen and gives the go in Studio himself; then the builder
  runs the compare and commits the Sketches slice.
- Sticky names: when zoomed and panned, the state names stick to the left view edge while their row is visible.
- Fit in the transposed matrix fits the Aktuell column plus the first variant column (readable); further columns are
  reached by panning right. Same rule as "Fit shows Aktuell + first variant row" for variant rows. This replaces "Fit
  fits the width of all variant columns" in finding 199.
- Pending compare: the variant marks stay neutral, and the variant head shows a small "vergleicht ..." until the
  compare answers.
- zoom-chip round r1: variant a (plain SDK button). Tom picks it via Übernehmen himself.
- Variant head below Fit (Tom, finding 205): the 12 px floor of the variant head holds only down to Fit. Zoomed out
  further, the head scales with the canvas, and its text hides below about 9 px on screen, like the state labels.
- Unchanged variants (Tom, finding 207): variants that are pixel-identical to Aktuell in every state go into one
  shared accordion below the changed variants, collapsed by default. Its bar names them ("Unverändert: Variante a,
  Variante b"); opened, it shows each variant as before (head, note, frames, Übernehmen). In the transposed matrix the
  accordion is one narrow column at the right. Inside a changed variant, unchanged states stay visible and dimmed.
- Head badge (Tom, finding 206): follows the real state - "zeichnet" while at least one variant is being drawn,
  "Wartet auf deine Wahl" when all are drawn, "Pausiert" / "Keine Aktivität" when the agent stalls. Never derived from
  `sketch.status` alone. pages/sketches draws the "Wartet auf deine Wahl" state first.
- No per-variant status (Tom: too much). The "zeichnet diese Variante" placeholder stays for a variant without a
  picture.
- pages/sketches round "Matrix und Zustandsnamen": Tom merged variant a (2026-11-02). The go on pages/sketches is
  still the one from 11:14 and must be given anew by Tom.
- Structure-only rounds (Tom, finding 208): a round whose variants differ only in code and draw the same pixels is not
  a design choice. The `sketch ready` refusal stays as is (no "same pixels" waiver). components/zoom-chip is
  withdrawn; Tom's choice for it (variant a: reset is a plain SDK transparent sm button, no own part) is applied as a
  code change. Such questions come to Tom as plain questions, or are decided technically.
- pages/sketches round 2 details (Tom, 2026-11-02, all as drawn): the matrix state-name column is always on and cells
  no longer repeat the state name; the collapsed "Unverändert" accordion column in the matrix is 144 px wide with
  wrapping text (not rotated); below 9 px all variant head text hides, the variant name too; column heads do not stick
  when panning down (not now).
- Open for later: the drawing placeholder "GPT-6.1 Sol zeichnet diese Variante" wraps hard in narrow columns.

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

193\. In the Sketches view the state frames (design-server iframes) swallow the wheel, so the canvas does not zoom or
pan over a frame (Tom, 2026-11-02). Lesson: the camera works over empty canvas but most of the Sketches view is
frames. Tool fix (decided, technical, cause pending from builder): `canvas.e2e.mjs` wheels and ctrl-wheels over a
frame center, not only an empty point, for every PAGES entry.
Cause (builder): canvas-frame gives the iframe `pointer-events: none` unless the frame is active; the rewritten
Sketches view did not. The old wheel cases hit only empty points (`framePoint` in the probe skips iframe hits).
New case "wheel and ctrl-wheel over a frame centre" runs on all 4 PAGES and at once found a real defect in Flow
(ctrl-wheel over a frame does not zoom) - proof the case was missing.

194\. Variant notes are English again (Tom, 2026-11-02, components/zoom-chip variant a: "reset is a plain SDK
transparent sm button ..."). Finding 136 already named the cause ("no template sets the note language") but the
fix never got a B item - the same gap as finding 190. Tool fix (decided, technical, B114): `sketch new` and the
round template name the product's UI language (studio: German) for notes; `sketch check` warns NOTE-LANGUAGE
when a note's language differs from the product's (measured, not blocked); the open zoom-chip notes are
rewritten in German by their author.
Update (builder, 5df2ad7da): both variant notes are German. The round r1 note stays English: the CLI cannot edit
a round note after `sketch variant --round-note`. B114 adds `sketch note --round <key>`; then the round note is
rewritten.

195\. Zooming out with ctrl-wheel at the centre of the Sketches view (104 % -> 23 %) moves the content down/right
instead of keeping the point under the pointer (Tom, 2026-11-02). Cause pending from builder. Lesson: the canvas
e2e checks that zoom happens, not where. Tool fix (decided, technical): canvas.e2e asserts on all PAGES that the
world point under the pointer stays within ~2 px across a ctrl-wheel in and out.
Cause (builder): the Sketches view zooms by resizing frames (world stays scale(1)); heads, gaps and labels do not
scale linearly, so zoomAtPoint drifts. Fix: ctrl-wheel anchors on the frame under (or nearest) the pointer and
corrects the pan after render; new e2e case on all 4 PAGES, drift <= 0.3 px. Proven red with the anchor
disabled: drift 21-71 px.

196\. The 12 px text floor (Sketches view text size decision) breaks the layout at low zoom (Tom, 2026-11-02, 23 %):
state labels wrap ("out-/hover") and overlap the next column, because the gaps scale and the text does not.
Lesson: a size rule for text inside a scaled canvas has to be drawn at the zoom extremes before it is decided -
the decision was made from a 100 % and a Fit shot only (compare finding 185). Product question to Tom.
Seen with it: at 104 % all states of zoom-chip variants a and b are dimmed "unverändert", in an earlier Fit shot
variant a showed "erste Änderung" (dimming depends on load order; cause pending).
Cause of the dimming (builder): system-view first loads the quick sketch list (`?unchanged=no`, no compare), so
every state counted as changed and got "erste Änderung", then the full list. Fix: `changed = null` until a
compare answered (neutral). Tool fix (decided, technical): canvas.e2e asserts no state is marked before the full
list answered and that the marks match the API's `unchanged`.

197\. At high zoom (252 %, components/zoom-chip) the variant head note wraps one word per line and runs out of its
column into the state labels and frames ("Zurücksetzen", "(transparent," overlap "out · unverändert") (Tom,
2026-11-02). The note scales with the zoom but its column apparently does not. Cause pending from builder.
Lesson: the layout was checked at Fit and 100 % only (same gap as findings 185 and 196). Tool fix (decided,
technical): canvas.e2e renders every PAGES entry at the min zoom, Fit, 100 % and the max zoom and asserts that
no text box overflows its container (no rect of a text node outside its column, no overlap between head and
frame column).
Cause (builder): the head column was a fixed 18rem while the note scaled. Now the column scales with the note,
and note + labels use `overflow-wrap: anywhere`.

198\. A state label that wraps to two lines ("out-focus-visible · unverändert") pushes its frame down, so the frames
in one visual row no longer line up (Tom, 2026-11-02, zoom-chip, 4-column wrap). Lesson: the column wrap
(layout decision "about 4 side by side") was drawn with short state names only. Product question to Tom (how a
long label is shown). Tool fix (decided, technical): the same canvas.e2e pass asserts that the frames of one
grid row share their top edge within 1 px; the sketch-view fixture gets the longest real state name.

199\. elements/shell-main (a page-sized part, ~15 states, one column per the wide-part rule) opens at Fit = 2 %: three
variant rows of 15 stacked full shells, every frame a ~35 px thumbnail; the view is unusable for it (Tom,
2026-11-02). Its notes are English too (finding 194, B114). Lesson: the layout decisions were drawn with
zoom-chip and title-bar only, never with the largest real part; a layout rule needs the extreme fixtures (smallest,
widest, tallest part, most states) before it is decided (findings 185, 192, 196). Product question to Tom (layout
for large parts). Tool fix (decided, technical): the sketch-view fixture set and canvas.e2e include the largest
real part with the most states, and canvas.e2e asserts that Fit renders every frame at least ~25 % zoom or reports
the part as "too large for Fit" (measured, not blocked).

200\. The new canvas.e2e case "no text leaves its box" (finding 197) fails on System and Inbox: at Fit the canvas frame
heads "part · desktop" and "1440" leave their box (builder, 2026-11-02). An older defect the earlier e2e could
not see - proof the case was missing. Fix in its own slice right after the Sketches view commits, before the push.
Fixed (builder, 7f2fafe5e): the frame caption's font scales with the zoom (up to 48 px at Fit on System) but its
line height stayed a fixed 18 px inherited from outside the canvas; `leading-normal` on caption, scheme label and
Rendering pill. Likely since fc02e4a8c (canvas moved to Tailwind). Missed because the committed e2e checked only
focus, pan, zoom, chip and selection, and the defect needs a label scale above ~1.4 (Fit on a large frame).

201\. zoom-chip variant a only removes the `tabular-nums` class, and the server compare reports every state
pixel-identical to Aktuell, while its note claims the chip width jumps (builder, 2026-11-02). A variant that
changes nothing visible offers no decision. Lesson: nothing checks that a variant differs from Aktuell. Tool fix
(decided, technical): `sketch check` warns VARIANT-UNCHANGED when every state of a variant is pixel-identical to
Aktuell (measured, not blocked); the Sketches view shows such a variant fully dimmed.
Update (builder, 6d0a553a6): VARIANT-UNCHANGED built (warning, reuses the unchanged-state compare); it also covers
a sketch with a single live variant, where the identical-renders refusal stayed silent. On zoom-chip it fires
for both a and b: the round "SDK button or own part" is a structural choice with no visible difference. The
full dimming in the Sketches view follows after the Sketches slice commits.

202\. canvas.e2e on real sketches (components-zoom-chip, elements-shell-main, added for findings 198/199) found three
defects the sample fixture never showed (builder, 2026-11-02): ctrl-wheel zoom-in does not change the frame
width on zoom-chip (153 -> 153 px); hiding the panel moves the frames 12-16 px on zoom-chip and shell-main.
Cause pending from builder. Lesson: the Sketches cases ran on one sample sketch that is transposed at 1440 px, so
the 4-column grid never ran in the e2e. Tool fix (decided, built): every Sketches case runs on a narrow and a
large real sketch too.
Cause (builder): the three FAILs were wrong cases, not view defects: the zoom-chip wheel case had panned the
frame onto the shell header; "hiding the panel keeps the frames" ran in live Fit, which correctly re-fits (now
pins 100 % first). The sample fixture passed only by luck. The probe reads world scale(), always 1 in the
Sketches view, so "double-click focuses" never saw zoom there either. Two real defects found on the way and
fixed: Fit differed between loads (67/74/87 %) because the fit passes ended before the compare marks re-wrapped
the labels (fit key now includes the marks); +/- stepped from 100 % while in Fit (+ at 24 % jumped to 150 %).
canvas.e2e: Fit equal after reload (+-1 %), + from Fit = Fit x 1.5.
Cause of the Large ctrl-wheel drift and the zoom-chip Fit break (builder, one cause): each frame starts at a
placeholder size (1440 x 150) and gets its real size only when its iframe reports it, sometimes seconds after
load. The Fit key in sketches.component.ts held no row widths or shot heights, so the late real sizes did not
re-fit: the placeholder height cap stayed and the 3 fit passes were spent. Chip Fit depended on load timing
(84/58/60 %, 24 % after reload); Large frames moved under the pointer mid-case (91.7 px). Fix (uncommitted, in
the Sketches slice): the Fit key includes row.width and every shot.height; a measured size resets the cap and
re-fits. Chip Fit 84 % on every load, Large drift 0.2-0.3 px. The e2e missed it because it measured after a fixed
2.5 s wait: Large passed alone and failed only in the full suite, where earlier pages slow the iframes. Tool fix
(decided, technical, built in the slice): canvas.e2e never measures after a fixed wait, only after `settled()`
(no compare mark pending and frame boxes unchanged for 3 polls, 20 s max); the Fit-stable case asserts Fit stays
equal once sizes are measured.

203\. `design compare pages/sketches` reports all 8 states DIFF (92k-116k px) after decisions 196-199: the design still
shows design e (side-by-side head, one state list), the app now the transposed matrix, the scaled head column and
two-line labels (builder, 2026-11-02). Lesson: layout decisions taken on the running app were built without being
drawn in the sketch first. The compare is the check that catches it and it did. Fix: a new pages/sketches round
draws decisions 196-199; the open question on state names in the transposed layout is drawn there as variants;
then Tom's go, then compare.

204\. The unit test "CanvasFrameComponent failed page load > keeps the painted page" fails on HEAD (null
content.body) and nobody noticed (builder, 2026-11-02, seen while fixing finding 200). Cause and first failing
commit pending from builder.
Cause (builder): `watchContent$` in canvas-frame.component.ts reads `content.body.firstElementChild` without a
null guard; a document without a body (empty, XML, error page) throws. Red since its own commit e2d977408: the
committing session never ran the spec it added; the commit is unpushed, so neither the pre-push `vitest related`
check nor CI ran on it; `nx test ethlete-studio -- <filter>` exits without useful output on this failure. Lesson:
the spec gate runs hours and many stacked commits after the commit. Tool fix (decided, technical, B115):
pre-commit runs `vitest related --run` over the staged apps/ethlete-studio files (measure the time; report if it
exceeds ~20 s); `nx test ethlete-studio -- <filter>` must print the failure; code fix `content.body?.`.
Built (builder): c678b6931 (Nx 24 picks the 'summary' output style for AI agents; root .env
`NX_DEFAULT_OUTPUT_STYLE=static-failures-only`), fcf539a55 (`!content?.body` -> EMPTY in watchContent$),
9a58e0052 (pre-commit `vitest related`, ~10 s with one canvas file). The hook tests the working tree, not the
staged content; it at once found a red system-view spec in the uncommitted Sketches slice. Decision (technical):
keep it on the working tree. Never `git stash --keep-index` in the hook: several agents share one checkout and a
stash would take their uncommitted work. The hook output must name the failing spec file.
Red system-view spec (builder): outdated, not a regression - the row button label changed 'Wählen' ->
'Übernehmen' and openMerge (A13) only opens merge; the spec still clicked 'Wählen'. One-line spec fix, goes with
the Sketches slice. Full Studio suite: 456 passed, 1 expected fail, 0 failures. The earlier "98/98" report came
from a filtered run that left system-view.component.spec out. Lesson: a filtered run reported as green hides
specs the change touches; the pre-commit `vitest related` (B115) is the tool that catches it - no new rule.

205\. Zoomed far out on the elements/shell-main sketch, the view breaks in three ways (Tom, 2026-11-02, screenshot):
(a) the variant head keeps its 12 px floor while its column shrinks to the frame width, so the note wraps one
word per line and the head is about 8x taller than the frames below it; (b) of 3 x 15 frames only the first 3
Aktuell frames show content - the rest are thin empty outlines, all variant a/b frames included; (c) both
variant notes are English (B114 covers only new sketches; existing notes are not checked). Also "Variante a"
wraps onto two lines. Lesson: canvas.e2e and the shots run at 100 % and Fit only; nothing looks at the minimum
zoom with real data. Tool fix (decided, technical): canvas.e2e zooms each PAGES entry to the minimum zoom and
asserts (1) the variant head height stays within a bound of the frame grid height, (2) every frame has its
fitted height and a painted body; `sketch check` runs NOTE-LANGUAGE over all existing sketches, not only new
ones (B114). Cause of (b) pending from builder. Head behaviour below Fit: decided by Tom (see "Sketches matrix and state name decisions").
Cause of (b) (builder): not zoom. sketch-view.component.ts `rowShots` builds a new
`bypassSecurityTrustResourceUrl` per shot on every recompute, and `sketchRows` recomputes on every listing
refresh; `[src]` compares by identity, so all 45 iframes navigate again with the same URL. An in-progress sketch
keeps changing files, so refreshes keep coming, and a frame that has not posted its first height before the next
refresh stays at the 150 px placeholder. Reproduced: sketch.json rewritten every 1.5 s gave 0/45 frames measured
after 12 s (225 navigations); a quiet checkout 45/45. canvas.e2e missed it because its temp checkout is never
written to. Fix (decided, technical, in the Sketches slice): cache the SafeResourceUrl per URL string, so only a
real src change reloads a frame. Tool fix (same slice): a canvas.e2e case rewrites the copied sketch.json every
second and requires every frame to report a height within a bound and each iframe to navigate once per src. Built
(builder, uncommitted in the slice): `safeUrlOf(src)` keeps one SafeResourceUrl per URL; canvas.e2e case "a
listing refresh every 1 s for 6 s re-navigates no iframe and leaves no 150px frame": red on the old build (90
re-navigations), green now (0); canvas.e2e 99/99. The navigation count is the proof - the 150 px check alone stayed
green on the old build. Lesson: compare and check look at one settled render; nothing watched the view across live
listing refreshes. Open: one flake "no state is marked before the compare" (sketch view not shown) did not recur
in 2 runs.

206\. The Sketches view sends mixed signals on components/zoom-chip (Tom, 2026-11-02, screenshot): the head badge says
"In Arbeit", both variants are fully drawn and offer Übernehmen, and every state says "unverändert". Cause
(checked in code): sketch-view.component.ts maps `sketch.status === 'in progress'` to the badge status
'drawing' (label "In Arbeit"), but 'in progress' only means "round open, not accepted" - it says nothing about
an agent at work. The design pages/sketches has states drawing, paused, idle, but none for "every variant drawn,
waiting for your pick", so the implementer had no state to map an open, finished round to. There is no
per-variant status beyond the "zeichnet diese Variante" placeholder. Lesson: a status badge was bound to the
nearest data field instead of the state that defines it, and the missing design state hid the gap. Tool fix
(technical): pages/sketches draws the missing "waiting for pick" state; a sketch-view spec asserts the badge
follows agent activity per variant, never `sketch.status` alone. Decided by Tom ("Sketches matrix and state name decisions").

207\. Fully unchanged variants take as much room as changed ones (Tom, 2026-11-02, zoom-chip: both variants are
pixel-identical to Aktuell, 2 x 16 dimmed frames). Tom's idea: hide unchanged variants by default, in a narrow
collapsed accordion bar. Decided by Tom ("Sketches matrix and state name decisions").

208\. Übernehmen refuses on pages/sketches and components/zoom-chip: "pages/sketches is in progress - a variant is
picked once it is ready" (Tom, 2026-11-02; sketch.ts:970). All three open sketches are still status 'in
progress': the drawing sessions never ran the ready step (sketch-command.ts `loadedAndReady`). Studio still shows
an enabled Übernehmen on a sketch that is not ready, so the user finds out only by clicking. The ready step also
refuses variants that draw alike, which a structure-only round like zoom-chip r1 does by design. Tom reports the
zoom-chip refusal names pages/sketches too - wrong target pending from builder. Lesson: the pick depends on a step
no tool reminds the author of, and the UI offers an action the CLI refuses (same class as finding 184). Tool fix
(decided, technical): Studio shows Übernehmen only on a ready sketch (the badge "Wartet auf deine Wahl" = ready,
finding 206); a drawn round left in progress is reported. Update (builder): `design sketch ready pages/sketches` ran, exit 0,
pages/sketches is ready (auto-merge skipped: a and b change all 9 states). `sketch ready components/zoom-chip`
exits 1: a draws the same pixels as Aktuell in all 16 states, b the same as a - "draws variants alike". The
zoom-chip refusal cannot name pages/sketches (target from the shown sketch, sketch-view.component.ts:203-207);
most likely the pasted message. Cause: the subagent that drew the pages/sketches round had a brief ending at
`sketch check` + shots and skipped ready on purpose; nothing (sketch report --done, sketch check) flags a drawn
round left in progress; Studio's merge() (sketch-view.component.ts:523ff) is not gated by status. Tool fix
queued after the slice: Übernehmen only on a ready sketch; `sketch check` warns "drawn round left in progress". Built (builder, f7e66dbb6): `design sketch check` warns ROUND-NOT-READY
when a sketch is neither ready nor held and ready would not refuse it (warning only); a sketch ready would refuse
already gets "ready will refuse: ..." from check. Studio half goes with the badge (finding 206).

212\. Closing the Studio sidebar makes the Sketches canvas jump (Tom, 2026-11-02, two screenshots of the
elements/shell-main sketch at 44 %): the canvas grows to the left by the sidebar width (~254 px) and every frame
moves left by the same amount, so the content under the pointer changes. Expected: the content stays where it is
on screen; only the newly free area shows more canvas. Lesson: canvas.e2e drives zoom and pan with a fixed
viewport origin; nothing changes the viewport's left edge while a camera is set. Tool fix (decided, technical,
B120): when the viewport's screen origin moves, the camera shifts by the same delta so world points keep their
screen position; a canvas.e2e case toggles the sidebar at a panned, zoomed camera and requires a frame's screen
rect to stay within 1 px (red on today's build first).

214\. The B116 pre-commit hook ran the cli specs with the `GIT_INDEX_FILE` of a path-limited commit
(`git commit -- <paths>`), so harness-map.spec's own git commits failed (builder, 2026-11-02; fixed in
af28afe38 by unsetting it). Lesson: the hook was proven with a plain commit only; the path-limited form, which
the doc agent uses for every plan commit, sets a temporary index that leaks into child git calls. Tool fix
(technical, B122): a spec runs the pre-commit hook under a path-limited commit and requires a spec that commits
in a temp repo to pass.

215\. pages/sketches compare 8 of 9 states 0 px after af28afe38 and the app's gridFit loop (builder, 2026-11-02); the
ninth, `drawing`, differs by 70 px: two `animate-pulse` dots one colour unit off, because Playwright's
`animations: 'disabled'` resets infinite animations to an unstable frame. Accepted as noise for the Sketches slice
commit only, named in the commit message. Also: canvas.e2e copied sketch folders from the live tree and crashed
with ENOENT when Tom discarded elements-shell-main mid-run; it now extracts them from HEAD (`git archive`).
Lesson: a test fixture read mutable working state; compare keeps no PNG for ok states, so no edge check is
possible afterwards; its exit code cannot tell a known diff from a new one. Tool fix (technical, into B117): both
pictures freeze `animate-*` at a fixed frame; compare writes PNGs for ok states too (`--keep-all`). Rejected: a
per-state "known baseline" pixel allowance - it hides the next real diff in the same state; the noise source gets
fixed instead. App: state labels toggle with `hidden` (as the design does), not `@if`, so a fit crossing the
label scale measures the final rows.

217\. Attribution of the floating Studio state (finding 216; builder, 2026-11-02). Tom's clicks: go title-bar 09:41,
title-search 09:40, update-dialog 09:50, shell-main 09:58, zoom-chip and pages/sketches 15:51; accepts title-bar,
update-dialog, zoom-chip; studio-lab picks components-card b and elements-rating c; merged zoom-chip and
pages/sketches. Tool carries (`auto: true`, Impl Q109): check runs by builder slices at 08:46 and 09:06 carried
13 gos after shared files changed (button.ts/button.component.css, new title-bar icons) with every state
pixel-identical; writer `autoAcceptOf` (libs/cli/src/lib/design/system/accepted-pictures.ts:265) from
check-system.ts:517. These carries are the "changed outside a sketch" warnings. Decision (doc agent): commit all
of it as one chore commit naming both sources. Open for Tom: the builder proposes (B124) that a carry no longer
copies the previous `by` ("tom" on entries Tom never touched; only `auto: true` tells them apart) but records
the tool as `by` plus `carriedFrom: {by, at}`, and Studio shows "carried from Tom's go of <date>". That reverses
Impl Q114, so it is Tom's call; nothing is built until he answers.

219\. Studio-written state committed in dd1d0377b except go.json (builder, 2026-11-02): a PreToolUse hook denies any
agent commit of go.json ("a go is granted in Studio"), and Tom edits no files, so Tom's Studio gos of today
(title-bar, title-search, update-dialog, shell-main, zoom-chip, pages/sketches) plus the check carries float in
the tree with no owner. Lesson: the hook guards who may write a go, but nothing commits the go Tom grants, so a
granted go is never part of history. Open for Tom: Studio commits go.json itself when he clicks "Go geben" (one
commit per go, authored as Tom). Also: the Bash hook that sends long design commands to the background matches
those words inside a commit message body and blocked two plan commits. Tool fix (technical, B126): the hook
matches only the command head, never heredoc or `-m` bodies. sdk/ and studio-lab/pictures.json get committed
like studio/pictures.json.

220\. pages/sketches round 2 ready (78f0fbb3a, builder subagent, 2026-11-02): one variant a, 21 states, diff against
the merged base only import paths. `sketch check` flagged WRAP on unchanged-matrix (the collapsed "Unverändert"
bar wraps to 3 lines in a 144 px column); the subagent added `data-et-skip="WRAP"` without asking. Lesson: a skip
marker silences a visible layout effect with no review; Tom sees it at his pick. Tool fix (technical, B127): a
new `data-et-skip` in a sketch diff is listed in `sketch ready` output and in the Studio round head, so a skip is
never invisible to the person who picks. Brief defect (builder): `D="node ... design"; $D` does not word-split in
zsh; briefs use `yarn design`.

224\. B128 landed (7957d3194, builder, 2026-11-02): wiring for pages/sketches is now every ancestor (app.config.ts,
app.routes.ts, main.ts, the harness files, studio-view, sketch-view, system-view) plus the part's spec. Gap:
5a29b1b94 also changed system-view/inbox-comments.ts and system-tree.ts, which do not import the part; sketch-view
(the direct importer) imports them to build the part's inputs. Ancestors-only refuses them. Lesson: "files that
mount the part" and "files that feed its inputs" are two sets; decision 221 covered only the first. Tool fix
(decided, technical, amends B128): wiring also includes the non-spec app files imported by the part's DIRECT
importers (one level, not the imports of every ancestor, so app.config does not pull in the whole app).

225\. B130 landed (5577108ff rule, d2d484c55 marker, builder, 2026-11-02): ACTION-UNDECLARED is now a draw-time error
in inspectFrame, so check, sketch check and sketch ready flag native controls, interactive roles, `[tabindex]`,
`[aria-expanded]` and click listeners without `data-et-action`. The hold toggle carries
`data-et-action="${open ? 'paused' : 'paused-reason'}"` (a non-emit value names a state). Product-wide
`design check` went red on HEAD: studio 286 hits (comment-pin, title-bar, tree-row, update-dialog), sdk 2222.
Lesson: these parts had gos while their interactive elements carried no action, so the action check never ran
against those controls; and a new rule switched on as an error everywhere breaks every unrelated push.
Tool fix (decided, technical, B133): ratchet. ACTION-UNDECLARED is an error in sketch check / sketch ready and in
check for a part with no go or changed since its go; for an unchanged part with a go it is a WARNING, one summary
line per part (count + first selector), not one per element x state x scheme. Product-wide check and pre-push
are green again. Backlog: B134 studio declares the actions in comment-pin, title-bar, tree-row, update-dialog
(stales their gos: Tom re-gos them in one batch); B135 sdk: an explicit per-part declaration that the part is a
control whose action belongs to its consumer (never inferred), then the remaining hits. Open before Tom's go of
pages/sketches: why the check printed "PICTURES CHANGED ... drawing" after d2d484c55 (that state has no hold
button). Flake: actions-stream.spec failed once under load.

### Capability list decisions (Tom, 2026-11-03)

- Every product keeps a list of its user capabilities (write comment, write note, give go, merge sketch, toggle
  sidebar, ...). Each capability must point to a design action, the place in the design where the user triggers it.
  `design check` reports every capability without a place. The builder writes the first list from the code; Tom
  confirms it once; after that it changes with each change (B157, finding 231). The confirmed list, not the code,
  says what a product must be able to do.
- B151 orphan endpoints: the changed-area view in merge (`sketch-diff`, `sketch-crop`) and the motion strip in the
  part view (`motion`) go on the studio capability list and come back later as Studio sketches; the motion strip
  much later, as planned. `part-ready` is deleted: "ready to build" follows from green checks.

- First studio list (B157, 1627a0d53): `.ethlete/design/studio/capabilities.json`, 65 capabilities, 38 with a place,
  24 without, 3 known missing (B151); all `confirmed: false` until Tom confirms. The 24 without a place: comment
  reply/done/withdraw and note write/change/delete/flow-note (endpoints, no caller, B145/B148); drawn without a
  `data-et-action` (comment-write on pages/inbox, inventory approve/reload/toggle); in the app but drawn by no part
  (go-give, edit-accept, exception-approve, call-transfer, theme-pick, preset-pick, frame-select, frame-resize,
  grid-columns-toggle, frame-reload, comments-retry, sketch-round, prompt-copy-flows).
- Decided (technical): a capability without a place carries `missing: "B..."` and is then a warning, shrink-only like
  the orphan list; wiring after Tom's confirmation. A real-product spec that needs `dist/` fails with "needs dist"
  instead of skipping.
- Tom confirmed the first studio list as it is (2026-11-03): all 65 entries become `confirmed: true`; wire
  CAPABILITY-PLACE with `missing: "B..."` on the 24 without a place.

### Uncommitted design files, comment errors and canvas frames decisions (Tom, 2026-11-03)

- Tom's uncommitted design files (`.ethlete/design/studio/go.json`, `merged.json`, `pages/system/system.ts`, the
  deleted `sketches/pages-system/*`): the builder commits them as they are, only Tom's lines, split with
  `design commit-hunks`. This unblocks `design ready`/go for pages/system and the pages/system part of B189.
- Comment send error (B189): two texts. Network or server error: "Kommentar nicht gesendet. Erneut versuchen." with
  a retry button. A 4xx shows the server's reason, with no retry button.
- B178 frame size: variant a - frames keep fitting their content, as in the app. No size field, no corner grip.
- B178 round switch: keep it, label "Unveränderte Zustände zeigen", off by default.

### Go ownership and sketch rebase decisions (Tom, 2026-11-02)

- pages/sketches round 2: the builder rebases the round-2 sketch onto the current merged design and re-runs
  `sketch check` and `sketch ready`; then Tom picks ("Übernehmen") and grants the go in Studio. No agent writes the go.
- go.json commits (finding 219): Studio commits go.json itself when Tom clicks "Go geben", one commit per go, authored
  as Tom. Today's uncommitted gos (title-bar, title-search, update-dialog, shell-main, zoom-chip, pages/sketches) go
  in once in one Studio-made commit. The agent hook that denies go.json commits stays. (B139)
- Carried gos (finding 217, B124, reverses Impl Q114): an auto-carried go is written with `by: <tool>` and
  `carriedFrom: {by, at}`; Studio shows "übernommen aus Toms Go vom <date>". Existing entries with `auto: true` and a
  copied `by` are migrated the same way.
- B134: the builder declares the missing actions in comment-pin, title-bar, tree-row and update-dialog in one slice;
  Tom re-grants the four gos in one batch.
- After the rebase (31e191378, base hash only, 21 states ok) Tom's earlier pick of variant a (2026-11-02 18:08) stands;
  no re-pick. The pick stays uncommitted until Studio commits it with the go (B139).

227\. B136 cause (builder subagent, 2026-11-02, uncommitted at stop): the "Pausiert" Enter/Space misses were a tool
bug, not an app bug: the action check compared a key-pressed control that still shows the focus ring against an
unfocused goal state (DIFF 427 px). Lesson: a keyboard press leaves focus, a click path does not, so the same
action has two end states and the check knew one. Tool fix (B136, in the tree, unverified): normalize focus
before the goal comparison of a key press. The "PICTURES CHANGED drawing" trace has no result yet.

228\. pages/sketches clips its canvas at the panel edge (Tom, 2026-11-03, screenshots; recurring, Tom: "this error is
made here constantly"): in `unchanged-matrix-open` the variant head with "Übernehmen" is cut at the right edge of
the tree panel (68 of 108 px). The app canvas runs full width under the floating panel and clips only at the
shell-main edge (finding 44); round 2 added `overflow-x: clip` on a hand-drawn canvas box at
`left: calc(var(--st-shell-inset-left) + var(--space-5))` (sketches.ts:325). Second cause: the variant head never
sticks; only the state-name gutter follows the pan (`.sk-gutter`, `translateX(var(--sk-pan-x))`). Tom: the
design follows the app as built; go on round 2 stays, the fix comes as a design change with a new go. Why no
tool caught it (builder, measured): (1) the page root carries `data-et-skip="CLIPPED"`, which every descendant
inherits, so no clip check ran on the page; (2) no rule measures an interactive control against its clipping
ancestor; (3) sketches hand-draws its canvas box instead of the shared `canvasView` from
`elements/canvas-frames` (rule 1: one canvas), so the finding-44 fix never reached it; (4) compare takes the
design as truth and would have asked to copy the clip into the app. States that cross the edge existed
(zoomed-page, sticky-names, unchanged-matrix*); only a human saw the picture. Lesson: a fix to a shared shape
that pages copy instead of import reaches only the page that imports it, and a skip on a page root silences a
whole page. Tool fix: CUT-CONTROL rule (own code, a CLIPPED skip does not silence it); a CLIPPED skip may not
sit on an ancestor of an interactive control; shared canvas enforced by check (open, put to Tom).

229\. The grill session asked Tom a visual question in chat (2026-11-03: what sits behind the sticky state-name
column) right after Tom had answered "as built" (Tom: "you ask me again about things we want to change? ... you
ask me design questions in text again; we built this tool EXTRA for that"). Two errors: "as built" already
answers it (the builder looks up what the app does and copies it), and a look question belongs in Studio as a
sketch, not in a chat round. Lesson: the grill round had no rule that keeps look questions out. Fix: the
doc-agent skill now routes look questions to a sketch and treats "as built" as a fact for the builder.

231\. Studio has no way to write a comment any more (Tom, 2026-11-03): there is no comment button. Cause (from the
record): finding 49 removed the legacy top-right chrome ("Notiz", "Kommentar", ...) because no page design showed
it, and 8cf715654 deleted the comment draft and thread components with it; no page design ever drew an entry for
writing a comment. Why no tool caught it: the checks compare the app against the designs, so a capability the
designs never drew is "legacy" and its removal looks like a fix; nothing lists the user actions that existed
before and are gone after. Lesson: matching the app to the design can delete a capability the design forgot.
Tool fix (Tom, 2026-11-03; B146): ACTION-LOST - an action declared at the last go or in the last app state that
exists nowhere afterwards fails `design check` until the user confirms the removal or a design shows it again.
Generic, any project. Product fix (B145): the comment button returns top right next to the other buttons as a
one-variant sketch; where page buttons belong in general follows as its own sketch with variants.
Builder facts: 8cf715654 removed the whole write path (pin pick, draft, thread, reply, resolve, withdraw, the four
app write calls); only display is left, while the CLI still serves the write endpoints (studio-api.ts:72-77).
ACTION-LOST would not have caught 231 (the buttons were never a design action). Added tool fix (B147,
technical): ORPHAN-ENDPOINT - every Studio API path the CLI serves needs an app caller, else `design check`
fails.

232\. studio-lab `pages/film-detail` state `reviewing` fails CONTRAST ("What did you think?" 2.07:1, needs 4.5) since
the UTILITY-CSS fix (aa0040aa9, builder, 2026-11-03). It was hidden before: 23 UTILITY-CSS errors made the check
skip the render check for the whole product, and the report did not say how much went unchecked. Lesson: a
blocking error in one rule hid every later rule, so "red for one reason" looked like the full picture. Tool fix
(B150, technical): the render check runs even when a static rule fails; if a rule really cannot run, the report
names it as "not checked" with the parts it skipped. Product fix (B149): a one-variant sketch that sets the text
to the product's text token at AA, for Tom's pick in Studio.

234\. Sketches app slice (pages/sketches r2, builder, 2026-11-03): the design's "Pausiert" badge can never show in the
app, because the sketch list the app reads carries no hold data; the app also has inputs nobody binds (hold,
reason, camera) and inputs that default to sample data (SHELL_SAMPLE, SKETCH_ROWS). Compare refused the design
prop `comparing` although the harness map turns it into row data (and accepts `same`, mapped the same way), so the
comparing states stay unchecked. Why no tool caught it: no check asks whether each design state of an implemented
part has a data source in the app, and no check looks for unbound or sample-default inputs. Lesson: a state the
design draws but the app can never reach passes every pixel check, because compare feeds it in by hand. Tool fixes
(technical): B153 compare accepts every design prop the harness map consumes (first); B154 STATE-NO-SOURCE - each
design state prop of an implemented part maps to app data or to an input a consumer binds; B155 UNBOUND-INPUT and
SAMPLE-DEFAULT, both ratcheted. App fix: the sketch list delivers the hold data.

235\. CUT-CONTROL (c5d3271a1) reports 0 on pages/sketches although the design still clips "Übernehmen" (finding
228); the rule was proven only on a fixture, never on the case that motivated it (builder, 2026-11-03). Cause
open (button outside the scanned root, or the CLIPPED skip still exempts it). A dist debug patch was overwritten
by a parallel cli rebuild, because all agents share one dist/. Lesson: a rule built for a real defect is done only
when it is red on that real defect; a shared build output cannot hold a private experiment. Fix: B142 starts with
a spec on the real pages/sketches render that must report CUT-CONTROL; debugging runs in specs or a private
outDir, never in the shared dist/ (builder sub-agent brief).

237\. pages/sketches: the matrix state-name gutter (`data-sk-gutter`, design sketches.ts `gutter()`, app
sketches.component.html) is an opaque sticky column as tall as the whole variant row; on horizontal pan it slides
over variant a's canvas and hides it, holding only the state key ("part" on pages/system) (Tom, 2026-11-03: "sieht
echt ugly aus"). Compare was green because the r2 design itself draws the opaque gutter; no rule asks whether an
opaque element covers content, and CUT-CONTROL looks only at clipped controls. Same family as 228/235 (Übernehmen
under Verwerfen, same screenshot). Lesson: a design can be wrong in a way design-vs-app compare never sees; an
occlusion check must judge the render itself, at every pan/zoom state. Fix: B158, CUT-CONTROL grows into COVERED
(hit-test controls and canvas regions; an opaque element of another subtree on top is red), red first on both real
cases; look fix as a Studio sketch inside B142(b) (gutter only label height, translucent; a second variant if a
real alternative exists, Tom picks in Studio).

239\. `sketch ready` refuses a sketch already marked ready even after its variant changed (B145 busy/error states
added after the first ready), and no agent command sets it back to in progress; the agent edited sketch.json by
hand (builder, 2026-11-03). A status that does not know what it judged goes stale silently. Fix: B162, ready
stores the content hash it judged; a changed variant drops the status to in progress on the next check or ready
(same stale logic as SKETCH-BASE-STALE).

240\. `design shot --crop` with a box outside the content returns an empty canvas without error (builder,
2026-11-03); an agent can review a blank picture and call it fine. Fix: B163, fail with "crop box outside content
(content box ...)".

241\. Studio disclosure padded its panel instead of its body (fixed f05409524); compare was 12/12 green because the
demo body is `display: contents` inside the padded panel, so both forms give the same geometry (builder,
2026-11-03). A demo that cannot tell two layouts apart cannot guard either. Fix: B164, a disclosure state whose
demo brings its own block body. Same slice: compare counts the design's `sameToggle` output as missed because the
app uses a `[(sameOpen)]` model; decided: the tool maps `model()` as input + `<name>Change` output (into B153).

242\. After B134 declared actions on title-bar, update-dialog and tree-row, compare reports 63 + 2 + 36 "fired no
output" misses, though the window buttons work in the app: the app components call the window API themselves
instead of emitting (builder, 2026-11-03). Separately, at far-out zoom on pages/sketches the column head is
visibility:hidden, so "Übernehmen" and the pin toggle cannot be reached; COVERED would not see it (nothing covers a
hidden element) and the static capability list cannot see a zoom state. Lesson: a declared action must be
reachable in every state that declares it, and an app component that does the work itself hides it from the
compare. Decided (technical): app title-bar and update-dialog get real outputs (update/minimize/maximize/close,
later/restart), the consumer calls the window API; tree-row gets an app output `rowPress` + design
`emit:rowPress` (B166). B158 checks reach, not only cover: UNREACHABLE <part> <state>: <action> for hidden,
invisible, zero-size or covered. Look fix for far-out as variants in the B142(b) sketch.

243\. Tom (2026-11-03): "we only have Linux and Mac" title bars. A `windows` state exists in components/title-bar and
in the app, but it draws the same small `et-window-control-button` size md as Linux, only square and with a
0.5 gap inside the bar padding; it does not read as Windows (native caption buttons are wide, full bar height,
flush to the top-right edge, no gaps). Every check was green because each checks the design against itself or
the app against the design; nothing compares an OS-native imitation with the native original. Lesson: a part
that imitates platform chrome needs the platform's own measures as a reference, not only our design. Fix: the
look comes as a Studio sketch (B167); the part declares the platform measures it follows (button width/height,
inset) in its note, and the check measures them (B168, technical).

245\. B158's reach check found that `emit:merge` and `emit:discard` appear in none of the 21 pages/sketches states
(builder, 2026-11-03). Likely cause: `pages/sketches/shared/sketch-rows.ts` adds the action with
`replace(/<button\b/, ...)` and `sketches.ts` with `act(discard.body, 'discard')`, and neither matches the SDK
button markup, so the attribute is silently never added. Compare never checked these two actions either, and
stayed green: an action that is never declared has no misses. Lesson: a helper that marks nothing must fail, not
return its input unchanged. Fix: B181 (technical) - a design helper `withAction(markup, action)` that throws when
nothing matched, used everywhere actions are added; pages/sketches merge/discard fixed with it (no visual
change); red on the two Übernehmen cases afterwards.
Correction (builder, 2026-11-03, after B181 d648d0395 + d961cb00d): the cause was refuted - a private build shows
emit:discard in all 21 states and emit:merge wherever a take is offered; the "0 occurrences" came from the stale
shared dist (finding 255) or finding 246. withAction still found a real silent bug: pages/sketches gave a comment
pin a second `data-et-action`, the browser kept the first, so the drawing hid the second (now a throw). The two
Übernehmen cases cannot go red: they only occur after a pan, no static state draws one, and COVERED counts only
opaque covers while Verwerfen is transparent. Decided (technical): B201 - reach sweeps pan positions on canvas
parts, and COVERED counts any element that takes the hit (`elementFromPoint` is not the target or inside it),
opaque or not, keeping the overlay/tooltip exemptions.

246\. Specs cannot render a real Studio part from source: "Cannot find module .../render-worker.js", and only the
first error line reaches the RENDER issue, so a spec against a real design passes with 0 findings (builder,
2026-11-03). A check that cannot run reports the same as a check that found nothing. Lesson: a render failure is
never zero findings, and its full error must reach the report. Fix: B182 (technical) - vitest global setup
builds the render worker once into a private dir; RENDER detail prints the full error. Probably the same family
as the private-build "Transform failed" after B155 (cause checked in the B169 slice).

247\. Tom (2026-11-03) on the B167 r2 sketch (46 px tiles, variant e): "the size of the buttons is correct, the size of
the icons is definitely not". The note declares a "10 px glyph", but the drawn ink is about 6 px: the 10 px is the
icon box, and the icon's viewBox has padding around the stroke. Native Windows 11 caption glyphs are 10 px of
ink. No check measured the ink; the declared measure and the measured box agreed with each other. Lesson: a
platform measure for a glyph is the visible ink, not the box it sits in. Fix: B167 r3 (sketch: glyph ink sizes as
variants, tiles stay 46 px); B168 measures declared glyph sizes as the ink bounding box (non-transparent pixels in
the shot), not the element box.

248\. B174 (inbox "Erneut laden") is blocked by 5 LIVE false positives in `sketch check`/`sketch ready` (builder,
2026-11-03): `liveStateProblemsOf` (system/sketch/check-sketches.ts) reads state names with `stateNamesOf`, which
is null unless the part has a literal `states: {}`; pages/inbox spreads its states from shared/. A static read of
source shape stood in for the real state list. Lesson: a check reads what the part exports at runtime, never a
literal in its source. Fix: B183 (technical, priority) - read state names from the loaded module; null on both
sides is skipped as in STATES.
ready` prints that command for every file it wrote; the brief uses it. Not an auto-commit inside ready.

251\. While sketching B175 (builder, 2026-11-03): `data-et-skip=CLIPPED` sits on the canvas-viewport root, so it also
exempts the zoom chip from every check; SKIP-SCOPE tolerates this only while the page structure stays identical,
so a sketch that changes the page trips it. A skip wider than the element that is really clipped silently
exempts its neighbours. Fix: B187 (technical) - the skip moves onto the clipped content inside canvasView
(elements/canvas-frames); SKIP-SCOPE then holds without the identical-structure exception.

252\. The anchored-dialog arrow in the B175 sketch needed a hand-set offset because its anchor is not the element under
the chip (builder, 2026-11-03). A hand offset is right for one layout only and no check compares arrow tip with
anchor centre. Fix: B188 (technical, SDK) - an anchor option on the components anchored-dialog that points the
arrow at a given element; the render check measures arrow tip vs anchor centre. Changeset + docs guide.

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

255\. B180 could not reproduce the `--out` + `--variants` refusal from finding 244: the source already accepted it
(now pinned by a spec). The refusal came from the shared cli `dist/`, which predates B172 (it still checked
withdrawn variant b) (builder, 2026-11-03). B94 guards the design libs' dist that shots draw from, not the cli's
own dist, so an agent ran an old CLI and reported its bugs as current ones. Lesson: a tool must say when it runs
older than its own source. Fix: B191 (technical) - in a repo checkout `et design` prints a first-line WARN
"cli dist older than libs/cli/src (built <time>, source changed <time>), run <rebuild command>" and repeats it in
every report header; rebuild the shared cli dist once the parallel slices settle.

256\. Sketching B178 (canvas frames, builder, 2026-11-03) the action vocabulary was too small for real interactions:
no double-click form for `data-et-action`; capabilities.json cannot say a capability happens automatically
(frame fit via ResizeObserver has no place to draw); instant state switches must each be declared `unreachable`
to pass ready, so the part lists all 90 pairs. Each gap pushes an agent to fake a place or to bulk-declare
exceptions that then hide real ones. Parallel agents also overwrote each other's scratch files. Lesson: when the
declaration language cannot say the true thing, agents write a false one that passes. Fix (technical): B192
`dblclick:` prefix read by CAPABILITY-PLACE; B193 `"automatic": true` with a required `why`, accepted without a
place but listed in every capability report (never silent); B194 an `instant` declaration replacing per-pair
`unreachable`. Scratch names are slugged per agent in the builder brief.

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

265\. CANVAS-CAMERA-OWN built (B196, 7a7caf5ff, f53a0a03e, e57fa1868): a local ESLint rule for
`apps/ethlete-studio/src/app/design-parts/**` flags pan/zoom/camera state, wheel and pointer-move listeners and
clamp math on pan values; red on the real 030fe2f36 and 5a29b1b94 components. HEAD is green only through a known
list: Sketches still owns its camera, flows owns a zoom copy. red-check said NOT RED on 7a7caf5ff because it cannot
stub `export default`. The rule skips external `.html` templates. Decided (technical): B213 - design-canvas owns the
Sketches camera and exposes zoom as a signal for the flows chip, the known list goes empty, the rule reads
`templateUrl`; red-check's default-export stub goes into B217.

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

301\. Uncommitted go refresh (2026-11-03). After the B242 tidy a62942f0c, the builder's check rewrote go.json at
14:25:20 for elements/shell-main and pages/inventory, which embed title-bar. It was the decided carry
(accepted-pictures.ts, B219/B223: the design hash changed and no state picture changed, so the go keeps `by` and
gets auto:true, refreshedBy "design check"), not a new go. The refresh was left uncommitted, and Tom found an
unexplained go in his tree. Why no tool caught it: check writes go.json silently, and nothing flags an
uncommitted refresh before the next commit. Fix (B246, decided, technical): the check prints each go it
refreshed with the commit-hunks command to run, and `yarn commit` refuses while a refreshed go of a part in the
commit is uncommitted. Who may commit a carry refresh is Tom's call (asked 2026-11-03).

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

372\. Tom (2026-11-04, about 15:05): after a full manual Studio restart on the dd708ee4a host, "Neu starten" showed
"Design-Server gestoppt" with the same English stale-build text as finding 369. Cause (builder): the host ran
the sha copy `tmp/studio-cli/5639952…` (`design_server.rs` start -> `studio_code.rs` cli_copy ->
`tools/scripts/studio-code.mjs cli-copy`). That copy came from an earlier script version (14:41), had no
`pinned-commit` file and so the old stale guard (`source-hash.ts`), which compared it with the dirty
`libs/cli`. With `libs/cli` dirty, `cliCopyPlan()` keeps the current copy, so it never builds a newer commit
while agents have uncommitted CLI work, which is the normal state. Recovery: the builder moved the copy to
`/tmp/studio-cli-stale/` and built 5bec01b89 into `tmp/studio-cli/` in a temp worktree. Why no tool caught it:
`studio-code.spec.mjs` tests `cliCopyPlan` only as a pure decision; no spec starts a copy against a dirty
`libs/cli`; the plan trusts any 40-hex directory; dd708ee4a was not run end to end ("Not verified: the real
Studio flow"). Tool fix (B318): a copy without `pinned-commit` counts as absent; with `libs/cli` dirty the plan
still builds the latest commit when the kept copy is older; a node spec that starts the copy against a temp
repo with a dirty `libs/cli` and expects a listening server; the stop text in German plus a recovery action
(the finding-369 sketch).

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

374\. Tom (2026-11-04, parked for later): components/textarea shows "508 offen". Cause (builder): `missingMotionsOf`
(`libs/cli/src/lib/design/system/open-points.ts:87-106`, since 97ab889ed) emits one point per undeclared state
pair, N\*(N-1) per part; Studio lists the raw pairs, while the CLI text already folds them. The stale-record
text is English (`part-build-ready.ts:37`), and the explorer rows read "empty · width" without the value
(`system-tree.ts:443`, lead only). Why no tool caught it: specs use 2-4 state fixtures; no spec runs against
the real design system or sets a budget. Tool fix (B320): an open-point budget spec over the real parts;
German stale-record text through STUDIO_LABELS. Open for Tom later: folding the pairs (sketch) and whether
`motion.instant` is the default for components.

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

377\. Builder (2026-11-04, about 15:50): the Studio frontend dev server (`nx serve ethlete-studio`, `hmr: false`,
`liveReload: false`) still watches and rebuilds the working tree, so a window reload brings uncommitted agent
edits into Tom's Studio (at that time the unverified B321 stacking fix). This breaks the decided rule "only
committed code reaches the running Studio, after Tom's click"; dd708ee4a covered only the CLI copy. Why no
tool caught it: the committed-code-only slice had no check for the frontend path. Tool fix (B322): serve the
frontend from a sha-keyed build of HEAD like the CLI copy, switched on Tom's click; a scenario that an
uncommitted `apps/ethlete-studio` edit does not reach the served app.

378\. Tom (2026-11-04, about 15:55): while the server runs, Studio shows no "Neu starten" (only in the stopped
state), and the title-bar code notice is built but not rendered. So a new CLI commit reaches Tom only by a
kill of the server or a full Studio restart. Why no tool caught it: the committed-code-only slice tested the
restart flow only from the stopped state; no spec renders the running state with a newer commit. Tool fix
(B323): render the title-bar notice in the running state as an interim "needs approval" notice that opens its
sketch (finding-368 flow); a spec for the running state with a newer CLI commit.

379\. Tom (2026-11-04, about 16:45, server on copy 1cf06ce2d): after the restart the Sketches group in the part tree
still appears only after a long wait. Measured on that server: quick listing (`&unchanged=no`) 0.03 s, full
listing over 90 s (curl timeout; 33 s on a148d713e), machine load 32 from builder test runs. So the tree still
waits for the full listing, or the quick listing does not feed the tree. Why no tool caught it: B317 specs
time the endpoints, not the time until the tree shows the group in the real app under load. Tool fix (B324):
the tree renders from the quick listing only; a spec with a full listing that never answers asserts that the
Sketches group still renders.

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

381\. Tom (2026-11-04): on the Mac the frames (iframes) eat the two-finger trackpad pan of the canvas. A wheel event
over an iframe goes to the iframe document and never reaches the canvas. Why no tool caught it: the canvas
behavior tests pan on empty canvas only, never with the pointer over a frame. Tool fix (B326): frames do not
take wheel and pointer input while the canvas is in pan mode (shield over the frame or forwarded wheel), and
a storybook-e2e or Studio headless test that pans with the pointer over a frame.

382\. Tom (2026-11-04, 15:48): "pages start merged". Tom picked "new" in `pages/start@edit` (merged.json:
`decidedBy: user`). The merge left the tree uncommitted (merged.json, pages/start/start.ts, the deleted sketch
folder), and its only change to the part is `madeBy` gaining `'design check'`. Cause (doc agent, from the
code): accepted-pictures.ts:307 opens the edit sketch with `author: 'design check'`, and the merge adds the
sketch author to `madeBy`. So a check tool is recorded as a maker, and Tom was asked to pick between two
variants that differ in no picture. Why no tool caught it: no spec asserts that a merge adds only human or
agent makers, and the build-ready rule "an automatic merge only when no picture changes" is not applied to
edit sketches. Tool fix (B327): an edit sketch whose variants draw the same pictures merges itself as HELD
without a pick; a tool author is never written to `madeBy`; Studio commits a merge it makes (or names the
uncommitted files); specs for both.

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

389\. Builder (2026-11-04, B325): dd708ee4a committed `started-by-studio.spec.ts` with a type error;
`tsc -p libs/cli/tsconfig.spec.json` fails. Why no tool caught it: vitest does not typecheck, the pre-commit gate
runs only vitest, and S7 moved typecheck to CI. Fix (B334): when a staged file is a spec, the gate also runs
`tsc --noEmit -p <lib>/tsconfig.spec.json` for that lib, inside the 60 s budget of S7; if it does not fit, it runs
only the staged specs through vitest typecheck mode.

390\. Builder (2026-11-04, B333): `commit-wait.spec` was red since 2bad713a6 (B328), which added an eslint run over
staged tools/scripts files; the spec's temp repo had no eslint config (fixed in 9f0d70e47). It blocked every later
tools/scripts commit. The gate selects the whole tools/scripts suite for such a commit, so on 2bad713a6 and six later
commits made on the Mac (421d2fee8 to be8aa16b7) the hooks most likely did not run: several carry the scope
`ethlete-studio`, which commitlint never allowed. Verified cause: the Mac checkout never installed husky (`core.hooksPath` unset, no `.husky/_`), so no git hook ran there. Why no tool caught it: nothing checks after the fact that the local
hooks ran. Fix (B335): a CI job runs commitlint and `yarn test:tools` over the pushed range, and pre-push checks
commitlint for each commit in the range; `yarn commit` and the agent session start refuse when `core.hooksPath` is not `.husky/_`; the Mac checkout gets husky installed.

391\. Builder (2026-11-04, B329): the slice built UI that no design draws (the fold toggle "Alle Zustände zeigen" and
the round note as a question line). No check refused it, because none ran: `design compare` of the sketches part
would show the extra UI, and S3's UNCOVERED-REGION too, but S7 moved the Studio rules out of the hooks into CI, and
nothing was pushed. The builder's brief also allowed "keep it minimal" when no design exists. Fix (B336): the commit
gate refuses a staged change to an app component with an `implements` link unless `design compare <part>` is green
at the staged tree, cached per part hash, for the touched parts only; a builder brief never permits undrawn UI, and a
missing design becomes a sketch first.

392\. Builder (2026-11-04, B321 on the Mac): the pixel check run lacked two build steps the handoff did not name
(`nx build cli`, the components build); without `dist/libs/components` the design server hangs on `/__design/system`
instead of failing (the exact wait point is not traced; the CLI guard `guardsDesignMocks` covers `design`, not this
serve path). The paint check then failed over SSH, because the Screen Recording permission holds only for a
GUI terminal. Why no tool caught it: the server does not check its build inputs, and the verify script starts
without a check of what it needs. Fix (B337): the design server answers with an error that names the missing dist,
and `verify-webkit-studio.mjs` checks its build inputs before it starts; a Mac check that needs Tom ships as one
prepared command, not a list of steps.

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

395\. Builder (2026-11-04, B326): the Studio e2e case "Sketches: no state is marked before the compare answers"
(21dcfc17f, 2026-11-03) fails, also on the build before B326. Inferred cause, not run: d2eaac782 (B329/B324 listing
tiers) lets the quick listing return `unchanged` states kept from an earlier full comparison
(`keptUnchangedStatesOf`), so Studio marks them early on purpose, and B329's fold depends on it; 2a1a52628 is a weaker
candidate. Why no tool caught it: `canvas.e2e.mjs` runs only through a manual `yarn studio:e2e`, in no hook and not in
CI; CI on `next` was red on other jobs at that time and nobody triaged it. Fix (B339): `studio:e2e` runs as a CI job.
Tom (2026-11-04): kept `unchanged` marks from the last full comparison may show from the quick listing; a new mark
shows only after the full listing. The case is updated to this rule and still fails on an early new mark.

396\. Builder (2026-11-04, B323): `GET /__design/shot` with `sketch=components/title-bar.code-notice` (the sketch's
folder name) answered 404 "variant a ... has no part components/title-bar", a wrong cause: the sketch exists, only
under the id `components/title-bar@code-notice`. Why no tool caught it: no spec covers the shot route with a sketch
name in the wrong form. Fix (B341): the route accepts the folder name as a sketch id, and an unknown sketch answers
"no sketch <x>; did you mean <id>" from the listing. Lesson: an error must name the input it could not resolve, not a
cause further down.

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

406\. Builder (2026-11-04, S6a check): the product shot of `blockers-open` answered a non-image before the merge, so
the builder could not compare that state. Likely cause (not proven): the product had no `blockers-open` state yet, and
the shot route answers an unclear text for a state the part lacks. Why no tool caught it: the route names a missing
part, but not a missing state. Fix (B341): a state the part lacks at HEAD answers 404 with "state <s> not in part <p>
at HEAD".

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

414\. Builder (2026-11-04, triage of finding 407): the baseline "only the known case red after c348db743" was false.
At c348db743 the known-red case crashed the whole e2e runner (`route.fulfill: Route is already handled!`), so every
later case never ran and looked green. Why no tool caught it: the runner reports the crash, but not the cases it
skipped, and nothing compares the case count with the last run. Fix (B355): an async throw in a case marks that case
FAIL and the runner goes on; the summary names every case that did not run; a run with fewer cases than the file
declares fails. Also (B339): `studio:e2e` runs as a gate on commits that touch `system-view` or `design-parts/sketches`.

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

442\. CI run 41924354824, job WebKit (builder, 2026-11-05): `.github/actions/setup/action.yml` read `/etc/machine-id` on
the macOS runner (from e6b59bdf4). Fixed in f30bb3b81 (machine id per `RUNNER_OS`, macOS through `ioreg`; only the
Linux branch and the fallback were run). Why pre-push missed it: no local gate runs a macOS step. Tool fix (B379,
builder default): a lint check for `.github/actions` and workflows that flags Linux-only paths (`/etc`, `/proc`) outside
a `RUNNER_OS` branch.

443\. CI run 41924354824, job Unit tests (builder, 2026-11-05): only `cli` failed. The `motion-shot.spec` fixture raced a
re-render under load (reproduced with a 300 ms delay; the repro bites on the old code). The `merge.spec` flake (B373)
did not come back in 24 local runs; its assertion now prints the check findings. Fixed in b770d4222. Why pre-push missed
it: CI is much slower (the merge spec file takes 17 s locally and 143 s in CI). Tool fix (B380, builder default): a
stress script that runs the touched specs N times in parallel under CPU load, part of the slice end.

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
