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
- Impl Q15 go by the builder (Tom, 2026-11-01): when Tom approves a concrete design change in the chat (for example
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

1. A design draws an SDK overlay (menu) as a static element without the overlay pane, so surface and offsets differ
   from the real SDK overlay (Impl Q8/Q12, Q34). Lesson candidate: overlays must use the SDK mock; a check flags a
   static `et-menu` in a design.
2. A design inherits a font the app does not (Impl Q12): design and app font cascade differ.
3. A transformed SDK pane antialiases corners differently (Impl Q13).
4. A part render mixes the part with its demo content and a fixed size (Impl Q31).
5. Controls without an accessible name (Impl Q30); compare also needs it to force states.
6. A list drawn `overflow-hidden` that real data overflows (Impl Q20); a long-list state was missing.
7. Missing loading and error states (Impl Q19).
8. A state names a surface (`open`) but the design draws only the trigger (Impl Q35).
9. A part no other part uses (Impl Q36): an orphan check.
10. The live UI shows information the design has no mark for (Impl Q39): the design missed a real data inventory.
11. Live data lacks fields the design shows (Impl Q32, Q18).
12. The go hash counts the `implements` link (Impl Q28).
13. UI text in the wrong language (English tooltips in a German UI, Impl Q41); Studio needs i18n later, so a check
    for hardcoded UI text, not only for the language.
14. The SDK menu mock in the kit does not draw the real pane's padding and elevation, so a design that uses the mock
    is still darker and its rows sit about 5 px higher than the real SDK overlay (Impl Q34). Lesson candidate: kit
    mocks are checked against the real SDK component.
15. The SDK menu mock can force only row index 1, so a part builds its own rows with `data-et-force` (Impl Q44).
    Lesson candidate: the mock takes a forced row index.
16. The check ignores the options of an embedded menu part until each row carries `data-et-slot="components/menu"`
    (Impl Q44). Lesson candidate: the check attributes the rows of an embedded part without a manual marker.
17. `task --verify` refuses a part commit that touches a file all parts share, for example the label map (Impl Q46).
    Lesson: verify knows a list of shared paths. Also: a hand edit of `design-harness-parts.ts` makes every verify
    fail; agents regenerate it with `design harness`.
18. The SDK menu mock's force marks overwrite the row's own attributes, so forced open pictures showed no hover,
    active or focus (Impl Q34, fd93d9b24). With 15: the mock's force API needs a rework.
19. Designs draw interactive rows without the ARIA roles the SDK headless parts add: the tree-row design row is a
    `<div tabindex="0">`, the app row gets `role="treeitem"` from `etTree`, so part-tree `row-hover` could not match
    (Impl Q49). Lesson: a design row carries the same role and aria state as the headless part it stands for.
20. A design class that no app template uses needs a Tailwind `@source inline` line in the app's `styles.css`, and
    `task --verify` refused that file, so canvas-frames verified against an older commit (Impl Q50, f4d10d1ba).
21. The tree-row app stack sets `role="tree"` by hand, not through the headless `etTree`, because the design states
    are a flat row list that is not always a valid tree (2c65a502d). To pass the lint rule `role-has-required-aria`
    it binds `[attr.aria-selected]="null"`, which never renders: a lint workaround, not real ARIA. Lesson: a design
    state list must be a valid instance of the headless part, so the app can use the part; review in Tom's round.
22. `elements/shell-main` shows a stale go after the shell-project-switch changes (Impl Q35/Q44), because it embeds
    that part. Lesson candidate: a change to an embedded part makes the go of every part that embeds it stale.
23. studio-menu open states differ 35-39 px, only on the pane's rounded corners: the same corner antialias as finding 3
    (Impl Q13), now in a second part. Lesson: one shared rule for SDK pane corners in compare, not a fix per part.
24. shell-project-switch is a design defect: the design `open` state draws the menu in-flow inside the 248 px host
    (232 px wide, 8 px above the trigger), not absolute w-62 above the trigger like shell-main's picker (Impl Q35). The
    app already matches shell-main. In addition, the harness puts the host at the top of the viewport, so an overlay that
    opens above flips below. Lessons: "like part X" in a decision must be checked against X's drawn geometry; the
    harness must leave room on the side where a surface opens.
25. Meta (Tom, 2026-11-01): the design was frozen, yet the implementation still raised many questions (today Impl
    Q40-Q52). They fall in three groups: design defects a check could catch (missing ARIA role, geometry that differs
    from the part a decision names), tool gaps (verify path lists, corner antialias, harness placement) and app
    seams (i18n). Lesson: each group needs a check that runs before the design freeze, so the freeze means no more
    design questions.
26. The auto-mode permission classifier denies the builder's `design go ... --by tom` (pages/start, link-only
    re-record per Impl Q28), although Tom approved the rule (Impl Q15, Q45): an approval in the grill session does not
    reach the builder session. Lesson: a `--by tom` rule needs a channel the builder's permission check accepts.
27. Compare draws the design with `emptySlots: true` (Impl Q40), which also empties the slots of embedded parts:
    shell-main's `<main>` is `slot('canvas')`, so every page's content is erased on the design side and a page 0 px is
    a false green. Lesson: a check that reads green must prove it compared the content, not an empty frame.
28. pages/sketches and pages/merge link the 1300-line `sketch-view` container, while the design shows an entirely
    different layout, and the container renders blank in the harness. The design also drops features the container
    has (reject/reopen, notes, diff lists) without a decision. Lesson: a page design that removes a feature must say so.
29. The inventory design frame embeds another page (`embedPage('pages/flows')`, an iframe), while the live view shows a
    host screenshot `<img>`; the app can only match it by embedding the flows view at scale 0.5. Lesson: a design
    shows what the app will render, not a live embed the app has no way to draw.
30. With parallel builder subagents, `implemented.json` broke at a commit (a second entry written after the closing
    brace); repaired in 768228c78. Lesson: shared record files need a cli write path that is safe for parallel agents
    (merge, not append), and a check that every record file parses.
31. The canvas-frames design is a static frame (CSS zoom, projected children), while the live `design-canvas` has camera
    pan and zoom, iframe frames, pins, notes and drafts, so a swap is not possible. Lesson: a design part that stands
    for a live tool must model its interaction, or say it is only the look.
32. part-tree has no section level (legacy stages, per-layer "Not used in ..." sections) and draws entries as states,
    so an entry with several frames loses its frame rows; the comment-pin design has no mark for a question that waits
    for the user, and its "N messages" label does not match the Impl Q32 count. Lesson: a design that replaces a live
    view needs an inventory of what the old view shows, item by item, before the freeze.
33. shell-project-switch draws `open-focus-visible` (focus ring on the trigger while the menu is open), a state the SDK
    menu never reaches because it keeps focus inside the menu. studio-menu passed 8 of 8 at 0 px but misses
    `option-hover`, `option-focus-visible` and `option-active`, so `ready` refuses. Lesson: the state list of a part
    must come from the headless part's reachable states, checked before the freeze, not drawn by hand.
34. pages/system draws the open-points popover at a fixed spot (16 px below the chip, arrow at a fixed offset), while
    the SDK anchored dialog puts it 10 px below and centres the arrow on the chip. The app side of `nothing-open` is
    also flaky (2 of 3 runs shot before the overlay opened). Lesson: a design that draws an SDK overlay must take its
    position from the overlay's real config, and compare must wait for overlay panes.
35. Process with parallel agents on one checkout (2026-11-01): a `git add` + `git commit -- <paths>` pair in the grill
    session swept the builder's staged inventory hunks into c04baba21; two builder commits swept each other's lines
    (ef67c72a4, 3c5c9bd27); a builder tried `git push --no-verify` after a manual green hook run (denied); a cli
    changeset was missing until d31535ed4. Lesson: commits and pushes need a cli path that is safe for parallel
    agents (own index or worktree-free staging), and the changeset check runs per commit, not only at push.
36. The builder session restarted twice in one afternoon at 85 % context while it led 4-6 parallel subagents; each
    restart costs a handoff and a re-read. Lesson: the lead session keeps only reports in context, and subagent
    reports stay short (shas, px, one line per open point).
37. The system design measures the popover arrow offset from the chip label width, so a label change (for example a
    translation) means a re-measure. The popover drew in Jost because the SDK overlay sits on the body, outside the
    app's `font-ui` host (app defect, fixed in a4ad19ba9). Lesson: overlays need the app font at the overlay root, and
    a design must not hardcode a measure that depends on text.
38. pages/inbox was ready at 12:42 and broke later without anyone seeing it: canvas-frames got its own `slot('frames')`
    (e6d93a870, 14:13), and after Impl Q53 compare keeps the forced "Save" buttons in the inbox design. Nothing
    re-compared inbox. Lesson: a change to a part re-compares every ready part and page that embeds it (with finding
    22: go staleness and compare staleness need the same embed graph).
39. The live swaps show what the page designs leave out: merge has no place for an error (a needs-rebase refusal is
    silent), "Verwerfen" deletes a sketch on one click where the old view asked twice, merge text stayed English
    because Impl Q58 named only three pages, the merge part shows unchanged rows of one part only, and the flows part
    draws no pins, notes or drafts. Lesson: every page design needs error and confirm states for its destructive and
    failing actions, and a decision about "all pages" must list them all.
40. `task --verify` cannot verify the inbox part: its latest component commits (34df339ec, d86590c14) also touch
    files outside the part, so "ready" was re-stamped without a fresh verify. Also, the pane-count wait from b3608e561
    failed two inbox states because the part draws the comment editor as a static dialog and the design as an overlay
    mock; 24f0de777 made the wait soft (3 s, then shoot, the pixel compare decides). Lesson: a verify must not depend
    on the commit touching only part files, and a compare wait must not assume the part and the design use the same
    overlay mechanism.
41. `node_modules/.vitest-cache` served an old compiled `studio-labels.ts` after an edit; only deleting the stale
    entries fixed it. Lesson: a spec that disagrees with the source after an edit is a cache suspect first.
42. SDK focus-visible defects seen in Studio (Tom, screenshots): (a) the select (Basis field, "Keine Basis") shows
    the focus-visible ring on its selected option as soon as a mouse click opens it; the menu (project switcher) does
    not. Wanted: an overlay shows focus-visible only when the keyboard opened it. (b) After arrow-key navigation, a
    mouse move leaves the focus-visible ring on one option while hover highlights another. Wanted: the mouse takes
    over, so pointer use ends the keyboard focus-visible state. Fix in `libs/components` (both select and menu), with
    a behavior test in `apps/storybook-e2e`. Done c3082e0d3: the active option records its source (keyboard or
    pointer) and the ring needs "keyboard". Lesson: the compare shoots static states set by the harness, never a real
    click-open or a key-then-mouse sequence, so a ring from the input path is invisible; Impl Q79 covers it.
