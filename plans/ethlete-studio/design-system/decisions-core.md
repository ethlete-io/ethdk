# Design system: slice, token, foundation, theming and wireframe decisions

### Slice 2 decisions (2026-10-27)

- Parts list: the design server (`serve.ts`) serves it from an endpoint, with "from base" and
  "overridden" resolved by the core. Studio reloads it when the watcher reports a change. The
  CLI gets the same core function as `--json` for the agent.
- A base part renders with the render settings (`styles`, `head`, `providers`, `themes`) of the
  product that uses it. The base's own settings apply only when the base is opened as a product.
- Screenshot cache: in the memory of the design server only, as in `thumb.ts` today. The key is
  part, state, preset and theme. An entry becomes invalid when a file of the part or of a part
  below it changes; Vite knows the dependency graph. A disk cache comes only if the start is
  measurably slow.
- The server draws a screenshot only when the canvas asks for it, with a placeholder until then.
  On open, a canvas asks at once for every frame it does not show live. No background job draws
  the whole workspace.
- Below a zoom level, frames in view also show their screenshot instead of running live. Start
  at 50 % and measure the real value in the canvas.
- A render error shows its message in the frame, in place of the content. The part gets an
  "error" badge in the tree.
- Badges in slice 2: "from base", "overridden" and "error". "sketch open" comes with slice 4,
  "comment open" with slice 5.
- Legacy tab: it belongs to the workspace, not to a product, and lists the calls of all
  projects. It shows a call in the new canvas, one frame per variant. The old call UI goes
  completely; the chat code stays unused in the repo.
- "Transferred" is a `transferred: true` field in the call's `call.ts`, next to `legacy: true`.
  Studio writes it through a design server endpoint.
- The Legacy tab disappears when `calls/` is empty or missing. Studio never deletes calls; that
  happens in git.
- A workspace without `products` shows an empty state with the command that creates a product.
  The Legacy tab still shows if calls exist.
- The existing project picker becomes the workspace picker. A product picker for the chosen
  repo goes next to it. The UI of both pickers is still open.

### Slice 10 decisions (2026-10-27)

- A full redesign of Studio from a clean slate, through every layer from foundations to pages, so
  every part of the workflow runs once: base, inheritance, matrix, threads, merge preview, pages.
- It comes after slice 6 (pages need it) and before slices 7 to 9, so workflow gaps show before
  more slices build on them. The tomflix rebuild follows it.
- A new product `studio` in this repo's `.ethlete/design`. `studio-lab` stays the test bed.
- First step: a base `sdk` in this repo, built from the component mocks; `studio` inherits from it.
  Not checked yet: whether another repo can load a base from a package.
- The app imports the product's `foundations/tokens/tokens.css` as the single source; Studio's
  Tailwind theme and SDK themes read their values from it.
- The redesign follows the `ethlete-design-exploration` skill strictly: every layer starts as a
  sketch, and all work goes through sketches, comments, the inbox and the CLI, not the chat. Each
  snag in the workflow goes into this plan as a finding.
- Rebuilding the real app on the new system is its own step after the design.

Slice 10 step 1, as built (6c4efbaa1, 4a44cea44, 8a15315aa, proven headlessly):

- Base product `sdk` in `.ethlete/design/sdk`: `foundations/tokens` is the `themeCss()` output with
  neutral light and dark surfaces, colour themes accent and danger, and the 62.5% root. Components
  drawn by the `libs/components/design` mocks: button (7 states × 4 interactions), form-field (5
  states), select (placeholder, selected, open).
- Product `studio` with base `.ethlete/design/sdk`. Both list `styles: [sdk tokens.css]`.
- Fix: `product new --base` no longer writes an empty `fixtures.ts` that hid the base fixtures.
- With two products in the repo, `sketch` and `comment` need `--product`.

Findings:

- `product new` rewrites `config.json` without Prettier.
- Tokens reached other parts only through config `styles`, so a `foundations/tokens` sketch changed
  only the tokens frames. Resolved by the tokens import (627b9739d).
