# Parallel backlog - latest decisions (Q203 and later)

### Surfaces follow the elevation system, not picked names (Tom, 2026-10-31, Q203-Q206)

The Q197 migration swapped token names but hand-picked the elevation: parts carry fixed `et-surface--<name>` classes
(`dark` x22, `dark-elevated` x3, `dark-elevated-2` x8) and use no auto surface and no interactive surface. Tom: an auto
surface picks the next higher surface, so everything that floats without a backdrop (popover, menu, tooltip, dropdown)
takes its surface and its colours dynamically from the theme. No part names a theme.

1. **Kit attributes (57).** `data-et-auto-surface`: the design frame walks up to the nearest surface scope and sets
   the theme of elevation + 1 of the same type from the registered surface themes, like `etAutoSurface`.
   `data-et-surface-interactive`: the frame loads the SDK interactive surface CSS once, like `etSurfaceInteractive`.
   `et design task` maps them 1:1 to the directives; `compare` shows a difference in the app. Only the root surface
   is fixed, and the frame or the app root provides it, not a part class.
2. **Migration (33)** of every Studio part and of the open-points popover sketch to the attributes, after (1).
3. **Error (57).** `DENIED-CLASS` denies `et-surface--*` in parts outside foundations, as an error with the Q198
   switch, after (2). No per-part opt-out.

Order (lead, Q96): the running Q198 colour subagent stops after its finished commits; nothing more is built on fixed
surface classes. The implementation pilot waits for (2).

**Colour follows the same rule (Tom, 2026-10-31).** `etProvideColor` sets the active colour theme on its element and
every child inherits it; parts read only `--et-theme-color-*` and set no `et-color--<name>`. A semantic colour goes by
theme type (kit attribute resolved like `injectSemanticColorTheme`), never by name; today `pages/system` and
`components/tree-row` hand-pick `et-color--warning`. The auto-surface resolver also applies the new surface's
`colorThemeVariants` swap. `DENIED-CLASS` later denies `et-color--*` in parts too.

**Auto-surface results and the overlay pane (Tom, 2026-10-31, Q207-Q208).**

- **Q207:** Tom accepts the elevations the system computes on the 11 visible parts (comment-pin, shell-project-option,
  shell-project-switch, zoom-chip, canvas-frames, shell-main, flows, inbox, merge, sketches, system). If a spot looks
  wrong, the structure changes, never a hand-picked elevation.
- **Q208 (revised by Tom the same evening):** not through `ng(...)`. Studio already draws SDK components with the
  static design renderers in `libs/components/design/`, and `design/dialog.ts` already draws the real overlay chrome
  from the overlay container CSS. So the SDK gets an anchored-dialog (popover) renderer there, its pane on
  `data-et-auto-surface` by default, and the overlay renderers' `surface` option defaults to the auto surface instead
  of a theme name. The open-points popover (Q202) and every later popover, dialog or sheet in a part use these. No
  hand-built overlay `div`.
- **Q209:** Tom accepts the brighter SDK hover and active tint on rows with `data-et-surface-interactive` (tree-row:
  hover grey 28 to 34, active 36 to 47); the other hover rows move to the attribute.
- **Q211:** the comment-pin is rebuilt the SDK way: the pin button itself is the auto surface and carries
  `data-et-surface-interactive`; the face is no separate surface element. The hand-built Q200 tint goes.

**Floating borders (Tom, 2026-10-31, Q212).**

- **Q212:** every floating element in Studio takes the SDK subtle overlay border, like the Q202 popover. The zoom
  chip drops `border-et-surface-interaction` for it; its surface step (canvas 15 to chip 32) stays. Q201 now covers
  only real control borders (shell-main, inbox). Hand-drawn floating panels (project picker `shell-main.ts:74`,
  inbox comment popover `inbox.ts:217`) move to the SDK `menu()` and `anchoredDialog()` renderers under Q208.
  Q212 covers floating panels only; the comment-pin is a canvas marker and keeps its Q211 ring.
- **Q214 (Tom, 2026-10-31):** Tom accepts the Q211 pin round (`64d664072`): hover face grey 44 to 50, active 52 to 62,
  the count badge beside the button, the brighter active ink on the unselected pin for contrast.
