# Ethlete Studio - the design system model

Status: slice 1 done (2026-10-27). Slice 2 (canvas only) in progress. Slice 3 inventory done; the rebuild waits for slices 4 and 5.

This plan replaces the call model (project → feature → call → variant, the 1-7 workflow, call
stages and `legacy: true`). The bridge from the design system to the app code is out of scope. Decide it when
a real system exists.

## Why

The tomflix exploration (`~/dev/tomflix/.ethlete/design/calls/tomflix`) has 40 numbered calls
and a 421-line `PLAN.md`. Decisions live there as prose with RGB values, almost each one "not
yet in the app". Winners are copied from call to call (`variant-g.ts` into `frame.ts`). Calls
build on each other, so each new call makes the older ones stale. Studio stores a history; it
must store a state.

## The model

### Roles

- Studio shows and lets the user decide: view the system, compare variants, pick, comment.
  Editor functions are out of scope for now. Do not design anything that rules them out later.
- The agent writes files through one core. The CLI and an MCP server are thin layers over that
  core. Everything deterministic is a core operation: create a sketch, screenshot, check, inbox.
- Chat stays in the CLI. The chat integration and the 1-7 workflow leave the Studio UI. The
  chat code stays in the repo, unused by the UI.

### Structure

- Repo = workspace. A workspace holds products (for example tomflix, timetrack, studio).
- Each product has exactly one design system.
- A product can extend at most one base system. A base has no base of its own.
- A product overrides a base part by name: a product `button` replaces the base `button`.
  Studio marks each part "from base" or "overridden".
- For a product on `@ethlete/components`, the SDK is the base: its components come from the
  mocks (`component-design-mocks.md`) or from the SSR compiler `ng()`, never redrawn.
- A product's design files live in that product's own repo.

### Layers

| Layer       | Holds                                               | May use                      |
| ----------- | --------------------------------------------------- | ---------------------------- |
| Foundations | tokens (colour, type, spacing), logo, CI            | -                            |
| Components  | generic parts: button, badge, card                  | foundations, components      |
| Elements    | product-specific parts: the tomflix hero and header | foundations, components      |
| Pages       | page states composed of components and elements     | foundations, comps, elements |

- Wireframes are pages built from a fixed wireframe kit that Studio ships (box, text lines,
  image placeholder, button placeholder). A wireframe becomes a page as kit parts are swapped
  for system parts. Studio shows how many kit parts remain.
- Each part records the reason for its current shape as a short note on the part
  ("button: variant C, because …"). History lives in git only. No decision log.

### Files

- TS without Angular, as the drawings are today: a render function with typed props, plus CSS.
  A drawing is a value (`html`, `css`, `drawing()`), not an Angular component. Angular frames
  were rejected: the design server would need the Angular compiler for each repo's Angular
  version.
- Tokens are CSS variables.
- Each product has one fixture set (for example 30 films with posters). All pages use it.
- A component or page declares its own list of named states (variants, sizes, hover,
  disabled, loading; "empty", "3 filters active", "error").
- Each product declares its viewport presets (for example phone, fold outer, fold inner,
  tablet, desktop).

### Slice 1 decisions (2026-10-27)

- Folder layout: `.ethlete/design/<product>/<layer>/<part>/<part>.ts` plus `<part>.css`, with
  `<product>/fixtures.ts` at the product root. Layer folders: `foundations`, `components`,
  `elements`, `pages`. `calls/` stays as it is.
- Config: `config.json` gets a `products` key. An entry holds the render settings of a project
  (`styles`, `head`, `providers`, `themes`) plus `base` and `presets`. The old `projects` key
  stays readable and unchanged until slice 2 moves Studio.
- The note with the reason for a part's shape is a required `note` field in the part's TS
  definition.
- `base` is a path to another product folder. Its settings come from the `config.json` of the
  workspace that holds it. The name `@ethlete/components` is a built-in base: the SDK system
  that ships in `@ethlete/cli`.
