# Design system: self-test roadblocks, open and pending review

## Studio self-test: roadblocks and possible fixes (2026-10-28)

Designing Studio in Studio tests both the product and the design workflow. Record every
encountered bug, limitation and process failure here, with an observed symptom, cause where
known, current workaround and possible fix. A passing check is not evidence that the workflow
or design is good. Keep findings open until their fix has been verified.

### Sketch canvas zoom controls — open

- Observed: the `pages/sketches` canvas proposal introduced a new top toolbar with instructions,
  “Einpassen” and “100 %”, despite the accepted `elements/canvas-frames` already drawing a
  bottom-right `Fit / 100%` chip. Tom caught this in the screenshot. This breaks consistency
  while purporting to establish one shared canvas behavior.
- Cause: the agent reused the page composition without inventorying its existing canvas
  controls. The zoom chip is embedded in `canvas-frames`, alongside its button demo; it has
  no separately reusable render API or behavior. The sketch checks passed without detecting
  the duplicate control concept.
- Current correction: remove the new toolbar from the open sketch and use the existing chip's
  classes, position and labels for its camera controls. This still repeats chip composition;
  it does not resolve the missing reusable part.
- Possible product fix: extract a shared canvas element that owns viewport, camera and the zoom
  chip, with frame content supplied by System, Sketches and Flows. The chip remains outside
  the camera transform. This is a candidate for the later component/element inventory, not
  an extraction task during the current page exploration.
- Possible process fix: inventory the accepted controls before drawing; explicitly name what
  is reused and what is missing. Check a proposal against the accepted System page as well
  as against its own variants. A checker could flag repeated control markup as a reuse hint;
  semantic duplication still needs review.
- Verification pending: Tom reviews the corrected sketch; a later shared implementation must
  demonstrate the same control and camera behavior across System and Sketches.

### Sketch render check blocked by sandbox port — open

- Observed: `design sketch check pages/sketches --product studio` failed with
  `listen EPERM: operation not permitted ::1:5173` inside the sandbox, before rendering.
- Cause: the render checker starts its own local server; opening the port was blocked.
- Workaround verified: rerun with approved execution outside the sandbox; the check passed.
- Possible fix: report local-server permission failures distinctly from drawing failures and
  provide an explicit check mode that uses an existing design server when available.

### Sketch camera prototype duplicates app behavior — open

- Observed: the proposal needed a local `canvas-setup.ts` implementing fit, pan and zoom even
  though the running app already has a design canvas. The sketch models only part of that
  interaction contract and uses fixed column widths for its sample frames.
- Cause: the design canvas is not exposed as a reusable design-system part with injectable
  frame content. Passing type and render checks did not verify its interaction parity.
- Workaround: keep this code confined to the open sketch; do not treat it as production code.
- Possible fix: expose the real canvas through a reusable adapter for design drawings, with
  measured frame geometry. Verify pointer zoom, keyboard controls and fit behavior against
  the same interaction contract before implementing the accepted design in the app.

### Current exploration order — clarified by Tom (2026-10-28)

We are drawing pages first to discover what should become components, elements and shared
behavior. The page sketches are evidence for that inventory; their implementation need not
already have the final decomposition. The earlier generic foundations → components → elements
→ pages order does not prescribe this exploration's next step.

Record repeated markup, missing reuse APIs and inconsistent behavior as findings with possible
fixes. Do not turn every finding into an immediate extraction or interrupt the page round to
settle an abstraction. Compare the pages first, then propose responsibilities and boundaries
from the recurring needs. The canvas extraction above remains a candidate, not a decided design.

This workflow is itself under test. Challenge it when evidence shows a cost or a failure;
Tom explicitly invites disagreement. Temporary duplication can help discovery, while divergent
interaction rules can undermine the comparison and should be raised during the page round.

### Sketch camera fit leaves a blank band — proposed correction, review pending

- Observed: Tom marked strange whitespace above the frames in both `open` and `page-sketch`
  of `pages/sketches` variant a. The fit prototype vertically centered the entire scaled
  drawing inside a tall viewport, separating the fixed variant headings from their frames.
