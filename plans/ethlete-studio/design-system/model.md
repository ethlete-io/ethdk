# Design system: model, roles, structure, layers, files

## Why

The tomflix exploration (`~/dev/tomflix/.ethlete/design/calls/tomflix`) has 40 numbered calls
and a 421-line `PLAN.md`. Decisions live there as prose with RGB values, almost each one "not
yet in the app". Winners are copied from call to call (`variant-g.ts` into `frame.ts`). Calls
build on each other, so each new call makes the older ones stale. Studio stores a history; it
must store a state.

## The model

### Roles

- Studio shows and lets the user decide: view the system, compare variants, pick, comment.
  Direct editing is a planned extension; see [Designer workflow](designer-workflow.md).
- The agent writes files through one core. The CLI and an MCP server are thin layers over that
  core. Everything deterministic is a core operation: create a sketch, screenshot, check, inbox.
- The earlier decision to keep chat in the CLI is superseded by the 2026-10-29 direction:
  agent chat will move into Studio. The old Calls and 1-7 workflow remain retired. See
  [Designer workflow](designer-workflow.md) for the planned chat, editing and repository work.

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