- **Q215 (Tom, 2026-10-31):** Tom accepts 57's round: the project picker is the SDK `menu()` (radio dot for the
  selected project), the inbox comment popover the SDK `anchoredDialog()`, the zoom chip takes the SDK overlay
  border (Q212), and the project-switch chevron sits at the row end.
- **Q216 (Tom, 2026-10-31, option A):** the CONTRAST rule does not check the outer border of a floating panel (an
  overlay pane, or an element with its own surface step and shadow). The SDK overlay border stays at 1.63:1; such a
  panel is identified by its surface step and shadow (WCAG 1.4.11). A tool fix, no per-part exceptions.
- After the MVP (lead call, Q96, 2026-10-31; gaps from the canvas focus sketch): `control()` on a page for one
  focusable region and a `region` control kind (today a component part such as `components/canvas-viewport` carries
  it); a `focusRingStyles` export in `@ethlete/components/design` (parts import all of `buttonStyles` today); public
  focus-ring tokens for offset, width and colour (today private `--_et-*` vars; an SDK API call for Tom).
- **Q217 (Tom, 2026-10-31):** the floating zoom chip takes the SDK overlay shadow, so it is a floating panel under
  Q216 (own surface step + shadow) and its border contrast findings go away. No rule change.
- **Q218 (Tom, 2026-10-31, option a):** Q178 moves into the MVP. The Studio part tree puts the SDK base parts that no
  Studio part imports into their own subtree ("Not used in Studio"), collapsed by default. The tool computes the set
  from the import graph of the Studio parts (as the token check reads imported SDK design modules since
  `cb1d48d58`), so it stays current with no list to maintain; no `hideBaseParts` entry. The parts stay reachable and
  every check still runs on them. Builder 57 builds it after pilot slice 1.
- **Q219 (Tom, 2026-10-31):** the `pages/sketches` inventory shows three red (undeclared) controls: `studio-menu` (rail
  logo), the round picker `et-form-field`, and `pin`. Under the control-ownership rule (2026-10-30) they should belong
  to the embedded parts (shell-main, sdk form-field, comment-pin). The builder finds the cause after pilot slice 1,
  before Q218: a tool gap gets a tool fix; a page that draws the controls itself gets a sketch round that embeds the
  real parts.
- **Q220 (Tom, 2026-10-31):** the Tailwind canonical-class warnings (`w-[1440px]` to `w-360`, `size-[22px]` to
  `size-5.5`, `before:w-[3px]` to `before:w-0.75`) are fixed in one mechanical pass (`canonicalizeCandidates`). Shot
  diff 0 per part, then `design accept`, no sketch. A part whose shot changes goes through a sketch round.
- **Q221 (Tom, 2026-10-31):** the 11 Studio CLASS-GLUED-INTERPOLATION warnings (`07145ced7`, `23870448c`) change the
  look, so each is fixed in a sketch round of the part it belongs to; inbox and shell-main inside the pilot. No edit
  outside a sketch.
- After the MVP (pilot slice 1 tool gap, 2026-10-31): no CLI command prints the rendered HTML of a part or of its
  implementation; the pilot dumped it with its own Playwright script. A `design dom <part>` (or a compare flag) would
  remove that step.
- **Q222 (Tom, 2026-10-31):** a page part marks the live canvas as a projected region (`slot('canvas')`). Compare
  masks that box in both shots; the component projects it with `<ng-content>`. No separate canvas part.
- **Q223 (Tom, 2026-10-31):** builder order after pilot slice 1: Q219 (+ the inventory toggle in the URL), then
  shell-main b as pilot slice 2 with the inbox moved onto it and Q222, then Q218, then Q220.
- **Q224 (Tom, 2026-10-31):** the Inventory view gets its own Studio part `pages/inventory`; the MVP list grows by it.
  Tool rule: every view of the Studio app needs a part that covers it through `implements`; a view without one is an
  open point in `design check`.
- **Q225 (Tom, 2026-10-31):** the builder writes nothing for Tom in its chat (one closing line at most); every report
  goes only to the grill session by `SendMessage`. The builder stays a tmux session, not a subagent of the grill
  session. Rule added to the `builder-agent` skill.