- A part imports another part as `@system/<layer>/<name>`, and fixtures as `@system/fixtures`.
  The product resolves the name: its own part, else the base part. So an override also
  replaces the part inside base parts.
- There is no `product.ts`. The `products` entry in `config.json` holds `base` and `presets`.
  The Rust side of Studio can read it as JSON.
- The built-in base `@ethlete/components` lives in `libs/cli/design/systems/ethlete-components/`,
  with a `config.json` next to it. It has the same shape as a workspace, so one loader reads both.
- A part imports the part API as `@design-system` (`libs/cli/design/define-part.ts`). The core
  writes a tsconfig per product, with one explicit `paths` entry for each resolved part.
- `et design check --product <name>` checks one product: the rules, then `tsc`. `et design check`
  with no flag checks every product. The old flags of `check` work as before.
- Base parts are checked as part of the product that uses them.
- Rule details:
  - Hard-coded colour: hex values and colour functions (`rgb()`, `hsl()`, `oklch()`, `color()`
    and the others) in the CSS and TS of a part outside foundations. A fallback in
    `var(--x, #fff)` counts too.
  - Copy of a component: an element or page CSS rule names a class from a component's CSS, or
    element or page markup uses such a class without an import of that component.
  - Motion: a part calls `requestAnimationFrame` or `setInterval`.
  - A relative import out of the part's own folder fails. Import another part as
    `@system/<layer>/<name>`.

- Built in slice 1, in `libs/cli/src/lib/design/system/`:
  - The check prints one line per problem: `<RULE> <file>: <message>`. The rules are `IMPORT`,
    `UPWARD-DEPENDENCY`, `HARD-CODED-COLOUR`, `COMPONENT-COPY`, `MOTION`, `BASE`, `PART`,
    `PRESETS`, `TYPE-ERROR` and `COMMENT` (a stale comment).
  - The loader finds the `config.json` of a base by a walk up from the base folder.
  - A product with no folder of its own uses its base unchanged. This is not a problem.
  - An element or page rule that restyles a component class is a copy, also if the part imports
    the component.
  - The product tsconfig goes to `node_modules/.design-explore/system-<product>.tsconfig.json`.
  - A spec fixture workspace with the products `acme` and `acme-base` is in `__fixtures__/`.
  - The built-in base holds one part so far: `components/button`, rendered with `ng()`.

### Use SDK components first (2026-10-27)

Where an `@ethlete/components` or `@ethlete/core` part fits, use it and do not build a new one.

- Studio UI, for example the canvas: use SDK controls and core primitives. Build only what no SDK
  part covers, for example the transform of the canvas world.
- A product system: take the SDK part from the base and change its look through tokens. A new
  component needs a reason in its `note`, for example "no SDK part covers a poster card".
- The built-in base renders each SDK component with `ng()`. It never redraws one in HTML and CSS.

### Parallel work (2026-10-27)

Three tracks run at the same time. They touch different files.

- Slice 1, the core: `libs/cli/` only.
- Slice 2, the canvas only: a standalone canvas component in `apps/ethlete-studio/src/`, fed
  with mock frames. It does not connect to the core yet, and the old Studio UI stays. It takes
  a cached screenshot URL per frame. The core supplies the screenshots later. The connection
  to the core, the tree, the pickers, the Legacy tab and the removal of the old UI wait for
  slice 1.
- Slice 3, the inventory only: `plans/ethlete-studio/tomflix-inventory.md` sorts the tomflix
  `PLAN.md` and calls into foundations, components and elements. Its open points get a
  recommendation each. The rebuild of the system waits for slice 1. Nothing in the tomflix repo
  changes in this step.

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

### Slice 2 server, as built (2026-10-27)