- Current proposal: round b keeps the fitted scale but starts the drawing 20 px below the
  viewport top for both small elements and full pages. Pan/zoom remains available.
- Possible fix: distinguish the initial comparison framing from a deliberate frame-focused
  camera operation; test top-aligned framing at the actual page sizes before implementing.
- Process finding: type, lint and render checks passed this geometry. They cannot judge
  whether whitespace supports comparison; include heading-to-frame spacing in design review.

### Sketch variant header density — proposed correction, review pending

- Observed: Tom flagged duplicate `g · h · i` in the round heading, the long “Agent zeichnet
  noch” badge and the long merge action word in the narrow fixed variant heads.
- Current proposal in round b: remove the round's duplicate letter list; keep letters on the
  variant heads. Replace the status pill with an inline dot and “Zeichnet” beside the agent;
  use “Merge” for the action instead of “Übernehmen”. Notes may wrap.
- Possible fix: derive header density from the available width and retain readable identity,
  status and action before adding secondary metadata. Compare this on the page sketches
  before deciding which shared components or elements it warrants.
- Verification pending: Tom reviews b at desktop size in both states; automated checks cover
  compilation and drawing failures, not whether the new wording and status treatment fit.

### Starting a feedback round resolves source comments — current behavior

- Observed: `sketch variant ... b --from a --round ... --note ...` immediately marked all five
  comments on a resolved, before b was drawn or checked. This follows the current CLI workflow
  but resolution does not establish that the new proposal addresses the feedback successfully.
- Workaround: preserve the feedback and proposed response in this plan; keep the new sketch
  unready until checks pass and explicitly leave design acceptance to Tom.
- Possible fix: distinguish “addressed in round b” from user-verified resolution, or defer
  automatic resolution until the successor round is ready. Evaluate the extra inbox burden
  before changing the lifecycle.

### Fixed sketch heads drift from camera columns — proposed correction, review pending

- Observed: Tom marked left/right alignment in the page sketch and remaining whitespace in
  the element sketch in round b. A read-only shot confirmed separate flex columns in the
  screen-size header and scaled grid columns below. The camera also added a 20 px inset.
- Cause: the initial prototype treated controls and frame geometry as independent layouts.
  Top-aligning the drawing alone did not correct column alignment.
- Round c proposal: derive header column widths, gaps and horizontal positions from the same
  grid and camera as the frames. Keep header text/control size unchanged. Remove the extra
  camera inset and reduce the gaps between the page header sections.
- Possible fix: model frame/column world coordinates once and use them for both the drawing
  transform and screen-size overlays; inspect alignment at fit and after pan/zoom. At high
  zoom some variant controls can move out of view, so navigation to offscreen variants remains
  an open design question for this prototype.
- Process finding: b was declared checked after automated checks without a geometry review.
  When a comment names alignment, inspect the actual rendering before attributing its cause.

### Context crops contradict the shared zoom model — proposed correction, review pending

- Observed: Tom asks whether one simply zooms into the context examples. In b those examples
  still used the older clipped crop implementation: zoom enlarged the crop, not the complete
  context page. That contradicts the intended continuous canvas behavior.
- Round c proposal: show complete context pages in the existing compact context row; scale
  their native 1440×900 drawing to the row width and allow the same canvas zoom up to 800%,
  enough to inspect them above native scale. No separate open/detail UI.
- Possible fix: represent context pages as ordinary measured canvas frames with native
  geometry and the same focus/fit interaction as other frames. The local thumbnail scale is
  a prototype accommodation, not a settled second camera model. Evaluate this across page
  designs before defining a shared element.
- Verification pending: review c in Studio, including whether the relationship between the
  large page examples and compact context row is understandable while zooming.

Round c verification (2026-10-28): type/lint and sketch checks passed. Read-only shots from
Studio's existing server were inspected for both states: header and frame left edges now
align, the extra top camera inset is gone, and the context row shows complete pages.
This confirms the static geometry; pointer zoom at 800% was not exercised in this check.
Tom's acceptance and the high-zoom offscreen-variant navigation question remain open.