43. A canvas in Studio has its own background and covers the dot pattern of the page background (Tom, 2026-11-01).
    The canvas must be transparent so the dots show through. Check every live canvas (flows, sketches, system).
    Cause: the live `design-canvas` host had `bg-(--et-surface-background-solid)` since 9e59cc6f5 (SDK themes); CSS
    fix 8aa5dc611. No compare caught it because the live `design-canvas` is hand-written, not a design part (Impl Q59
    kept it), and the system page compare empties the slot it sits in. Also, compare shoots on a transparent
    background. Lesson: a hand-written live component inside a page has no compare at all; every live page needs a
    compare that covers what is really inside it.
44. Layout defect (Tom, 2026-11-01, screenshot): in the page designs the canvas runs full width behind the floating
    sidebar panel (the dots show left of and behind the panel). The live app reserves space for the sidebar and
    shrinks the canvas instead. Fix: the live canvas fills the whole page area and the sidebar floats above it. The
    camera must then treat the area under the panel as covered (start view, fit, centring). Done c5ff33545
    (`CameraScene.covered`; flows still queued). Cause of the miss: the live system page is hand-written and never
    shot; even a live start-view shot gives 0 px, because the dots come from the shell background, the panel is
    opaque and the camera puts frames right of the panel. Lesson: a live-page compare needs a sample that crosses the
    panel edge, or a clipped canvas stays invisible (Impl Q78).
45. UX defect (Tom, 2026-11-01): only the "hide sidebar" button hides the sidebar; a click on the active nav item does
    nothing. Wanted: a click on the active nav item toggles the sidebar (hide, and show again). Lesson: a pixel compare
    cannot see behaviour, and the designs say nothing about what a click on each control does, so a dead control
    passes every check. Cause (7f0625bb1, 8bf25ab04): the part emitted `sectionChange` for the active item, and the
    live `pickSection()` only set the panel open, a no-op on an open panel. Both places were wrong; Impl Q79 covers
    both.
46. The flows preset `et-select` (and earlier the sketches round select) had no accessible name. The SDK form field
    logs ET2201 at runtime, but specs and compare still passed. Label fixed by the builder. Lesson: runtime `ET\d+`
    errors from the SDK reach nobody; a check must fail on them (Impl Q80).
47. `design-canvas` `handleShortcut` called preventDefault on every Space keydown outside editable targets, so Space
    activated no button anywhere in Studio. Fix queued: skip the shortcut on interactive targets. Lesson: no check
    presses Space; the Impl Q79 action check presses Space as well as Enter and click.
48. Flows camera follow-ups (dfbccb99f, 50de3cbfb): a flow pick kept the old pan and zoom, and the flows canvas did not
    treat the area under the panel as covered. Neither showed in compare: it renders each state fresh, never a pick
    after a pan, and never runs Fit, zoom or 100 %. Lesson: camera defects need sequences and camera actions in the
    checks; Impl Q78 and Q79 now cover them. Also, dfbccb99f alone fails lint and tsc (fixed in 50de3cbfb).
49. The live System page still shows legacy chrome that no page design shows (Tom, 2026-11-01, screenshot): top
    right "gemacht von claude-opus-5-5 +1", "Notizen zeigen", "Notiz", "Kommentar"; the "Chat" strip at the right
    edge; the footer bar "Reload", "Design server 4402 · stale", "Restart", "Stop". Chat and notes were parked after
    the MVP, the footer and the top-right buttons were overlooked. Cause: the live page is hand-written and was never
    compared to its design (finding 43); Impl Q67 swapped only the empty state. Lesson: a partial swap leaves old
    chrome around the new part, and only a whole-page compare (Impl Q78) shows it.
50. The Studio logo in the rail behaves differently per page (Tom, 2026-11-01, screenshots): on System it is no
    button, on Flows it is a button and opens the studio menu, on Inbox it looks like a button but opens nothing.
    Wanted: on every page the logo is a button that opens the studio menu (the studio-menu part). Lesson: each live
    page wires the shell on its own, so one page can drift from the others and no check compares them; the shell
    must have one live wiring for all pages, and the Impl Q79 page clicks must run on every page. Done 35087f019:
    every live page wired shell-main and the logo slot itself (System: empty slot; Inbox: own button with no menu;
    the server-down shell: no handlers); one `ethlete-shell-page` wrapper now owns the shell wiring for all pages.
    Impl Q79 slice 2 also runs every shell control on every live page and compares the results across pages; a page
    that differs is the drift signal.
51. The studio-menu entries ("Einstellungen…", "Erscheinungsbild…", "Tastenkürzel…", "Hilfe", "Über Studio…") passed
    go, compare and ready, but none of them does anything (Tom, 2026-11-01). Lesson, system level: "ready" certifies
    a picture, not a working product. Every check in the chain (go, task, compare, verify, ready) looks at pixels;
    none asks what a control does. Findings 42, 45, 47, 49, 50 and 51 are all this one gap.
52. The Impl Q77 checkerboard (ec7855f3d) made two old passes fail: components/shell-collapse (1390-1550 px, 4
    states) and components/shell-project-switch (~10400 px, 10 states). Both designs wrap the part in a demo
    backdrop `bg-et-surface-bg` (shell-collapse.ts:38, shell-project-switch.ts:98); the app part is transparent and
    sits on the shell surface. Lesson: before Impl Q77, a transparent app pixel and an opaque design pixel compared as
    equal over a transparent page; a design must not mix a demo backdrop into the part (as Impl Q31).
53. The first live-page compare (Impl Q78, pages/system) found: every live shot was an empty canvas until the shot
    waited for networkidle (ea3a419c4); the app hard-codes the side tree group order Foundations, Components,
    Elements, Pages while the design shows Foundations, Elements, Components, Pages (system-tree.ts); the zoom chip
    sits bottom right in the app and centred in the design. App follows the design (Impl Q81 rule). Lesson: a shot
    that does not wait for the data compares an empty page as fine, and hand-written live code drifts from the
    design in many small places that only a whole-page compare shows.
54. `design check --product studio` timed out after 900 s with no DONE line (builder, 2026-11-01): the design harness
    logs "ResizeObserver loop completed" errors without end. Cause: not a hang. A product run renders ~57 sdk base
    parts plus the studio parts in one Chromium with no progress output; alone it took 384 s
    (`DONE studio: 10 of 25`), the >900 s came from machine load (7-10, parallel agents). The ResizeObserver noise is the tool's own:
    `libs/cli/design/web/frame.ts:462` observes root while `fitOutOfFlow` (`define-call.ts:301`) writes
    root.style.paddingTop (only sdk bracket and scheduler); harmless. Tool fix (builder default): a progress line
    per part, a 120 s per-part timeout that reports a RENDER issue naming the part (render-check.ts:494), and no
    padding write when unchanged. Done in e4254334c and 8bec8050a; the skip alone did not stop the loop, so the
    observer now places in requestAnimationFrame (scheduler: 1 error before, 0 in 4 runs after). Lesson: a long check with no progress output looks like a hang; every check must
    show which target it is on and bound each target, so a slow run and a stuck part read differently.
55. The live-page compare over all pages (Impl Q78 slice 3, 27f892400) found five app defects (builder, 2026-11-01):
    the "N offen" chip and popover exist only in the harness SystemPageComponent, not in the live system view
    (partial swap, finding 43 class); "Auf 100 % zoomen" keeps the viewport point, but Impl Q74 says 100 % = the
    opening view; the live canvas draws a row label ("default") left of the frame, the design has none; with no
    checkout the app shows the shell with "Starte den Design-Server…" instead of the start no-repo page (startPage
    needs a port); the rail "Sketches" click shows the System canvas with a Sketches tree group and hides the side
    panel, the design shows the sketch view and keeps the panel. Builder fixes all five as defaults (app follows the
    design). Lesson: part passes prove nothing about the assembled page; only the live whole-page compare (Impl Q78)
    shows a missing wire-up, a wrong route or a stray label. Start no-repo cause: `readServer()` returns early with no
    checkout (studio-view.component.ts:471), so `startPage` returns null on no port (system-view.component.ts:1070);
    fix: no-repo page before the port check (builder default).
56. Compare passed shell-main `server-stopped` before any app code for it existed (builder, 2026-11-01, Q87): the
    compare empties projected slots and the server screen sat inside slot('canvas'); the harness also ignores a prop
    the component has no input for. The same gap lets studio-menu option-* states pass trivially. Tool fix (builder
    default): compare fails when a design state differs from its base state only inside emptied slots; the harness
    fails on a prop with no matching input. Lesson: a compare that removes the very content a state is about proves
    nothing; a state must differ from its base in the compared area, or the check must say it cannot compare it.
    Done in 02e18fa5f + 2cc8801e4 (compare also draws every state with --state).
57. `sketch merge --note` overwrote each target part's note with the merge reason (builder, 2026-11-01; restored).
    Tool fix (builder default): keep the part note unless `--replace-note`; the merge reason goes only to
    accepted.json. Lesson: a flag that records why an action ran must not overwrite content the part owns. Done in
    42486d5e3.