- Endpoints: `GET /__design/system[?product=]` (parts list with origin, note, states,
  problems), `GET /__design/shot?product&part&state&preset[&surface&color]` (PNG),
  `GET /__design/calls` (Legacy list), `POST /__design/transfer?call=<slug>`.
  `et design system --json [--product]` prints the parts list through the same Vite setup.
- A frame shows a part state with `?product=&part=<layer>/<name>&state=`. `?call=` still works.
- A base part is a separate module in each product (`<file>?design-product=<name>`). This is how
  an override reaches inside base parts.
- Part problems in the list are the rule problems plus `LOAD`. `tsc` errors are left out: they
  take seconds per product.
- Shots: viewport = preset width × preset height (800 px without one), full page, device scale 1.
  The cache drops a shot when its file or a file it imports changes (Vite module graph).
- Studio's Rust watcher already watches `.ethlete/design`. No new reload event.
- Not yet tested on its own: the switch of `ng()` providers to the frame's product.

### Slices 4 and 5 core, as built (2026-10-27)

Commands: `et design sketch new|report|ready|list|check|preview|merge|discard`,
`et design inbox [done <id>]`, `et design comment`. Code in `libs/cli/src/lib/design/system/sketch/`
and `system/comments/`. Studio UI for both slices is not built.

- `sketch.json`: `{ target, status: "in progress" | "ready", createdAt, decision? }`. The
  decision is `{ kind: "pick", variant }` or `{ kind: "discard" }`, with an optional comment.
  Merged and discarded are not stored: the folder is deleted.
- A variant folder is `sketches/<layer>-<name>/<variant>/<layer>/<part>/` and may hold a
  `fixtures.ts`. A new variant starts as a copy of the resolved target, a new part as a stub.
- A variant may change the target, its own layer and the layers its layer may use. Anything else
  is a `SKETCH` problem.
- `ready` only from in progress; nothing moves back. A pick needs `ready`. A discard is allowed
  at any time.
- Merge needs `ready` and a `--note`. It does not compare the variant with the user's pick. Each
  variant part folder replaces the product folder whole. The note goes into the product's own
  target file, so a target that exists only in the base cannot be merged yet.
- Open-sketch problems do not fail `et design check`, so one broken sketch does not block every
  merge. `sketch check` reports them.
- Comment id: UTC timestamp plus 4 hex characters. The stale rule also fails on a missing
  preset, sketch or variant, and on an unreadable comment file.
- The live agent report is a call status at slug `sketches/<product>/<layer>-<name>`, state
  `drawing`, in the temp status folder.
- Not served yet: `mergePreviewOf` and `openSketchProblemsOf` need endpoints in `serve.ts` for
  Studio.

### Canvas, as built (2026-10-27)

The canvas is `apps/ethlete-studio/src/app/components/design-canvas/`. A dev build shows it with
mock frames at `#/canvas-demo`. It does not connect to the design server yet.

- Core parts in use: `ResizeHandlesComponent` (free width), `dragGestureFrom` (pan),
  `signalElementDimensions` and `ProvideColorDirective`.
- The zoom control is plain buttons for now. `@ethlete/components` did not compile under
  Studio's narrowed theme names. The fix is in (`160bd4386`); the control can move to SDK
  buttons now.
- A frame without a height measures its iframe when it is same-origin. Otherwise it uses 600 px
  until it is live once. No guard yet for a page that grows with the iframe height.
- "In view" adds a 400 px margin. The active frame always stays live.
- Esc from inside a cross-origin iframe does not reach the canvas. The real frame page must send
  it with `postMessage`. A click on the empty canvas also leaves the active frame.
- Esc with no active frame clears the selection. `Shift+2` with no selection does nothing.
- Shortcut and zoom-control jumps animate with a 0.25 s CSS transition. Wheel and drag are
  instant. Each wheel delta is clamped to ±25 before it becomes a zoom factor.
- Labels and outlines keep their screen size down to 25 % zoom.
- Studio has no e2e suite, so the canvas has no permanent behaviour test yet. The pan and zoom
  math has unit specs.
