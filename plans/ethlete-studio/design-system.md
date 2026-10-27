# Ethlete Studio - the design system model

Status (2026-10-27): slices 1 and 2 done; the old Calls UI is removed. Slice 4: core, Studio sketch view, frame sizes and the sketch matrix done. Slice 5: core and Studio comments done, with threads. States and interactions: done (steps 1 to 6). Slice 6: done, with slice C (numbered note markers, hover line, note size; 2c6878d4e, c2ea12698) and the note format in the exploration skill (806aa94d9, 848f76d15). Slice 10: step 1 (sdk base, studio product, tokens import) done; next the redesign layer by layer, starting with a foundations/tokens sketch. Slice 3 inventory done; the rebuild follows slice 10, as in "Slice 10 decisions". Open items per slice are at the end of this file.

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
- Built in 6d26694c3 (cli) and b305d0311 (Studio): `POST /__design/product { name, base? }` shares
  `createProduct` (`product-command.ts`) with the CLI; 201, 409 for an existing name, 400 for a bad
  name, an unknown base or a base with its own base. The server writes the base as
  `.ethlete/design/<base>` and reloads `config.json`. `new-product-form.component.ts`: Name, Base
  ("No base" plus products without a base), Create product, then the command as before. Success
  reloads and picks the product; a refusal shows under the fields in the error colour. Headless proof
  on a scratch checkout.

### Picker base and merge order decisions (2026-10-27)

- The open picker names a base by its last folder segment ("inherits from web"), not the stored
  path `.ethlete/design/web`. The built-in base shows as `@ethlete/components`.
- The Base select of the New product form offers "No base", every product without a base of its
  own, and the built-in base `@ethlete/components`, which the CLI already accepts.
- `et design inbox` lists a stale baseline as "needs rebase" also while the sketch is in progress,
  so the agent adapts its variants before it sets `ready`.
- Merge keeps its order: it writes the pick and the note (`sketch-decision`) first, then merges. A
  refused merge keeps both, and a rebase keeps them, so after the rebase the user only clicks Merge
  again.
- Built in 37051efb0, 99b45c14b, dead141e7: `baseLabelOf` (`system-view.component.ts`) shows the
  last folder segment, an @-name whole. The form always shows the Base select: "No base", each
  product without a base, `@ethlete/components`. `POST /__design/product` accepts the built-in base
  and stores it as written (`isBuiltInBase` in `system/base.ts`). The endpoint, label and option
  tests fail without the change.

### Product picker, as built (2026-10-27)

- c1e8f5806: the sidebar always shows an `et-select` of the products, with "New product" as the last
  option. The open list shows "inherits from <base>" muted under a product with a base; the closed
  select shows the name only. The select has `flex-none`, so it no longer stretches in the sidebar.
- "New product" shows the empty state in the canvas (one shared template): "New product", "Run this
  in the checkout to create one:", `npx et design product new web` with a copy button, and a hint on
  the parts folder. A product or tree pick goes back. It is not remembered as the product.
- With no product, the select shows "New product" and the canvas keeps "No product yet".
- Builder choices beyond the plan: the option value `/new`; "New product" wins over a shown call;
  comment mode is off while it is picked; the tree keeps the last product's entries; the select
  hides while the products load or fail to load.
- Open: the create form, as in "Picker decisions" ("Later").

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
- Built in 3510747e9 (cli) and 0ce3cf91e (Studio): a refused merge answers 422
  `{ error, changed, rebase }`; `et design inbox` lists "needs rebase <target>" with the
  `et design sketch rebase` command. Studio shows a refusal box with the reason, "Changed in the
  product <part>", the command and a Copy `et-button`; the merging state as decided. Lab data: the
  `studio-lab` `components/card` sketch has its baseline hash set to `0000000000000000`, so its merge
  is refused. Specs in inbox, serve, sketch view and system view fail without the change. The
  headless app proof is pending.

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

### Slice 10, lab and note follow-up decisions (2026-10-27)

- Tokens: base components pick up a product's tokens override through an import, not only through
  the config `styles` entry, so a `foundations/tokens` sketch shows on every part (button, field).
  A small core change, built before the first foundations sketch.
  As built (cli 627b9739d, skill 8a24a92ab, proven headlessly, 346 cli tests green, bite proven): a
  part imports another part's stylesheet as `@system/<layer>/<name>.css?inline`. It resolves to the
  drawing product's own part, else the base's, else the sketch variant's. `sdk` button, form-field
  and select import `@system/foundations/tokens.css?inline` and put it first in `styles`. The tokens
  entry is gone from config `styles` of `sdk` and `studio`; the import is the only path, so
  `studio` needs no `styles` change after the tokens merge. Fix from the proof: a running server
  kept the old resolution after a merge; now a part file that appears or disappears redraws its
  whole product (`serve.ts` `unresolveParts`, `changed-parts.ts`). Proof: `studio` button
  `rgb(37,99,235)`; a tokens sketch with accent `200 0 0` turned filled and outline buttons
  `rgb(200,0,0)`; after `sketch merge` on the running server the product frame turned red with no
  restart.
- `sdk` stays in `.ethlete/design/sdk` for now. It moves to `libs/cli/design/systems` as a built-in
  base only after the redesign proves it (and a cross-repo base from a package is checked).
- No `vh` in parts: the `ethlete-design-exploration` skill says so; a full page uses a frame with a
  fixed size. A check warning can follow if the rule is often broken.
- Real lab flows: the builder rebuilds `studio-lab` with two flows that make sense. "Add a film":
  empty library → "add a film" dialog → library with one film → film detail. "Sign in": library
  with a "Log in" button in the shell → login dialog → wrong-password error → signed-in library.
  Every line has a label, and the element it names is visible in the frame before. The
  `ethlete-design-exploration` skill gets that rule. Seen: the old `sign-in` flow showed a film
  count growing, one line had no label, and "user clicks 'Anmelden'" named a button the page lacks.
- Pointed notes: a small marker at the point; the card sits outside the frame, below it in the
  column of notes without a point; a thin line connects marker and card. The card never covers the
  design. Free dragging of cards may come later (needs a stored position).
- A "Show notes" toggle in the toolbar, on at start, remembered per product like the flow preset.
- Fixed z-order, bottom to top: frames, flow lines, notes, comment pins, open popovers (thread,
  note editor). Seen: a note card covered the reply field of an open comment thread. Prove headlessly
  with an open thread over a note.

As built, skill rules and lab flows (agent-rules c28c7b30a, lab 2ca95f12f, proven headlessly,
`et design check --product studio-lab` ok):

- Skill: no `vh`, `dvh` or `svh` in parts, a full page is a fixed-size frame; every flow line has a
  label, and the element it names is visible in the frame before.
- Flow `add-a-film`: library empty → add open → one → film-detail rest, labels "user clicks 'Add a
  film'", "user clicks 'Save film'", "user clicks the film 'Night Train'".
- Flow `sign-in`: library three → login open → login error → signed in, labels "user clicks 'Log
  in'", "wrong password, user clicks 'Log in'", "right password, user clicks 'Log in'".
- `shell-main` shows a "Log in" button or the signed-in user "Ada"; its `min-height: 100vh` is now
  a fixed 480px. `login-dialog` has a password field; new element `add-film-dialog`; dialogs render
  only in the states that need one. The old `sign-in` flow is gone; Tom's notes and comments still
  point at existing frames.

Findings:

- The design server caches flow files, so a flow edit needs a server restart before Studio shows
  it.
- At the phone preset the gaps between flow frames are narrow, so long line labels are tight.

Design canvas on Tailwind, as built (fc02e4a8c): Studio has no component `.css` file left. Modifier
classes became data attributes (frame: `data-selected`, `data-active`, `data-empty`, `data-fitted`,
`data-unsized`; canvas: `data-dragging` with `group/canvas`). Headless before and after on
`studio-lab`: 14 canvas screenshots byte-identical, bounding rects equal, computed styles equal or
equivalent. Empty, error and unsized frames were not seen visually (no such data); specs cover
them.

