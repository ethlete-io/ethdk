# Archive: self-test findings that were reproduced, confirmed, rejected or corrected

### Agent verification overstated coverage — confirmed process failure (2026-10-28)

- Observed: after c the agent reported that both screens had been visually checked. Tom still
  had to ask the agent to verify its own screens. The inspection covered static fit shots,
  leaving obvious interaction failures undiscovered. The previous report disclosed that high
  zoom was untested, but still treated the static check as adequate to hand back the sketch.
- Cause: static screenshots and passing automated checks were used as a completion gate for
  a proposal whose central claim is continuous zoom/pan behavior. The check did not exercise
  Fit → zoom → pan → 100% → Fit or context focus.
- Correction: inspect an independent browser session against the existing design server,
  preserving Tom's Studio selection. Save and inspect fit, zoom and 100% screenshots for both
  states; measure clipping, header bounds and frame visibility. Add direct pan, double-click
  focus and zoom-to-pointer assertions for this round.
- Possible process fix: define the verification from the design claim before drawing, and
  report exactly which states/actions were exercised. For a camera proposal, static fit is
  insufficient. Keep outstanding gaps explicit instead of saying the screens are verified.

### 100% can leave the entire page drawing offscreen — reproduced in c

- Observed: Fit → 100% in `page-sketch` produced an empty dotted canvas. The nearest page's
  top was roughly 1,016 px above the viewport; its bottom was also above the viewport.
- Cause: zooming around the center of a mostly empty, top-aligned viewport preserves an empty
  world point rather than a useful frame. No focused frame anchors the reset.
- Round d proposal: 100% anchors the focused or nearest frame at its top-left. Keep continuous
  pointer-centered zoom for wheel/pinch gestures. Verify visible frame content after reset.
- Possible product fix: camera commands need explicit targets (all, focused frame, visible
  frame) and should preserve meaningful content rather than an arbitrary empty viewport point.

### Zoom stretches fixed variant heads beyond the viewport — reproduced in c

- Observed: zooming the element sketch from 76% to 461% expanded a head to about 1,384 px.
  Its agent identity and Merge action moved outside the viewport while its drawing remained
  visible. Equivalent behavior occurred with page heads. The screen-size typography alone
  did not make the controls usable.
- Cause: each head used the full projected world-column width and translated freely beyond
  the visible viewport, without clipping or sticky positioning within that column.
- Round d proposal: constrain each head to the visible intersection of its column and the
  viewport; keep text/actions at screen size. Hide the head when only a sliver under 180 px
  is visible. This threshold is a prototype choice for Tom to assess, not an SDK rule.
- Possible product fix: use screen-space overlays computed from visible column bounds and a
  deliberate behavior for partially visible variants. Decide the reusable shape after the
  page exploration, not as an immediate extraction.

### Initial fit measured an unstable header layout — reproduced in c

- Observed: the element sketch initially fitted at 76%, leaving unused horizontal space.
  The camera measured before converting the header from its temporary multi-row layout to
  its final single row; that changed the available viewport height after fit.
- Round d proposal: establish a fixed-height header before measuring the camera. Hide overflow
  and truncate secondary notes rather than allowing zoom-dependent header reflow.
- Possible product fix: compute fit from stable viewport geometry; if layout genuinely changes,
  explicitly recompute fit only while in fit mode. Avoid a resize-feedback loop.

### Comment pin clipped at the viewport top — reproduced in c

- Observed: the first comment pin starts at y≈127 while its viewport starts at y=135.
  Its negative frame offset cuts off part of the avatar/count in the initial screen.
- Round d proposal: place frame pins inside the frame's top-right inset.
- Possible product fix: model annotation bounds in fit geometry or keep annotations in a
  screen-space overlay. The product's clipping check currently skips CLIPPED for this page;
  narrow intentional exceptions so this sort of clipping is not silently accepted.

### Context frames cannot be focused; unfinished drawings remain visible — reproduced in c

- Observed: context drawings use `.sk-crop` rather than focusable `.sk-frame` geometry, so the
  double-click handler ignores them. Variant i is marked drawing but still shows faded
  unfinished state and context content, inviting comparison before it is ready.
- Round d proposal: wrap complete context pages as frames, let double-click fit a small frame
  above 100% (up to the existing camera limit), and leave empty slots for drawing variants.
- Possible product fix: context frames should share the same focus contract as state frames;
  drawing status should control availability consistently across the header and frame content.

Round d verification is in progress. Do not treat these corrections as user-approved design.
The audit script and images stay outside the repo under `/private/tmp/studio-sketch-audit.mjs`
and `/private/tmp/studio-audit-*`; Chromium is the independent interaction check, not proof of
macOS WebKit stability or a fix for the earlier module-loader hang.

### Pointer capture loses the frame double-click target — reproduced and corrected in d

- Observed: the first interaction assertions failed on double-click focus even after context
  drawings were wrapped as frames. Zoom-to-pointer, drag and Fit had passed before this step.
- Cause: pointer capture on the viewport redirects the subsequent click/double-click target
  away from the frame, so `event.target.closest('.sk-frame')` can return nothing.
