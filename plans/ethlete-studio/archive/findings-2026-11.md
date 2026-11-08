

240\. `design shot --crop` with a box outside the content returns an empty canvas without error (builder,
2026-11-03); an agent can review a blank picture and call it fine. Fix: B163, fail with "crop box outside content
(content box ...)".

As built (B163, 2026-11-07): Playwright does not return an empty canvas for a clip outside the page, it throws "Clipped area is
either empty or outside the resulting image", which `shot` turned into "the screenshot failed" (the opposite of the finding's
wording). Decided with the caller: a crop outside the content now answers an empty transparent picture of the crop size
(times `--scale`) and `shot` prints `<state>: crop box x,y,w,h is outside the content (content box ...); the picture is
empty`; any other screenshot failure still fails. Spec in `shot.spec.ts` (fails without the fix); the PNG written by
`blank-png.ts` was checked chunk by chunk (CRC). Not verified: a live Chromium run through `et design shot --crop`, and the
HTTP route (`serve`) carries no note, only the CLI prints it. Why no tool caught it: `shot` only has mocked-page specs, and
no spec ever asked for a clip outside the page; the note closes it for the CLI.

241\. Studio disclosure padded its panel instead of its body (fixed f05409524); compare was 12/12 green because the
demo body is `display: contents` inside the padded panel, so both forms give the same geometry (builder,
2026-11-03). A demo that cannot tell two layouts apart cannot guard either. Fix: B164, a disclosure state whose
demo brings its own block body. Same slice: compare counts the design's `sameToggle` output as missed because the
app uses a `[(sameOpen)]` model; decided: the tool maps `model()` as input + `<name>Change` output (into B153).

242\. After B134 declared actions on title-bar, update-dialog and tree-row, compare reports 63 + 2 + 36 "fired no
output" misses, though the window buttons work in the app: the app components call the window API themselves
instead of emitting (builder, 2026-11-03). Separately, at far-out zoom on pages/sketches the column head is
visibility:hidden, so "Übernehmen" and the pin toggle cannot be reached; COVERED would not see it (nothing covers a
hidden element) and the static capability list cannot see a zoom state. Lesson: a declared action must be
reachable in every state that declares it, and an app component that does the work itself hides it from the
compare. Decided (technical): app title-bar and update-dialog get real outputs (update/minimize/maximize/close,
later/restart), the consumer calls the window API; tree-row gets an app output `rowPress` + design
`emit:rowPress` (B166). B158 checks reach, not only cover: UNREACHABLE <part> <state>: <action> for hidden,
invisible, zero-size or covered. Look fix for far-out as variants in the B142(b) sketch.

243\. Tom (2026-11-03): "we only have Linux and Mac" title bars. A `windows` state exists in components/title-bar and
in the app, but it draws the same small `et-window-control-button` size md as Linux, only square and with a
0.5 gap inside the bar padding; it does not read as Windows (native caption buttons are wide, full bar height,
flush to the top-right edge, no gaps). Every check was green because each checks the design against itself or
the app against the design; nothing compares an OS-native imitation with the native original. Lesson: a part
that imitates platform chrome needs the platform's own measures as a reference, not only our design. Fix: the
look comes as a Studio sketch (B167); the part declares the platform measures it follows (button width/height,
inset) in its note, and the check measures them (B168, technical).

245\. B158's reach check found that `emit:merge` and `emit:discard` appear in none of the 21 pages/sketches states
(builder, 2026-11-03). Likely cause: `pages/sketches/shared/sketch-rows.ts` adds the action with
`replace(/<button\b/, ...)` and `sketches.ts` with `act(discard.body, 'discard')`, and neither matches the SDK
button markup, so the attribute is silently never added. Compare never checked these two actions either, and
stayed green: an action that is never declared has no misses. Lesson: a helper that marks nothing must fail, not
return its input unchanged. Fix: B181 (technical) - a design helper `withAction(markup, action)` that throws when
nothing matched, used everywhere actions are added; pages/sketches merge/discard fixed with it (no visual
change); red on the two Übernehmen cases afterwards.
Correction (builder, 2026-11-03, after B181 d648d0395 + d961cb00d): the cause was refuted - a private build shows
emit:discard in all 21 states and emit:merge wherever a take is offered; the "0 occurrences" came from the stale
shared dist (finding 255) or finding 246. withAction still found a real silent bug: pages/sketches gave a comment
pin a second `data-et-action`, the browser kept the first, so the drawing hid the second (now a throw). The two
Übernehmen cases cannot go red: they only occur after a pan, no static state draws one, and COVERED counts only
opaque covers while Verwerfen is transparent. Decided (technical): B201 - reach sweeps pan positions on canvas
parts, and COVERED counts any element that takes the hit (`elementFromPoint` is not the target or inside it),
opaque or not, keeping the overlay/tooltip exemptions.

