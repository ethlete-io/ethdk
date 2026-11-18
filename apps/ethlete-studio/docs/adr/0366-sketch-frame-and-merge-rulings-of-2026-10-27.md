---
status: accepted
built: cc89e18d5
decided: 2026-10-27
source: plans/studio/design-system/decisions-sketches.md and decisions-frames.md (deleted in B597), rulings of the human in the slice 2, 4, 5 and 10 rounds
---

# Sketch, frame and merge rulings of 2026-10-27

## Frames and the matrix

- Only pages get the viewport presets of the product, all of them. Foundations, components and elements fit their
  content plus a small margin. A part that responds to its width declares `widths`; a part that fills its container
  must. A drag handle for the width does not exist.
- A small part shows its states as a grid of tiles; a page or a part with `widths` shows one row per state and one frame
  per preset or width. A fitted frame has no border; frames at presets and `widths` keep it.
- The sketch view is a matrix: one row per state, one column per variant (`current`, `a`, `b`). A variant the agent still
  draws shows only its column head ("drawing ..."). A report that is 30 minutes old expires: the frames are drawn and
  the head says "No report for 30 min".
- The interaction switch of the matrix defaults to "all": each row is one state with one interaction, rows go by state
  then by interaction in the Studio order, and the state name shows in the first row of its group. A cell whose variant
  lacks the row's state is a dashed empty cell.
- The row gap is 48 px for fitted frames and 120 px for sized frames; the gap between state groups is the row gap times 2.
  In a matrix of fitted frames every tile in a column takes the width of the widest tile.

## Sketch rounds

- Studio never combines variants. A comment like "solid like a, outline like b" makes the agent draw a new variant with
  `et design sketch variant <target> <name> --from <variant>`, which copies a variant, sets the sketch back to
  `in progress` and clears the pick. It is the only way a status moves back.
- A sketch has rounds (`rounds: [{ key, title, note }]`); variant letters continue across rounds. Before a new round the
  agent writes into the old round's note what it showed and why its variants lost. The matrix groups columns by round,
  the newest open, older ones collapsed. A structured "Combine" decision stays unbuilt until combine comments are common.

## Merge and rebase

- Merge needs a pick and merges only the picked variant. It writes the pick and the note first, then merges; a refused
  merge and a rebase keep both. A sketch records the state of each part it changes; if one changed in the product since,
  merge refuses with a 422 and the reason, the changed parts and the rebase command. A merge that is not safe never
  overwrites a product change.
- There is no rebase button in Studio: a rebase only records the baseline again, it does not adapt the variant. The agent
  adapts the variant and rebases. `et design inbox` lists such a sketch as "needs rebase", also while it is in progress.
- A sketch on a target that exists only in the base can be merged: the target is created in the product ("overridden").
- The merge runs in the design server; it moves to a worker only once a merge visibly hangs. While it runs the Merge
  button is `loading`, Discard is disabled and the sketch shows "merging". On success the sketch goes and Studio selects
  the target part.
- The merge preview is the button "Where <part> is used". It shows only rows with a visible change; rows without one
  fold behind a count. The target part is outlined in Studio's accent colour. The picked variant shows in the accent
  colour; the merge note is a labelled field and a disabled Merge says "Needs a note".

## Products and pickers

- The product picker is an SDK `et-select`, always, with "New product" as its last option. The checkout picker is an
  SDK `et-select` too. A product with a base shows "inherits from <base>" (last folder segment; the built-in base shows
  as `@ethlete/components`).
- "New product" shows a form (name, base: "No base", each product without a base, `@ethlete/components`) that calls
  `POST /__design/product`, which shares `createProduct` with `et design product new`. `--from-project` stays CLI only.

## Frame reload

- The design server sends the ids of the affected parts. A changed part reloads itself, every part that imports it and
  every sketch that shows it. `fixtures.ts` reloads its importers; a CSS file in the product's `styles` reloads every
  part; `config.json` reloads all; a base part reloads in every inheriting product. A file added or removed reloads
  only its own part's frames, plus frames that show an error. When the server is unsure it reloads all.
- Studio renders at most 4 frames at a time, visible frames first. A queued or rendering frame shows a dot in the accent
  colour (still queued, pulsing rendering), the old frame stays until the new one painted, and the status bar says
  "Rendering N frames". A failed render replaces the old frame at once.
- The 1 px outline of a frame with content sits above the content as a pointer-events-none overlay, because at a
  fractional device-pixel ratio the live iframe covers it.