- The button "active" and "disabled" frames were drawn far wider than their content. It does not
  reproduce on the current tree: headless, all 35 `sdk` button frames are 110 px wide and stable,
  content 98 px (filled) or 90 px (small) in every interaction, and the `/__design/shot` PNGs match.
  Likely fixed by 60bd969e9 (the pre-fix tree was not run, so unverified). If it shows again: a
  stale `measuredSizes` entry in localStorage `ethlete-studio.call-view` from the old loop; a reload
  or clearing those entries fixes it. The 110 px frame for 90 to 98 px content is untraced slack
  (column width or chrome).

Remaining: the redesign layer by layer (Tom decides each sketch); Studio reads its tokens from the
merged `tokens.css` instead of the generated `themes.css` and `surface-themes.css`; the app rebuild
on it; tree rows with one dot per status; a cross-repo base from a package, not checked. The next
builder resumes from `.claude/handoffs/studio-states-interactions.md`.

### Slice 10 foundations framing decisions (2026-10-27)

- One sketch per question, in this order: surfaces, accent, type scale, spacing and radius. Each
  sketch draws with what the ones before it settled.
- Dark only for now. Token names stay neutral (`surface`, not `dark-bg`). Open: a light theme, as
  its own sketch later.
- The current Studio look is not a reference. No variant reproduces it; every variant is new.
- First sketch: `foundations/tokens` in product `studio`, the dark surfaces with their elevation
  steps. Variants: A neutral grey, B cool (slightly blue), C warm (slightly brown), D near black
  with small steps. Each variant shows the same mini scene: sidebar, canvas area, card, popover.
- No reference apps; the builder draws the directions freely.

### Token names and logo decisions (2026-10-27)

- Rename the product tokens that clash with Tailwind theme variables (`--font-sans`, `--font-mono`,
  `--radius-sm` to `--radius-full`), for example to `--font-ui`, `--font-code`, `--radius-control`,
  before the component layer reads them. Tom accepted this. Done: `--font-ui`, `--font-code`,
  `--radius-control-sm|md|lg`, `--radius-pill`, exposed in `@theme inline` (commit 07908b7b8).
- Studio gets a logo: a sketch round on `foundations/logo` in product `studio` (variants A grid,
  B stroke S, C sketch over a part, D Ethlete E; the builder picks B). After Tom's pick: a 1024 px
  export with literal colours (the marks use CSS variables), `tauri icon`, and the mark in the
  sidebar header.

Findings:

- A foundations part could not import the tokens part: `sketch check` flagged UPWARD-DEPENDENCY.
  Fixed: a foundation may use another foundation (cd2c4a6fe).
- `dist/libs/cli` was older than the last `libs/cli` commit; the sketch agent rebuilt it.

### States and interactions decisions (2026-10-27)

Not built yet. The flat state list mixed states (solid, outline) with interactions (hover,
disabled), so hover existed for solid only and focus, active and pressed were missing.

- Two axes. A part declares its states (solid, outline, "solid pressed"); interactions come from a
  fixed Studio list: rest, hover, focus-visible, active, disabled. pressed and loading are states,
  since only some parts have them.
- A part picks its interactions with `interactions` in `definePart`, for example
  `interactions: ['hover', 'focus-visible', 'active', 'disabled']`. Without the field only rest
  applies; `et design check` fails on an unknown name. No default per layer.
- Forcing: the design server rewrites `:hover`, `:focus-visible` and `:active` in every CSS rule to
  `:is(<pseudo>, [data-et-force~="<name>"])`; Studio sets the attribute on the part's root element
  only, so a nested button stays at rest. disabled sets `disabled` and `aria-disabled` on the root.
  This works the same in canvas iframes and screenshots, with the real component CSS. The build
  first checks that the rewrite fits the server's Vite pipeline.
- The part view is a full table: rows are states, columns are interactions. A part without
  `interactions` shows the rest column only.
- The sketch matrix keeps sketch variants as columns; an interaction switch above the canvas picks
  one interaction for all cells, like the size switch.
  Changed by "Sketch interaction matrix decisions": the switch gets "all" as its default.
