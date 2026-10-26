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
  It is not an editor.
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
    `PRESETS` and `TYPE-ERROR`.
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
7. **Interaction**: a clickable prototype. A page switches between its named states on rules
   such as `click .trigger → open`, with a View Transition, on top of `setup(root)`. Open: host
   controls for replay, speed and reduced motion.
8. **MCP server** over the core. It replaces the chat-only tools in
   `apps/ethlete-studio/src-tauri/src/tools.rs` and also works in terminal sessions. The agent
   instructions say motion comes later as an update.
9. **Motion**: its own plan. A timeline, controlled time, a screenshot per keyframe. Motion is a
   tool that extends components and elements.

Each slice gets an "in progress" note here when it starts.

Slice 1: done on 2026-10-27.

Slice 2: the canvas component is in progress since 2026-10-27. The rest waits for slice 1.

Slice 3: the inventory is done (`tomflix-inventory.md`). The rebuild waits on purpose
(decided 2026-10-27). Tomflix stays out until the new workflow works: canvas, sketches and
feedback. Then the old tomflix calls move to Legacy, and the rebuild from them is the battle
test of the workflow. The inventory is the reference for it.