246\. Specs cannot render a real Studio part from source: "Cannot find module .../render-worker.js", and only the
first error line reaches the RENDER issue, so a spec against a real design passes with 0 findings (builder,
2026-11-03). A check that cannot run reports the same as a check that found nothing. Lesson: a render failure is
never zero findings, and its full error must reach the report. Fix: B182 (technical) - vitest global setup
builds the render worker once into a private dir; RENDER detail prints the full error. Probably the same family
as the private-build "Transform failed" after B155 (cause checked in the B169 slice).

247\. Tom (2026-11-03) on the B167 r2 sketch (46 px tiles, variant e): "the size of the buttons is correct, the size of
the icons is definitely not". The note declares a "10 px glyph", but the drawn ink is about 6 px: the 10 px is the
icon box, and the icon's viewBox has padding around the stroke. Native Windows 11 caption glyphs are 10 px of
ink. No check measured the ink; the declared measure and the measured box agreed with each other. Lesson: a
platform measure for a glyph is the visible ink, not the box it sits in. Fix: B167 r3 (sketch: glyph ink sizes as
variants, tiles stay 46 px); B168 measures declared glyph sizes as the ink bounding box (non-transparent pixels in
the shot), not the element box.

248\. B174 (inbox "Erneut laden") is blocked by 5 LIVE false positives in `sketch check`/`sketch ready` (builder,
2026-11-03): `liveStateProblemsOf` (system/sketch/check-sketches.ts) reads state names with `stateNamesOf`, which
is null unless the part has a literal `states: {}`; pages/inbox spreads its states from shared/. A static read of
source shape stood in for the real state list. Lesson: a check reads what the part exports at runtime, never a
literal in its source. Fix: B183 (technical, priority) - read state names from the loaded module; null on both
sides is skipped as in STATES.
ready` prints that command for every file it wrote; the brief uses it. Not an auto-commit inside ready.

251\. While sketching B175 (builder, 2026-11-03): `data-et-skip=CLIPPED` sits on the canvas-viewport root, so it also
exempts the zoom chip from every check; SKIP-SCOPE tolerates this only while the page structure stays identical,
so a sketch that changes the page trips it. A skip wider than the element that is really clipped silently
exempts its neighbours. Fix: B187 (technical) - the skip moves onto the clipped content inside canvasView
(elements/canvas-frames); SKIP-SCOPE then holds without the identical-structure exception.

252\. The anchored-dialog arrow in the B175 sketch needed a hand-set offset because its anchor is not the element under
the chip (builder, 2026-11-03). A hand offset is right for one layout only and no check compares arrow tip with
anchor centre. Fix: B188 (technical, SDK) - an anchor option on the components anchored-dialog that points the
arrow at a given element; the render check measures arrow tip vs anchor centre. Changeset + docs guide.

As built (B188, 2026-11-07): `arrowAnchor` on the anchored strategies (`@ethlete/core` `OverlayRuntimeAnchoredPosition`,
`@ethlete/components` `anchoredOverlayStrategy`/`anchoredDialogOverlayStrategy`; an element or `(origin) => element`):
floating-ui's arrow middleware then measures that element instead of the reference, the pane stays placed against the
origin. The `anchoredDialog()` design mock takes `anchor` (a selector, drawn as `data-et-arrow-anchor`); the design frame
(`mountDrawing`) aims every such arrow and re-aims on resize, so a part needs no setup of its own. `design check` has the
new render rule ARROW-ANCHOR: the tip misses the anchor centre by more than 1px (e.g. out of reach of `arrowPadding`), the
selector matches nothing, or a mock arrow carries a hand-set `--et-floating-arrow-translate` without an anchor. Live
pages/system dropped its hand offset (327 / 314.68px) for `anchor: '[data-et-control="open-points"]'`. Verified: specs in
core, components and cli (the cli one fails without the statements), `design check` pages/system and
components/anchored-dialog report ARROW-ANCHOR 0 (other findings unchanged and unrelated), Storybook overlay story
"Arrow at this button" (pane anchored to the button row) puts the tip at the button centre (342.5px vs row centre 640px).
Not done: the B175 sketch (`pointArrow` in sketches/pages-system/shared/capabilities.ts, untracked on the Mac) still sets
its offset by hand; the new rule reports it once the sketch is checked - swap it for `anchor`. Mocks that never name an
anchor (components/update-dialog) are not measured.

As built (anchor, 2026-11-07): every `anchoredDialog()` call site listed: studio pages/system (already anchored),
studio components/update-dialog (now `anchor: '[data-et-control="update"]'`, the title bar's Update button), and the SDK
components/anchored-dialog part (its states draw no trigger, so there is nothing to name; left anchorless). No rule
requires an anchor: an anchorless arrow in the default place is correct for a pane whose trigger is not drawn, so a
requirement would flag the SDK part itself. Verified: `design check` studio components/update-dialog.