Pointed notes, "Show notes" and z-order, as built (proven headlessly):

- 62a13aa52: a pointed note is a small square marker at the point. Its card sits in the column
  below the frame with the notes without a point. A thin right-angled line runs from the marker
  down into the gap, along the column's left edge, into the card's left edge, so it never crosses a
  card. Below zoom 0.25 markers only. New lab note `notes/20261027T163000Z-e5f6.json` (pointed,
  library "three").
- 2d15c4646: a "Show notes" button next to "Note" in the part and flow toolbars, on at start,
  remembered per product (`notesShown`, keyed like product themes); survives reloads.
- e804e1bc9: z-order frames < flow lines and labels < notes < comment pins < open popovers (thread,
  comment and note forms, the note being edited). Proven: the thread reply textarea sits on top of a
  note card; the note editor sits on top of a pin and a card.

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

### Surfaces sketch and frame border decisions (2026-10-27)

- Surfaces sketch: Tom picks the variant himself in Studio (pick or comment); the builder reads it
  there.
- The white strip around the dark root in the shots comes from the copied SDK `body` rule. The
  builder fixes it in the sketch: `body` background `surface-sunken`, margin 0.
- Mapping the SDK dark tokens onto the new surface tokens waits for the slice 10 component layer.
- Frame border: the 1 px outline on `ethlete-canvas-frame` stays on frames with content. It moves
  above the content as a pointer-events-none overlay after the iframe, set outward by the outline
  width, also for the selected and active states. Cause: at a fractional device-pixel ratio (1.25)
  the live iframe snaps right and down and covers the outline there, so only the left and top
  edges showed.

### Flow, tokens and note layout decisions (2026-10-27)

- The design server watches `flows/` like the other files and sends an event, so a flow edit shows
  in Studio without a server restart. As built, e1aa11c2c: `serve.ts` sends a `flows` event when a
  `.json` in a `flows/` folder is added, changed or removed; a flow file no longer rebuilds the parts
  registry. Studio's `flowChanges$` (`host/design-flows.ts`) refetches `flowList`. Finding: the
  server never cached flows (`listFlows` reads per request); Studio refetched only on the tick that
  the Tauri host watcher moves, so the stale view likely came from a headless run.
- Long flow line labels: the gap between two flow frames grows with its label, up to a limit; above
  it the label wraps. A short line needs no extra space.
- A part that uses `var(--et-...)` without importing the tokens draws without them. No check warning
  for now; add one only once it happens.
- A part file that appears or disappears (for example on a merge) keeps redrawing its whole product.
  Narrow it only if Studio visibly flickers.
- `product new` writes `config.json` in the same layout as Prettier, without Prettier as a CLI
  dependency. As built, 1184684eb: `json-layout.ts` (`jsonLayoutOf`) expands objects, keeps an array
  on one line if it fits 120 chars, and puts an array of arrays on many lines. A spec runs the
  Prettier check with the repo `.prettierrc.js`. Gap: long number arrays do not wrap like Prettier
  (none in `config.json` today).
- Slice B as built (each spec fails without its fix; Studio vitest 201, tsc, ngc, eslint; proven
  headlessly):
  - Flow labels, 11adcb4b1 and 109ed97ab: `flow-layout.ts` grows the column gap to fit the longest
    label between two columns, 280 px up to 560 px; label width estimated at 7 px per character, not
    measured. The max label width is the real gap minus margins, divided by the label scale, so a
    label wraps instead of covering frames at any zoom (109ed97ab fixed an overlap at 59%).
  - Matrix notes, 1b9712c10: `layoutMatrix` takes a `below` map; the canvas measures each note
    column after each render and starts the next row below the tallest.
  - Note mode, 806b5e015: `toggleNotes()` also calls `showNotes(true)`, so the remembered setting
    updates.
  - Lab: new `flows/review-a-film.json` (long label), notes `20261027T170000Z-b7c8` and
    `20261027T170100Z-d9e0` on `components/button` solid.
  - Decided (2026-10-27): the matrix reserves note room at zoom 1. Between 25% and 100% the
    counter-scaled cards can still reach into the next row; accepted, because zoom-dependent rows
    would move while zooming and fight auto-fit. Reserve at the fitted zoom only if Tom sees overlap
    on page matrices. Sheet and grid layouts reserve no note room, and right-to-left arc labels keep
    their fixed 480 px limit, until a real case shows a problem.
- Slice A verified by specs that bite (cli vitest 347, Studio vitest 199, tsc, ngc, eslint); no
  headless run against a live server and Studio.
- In the part matrix the gap under a row grows by the tallest note column in that row, so a note card
  never covers a frame or size label of the next row.
- Turning on note mode also turns "Show notes" on, so a new note does not vanish after save.
- The line from a note marker to its card stays right-angled; a straight line would cross the cards
  above. Replaced the same day, see below.

### Pointed note link decision (2026-10-27)

Seen on the `add-a-film` flow: the always-on line ran down through the whole frame and crossed text
and buttons, the thing the card below the frame was meant to avoid.

- A pointed note's marker shows a small number, and its card below the frame shows the same number
  (numbered per frame). The line from marker to card appears only while the pointer is over the
  marker or the card. No line otherwise.

### Note size decisions (2026-10-27)

Replaces "a state note shows on every rest frame of its state" for pointed notes. Seen on
`film-detail` "rest": a note pointed at the text under the phone title showed on desktop too, at the
same x and y, in empty space.

- A pointed note stores the size (preset) it was written at, as `size` like a comment's place, and
  shows only at that size. A note without a point still shows at every size.
- The frame note for other sizes covers notes too, in one line with comments, for example "1 comment,
  1 note at another size". On a flow it follows the picked preset, as for comments.
- `size` is required on a pointed note; `et design check` reports a missing one as an error. The
  builder adds `size: "phone"` to the two existing pointed lab notes (`film-detail` "rest", Tom's
  uncommitted `notes/20261027T144809Z-db30.json`, and `library` "three",
  `notes/20261027T163000Z-e5f6.json`).

Slice C, as built (2c6878d4e cli, c2ea12698 Studio; 3 CLI and 7 Studio specs fail with the old
behaviour; Studio vitest 202, cli 347, tsc, ngc, eslint, `design check --product studio-lab` ok):

