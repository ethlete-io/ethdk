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

- ADR 0171: [A design part lives in its product, layer and part folder](../../../apps/ethlete-studio/docs/adr/0171-a-design-part-lives-in-its-product-layer-and-part-folder.md)
- ADR 0172: [config.json holds products with their render settings](../../../apps/ethlete-studio/docs/adr/0172-config-json-holds-products-with-their-render-settings.md)
- ADR 0173: [Every part carries a required note on its shape](../../../apps/ethlete-studio/docs/adr/0173-every-part-carries-a-required-note-on-its-shape.md)
- ADR 0174: [A product names its base by path; @ethlete/components is built in](../../../apps/ethlete-studio/docs/adr/0174-a-product-names-its-base-by-path-ethlete-components-is-built-in.md)
- ADR 0175: [Parts import parts through @system, resolved by the product](../../../apps/ethlete-studio/docs/adr/0175-parts-import-parts-through-system-resolved-by-the-product.md)
- ADR 0176: [There is no product.ts](../../../apps/ethlete-studio/docs/adr/0176-there-is-no-product-ts.md)
- ADR 0177: [The built-in SDK base has the shape of a workspace](../../../apps/ethlete-studio/docs/adr/0177-the-built-in-sdk-base-has-the-shape-of-a-workspace.md)
- ADR 0178: [Parts import the part API as @design-system](../../../apps/ethlete-studio/docs/adr/0178-parts-import-the-part-api-as-design-system.md)
- ADR 0179: [design check runs per product](../../../apps/ethlete-studio/docs/adr/0179-design-check-runs-per-product.md)
- ADR 0180: [The first design check rules](../../../apps/ethlete-studio/docs/adr/0180-the-first-design-check-rules.md)

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