### Studio WebKit UI hangs during page exploration — open bug (2026-10-28)

- Observed: after sketch round c Tom reported Studio no longer responding. Native app PID
  14559 and design-server PID 14705 were alive; the Angular dev server returned HTTP 200.
  WebKit WebContent PID 14681 consumed approximately 99–100% CPU. No matching macOS crash
  report was present: this was an observed UI hang, not a confirmed process crash.
- Evidence: a three-second process sample is saved outside the repo at
  `/private/tmp/studio-webkit-hang.txt`. Its main thread repeatedly runs a JavaScript microtask
  through module-loader evaluation and URL parsing. This does not identify the source module
  or prove that the sketch camera caused it. Chromium render checks had passed.
- Recovery: Cmd+R and SIGTERM did not recover the blocked content process. Targeted SIGKILL
  of that WebKit process followed by Cmd+R created replacement PID 18536. The native app and
  design server remained running. Tom confirmed the UI responds again; the replacement
  content process subsequently measured 0% CPU. Recovery is verified; the cause remains open.
- Possible diagnostic fix: capture frontend errors, navigation/module-load failures and the
  active frame/part/variant in a bounded diagnostic log that can be read when the UI hangs.
  Reproduce sketch-switch and live-update sequences on macOS WebKit, not just Chromium.
- Possible recovery fix: provide a native menu action that recreates an unresponsive webview
  independently of its JavaScript event loop, retaining the last stable selection. Do not
  treat restarting the renderer as a fix for the underlying hang.
- Next investigation: identify the module/URL from a WebKit inspector or instrumented reload,
  then add a focused regression once the cause is known. No source-level fix is established.

### Studio page sketches use CSS while the app uses Tailwind — open workflow mismatch

- Observed: Tom questions why Studio page designs are written in standalone CSS rather than
  Tailwind. The agent continued the accepted drawing files' CSS convention without evaluating
  the later transfer into the Tailwind-based app. CSS is not mandatory for these page sketches;
  the plain-CSS requirement for published library components does not establish that rule.
- Tooling evidence: `createDesignServer` in `libs/cli/src/lib/design/serve.ts` already installs
  the Tailwind 4 PostCSS pipeline. However, `apps/ethlete-studio/src/styles.css` imports
  Tailwind with `source('../')`, scoped to the app. Studio's `.ethlete/design/studio` drawings
  are outside that source tree; sketch-only utility classes are not explicitly registered.
- Current workaround: retain the existing CSS drawings while correcting this round, rather
  than mix a styling migration into camera verification.
- Possible fix: explicitly register the product's drawing sources with Tailwind through a
  product-scoped stylesheet/source entry, verify a utility unique to a sketch is generated,
  and use the app's token-backed utilities for page layout, spacing and type. Retain CSS or
  dynamic style properties for camera geometry and rules utilities do not express well.
- Process fix: distinguish styling conventions by output target. Design pages for the Studio
  app should be easy to transfer into its templates; exported SDK component styling follows
  the library's separate CSS rules. Decide the sketch convention explicitly rather than infer
  it from historical drawing files. No styling migration has been authorized or implemented.

### Round d still clips outlines and strands older rounds — feedback round e (2026-10-28)

- Observed: Tom marked the Merge button's upper outline and the top/left contours of canvas
  frames as clipped. The previous visual pass checked content/pins but did not inspect outer
  shadow/border pixels at clipping ancestors. Passing content-visibility assertions missed it.
- Cause: the fixed header's overflow clip starts exactly at its button top; the camera places
  frame boxes at the viewport edge even though their shadows paint outside those boxes.
- Round e proposal: reserve a small screen-space contour gutter in the stable header and
  camera fit/reset positions. Keep a little room after header actions for their outline.