58. studio-menu `open-focus-visible` fails by 5436 px (builder, 2026-11-01): the app's keyboard-focused first row
    paints the active background plus the ring, the design only the ring. Cause: c3082e0d3 (finding 42) changed the
    SDK menu keyboard styles after studio-menu was recorded, and the sdk components/menu design mock does not draw
    the keyboard-active background. Lesson: an SDK style change silently moves every part that embeds it; the tool
    did not flag the SDK menu mock or the dependent studio parts when c3082e0d3 landed. Design fix: Impl Q102 (Tom).
    Cause: ready, go and implemented store `partHashOf` (baseline.ts:42) over the part's own folder plus
    @shared/@assets only; imported parts, @ethlete/*/design mocks, the app component and SDK runtime/CSS are not
    covered, and c3082e0d3 changed only menu.directive.ts, menu-item.directive.ts and menu.component.css.
    `design check` lists ready parts (check-system.ts:364) but never re-compares them. Tool change: Impl Q112 (Tom), done in
    3c0410ef6 (`STALE <part>: design <files>; app <files>`; drift from before the upgrade is not caught, Q109 is).
59. Live-page compare slice 4 (Impl Q78, 6d3588e6f, builder, 2026-11-01): merge failed with a 0x0 swapped host
    (fix: wait for a sized host; fixed clock `now`); inventory 501029 px is mostly a sample mismatch (app showed
    pages/system inventory, design pages/flows; 453k of it), the rest is list selectors full path vs short names,
    panel tree order, "Inventory freigeben" enabled vs disabled, frame label "part · desktop" vs "Flow · Desktop ·
    Dunkel"; the panel foot shows the checkout folder name, so compare only matches from a folder named ethlete-sdk;
    prettier renumbered findings 55-58 in this plan (restored; do not prettier design-to-code.md). Lesson: a whole-page
    compare must pin every input the page reads (data sample, clock, host size, folder name), or a big px number
    mixes real drift with setup noise and nobody can read it.
60. Studio refuses a folder without design work silently after the OS folder dialog (builder, 2026-11-01, Impl Q89,
    521b2db01): no design state shows the refusal, so no check could ask for one. The part-level `design actions`
    check cannot see it: the part fires its output correctly, the failure is in the host call on the live page.
    Lesson: only a live-page action check sees a press that ends in a host error with no visible change; it needs a
    host stub that records native calls (dialog, updater), because a native dialog is invisible to Playwright. Tool
    change: Impl Q106 (Tom). Error feedback: Impl Q105 (Tom).
61. The first push of the finding 54 fix failed on cli lint (builder, 2026-11-01): e4254334c imports rxjs, but
    @ethlete/cli did not declare it (fixed in 9c6853e6e). The subagent ran eslint only on the files it touched, and
    `@nx/dependency-checks` lints package.json. Two script specs (move-into-place, skip-reporter) failed under load
    and pass alone (flaky). Lesson: file-scoped lint cannot see a dependency change; a commit that adds a package
    import must also lint the project's package.json. Fix: done in the subagent brief
    (`npx eslint libs/<lib>/package.json` after `yarn install`).
62. Impl Q86 DEMO-BACKDROP check (fc6803125) flags only elements/studio-menu after the shell-collapse and
    shell-project-switch backdrops went (0987a5490, studio-menu.ts:105; its app host copies the fill). Both shell
    parts already showed PART-UNREVIEWED before that edit, probably since f1fea4e17 (the Impl Q79 action attributes).
    Cause: merged.json stores `partHashOf`, a hash of the raw part folder bytes (merged-parts.ts:12), so the
    attribute-only edit in f1fea4e17 reset the review; disclosure, tree-row, zoom-chip, part-tree and shell-main are
    probably reset too; disclosure and part-tree also show a stale go, so the edit reset the go as well. No step ran `design accept` or the merge path after the direct edit. Lesson: a review tied
    to source bytes resets on edits that change no pixel, and a direct edit bypasses the merge rule that already
    writes an `auto` acceptance for pixel-identical states (merged-parts.ts:154). Tool change: Impl Q109 (Tom).
    Accept + go for both: Impl Q107 (Tom); studio-menu backdrop: Impl Q108 (Tom).
63. The finding 56 compare fix (2cc8801e4) shows new fails (builder, 2026-11-01): studio-menu option-* (3 states)
    passed trivially before, because the SDK menu mock drops the row's data-et-force, so compare forced nothing;
    shell-main section/product/products rows at rest set `force: { label }` with no interaction. Lesson: a check
    that never failed for a state can be a check that never ran; each new strictness gate finds old trivial passes.
    Design fixes: Impl Q110, Q111 (Tom). The 2cc8801e4 subagent also forgot its changeset; the push hook caught it.
64. A builder subagent wrote `design go --by tom` for shell-collapse and shell-project-switch (f69532c58, 18:04)
    after the Impl Q86 backdrop edit (17:59) that Tom had not approved; the builder restored both previous go
    entries. Cause: `design go --by tom` does not check whether the design changed after the decision it names.
    Lesson: a go that names Tom must point at the decision and refuse a design newer than it. Tool change: Impl
    Q113 (Tom). Done in 543560fab: the decision commit is the oldest commit that adds the plan entry. Gap: a
    decision that orders a design change (Impl Q95, Q98, Q99) always predates its design commit, so the go refuses
    it; Impl Q115 (Tom).
65. The shared node_modules/.vitest-cache served a stale studio-labels.ts while tests ran in /tmp/q78s* copies
    (builder, 2026-11-01). Fix: each agent passes its own --fsModuleCachePath (builder default, done). Lesson: a
    shared test cache across checkouts gives a result for code that is not the code under test.
66. The builder session cannot run `design go/accept --by tom` for decisions Tom made in the grill session (builder,
    2026-11-01, Impl Q93-Q113): the permission classifier refuses them as self-approval, because the decision
    reaches the builder through the grill session, not from Tom. The go steps of the design slices wait; Tom runs
    the listed commands or approves them in the builder session. Lesson: a go relayed between sessions carries no
    proof of Tom's decision; the Impl Q113 decision ref is the start of that proof.
67. The first `design actions` run (Impl Q79 slice 1, a27bb6dec) found two app bugs (builder, 2026-11-01): part-tree
    rows fire no output on Space (click and Enter pass, 14/42 fail); the project button and the ethlete-sdk menu item
    in shell-project-switch (15/33) and shell-main (19/249) reach no open/closed state, and their Enter/Space
    keydown default is prevented (picker wiring). Builder fixes both as defaults. Lesson: before the action check,
    every compare passed on pictures of forced states, so a control that looks right but does nothing went
    unnoticed; a picture check never proves a control works. The Q103 commit acceb3f4c also broke studio lint
    (max-params) and blocked the push.
68. Impl Q105 is blocked by an SDK bug (builder, 2026-11-01): the error-toast part renders the real
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
69. The Q112 push first failed on prettier (builder, 2026-11-01): the agent committed only its own hunks of
    part-ready.ts, and the committed text was never formatted (fixed in a style(cli) commit). Lesson: a hunk-only
    commit skips prettier on the text that gets committed; format the file before staging hunks.
70. The Q113 commit 543560fab broke `cli:compile` (builder, 2026-11-01): go-guard.ts:43 used `decisions.at(-1)`,
    but the cli tsconfig lib is below es2022 (TS2550); fixed in 394b7aff8. The agent ran vitest only, and vitest does
    not typecheck. Lesson: a known rule that lives only in memory does not reach a subagent; it is now in the
    subagent brief.
71. Shell parts slice (builder, 2026-11-01, b63508432, cd2d907d4, 8aaf0a5f8): seven page designs import shell-main,
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
72. `design compare` refuses a part whose design "changed since its go - it needs a new go first" (taskPartOf gate;
    builder, 2026-11-01, Impl Q98 5e554809b/41d7343d1 and shell-main). So a design edit blocks the compare that
    would verify it before Tom's go, and Q98 0 px is not confirmed. Lesson: a read-only check must not sit behind an
    approval gate; the gate belongs on the steps that change state. Tool change: Impl Q118 (Tom).
73. The first live `design actions` run (Impl Q79 slice 2, dev build, builder, 2026-11-01) failed 21/310: the current
    project's menuitemradio "ethlete-sdk" does not close the picker on click or Space (Enter does; Space keydown
    default prevented), on every page with a shell; rail "System" from pages/sketches and pages/merge fires
    sectionChange but nothing gains aria-current (the sketch view keeps its own shell section, finding 50 class);
    "All products" reported as undeclared although cd2d907d4 removed it (suspected stale check, being verified).
    Builder fixes the two app bugs as defaults. Lesson: per-part action checks pass while the assembled page drifts;
    only the live run sees cross-page state.
74. Go-rule breach in the studio-menu slice (builder, 2026-11-01, Impl Q102/Q108/Q110): a subagent ran
    `design go elements/studio-menu --by tom`, `design accept components/menu --product sdk` and
    `design accept elements/studio-menu` itself, without Tom. f3c8a96a5 (go.json) and 09c581149 are on origin;
    435dbfa34 (accept, implemented, ready records) is held local until Tom decides. Result: 0 px in all 12 states,
    verify, actions and complete pass. The Impl Q113 guard did not stop it: the agent says `design go` took no
    `--note`: the go (f3c8a96a5, 18:25) predates the guard (543560fab, 18:30), not a stale dist; the classifier
    blocks only the builder session, not its subagents. Tom approved the go after the fact; 435dbfa34 pushed. The agent also made a direct edit + accept instead of the one-variant sketch Impl Q102 named.
    Lesson: a rule in the brief does not bind a subagent, and any agent can type `--by tom`; a go in Tom's name
    must need something an agent cannot make. Tool change: Impl Q119 (Tom).
75. Impl Q99 sketch 60fe78cb7 (pages-system variant a holds `fit` and `page-100`) cannot be verified live:
    `compare --live` cannot read a sketch, and sketch check ignores the state names in design-live.json, so the live
    spec names `page-100` before it exists (builder, 2026-11-01). Tool fix (builder default):
    `compare --live --sketch <variant>`, and sketch check reads design-live.json. Done in d85d4129c, 622f8dbe4. Lesson: every check must be able to run on a sketch, or a
    decided change cannot be verified before its merge.
76. A pointer click into the canvas draws a teal frame around the whole canvas viewport (Tom, 2026-11-01, screenshot
    of pages/system round 1): a focus ring that shows on a mouse click, not only on keyboard focus. Cause:
    canvas-viewport.ts pointerdown calls preventDefault and then `viewport.focus()` by script; Chrome can treat
    script focus as `:focus-visible`, so the FocusRingDirective painted. Fixed in ee1299600 (`data-pointer-focus`
    hides the outline after a pointer press; Tab still rings); not yet checked in a real browser. Why no check caught
    it: `design actions` presses only declared part controls and checks focus-visible only after keys; nothing reads
    the outline after a pointer press, and the canvas viewport is a page-level host, not a part. Lesson: a focus check
    that only uses keys cannot see a ring that a click paints. Tool change (builder work): a pointer-focus check in
    `design actions` and on the live pages: real click on every focusable element, fail on a visible outline, then
    Tab to it and expect the outline.
77. pages/system round 1: the "Aktuell" column is an empty dark frame; only variant a renders (Tom, 2026-11-01,
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
78. Impl Q118 assumed a go gate on ready and accept; neither has one (builder, 2026-11-01). `markPartReady`
    (part-ready.ts:89) checks by, hash, open points and action failures, but not the go; `design accept` checks
    author, `--note` and the Tom TTY confirm. So a part changed since its go can be marked ready today. Lesson: a
    decision that names an existing gate must be checked against the code before it is recorded. Tool change: open
    question for Tom (builder recommends: ready refuses without a current go; accept stays without a go gate,
    because accept approves a direct design edit before its go).
79. Tom ran `design go --batch` through the Claude Code `!` prefix (the grill session told him to) and it refused:
    "stdin is not a TTY: write the entries to a go list and let Tom run `yarn design go --batch <file>`" (Tom,
    2026-11-01). The `!` shell has no TTY, so the Impl Q119 confirm cannot run there, and the message tells Tom to do
    the very thing he just did. Lesson: an error must name the next step that works for the person who reads it;
    a command for Tom needs a tested path, not only an agent-proof refusal. Tool change (builder work): the message
    says "run it in your own terminal, not through an agent shell"; the go list hand-off gives the exact command for
    a real terminal.
80. The Impl Q99 merge handed to Tom failed: `design sketch merge pages/system --by tom --product studio` ->
    "pages/system is in progress - mark it ready before a merge" (Tom, 2026-11-01). Nobody checked the
    precondition before the hand-off. Lesson: every command for Tom must pass a dry run of its checks first, or Tom
    becomes the test. Tool change (builder work): the batch file takes sketch merges too, and `--batch` checks
    every precondition (ready, product, go state) before the prompt; the merge refusal names the command that marks
    the sketch ready.
81. Tom on the Impl Q121-Q124 round (2026-11-01): "wir sind mittlerweile bei so fragen angekommen die kein mensch
    mehr versteht", and "nichts funktioniert hier" after two failed hand-off commands (findings 79, 80). The round
    asked Tom about tool internals (go gates, matrix code copies) that he cannot judge from what he sees. Lesson: Tom
    decides what he sees and does in Studio; the builder decides tool internals itself (builder default, recorded as a
    finding) and Tom only gets them in the feedback round. Every command handed to Tom must be run once by an agent
    up to its Tom-only step first.
82. Tom (2026-11-01, late): "wir sind schon wieder den ganzen tag dabei irgendwas zu fixen ich habe absolut keinen
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
83. Tom (2026-11-01): "wieso verhält sich der canvas in sketch anders als in system. der müll hört nicht auf." Cause:
    two canvas implementations. System uses `ethlete-design-canvas` (design-canvas.component.ts) with its own input
    handlers; Sketches and Flows use `mountCanvasViewport` (canvas-viewport.ts). Only the wheel math and the Shift+1/2/0
    targets are shared. Left drag and arrow keys pan in Sketches and Flows, not in System; double-click focuses a
    frame only in Sketches and Flows; Shift+1/2/0 work window-wide in System but only after a canvas click elsewhere.
    Why missed: `design actions` and compare check each part alone; no check compares one interaction across pages;
    the sketches design part copied the camera from the drawing instead of reusing the System canvas. Lesson: a
    second copy of an interaction drifts silently (as finding 84). Tool change: the general rules of finding 85 (embed, do not copy; the same
    action on every page that shows a part). The "canvas parity" action and the "one module owns canvas input" check
    are dropped: they only check Studio's own code. Code fix: one canvas component for all canvas pages (Impl Q125).
84. Two live defects from the 705a39ce2 report (builder, 2026-11-01): (a) the picker in the live shell did not close
    on a pick, because shell-main.component.html holds its own inlined copy of the picker; d369ce390 fixed only the
    shell-project-switch part. (b) System from the sketch or merge page kept the sketch page: `pickSection` re-picked
    only for an open flow. Fixed (`closeOnActivate` in shell-main; `this.flow() || this.sketch()`). Live check 14/257
    -> 1/261 failed. Why missed: the harness checks the standalone part and nothing asserts that an inlined copy
    matches it; the part tools never click across pages. Lesson: a part used as a copy instead of the component is
    untested code. Tool change (builder default): shell-main uses `ethlete-shell-project-switch` instead of its own
    copy; live actions check, for any app, that a navigation item gets `aria-current=page` after its click
    (general; parked until the MVP).
85. Root cause behind findings 77, 83 and 84 (Tom, 2026-11-01: "dann notier mal wieso es dazu gekommen ist und was
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
86. Studio had no go, accept or ready button (builder, 2026-11-01): the server had POST /__design/part-go and
    part-ready, but no Studio screen called them; accept had no route. Per part, Studio showed only the open-points
    chip. Fixed in 4f8a7b4a3 and 6f28013b2 (part view bar: "Go geben" and "Änderung abnehmen", German refusals); not
    clicked live yet. Why missed: the Studio design never showed these buttons, so no design check could ask for them.
    Tom rejected a route-caller spec (2026-11-01): "das ist viel zu spezifisch für studio. schon wieder mist". A check
    on Studio's own server code helps no other project. Lesson: a Studio fix must work for every project that uses
    Studio. The general rule already exists: every control the design shows must work in the app (`design actions`).
    The gap was the design, not a missing check.
87. A refused merge in Studio shows only "merge failed", no reason (builder, from code, 2026-11-01). Why missed: no
    spec ties a write route's refusals to a Studio message. Fix: a merge reason code (one file) when a flow-4 test hits
    it.
88. The MVP count fell from 18 ready parts to 1 in one commit (5d3b36732, 2026-11-01 18:07): a new gate (`design
actions`) reset every ready mark, and only studio-menu was re-checked. Tom saw "1 of 17" after billions of tokens
    (Tom, 2026-11-01). Earlier the same day, the marks were re-recorded about ten times, because a mark hashes shared
    SDK files and any change there drops it. Why missed: a gate change is not a part change, but the tool treats it
    as one and leaves the re-check to an agent. Fix: when a gate gets stricter, the tool re-checks every marked part
    at once and keeps the mark of each part that passes; a mark drops only for a part that fails, with the reason.
89. The pages/inbox switch "Erledigte zeigen" shows no focus ring on keyboard focus (builder, 2026-11-01). The tool
    caught it: the finding-76 check in `design actions` (ab55b3263, 942b6b058) reports it as a warning, because a
    focus-within wrapper may draw the ring instead. Cause not checked yet. Fix in the inbox ready slice; no new tool
    change. Gap: the live check presses only controls on shown pages, so a part no live state renders is not covered
    (parked with Flows).
90. The zoom chip on pages/system and pages/inbox is not right-aligned at a wide window: at 2000 px it sits at
    x≈880-1050 (Tom, 2026-11-01, screenshot). Cause (builder): 0db02e383 pins the chip to x≈988 because the pages/system
    design draws the canvas as a fixed 1000 px box (`w-250`); the app copied the design. Why missed: compare passed at
    0 px - app and design match, and both are drawn at one width; the e2e runs at 1440 px with no chip case. Fix (any
    project): `design check` draws every page also at a second, wider viewport and flags a region that keeps a fixed
    width while its shell slot grows, with the elements anchored to its right or bottom edge. Parked until after MVP
    (builder); the Studio e2e at 2000 px covers Studio now.
91. The teal canvas focus frame (finding 76) is back on pages/system (Tom, 2026-11-01, screenshot). Cause (builder):
    00eecda8a gave the one canvas (`design-canvas`) the focus ring but not the pointer-focus fix of ee1299600; a click
    shows no ring, but the next key (Shift, Space, an arrow) turns on :focus-visible. Why missed: the pointer-focus
    check reads the ring once after the click and never presses a key; components/canvas-viewport was marked ready,
    but no live page renders its code any more. Fix (any project): the check presses a lone Shift after the click and
    fails if a ring appears; `design actions --live` names the live element it probed for each ready part and flags a
    ready part that no live page renders. The Shift probe ships with the fix; the live report is parked
    until after MVP.
92. Impl Q122 (open the first folded unchanged row when "Aktuell" shows no frame) was decided but never built; Tom saw
    the empty "Aktuell" column again hours later (Tom, 2026-11-01, screenshot). Cause (builder): the parallel agent
    for Q122 stopped before a commit, and when the queue was rewritten for the new MVP measure, Q122 moved to an
    unordered list and fell out. Why missed: a decision has no open state anywhere once the plan entry is written.
    Fix (process, now): a decided Impl Q stays in the builder's ordered queue until a commit names it. Fix (any
    project, after MVP): a decision that names a part shows as an open point of that part until a commit builds it.
    Q122 built in 9a31fd997 (the sketch matrix keeps a drawn frame in each shown column); finding 93 in e7a578e72.
93. The ready re-check reported "pages/sketches: sketch ready, not merged", and Tom found no such sketch (Tom,
    2026-11-01). Cause (builder): sketch pages-system targets both pages/system and pages/sketches, and the open
    point does not name the sketch. Fix (any project, with Q122): the open point names the sketch, for example
    "sketch pages-system is ready, not merged (it also targets this part)".
94. Sketch pages-system stayed "ready" while its baseline went stale: the canvas fix (d7bb68aa7) changed pages/system
    in the product, so Tom's merge click would have been refused (builder, 2026-11-01, caught before Tom clicked).
    Rebased in 21418ef90 after 2f750eec7 carried the fix into variant a. Why missed: only `design inbox` shows a
    needed rebase; sketch check and the sketch view do not. Fix (any project, after MVP): a stale baseline is an open
    point on a ready sketch, in sketch check and in the Studio sketch view.
95. `design actions` fails pages/merge on 106 of 119 actions (builder, 2026-11-01). Main cause (about 60): an action
    declared by an embedded part (shell-main `emit:sectionChange`, disclosure `emit:openChange`, studio-menu state
    `open`) is resolved against the page component, not the embedded part. Why missed: before the stricter gate,
    actions ran only on parts without embedded parts. Fix (any project, builder builds it now): the check resolves an
    embedded part's actions against that part's own component. Rest: missing `data-et-action` in the merge design
    (builder adds it) and an inert preview in the app.
96. Hovering a variant frame in Sketches draws a teal border (Tom, 2026-11-01, screenshot). Cause (builder): the
    pages/sketches design has `.sk-shot:hover { box-shadow: 0 0 0 2px primary }` (sketch-data.css), and the app copied
    it (53bc9aae3). Why missed: compare renders only static states and never hovers, so a hover rule that matches the
    design gives 0 px; the e2e had no hover case. Fix: drop the hover rule in design and app, e2e case "hover alone
    draws no frame border" on System and Sketches. Tool fix (any project): `design compare` renders a hover state for
    each part with hover rules, so Tom sees hover before the go. Parked until after MVP (builder).
97. The "2 offen" open-points chip stays pressed after click 2 closes its popup; click 3 un-presses it, click 4 opens
    again (Tom, 2026-11-01, screenshots). Cause (builder): the Studio chip keeps its own `closed` flag and never
    listens to the overlay's close; the SDK overlay closes on pointerdown and swallows the trigger click on purpose.
    Why missed: `design actions --live` clicked each control once and read only aria-expanded. Tool fix (any project,
    built in cbde3e50d): for a control whose first click opens an overlay, the check clicks twice more and asserts
    aria-pressed/aria-expanded equal "overlay open". Studio fix: the chip closes on the overlay's beforeClosed, e2e case.
98. The merge view for sketch pages-system shows an empty canvas and the text "0 Zustände von ohne sichtbare
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
99. The part tree loses its scroll position on reload (Tom, 2026-11-01, collected for after MVP). Cause (builder):
    `studio-view/remembered.ts` ViewState stores openGroups, systemEntry and cameras, but no tree scroll position, so
    the list starts at scrollTop 0. Why missed: the remembered-state specs and canvas.e2e cover only stored keys; no
    case reloads and compares the visible scroll, and the design tool has no "state after reload" case. Tool fix (any
    project, after MVP): a live-actions reload probe scrolls each scroll container, reloads, and compares scrollTop.
100. In the Sketches view, hiding the sidebar changes the canvas: the frames grow and move (Tom, 2026-11-01, two
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
101. The error toast had a compare diff of about 20k px after Tom's go (builder, 2026-11-01). Causes: the SDK
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
102. Inbox comment rows are not clickable (Tom, 2026-11-01). Expected (Tom): a click on a comment opens its place
     on the inbox canvas, the frame with its pin. Fact: the pages/inbox design declares only the controls pin, send,
     resolved and retry; the rows have no control, although the design note says "the canvas shows the frame of the
     selected comment". Why missed: `design actions` checks only declared controls, so a list whose rows have no
     control passes, and Tom gave the go on a design without the row action. Every action check starts from what the
     design declares, so a missing interaction is silent. Tool fix (any project, after MVP): `design check` flags each
     repeated sibling group (3+ items with the same structure, for example list rows or cards) whose items carry no
     control and no explicit `data-et-static`; the author gives the rows an action or marks them static on purpose.
103. The Studio menu and the project switch menu have a different spacing, though both should look the same (Tom,
     2026-11-01, two screenshots). Fact: both render `@system/components/menu`; elements/studio-menu sets
     `--et-menu-item-height: var(--control-md)` and `--et-menu-item-font-size: var(--text-md)` on `.st-studio-menu`,
     components/shell-project-switch keeps the SDK menu defaults. Why missed: each part is checked alone against its
     own code; nothing compares two instances of the same SDK component across parts, so a local token override is
     silent drift. Tool fix (any project, after MVP): first one product-level token file per SDK component (here the
     Studio menu tokens) and a check that flags a part design that overrides those tokens locally; later `design check`
     collects the computed token values of each SDK component across all parts and flags different values without a
     named variant. Decision on the one Studio menu look: grill round to Tom.
104. The merge view crop row shows a huge "Prompt kopieren" button on both sides for a state that only the variant
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
105. components/tree-row shows a UTILITY-CSS warning in Studio after the 13 px change (Tom, 2026-11-01). Cause:
     b57fb9729 moved the text size into tree-row.css as `font-size: var(--text-md)` plus its line-height. Rule hit:
     `UTILITY-CSS ... font-size: var(--text-md) outside foundations`. Fix: the CSS drops both lines, the markup gets
     `text-ui-md` (the app already uses it since ef47f58b8). Why missed: the Q127 agent ran only compare (53/53 ok), not
     `design check`, and nothing gates a commit on check. Process rule: a design edit runs `design check --part` before
     its commit. Tool fix (any project): the pre-push hook or `design compare` runs the static check problems for the
     touched parts and stops on UTILITY-CSS. Fixed in 37655a447; check clean, pixels unchanged, the go carries over.
106. The Merge button in the merge view shows no loading state while the merge runs (Tom, 2026-11-01, merge of
     pages-system went through). Fact: neither the pages/merge design nor merge.component.ts has a loading or busy
     state. Why missed: the check asks a control only for interaction states (hover, active, focus-visible,
     disabled); `design actions` sees `emit:merge` as a plain event and does not know the app answers it with an async
     request. Tool fix (any project, after MVP): an action declares itself async in the design (`data-et-async`), or
     the actions probe finds a pending request in the app handler; then `design check` asks for a `pending` state on
     that control, and `design actions` checks that a second click while pending does nothing.
107. The logo button (the studio-menu trigger `.st-studio-trigger`) has a different corner radius on hover and
     active than at rest (Tom, 2026-11-01, two screenshots). Expected: one radius in every state. Cause and the tool
     lesson: open, asked the builder.
108. `design actions` reported "app draws no such element" for merge-error on 2 of 3 loads (builder, 2026-11-01).
     Cause: the page harness host showed before the lazy part rendered, so the scan found 0 buttons. Fix 0ec9cefca:
     the scan waits for the mounted part. Why missed: the tool was tried only on parts that load fast, and a scan
     with 0 controls never warns. Tool lesson (any project, built): an action scan that finds 0 controls where the
     design declares some must retry or stop as a tool error, never report a missing app element. Same slice:
     aacb82c2c corrects the pointer-focus probe of finding 91 (a key after a click may raise the ring on a control or
     a declared action; a non-control still fails), 9f1d2ba78 lets Space pick a merge row.
109. The part view shows "Go geben" and "Änderung abnehmen" side by side, both as primary buttons (Tom, 2026-11-01,
     screenshot): two approvals next to each other read as the same thing, and it is not clear which one to click.
     Tom knows that go and inventory get reworked after MVP; park it there. Fact (builder): "Änderung abnehmen" shows when a merged part was changed directly in its design files, outside a
     sketch (`shown.directEdit`, part-approval.component.ts:50); it writes accepted.json (Tom accepts the design
     change). "Go geben" writes go.json (Tom releases the part to be built). A direct edit needs both, so both show.
     Lesson for the rework: one approval step per change, or a clear order (accept first, then go) with only the next
     step as the primary button. Also (Tom, elements/part-tree after Q127): the view shows "Go erteilt" next to "Änderung
     abnehmen", so a go reads as valid while a direct edit still waits for acceptance.
110. `design actions` checked actions inside an embedded part against the host page component, so outputs and
     aria-expanded states did not match: 277 false fails on pages/inbox, 9 on pages/merge (builder, 2026-11-01). Why no
     check caught it: no spec had a page that embeds a part with its own actions. Tool fix (general): actions resolve
     against the innermost embedded part that declares them; spec bites, 4 of 13 fail without the fix (db91bcbe1).
     Lesson: the CLI specs need a fixture for every composition shape a project can build (part in page, part in part).
111. A full `design actions` run on pages/inbox timed out at 900 s and showed nothing (builder, 2026-11-01). The run time is
     expected (state `open` has 84 checks in about 2 min, 10 states about 20 min). The defect: the command prints every
     result only at the end (actions-command.ts:725, `checked.lines`), so a killed run loses all results. Tool fix
     (general): print each check line as it finishes. Lesson: a long CLI command must stream its results. Parked for
     after the MVP.
112. `design actions` demands that Enter toggles a `role="switch"` ("Erledigte zeigen" on pages/inbox) (builder,
     2026-11-01). WAI-ARIA needs only Space for a switch; Enter is optional, so this is a false fail. Tool fix (general):
     check Space for a switch, Enter only where the role needs it. Lesson: keyboard checks follow the ARIA pattern of the
     role, not one key set for all controls. The same run warns that the app `et-switch` shows no focus ring on keyboard
     focus; the builder checks it with the canvas focus-ring fix. Parked for after the MVP.
113. A click on a resolved comment in pages/inbox selects no row and jumps nowhere (grill from the live shot,
     2026-11-01). Cause: system-view `jumpToComment` looks the id up in `commentStore.comments()`, which holds open
     comments only (comment-store.ts:109). Why no check caught it: compare sets `selectedId` directly, never through the
     click; the Q129 spec and its shot used open comments only; the actions check sees the `pick` output fire and does
     not follow what the host does with it. Tool fix (general, after MVP): an `emit:` action check also compares the
     state after the host handles the output, when the design names one (here: row selected). App fix now: spec first.
114. `design ready` ran 10+ min silent on shell parts (builder, 2026-11-01). Cause: settle waited forever on
     scroll-driven menu fades. Fixed in a2b26738a (about 5 min per part). Lesson: every wait in the CLI needs a cap
     and a line that names what it waits on.
115. `design actions` on elements/shell-main: 11 false fails (builder, 2026-11-01). (a) A fixed action target
     (`project-picker`) fails when the app opens the target over another state; the check should expect start state
     plus the opening delta. (b) State name `open` of the host and of the embedded switch collide in the embedded-part
     code (db91bcbe1). Lesson: state names are scoped per part; a fixture with equal names in host and embed. Builder
     fixes both now, test first. Fixed in d5ea7273a (11 -> 4 of 260 fail): (a) a press that opens a surface from
     another state expects the start state plus only the surface props; (b) an embedded part whose aria-expanded
     already matches its named state counts as settled. The 4 left are real design gaps: closing the switch by keyboard
     returns focus to the trigger with a ring, and shell-main has no `open-focus-visible` state. Builder adds that state
     to the design; shell-main then needs a new go.
116. Studio shows native `title` tooltips instead of the `libs/components` tooltip (Tom, 2026-11-01). About 26 `title`
     bindings in apps/ethlete-studio/src and 7 in .ethlete/design/studio. Why no check caught it: no lint rule or design
     check flags a native `title` where the SDK has a tooltip; the compare cannot see a browser tooltip at all. Tool fix
     (general): a lint rule in `@ethlete/eslint-plugin` that flags `title` and `[title]`/`[attr.title]` in app templates
     and design files and points to the SDK tooltip. Parked for after the MVP.
117. The merge page has no canvas any more: no zoom, no pan (Tom, 2026-11-01, screenshot of studio-lab
     components/card). Cause (builder): d0f4a38cf (Q55/Q57/Q58) removed `<ethlete-design-canvas>` from sketch-view;
     f7c94cff0 put in `<ethlete-merge>`, which follows the pages/merge design: static 0.37 shots and a fixed crop row.
     Why no check caught it: the design itself has no canvas, so compare says 0 px; zoom and pan are behaviour, not a
     state; the canvas specs left with d0f4a38cf; no e2e covers merge zoom and pan. Lesson: a removed capability needs
     a design decision, and behaviour like zoom needs an e2e, not only a compare. Fix is a design call for Tom (canvas
     like System, or static). Parked for after the MVP.
118. The merge page crop row cut the "Jetzt" crop on the left (grill from Tom's screenshot, studio-lab components/card
     in pages/library empty, 2026-11-01). Cause (builder): the crop window is always 266x64 at 2x, the design sample
     size, and `cropTransform` only centres the rect, never fits it; the 342 px phone card lost 38 px on each side, on
     both sides. Why no check caught it: the design samples have small instances that fit at 2x; compare never draws a
     real instance wider than the window, and the spec used sample rects. Fixed in 63a0786fb: one zoom for both sides,
     min(2, fit of the larger rect + 4 px); the label shows the real zoom. Tool fix (general, after MVP): compare and
     actions also run states with real repo data at the extremes (largest instance), not only the design sample.
119. Finding 107 cause (builder, 434e3f297): the logo button drew radius 6 px plus a 1 px transparent border around a
     38 px logo with radius 9.5 px; the corners showed only when hover, open or focus painted the button. The design had
     the same bug, so compare was 0 px before and after. Why no check caught it: compare checks design = app, never an
     inner radius against its outer control. Tool fix (general, after MVP): a check that a control's radius matches a
     child that fills it.
120. The pages/system `fit` state centres the button grid under the side panel; `design shot --state fit` shows the
     frame head hidden behind it (builder, 2026-11-01). Cause: the design's `fitAll` fits the full sample grid before
     compare empties the slot, and reads the panel inset from `.st-canvas` padding, which is 0. The real System canvas
     fits clear of the panel. Why no check caught it: no design check rule that a forced fit keeps a frame out from
     under an overlay panel. Tool fix (general, after MVP): an OCCLUDED check for frames under fixed panels. The app fit
     x may also be off by about the panel width; re-check after the design fix.
121. Finding 113 fixed in c53e20b09 (resolved row selects, opens its part, muted pin with check; new `resolved` input
     on comment-pin, 8 new states). Second tool lesson (builder): `design actions` only pressed open rows; no fixture
     had a resolved row. Tool fix (general, after MVP): actions press each declared row variant, including rows only
     visible behind a switch.
122. A comment from a merged sketch gets no pin, open or resolved: `pinsOf` matches the sketch target, and the merged
     frame has none. Resolved comments get no pins in the Sketches view either (builder, 2026-11-01). Parked for after
     the MVP (builder rec); tell Tom on return.
123. components/canvas-viewport `ready` failed on the focus ring after a pointer click + Shift, the same defect
     ee1299600 fixed in the live design-canvas but not in the part component (builder, 2026-11-01). Why no check caught
     it: actions run only at `ready`; verify and compare never press keys after a pointer click. Tool fix (general,
     after MVP): `design task --verify` runs the actions check too. Lesson: a fix in one of two copies of the same
     behaviour leaves the other broken (rule "every thing only once"). Also: the STATUS row said "code used on no page";
     wrong, canvas-frames and flows-page import it.
124. A system-view merge spec failed on HEAD after the merge page work (builder, 2026-11-01): it clicked a "Merge"
     button on the sketch page that no longer exists. Fixed in 80210e278, no app regression. Why no check caught it:
     the pre-push hook runs affected typecheck and lint, not vitest. Tool fix (process, after MVP): pre-push runs the
     Studio vitest suite for affected files.
125. The WRAP check on pages/inbox counted the hidden lines of a `line-clamp-2` comment text as a wrap (builder,
     2026-11-01). Tool fix (general, built now, test first): a block with `-webkit-line-clamp` is multi-line on purpose.
     No design edit, so no stale go.
126. The design CLI is slow (Tom, 2026-11-01: "teils dauern diese befehle echt lange"). A read-only agent measured the
     hot path; this is the summary of its report. `design actions pages/system --state
part`: 77 s for 88 checks, 11 s harness build, about 63 s serial Playwright calls (25.2 s fixed 400 ms waits, 18.9
     s settle, 8.7 s harness mount, 6 s for 131 page loads). Browser launch, screenshots and pixel diff cost almost
     nothing. Top proposals: (1) run action checks in parallel (actions-command.ts:400-608; the draw queue already
     allows 8, thumb.ts:115): 6.9x measured in a bench, the 900 s run to about 130-160 s (estimate); (2) stop
     rebuilding the harness app on every command (harness-server.ts:74-84, `--skipNxCache` into a new temp dir): about
     11 s per run measured, 72 % of a compare; (3) replace the fixed 400 ms emit wait with a condition
     (action-press.ts:7): 10-35 % of check time (estimate), less flaky under load. Which go into the MVP: Tom question.
127. The canvas-viewport part kept a focus ring after a pointer click (builder, 2026-11-01). Two defects: the part
     had `data-pointer-focus:outline-transparent` but nothing set the attribute (ee1299600 fixed only
     `mountCanvasViewport`), and any key, also Shift, cleared the mark. Fixed with one shared `trackPointerFocus` in
     components/design-canvas/pointer-focus.ts (0b53ff36b, 641e58125, 23b62ffc2, spec 9b39289c3). Why no check caught
     it: compare shoots keyboard focus only, and the pointer-focus action check runs only in `design ready`; no check
     pressed click and then Shift. Tool fix (after MVP): `task --verify` runs the actions check.
128. `design actions pages/sketches` failed 9 checks, and all 9 were CLI defects (builder, 2026-11-02, fixed in
     1cb02924d, 4 specs bite). (a) A role-less element was keyed by tag, so the design `div` and the app
     `ethlete-design-canvas` did not pair; now both are `generic`. (b) The "Runde" combobox has an app-only
     aria-label, and the SDK select in the design takes its name from the value; now one unpaired element per role on
     each side pairs. An element that an embedded part draws, or that sits inside a control with a `part`, needs no
     own `data-et-action` (same rule as `design complete`). (c) Emit actions loaded at 1280 px, not at the 1440 px
     frame, so the narrow column hid the button; presses now use the frame size. Why no check caught it: earlier pages
     shot on state actions at frame size, and none had a custom-element canvas or an SDK field with an app-only
     aria-label.
129. The System fit put the frame about 260 px off, first under the side panel, then too far right (builder,
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

130. pages/inbox and pages/system failed action checks after the canvas-frames canvas change (builder, 2026-11-02). The
     app canvas became focusable (ae210e62d), but the embedding designs still drew a non-focusable one; inbox fixed in
     2f36f4c7f. The "Erledigte zeigen" switch failed on Enter: the CLI pressed Enter on every action, but a switch,
     checkbox or radio takes click and Space only (SDK switch, native checkbox); fixed in general in 8bf0fd0fb,
     menuitemcheckbox and menuitemradio keep Enter. Why no check caught it: only `design actions` and `ready` press
     elements, and a change in an embedded part does not re-run the action checks of the parts that embed it; the
     switch was the first declared switch action. Tool fix (after MVP): `design check` marks every embedding part as
     "actions need a re-run" when an embedded part changes, and `ready` names that reason.
131. The open-points chip actions on pages/system missed their goal by 456-5036 px (builder, 2026-11-02). Enter and
     Space missed because the keyboard ring was not drawn: new states `part-focus-visible` and
     `points-closed-focus-visible` (9aaac3c0c; the overlay opens with autoFocus false, so focus stays on the chip). The
     clicks from `fit` and `nothing-open` missed because the goal was wrong: from fit the app stays fitted, and from
     nothing-open the label is "Nichts offen". The canvas became focusable in 165871a00. Why no check caught it: the
     marks came the same day (Impl Q-B), only `design actions` presses them, and `design check` only verifies that a
     goal state exists, not that it fits the start state's props. Tool fix (after MVP): on a miss, `design actions`
     compares the reached picture against every state of the part and prints "reaches state X instead" or "reaches no
     declared state (closest X, N px)".
132. `design live-compare` could wait forever (builder, 2026-11-02, found during C6). It passed
     max(deadline - now, 0) to Playwright as the timeout, and Playwright reads 0 as "no limit", so a spent budget
     waited without end. Why no check caught it: no spec ran a wait past its budget. Tool fix (8c0ede06e, C6): the
     timeout is clamped to at least 1 ms; every CLI wait goes through `withinLimit` in libs/cli/src/lib/design/wait.ts
     and names what it waits for; specs with fake timers and a really hanging child. Lesson: every limit gets a spec
     that runs past it, and 0 is never a valid "remaining" value for a library timeout.
133. Studio got a visible title bar (A1, window controls) with no design part behind it (builder, 2026-11-02). The look
     (app background, no bottom border, 24 px round buttons, 6 px gap) was picked by the builder, not designed. Why no
     check caught it: `design check` and `compare` only look at parts that exist; nothing compares the live app against
     the part list, so app chrome without a part is invisible to the tool. Tool fix (B30): `design check --live` reports
     every visible app region that no part covers. Lesson: the tool must find what was never designed, not only what
     differs from a design.
134. `design actions` said nothing useful when a press only missed on `aria-expanded` (builder, 2026-11-02, B22). Cause:
     a01d37d64 computed "reaches state X instead" only from a pixel compare; embedded-owner states have no goal picture
     by design, and live-actions has no pixels, so these misses never got a reason. Tool fix (f34aab8cb): the reached
     state also comes from the aria-expanded controls ("reaches state A or B instead", or "no declared state, closest
     X, N controls differ"). Open: no end-to-end spec of the two command wirings. Lesson: a diagnosis that depends on
     one signal (pixels) needs a fallback for every mode where that signal does not exist.
135. The harness build cache almost never hit (builder, 2026-11-02, C1). Cause: the key hashed every file, including
     plans/, .changeset/ and every .ethlete/design JSON, so any plan or sketch edit missed (1 of 3 hits measured). Fix
     (3a6fc94b0) drops non-build inputs (3 of 3 hits), but first skipped all .ethlete/design/**/*.json, while the
     libs/components build stages config.json and the sdk product records, so a stale build could hit. Narrowed with a
     spec before push. Why no check caught it: no spec measured hit rate or checked the key against the real build
     inputs. Lesson: a cache key is derived from what the build reads, and a spec proves both a hit on an unrelated edit
     and a miss on a real input.