- A cross-origin frame sends its height and `Esc` with `postMessage` (abc276276). The 600 px
  fallback now holds only until the frame page reports.

### Studio system view, as built (2026-10-27)

`apps/ethlete-studio/src/app/system-view/` (0b28379f7). The pure part is `system-tree.ts`.

- It reads `/__design/system` from the checkout's design server, and reloads on each change of
  `.ethlete/design` and each server restart. JSON answers carry `access-control-allow-origin: *`
  (badefe639).
- Tree groups follow the layers: Foundations, Components, Elements, Pages. Sketches and Legacy
  follow. An empty group is hidden.
- Badges: "from base", "overridden", and "error" for any problem.
- A part's canvas has one row per state and one frame per preset. Only a `LOAD` problem replaces
  the frames with the error. A part with a rule problem still renders and shows the badge.
- A shot URL carries the change revision, so a picture is fetched again after a change.
- No command creates a product. The empty state shows a `products` example for `config.json`.

Open points, each with a recommendation:

- Product picker: one product shows its name, many show a plain `<select>`. Provisional until
  the picker UI is decided. Recommendation: decide it together with the workspace picker.
- Themes per product: `ListedProduct` has no themes, so the view uses the theme of the old call
  view. Recommendation: list `themes` per product on the server, and pick per product.
- A command that creates a product. Recommendation: `et design product new <name>`, which writes
  the config entry and the layer folders. The empty state then shows that command.
- The selected part is not remembered over a reload. Recommendation: store it with the other
  view state once the layout is settled.

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

Flows:

- A product has many named flows, one file each: `<product>/flows/<name>.json`, for example
  `checkout.json`. Each flow is its own canvas in the tree. It shows its states at one preset,
  picked at the top. A state may appear in many flows. Part canvases show no lines.
- A line connects two states, also two states of the same page ("cart" → "checkout" → "done").
  It has an optional label ("user clicks 'Zur Kasse'"). It holds for every preset.
- Studio lays the frames out left to right along the lines. The flow file already has an
  optional position per frame, so dragging can come later without a format change.
- For now the agent writes flows and lines.

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

### Sketches

- A sketch always has a target: an existing part or a new one. A free sketch (mood, palette,
  logo) is allowed only for foundations, and its result goes into foundations.
- One open sketch per target. A new sketch on the same target needs the old one merged or
  discarded first.
- A sketch may change parts below its target (a new header with a new button variant).
- Status: `in progress` → `ready` → merged or discarded.
  - `in progress`: Studio re-renders live on each file change, with a clear frame and the
    label "in progress". The agent reports what it builds now ("variant B, phone"). The user can
    comment, but not pick.
  - `ready`: the user picks.
- Before the merge, a preview view shows every page and element that uses the changed parts,
  old and new side by side.
- After the merge the sketch is deleted. The picked variant is now the part; the reason is the
  note on the part. The other variants live only in git.

### Feedback

- The user comments on a state or on a point in the canvas. Studio writes the comment as a
  file in the repo.
- The agent reads open comments with `et design inbox` (and the MCP equivalent). A done comment
  is deleted; only the reason stays, as the part's note.

### Checks

`et design check` fails on:

- a dependency that points up a layer, or an element used by a component;
- a hard-coded colour outside foundations;
- a copy of a component inside a page or element;
- motion that is not CSS animations, CSS transitions or the Web Animations API (no
  `requestAnimationFrame` loops). A later timeline tool must stop any animation at time t.

### Canvas and navigation

- Each system entry (for example "button") is its own infinite canvas. Frames on it each show
  one state at one width, always at full height. No scrollbars, only pan and zoom.
- The sheet shows each state across the product presets in a row. A state opened alone gets a
  free-width canvas.