- `note.ts` stores `size`, typed and checked like a comment's size. A pointed note without size, or
  with a preset the product lacks, is refused; clearing the point drops the size. `et design check`:
  a pointed note without size is an error; a size the product no longer has is stale (also the
  `stale` field in Studio's note listing). A note without size stays readable and shows at every
  size.
- A pointed note shows only on frames at its size; on a flow it follows the picked preset. Studio
  writes `size`. Frame label "1 comment, 1 note at another size" ("other sizes" if spread), following
  Show notes. Marker and card show the same number per frame; the line shows only while the pointer
  is over the marker or the card (the marker takes pointer events).
- Lab notes: db30 and e5f6 `phone`, b7c8 `fitted` (component matrix frames are fitted), d9e0 has no
  point; db30 committed. A third pointed note, `notes/20261027T120000Z-a1b2.json` (library "empty"),
  also got `phone`.
- Proven headlessly on `film-detail` "rest" (number "1" on marker and card, phone only, desktop label
  "1 note at another size", line on hover only). Not proven headlessly: flows and the component
  matrix (unit tests only); writing a note through the real UI. The exploration skill documents the note format
  (806aa94d9, 848f76d15).
- Decided (2026-10-27): `phone` for `a1b2` confirmed. A click right on a marker in comment or note
  mode starts nothing; accepted. The thin vertical line along the left edge of phone frames (also
  on rows without notes, not the note line) gets its own check of the frame chrome. The
  `ethlete-design-exploration` skill gets a short notes section: the file format (`part`, `state`,
  `point`, `size`, `text`) and when to write a note instead of a comment - a note explains a state,
  a comment is feedback that needs an answer.

Also seen there: on `pages/library` "add open" the dialog backdrop ends at about 410px and the rest
of the frame stays dark - a lab drawing bug, likely the fixed 480px `shell-main` height.
Fixed in 9222b044f: the scrim in `pages/library/library.ts` was `position: absolute; inset: 0`, so it
filled only `.lab-shell` (480px). It is now `position: fixed; inset: 0`, and frames are iframes, so it
fills the frame. Also fixes "login open" and "login error". Rendered check, all pass (headless):
the scrim fills the viewport at phone 390x844 and desktop 1440x900 for all three states, live and in
`/__design/shot`; fitted frames stay at 512px over 4s at iframe heights 300 and 900, no loop.
A reported 512px live vs 480px shot mismatch was wrong: the check compared a live `&fit` frame with
a `width=390` shot, two different renders. A shot without preset or width also loads with fit, so the
16px padding is in the PNG too (`shot.ts` `partShotOf`). Measured headless, live and PNG equal:
`pages/library` fit 319x512, no-fit 390x480; `list-row` 352x69; `film-detail` reviewing 674x492;
`card` 173x115. In the canvas each frame keeps its size from live (68-100%) to shot (<50%). No code
change. Not checked: Tom's window (HiDPI), other products.

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
  Changed by "Sketch interaction matrix decisions": the switch gets "all" as its default.
- A comment gets `interaction` (default rest). Its pin shows only on the matching cell; elsewhere
  the label counts it, as for another size.
- A fitted frame has no border, only the product background with some padding. Frames at presets
  and `widths` keep the border, since there the size means a viewport.
- A live mode per frame: a double click passes the real mouse and keyboard to the frame, `Esc`
  ends it. Its own step before slice 10, apart from motion; motion builds on it later.
- `studio-lab` `components/button` moves to the states solid and outline with the interactions
  hover, focus-visible, active and disabled, so the lab tests the full table.

### Sketch interaction matrix decisions (2026-10-27)

Not built yet. With one interaction per view, the user clicks five times to see one variant
completely, for example the `studio-lab` `components/button` sketch.

- The interaction switch of the sketch matrix gets the value "all", and it is the default. The
  single interactions stay as filters.
- With "all", each row is one state with one interaction ("solid · rest", "solid · hover"). The
  columns stay the variants (current, a, b).
- Rows go by state first, then by interaction in the Studio order: solid · rest … solid · disabled,
  then outline · rest … The state name shows only in the first row of its group, and the gap
  between groups is larger than the gap between rows.
- "all" is the default at every size: fitted, presets and `widths`. Studio remembers the last pick
  in the view state.
- With "all", every interaction has its own cell, so each comment pin shows in its cell. The label
  "N comment in another interaction" shows only while a single interaction is the filter.
- The part view table drops the "N comment in another interaction" label too: every interaction is
  a column there, so each pin shows in its cell.
- The merge preview ("Where <part> is used") does not change: a nested part always stays at rest.

### Fitted frames and live mode, as built (2026-10-27)

- 242bdd69e (step 4): a fitted frame (no width) has no border; a selected or live frame keeps the
  accent outline. A live frame shows a "Live · Esc" badge. Comment mode ends live mode, and a double
  click does nothing while commenting. Esc reaches Studio only through the `design-explore:escape`
  postMessage, since the iframe keydown listener is gone; that removes the `UnsubscriptionError` at
  teardown.
- 6fc599421: the part table drops the "in another interaction" count.
- Expected, no action: a real hover on a cell that already forces hover adds nothing visible.

### Frame reload decisions (2026-10-27)

Not built yet. Studio has one global revision (`tick`), so each change reloads every visible frame,
and no frame shows that it is out of date.

- The design server sends an event with the ids of the affected parts. The Tauri `design_watch`
  then reloads only the system list (the tree), no frames.
- A changed part reloads itself, every part that imports it (through the Vite module graph), and
  every sketch that shows it.
- Shared files: `fixtures.ts` reloads its importers only; a CSS file in the product's `styles`
  reloads every part of the product; `config.json` reloads all; a base part reloads in every product
  that inherits it. When the server is not sure, it reloads all.
- Studio renders at most 4 frames at a time, visible frames first. The builder may change the number
  after a measurement. A frame is current, queued or rendering.
- A queued or rendering frame shows a dot in the accent colour in its caption: still when queued,
  pulsing while it renders. The old frame stays as it is until the new one has painted.
- The status bar shows "Rendering N frames" while any frame is queued or rendering.
- A failed render replaces the old frame at once, as today, so an error is never hidden.
- Shots use the same per-part revision.

### Frame reload, as built (2026-10-27)

- 027805054 (server side of step 6): `/__design/comment-events` sends a new SSE event `parts`:
  `{ revision, all: true }` or `{ revision, all: false, parts: [{ product, part, sketch: { target,
variant } | null }] }`. `revision` is server-wide and goes up by 1 per event. `all` is sent for a
  change of `config.json` and for any file added or removed. A change that no frame draws sends no
  event. The shot cache drops exactly that set of parts.
- The old `changes` event still fires, so Studio works as before until the Studio slice moves to
  `parts`. The Tauri host is unchanged.
- Built choices: a new event name, so one edit does not reload twice; a file added or removed
  (for example `sketch new`) reloads all; a part counts only after a frame or shot has loaded it,
  because the module graph decides.
- Next: the Studio slice stops the watch tick from reloading frames and keeps a revision per drawn
  part.

### Frame reload file decisions (2026-10-27)

These change the "all" case of 027805054.

- A file added or removed reloads only the frames of its part. The server maps it by its folder,
  for example `components/button/...` or `sketches/components-button/c/...`.
- A file in no part folder reloads nothing, except frames that show an error now, since the file
  may be the one they missed.
- `config.json` still reloads all. Comment files reload no frame (as built).

### Frame reload files and done authors, as built (2026-10-27)

- 69b6c4f73 (`libs/cli`): `parts` on a file added or removed. `config.json` sends `{ all: true }`;
  comment files send no `parts` (only `comments`); `sketch.json` sends none (it holds decisions). A
  file in `<product>/<layer>/<part>/...` sends that part with `sketch: null`; only its shots drop,
  not the dependents'. A file in `sketches/<layer>-<part>/<variant>/...` sends every part drawn in
  that variant, each with `sketch: { target, variant }`. A file in no part folder sends
  `{ all: false, parts: [], errored: true }`.
- New optional field `errored: true`: also reload the frames that show an error now. The server
  cannot know which frames these are, so Studio applies it in the Studio side of step 6.
- `inbox done --by`: a comment on a sketch variant adds the id to `variantInfo[v].authors` (if
  absent; `madeBy` waits for the merge); a comment on a product part adds it to the part's `madeBy`
  (if absent, the same write as the note). Studio's own "done" passes no author.
- The design-exploration skill says in one sentence where `inbox done --by` stores the id.
- Builder choices beyond the plan: the `errored` field, and a sketch-variant file reloads all frames
  of that variant.

### Frame reload Studio, as built (2026-10-27)

- 8ba222492. The proof is complete and the commit needed no fix; the iframes that never painted
  came from the test environment. Run twice: a card edit reloads 0 of 10 button frames, a button
  edit 10, a `config.json` edit 10; at most 4 render at once with up to 6 queued; the status bar
  counts "Rendering 10 frames" down to "Rendering 1 frame".
- Studio batches `parts` events over 300 ms into per-part revisions in the frame URLs. `all` and the
  Reload button bump every frame. `errored` reloads the frames of parts and sketches with a load
  problem. Proven: a card edit reloads 0 of 10 button frames; a button edit reloads 10; a
  `config.json` edit reloads 10.
- Queue: at most 4 frames render at once, visible frames first. The first load skips the queue. The
  old frame stays until the new one paints. The caption dot shows queued; a pulsing dot in the
  primary accent shows rendering. The status bar shows "Rendering N frame(s)".
- Deviations: `tick` still bumps on design changes, but drives only the tree, the lists, the
  comments and the legacy call frames. The sketch view reloads as a whole on any change to its
  target or to a part in its variants; a revision per variant is a later step.
- Follow-ups, all built: 2e4fc1797 drops the server's `changes` event (the `parts` event already
  covers drawn files outside the design folder). 76fd5cfa4: the frame page's height message carries
  `href` and `errored: true` after a failed draw, a setup error, or an uncaught error or rejection.
  Studio (`frame-revisions.ts`) remembers each failing frame and reloads its part on the next change,
  not at once; a good draw keeps its revision. All frames of a part share one revision, so the whole
  part reloads. Headless proof: a runtime throw in the button outline frame reloaded at revision 1,
  then 2; a control run without a throw had no reloads. 0d198f89f removes `drawnChanges$`.