- Current correction: remember the frame at pointerdown before capture and use it as the
  double-click fallback target. Re-run frame focus and context focus in both page states.
- Possible product fix: make pan gesture capture and frame activation share one explicit
  target contract, including cancellation, pointer release and click-versus-drag thresholds.
  Verify actual pointer sequences; dispatching a synthetic dblclick alone misses this failure.

Round d verification result (2026-10-28): type/lint and all sketch render checks pass. An
independent Chromium session exercised both `open` and `page-sketch` through pointer-centered
Ctrl/wheel zoom, drag pan, Fit, real-pointer double-click frame focus and 100% reset. Assertions
confirm the world point under the pointer remains fixed, drag deltas match the camera, Fit
restores the initial scale and 100% keeps a frame visible. Context double-click focus also
passes and enlarges the complete page. Neither state emitted a page error.

The agent inspected screenshots of both fit states, zoom, both 100% views, focused state/page
frames and the focused context page. The initial element fit is now 86% instead of the stale
76%; its initial pin is wholly inside its frame. Pending variant i no longer shows unfinished
frames. Heads remain readable within the visible part of their column after zooming. This
verifies the exercised Chromium paths only: macOS WebKit stability, 800% boundary behavior,
touch and the user's preference for the sticky-head/sliver treatment remain unverified.

### macOS trackpad pinch terminates WebKit and reloads all of Studio — confirmed native failure

- Observed: Tom reports every macOS trackpad pinch reloads the entire app, not only frames.
  Native Studio PID 14559 remained alive while WebContent PIDs changed repeatedly.
- Evidence: unified macOS logs at 14:04:24 and 14:04:27 (local time, 2026-10-28) show
  `WebPageProxy::didReceiveEvent` rejecting `EventDispatcher_GestureEventReply`, followed by
  `AuxiliaryProcessProxy::terminate`, `reason=Crash` and `WebPageProxy::reload`. The narrowed
  evidence is saved outside the repo at `/private/tmp/studio-pinch-native.log`. No matching
  DiagnosticReports file was found; absence of an .ips file did not rule out termination.
- Cause established: the native WebKit UI process rejects a gesture reply and kills its
  content process. The exact trigger for that invalid reply is not established. Do not
  attribute this to a drawing's JavaScript or claim preventDefault fixes the native failure.
- Diagnostic recovery performed: closed the whole native app and restarted through `yarn studio`.
  Earlier recovery replaced only WebContent, which leaves native state alive. A full restart
  tests whether stale gesture state survived that replacement; it is not proof of a durable fix.
- Related coverage gap: the canvas currently handles wheel events, including Ctrl/wheel, but
  has no WebKit gesturestart/change/end path. Chromium's Ctrl/wheel assertions are not a real
  macOS trackpad pinch test. Apple documents separate GestureEvents and their scale values:
  https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/HandlingEvents/HandlingEvents.html
- Possible fixes to evaluate: reproduce on a freshly started WKWebView, compare pinching in
  app chrome and over live/inactive design iframes, and capture native event ordering around
  the rejection. Implement platform gesture handling for camera zoom where needed, but verify
  against actual trackpad input. If native rejection persists independent of content, isolate
  a minimal wry/WKWebView reproduction for an upstream fix or a narrowly scoped native workaround.
- Process fix: record content-process replacement and native invalid-message diagnostics;
  automatic recovery currently looks like an ordinary page reload and hides the root cause.
  Native trackpad pinch must be an explicit acceptance check for Studio's zoom behavior.

Full native restart completed at about 14:11 local time on 2026-10-28. Frontend and native
host rebuilt successfully; waiting for Tom's real-trackpad retest before claiming recovery.
The investigation has not changed the app's gesture handling or applied a speculative fix.

### Design exploration became a parallel canvas implementation — confirmed process failure

Tom explicitly asks to record this on 2026-10-28. The open design question is how a single
canvas composition scales from small components to full pages. The agent implemented a
second camera in drawing-local `canvas-setup.ts`, then refined wheel input, pointer capture,
frame targeting, fit bounds, viewport overlays and interaction assertions across rounds.
That is too much implementation depth for the current page-discovery stage. The accepted
visual baseline does not mean this prototype logic should become production implementation.

The zoom concept itself is in scope. A small interactive prototype can be useful evidence,
but creating and maintaining a parallel camera introduced its own bugs and consumed the
rounds with fixes to the prototype. Visual design decisions and underlying Studio defects
were mixed together, making the workflow harder to assess.

Possible process fix: name the visual question and the smallest useful artifact before
building. For the next zoom-composition round, draw overview and detail-zoom as states of
one proposal at the same application geometry. Compare canvas boundaries, compact variant
heads and chrome placement there. Reuse the existing canvas when behavior is essential;
otherwise leave camera behavior to implementation after the composition is settled. Do not
extend the sketch-local camera to solve the next visual question.

Continue recording actual Studio bugs independently (the native WebKit pinch termination is
one), with evidence and possible fixes. This does not make every discovered defect an immediate
implementation task or require extracting components/elements during page exploration.