- A comment gets `interaction` (default rest). Its pin shows only on the matching cell; elsewhere
  the label counts it, as for another size.
- A fitted frame has no border, only the product background with some padding. Frames at presets
  and `widths` keep the border, since there the size means a viewport.
- A live mode per frame: a double click passes the real mouse and keyboard to the frame, `Esc`
  ends it. Its own step before slice 10, apart from motion; motion builds on it later.
- `studio-lab` `components/button` moves to the states solid and outline with the interactions
  hover, focus-visible, active and disabled, so the lab tests the full table.

### Studio lab decision (2026-10-27)

- `studio-lab` stays current with Studio, so the user can see each new feature in the real app.
  Each Studio slice also changes the `studio-lab` data so the feature shows there: for example
  authors in `variantInfo` and `madeBy`, a sketch with several rounds, agent replies with an author.
  The builder's "as built" message names where in `studio-lab` the user sees the feature.

### Studio theming decision (2026-10-27)

- Studio follows the SDK theming rules like any SDK consumer: colours, backgrounds, borders and
  interaction states come from the surface and colour theming tokens (`--et-surface-*`,
  `--et-theme-color-*`) and the theme providers, never from a hardcoded colour or a Tailwind
  palette colour. Semantic colours resolve by theme type (`injectSemanticColorTheme`). Overlays and
  popovers carry the theme context. Only the theme files in `apps/ethlete-studio/src/styles/`
  define raw colour values.
- Each Studio slice checks its UI against the `theming` skill. A finding today: almost all Studio
  UI already uses the tokens; outside the theme files only a few spots use raw values, for example
  the shadow `rgb(0 0 0 / 0.35)` in `styles.css` and the demo colours in `canvas-demo-view`. Fixed
  in 31ca4ce3a and 99f31831b.

### Studio theming details decisions (2026-10-27)

- Studio turns off the Tailwind default palette with `--color-*: initial;` in its `@theme`, so a
  palette class such as `bg-red-500` emits nothing. `transparent`, `currentColor` and the token
  colours from the theme providers stay.
- Shadows use the SDK convention `rgb(var(--et-shadow-color-rgb, 0 0 0) / <alpha>)`. A Studio theme
  file sets `--et-shadow-color-rgb` only when a theme needs a non-black shadow. A real SDK shadow
  token is later SDK work.
- Error and warning colours always resolve by theme type (`injectSemanticColorTheme('error')`),
  never by the theme name `danger`.
- Studio stays dark only for now. The UI must not assume a dark surface (no fixed light text
  colours), so a light theme can come later without a rebuild.
- Everything Studio draws over a product frame (comment pins, merge preview outlines) uses
  Studio's accent colour, not the product's.
- `canvas-demo-view` is deleted, if nothing uses it.
- Built in ec59ffd0d. No template used a palette class; a headless before and after of 245
  elements is identical. The Tailwind default shadows were black too: `--shadow-*` is reset, and
  `sm`, `md` and `lg` use `rgb(var(--et-shadow-color-rgb, 0 0 0) / 0.1)`; `xl` and larger no longer
  exist in Studio. All ten `etProvideColor="danger"` (seven files) now use
  `injectSemanticColorTheme('error')`. No warning or conflict UI exists yet. No fixed light text was
  found. Pins already use Studio's accent, since the product draws in an iframe. `canvas-demo-view`
  and its dev-only route are deleted. Visible change: pin and popover shadows are a bit lighter.

### Design server restart decision (2026-10-27)

- Studio runs the design server from the built copy `dist/apps/ethlete-studio/cli-runtime`, which
  only a full Studio start rebuilds. In a dev build only (`cfg(debug_assertions)`), the footer
  "restart design server" (`design_server_restart`) first runs `npx nx cli-runtime ethlete-studio`
  in the SDK checkout, then starts the server; its log shows "Building the CLI…". A release build
  keeps the shipped copy. No watch process: the user decides when the server restarts.