- Pins with a fresh server, headless: 239f shows the question dot. The "answered, no dot" case
  (7001) is proven after fb346c749: the pin renders on outline, variant b, with no question dot.
  The "drawing…" column came from a stale report file, see "No-point pin and drawing report
  decisions".

### Frame drag removal, as built (2026-10-27)

- b5bd55b0f. The big solid · rest cell came from a stored `frameSizes` entry of 160×80 (the old
  minimum clamp). Removed: `et-resize-handles` (e, s, se), `startResize`/`resize`, the minimum
  sizes, the sizes signal and its CSS. `frameSizes` leaves the remembered view; old data still
  loads, and the next write drops the key. A frame's size is now `frame.width`/`height`, else the
  measured size.
- The handle only showed on the live frame. No drag handle remains anywhere, and nothing else in
  live mode used it.
- A test that bites: a stored 160×80 must not change a fitted tile measured at 100×68. It failed
  before the fix.
- `studio-lab` `components/button` part view: solid · rest has the same size as the other cells,
  and a double click on a frame shows no handles.

### Merge preview decisions (2026-10-27)

Not built yet. In the `components/card` sketch the preview showed all three states of
`pages/library`, but only `empty` draws the card, and nothing said what the preview shows.

- The button "Show merge preview" becomes "Where <part> is used", for example "Where card is used".
  Above the canvas: "components/card appears in these parts. Left: now. Right: after merging b."
- The server compares the before and after shots. The preview shows only rows with a visible
  change; below them a row such as "2 states of pages/library without visible change" opens the
  rest on a click. While the compare runs, a row shows the rendering dot from "Frame reload
  decisions".
- Each instance of the target part in a preview frame gets an outline in the accent colour. The
  render marks the part's first element, for example with `data-et-part`. The builder first checks
  that this works for every kind of part; if not, there is no outline.
- Bug: preview frames switch between the grey canvas and the page's own background (in
  `pages/library` `one` and `empty`, now and after differ). The page always has one background, so
  the compare would see a change that does not exist. Fixed in a076cc95f: `settingsLoaders` in
  `serve.ts` imported a product's `styles` with `Promise.all`, and Vite appends a `<style>` when its
  import settles, so `styles.css` (grey body) and `tokens.css` (navy body) landed in random order (43
  grey in 48 loads). They now load in sequence, in config order (48 of 48 navy). A shot cached by a
  running server stays wrong until a file changes or the server restarts.
- Bug: on the switch to the preview, the first row starts in the middle of the canvas with about
  300 px empty above it. The fit must anchor at the top, as in d25e8a8b0.
- The sketch header: the picked variant ("Picked b") uses the accent colour instead of a grey
  filled button; the note is a visible `et-form-field` with a label; next to a disabled Merge,
  "Needs a note" shows while the note is missing.
