# Ethlete Studio

Studio is the desktop design tool in which a human designs a product as parts, compares agent-made sketches and
picks what gets built. Its decisions are recorded in `docs/adr/`.

## Language

### Design system

**Product**:
A design system for one application, under `.ethlete/design/<product>/`, with its own render settings and presets.
_Avoid_: project (the old config key)

**Base**:
The product whose parts a product inherits unless it overrides them; `@ethlete/components` is the built-in SDK base.

**Part**:
One designed piece of a product (`<layer>/<name>`, for example `components/tree-row`), drawn in all its states.
_Avoid_: component (when the design is meant), screen

**Layer**:
The level of a part: `foundations`, `components`, `elements` or `pages`. A part may import only from lower layers.

**State**:
One drawn appearance of a part, such as `rest`, `hover` or `open`.

**Control**:
An interactive element a part declares, whose interaction states the part must draw; it belongs to the part that
draws it.

**Inventory**:
The list of a page's controls with their owner and states, as Studio shows it over the page's frame.

**Demo frame**:
The padding and background a part draws only around its own states, never when it is embedded.

### Sketches

**Sketch**:
A proposal to change one or more parts, holding the current design and several variants side by side.

**Round**:
One set of variants in a sketch, answering one question; a new round follows when no variant fits.

**Variant**:
One proposed answer in a round, labelled a, b, c and carrying a short note in the designer's words.

**Pick**:
The human's choice of a variant; the only way the human decides on a design.

**Merge**:
Writing the picked variant into the part, which records the part's new hash.

**Edit sketch**:
A `<part>@edit` sketch with the variants `old` and `new`, made by Studio when a direct edit changes a merged
part's pictures.

**Direct edit**:
A change to a merged part outside a sketch.

**HELD**:
The outcome of a direct edit or edit sketch whose pictures do not change: the edit holds at once, without a pick.

**Changed area**:
The crop of a sketch round that shows only what the variants change, at the same scale for every column.

**Quick listing**:
The fast answer of the design server that lists the sketches before the full listing with its rule checks arrives.
_Avoid_: listing (when the full listing is meant)

### Readiness

**Build-ready**:
The computed state of a part whose checks are all green; only a build-ready part may be implemented.
_Avoid_: go, accepted

**Human**:
The role of the person who picks and confirms, in code, commands and records.
_Avoid_: a person's name, designer

### Sessions

**Grill session**:
The session that asks the human the design questions and writes the plans and ADRs.
_Avoid_: doc agent (as a product term)

**Builder**:
The session that implements decided work and reports only to the grill session.