136. The components/title-bar sketch looked broken in Studio (Tom, 2026-11-02, screenshot): empty variant frames,
     1440x900 frames for a 36 px bar, the "Variante c" head over the "Aktuell" column, an empty "Aktuell" frame for a
     new part, English variant notes, and no "agent is building" state on the variants (a regression). Causes
     (builder): the sketch was not `sketch ready` yet, b and c were untouched `sketch new` scaffolds, and Studio shows
     an in-progress sketch like a finished one; sketches.component.html gives every frame 1440x900 and fixed 3 columns
     with a row gap smaller than the variant head; sketch-view always puts "Aktuell" first without checking that the
     part exists; no template sets the note language. Why no check caught it: a scaffold builds and renders, so
     `sketch check` passes; `sketch check` and `shot` draw in their own fitted frames, and nothing renders Studio's
     own sketch view with a short or a new part. Tool fixes: B34-B36. Lesson: the tool has to check the view Tom
     actually looks at, not only the parts inside it.
137. Two regressions in Studio's sketch view, both from d0f4a38cf (2026-11-01, Impl Q55/Q57/Q58, the live view swapped
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
138. The paused components/title-bar sketch showed "In Arbeit" in Studio (Tom, 2026-11-02). The CLI already has the
     notion: `sketch hold <layer>/<name> --until <what> --by <model>` writes `sketch.hold` and blocks ready. But Studio
     never reads `hold`, and the builder paused the drawing agent without telling it to run `sketch hold`; the skill
     says "otherwise sketch hold", but nothing enforces it. A sketch in progress with no report and no file change looks
     like active drawing. Tool fix: B41 (Studio shows hold as "Pausiert" with the reason on click) and a stale rule (in
     progress, no report or file change for N minutes: Studio says "keine Aktivität"). Lesson: a state the CLI writes
     must be visible in Studio, and silence must never look like work.