- A page or a part with `widths` that declares interactions keeps the sheet layout as built ("320 ·
  hover"), until a real page declares interactions; then the interaction switch of the sketch matrix
  may serve there too.

### Merge preview server, as built (2026-10-27)

- be5a84a5c: the server side of the label, the compare and the outlines. The Studio side comes
  after the round columns slice.
- `/__design/sketch-preview` gives `target` (for example `components/card`) for the "Where card is
  used" label.
- `GET /__design/sketch-compare?product&sketch&variant[&size][&surface&color]` answers
  `{ target, variant, changed: Row[], unchanged: Row[] }`, with `Row = { part, state, preset?,
width?, outlines: { now: Rect[], merged: Rect[] }, error? }`. One request answers when all rows
  are done. An unknown variant gives 404; a server that cannot draw gives 503.
- A row is changed when the now and merged PNGs differ in any byte, so in any pixel. There is no
  threshold. A failed shot or part goes into `changed` with `error`. In the real `studio-lab` card
  sketch only `pages/library · empty` is changed.
- Outlines: a Vite transform marks the first element of each part's drawing with
  `data-et-part="<layer>/<name>"`. Parts that share a root element get a space-joined list. Nested
  instances get the mark too. Rects are in CSS px from the top left of the shot, at scale 1. An
  element with zero size (`display: contents`) gets no outline.
- Builder calls: the compare size is the `size` preset or width, else the first one; other parts
  are fitted, as in Studio's `mergePreviewOf`. Only the rest interaction is compared, with the
  states the product has now.

### Merge preview Studio, as built (2026-10-27)

- 4b72f29a6: an `outlines` input on the design canvas. cf3295aba: the merge preview in Studio; the
  compare call is in `system-view/merge-preview.ts`.
- On `studio-lab`, sketch `components/card`, variant b, "Where card is used" shows the label "components/card
  appears in these parts. Left: now. Right: after merging b.", the changed row `pages/library ·
empty` as two frames with an accent outline round the card (`--et-theme-color-primary-solid`), and
  "2 states of pages/library without visible change" (`one`, `three`). A click on that line adds
  those frames. Verified headlessly on own servers: 2 frames, 2 outlines.
- A row error becomes the frame error on both sides (spec only, not seen live). A failed compare
  request shows in the header in the semantic error colour.

Open points, each with a recommendation:

- Done (c8638c528): the pulsing rendering dot in the primary accent stands before "Comparing now and
  after the merge…" while the compare runs.
- Not checked in the real app. Recommendation: look at it in Studio on `studio-lab` after the
  restart that rebuilds the cli.

### Sketch rounds decisions (2026-10-27)

Not built yet. The user may like solid from variant a and outline from variant b. A variant is a
folder of code that replaces the part whole on merge, and states share CSS, so Studio cannot put
two variants together; the agent must draw a new one.

- To combine variants, the user writes a comment on the sketch, for example "solid like a, outline
  like b". The agent draws a new variant from it. Studio never combines variants itself.
- New command `et design sketch variant <target> <name> --from <variant>`: copies a variant into a
  new one, sets the sketch back to `in progress` and clears the pick. It is the only way a status
  moves back.
- Older variants stay next to the new one and stay pickable. Merge or discard removes every variant
  that was not picked, as now.
- Rounds, as in the old calls: `sketch.json` gets `rounds: [{ key, title, note }]`, and each
  variant belongs to one round. `sketch new` starts round 1. The variant command starts a new round
  or adds to the running one. Variant letters continue across rounds (r1: a-b, r2: c-e). Before a
  new round starts, the agent writes into the old round's note what it showed and why its variants
  lost.
- The sketch matrix groups variant columns by round, with the round title above the group. The
  newest round is open; older rounds are collapsed to a narrow column with the title, the note and
  the variant names ("r1 · Pill or square · a b"). A click opens a round. Studio remembers the open
  rounds per sketch.
- The design-exploration skill (`libs/agent-rules/content/`) tells the agent how to answer a
  combine comment: a new round with the combined variant, and a note on the old round.

Open points, each with a recommendation:

- A structured "Combine" decision (the user picks a variant per matrix row, Studio stores it in
  `sketch.json`, `et design inbox` lists it). Recommendation: only if the tomflix rebuild shows that
  combine comments are common.

### Sketch rounds CLI, as built (2026-10-27)

- 89cea207a: `et design sketch variant <layer>/<name> <variant> --from <v> --by <model> [--round
  <title> --note <why the running round lost>]` copies the `--from` folder, sets the status back to
  `in progress` and removes `decision`. Without `--round` the variant joins the running (last)
  round. With `--round`, `--note` goes onto the running round, then a new round starts; the two
  flags go together. It refuses an unknown `--from`, a taken or invalid name, and a blank note.
- `sketch new --round <title>` sets the title of round 1 (empty by default).
- `sketch.json`: `rounds: [{ key: 'r1', title, note }, ...]` and `variantInfo[v].round`. An old
  `sketch.json` reads as one round r1 with every variant, rewritten on the next write. A variant
  that names an unknown round makes the sketch unreadable, with a message.
- `/__design/sketches` and `sketch list --json` give `rounds` (never empty, oldest first, the last
  one running) and always `variantInfo[v].round`.
- Builder choices beyond the plan: the variant command removes any decision, a discard too; `--by`
  is required but not stored (authors come from reports, not from `--from`); the agent names the
  variant letter; `--note` replaces an existing note, and no command edits a title or note later;
  the text output of `sketch list` does not show rounds.
- Decided after the build: `sketch variant` refuses while the decision is a discard, and says why;
  a discard is the user's call, and no agent lifts it. The variant command still clears a pick. To
  go on with the sketch, the user picks a variant, which replaces the discard. (Studio's "Discard
  sketch" deletes at once and writes no decision; only the API writes a discard decision.)
  Built in 0def240c9: the message is "The user decided to discard <target>. The user must pick a
  variant first to go on.", with a non-zero exit and `sketch.json` untouched.
- The design-exploration skill has a section "Combine variants in a new round".
- Next: the Studio round columns, after the author display.

### Sketch rounds Studio, as built (2026-10-27)

- 150568d89, d8e706294, 48d3c42bb, 95a6b82e7: round-grouped matrix columns.
- One untitled round, or old data: the columns stay as before, without a round header (the
  `studio-lab` card sketch).
- Several rounds, or one titled round: the newest round is open, and its columns share a header
  button, for example "r2 · Stars with a count". A click folds it. An older round folds into one
  narrow column (half the cell width, at least 240 px) with the head button "r1 · a b" and its note
  below; a click opens it. An open older round shows its note on one line next to its header, with
  the full note in the tooltip.
- Studio remembers open and folded per sketch. A new newest round opens by default. A jump to a
  comment in a folded round opens that round.
- The interaction switch and the rows come only from the part and the open rounds. Fixed on the
  way: the interactions of a folded variant made empty rows, and Fit zoomed to 20 %.
- Builder calls: no extra "running" label, since the newest open round is the running one. The
  newest round can fold too. The pick buttons stay flat, one per variant.
- Visible in `studio-lab`, Sketches, rating (`elements/rating`): round 1 with a and b and the note
  "a and b showed bare stars or a bar; neither showed the score as a number at a glance"; round 2
  "Stars with a count" with c (a plus a "3/5" count). The sketch is ready, so the user can pick c.

### Studio reload and sketch header, as built (2026-10-27)

- 793d9381b: `studio-lab` rating sketch b declares `interactions: ['disabled']`.
- 9daaca75a: Studio waits for the products, sketch and call lists before it picks a part or deletes a
  camera. Before, a reload showed tokens and deleted the sketch's camera. The merge preview, the size
  and the interaction are remembered per sketch in `sketchViews`.
- 9daaca75a: the sketch header items of "Merge preview decisions" are done: "Picked b" is filled in
  the accent colour, the note is an `et-form-field` labelled "Note", and "Needs a note" shows while
  the note is empty.
- 9daaca75a: an interaction switch fits again from the top; the merge preview always fits fresh.
- 6d3ba4420: the "Sketch interaction matrix decisions" are built. "all" is the first button of the
  interaction switch, the default, and remembered. Rows run state, then interaction; the state name
  shows in the first row of its group only; the group gap is 2.5 times the row gap. Under "all"
  there is no "in another interaction" label.
- 91cf0ed1d: only a camera the user moves is saved (wheel, pinch, drag, zoom buttons, shortcuts, a
  jump to a comment). Any fit deletes the saved camera.

Open points, each with a recommendation:

- Resolved (4798ba304): the matrix 550 px below the header came from an old stored camera, not from
  layout. A restored camera skips the fit, and only a fit deleted a stored camera, so fit cameras
  saved before 91cf0ed1d never went away (Tom's `studio-lab` `components/button` held x 250.7,
  y 742.5, zoom 1.39). The camera store moved to the key `movedCameras` (`remembered.ts`); old
  `cameras` entries are ignored and dropped on the next write. Side effect, seen once: every part
  fits fresh, and cameras placed by hand before are forgotten. A spec fails without the fix. After:
  frames at y 128, zoom 100 %.
- Resolved: the sketch group gap in the real geometry (zoom 0.948) is 46 px between rows and 91 px
  between the solid and the outline group, so 48 and 96 world px, as in "Sketch matrix gap
  decisions".

### Agent author decisions (2026-10-27)

Not built yet. The user wants to see which model made what, for example variant a by Gemini Argon,
b by Codex Sol, c by Claude Opus. Today only comment replies know `by: 'user' | 'agent'`.

- An author goes on sketch variants, thread replies, reports, comments an agent closes with
  `inbox done`, and parts after a merge.
- Every CLI command with which an agent writes, `sketch new` included, needs `--by <model id>` and
  fails without it.
- `et design sketch report` takes `--variant` and `--by`. The CLI keeps the authors per variant in
  `sketch.json`; the variant name comes from the flag, no longer from the message text.
- The name is the exact model id as free text, for example `gemini-3-argon`, `gpt-5.6-sol`,
  `claude-opus-5-5`. No fixed list.
- Several authors are kept in the order of their first report. Studio shows the first and "+N";
  the tooltip lists all.
- A merge writes `madeBy: string[]` into `definePart`, next to `note`. A later merge replaces it;
  git keeps the history.
- Studio shows the author in each variant column head ("a · gemini-3-argon"), in the thread
  ("Agent · gpt-5.6-sol"), in the part view head ("made by gemini-3-argon") and in a report's
  tooltip.
- Old data without an author shows none. No migration.
- The coordinating agent writes the exact id into each sub-agent prompt; an agent never guesses its
  id. This goes into the `ethlete-design-exploration` skill.

### Agent authors, as built (2026-10-27)

- 6746f09aa (CLI): `--by` is required on `sketch new|report|ready|rebase|merge|discard`, `inbox
done` and `comment reply`; without it the command exits 2 with its usage. `sketch.json` has
  `variantInfo: { a: { authors: [...] } }`, in first-report order, without duplicates. `sketch
report` takes `--variant`. A merge writes the picked variant's authors as `madeBy` in
  `definePart`, and removes `madeBy` when there are none.
- The API gives `variantInfo[v].authors`, `report.author`, `report.variant`, `replies[].author` and
  `part.madeBy` (`[]` when unknown).
- 414e7f23b (agent-rules): the synced skill tells agents to pass the exact model id to every write.
  No `et update` migration, since the callers are agents. The `@ethlete/cli` changeset is major.
- The Studio display: built, see "Agent author display, as built".

### Agent author display, as built (2026-10-27)

- 15021ef34: the matrix column head shows the first author after the variant, for example
  "a · gemini-3-argon". With more authors it adds a count: "b · gpt-5.6-sol +1". The tooltip lists
  all of them: "b by gpt-5.6-sol, claude-opus-5-5". While an agent draws, the head shows
  "a · claude-opus-5-5 · drawing …". Old data without authors shows only "a" and the old tooltip.
- A comment thread shows an agent reply as "Agent · gpt-5.6-sol". An old reply without an author
  shows "Agent".
- The part view has no header. Therefore "made by gemini-3-argon +1" (mono, subtle) is the first
  item in the floating bar at the top right, next to the theme and comment buttons. Its tooltip
  lists all authors. An empty or missing `madeBy` shows nothing.
- The report tooltip shows the message, a blank line, then "by claude-opus-5-5". A report without
  an author shows only the message.
- Builder calls use the same format: "made by" with the first author and "+N", and the column
  tooltip "<variant> by a, b".
- c7ec853d7: `studio-lab` shows it. Sketch `components/button` has authors on a and b, sketch
  `components/card` on a; the part view of `components/button` and `elements/list-row` shows "made
  by"; a comment on `components/button` (state outline) has an agent reply with an author. The live
  report is a temp file and is gone after a reboot.

### Agent author follow-up decisions (2026-10-27)

- `inbox done` deletes the comment, so its `--by` goes where the comment sat: on a sketch variant,
  into that variant's authors (a merge then carries them into `madeBy`); on a product part,
  directly into the part's `madeBy`. Only when the id is not there yet.
- `sketch new|ready|rebase|discard` keep requiring `--by` and keep not storing it; a merge stores the
  variant's authors, not its own `--by`. `madeBy` names who designed, not who ran a command.

### Product comments and answered threads decisions (2026-10-27)

Seen in the real app: a comment on the product part `components/button` showed in the part view
and again in the sketch view's "current" column, and a plain agent report ("Raised the outline
border to 2px") showed as "question".

- The sketch view shows only comments on sketch variants. For comments on the product part it
  shows one line, for example "1 comment on the product part", that links to the part view. Open
  comments on the target part still block merge and discard.
- `et design comment reply --question` marks a real question. Any other agent reply makes the
  thread "answered". The tree badge shows "question" or "answered"; "Questions for you" and the
  "N ?" count include only real questions. The user closes an answered thread with Withdraw, or
  replies. Until then an answered thread still blocks merge and discard. The design-exploration
  skill tells agents when to pass `--question`.
- `studio-lab` data: the comment "The outline border looks thin…" (20261027T120000Z-7001) moves to
  variant b of the `components/button` sketch. The part view gets its own product comment with
  fitting text. The lab then holds one real question and one answered thread.

### Answered threads server, as built (2026-10-27)

- d4a106c80, bdfbf05d2 (help), b56340707 (lab data). The Studio side is in progress.
- A flagged reply is `{ by: 'agent', author, text, createdAt, question: true }`. Only an agent reply
  can carry `question`, and only as `true`. The CLI prints "asked: <file>".
- `threadStateOf(comment)` gives `'agent'` (the user spoke last, or no replies), `'question'` (the
  agent spoke last, with the flag) or `'answered'` (the agent spoke last without the flag; also
  old data). `/__design/comments` and `inbox --json` add `threadState`. The inbox text marks
  "(question)" and "(answered)" and shows a flagged reply as "agent <id> asks:". An answered thread
  still waits for the user and blocks merge and discard.
- The skill: an agent passes `--question` only when it cannot go on without the answer.
- `studio-lab`: answered is on the `components/button` sketch, variant b, state outline ("The
  outline border looks thin next to the solid one."). The question is on the product part
  `components/button`, state solid ("The shipped solid button reads heavy in the card footer next
  to the ghost link."). Until the Studio side lands, Studio shows both as questions.

### Answered threads Studio, as built (2026-10-27)

- fd6fd55f4. Tree badge: "question" in the accent colour, "answered" neutral. The priority is
  question, then answered, then comment open.
- "N ?" and "Questions for you" count only real questions. An answered thread stays in its part's
  group in the panel, with "answered" in the subtle line under it, and still blocks merge and
  discard.
- Sketch view: pins and size notes use only comments with `sketch`. Next to the "N open comments"
  lock, a transparent `et-button` "1 comment on the product part" (plural for more) opens the part
  view. The lock still counts the product comments too.
- The pin number is global on purpose: `numberedCommentsOf` numbers all open comments of the
  product, sketch comments included, oldest first, so the panel and the pins agree.
- `CanvasPin.dot`, the question marker: the design canvas draws it since 35d609cee
  (`design-canvas.component.html`, a 12 px dot in the primary accent at the top right of the pin).
  Checked in the real app (2026-10-27): the question pin 239f in the `studio-lab`
  `components/button` part view (solid, rest) shows "3" and no dot. Cause: a stale server. The
  running Studio's `cli-runtime` was built before fd6fd55f4 and sends no `threadState`; the data
  is right. A Studio restart rebuilds the runtime. No code fault.
- `studio-lab`: Components, button shows "question"; Sketches, button shows "answered"; the top bar
  shows "1 ?"; the panel lists 7001 as "answered" and 239f under "Questions for you"; the
  `components/button` sketch view shows the product-part button next to "3 open comments".

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
- Replaced: the merge preview showed every state of every affected part. It now shows only rows
  with a visible change, as in "Merge preview decisions".
- Decided: `studio-lab` lists its `--lab-*` tokens file in the product's `styles`. See "Token
  decisions".
- Decided: column heads keep the ellipsis at low zoom; the matrix is read near 100 %.
- The card at 520 px with the long state showed its frame cut at the bottom once. Not the web
  fonts: a headless repro on `studio-lab` loads no web fonts, and the reported heights match the
  content, also after resizes from 360 to 520 to 240 to 520 px. Still untested: the Studio side
  (a stale height, or a width change before layout), fitted frames, and products with a real
  `@font-face`. Parked until it happens again; then a screenshot with the frame and the zoom.

### Sketch matrix gap decisions (2026-10-27)

- The gap between state groups is the row gap × 2: 96 px for fitted frames (row gap 48 px), 240 px
  for sized frames (row gap 120 px). It replaces 120 px and 300 px, which were 2.5 times the row gap.
- The group gap derives from the row gap; it has no constant of its own.
- Built in 59e2bdb09: `GROUP_GAP_FACTOR` in `design-canvas.component.ts` went from 2.5 to 2. A spec
  bites at 2.5. Not yet checked in a running Studio; look at `studio-lab` `components/button`, its
  sketch, between the solid and the outline group.

### Matrix tile width and server skew decisions (2026-10-27)

- In a matrix of fitted frames (the part view and the sketch matrix), every tile in a column gets the
  width of the widest tile in that column, so the right edges line up. The part keeps its own size
  and stays at the left, with the same inner padding. Seen on `studio-lab` `components/button`: the
  outline "Cancel" tiles were wider than the solid "Save" tiles.
- Built in 20bac33fc: `layoutMatrix` (`canvas-math.ts`) gives a fitted frame (no
  `CanvasFrame.width`) the width of its column; frames with a given width keep it. Headless on
  `studio-lab` `components/button`: the solid right edges were 13 px short in every column, now both
  rows end at 114, 268, 422, 576 and 730. Specs in `canvas-math.spec.ts` and
  `design-canvas.component.spec.ts` fail without the fix.

### No-point pin and drawing report decisions (2026-10-27)

- A comment pin with no point sits on the right edge of its tile, not of the part. A pin with no
  point belongs to the whole state frame, and all such pins in a column line up.
- The stale live report for `studio-lab` `components/button` variant b (written 12:24 by a seeding
  run, never ended with `sketch ready`) is to be deleted; the builder's permission check blocked the
  delete, so it stays as the live test case for the expiry below, and Tom deletes it after. It kept the variant b column at "drawing…" with
  no frames, so pin 7001 had no place to render. Not a code fault.
- A `drawing` report expires 30 minutes after its `updatedAt`. Studio then draws the variant's frames
  as if it were drawn, and the column head shows "No report for 30 min" instead of "drawing…", so a
  stopped agent stays visible and is not taken for a finished one. A new report from the agent
  ends the note. `sketch ready` and a discard still end a report at once.
- Built in fb346c749 (Studio only): `reportExpiryOf` in `system-tree.ts` is `updatedAt` + 30 min;
  past it the column draws its frames and the head shows a muted second line "No report for 30 min".
  A missing or unreadable `updatedAt` never expires. `sketch-view.component.ts` sets one RxJS timer
  at the expiry, restarted by a new report; no polling. Specs at 29:59 and 30:00 and a timer-only
  flip fail without the fix. Live on own servers, `studio-lab` `components/button` variant b: a
  45-minute-old report drew 30 frames with the note; a fresh one showed "drawing …" and no frames.
- Replaced the same day: a stale built cli now shows as `stale`. The existing check
  (`design_server.rs` `is_stale`) compares the running server's stamp with the stamp of the built
  cli in `dist`, so a `dist/apps/ethlete-studio/cli-runtime` older than its source passes as
  `running`. In a dev build only, the footer also shows `stale` when the `libs/cli` source is newer
  than the built cli. A restart rebuilds the cli, and the line goes back to `running`.
- Built in 6e818c148 (`design_server.rs` `judged`, behind `cfg!(debug_assertions)`): `stale` when a
  file in `libs/cli/src`, `libs/cli/design` or `libs/cli/package.json` has a newer mtime than the
  built cli's `src/index.js`. It skips `node_modules`, dot folders and `*.spec.*`, stops at the first
  newer file or after 5000 entries, and a missing build counts as not stale. The Rust test
  `a_cli_source_newer_than_its_build_reads_as_outdated` fails without the check. 1e2d102c4: a
  directory with a newer mtime counts too, so a deleted source file also marks the server stale. Not yet seen in the real footer.

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

- Decided: a frame reload per part, see "Frame reload decisions".
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

### States and interactions step 2, as built (2026-10-27)

- c62f52cd4: the `studio-lab` button has the states solid and outline, the interactions hover,
  focus-visible, active and disabled, and real pseudo-class CSS. This is step 5, done early.
- 37cc9d271: frame and shot URLs take `interaction=<name>`. After mount, `frame.ts` sets
  `data-et-force` on the first element child of `#root`, or `disabled` and `aria-disabled` for
  disabled. The shot cache keys on the interaction.
- 95764db02: a fitted part uses the matrix arrangement. `partColumnsOf` gives rest plus the declared
  interactions; the rest column keeps its old frame ids. A headless check confirmed each column
  through computed styles.
- A page, or a part with `widths`, that declares interactions keeps the sheet layout: each
  interaction is drawn at every size in the state row ("320 · hover").

### States and interactions step 3, as built (2026-10-27)

- 129759c06: the button sketch variants a and b have the states solid and outline and the four
  interactions.
- 5571eee5f: a comment has an optional `interaction`. Rest is never written; a read fills it in.
  `POST /__design/comment` takes it and refuses an unknown name or an interaction that the part or
  variant does not declare. An existing comment of that kind becomes stale. `et design comment` has
  `--interaction`, and an inbox line names an interaction other than rest.
- 97e42bd31: the interaction switch sits next to the size switch. It lists rest plus the
  interactions of the part and of every variant; without interactions there is no switch. Every cell
  takes comments. A pin shows on the matching cell only; other cells say "1 comment in another
  interaction". A click in the sidebar switches to the comment's interaction.

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

### Flow, wireframe and note decisions (2026-10-27)

- Comment mode works on the flow canvas, built with slice 6c. A comment on a flow frame belongs to
  that state, the same as a comment on the part canvas.
- Studio remembers the picked flow preset per flow in the view state, like the size pick of the
  sketch matrix.
- A wireframe page may import real elements and components next to kit parts, so it grows into a
  page step by step. Only a kit import outside `pages/` fails.
- A state note shows on every rest frame of its state, at every size.
- A note point is in CSS px and may shift between widths, the same as a comment point.
- A free note without `at` stacks above the flow; a note created by a click always gets `at`.
- A flow file write re-serializes the whole file in the standard JSON layout; accepted.
- Moving a note (drag to a new point or `at`) comes in a later slice; until then delete and create
  again.
- Notes whose state is gone get a list later, like stale comments; until then the `NOTE` check
  reports them.
- No control removes a free note's `at`; delete and create again does the same.

Flow comments and preset, as built (bc8801096, proven headlessly 2026-10-27: pins on flow and part
canvas, the other-size note, exclusive Comment/Note modes, a flow comment stored as
`{part, state, size, point}`, no comment on empty flow space, the preset kept across reload and
flow switch):

- A flow frame's place is `{ part, state, size: <preset> }`, the same as a rest frame at that preset,
  so a flow comment uses the same store and pins on both canvases. On the flow a pin shows only
  while its preset is picked. Comment (with count and questions) sits next to Note in the flow bar;
  the modes are exclusive; `c` toggles. A sidebar click on a comment that pins on the shown flow
  opens it there. Lab: `comments/20261027T150000Z-f1a0.json`.
- The preset is remembered per flow as `ViewState.flowPresets["<product> flow:<name>"]`, else the
  previous pick, else the first preset.

### Note and flow comment decisions (2026-10-27)

- Note cards at low zoom: a state note still shows on every rest frame of its state. Below a zoom
  threshold each frame shows the marker only, no card - the same rule as a label that does not
  fit. This stops the phone and desktop cards of one note from overlapping (~21% zoom).
- Flow frames get the "N comments at another size" frame note (`withOtherSizeNotes`, as on the
  part canvas), so a comment made at another preset is visible on a flow.
- The comments sidebar keeps listing a flow comment as a part comment. A jump from outside the
  shown flow opens the part; inside the shown flow it opens on the flow. The comment belongs to
  the state, and a state appears in many flows.
- An outdated design server: when a `/__design` request gets HTML instead of JSON, Studio shows
  "The design server is older than Studio - restart it". Studio does not restart the server
  itself.

As built (2026-10-27):

- 918490a48: below zoom 0.25 (where labels stop holding their size) a pointed note shows its marker
  only. Free-note headings stay at every zoom.
- 80b987c1f: flow frames show "N comments at another size", following the shown preset.
- a38f0bf58: every `/__design` JSON read goes through one helper. An HTML answer
  (`content-type: text/html`) raises the "older than Studio" error, shown where design errors
  already show (system read error, comment and note stores, sketch and new-product forms). Before,
  `designAnswer$` silently turned the HTML into `null`.

Follow-up decisions (2026-10-27), all kept as built:

- Below zoom 0.25 a note without a point has no marker and disappears completely. Its text is not
  readable at that zoom anyway.
- Below zoom 0.25 a marker is not clickable; a note opens only after zooming in.
- The outdated-server check looks at `content-type: text/html` only. An old server always answers
  HTML; a wider check would hide real errors behind the wrong message.

### Wireframe kit fix decisions (2026-10-27)

Seen on `studio-lab` `pages/film-detail` at phone 390: image and text stay side by side, the button
sticks out with a horizontal scrollbar, the title is light on light, the input placeholder wraps.
Causes: a kit row never stacks and the page gives the image 220 × 320 px; kit parts set no text
colour, so text inherits the product colour; the kit button has `white-space: nowrap`.

- A row `box` takes an explicit `stackBelow: <px>`; below that width it stacks its children. It is a
  container query on the box's own width, so a row in a narrow column stacks too. The kit renders
  the container. Risk: `container-type: inline-size` drops the intrinsic width, so a fitted frame
  can collapse; prove a page in a fitted frame.
- Every kit `box` sets the kit text colour, so text between kit parts stays kit grey. The kit gets
  `heading(text)` for titles.
- `image` takes `ratio` (for example `'2/3'`) and fills the width. The kit button is at most as wide
  as its space and ends its text with "…". The design-exploration skill teaches `ratio` and
  `stackBelow` instead of fixed px.
- The builder then fixes `studio-lab` `pages/film-detail` to use them.

Wireframe kit fix, as built (kit 2dc8bd572, skill ae6a590ca, film-detail 2c20cbd63, proven
headlessly):

- `box` takes `stackBelow?: number` (rows only); every box sets the kit ink colour. A stacking row
  renders an outer box with `container-type: inline-size` and
  `contain-intrinsic-inline-size: <stackBelow>px`, a scoped `<style>` with an `@container` rule keyed
  by threshold (nested rows do not clash), and an inner flex row. Rows without `stackBelow` are
  unchanged. Without the intrinsic size a fitted frame collapsed the row to 122px; with it the row is
  560px wide and stays a row.
- `heading(text, { size? })` is a kit-grey `<h2>`, escaped, long words break. `image` `ratio?` sets
  `aspect-ratio` and fills the width; every image has `max-width: 100%`. The button has
  `max-width: 100%` and its label ends in "…". The input placeholder also ends in "…" instead of
  wrapping. Kit count 12 → 13.
- film-detail: heading, image `{ width: 220, ratio: '2/3' }`, `stackBelow: 560`. Phone 390 is a
  column without horizontal scroll, title `rgb(107,107,107)`, buttons inside the width; desktop is a
  row.

### Wireframe kit follow-up decisions (2026-10-27)

- In a fitted frame a stacking row is exactly `stackBelow` wide, even if its content wants more.
  `stackBelow` is the width the author says the row needs; a wider row needs a larger threshold.
- A stacked image keeps its `width` cap. For a full-width image on phone, the author drops `width`.
  No hidden rule widens images in a stacked row.
- The input placeholder ends in "…" instead of wrapping, like the button label. Kept.

Fitted-frame resize loop, fixed (60bd969e9):

- Seen on `studio-lab` `elements/shell-main`: the frame shrank, jumped back and shrank again.
  Cause: the part uses `min-height: 100vh` and a fitted frame adds 16px padding on each side, so the
  content is always 32px taller than the frame. Studio sized the frame to the content, the content
  grew 32px with it, endlessly. The growing frame zoomed the canvas out; below zoom 0.5 Studio
  swapped in the 832px screenshot, zoomed back in, went live, and the loop started over. The
  overflow also caused the scrollbars. The width stayed 259px.
- Fix in the measurement, not the part: Studio drops a measure that repeats the overflow it caused
  itself (real content changes are still followed). `frame.ts` reports its viewport size and hides
  overflow in fit mode.
- Limit: a `vh` part in a fitted frame has no true size. It settles about 32px taller than its
  start, and the live and screenshot heights can differ (632 vs 832).

Notes server, as built (2026-10-27):

- 07d73981c, lab 948a7793b. The reader existed (c618028b5); its check rule is now `NOTE`. A state
  note is `notes/<id>.json` `{ part, state, point?, text }`, the point in CSS px. A free note sits in
  the flow file as `notes: [{ id, text, at? }]`, `at` the top left on the flow canvas, may be
  negative. A write rewrites only `notes` and keeps the other keys and their order, but the file is
  re-serialized with the `JSON.stringify` layout. `FLOW` also reports a misshaped free note and a
  duplicate id; `createNote` refuses a missing part or state.
- Endpoints: `GET /__design/notes`; `POST` `note`, `note-change`, `note-delete`, and `flow-note`,
  `flow-note-change`, `flow-note-delete` (`?flow=`). `/__design/flows` includes the notes. A change in
  `notes/` sends a `notes` event and redraws no part.
- Studio half, 22510314b, proven headlessly (create, change and delete through the UI; a free note
  appended to `flows/sign-in.json` with `at`). Open: at low zoom the note cards of the phone and the
  desktop frame overlap. a state note shows on every rest frame of its
  part and state, at all sizes, not on interaction or sketch frames. With a point: a small square
  marker and the card beside it; without: a column of cards below the frame. On the flow canvas,
  free notes are large bold headings at `at`, or stacked above the top left of the frames. Cards
  always show their text, with a dashed surface border, scaled like line labels. A "Note" toggle
  sits next to Comment and in the flow bar; the two modes switch each other off. In note mode a
  click on a frame makes a pointed note, on a caption a note on the whole state, on empty flow
  space a free note. A click on a note opens Save, Delete and Cancel.

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
  - drag the edge of an active frame: free width (replaced by "Frame size decisions": no drag
    handle for now, and a fitted tile never has one)
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
buttons. Legacy calls stay reachable under Legacy in the system tree.

Removed in 02672803d: `design_statuses`, `design_system`, `design_set_verdict`, `design_set_closed`,
`design_set_mode`, `design_add_variants`, `tools::design_check`, `call_status.rs`, the `design.rs`
write helpers and `CheckReceipt`, with their tests. `tools.rs` keeps MCP serving for slice 8.
Correction: `design_status_watch` was wrongly on the list. It stays, because the sketch view needs
it: `host/design.ts` `designStatusChanges$` arms it, and the system view reloads the sketches on each
report change, as in 0f966f967. 02672803d removed it too, so live report lines and "drawing…" stopped
reaching Studio. Restored in a442b6acf (`StatusWatch` and `watch_statuses` in a trimmed
`call_status.rs`). The Studio spec "lists the sketches again when the host reports a changed status
file" fails without it. The Rust test `a_sketch_report_change_is_reported_and_a_receipt_is_not`
fails with `report()` made a no-op; it calls `watch_statuses` directly, so the command's
`changes.send(())` is covered only by the Studio spec. One `cargo test` run failed
`stop_reaches_the_whole_group`; it passed 6 of 6 on HEAD and 5 of 5 before 02672803d, so it is
flaky, not a regression. Likely cause, not confirmed: its fake tool listens on the fixed ports
45872-45877, which a parallel `cargo test` from another agent can take.

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

States and interactions: in progress since 2026-10-27, in six steps: (1) `interactions` in
`definePart` and the CSS rewrite in the server; (2) Studio forces the interaction and shows the part
table; (3) the interaction switch in the sketch matrix and `interaction` on comments; (4) fitted frames
without a border and the live mode; (5) the studio-lab button; (6) the frame reload per part, as in
"Frame reload decisions". Steps 1 to 5 done (c1c848c75, c62f52cd4, 37cc9d271, 95764db02, 129759c06, 5571eee5f, 97e42bd31,
242bdd69e). Step 6: the server side is done (027805054), the Studio side is built
(8ba222492, see "Frame reload Studio, as built"), and proven. The product picker ("Picker decisions") comes next in the builder queue.

Slice 1: done on 2026-10-27.

Slice 2: done on 2026-10-27. The canvas, the server, the CLI, the tree and Legacy are built, and
the old Calls UI is removed (4b2383ae2). Open: a Rust slice removes the commands only the old UI
used (see "Legacy calls"). The pickers and the "New product" screen are done (c1e8f5806). Open: the create form and
its endpoint, as in "Picker decisions".

Slice 4: done on 2026-10-27, with the frame sizes and the sketch matrix (see "Sketch matrix, as
built" for its open points).

Slice 5: the core and the Studio comments are done (see "Slices 4 and 5 core, as built" and "Studio
comments, as built"): store, comment mode, draft, pins, Withdraw (1209478a5, c0a8e5532), the sidebar,
other-size counts, merge lock and empty matrix cells (f13302bf3), replies and threads (35d609cee). Open:
the merge state and the "needs rebase" inbox entry, as in "Merge and rebase decisions".

Slice 3: the inventory is done (`tomflix-inventory.md`). The rebuild waits on purpose
(decided 2026-10-27) and runs after slice 10. Tomflix stays out until the new workflow works: canvas, sketches and
feedback. Then the old tomflix calls move to Legacy, and the rebuild from them is the battle
test of the workflow. The inventory is the reference for it.
