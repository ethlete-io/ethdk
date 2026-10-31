# Design system: frame size, frame reload, merge, merge preview and sketch rounds decisions

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
- Result: Tom merged surfaces variant A (neutral grey, chroma 0) in Studio. The white strip was
  fixed in the merged part (`body` background `var(--surface-sunken)`). Next sketch: accent, on
  `foundations/tokens`, four hues at the same lightness and chroma (A blue, B violet, C teal, D
  amber).

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

### Frame reload file decisions (2026-10-27)

These change the "all" case of 027805054.

- A file added or removed reloads only the frames of its part. The server maps it by its folder,
  for example `components/button/...` or `sketches/components-button/c/...`.
- A file in no part folder reloads nothing, except frames that show an error now, since the file
  may be the one they missed.
- `config.json` still reloads all. Comment files reload no frame (as built).

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