- **Q227 token savings (Tom, 2026-10-31: "alles was sinn macht", and every saving must last, not a one-off).** A
  transcript analysis of 7 days (899 transcripts, 3.72B tokens, 97% cache reads) found the cost is context size x
  turns, not tool output. Subagents used 59%. Measures, each with a guard so it lasts:
  1. Plans: `design-system.md` (225k chars), `design-system-actions.md` (146k) and `studio-wireframes-handoff.md` (54k)
     become a short index (status, open points, links) plus topic files; finished sections move to
     `plans/ethlete-studio/archive/`. `backlog-parallel.md` follows at a quiet moment (two sessions append to it).
  2. The `design-exploration` skill (47k chars) is cut to a short SKILL.md plus a reference file the skill names.
  3. The delegation rule in the agent rules gets a measurable bar: a lookup under about 10 tool calls stays inline.
  4. Guard (builder): a size budget check in the pre-push Checks job for plan index files, SKILL.md files and
     AGENTS.md, so the files cannot grow back unnoticed.
  5. Guard (builder): a repeatable token report command (per session, per subagent, start cost, top tool results,
     top repeated reads), run weekly; the result goes to the grill session.
  6. `design check` gets a `--part <key>` filter and a one-line-per-part summary (with Q184).
     Rejected: pinging idle sessions to keep the cache warm costs more than it saves.
- **Q228 (Tom, 2026-10-31):** the SDK system gets a small `components/anchored-dialog` part (modelled on `menu` and
  `dialog`). Then one sketch round each for `pages/system` (open-points popover, `system.ts:89`) and `pages/inbox`
  (filter popover, `inbox.ts:222`) embeds it instead of the direct `anchoredDialog()` mock call. Not proven to block
  the inventory; order: after pilot slice 2, before Q218. The other direct mock calls follow Q219: sketch rounds for
  `pages/sketches` and `pages/flows` (form-field + select), `pages/merge` "Changed" rows; shell-main `menu()` in
  pilot slice 2.
- After the MVP (Tom, 2026-10-31): the rows of the open-points popover in `pages/system` (the "Offene Punkte" list
  per part) become clickable. Until then they are plain rows and no inventory controls.
- **Q230 (Tom, 2026-10-31; moved before the MVP the same day):** the SDK `components/select` part gets `label` and `options` props in its
  own small SDK round, now, as a builder subagent slice. Then the `pages/sketches` round picker (sketch
  `pages-sketches`, variant a) drops its `.replace` on the select markup.
- **Q231 (Tom, 2026-10-31), after the MVP:** the `pages/sketches` round picker stays the plain small SDK select. A
  borderless muted select look is a new SDK select look, in its own SDK sketch.
- **Q229 (Tom, 2026-10-31):** inventory controls are keyed and numbered on DOM path + label, not on the DOM path
  alone. On `pages/start`, "Repo öffnen" (no-repo) and "Prompt kopieren" (no-products) sit at the same path; today they
  share number 1 and the list shows one row for both. After the fix each gets its own number and row.
- After the MVP (Tom, 2026-10-31): the Inventory view becomes a canvas like the other Studio views (pan and zoom).
- After the MVP (Tom, 2026-10-31): the Inventory view respects the frame viewport. Today a control outline that
  reaches past the frame edge (for example the zoom bar of a sketch page) makes the frame scroll; outlines must be
  clipped to the frame or drawn inside it, so they never add a scrollbar.
- **Q233 (Tom, 2026-10-31), after the MVP:** the Inventory gets a second section "Assets" (logos, icons, images). An
  asset from the foundations (for example `foundations/agent-logos`, `foundations/logo`) is listed as "owned by
  foundations/<name>"; an inline SVG or image that does not come from the foundations is a finding.
- **Q234 (Tom, 2026-10-31):** the rail items of `elements/shell-main` (nav icons, S/T/D, "...") become plain
  `<button type="button" aria-label="...">` elements in the shell-main b round, declared in the shell-main
  `controls`, with their current look. They are not SDK button parts: the rail item is a Studio-only control, and
  Tom rejected adding an SDK button variant just for it. Today they are `div`/`span` bubbles with only a `title`, so
  discovery cannot find them; a `title` signal in the CLI was rejected (status icons and swatches carry `title` too).