- Possible fix: include painted bounds and focus-ring extents in viewport/overlay geometry;
  inspect the actual edge pixels at fit and focus. Do not broadly remove clipping, since pan
  content must stay within the canvas. Keep the intentional CLIPPED exception under review.
- Observed: older round summaries remain pinned to the screen bottom with an empty band after
  the context row, whereas the original stacks them directly after the content.
- Cause: the prototype moved frames into a flex-filling viewport but left older rounds outside
  it as a footer. That silently changed the accepted stacked-round hierarchy.
- Round e proposal: place older round summaries directly after context content in the world
  grid, so they follow the content and move with the same camera.
- Possible fix: define which content belongs to world flow versus screen chrome explicitly;
  compare the new page with its source so camera changes do not accidentally relocate content.

### Empty drawing slots and boxed variant identifiers — feedback round e (2026-10-28)

- Observed: hiding unfinished content in d left an unexplained empty fourth column. Tom asks
  for visible placeholders. He also rejects the small boxed iteration/variant identifier.
- Round e proposal: show quiet dashed frame placeholders labelled “Wird gezeichnet”, retaining
  the row geometry without exposing unfinished drawings. Use plain “Variante g/h/i” labels
  instead of boxed letters; retain plain “Aktuell” for the merged baseline.
- Possible fix: specify the drawing state's header, placeholder geometry and availability as
  one coherent page state, then derive component/element candidates after comparing the pages.
  Treat the current wording and outline treatment as proposals for Tom, not settled components.
- Verification in progress: check both states visually plus pointer zoom, pan, Fit, 100% and
  frame/context focus, with special attention to border paint at clipping edges.

Round e verification result (2026-10-28): type/lint and final sketch render checks pass.
Independent Chromium assertions pass for pointer zoom, drag, Fit, 100%, state-frame focus
and context focus in both states. Own screenshots at fit, zoom, 100% and focus were inspected.
Dedicated contour measurements confirm at least 1.5 screen px of clearance above the Merge
button's outline and more than 2 px before the initial frames' painted top/left bounds.
The older-round block is about 17 px after context at fit, rather than pinned to the window
bottom. Three visible pending placeholders preserve the two state rows and context row.
The first contour assertion found only 0.5 px extra clearance above the button outline, so
its header inset was increased by 1 px and both geometry and interaction checks were rerun.
The real macOS trackpad/WebKit reload remains a separate unresolved bug.

### Round e accepted; zoom composition remains open (2026-10-28)

Tom merged e as the working baseline. Accepted: the overall comparison arrangement, contour
clearance, placeholders, plain variant labels and older rounds following the canvas content.
He explicitly keeps zoom composition open: the inner overflow-hidden viewport cuts designs
against an unexplained boundary; variant heads stretch across large visible columns and
separate identity from action. His screenshot shows this during page-sketch zoom.

Possible next treatment: let the canvas continue behind floating screen chrome to the shell
edges, and keep each variant's identity, author and action in a compact head rather than
spreading them over the projected column width. Test fit, focused and intermediate zoom views
in both page states. The finite application viewport still bounds the canvas; the proposal
must make that boundary understandable rather than simply remove all clipping. No component
or element extraction is implied by this page exploration.

Process finding: column-edge and visibility checks passed e, but neither catches an awkward
composition. The next visual review must include the intermediate zoom screenshot, not only
fit and commands' geometric correctness. Preserve the accepted e baseline for comparison.

### Next zoom-composition sketch: drawn states, not another camera (2026-10-28)

Open `studio / pages/sketches`, variant a, on top of the accepted e baseline. Four states:
`open` and `page-sketch` are overviews; `element-detail` and `page-detail` show the same design
at a fixed closer zoom. No camera setup or gesture listener is included in this proposal.
The accepted part retains its earlier prototype; the new variant removes that helper.

The canvas fills the whole shell stage behind floating chrome. The navigation panel occludes
it; clipping occurs at the application boundary instead of at an inner content rectangle.
Variant identity, author, action and note form a compact screen-size head, capped at 304 px
in detail views. This is the visual proposal to settle before implementing the behavior.

