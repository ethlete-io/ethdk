# Archive: as-built logs, frames, merge, reload, sketch rounds

### Studio reads the merged tokens, as built (2026-10-27)

- 9ed3560f4: `apps/ethlete-studio/src/styles.css` imports
  `.ethlete/design/studio/foundations/tokens/tokens.css` through the build, in a layer
  `studio-tokens` below Tailwind's `theme`. `@theme inline` exposes them as `bg-surface*`,
  `text-text`, `text-accent*`, `text-ui-xs` to `text-ui-xl`, `font-ui-*`, `p-space-1` to `-7`,
  `h-control-sm`/`-md`, `h-row`. The Nx build lists the file as an input.
- Conflicts, held off by the low layer: the product's `--font-sans`/`--font-mono` and
  `--radius-sm`/`-md`/`-lg`/`-full` share Tailwind's theme names (Studio's Jost and Tailwind's radii
  win, so these tokens are not exposed); its `sdk` part redefines `.et-surface--dark`,
  `.et-color--default`, `.et-color--danger` and the `:root` 62.5% and `body` rules. Open: rename the
  product's font and radius tokens before the component layer reads them.
- Still on the generated `themes.css`/`surface-themes.css`: every SDK component, Studio's `body`
  and select picker, about 14 app files through `var(--et-surface-*)`/`--et-theme-color-*`, and
  `bg-et-surface-bg`, `border-et-surface-border`, `text-et-surface-muted`.
- Proven: a spec compiles `styles.css` with Tailwind and finds `--accent` in the layer (fails
  without the import); headless, `--accent` resolves on the document, and the start view has zero
  computed-style diffs and an identical screenshot before and after (only the shell, no design
  server). Not checked: the dev server's watch on the token file.

### Fitted frames and live mode, as built (2026-10-27)

- 242bdd69e (step 4): a fitted frame (no width) has no border; a selected or live frame keeps the
  accent outline. A live frame shows a "Live · Esc" badge. Comment mode ends live mode, and a double
  click does nothing while commenting. Esc reaches Studio only through the `design-explore:escape`
  postMessage, since the iframe keydown listener is gone; that removes the `UnsubscriptionError` at
  teardown.
- 6fc599421: the part table drops the "in another interaction" count.
- Expected, no action: a real hover on a cell that already forces hover adds nothing visible.

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