- In progress (builder 57, 2026-10-31): parallel subagents on shell-main b round + Q234, Q228 anchored-dialog part, pages/merge Changed rows, Q224 inventory part + view coverage + `design check --part`, Q227 size budget + token report, Studio app round picker onto et-select.
- **Q235 (Tom, 2026-10-31):** the Studio sketch view renders only one round at a time, as the `pages/sketches` design
  shows. The header round picker (`et-select`) switches which round is rendered; the open/folded round columns in
  `sketch-view.component.ts` (`toggleRound`, `openRounds`) go away. The view opens on the newest round.
- **Q236 (Tom, 2026-10-31):** a control that another element fully covers (for example the Save buttons under the
  open-points popover in `pages/system`) stays in the inventory list, marked "covered", but gets no outline or
  number badge in the frame. Discovery checks with `elementFromPoint` whether the control is on top; a partly covered
  control counts as visible.
- **Q237 (Tom, 2026-10-31):** the SDK part `components/anchored-dialog` gets a `content` slot; each page passes its
  own pane content (`pages/system` open-points list, `pages/inbox` comment editor with `et-textarea`). The fixed kinds
  `open-points` and `filter` stay only as demo states; no new kind per use.
- **Q238 (Tom, 2026-10-31):** in the anchored-dialog `filter` demo state, "Apply" becomes the SDK
  `components/button` part. The checkbox stays native for now; an SDK `checkbox` part follows after the MVP (the SDK
  system has `switch` but no `checkbox`).
- **Q239 (Tom, 2026-10-31), after the MVP:** the inventory lists every open overlay (popover, dialog, menu) as its own
  entry: "owned by components/<part>" when an SDK part draws it, a finding when it is an inline mock without a part
  (for example a direct `anchoredDialog()` call).
- **`pages/inventory` sketch (Tom, 2026-10-31):** Tom merges it for the MVP, but the part needs a design rework after
  the MVP. It joins the after-MVP inventory rows: canvas view, viewport clip, assets section (Q233), overlays (Q239).
- **Q240 (Tom, 2026-10-31):** an inventory control with several instances is marked "covered" in the list only when
  every instance is covered; covered instances still lose their outline in the frame.
- **Inventory view audience (Tom, 2026-10-31), input for the after-MVP `pages/inventory` rework:** the view is too
  technical. It reads like a debugging tool for Studio itself and is a useful CLI tool, but a designer without a code
  background gets nothing from it (DOM paths, owner keys, state counts). The rework starts from that user: what
  must a designer see and decide here, and what moves to the CLI or a debug-only view.
- **Q241 (Tom, 2026-10-31):** the demo frame of `components/anchored-dialog` (padding, background, top margin)
  belongs only to the presentation of the part's own states. An embedded render never has a frame, with no prop to
  set. `pages/system` and `pages/inbox` then drop their Tailwind `!` overrides (and the inbox `bottom-${'start'}`
  hack) in a no-visible-change round. The same rule holds for every SDK part that draws a demo frame.
- **Q242 (Tom, 2026-10-31):** the "Save" buttons in studio `elements/canvas-frames` fail the CONTRAST rule (3.81:1,
  needs 4.5:1). They are only demo content, rendered by studio `components/button`. Fix the failing variant and
  interaction cell where its colour lives (the button part or its theme token), in a sketch round on that part with
  token-only colour variants; Tom merges the variant. No contrast exception, and no button colour or override in
  `canvas-frames`. After the merge, the open glued-class rounds for `canvas-frames` and `components/zoom-chip` go to
  ready again.
- **Q243 (Tom, 2026-10-31):** `sketch ready` blocks only on issues the sketch adds. An issue that the merged part
  already shows (same rule and same detail, element path normalised for the frame move of Q241) does not block, for
  every rule, not only CONTROL-PART-INPUT. New issues still block. The old issues stay visible in `design check` and
  still need a fix; this is not an exception. Unblocks the Q241 sketch `sdk/sketches/components-accordion`.
- **Live iframe limit (Tom, 2026-10-31), after the MVP:** the cap on live iframes in a Studio grid is not a good
  idea. In the sketch view of `sdk/sketches/components-button` (r1) a viewer sees exactly which cells are shot images
  and which are live iframes, because the images are clearly blurry. Rework after the MVP: every visible cell must
  look the same, either by sharp shots (device pixel ratio, zoom) or by no cap. Measure the cost first.
