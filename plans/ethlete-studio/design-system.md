# Ethlete Studio - the design system model

Status (2026-10-27): slices 1 and 2 done; the old Calls UI is removed. Slice 4: core and Studio sketch view done; the frame size decisions and three sketch follow-ups are open. Slice 5: core and Studio comments done, with threads. States and interactions: in progress. Slice 3 inventory done; the rebuild waits for slices 4 and 5.

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
  image, button, input and icon). A wireframe becomes a page as kit parts are swapped
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
- A component or page declares its own list of named states (variants, sizes, pressed,
  loading; "empty", "3 filters active", "error"). Interactions (hover, focus-visible, active,
  disabled) are a second axis; see "States and interactions decisions".
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
- A part's canvas has one row per state and one frame per preset (replaced: see "Frame size
  decisions"). Only a `LOAD` problem replaces
  the frames with the error. A part with a rule problem still renders and shows the badge.
- A shot URL carries the change revision, so a picture is fetched again after a change.
- No command creates a product. The empty state shows a `products` example for `config.json`.

Open points, each with a recommendation:

- Product picker: decided, see "Picker decisions".
- Themes per product: done. The server lists `themes` per product (5a16985e5), and Studio
  remembers the pick per checkout and product.
- A command that creates a product: done, `et design product new <name>`. The empty state shows it.
- The selected part over a reload: done, Studio remembers it as `systemEntry` (25837501a).

### Picker decisions (2026-10-27)

- The checkout picker stays in the status bar; the product picker stays at the top of the sidebar.
- The product picker is always an SDK `et-select`, also with one product. Its last option is
  "New product".
- The checkout picker becomes an SDK `et-select`. Its panel (add, search, forget) stays.
- In the open list, a product with a base shows "inherits from <base>" muted below its name. The
  closed select shows the name only.
- "New product" shows the empty-state screen in the canvas area, headed "New product", with the
  command and the copy button. The picker shows "New product" as picked; another pick goes back.
- Later: that screen gets a form with a name and an optional base (an `et-select` of the existing
  products). A new design server endpoint creates the product with the code of
  `et design product new`; the list reloads and the new product is picked. `--from-project` stays
  CLI only.

### Studio Legacy and sketch API, as built (2026-10-27)

- Legacy (ed013d95b): the tree lists `/__design/calls`, one group per project when there are
  several. A call shows one frame per variant at its `frameWidth`. "Mark transferred" posts
  `/__design/transfer`. Studio remembers the Calls or System view.
- A 404 on the system or calls route shows "This checkout's @ethlete/cli has no system view.
  Update it." (3b6833a8c).
- Sketch and comment endpoints (31f864de2, `libs/cli/src/lib/design/studio-api.ts`), all with
  `?product=`: GET `sketches`, `sketch-preview`, `comments`; POST `sketch-decision`,
  `sketch-merge`, `sketch-discard`, `comment`, `comment-done`. A done comment is deleted. The
  watcher no longer reloads frames on a change to `sketch.json` or a comment file.
- Checkup decisions, as built:
  - Merge takes no variant. It merges the pick, and refuses without one (496a5e8c6).
  - A merge on a base-only target copies the base folder into the product first.
  - `sketch.json` holds a `baseline`: a content hash per resolved part folder and of the
    fixtures. A merge refuses when a part the pick holds changed since. The new
    `et design sketch rebase <layer>/<name>` records the product again. A sketch without a
    baseline needs a rebase before a merge.
  - A note whose part or state is gone fails the check with rule `COMMENT` (c618028b5). The note
    reader in `system/notes/note.ts` is provisional until slice 6.
  - `ListedProduct.themes` is `{ surface: string[]; color: string[] }` from the product's own
    config, without inheritance from the base (5a16985e5).

Open points, each with a recommendation:

- Merge runs the check inside the dev server: decided, see "Merge and rebase decisions".
- Rebase has no endpoint: decided, see "Merge and rebase decisions".
- Merge, conflicts and rebase are not in `apps/docs`: decided, the full `et design` page comes
  after the tomflix rebuild.

### Merge and rebase decisions (2026-10-27)

