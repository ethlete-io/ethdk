# Design system: sketch, frame, matrix, picker, merge and reload decisions

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

### Sketch matrix cell and spacing decisions (2026-10-27)

- A cell whose variant lacks the row's state is a dashed empty cell at the size of the other cells
  in the row; at size `fitted` it takes the size of the largest one. It reads "a has no disabled
  state"; in the `current` column, "new in this sketch". It takes no comment, since a comment
  needs a state the part has.
- The canvas row gap is 48 px for fitted frames (the tile grid, the matrix at `fitted`) and stays
  120 px for pages and parts with `widths`. Tom approved 48 px from a screenshot.

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