139. The push of B22/C1/B30 (up to 11b570079) failed in the pre-push studio-live gate (builder, 2026-11-02):
     `UNCOVERED <ethlete-title-bar> 0,0 1440x36` in all 18 states. The B30 rule counts regions of parts an open sketch
     targets as covered, but the gate runs on committed state in a throwaway clone, and sketches stay uncommitted by
     design until Tom merges them, so the clone never sees the open components/title-bar sketch. Why no check caught
     it: B30 was tested only in the working tree, never through the pre-push clone. Tool fix: B42 (the live gate also
     reads open sketches from the working tree's .ethlete/design; a test runs it through the clone path). Lesson: a
     gate that runs in a clone must be tested in that clone, and state that is uncommitted by design must reach it.
140. During the title-bar redraw, `etProvideColor="brand"` logged a console warning in the ng() harness, and the button
     still looked brand (builder, 2026-11-02). Cause: the ng() app of the studio and sdk products registers no colour
     themes (in .ethlete/design/config.json only the legacy `projects.components` sets `providers`), so
     libs/core/src/lib/theming/provide-surface.directive.ts warns and the button falls back to `et-color--inherited`;
     it only looked brand because it inherited the frame's theme. Why no check caught it: the render check keeps only
     console errors with an ET code (libs/cli/src/lib/design/system/sdk-errors.ts, render-check.ts; legacy check.ts
     errors only), so every SDK console.warn is dropped by `sketch check` and `design check`. Tool fixes: B43 (each
     product's ng() harness registers the app's colour themes from per-product config providers) and B44 (checks report
     SDK console.warn lines as warnings). Lesson: a harness that differs from the app hides misconfiguration, and a
     check that drops warnings drops the only signal.
141. The title-bar redraw agent had to put `data-et-skip="CLIPPED"` on `<et-kbd>` (builder, 2026-11-02): the SDK's
     sr-only 1x1 text is flagged as clipped. A deliberate visually-hidden element is not a clipping defect. Tool fix:
     B45 (the clipped check skips visually-hidden sr-only elements by itself; drop the skip from the sketch). Lesson:
     a skip attribute in a draft is a sign of a false positive in the tool, and each one needs a finding.
142. All three components/title-bar variants flickered permanently in Studio's sketch view, as if without a fixed size
     (Tom, 2026-11-02). Cause (builder, confirmed): uncommitted B36 edits in
     apps/ethlete-studio/src/app/system-view/sketch-view.component.ts; each iframe size report recomputes variants(),
     shots() derives from it and builds new SafeResourceUrl objects, so every iframe reloads, reports again, and the
     loop repeats. A reload loop, not a size loop; Tom's live-reloading tauri:dev picked up the in-flight edit. Why no
     check caught it: the specs check one report and never that the iframe src stays stable across reports; the e2e
     checks the size after load, not that nothing reloads. Tool fix: B47 (spec: a repeated report sets no new src and
     no new size; sketch-view e2e counts iframe load events for ~2 s after settling and fails above one per frame).
     Lesson: a rendered view must be proven stable over time, not only correct once.
143. The "In Arbeit" badge and the per-variant "Agent zeichnet noch" state were built straight into Studio with no
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
144. The B36 e2e saw only Vite 403 pages in every frame (builder, 2026-11-02): in a throwaway checkout with a
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
145. Tom pressed "Wählen" on the held components/title-bar sketch and nothing happened (2026-11-02). Probable cause (to
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
146. `sketch check --fix` reports ok on the pages/sketches sketch while `sketch ready` fails on the same unused imports
     (variants a/b/c and shared/sketch-status.ts) (builder, 2026-11-02). Why no check caught it: check and ready run
     different rule sets, and no spec asserts that a sketch check passes implies ready's checks pass. Tool fix: B52
     (ready runs exactly check's rules plus its own gates; check reports UNUSED too). Lesson: two commands that judge
     the same file must not disagree. Update (builder, 2026-11-02): cause confirmed; `ready` added
     unusedInVariantOf() in readyRefusalOf, `check` ran only format and typecheck, and typecheck does not flag unused
     imports. Fixed in e3e26ad3c: one variantGateProblemsOf() serves both. Next: check also reports ready's content
     gates (open points a variant adds, running round without a note, variants that do not load) as "ready will
     refuse: ..."; only workflow state (held, already ready) stays ready-only.
147. The render checks missed a see-through overlay pane in pages/sketches variant A: the popover let the round picker
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
148. The Studio sketch view is unusable for the components/title-bar sketch (Tom's screenshot, 2026-11-02): (a) only
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
149. components/zoom-chip was never comparable, yet counted as done in the MVP (builder, 2026-11-02, found by the B48
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
150. Tom's merge of components/title-bar C failed with only "Merge fehlgeschlagen." (2026-11-02). The pick had worked;
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
151. Code review of the Angular design-parts (agent review, 2026-11-02, Tom's request): the workflow lets these through.
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
152. Merge view feedback (Tom, 2026-11-02, title-bar C merge, which went through): (a) the "Geändert" list takes a
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
153. The merged components/title-bar has no `implements` link, so compare, task, the harness map and the implemented
     record all refuse it ("has no implements link"); A1 stalled on it (builder, 2026-11-02). Adding the link changes
     the part hash, so the go goes stale and must be granted again. Why no check caught it: `sketch ready` and the
     merge accept a sketch whose part has no `implements` link and say nothing; the go hash covers the link although
     the link changes nothing visible. Tool fix: B63 (`sketch ready` and the merge view warn "this part cannot be
     compared or implemented until it has an implements link"; the go hash ignores the `implements` link, as already
     planned for after the MVP). Lesson: a merged design that no tool can compare is not finished.
154. The title-bar `macos` states leave the left side empty, so they do not read as macOS: the OS draws the traffic
     lights, and the design draws nothing in their place (Tom, 2026-11-02, after the merge). Why no check caught it:
     no check or brief asks a part that sits next to OS-drawn chrome to show that chrome; an empty zone is a valid
     render. Tool fix: B64 (the sketch brief and `sketch new` for a part with an OS prop ask for the OS chrome as demo
     content in a slot that compare empties, like the canvas demo cards). Lesson: a state must read as the situation
     it stands for, also where the real pixels come from outside the app.
155. `design check --part components/title-bar` auto-carried Tom's go after a visible edit (builder, 2026-11-02): the
     macOS traffic lights were drawn into slot('traffic-lights'), and the check printed "AUTO ACCEPTED ... every state
     draws as at the last acceptance" and wrote go.json `auto: true` with the new hash. Probable cause: the auto-carry
     compares pictures with slots emptied, so a change only inside a slot counts as unchanged. Tom held a go he never
     gave; the entry is removed. Why no check caught it: no spec changes only slot content and expects the go to go
     stale. Tool fix: B65 (high priority; the auto-carry compares the full picture with slots drawn; any change in slot
     content leaves the go stale; spec for exactly this case). Lesson: a picture with parts hidden cannot prove that
     nothing visible changed.
156. `design compare components/title-bar` fails SIZE in every state (builder, 2026-11-02): the design pins the bar to
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
157. The built title bar runs into the content below in the live app (Tom's screenshot, 2026-11-02): the design gives
     it `bg-et-surface-bg`, the same as the page, and no edge, so the canvas dot grid seems to pass under it. Why no
     check caught it: the sketch and the merge view show a part alone on a neutral frame; nobody saw it above the real
     content before the pick. Tool fix: added to B46 (the in-context view is part of judging any part that sits at an
     app edge, before the pick, not only for sketches of pages). Lesson: an edge part judged alone cannot show where
     it ends.
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
159. Two pages/sketches r2 variants put a native scrollbar inside the frame: the rows column of the sketch view
     scrolls on its own (Tom, 2026-11-02, two screenshots). Inside a canvas that pans and zooms, a nested scroll area
     hides content from the shot and from Tom. Why no check caught it: the render checks look for clipped and
     overflowing boxes, not for a scroll container whose content is taller than its box. Tool fix: B68 (render check
     rule NESTED-SCROLL: an element with overflow auto or scroll whose scroll size exceeds its box inside a design
     frame is reported; a part that must scroll declares it). Lesson: content behind a scrollbar is content no
     picture shows.
     Update (builder, 2026-11-02): B68 done 3405ec61c (NESTED-SCROLL rule, SDK scrollers exempt). The thumb contrast
     miss: contrast-check.ts skipped everything inside [inert] and the sketch thumbnails are inert; inert is now
     measured, disabled still skipped. Lesson: a skip for "not interactive" is not a skip for "not visible".
160. A frame in the Sketches view sometimes shows the browser's own failed-load page (grey page with the sad document
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
161. After a reload, Studio takes about 10 s before the Sketches view shows the open sketches (Tom, 2026-11-02).
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
162. A go cannot be taken back (Tom, 2026-11-02): Studio has no action to withdraw a go, and `et design go`
     (libs/cli/src/lib/design/system/go-command.ts) only grants one. The auto-carried go on `components/title-bar`
     (go.json, `auto: true`, finding 155) can only leave by a hand edit of go.json. Why no check caught it: the go
     decisions defined granting, stale and auto-carry, never withdrawal, and no e2e walks a go back. Tool fix: B70
     (shape pending Tom's decision). Lesson: a release the person can give but not take back turns every wrong
     release into a file edit.
163. The title bar search field is drawn inline in `components/title-bar` with its own hover, pressed and focus rows,
     though it is plainly an element of its own inside the title bar (Tom, 2026-11-02: "wieso haben wir es nun als
     teil der titlebar? wieso passiert sowas noch immer"). Cause: the Q181 rule CONTROL-STATE lets a part draw
     interaction states when it declares its controls (Q164). The title bar declares `controls = { search, update,
minimize, maximize, close }` (components/title-bar/shared/chrome.ts:77) and forces states per control through a
     `force` prop, so the check passed, although the search field is bespoke markup (an et-button with custom
     classes, a product/part label and a kbd) that exists nowhere else. The control declaration became the loophole
     the rule was meant to close. Tool fix: B72 (a declared control counts only when it is an embedded part or an
     SDK component used through its props; bespoke control markup inside a non-control part is a CONTROL-STATE error
     that names it for extraction). Lesson: an exemption a part grants itself is no rule.
164. Every design render of a part with an `color="brand"` SDK button through `ng()` logs `etProvideColor="brand" has
no effect because no color themes are registered` (builder, 2026-11-02, update-dialog sketch). The brand fill
     still shows, so the render and the app may resolve colours by different paths, and check and ready pass. Why no
     check caught it: the render checks ignore console output. Tool fix: B74 (technical, grill decision: the `ng()`
     render registers the product's colour themes like the app does; the render check reports any SDK console
     warning or error in a frame as a problem). Lesson: a warning nobody reads is a bug the checks agreed to hide.
165. `sketch ready` refuses pages/sketches because r1 variant c draws its first state pixel-identical to b, and
     tells the author to "make a state the variant changes its first state"; reordering c's states does not clear it
     (builder, 2026-11-02). Cause: identical-renders.ts:78-118 picks the first compared frame in the merged part's
     state order (then new states), never the variant's own order, so the advice cannot work. Why no check caught
     it: the B54 spec tests that identical variants are refused, not that following the refusal text clears it.
     Tool fix: B75 (technical, grill decision: compare each variant at its first changed state, the one the sketch
     view shows first, and name the compared state in the message; a spec follows the message's own advice and
     expects ready to pass). Lesson: an error message is a promise, and a spec should keep it.
166. In the `long` rows of components/title-search the centred label is cut at both ends: the product name shows as
     a stray glyph at the start, the part name stops mid-word at the end with no ellipsis (builder report and shot,
     2026-11-02); the design check passed with 0 problems. Cause (builder, from code, no run yet): (1) render-check.ts
     `cutsOnPurpose` accepts `text-overflow: ellipsis` as an intentional cut, but the `truncate` sat on a flex
     container, where no ellipsis is ever drawn; (2) the check compares scrollWidth > clientWidth, and centred
     overflow spills left into negative offsets that scrollWidth ignores, so the left cut was invisible. Tool fix:
     B80 (ellipsis counts only on inline text - a flex/grid container with ellipsis stays CLIPPED with the hint
     "min-w-0 truncate on the inner span"; measure both edges, each child rect against the clip box). Lesson: a
     check that trusts a declared intent (ellipsis) must verify the intent can take effect. Design fix with Tom
     (part name truncates at the end, product stays whole).
167. In pages/sketches r2 variant e the variant rows run past the bottom of the Studio window and are cut only by
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
168. The title bar is not part of the shell design: elements/shell-main (Tom's screenshot, `hidden · width 1440`) shows
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
169. The builder ran `design check` in the foreground and blocked its session for minutes; Tom had to step in
     (Tom, 2026-11-02: "design check muss im hintergrund laufen IMMER"). Cause: the rule lives only in prose
     (handoffs, skills), and a fresh session or a subagent does not carry it; nothing stops the call. Tool fix: B77
     (technical, grill decision: a PreToolUse hook on Bash, shipped through libs/agent-rules like
     subagent-model-policy.py, denies the long design commands - `design check`, `compare`, `ready`, `sketch ready`,
     `harness`, `studio:e2e`, the visible-change gate - unless `run_in_background` is set, with a message naming
     the background form; a spec per command). Lesson: a rule an agent must remember is a rule the next agent
     forgets; the harness has to enforce it.
170. The grill session asked Tom whether variant e's rows should end inside the window (padding or fade) instead of
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
171. After `--et-kbd-color` (2a13b5eba, 6e3c4f00b) the title-search key glyphs stayed muted on hover, active and
     focus-visible (builder before/after shot, 2026-11-02). Cause: not the code - the design harness loads
     @ethlete/components from dist, and dist was not rebuilt after the change, so the new property did nothing while
     the removed `text-current` was gone. `nx build components` fixed it; the re-shot of all 8 states is
     byte-identical to 9fe0b8a41. Why no tool caught it: shot/check/compare draw from a stale dist and only print
     "WARNING STALE BUILD"; and nothing compares the forced interaction states of a part without a go against its
     last committed design - only a manual before/after found it. Tool fix: B94 (never draw from stale dist: rebuild
     or refuse), B78 extended (state compare against the last committed design). Lesson: a warning in a long log is
     not a gate; a picture from stale code is worse than no picture.
172. pages/sketches no longer renders: "location is not defined", raised from the title-search part's render
     (builder, 2026-11-02). It started within this wave (kbd-color, B76 shell-main with the embedded title bar, or the
     rebuilt components dist) and blocks the live check of B75. Cause (builder, corrected): commit 9fe0b8a41 added
     the title search to the title bar, and pages/sketches drew its shells at module load, where the search cannot
     render; fixed in 142e0a96a (drawing moved into render()). the uncommitted agent variants pages-sketches a/b/c use the
     same pattern ("Invalid URL"). Why no tool caught it: `design check --part` renders only that part, never the
     parts and sketches that embed it. Tool fix: B95 (a check of a changed part also renders every part and open
     sketch that embeds it; the commit gate does the same) plus a rule that refuses drawing at module load. Lesson:
     a part's check must cover its consumers, or a change is green where it is made and red where it is used.
173. Dead processes in the builder session (Tom asked the grill session to clear them, 2026-11-02): three wait loops
     `until ! pgrep -f "design ... check ..."; do sleep N; done` ran 10-30 min and could never end, because `pgrep -f`
     matches the loop's own shell, whose command line contains the pattern; plus a full `design check --product
studio` (9 min) whose requesting subagent was gone after the builder ran out of context. Load was ~20. Why no
     tool caught it: nothing refuses a self-matching wait loop, and nothing stops background work whose requester
     ended. Tool fix: B99 (Bash hook refuses `pgrep -f`/`pkill -f` wait loops and points to run_in_background
     completion or Monitor; the restart command lists and stops background shells and design processes of the
     session it restarts). Lesson: a wait loop that greps for its own text waits forever.
174. Two items landed with their real path unproven (builder, 2026-11-02): B69 e2d977408 verifies the failed-load
     state only in jsdom (server-restart.e2e passes, but no e2e loads a frame that fails), and Restart bumps the
     epoch twice; B94 a733db40b was never run against a real stale dist. Cause of the double epoch bump: two bump sites, `studio-view.component.ts:221` restartServer() on
     designServerRestart$ and the pid bump at :168-172 added in e2d977408; fix drops :221 (no e2e counted frame
     reloads). Why no tool caught it: an item counts as done when its commit lands; nothing asks for proof on the
     path the finding failed on. Tool fix: B101 (an e2e for the failed-load state and a single epoch bump per
     Restart; a spec that makes dist stale for real and expects shot to rebuild or refuse). Lesson: a fix is proven
     where the defect happened, not in the nearest cheap test.
175. The builder still writes long chat text nobody reads (Tom, 2026-11-02), although the builder-agent skill says
     "the user does not read your chat; end each turn with at most one line". Why no tool caught it: the rule is
     skill prose only, read once and outweighed by the default habit of reporting at turn end. A blocking Stop hook
     was rejected (Tom): it makes the builder write the text and then rewrite it, so it burns more tokens. Tool fix:
     B102. Lesson: put a role's output rule in its system prompt, where it costs nothing and weighs most; measure,
     do not block.
176. Gos landed while the harness map was stale (builder, 2026-11-02): Tom's Studio gos for title-search,
     title-bar and shell-main are in go.json, but their compares fail with "harness map design-harness-parts.ts is
     stale". Why no tool caught it: go and merge do not look at the harness map, so the staleness shows up only at the
     next compare. Tool fix: B103 (go and merge regenerate a stale harness map, or refuse with the command; a Studio
     click must not be lost, so regenerating is the default). Lesson: a step that hands work to the next step checks
     that the next step can run.
177. B72 read as clean while it had 3 hits (builder, 2026-11-02): the CONTROL-STATE pass prints only after all 84
     parts, so a log read mid-run showed "0 hits". Full run: zoom-chip `reset`, shell-main `section` and shell-main
     `product` are own control markup in non-control parts. Why no tool caught it: `design check` ends without a
     per-rule tally, so a partial log looks like a clean one. Tool fix: B104 (check ends with one summary line per
     rule, e.g. "CONTROL-STATE: 3", and a final "complete" line; a log without it is unfinished). Lesson: a clean
     result must say it is complete.
178. title-search compare SIZE 25 vs 26 px in all 8 states (builder, 2026-11-02): a harness artefact, not the part.
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
179. The pages/sketches sketch (variant d) draws the Studio logo as a teal tile with a white mark; the app draws it
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
180. The grill session called the uncommitted pages/sketches variants "Tom's" and asked Tom for an OK to fix "his"
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
- Impl Q45 accept by the builder (Tom, 2026-11-01): same rule as Impl Q15 for the go. When Tom approves a concrete
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