- No rebase button in Studio. A rebase only records the baseline again; it does not adapt the
  variant, so a click would let the next merge overwrite the product change silently. On a
  refused merge Studio shows the reason, the changed parts and the rebase command with a copy
  button. The agent adapts the variant and rebases.
- `et design inbox` lists a sketch whose baseline is stale as "needs rebase", with the changed
  parts.
- The merge stays in the design server. It moves to a worker only once a merge visibly hangs.
- While a merge runs, the Merge button shows `loading` and Discard is disabled; the sketch in the
  sidebar shows "merging". On success the sketch goes away and Studio selects the target part.

### Comment UI decisions (2026-10-27)

- Comment mode: a toolbar button or the key `C`. A click on a frame sets a point; a click on a
  tile label comments on the state without a point. `Esc` ends the mode.
- A popover at the click point holds an `et` textarea. `Enter` sends, `Shift+Enter` breaks the
  line, `Esc` cancels. The mode stays on after a send.
- The comment field `preset` becomes `size`: a preset name, a width such as `520`, or `fitted`.
  A pin shows only on a frame of the same size; other sizes show only a count on the label. A
  point in percent would land on another element once the layout wraps differently.
- Numbered pins open a popover with the text and "Withdraw". The comment sidebar lists the
  threads; see "Comment thread decisions", which replaces the earlier panel for one part.
- "Withdraw" deletes a comment through `comment-done`, without a restriction and without a note.
- With open comments, the sketch view disables Merge and Discard with "N open comments"; a click
  on it opens the panel.
- The design server sends its own signal on a change under `comments/`. Studio then reloads the
  comments only, not the frames.

### Comment thread decisions (2026-10-27)

- The user and the agent both reply. The agent replies with `et design comment reply <id> <text>`,
  so it can ask back instead of guessing.
- The comment file gets `replies: { by: 'user' | 'agent', text, createdAt }[]`. The first text
  stays in the comment itself and is always the user's.
- Done and withdraw act on the whole thread: done deletes it and writes the note, withdraw deletes
  it without a note.
- `et design inbox` lists a thread as work only when the last word is the user's. A thread whose
  last word is the agent's goes into a separate group, "waiting for the user".
- Every open thread blocks merge and discard, whoever has the last word.
- The pin popover shows the whole thread with sender and time, and a reply field (`Enter` sends,
  `Shift+Enter` breaks the line).
- The comment sidebar lists all open threads of the product, grouped by part, the selected part's
  group on top. Each entry shows the first text, the last sender, the reply count and the age. A
  click selects the part, moves the camera to the pin and opens its popover.