- **Sketch context for a state change (Tom, 2026-10-31), after the MVP:** a sketch that changes one interaction state
  is hard to judge. "Show all" on `sdk/sketches/components-button` (r1) shows thousands of cells; "Changed area"
  shows only the active cells, without the rest, hover and focus cells around them, so Tom cannot feel whether the
  press reads right in the sequence. Rework after the MVP: the changed area keeps its neighbourhood, for example the
  full interaction row (rest, hover, active, focus-visible, pressed) of each changed state, with the changed cell
  marked.
- **Q242 pick (Tom, 2026-10-31):** variant b of `sdk/sketches/components-button` r1. Filled active mixes the rest
  primary 96% with on-primary: a slight darkening of rest, lighter than hover, about 5.2:1; danger active follows.
  The port to `libs/components/src/lib/button/button.component.css` derives from the theme token like the lib does
  and guards the rule with `:not([disabled], [aria-disabled='true'])`, so a loading button never flashes on Space.
- **Q244 (Tom, 2026-10-31), after the MVP (scope check):** when a sketch targets more than one part, the sketch head in Studio shows the round
  title as its title (for example "Demo frame out of render"), with "<n> parts" below it that expands to the target
  list. A one-part sketch keeps the part name. Today the head shows only the first target, so the 42-part Q241
  sketch reads as a `components/accordion` sketch.
- **Q245 (Tom, 2026-10-31):** the Q242 pick also goes into `icon-button.component.css` and
  `split-button.component.css`: filled active mixes the theme primary-solid 96% with on-primary, guarded with
  `:not([disabled], [aria-disabled='true'])`. Small; the builder does it after the Q241 accordion round, without
  delaying the MVP path.
- **floating-action frame (2026-11-01), after the MVP, open:** the Q241 round left `components/floating-action` out.
  Its demo frame is two elements (`fa-frame > fa-page`), and the Q243 path normalisation assumes a one-element frame,
  so an old CONTROL-PART-INPUT issue looks new. Options: teach the normalisation multi-element frames, or keep
  `fa-page` in render. Recommendation: teach the normalisation, so every part follows the same frame rule.
- **Q246 (Tom, 2026-11-01), MVP:** `pages/inbox` declares its comment rows as controls (a click selects the comment
  and the canvas shows its frame), so the inventory numbers them. No visible change. Tom gives the new inbox go
  after this round, because it changes the hash again. The open-point rows in `pages/system` stay after the MVP:
  they are not clickable yet.
- **MVP go (Tom, 2026-11-01):** Tom gives the go for every Studio part that is open now: `pages/inbox`,
  `pages/inventory`, and each part the `implements` round links to its app file (no visible change). The builder sets
  each go with `et design go <part> --product studio --by tom` after the part's last edit, plus any inventory
  approval the part still needs, and commits go.json. Parts that need a design call are excluded until Tom decides.
- **The word "go" (Tom, 2026-11-01), after the MVP:** "go" sounds odd as the name for releasing a part for
  implementation. Rename it with the after-MVP `pages/inventory` rework, which is where approvals will change anyway.
  Today the go exists only in the CLI (`et design go`); Studio has no go action.
- **Two designers on one project (Tom, 2026-11-01), after the MVP, open topic:** how Studio avoids or resolves
  conflicts when two designers work on the same product: the same part or sketch, the shared JSON records
  (`go.json`, `ready.json`, `inventory.json`, `merged.json`, `accepted.json`), and comments. Today every record is a
  plain file in git, so two edits meet only as a git merge conflict. Start with a grill: what must a designer see
  and do when someone else changes the same thing. Tom's first thought (2026-11-01): a real-time solution like Figma
  is probably the right direction; what fits best and how it looks is open.
- **Q247 (Tom, 2026-11-01):** the `implements` link does not count for the Studio MVP; the MVP is the design (every
  part merged and ready). Parts whose markup is inline in a bigger app component (tree-row, part-tree, zoom-chip,
  comment-pin, canvas-viewport, the merge view) link to the file that holds that markup today. Parts with no app code
  yet (disclosure, shell-collapse, shell-project-option, shell-project-switch, studio-menu, shell-main, pages/start)
  stay unlinked, and that does not block the MVP. Extracting inline pieces into their own components follows after
  the MVP.
- **Q248 (2026-11-01), after the MVP with the extraction:** `elements/canvas-frames` -> `canvas-frame-grid.component.ts`;
  `studio-view.component.ts` gets `elements/shell-main` as its part. Recommended, not yet confirmed by Tom.