- Built (fd9586658): the build runs in the SDK root (`CARGO_MANIFEST_DIR/../../..`). The footer log
  starts with "Building the CLI…" and shows the last 40 lines of the build output. If the build
  fails, the server does not start, and Studio shows the error with the output tail. A plain start
  does not build.

### Docs decision (2026-10-27)

- The full `apps/docs/cli/design.md` page comes after the tomflix rebuild, when the workflow has
  proven itself. Until then `apps/docs/cli/index.md` describes `et design` in one correct sentence.

### Slice 4 and 5 decisions (2026-10-27)

Sketches:

- A sketch lives in `<product>/sketches/<layer>-<name>/`: a `sketch.json` with the target and
  the status, and one folder per variant. A variant mirrors the product layout and holds only
  the parts it changes. The resolver lays a variant over the product. A sketch for a new part
  has the same shape; its target does not exist in the product yet.
- The status (`in progress`, `ready`) is in `sketch.json`, in git. The agent sets `ready` with
  `et design sketch ready <target>`. The live agent report ("variant B, phone") goes into the
  temp folder `ethlete-studio-checks/`, as the call status does now.
- The user picks a variant, with an optional comment, or discards the sketch. For now Studio
  only writes that decision into `sketch.json`. The agent runs the core operation:
  `et design sketch merge <target> <variant> --note "…"` or `et design sketch discard <target>`.
  Merge copies the variant parts over the product, sets the note on the target, deletes the
  sketch and runs the check. If the check fails, it restores the old files. Studio can call the
  same core operations itself later.
- Merge and discard refuse while the sketch has open comments. The agent handles them first.
- The check rules run on each open variant, laid over the product. A variant with problems
  shows them in the canvas and cannot be picked.
- Merge preview: the core lists each element and page that uses a changed part, from the import
  graph the checks already build, and the design server serves the list. Studio draws old and
  new side by side.

Comments:

- One JSON file per comment: `<product>/comments/<id>.json`, with the part, state, preset, an
  optional point, an optional sketch variant, and the text. No author field.
- A point is x and y in CSS pixels from the top left corner of the frame, at the stored preset.
- `et design inbox` lists the open comments and the open pick and discard decisions of all
  products, oldest first, as text or `--json`. `et design inbox done <id>` deletes a comment.
- `et design check` fails on a comment whose part or state no longer exists.

### Token decisions (2026-10-27)

- A product's token values live in one place: the CSS file of its foundations token part, for
  example `foundations/tokens/tokens.css`. The part draws its swatches with it, and the product's
  `styles` lists the same file, so every frame gets the tokens. No second theme file.
- The core does not load foundations CSS into every frame by itself. The `styles` entry stays
  explicit; a logo part's CSS, for example, must not become global.

### Slice 6 decisions (2026-10-27)

Pages:

- A page has the same shape as every part: each state has props, and the data comes from the
  product fixtures.
- A shell is a normal element named by its purpose, for example `shell-main` or `shell-auth`.
  Each page imports the shell it needs. A page without a shell needs no exception.
- A dialog without its own URL is an element. The page under it has a state that shows it, for
  example "login open".

Wireframes:

- Studio ships the kit: box, text lines, image, button, input and icon. The kit has a fixed,
  neutral grey look, independent of the product. The hard-coded colour rule does not apply to it.
- Only pages may use kit parts. `et design check` fails when a component or an element imports
  one.
- A wireframe lives in `pages/` like every page. Studio lists the page under "Wireframes" while
  it uses at least one kit part. The core counts the kit-part uses in the page source, without a
  render, and the tree shows the count next to the page.

Pages and wireframes, as built (2026-10-27):

- Pages already held before slice 6: states with props, `@system/fixtures`, and a page importing
  an element or component. A shell and a dialog state need no new code.
- b9fae0d96: the kit is `@design-system/kit` (`box`, `textLines`, `image`, `button`, `input`, `icon`),
  each returning markup with a fixed grey inline style. It lives in the cli
  (`libs/cli/design/wireframe-kit.ts`), not in a product, so the colour rule never scans it. More
  commits: 49110d91b, 052c98525. `WIREFRAME-KIT` fails a non-page part that
  imports it. The system list gives each page `kitUses`, the kit calls in its source.
