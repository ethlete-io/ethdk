---
status: accepted
built: cc89e18d5
decided: 2026-10-27
source: the design system model plan (deleted in B597, ADR 0365) and rules.md (trimmed in B597), "The model", "Sketches", "Feedback", "Checks", "Canvas and navigation", "Kept from the call model", "Legacy calls", rulings of the human
---

# The design system model and its standing rules

The design system replaces the call model (project, feature, call, variant, the 1-7 workflow). Studio stores a state,
not a history. ADR 0171-0180 fix the file layout; this ADR holds the model around it.

## Roles and structure

- Studio shows and lets the human decide: view the system, compare variants, pick, comment. The agent writes files
  through one core; the CLI and the MCP server are thin layers over it. Everything deterministic is a core operation.
- The repo is the workspace; it holds products. A product has exactly one design system and extends at most one base;
  a base has no base. A product part with the name of a base part overrides it. A product's design files live in its
  own repo.
- Layers: foundations (tokens, logo, CI), components (generic parts), elements (product-specific parts), pages (page
  states). A layer may use the layers before it; a component never uses an element.
- A part is TS without Angular: a render function with typed props plus CSS, a value (`html`, `css`, `drawing()`).
  Angular frames were rejected because the design server would need the Angular compiler of each repo's version.
- A part declares its named states; interactions are a second axis. A product has one fixture set and its viewport
  presets. Each part records why it has its shape as a short note; history is git, there is no decision log.
- Where an SDK part fits, it is used, never redrawn: Studio UI uses SDK controls and core primitives, a product system
  takes the SDK part from the base and changes its look through tokens, and a new component needs a reason in its note.
  The built-in base renders SDK components with `ng()`.
- A product may change everything about an inherited SDK component. The default components (tier 3) are the starting
  point; a product may use the headless variants (tier 2) for its own structure and styling. Inheritance is not limited
  to token overrides or the default template.

## Sketches and feedback

- A sketch always has a target, an existing or a new part; a free sketch (mood, palette, logo) is allowed only for
  foundations. One open sketch per target. A sketch may change parts below its target.
- Status: `in progress` (live re-render, labelled, the agent reports what it builds, the human may comment but not
  pick), then `ready` (the human picks), then merged or discarded. Before a merge a preview shows every page and element
  that uses the changed parts, old and new side by side.
- After a merge the sketch is deleted; the picked variant is the part and the reason is its note. The other variants
  live in git.
- The human comments on a state or a point; Studio writes the comment as a file in the repo. The agent reads open
  comments with `et design inbox`; a done comment is deleted and only the reason stays as the part's note.

## Checks

`et design check` fails on: a dependency that points up a layer or an element used by a component; a hard-coded colour
outside foundations; a copy of a component inside a page or element; motion that is not CSS animations, CSS transitions
or the Web Animations API (no `requestAnimationFrame` loops, so a timeline can stop any animation at time t).

## Canvas and navigation

- Each system entry is its own infinite canvas; frames show one state at one width at full height, no scrollbars, only
  pan and zoom. Controls as in Figma: space or middle mouse drag pans, the wheel pans, ctrl+wheel or pinch zooms to the
  pointer, `Shift+1` fits all, `Shift+2` fits the selection, `Shift+0` is 100 %, a double click makes a frame active and
  `Esc` leaves it.
- Only frames in view run live; the others show a cached screenshot from the core that makes the agent's screenshots,
  so agent and human see the same presets.
- The tree has Foundations, Components, Elements, Pages, Wireframes, Flows and Sketches, with badges (from base,
  overridden, sketch open, comment open). A sketch shows on its target's canvas: the current version left, the variants
  right in the same states and widths.

## Kept from the call model

- Studio stays an Angular app; a model name is never a fixed union in the code. `frame.html` stays the frame host and
  takes `?surface=<name>&color=<name>`.
- `ng(template, { imports, fields })` renders real Angular components in Node (`@angular/compiler` JIT and
  `renderApplication`) from the built package; a product's `providers.ts` gives it colour and surface themes. A frame
  cannot import an `@ethlete` barrel (libs resolve to source and the import dies with `ERR_INSUFFICIENT_RESOURCES`).
- A drawing has a `setup(root)` hook. A drawing may set `et-surface--<name>` on an inner panel, never on its root.
- The status files of `et design` live in the temp dir `ethlete-studio-checks/`, one per checkout.
- The old call UI, the Legacy tab and the host commands only it used are removed. Legacy calls stay readable as files in
  git. `design_status_watch` stays: the sketch view needs it for live report lines.
- The agent chat moves into Studio (2026-10-29 direction, `plans/ethlete-studio/designer-workflow.md`).