- **Q249 (Tom, 2026-11-01), MVP:** the missing interaction states of the declared controls get drawn with the
  existing row, option and menu styles, no new look: tree-row (row, row.selected, row.selected-hover), part-tree
  (row), shell-project-option (option.selected-hover), shell-main (section, product, products: hover, active,
  focus-visible), canvas-frames (out, reset, in, fit; plus its open default contrast finding). One sketch round per
  part; Tom sees each in Studio and merges. The MVP measure is `design check --product studio --complete` from now on.
- **Go in advance (Tom, 2026-11-01):** Tom gave the go for the six Q247-linked parts in advance in chat; the grill
  session ran `design go ... --by tom` for tree-row, part-tree, zoom-chip, comment-pin, canvas-viewport, pages/merge.
- **Auto-merge forecast on sketches (Tom, 2026-11-01), after the MVP:** a sketch that will very likely be merged
  automatically (for example no change to a selected or hover state, `sketch check` clean) gets a visible mark in
  Studio and in the builder's report, so Tom can tell at a glance which sketches need his merge and which do not.
  What counts as "very likely" comes from the rules the CLI already uses to skip the auto-merge.
- **System lessons from the MVP push (Tom, 2026-11-01), after the MVP:** Tom wants the system fixed so that these
  cannot happen again. Findings from 2026-10-31/11-01:
  - Plain `design check` hid missing states and contrast findings that only `design ready` draws; one measure must
    show every blocker.
  - Button colours live twice: in the SDK design part (`.ethlete/design/sdk/components/button`) and in
    `libs/components`. A sketch merge changed one, the lib port the other, and Studio still drew the old colour.
  - The design renderer loads `@ethlete/*` from `dist/libs` and never says when that build is older than the lib
    sources: the canvas-frames "Save" contrast finding (3.81:1) came from a `dist/libs/components` built before the
    lib fix 7385e470f. `design check` and `design ready` should warn on a stale dist. The part's filled-active rule
    also lacks the lib's `:not([disabled],[aria-disabled='true'])`, one more case of the button colours living twice.
  - Studio has separate "Pick a" and "Merge a" buttons; a pick only writes `decision` into sketch.json, so the
    shell-project-option pick sat unmerged with no sign (applied by hand in d4c238ec0). Until Studio shows "picked,
    not merged" (or one action does both), the builder runs `sketch list` each turn and merges every picked sketch.
  - Forced interactions (hover, active) were applied to disabled states ("disabled-active").
  - A design server started before a `@ethlete/cli` update kept the old routes; Studio showed "has no system view"
    instead of "restart the server".
  - Studio wrote `inventory.json` in a format Prettier rejects, which broke the next push.
  - Browser-backed cli specs were skipped in CI without a signal.
  - render-check compared only one rule with the merged part, so old issues blocked unrelated sketches.
  - A multi-part sketch shows only its first target as its title (Q244).
  - The go exists only in the CLI; an agent cannot give it for Tom, and Studio has no action for it.
  - App views build parts inline that should be their own components (tree-row, part-tree, zoom-chip, comment-pin,
    canvas-viewport, the merge view; Q247), and some designed parts have no app code at all. The system must make a
    part map to one component from the start, so a design part and its implementation cannot drift apart.
  - Glued and interpolated class strings landed in many parts and needed cleanup rounds (Q221, and a new
    CLASS-GLUED-INTERPOLATION after a merge); the check should stop them when a part is written, not after.
  - Pages fought embedded demo frames with Tailwind `!` overrides (Q241); parts should not be able to use `!`.
  - Detection rules were too narrow at first: unused base parts counted only ES imports (Q218); STALE-REPLACE did not
    follow a conditional receiver; the Q243 path normalisation assumes a one-element frame (floating-action).
  - Test fixtures broke on a new import without a signal (frame-bootstrap stub), and a spec hit the 5 s limit only
    on the CI runner.
  - The tomflix design server and the docs-examples app both use port 4403 (`.ethlete/design/config.json`,
    `apps/docs-examples`); the default ports must not collide.
