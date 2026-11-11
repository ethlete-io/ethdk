# Second builder (UI): slices

The second builder session (ADR 0198) records its slices here, so its notes do not collide with the first builder's
uncommitted edits in `design-to-code.md`. Order: A1, A2, A3, then A36 as a sketch with variants.

## A1 title bar to the merged design (as built)

`design compare components/title-bar` on 2026-11-06: `windows` and `windows-update` differ (variant f's 46 px caption
tiles, the red close and the left-only padding on Windows are not in the app); `linux-full-notice` and
`windows-notice` cannot be compared (the design's `notice` prop has no app input, the app draws no "Neu starten"
button with `emit:restart`). The twelve forced interaction states of the rows other than `linux-full-update` printed
no line at all.

Slice: a `caption` shape on the SDK window control button, the Windows caption tiles and the error close in the app
title bar, and a `notice` input with a `restart` output that the shell binds.

As built: `caption` shape on the SDK window control button (46 px full-height tile, 10 px glyph, the hover, focus and
press tints of the design); the app title bar draws the Windows caption tiles with the error-theme close, pads only the
left on Windows, and takes `notice` and a `restart` output that shell-main binds to the code watch. `code-notice` is
folded into the title bar. Per finding 484 (ADR 0010) the cause text stays as the built look through an app-only
`noticeText` input (the restart cases and the CLI-dirty hint), marked as needing approval: the sketch
`components/title-bar` with a = built text, b = cause as SDK tooltip, c = no hint opens next.

Verified: `design compare components/title-bar` all 14 states ok and every declared action works (before the
`noticeText` input; the harness never sets it); title-bar and shell-main specs 22/22; lint clean. Not verified: the
twelve skipped interaction states (finding 483), the real Windows window, the text against a design (none exists).

## B403 rules for the UI builder (2cef20507)

- ADR 0202: investigate a tool gap only when it blocks the current UI item; every other gap goes to c4 in one
  sentence, and c0 takes it. The shell-main "changed outside a sketch" investigation is dropped (to c0).
- ADR 0203: a UI item is done only when it shows in the app and every part it affects is compared and verified.
- A1 left 8 parts with IMPLEMENTATION-UNCOMPARED (canvas-frames, studio-menu, flows, inventory, merge, sketches, start,
  system): no compare of the parts that embed the title bar ran before the commit.

## As built: finding 500 - pages/sketches Fit shows every column

Cause: `FIT_COLUMNS = 2` in `sketches.component.ts` capped Fit of a wide part's transposed matrix at two columns
(Aktuell and a), so b was cut and c off screen. The design drew the same cap (`pages/sketches/shared/sketch-rows.ts`,
`Math.min(2, columns)`), so compare saw app and design agree. Fit now counts every matrix column, in app and design.
The design rule change (2 columns -> all) needs Tom's confirmation.

Verified: new e2e case "Fit shows every column of a wide sketch, heads at the top" (page Wide, 2000x1100,
`canvas.e2e.mjs`) failed before ("b spans 1988..2656 outside 344..1980") and passes after; new unit test in
`sketches.component.spec.ts` fails before, file 31/31 after; lint clean. Not verified: `design check --part
pages/sketches` (stopped), compare of pages/sketches. Not reproduced: the ~550 px top gap and the cropped Aktuell
column; hypothesis (unverified): the view reopened with a restored camera (`move()` stores {x, y, zoom} after a wheel
pan at Fit), so pan.y gives the gap and a negative pan.x puts the sticky label gutter over Aktuell; that fix belongs in
camera restore in `system-view/sketch-view.component.ts`. Tool fix proposed: a check geometry rule for camera-fit
parts (every frame inside the viewport horizontally, first head near the top) and a 3-variant wide-part fixture.

## As built: title-bar notice hint b in the app

Tom merged variant b of components/title-bar@notice-hint (332e49626). The app's "Neu starten" button carries
`[etTooltip]="noticeText()"` (bottom-end); the inline `data-code-notice` text shows only without a restart
(cli-dirty). Verified: title-bar spec 12/12 (two new tests: notice state has no inline text and the button's
aria-describedby holds the cause; cli-dirty on macOS shows the text inline without a restart); lint clean. Not verified:
no compare ran (components/title-bar and every part that embeds it), no part check. Expected gap: the design draws
the tooltip always open, the real etTooltip opens only on hover/focus, so compare of the notice states will likely
differ unless it hovers the button.