Own static review found the neighboring partial column's head itself clipped at the window
edge. The detail states now omit that partial neighbor head while leaving the continuing
frame visible. This is an open tradeoff: a neighbor's controls require panning until its head
has room. Possible later fix: agree a minimal visible-width treatment or a deliberate focus
navigation, rather than stretching every head or silently clipping its action. This round
draws the treatment; it does not implement the visibility algorithm.

Verification scope: type/lint and render checks, plus independent screenshots of all four
states. Layout assertions confirm canvas bounds equal the shell stage and head width stays
compact without text overflow. These are composition checks, not evidence that actual zoom,
pinch or the native WebKit stability issues are fixed.

Static zoom-composition verification completed: all four states compile and pass the render
check. Independent Chromium screenshots were inspected, including both revised detail states.
Assertions confirm the drawing surface matches the 1376×900 shell stage and the grouped heads
stay at 252 px in overview and 304 px in detail, with no internal text overflow. No live zoom
interaction was implemented or claimed in this round. The user decides the composition.

### Scratch verification helpers are CLI candidates — keep in the tooling inventory

Tom asks on 2026-10-28 to keep the temporary `.mjs` helpers in mind as possible Studio CLI
features. Repeated ad hoc browser scripts are evidence of missing tooling as well as useful
checks. Record their purpose and limits; do not automatically promote each script or interrupt
the page exploration with a CLI implementation.

| Scratch helper (outside the repo)             | Demonstrated need                                                                        | Possible CLI capability / limits                                                                                                                                                                            |
| --------------------------------------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/private/tmp/studio-three-options.mjs`       | Capture several variants at the same state and viewport; assert matching drawing bounds. | Batch variant shots or a comparison sheet using the existing shot core. Matching camera geometry must be declared, not guessed from arbitrary markup.                                                       |
| `/private/tmp/studio-zoom-composition.mjs`    | Capture named states and inspect surface/head geometry.                                  | Batch state shots plus optional layout measurements; drawing-specific selectors belong in an explicit request, not hardcoded CLI rules.                                                                     |
| `/private/tmp/studio-sketch-audit.mjs`        | Inspect fit/zoom/100% views, head/frame bounds and pins.                                 | A bounded diagnostic report or scripted interaction capture on real supported canvas behavior. This script targets the rejected drawing-local camera and is not reusable unchanged.                         |
| `/private/tmp/studio-sketch-edges.mjs`        | Check painted contour clearance, pending placeholders and content spacing.               | Extend render diagnostics to painted/focus bounds where feasible; preserve intentional clipping exceptions and distinguish design preferences from errors.                                                  |
| `/private/tmp/studio-sketch-interactions.mjs` | Exercise pointer zoom, pan, Fit, reset and frame/context focus.                          | Reusable canvas interaction verification against the actual Studio implementation. Prefer a stable test harness over arbitrary script execution; it does not verify native macOS pinch or WebKit stability. |

Possible process fix: when a scratch helper repeats across rounds, add it to this inventory
with the input, output, existing CLI overlap and what judgment still requires a person.
Reuse the current shot/render-check/browser core when extracting a capability. Evaluate the
batch-shot/comparison need first; avoid turning prototype-specific selectors and assertions
into a public CLI contract. Keep temporary images, process samples and client data outside git.

### SDK catalog inheritance (2026-10-29)

Tom: a product may change everything about an inherited SDK component. Tier 3 default
components cover most cases and are the starting point. A product may use the Tier 2
headless variants for its own structure and styling; inheritance must not restrict it
to token overrides or the default component's template.

The catalog acquisition and rendering approach is still open. Existing stories supply
examples and states to investigate. Any proposal must account for product part replacement
inside compositions, as well as rendering real default and headless components. The three
current SDK mocks do not establish the final catalog approach.

Implementation planning, scope, phases and acceptance criteria:
[SDK component catalog](sdk-component-catalog.md). This supersedes the earlier mock-based
catalog direction; implementation and component design work have not started.