### Second 100% WebKit hang after a full native restart — reproduced (2026-10-28)

- Observed: Tom reports another completely unresponsive UI. Studio native PID 20884 remains
  alive; its WebContent PID 21017 measures 98.8% CPU, about 16 minutes after its launch.
  This content process started with the earlier full native restart, not the targeted
  WebContent replacement. A restart therefore does not resolve the recurring hang.
- Evidence: second three-second sample at `/private/tmp/studio-webkit-hang-2.txt` repeats the
  first sample's main-thread pattern: JavaScript microtask checkpoint → moduleLoaderEvaluate
  → ScriptModuleLoader::evaluate → URLParser. The source module and triggering URL remain
  unidentified. This is not evidence that the camera event handlers are the cause.
- Recovery: stopped the whole native app after saving the sample and relaunched through
  `NX_NO_CLOUD=true yarn studio`; verification of the new session follows below.
- Possible next diagnostic fix: instrument module import/reload addresses and retain bounded
  logs of the selected product/part/variant, frame lifecycle and recent file updates. Reproduce
  repeated frame loads in an isolated WKWebView and compare to Chromium. Capture the exact
  import chain before attempting a source-level fix. Keep the earlier GestureEventReply
  termination as a separate signature until evidence connects the failures.
- Workflow: suspend design iteration while recovering the user's tool. Do not respond by
  expanding the drawing's zoom implementation. Static overview/detail design states remain
  the intended next artifact once the tool is usable.

Second recovery observation: new native PID 23442, WebContent PID 23502, design server listening
on 4402. Around 20 seconds after launch, WebContent measured 7% CPU rather than 98.8%.
This confirms a new running session, not a fix or user-verified long-term responsiveness.

### Single proposal multiplied into four screens — rejected exploration (Tom, 2026-10-28)

Tom rejects the latest `pages/sketches` variant a: it looks bad, alignment is wrong, and four
screens consumed time without providing a real design choice. His “one behavior that scales
with zoom” meant one coherent product behavior, not a request to stop drawing alternatives.
The agent misread that intent and repeatedly treated single-variant rounds as sufficient.

The four overview/detail states of a are not four competing answers. A single-variant sketch
is appropriate for a deterministic correction with nothing to choose, not this unresolved
visual question. Static geometry assertions passed, yet the alignment and composition were
not good. The agent's visual check did not provide adequate design judgment.

Rejected: the latest a's floating grouped chrome, its alignment, and expanding one unchosen
idea to four screens before comparing alternatives. Preserve a as rejected reference; do not
merge or polish it as though the direction were accepted.

Possible process fix: pick one representative zoomed page geometry and draw three genuinely
different answers side by side, one screen each. Keep the same data, scale and camera position
so differences belong to the proposed chrome/label/boundary treatment. Name each tradeoff and
recommend a proposal only after all alternatives are visible. Extend the chosen direction to
other states only after Tom chooses. Do not add camera implementation during this comparison.

Comparative replacement round (b/c/d): each has exactly one `zoomed-page` screen. Same 60%
scale, world origin, selected variant a and page content in all three. Own screenshots were
inspected side by side; a browser assertion confirms identical world bounds. Type/lint and
render checks pass. b attaches a compact identity/author/action group to the frame; c keeps
all actions in a fixed comparison strip with a/b markers; d puts only the selected variant's
action in a small inspector. Costs respectively: pan to reach neighbor actions; letter-based
rather than spatial control mapping; selection plus inspector occlusion. Proposal: b for
its direct frame association and smallest addition to the canvas. Tom decides.

The visual pass also caught b's neighboring label sitting on a different baseline from the
active head; its label position was corrected before handoff. These three drawings are
alternatives for one question, not implementations of camera behavior or additional states.

### WebKit freeze fix (2026-10-28)

A visible standalone macOS WKWebView reproduced the 100% CPU freeze after two rapid iframe
replacements; its sample (`/private/tmp/studio-native-repro-baseline.txt`) matches Studio's
moduleLoaderEvaluate/URLParser loop. The invisible initial diagnostic was susceptible to
background suspension, so only the visible run plus CPU/sample is the confirmed reproducer.

`libs/cli/design/web/frame.ts` now completes ESM evaluation synchronously and starts async
environment/drawing work in `drawFrame()`, avoiding top-level await during iframe removal.
The same native 40-replacement test completes. A Node module-evaluation regression verifies
that the old source remains unevaluated with a pending environment, while the fix evaluates
and subsequently draws or reports an error. Both regression cases pass.

The frame announces `design-explore:loading`; Studio waits for its height/error report rather
than revealing it after the external-frame one-second fallback. Three paint-protocol tests
cover pending rendering, external fallback and unrelated-frame messages. The optional native
reproducer is `tools/scripts/verify-webkit-frame-reloads.swift`, accepting full frame URLs;
`WEBKIT_RELOAD_ITERATIONS` controls the count. A 100-cycle run and broader checks were started
before the user's immediate commit/push request. Record their result when available. The
separate native GestureEventReply/pinch failure is not claimed fixed by this change.