- An agent question (the last word is the agent's) shows in four places: a group "Questions for
  you" at the top of the sidebar, an accent dot on the pin, a tree badge "question" next to
  "comment open", and a count on the comment toolbar button.
- A toolbar button of its own toggles the sidebar, and Studio remembers the state. A click on the
  question count opens it. Comment mode does not open it, and it never opens by itself.

### Sketch matrix cell and spacing decisions (2026-10-27)

- A cell whose variant lacks the row's state is a dashed empty cell at the size of the other cells
  in the row; at size `fitted` it takes the size of the largest one. It reads "a has no disabled
  state"; in the `current` column, "new in this sketch". It takes no comment, since a comment
  needs a state the part has.
- The canvas row gap is 48 px for fitted frames (the tile grid, the matrix at `fitted`) and stays
  120 px for pages and parts with `widths`. Tom approved 48 px from a screenshot.

### Comment done note (2026-10-27)

- `et design inbox done <id>` needs `--note "<reason>"`. The note replaces the part's note, not
  appends to it, and still explains the whole shape of the part; the agent may keep the old note
  when it still holds. Withdraw is a separate Studio path that deletes without a note.
- Breaking: `et design inbox --json` gives `{ items, waitingForUser }` instead of an array. No
  migration, since only agents read it.

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

### Comment follow-up decisions (2026-10-27)

Built in 53a10e894; the merge lock needed no change.

- The canvas row gap stays 48 px for fitted frames; Tom approved the rating matrix screenshot.
- An open pin drops `[pressed]` and shows a ring in the accent colour instead of a hollow button.
- The Sketches group in the tree names a sketch without its layer prefix ("card", not
  "components/card"); the full name is the tooltip. The look of tree rows and badges is a design
  question again in slice 10.
- A tree row with a question hides "comment open", since a question implies an open comment. In
  slice 10, a row keeps its full name and shows one dot per status, labels in the tooltip, the
  question dot in the accent colour.
- The "N ?" question count stays attached to the Comment toolbar button as one control.
- The merge lock keeps counting every open comment on the target part, also one older than the
  sketch: the merge changes the part, so the agent reviews each first.

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
- A comment gets `interaction` (default rest). Its pin shows only on the matching cell; elsewhere
  the label counts it, as for another size.
- A fitted frame has no border, only the product background with some padding. Frames at presets
  and `widths` keep the border, since there the size means a viewport.
- A live mode per frame: a double click passes the real mouse and keyboard to the frame, `Esc`
  ends it. Its own step before slice 10, apart from motion; motion builds on it later.
- `studio-lab` `components/button` moves to the states solid and outline with the interactions
  hover, focus-visible, active and disabled, so the lab tests the full table.

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

### Studio sketch view, as built (2026-10-27)

`system-view/sketch-view.component.ts` (32ad5a861); the pure part is `sketchFramesOf`, `canPick`
and `pickedVariantOf` in `system-tree.ts`.

- A Sketches group lists the open sketches with their status; the target part gets "sketch open".
- The canvas has one row per state of the target: the current part at every preset, then each
  variant at every preset. A variant with problems lists them and cannot be picked.
- Pick writes `sketch-decision`. Merge needs a pick and a note, writes the pick again with the
  note, then calls `sketch-merge` without a variant. Discard asks once more, then calls
  `sketch-discard`. A refusal shows the server's message. The preview lists changed and affected
  parts as text.

Open points, each with a recommendation:

- Resolved: `frame.html` and the shot route draw a part through `overlaySketch` when the
  address names `sketch` and `variant`; the system registry lists each variant's parts as
  `sketchParts`.
- Resolved (186b3c80c, 0f966f967): states per variant come from `targets`; the sketch matrix
  replaces `sketchFramesOf`.
- Resolved (0f966f967): the merge preview draws the affected parts before and after the merge.

### Studio fixes, as built (2026-10-27)

- d8cee09f4: when a design server that Studio did not start goes away, Studio starts its own
  server and the frames load again. Cause of "Failed to fetch" after a restart: a server left by
  a Studio build before 5e43611f5 crashed with EPIPE on its first log line.
- accd23ecd: the design server reads `config.json` again when it changes, so a new product shows
  without a restart. Still needs a restart: the port, `render.packages`, `render.modules`, and
  the `base` folder of a new product.
- 3f34d1751: Studio remembers the picked checkout across a restart.
- 4c24ef421: the `studio-lab` product in this repo is the test bed for new Studio features. It has
  no themes, no base, no comments and no ready or merged sketch yet.
- d25e8a8b0: the empty space above the sketch frames came from the camera fit centering a short,
  wide layout. The fit now anchors at the top.

### Frame size decisions (2026-10-27)

These replace "one row per state and one frame per preset" for every part.

Frames:

- Only pages get the viewport presets of the product, always all of them. A page cannot pick a
  subset.
- Foundations, components and elements get no viewport preset. Their frame fits the content plus
  a small margin.
- A part that responds to its width declares container widths, for example
  `widths: [280, 480, 720]`. Studio shows one frame per width; the height fits the content.
- A part that fills its container must declare `widths`. Without `widths` it fits its content.
- A handle to drag a frame to any width comes later, not now.

Part view:

- A small part shows all its states as a grid of tiles, with the state name under each tile.
- A page, and a part with `widths`, show one row per state and one frame per preset or width.

Sketch view:

- A matrix: one row per state, one column per variant (`current`, `a`, `b`).
- For a page or a part with `widths`, a switch above the matrix picks one preset or one width
  for all cells.
- A variant that the agent still draws shows only its column head ("drawing …"), no frames.

Bug: the sketch view shows about 400 px of empty space above the frames.

### Frame sizes, as built (2026-10-27)

Core in 937128e10, Studio in fabc5cb90. The sketch view is unchanged.

- `definePart({ widths: [240, 360, 520] })`. The parts list (`/__design/system`, `et design system
--json`) carries `widths` when it is a non-empty list of positive numbers. Rule `WIDTHS` flags a
  literal that is not; a `widths` held in a variable is not read and passes.
- Shot route: `preset=` as before; `width=` draws at that width; neither fits the content. Both new
  modes crop the PNG to `#root`, so the height fits the content. `frame.html?…&fit` draws `#root`
  at `max-content` with 16 px padding and reports its width with the height message.
- Studio: a page keeps one row per state and one frame per preset; a part with `widths` gets one
  row per state and one frame per width; any other part is a grid of tiles (wrapping at 1600 px),
  the state name under each tile. A fitted frame takes its width from the frame page, or from its
  screenshot until it goes live.
- `studio-lab` `components/card` declares `widths: [240, 360, 520]` and now fills its container.
- Verified: unit specs (shot route, rule, list, `framesOf`, grid layout, frame message), and real
  shots from a scratch design server (fitted button 101×68, card at 240 → 240×128, page presets).
  Not verified: the Studio canvas itself, headless or by eye.

Open points, each with a recommendation:

- The canvas grid and the label below each tile were not looked at. Recommendation: check them in
  Studio on `studio-lab` before the sketch view slice builds on them.
- Done: the camera fits again while fitted frames report their size (d25e8a8b0).
- Done: the sketch view draws through `sketchMatrixOf` with a size switch (0f966f967).

### Sketch matrix, as built (2026-10-27)

- 186b3c80c (core): `/__design/sketches` gives each sketch `targets` (per variant: `states`,
  `widths`, `error`, read through the Vite loader with the variant overlay) and `report`
  (`{ message, updatedAt, variant }` or `null`). `variant` is the name after `variant ` in the report
  message, only when the sketch has it. The Tauri `design_statuses` command could read the report
  too, but no Studio code calls it.
- d25e8a8b0 (Studio canvas): the fit anchors at the top, stops at 100 %, leaves 160 px for the row
  names, and fits again while frames report their size until the user moves the camera (`fitAll()` is
  public and turns that on again). A cross-origin frame now listens for size messages from the moment
  the iframe exists: before, the first message came before the load event, so every fitted tile
  kept 320x600.
- Verified headlessly (stubbed host, scratch design server on `DE_PORT`): button tiles fit their
  content, card rows per width, page presets, row names visible.

- 0f966f967 (Studio): `sketchMatrixOf` in `system-tree.ts` gives columns `current` (when the part
  exists) and each variant, one row per state (current states first, then states only a variant
  has), and every cell at one size: a page preset, a width from the part or any variant, or fitted.
  A variant named by `report.variant` while the sketch is in progress gets only its head
  ("b · drawing …"). `PartAddress` takes `sketch` and `variant`, so variant cells have screenshots.
  The canvas has a `matrix` arrangement (`layoutMatrix`, column heads, an empty column 320 px wide);
  the fit leaves room for the heads. A size switch (et-buttons) sits above the canvas and refits.
  The agent's report line shows there while the sketch is in progress.
- 0f966f967: "Show merge preview" (after a pick, when parts are affected) swaps the canvas to
  `mergePreviewOf`: every state of each affected part, column `now` and `after merging <variant>`.
- 0f966f967: Studio arms `design_status_watch` and reloads the sketches on its signal, so a new
  report shows without a reload.
- fb8c7a0a5 (`studio-lab`): `elements/rating`, a ready sketch of a new part (a: stars, 3 states;
  b: bar, 4 states). `components/card`, a ready sketch with b picked (more padding), and
  `pages/library` now draws the card in its empty state, so the card sketch has a merge preview.
- Verified: unit specs (`sketchMatrixOf`, `mergePreviewOf`, `layoutMatrix`), and headlessly against
  `:4221` with a stubbed host and a scratch design server on 4492: the rating matrix in progress
  with "b · drawing …", the reload when the stubbed status channel fires after a new report (the
  drawing column moved to a), the ready matrix with the state only b has, the card width switch
  (240 → 520 px), and the merge preview of `pages/library`.

Open points, each with a recommendation:

- Done: the design-exploration skill names the variant in each report (4e2fd4d54).
- The status watch reload was only seen through a stubbed channel. Recommendation: check it once
  in the real app with `et design sketch report` on `studio-lab`.
- Decided: the merge preview keeps every state of every affected part. A state filter comes
  only once a product shows it is too slow.
- Decided: `studio-lab` lists its `--lab-*` tokens file in the product's `styles`. See "Token
  decisions".
- Decided: column heads keep the ellipsis at low zoom; the matrix is read near 100 %.
- The card at 520 px with the long state showed its frame cut at the bottom once. Recommendation:
  check whether the frame page reports a height after its web fonts load.

### Studio comments, as built (2026-10-27)

- f13302bf3: a Comments toolbar button (with the count) toggles a sidebar on the right
  (`comment-panel.component.ts`); Studio remembers it (`commentsOpen` in the view state). Comment mode
  never opens it. It lists every open comment of the product grouped by part, the shown part first
  (`commentGroupsOf`); an entry shows number, text, where and age (`ageOf`). The meta line
  (`data-comment-meta`) is the place for the last sender and the reply count. A click selects the part
  or sketch, moves the camera to the pin and opens it; in a sketch it switches to the comment's size
  when the matrix offers it, and a comment without a shown pin focuses the frame of its state.
- f13302bf3: a frame label notes "N comments at other sizes" (`withOtherSizeNotes`).
- f13302bf3: with open comments on the target, the sketch view disables Merge and Discard and shows
  "N open comments"; a click opens the sidebar.
- f13302bf3: the pin popover's Withdraw is `transparent`, like the draft's Cancel. Esc in comment mode
  cancels a draft first and ends the mode only on a second press.
- f13302bf3: a matrix cell whose column lacks the row's state is a dashed empty cell
  (`CanvasFrame.empty`): "<variant> has no <state> state", or "new in this sketch" in `current`. It
  takes the largest size in its row, has no place (not commentable) and cannot be activated.
- f13302bf3: the row gap is 48 px when every frame fits its content (tile grid, fitted matrix), 120 px
  for pages and parts with `widths`. 48 px is a start value for the user to look at.
- 8bc302576: the studio-lab sample comment (on `components/button` variant b, `fitted`).
- Verified: unit specs (`sketchMatrixOf` empty cells, `commentGroupsOf`, `ageOf`, `withOtherSizeNotes`,
  `otherSizeFrameOf`), and headlessly against `:4221` with a stubbed host and a scratch design server
  on 4494: the rating matrix with "a has no disabled state" (`/tmp/studio-rating-matrix.png`), the
  button sketch lock ("1 open comment", Merge and Discard disabled), the sidebar and the jump that
  opens the pin, draft placement at the click point with a constant on-screen width at 44 % and
  150 %, Esc cancelling only the draft, a caption click in the tile grid starting a state comment,
  and the tree badges and draft field.

Open points, each with a recommendation:

- A frame reload uses one global revision, so every visible frame reloads on each change.
  Recommendation: a per-part revision from the design server, so only the changed part reloads.
- Done: the merge lock, the row gap, the pin ring and the sketch row names, as in "Comment follow-up
  decisions" (53a10e894).
- Done: replies, the thread in the popover and the "N ?" question count (35d609cee, b5402b4d5).

### Studio comment threads, as built (2026-10-27)

- 35d609cee: the pin popover shows the whole thread (`comment-thread.component.ts`): sender ("You"
  or "Agent", the agent in the accent colour) and age per entry, a reply field (`Enter` sends,
  `Shift+Enter` breaks the line), Withdraw and Reply. A reply goes through the `comment-reply`
  endpoint as `{ by: 'user' }`.
- `ListedComment.replies` is `{ by, text, createdAt }[]`, oldest first. `isQuestion` is true when
  the agent has the last word; `lastSenderOf` falls back to the user, who wrote the first text.
- A question shows as a dot on its pin, as the "question" badge in the tree, in the sidebar, and as
  the "N ?" count on the Comment button ("N questions for you").
- b5402b4d5: a part with a question shows only the "question" badge, not "comment open" too.

### States and interactions step 1, as built (2026-10-27)

- c1c848c75: `definePart` takes `interactions` (`hover`, `focus-visible`, `active`, `disabled`).
  `et design check` fails on an unknown name (`system/rules/interactions.ts`).
- `GET /__design/system` gives `ListedPart.interactions`; empty means rest only. The `targets` of
  `/__design/sketches` carry it too.
- The rewrite is `force-interactions.ts` (postcss and postcss-selector-parser). The server has no
  Angular Vite plugin, so it runs in three places: a PostCSS plugin for every `.css` that Vite
  serves, the `ng()` styles in `/__design/render`, and the `drawing({ styles })` strings, which
  `frame.ts` sends to the new `POST /__design/force`.

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
  Pages, Wireframes, Flows, Sketches and Legacy. Each entry shows badges: from base, overridden, sketch
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
No new calls, no picks. The user can mark a call "transferred". The tab disappears when `calls/` is empty or missing.

Decided 2026-10-27, later the same day: the old call UI goes, because the Legacy section of the
system view replaces it. Removed in 4b2383ae2. The '' route is `studio-view/StudioViewComponent`:
the system view plus a status bar with the checkout picker, the server lifecycle and the update
buttons. Legacy calls stay reachable under Legacy in the system tree. The Rust commands that only
the old UI called (`design_statuses`, `design_status_watch`, `design_system`, `design_set_verdict`,
`design_set_closed`, `design_set_mode`, `design_add_variants`, `tools::design_check`) are still in
`src-tauri`. Recommendation: remove them in one Rust slice with their tests.

## Slices

1. **Core and data model**: workspace, product, base, layers, fixtures, states, presets, and
   `et design check` with all rules above.
2. **Canvas and navigation**: as above, plus the Legacy tab. The old UI is removed (see
   "Legacy calls").
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
9. **Motion**: its own plan, `plans/ethlete-studio/motion.md`. A timeline, controlled time, a
   screenshot per keyframe. Motion is a tool that extends components and elements.
10. **Studio designs Studio**: a full redesign of Studio through the whole workflow, as in "Slice
    10 decisions". It runs after slice 6 and before slices 7 to 9; the tomflix rebuild follows it.
    It needs states and interactions, fitted frames without a border, and the live mode first,
    as in "States and interactions decisions".

Each slice gets an "in progress" note here when it starts.

States and interactions: in progress since 2026-10-27, in five steps: (1) `interactions` in
`definePart` and the CSS rewrite in the server; (2) Studio forces the interaction and shows the part
table; (3) the interaction switch in the sketch matrix and `interaction` on comments; (4) fitted frames
without a border and the live mode; (5) the studio-lab button. Step 1 done (c1c848c75). Step 2
started; it moves the studio-lab button (step 5) first, then builds the part table.

Slice 1: done on 2026-10-27.

Slice 2: done on 2026-10-27. The canvas, the server, the CLI, the tree and Legacy are built, and
the old Calls UI is removed (4b2383ae2). Open: a Rust slice removes the commands only the old UI
used (see "Legacy calls"). Open: the pickers and "New product" as in "Picker decisions", first the
two `et-select`s and the empty-state screen, then the create form and its endpoint.

Slice 4: done on 2026-10-27, with the frame sizes and the sketch matrix (see "Sketch matrix, as
built" for its open points).

Slice 5: the core and the Studio comments are done (see "Slices 4 and 5 core, as built" and "Studio
comments, as built"): store, comment mode, draft, pins, Withdraw (1209478a5, c0a8e5532), the sidebar,
other-size counts, merge lock and empty matrix cells (f13302bf3), replies and threads (35d609cee). Open:
the merge state and the "needs rebase" inbox entry, as in "Merge and rebase decisions".

Slice 3: the inventory is done (`tomflix-inventory.md`). The rebuild waits on purpose
(decided 2026-10-27). Tomflix stays out until the new workflow works: canvas, sketches and
feedback. Then the old tomflix calls move to Legacy, and the rebuild from them is the battle
test of the workflow. The inventory is the reference for it.