- Controls, as in Figma:
  - space + drag, middle mouse + drag: pan
  - wheel: pan vertically; shift + wheel: pan horizontally
  - ctrl + wheel, pinch: zoom to the pointer
  - `Shift+1` fit all, `Shift+2` fit selection, `Shift+0` 100 %
  - double-click a frame: the frame becomes active (click, hover, scroll inside); `Esc` leaves
  - drag the edge of an active frame: free width
- Only frames in view run live. Frames out of view show a cached screenshot from the same core
  that makes the agent's screenshots, so agent and user see the same presets.
- Top: workspace and product picker. Left: a tree with Foundations, Components, Elements,
  Pages, Wireframes, Sketches and Legacy. Each entry shows badges: from base, overridden, sketch
  open, comment open.
- A sketch shows on its target's canvas: the current version left, the variants right in the
  same states and widths. "Sketches" in the tree lists open sketches as jump targets.

### Kept from the call model

- Studio stays an Angular app. A model name is never a fixed union in the code.
- `frame.html` stays the frame host. It takes `?surface=<name>&color=<name>` and puts the
  classes on `#root`; the theme switch is a Studio control and applies to every frame.
- `ng(template, { imports, fields })` renders real Angular components in Node with
  `@angular/compiler` (JIT) and `renderApplication`, from the built package: `dist/libs/*` in
  the SDK through a resolve hook, `node_modules/@ethlete/*` in a consumer. A product's
  `providers.ts` gives it colour and surface themes; the form field throws without them. A render
  error rejects `ng()`.
- A frame cannot import an `@ethlete` barrel: libs resolve to source, and the import dies with
  `ERR_INSUFFICIENT_RESOURCES`. Pre-bundle the library for a real component from another
  checkout.
- A drawing has a `setup(root)` hook (84ee476e9). It will take a function or an array.
- A drawing may set `et-surface--<name>` on an inner panel, never on its root. A variant
  overrides a colour theme with `themeCss()` in its styles.
- The status files of `et design` live in the temp dir `ethlete-studio-checks/`, one per
  checkout. `libs/cli/src/lib/design/check.ts` already launches a headless Chromium, and
  `serve.ts` already watches the files - the base for screenshots and the live view.

### Legacy calls

The old calls stay in a read-only Legacy tab, as reference for the transfer into the new system.
No new calls, no picks. The user can mark a call "transferred" and deletes the tab when done.

## Slices

1. **Core and data model**: workspace, product, base, layers, fixtures, states, presets, and
   `et design check` with all rules above.
2. **Canvas and navigation**: as above, plus the Legacy tab. The old UI leaves.
3. **First real test**: rebuild the tomflix system with the new workflow, from its old calls in
   Legacy - foundations, components and elements only. It runs after slices 4 and 5, as the
   battle test of the workflow.
4. **Sketches**: status, live `in progress` view, merge preview, merge and discard.
5. **Feedback**: canvas comments and `et design inbox`.
6. **Pages and wireframes**: page states, the wireframe kit, the remaining kit-part count.
7. **Interaction**: a clickable prototype. Part rules, flow-line triggers, play mode and the
   prototype store, as in "Slice 7 decisions".
8. **MCP server**: `et design mcp` over the core, as in "Slice 8 decisions". It replaces
   `apps/ethlete-studio/src-tauri/src/tools.rs`.
9. **Motion**: its own plan. A timeline, controlled time, a screenshot per keyframe. Motion is a
   tool that extends components and elements.

Each slice gets an "in progress" note here when it starts.

Slice 1: done on 2026-10-27.

Slice 2: the canvas, the server and its CLI are done. The Studio UI is in progress since
2026-10-27: the canvas on `/__design/system` and `/__design/shot`, then the tree, then Legacy.

Slice 3: the inventory is done (`tomflix-inventory.md`). The rebuild waits on purpose
(decided 2026-10-27). Tomflix stays out until the new workflow works: canvas, sketches and
feedback. Then the old tomflix calls move to Legacy, and the rebuild from them is the battle
test of the workflow. The inventory is the reference for it.