- **Studio MVP reached (2026-11-01):** `design check --product studio --complete` reports 26 of 26 Studio parts
  clean after the Q249 merges, the checkbox and radio-group d merge (e855918d4) and the embedded-control checker fix
  (e0bf58dca). Left on purpose, after the MVP: the 8 UNLINKED parts and `studio-view.component.ts` without a part
  (Q247, Q248), the 48 SDK parts with open points, the lib port of checkbox and radio-group d, and every parked item
  above.
- **Checkbox missing states (2026-11-01), with the checkbox and radio-group SDK track:** the merged variant d of sdk
  `components/checkbox` lacks 4 states (option.disabled, select-all.hover, select-all.active, select-all.disabled).
  One sketch round after the Studio implementation phase, before the lib port.
- **System lesson, canonical classes in app code (Tom, 2026-11-01), after the Studio implementation phase:** the
  builder wrote `size-[22px]` (canonical `size-5.5`) in new Studio app code during the pilot, and no check caught it;
  the editor showed it. The Q220 canonical-class rule (`libs/cli/src/lib/design/system/rules/tailwind-classes.ts`)
  covers the design parts, not the app templates. Lesson: the same check runs on the Tailwind classes in
  `apps/ethlete-studio/src` (lint or `design check`), so an implementation cannot add a non-canonical class.
- **Studio app code quality (Tom, 2026-11-01), after the Studio implementation phase:** the app code in
  `apps/ethlete-studio/src` has many basic flaws. Three groups:
  1. Lint warnings, for example "Binding a static boolean is unnecessary if the `arrow` input uses a
     `booleanAttribute` transform - use a static attribute instead". Goal: 0 warnings in `ethlete-studio`, then the
     lint run fails on a new warning.
  2. Inline SVGs in templates. Icons and logos come from one place (the foundations assets of Q233, or an icon
     component), not pasted markup. Q233 makes this a finding for design parts only; the app code gets the same rule.
  3. Inline components: covered by Q247 and Q248 (one component per part); this item only checks that nothing is left
     after the phase.
- After the MVP (Tom, 2026-11-01, Impl Q18-Q23): multi-user sessions bring a real user identity (the inbox shows
  "Du" until then); the inbox interrupted state and the other old-panel states beyond loading and load error; the
  rail letters (studio, studio-lab, sdk all "S") and the lost "inherits from" hint; per-section trees for Sketches
  and Flows; a performance review that includes the `design check` time (studio ~6:30 since it draws all states).
- After the MVP (Tom, 2026-11-01, Impl Q26): the inbox load-error state shows the real `loadError` message in place of
  the fixed second line.
- After the MVP (Tom, 2026-11-01, Impl Q28): the go hash ignores the `implements` link, so a link-only change does not
  make the go stale.
- After the MVP (Tom, 2026-11-01, Impl Q50): the design harness emits the Tailwind classes the designs use, so a
  design-only class needs no hand-written `@source inline` line in the app's `styles.css`.
- After the MVP (Tom, 2026-11-01, Impl Q51): one shared compare rule for the corner antialias of SDK panes, so no part
  needs the `translate3d` design fix (findings 3 and 23).
- After the MVP (Tom, 2026-11-01, Impl Q55): the sketch-view features the new sketches and merge pages drop: reject and
  reopen a variant, notes, diff lists. Decide in Tom's round whether they come back and where the design shows them.
- After the MVP (Tom, 2026-11-01, Impl Q60): part-tree section level (legacy stages, per-layer "Not used in ..."
  sections) and the frame rows of an entry with several frames.
- For Tom's round (2026-11-01): the side tree no longer shows sketch status and comment counts (Impl Q39/Q43); the
  problem text shows only as the warning's title.
- After the MVP (Tom, 2026-11-01, Impl Q66, Q70, Q72): pins, notes, drafts and `jumpTo` on the flow canvas; a confirm
  for "Verwerfen"; unchanged rows of several parts on the merge page.
- After the MVP (Tom, 2026-11-01, Impl Q75): a per-preset frame box ratio on the flows canvas, so a phone page is not clipped to its top.
- After the MVP (Tom, 2026-11-01, Impl Q81): chat, notes, the top-right page buttons and the footer bar removed from the live pages; each needs a design before it comes back.
- After the MVP (Tom, 2026-11-01, Impl Q83): the studio menu (Einstellungen, Erscheinungsbild, Tastenkürzel, Hilfe, Über Studio) and the logo as its button; each target needs a design first.