- ade8021ca: the tree lists a page with `kitUses > 0` under Wireframes, after Pages, with the count.
- The lab has `elements/shell-main`, `elements/login-dialog`, `pages/library` in the shell with a
  "login open" state, and the wireframe `pages/film-detail`.

Flows:

- A product has many named flows, one file each: `<product>/flows/<name>.json`, for example
  `checkout.json`. Each flow is its own canvas in the tree. It shows its states at one preset,
  picked at the top. A state may appear in many flows. Part canvases show no lines.
- A line connects two states, also two states of the same page ("cart" → "checkout" → "done").
  It has an optional label ("user clicks 'Zur Kasse'"). It holds for every preset.
- Studio lays the frames out left to right along the lines. The flow file already has an
  optional position per frame, so dragging can come later without a format change.
- For now the agent writes flows and lines.

Flows, as built (2026-10-27):

- 97786e79d, 8e5aa8bd4: `<product>/flows/<name>.json` is
  `{ frames: [{ part, state, position? }], lines: [{ from: { part, state }, to: { part, state }, label? }] }`.
  Unknown keys are ignored, so free notes fit in later without a format change. A frame position
  overrides the auto layout.
- `et design check` rule `FLOW`: an unreadable or misshaped file, a frame that names a missing part
  or state, a state listed twice, a line to a state that is not a frame of the flow.
- `GET /__design/flows?product=`. Studio: tree group "Flows" before Sketches, one entry per flow; the
  flow canvas lays the frames out left to right along the lines, with SVG lines, arrowheads and
  labels; a preset picker at the top right, for the session only.
- Lab: `studio-lab/flows/sign-in.json`, 4 library states, 3 lines, one between two states of the same
  page. Proven headlessly: tree entry, layout, lines, labels, picker at 390 and 1440 px. Not proven:
  drawn frame contents (the scratch copy could not resolve Tailwind).
- e70e6b8be: the design-exploration skill teaches flows, the wireframe kit and the `FLOW` and
  `WIREFRAME-KIT` rules. Proven with drawn frames: `sign-in` shows the real library states, the
  "login open" dialog and both line labels. Open: the rest of the skill's stage 3 still describes the
  legacy call workflow; a docs rewrite later.

Notes:

- A note stays on the canvas and is not a task, unlike a comment. The user writes, changes and
  deletes notes directly in Studio.
- A note on a state is its own file, `<product>/notes/<id>.json`, with an optional point. It
  shows everywhere the state shows: on the part canvas and in every flow.
- A free note, for example a heading over a group of frames, belongs to one flow and lives in
  that flow's file.

### Slice 7 decisions (2026-10-27)

Rules:

- A switch inside a part (a menu that opens) is a rule in the part, in a `rules` field next to
  `states`. It works wherever the part shows.
- A switch between pages is a trigger on a flow line.
- Both have one shape: a trigger of event and CSS selector, a target state, and an optional
  store change, for example `{ on: 'click .checkout', to: 'checkout' }`.
- `et design check` renders each state that has rules. It fails on a selector that matches
  nothing and on a target state that does not exist.

Play:

- In an active frame on a canvas, the rules of the part run. A flow has a play mode: one large
  frame at the picked preset, starting at the first state, where the flow-line triggers also run.
- A switch is a View Transition that fades opacity only. A part can give an element a
  `view-transition-name` so that it stays in place between two states, for example a poster.
  Everything else waits for slice 9.
- Changed by the motion plan (`plans/ethlete-studio/motion.md`): a rule in a part switches by a
  morph of the existing DOM, not by an opacity fade, and names its motion explicitly.
- Controls: "back to start" and a reduced-motion switch that emulates `prefers-reduced-motion`.
  A speed control comes with the slice 9 timeline.

State:

- A state runs as live DOM with `setup(root)`. On a switch, the new state takes the values of
  input fields with the same `name`.
- A prototype has a store. Its start values are in the flow file, for example `{ cart: 2 }`. An
  active frame outside a flow starts with an empty store.
