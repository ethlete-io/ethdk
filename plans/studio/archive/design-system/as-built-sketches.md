# Archive: as-built logs, sketches, matrix, canvas

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