## As built: A1 rest (title-bar states)

`design compare components/title-bar` on 2026-11-10, nothing changed in the app:

- Interaction states: `linux-full-update` and `windows-update` hover, active and focus-visible ok (6). The other
  9 (`linux-left`, `linux-close`, `windows` x 3) are skipped by B397 as rows of unchanged SDK controls: the forced
  control is a plain `et-window-control-button`, whose states the SDK part compares. Finding 483 is closed: every
  state now prints a line.
- Rest states: 19 ok, including push, cli-dirty, update and `linux-full-notice-failed`.
- `linux-full-notice`, `linux-left-notice`, `linux-close-notice`, `windows-notice`, `macos-notice` FAILED: the
  design draws 1 overlay pane (the notice tooltip always open), the app opens 0 because `etTooltip` opens on hover or
  focus. This is the expected gap. The design forces no interaction on the restart button, so compare has no way to
  open it.
- `linux-full-notice-pending` DIFF 115 px, the same in two runs, only on the spinner inside Neu starten. The design
  mock draws a static half arc and the app's indeterminate `et-spinner` is caught at another frame. The button mock
  sets no `data-et-frozen-at`, so compare cannot hold the app spinner at the mock's frame.

Embedding parts, compared: `elements/shell-main` 15/15 ok, `pages/flows`, `pages/inventory` ok. Diffs in
`pages/merge` (merge-error 2 px), `pages/start` (no-products), `pages/system` (12 states) and `pages/sketches` (20
states) have 0 diff pixels in the title-bar rows (y < 33) of every diff picture, so none of them comes from the
title bar. `elements/canvas-frames` cannot judge 6 states (slot-only, `heads` prop). The `elements/studio-menu`
action "Design-Server neu starten" times out in two runs; the menu sits in the rail, not the title bar.

`design check --part components/title-bar`: 5 OFF-CENTRE, all OLD (the cli-dirty text); open points: notice
hover/active/focus-visible are not drawn, and the design changed outside a sketch (the open
`components/title-bar@edit` sketch, not this slice). No new problem.

Not verified: a real Windows window, the notice tooltip against the design (compare cannot open it), the spinner
frame. The embedding compares were not recorded in `implemented.json` (`compare --affected` would also record
parts other slices changed), so their IMPLEMENTATION-UNCOMPARED stays.

## B345 change-crop b (slices 1-3 built, live shot open)

App side of the merged `pages/sketches` change-crop b (2f83c46da). Slice 1: the server measures where a changed
state differs (box, pixel count, regions) while it compares the pictures and lists it per target as `crops`.
Slice 2: the matrix shows each changed state as an enlarged crop with its reason, a locator and the
"Ganzer Screen"/"Ausschnitt" toggle. Slice 3: states with the same crop show once with a count.

As built: the server compares the two pictures of each changed state (`change-box.ts`: box around every pixel past
the `looksTheSame` tolerance, pixel count, regions of pixels closer than 8 px) and keeps it with the unchanged
states; the listing names it per target as `crops` (full and quick listing). The app passes it through
`sketchRowsOf` and the sketch view into `SketchShot.change`. In the matrix (wide part) `cropGroupsOf` groups states
whose every variant changed the same pixels in the same place; a group shows once in the gutter with its count, the
reason ("1358 px in 3 Stellen · 4,6× vergrößert"), a locator and the "Ganzer Screen"/"Ausschnitt" toggle; its cells
show the crop (24 px margin, enlarged to the column width), the variant cell a frame around its change and the two
stack edges. The list layout (narrow parts) is unchanged.

Verified: specs (change-box, unchanged-states, listing, sketches component), each new case bitten on the old code;
`vitest related` in libs/cli (1347 passed) and ethlete-studio; spec:stress 4/4 per spec alone. Not verified: a live
shot of the crop in a running Studio, `design compare` of `change-crop`/`change-crop-whole` (the harness supplies no
crop data for them), the unit word ("Stellen" for regions, the design mock says "Zellen").

Built in 82c6e3025.