- A rule may set a value, increase or decrease a number, or toggle a boolean. Nothing more; for
  anything else the part has `setup(root)`.
- A store value replaces the prop of the same name. `et design check` fails on a store value
  that matches no prop in the states of its flow.
- "Back to start" resets the store to its start values.

### Slice 8 decisions (2026-10-27)

- The MCP server runs in the CLI as `et design mcp` and calls the core directly. It works in
  every terminal session, without Studio. The server in
  `apps/ethlete-studio/src-tauri/src/tools.rs` goes.
- One tool per deterministic core operation: the parts list, check, screenshot, the sketch
  commands (new, ready, merge, discard), the live report, and inbox read and done. Every tool
  is also a CLI command, and every such CLI command is also a tool. The agent writes part
  files with its normal file tools.
- The screenshot tool takes part, state, preset and theme and returns the image. It draws the
  same way as the Studio screenshot cache, so agent and user see the same thing.
- The workspace is the working directory of the session. The product is an argument, optional
  when the workspace has only one product.
- `ethlete-agents sync` registers the server in `.mcp.json` and in the Codex config, in this
  repo and in every consumer repo.
- A new skill in `libs/agent-rules` explains the system and its tools, and says that motion
  comes later. `design-exploration` stays for the dialog process and points to sketches
  instead of calls.
- The unused Studio chat code points to `et design mcp`, so it still runs. Then `tools.rs` is
  deleted.
- No tools for the old calls. The agent reads them as files.

As built (2026-10-30, `90724234f`): `et design mcp` (`libs/cli/src/lib/design/mcp-command.ts`) answers MCP over stdio
with the tools `parts`, `check`, `shot`, `motion_shots`, `sketch_new`, `sketch_report`, `sketch_ready`, `sketch_merge`,
`sketch_discard`, `inbox`, `inbox_done`. Each tool is a table entry that builds the argv of the `et design` command of the
same name and runs this same CLI in a child process in the working directory, so command output never lands on the protocol
stream. A `.png` path the command prints comes back as an image, a `.json` path as text. Bite: the spec fails without the
image attachment and when a notification gets an answer; one test runs the real commands in process. Verified end to end
with the built CLI on scratch checkouts (`shot` image, `motion_shots` image and JSON). Open: the `.mcp.json` and Codex
registration in `ethlete-agents sync`, the agent-rules skill, pointing the Studio chat at `et design mcp` and deleting
`tools.rs`; the tools for the other sketch commands (variant, round, list, check, preview, rebase) and `comment reply`.

### Checkup decisions (2026-10-27)

- Merge needs a pick in `sketch.json` and merges only the picked variant. Otherwise it refuses
  with a message. Today it checks neither.
- A sketch on a target that exists only in the base can be merged: merge creates the target in
  the product, so the part becomes "overridden", and writes the note there.
- A sketch records the state of each part it changes when it is created. If one of those parts
  changed in the product since then, merge refuses, as a conflict in git does. The agent brings
  the variant up to date. Without this, the second of two sketches that change the same part
  overwrites the first one silently, because a variant replaces a whole part folder.
- `et design check` fails on a note whose part or state no longer exists, with the same rule as
  for comments.
- The design server lists the `themes` of each product, and Studio picks the theme per product.
- `et design product new <name>` creates a product. It writes the `products` entry in
  `config.json`, the folder `<name>/` with the four empty layer folders, and an empty
  `fixtures.ts`. The new product passes `et design check` at once.
  - `--base <path|@ethlete/components>` is optional. Without it, the product has no base.
  - If the base has presets, the command writes none, and the product inherits them. Without a
    base, it writes `phone` (390×844) and `desktop` (1440×900). More presets are added by hand.
  - `--from-project <name>` copies `styles`, `head`, `providers` and `themes` from an old
    `projects` entry. The old entry stays unchanged.
  - If the entry or the folder exists, the command exits with code 1 and changes nothing.
  - If `config.json` does not exist, the command creates it with only the `products` key.
  - The empty state of Studio shows the command as text with a copy button. Studio never writes
    `config.json`.
