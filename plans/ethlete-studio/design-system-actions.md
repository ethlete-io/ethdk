# Ethlete Studio - pain points from the self-test

We design Studio in Studio to find where the tool and the workflow hurt. This list collects each
pain point that `design-system.md` reports (state on 2026-10-28). `Lnnn` is a line in
`design-system.md`, where the full report is.

Each entry has:

- **Pain** - what went wrong while we used Studio, the CLI or the workflow.
- **Where** - the incident that showed it.
- **Now** - the workaround that we use today.
- **Fix** - the options for the tool or the workflow.

Status: **open**, **fixed** (fix checked), **unverified** (fix built, not checked), **triage** (a
round 1 report from L700-L1100). A pass on 2026-10-28 checked and fixed most entries. A fixed entry
moves to `design-system-actions-fixed.md` and keeps its number.

Not in this list: the design choices for the Studio pages themselves (for example the zoom
composition of the Sketches page, L3020). Those choices go to Studio as sketches.

## 1. Studio app (native and WebKit)

### 1.1 Trackpad pinch kills the WebKit content process - cause found (L2844)

- **Pain:** a pinch on the macOS trackpad crashes the content process, and Studio reloads fully.
  All view state is lost.
- **Where:** page exploration of the Sketches page, on Tom's real trackpad.
- **Now:** do not pinch. Use the zoom chip.
- **Fix:** the cause is not known. Do these steps in order:
  1. Get the result of Tom's retest after the full restart (L2872).
  2. Reproduce on a new, empty WKWebView.
  3. Compare a pinch over the chrome, over a live iframe, and over an inactive iframe.
  4. Record the order of the native events.
  5. Then choose: gesture handling in the canvas / a minimal wry repro for upstream / a native
     workaround.
- Do not ship a fix on a guess. Log each crash of the content process, because the automatic
  reload hides it.
- **Result (2026-10-29, ethlete-mac, macOS 15.7.7, WebKit 20621.3.11.11.3 = Safari 18.6):** cause
  reproduced in a minimal WKWebView, `tools/scripts/verify-webkit-pinch.swift`.
  - Synthetic pinches alone do not crash: 280 magnify, rotate and smart-magnify gestures (paced,
    burst, mixed with scroll events, no end phase, iframes replaced mid-gesture) over chrome, a
    live, an inactive (`pointer-events:none`) and a swapped cross-origin iframe: 0 terminations.
    Each pinch reaches the page as `gesturestart/change/end` plus Ctrl+wheel events.
  - The crash needs stale state: kill WebContent while gesture replies are pending (`--stale`:
    block the page for 2 s, pinch, SIGKILL). After the automatic reload, each following pinch
    kills the new content process, 4 terminations in 4 pinches, 3 of 3 runs. The unified log shows
    Tom's signature exactly: `WebPageProxy.cpp 10644: Invalid message dispatched ...didReceiveEvent`,
    `Received an invalid message 'EventDispatcher_GestureEventReply'`, `reason=Crash`. Control (the
    same kill without a pending gesture): 0 terminations.
  - Cause in WebKit: `WebPageProxy` keeps a queue of sent gesture events and checks each reply
    against its head. A dead process never answers, and Safari 18 (branch `safari-7621`, also
    `7622`, `7623`) does not clear the queue when WebContent exits. The stale head makes every
    later reply a type mismatch, and a MESSAGE_CHECK kills the process. WebKit `main` and
    `safari-7624` and later clear the queue in `resetStateAfterProcessExited`.
  - Workaround proven in the harness: on a WebContent termination, create a new WKWebView instead
    of reloading the old one (`--stale --recreate`): 0 terminations after the kill, 3 of 3 runs.
  - Open: which first termination left the stale gesture in Studio. A candidate is finding 1.2: a
    hang and a manual WebContent kill while a pinch waits. Not proven.
- **Options now:** (a) Studio native: on `webViewWebContentProcessDidTerminate`, rebuild the
  webview (or the window) instead of wry's reload; needs Tom's OK, Rust only. (b) Update Safari on
  the Mac to a release from `safari-7624` or later, and retest with `--stale`. (c) Accept: a full
  Studio restart clears it.
- **Check (Tom, by hand on the real trackpad):** on ethlete-mac, with a design server running,
  `swift tools/scripts/verify-webkit-pinch.swift "<frame-url>" --seconds 90`. Pinch, rotate and
  double-tap with two fingers over each of the four columns (chrome, live iframe, inactive iframe,
  swapping iframe). Expect no `CRASH` line; send the log if one shows. Then in Studio after a fresh
  start: pinch 5 times, and note whether the crashes start only after a WebContent kill or a hang.

### 1.2 Studio freezes at 100% CPU during frame reloads - not reproduced (L2697, L2965, L3076)

- **Pain:** Studio hung two times. Cmd+R and SIGTERM did not help. Only a kill of the WebContent
  process helped.
- **Where:** fast reloads of sketch frames while we drew the Sketches page.
- **Fix done:** `frame.ts` has no top-level await during an iframe removal. A native test with 40
  replacements passed.
- **Open:** a 100-cycle run started, but nobody recorded the result. Run it again.
- **Options not taken:** a bounded log of module-load failures with the active frame; a native
  menu item that creates the webview again.
- **Decision (Tom, 2026-10-29):** run the 100-cycle test over SSH on ethlete-mac when it is on.
- **Result (2026-10-29, ethlete-mac, macOS 15.7.7):** 100 cycles with 3 frames: 1 hang in 4 runs
  (after batch 80, WebContent at 100% CPU until the watchdog). 40 cycles passed. Other sessions
  loaded the Mac at the time. Next: 10 runs of 100 on an idle Mac after a fresh `nx build cli`.
- **Result 2 (2026-10-29, fresh `dist`, Mac mostly idle):** 1 hang in 10 runs of 100 (run 6, after
  batch 74). Sample `/tmp/wk-samples/hang-6.txt`: main thread 100% busy in
  `MicrotaskQueue::performMicrotaskCheckpoint` -> `ScriptModuleLoader::evaluate` ->
  `WTF::URLParser` (`parseIPv4Host`), no deadlock. Same shape as the first two hangs. The probe used
  a LAN IPv4 URL; a run against `localhost` is not done. Next: repeat 10 x 100 on `localhost`
  (run the server on the Mac or tunnel over SSH), then decide between a minimal WebKit repro for
  upstream and a workaround (e.g. never remove a frame while its module evaluates).
- **Result 3 (2026-10-29, `localhost` URL over an SSH tunnel, fresh `dist`):** 0 hangs in 10 runs
  of 100. Each run passed batch 100 in about 16 s. No stack: no hang to sample. Load (1 min) 4.3 to
  5.5 before the runs; the probe adds this load. The Mac screen was locked, so the probe in
  `/tmp/wk-probe` turned off window occlusion and hidden-page timer throttling. Without this
  change, all runs stopped at batch 12 or 13 with all processes idle; also with `127.0.0.1`. This
  is page suspension, not finding 1.2. The orphaned `nx tauri:dev` (100% CPU) also loaded the Mac
  in these invalid runs 1 to 4; it was stopped before the valid runs.
- **Result 4 (2026-10-29, LAN IPv4 URL `http://192.168.1.152:<port>`, the unthrottled probe of
  Result 3, `dist` of 19:47):** 0 hangs in 30 runs of 100 cycles. Each run passed batch 100 in
  16.3 to 16.4 s. Load (1 min) 2.4 to 5.1. No hang, so no sample. With Result 3: 0 hangs in 4000
  cycles on both hosts. The LAN IPv4 path is not the trigger. Results 1 and 2 differ from 3 and 4
  in two ways: the throttled probe, and an older `frame.ts` (later changes `43cec7ae9`,
  `144e2d843`).
- **Probe change:** `tools/scripts/verify-webkit-frame-reloads.swift` now always turns off window
  occlusion and hidden-page timer throttling. The probe tests frame replacement, and a throttled
  page only gives false stops at batch 12 or 13 on a locked or covered screen. Checked: 100 cycles
  pass on the locked Mac.
- **Recommendation:** close as not reproduced; no workaround and no upstream repro without a
  reproducing case. Reopen with a `sample` of WebContent if Studio hangs again. A hang plus a
  manual WebContent kill during a pinch can also cause finding 1.1.

## 2. Review on the canvas

### 2.2 A new sketch adds controls that already exist - unverified (L2562)

- **Pain:** the sketch added a zoom toolbar. The accepted `canvas-frames` chip already does this.
- **Now:** the sketch reuses the chip.
- **Fix done:** the shared canvas element (2.1). No check for repeated markup.
- **Check (2026-10-29):** works, but the chip is drawn twice: app `− | 100 % | + | Fit`, drawing
  `Fit | 24%`. Tom still decides which chip both use.

### 2.12 `foundations/tokens` is one very tall sheet - open

- **Pain:** Tom: "echt unschön, dass tokens so ein langer Block ist". All groups (surfaces, accent,
  warning, type, spacing) stack in one sheet; at fit zoom (36 %) nothing is readable, and the
  error group makes it longer.
- **Fix options:** 1. split into parts `foundations/colors`, `foundations/type`,
  `foundations/spacing`, one tree entry each (recommended; a sketch after the error colour merge). 2. Studio lays out the groups of one part in columns that fit the viewport. 3. one tree leaf per
  group inside `tokens`.

## 3. Feedback, rounds and merge

### 3.20 A product switch keeps the entry of the old product - triage

- **Pain:** after a switch from studio-lab to studio, with a sketch of the old product open, the
  sidebar showed the sketches of studio-lab in the list of studio. The old sketch view stayed. A
  click on "Merge b" ran against the wrong product, and Studio refused it.
- **Where:** the product switch in the System view. Seen one time, from a script race. Not
  reproduced.
- **Fix option:** reset the selected entry when the product changes.

### 3.36 `--variant-note` overwrites the part's merged note - open

- **Pain:** `foundations/tokens` "Error colour": the variant note replaced the settled tokens note
  in every variant; a merge drops the old note.
- **Fix options:** 1. store the variant note apart from `definePart({ note })` (recommended). 2. append it to the merged note.

### 3.37 `sketch report --done` answers differently for the same case - open

- **Pain:** after a live text report on each of a, b and c, `--done` printed "had no live report"
  for a and b and "is no longer drawing" for c.
- **Fix option:** one consistent "a: done" line (with 3.32).

## 4. Render checks and shots

### 4.5 Stale results until a restart - fixed, one limit (L1415, L532, L1820)

- **Pain:** a cached wrong shot stays until a file changes. A flow edit, and a change to the port
  or `render.*`, need a server restart.
- **Fix done (`41bc90f74`):** a flow edit clears the shot and thumbnail caches. A change to
  `render.*` restarts the worker. Shots use the new port.
- **Limit:** the Vite server keeps listening on the old port until a restart.

### 4.6 Useful helpers live only in `/private/tmp` - fixed, one gap (L3055)

- **Pain:** the agent wrote scratch scripts for batch shots, zoom-state shots, a sketch audit,
  painted bounds and interactions. Each session writes them again.
- **Fix done (`1902a2675`):** `et design shot <part> --states [--variants]` writes one labelled
  contact sheet. The skill points to it.
- **Gap:** no zoom states for a page, because only the Studio canvas has a zoom. No CLI for
  comparison geometry.

### 4.7 Fitted `vh` parts have no true height - known limit (L2264)

- **Pain:** the frame settles about 32 px taller. Live and shot heights can differ.

### 4.16 `design check` passes while open sketches have type errors - open

- **Pain:** on the `pages/merge` round (2026-10-29), `design check --product studio` said "ok" while
  all three variants had TypeScript errors. Only `design sketch check pages/merge` found them.
- **Fix options:** 1. the product check also types open sketches (recommended). 2. it prints "N open
  sketches not checked, run `sketch check`".

### 4.17 CLIPPED and WRAP do not name their escape - open

- **Pain:** scaled thumbnail frames trip CLIPPED and WRAP by design. The agent found
  `data-et-skip="CLIPPED"` only by reading `pages/sketches`.
- **Fix option:** each message names `data-et-skip="<CHECK>"` for an element that clips on purpose.

### 4.23 The render check misses a clipped text decoration - open

- **Pain:** in tree-row r4 i, the label's `overflow: hidden` cut off the red wavy underline. CLIPPED
  did not fire; the agent saw it only in the shot.
- **Fix option:** CLIPPED also measures `text-decoration` ink (or warns on a decoration inside
  `overflow: hidden`).

### 4.24 CLIPPED does not see a clipped outline or box shadow - open

- **Pain:** a focus ring drawn as an outside outline on `components/tree-row` c was clipped by the
  frame. The render check reported nothing.
- **Fix option:** count `outline` and `box-shadow` extents in the CLIPPED check.

### 4.31 `sketch check` says nothing about a `grid` - open

- **Pain:** no line confirmed that the grid was read or that each cell names a real state.
  Unknown names fail typecheck, but repeated or dropped states pass silently.
- **Fix option:** one line such as `grid 13 rows x 4 columns ok`, an error for a state named twice.

### 4.32 `design check` says ok while an open sketch has a type error - open

- **Pain:** `components/comment-pin`: `design check --product studio` said "ok" while every variant
  had a TS error. Only `sketch check` found it.
- **Fix options:** 1. `design check` also type-checks open sketches (recommended). 2. it prints that
  it skips open sketches.

### 4.34 A page's replace on another part's markup can match nothing, silently - open

- **Pain:** merge `a47a64158` renamed the canvas cell class from `st-canvas-cell` to `st-sgrid-cell`.
  `pages/inbox` `pinned()` still replaces `<div class="st-canvas-cell">`, so the merged inbox shows
  no pin in any state. No check noticed it; the "Use the comment pin" sketch found it.
- **Fix options:** 1. `elements/canvas-frames` offers a typed per-cell slot, so pages stop
  regex-ing its HTML (recommended). 2. `design check` warns when such a replace matches zero times.

### 4.37 No check sees grid rows that skip the interaction columns - open

- **Pain:** the merged `components/comment-pin` grid had hover, pressed and focus cells for faces,
  but the count rows filled only "rest". Nothing flagged that a count could break on focus.
- **Fix option:** `sketch check` warns when some grid rows fill every column and others only one.

## 5. Drawing parts and pages

### 5.21 A sketch cannot draw another part at a sketch variant - open

- **Pain:** the merge page needs `components/button` "after merging b". The agent faked the after
  frames with a CSS override of the radius.
- **Fix option:** an alias such as `@sketch/components/button:b`. Low priority: only drawings of
  Studio itself need it.

### 5.23 The SDK hover token draws light on Studio's dark frames - open

- **Pain:** in `components/tree-row`, `--et-surface-interaction-hover-solid` came out light grey,
  and the hovered label became unreadable. The agent used `--surface-raised` instead.
- **Fix options:** 1. a part frame gets the product's dark surface context, so SDK surface tokens
  resolve as in the app (recommended, check first why it does not). 2. `design check` warns on an
  SDK surface token in a product without that context.

### 5.24 A component sketch does not see what its hosts draw - open

- **Pain:** `components/tree-row` was merged without the part-with-frames row and the warning
  triangle that `elements/part-tree` draws. The adoption sketch on part-tree then mapped the
  warning to "in progress" and lost the bright part row (467 px diff). It was discarded; tree-row
  gets round r2.
- **Fix options:** 1. `sketch new` on a component lists the parts whose markup it will replace, and
  the brief says to draw every case they draw (recommended, a skill rule). 2. a CLI check that
  compares the classes a host uses with the component's states.
- **Rule (Tom, 2026-10-29):** a part becomes a component only when two hosts draw the same case.
  Option 1 is in the `design-exploration` skill under "The order of a design".

### 5.25 Studio has no warning colour theme - open

- **Pain:** tree-row's warning mark needs a semantic warning colour. Studio's tokens have only the
  accent theme and `danger`; the SDK `--et-theme-color-*` aliases resolve to SDK blue. The merged
  `tree-row` draws the mark in `--color-et-danger` (`tree-row.css:61`).
- **Fix option:** a sketch on Studio's foundations that adds a theme of type `warning`.
- **Sketch (2026-10-29):** `foundations/tokens` "Warning colour", a amber, b muted ochre, c orange,
  is `ready` (agent recommends a). After the merge, a one-variant `tree-row` sketch uses `--warning`.

### 5.26 The CLI cannot remove a merged part - open

- **Pain:** to fold `components/tree-row` back into its host, the agent found no command. A manual
  `git rm` leaves its comments, its `merged.json` entry and its `tsconfig.json` path behind.
- **Fix option:** `design part remove <layer>/<name>`. It refuses while a part imports it, and it
  resolves the part's comments.

### 5.27 `design check` does not see a class that no CSS defines - open

- **Pain:** `pages/flows` draws its flow list with `st-tree-row`, `st-tree-lead` and `st-tree-label`.
  Since `part-tree` draws with `tree-row` (`561cbea6c`), no CSS defines them. No check reported it.
- **Fix option:** a render check rule that reports a class in a part's markup that no loaded
  stylesheet and no utility defines.

### 5.28 A state cannot force an interaction on one element - open

- **Pain:** `definePart({ interactions })` forces only the part's root and draws every state times
  every interaction; a named state cannot pass `RenderOptions`. `tree-row`'s root is the stack, so
  the agent wrote `data-et-force` into the row markup by hand. The skill does not say how; the agent
  read `define-part.ts`, `web/frame.ts` and `force-interactions.ts`.
- **Fix options:** 1. a state carries an interaction, for example
  `states: { hover: { props, interaction: 'hover' } }` (recommended). 2. an exported helper that
  marks a forced element. Both: one paragraph in the skill.

### 5.30 `design check` does not report an unused export in `shared/` - open

- **Pain:** `flowList` and `stepTree` in `pages/flows/shared/flow-data.ts` had no importer. They
  kept a dead `part-tree` import alive. Found by hand.
- **Fix option:** `design check` warns about an export in a part's `shared/` that nothing imports.

### 5.31 Studio has no pressed surface token - open

- **Pain:** `tree-row`'s `:active` fill is a `color-mix` of `--surface-raised` and
  `--surface-sunken`, written in the component.
- **Fix option:** a `foundations/tokens` sketch that adds a pressed surface, once a second control
  needs a pressed state.

### 5.32 A page cannot reuse the canvas frame chrome - open

- **Pain:** `pages/system` "Many states": `elements/canvas-frames` exports only the fixed button
  frames, so the agent copied the frame head, frame box and zoom chip CSS into the sketch's
  `shared/`.
- **Fix option:** a sketch on `elements/canvas-frames` that exports frame head, frame box and zoom
  chip as named parts.

### 5.34 `StateGrid` has no row groups - open

- **Pain:** variant c of "Many states" groups rows ("States by interaction", "Rest only") by
  inference; a grouping by kind and end mark cannot be declared.
- **Fix option:** optional `groups` on `StateGrid`, only if Tom picks a grouped look.

Also seen again in "Many states": 3.27 (`sketch.json` not Prettier-clean) and 4.30 (shot path).

### 5.39 A combo of two forced states was never drawn, and its bug slipped through - open

- **Pain:** the "Pressed state" sketch claimed a pressed selected row keeps its tint. There was no
  `selected-active` state, so nobody saw that `.st-trow:active` replaced the accent with grey.
  Tom found the gap in the grid of "Many states" ("selected active fehlt noch").
- **Fix options:** 1. the grid shows an empty cell where a row has states in other columns, and
  `sketch check` lists empty cells (recommended; the grid made the gap visible). 2. `sketch check`
  draws every row x column combination of a grid in a scratch pass and flags cells that look like
  another row.

### 5.40 `sketch check` misses a page that uses a part through a plain module - open

- **Pain:** "One grid look" on `elements/canvas-frames`: `pages/merge` uses it through
  `merge-data.ts`, which is no part; `sketch check` did not list `pages/merge`, so the agent shot
  it by hand.
- **Fix option:** follow imports through non-part modules when the check collects dependants.

### 5.45 Agent logos exist in three copies - open

- **Pain:** a component cannot import from a page, so the `components/comment-pin` sketch holds a
  third copy of the agent logos (after `pages/inbox` and `pages/sketches`), with brand hex colours
  in TS.
- **Fix option:** the agent logos become a foundation asset: an icon set in `assets/` with a named
  export in a foundations part, then the pages and the pin import it (recommended, follows 5.13).

### 5.50 Studio's danger colour fails contrast on its dark surfaces - open

- **Pain:** `--color-et-danger` is rgb(220 38 38): 3.96:1 on `--surface-sunken`, 2.92:1 on
  `--surface-overlay`. Below AA for text everywhere and below 3:1 for a mark on overlay.
- **Fix options:** 1. a `foundations/tokens` sketch that gives `danger` a Studio tone, about
  oklch(0.68 0.19 25) (recommended). 2. only a `--danger-text` alias.
- **Sketch (2026-10-29):** "Error colour", a signal red, b rose, c soft coral, is `ready` (agent
  recommends a). A white `--on-danger` cannot pass AA with a mark >= 3 on overlay; all variants use
  a dark ink on the fill.

### 5.51 No contrast numbers next to colour tokens - open

- **Pain:** the warning sketch agent wrote its own oklch-to-sRGB and WCAG script, because the raw
  `.et-color--*` vars take rgb triplets and the Studio aliases are oklch.
- **Fix options:** 1. the tokens drawing prints the contrast ratio of each colour token against
  each surface (recommended; it reads computed styles already). 2. a `design contrast <fg> <bg>`
  command.

### 5.52 One colour theme spans three hand-kept blocks - open

- **Pain:** a theme lives in the `:root` aliases, the `.et-color--x` raw block and the Studio
  aliases in `tokens.css`, plus the group regex of the tokens drawing.
- **Fix options:** 1. `design tokens theme add <name> --type <type> --oklch ...` writes all blocks
  (recommended). 2. the skill names the places.

## 6. Agent process

These pains came from how the agent worked, not from the tool. Each one has a rule now.

| Pain                                                                                                                                | Rule                                                                                                                                                | Ref        |
| ----------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| The agent said "visually checked" after static fit shots only                                                                       | Define the check from the design claim first. Report exactly which states and actions ran.                                                          | L2720      |
| The exploration became a second canvas implementation                                                                               | Name the visual question and the smallest artifact first. Reuse the real canvas.                                                                    | L2940      |
| One unchosen idea grew into four screens                                                                                            | Draw about three different alternatives next to each other.                                                                                         | L3020      |
| The agent blamed the wrong cause for an alignment comment                                                                           | Look at the real render before you name a cause.                                                                                                    | L2659      |
| A synthetic `dblclick` passed, a real double-click failed                                                                           | Use real pointer sequences.                                                                                                                         | L2818      |
| The agent extended the sketch while the tool was broken                                                                             | Stop the design work while a broken tool is repaired.                                                                                               | L2982      |
| New controls duplicated accepted controls                                                                                           | List the accepted controls before you draw. Name what you reuse.                                                                                    | L2579      |
| Shared elements were extracted too early                                                                                            | Draw pages first. Record repeats as findings. Compare before you extract.                                                                           | L2607      |
| The agent changed a ready variant without a report; Tom saw it change while no one was drawing                                      | Run `sketch report --variant <x>` before any edit to a variant, also a fix after `ready`.                                                           | 2026-10-29 |
| The agent guessed the direction of "spacing passt nicht" and drew one answer; it made the spacing worse                             | If a comment does not say which way, draw both directions as variants, or ask.                                                                      | 2026-10-29 |
| The agent answered Tom's comments with a variant in the running round; `sketch variant` defaults to it                              | An answer to comments opens a new round (`--round`, `--note`).                                                                                      | 2026-10-29 |
| A header decision went into one state; the sibling state kept the old header and Tom found it after the merge                       | Before `ready`, shoot every state that draws the changed chrome. Carry the decision into each, or ask.                                              | 2026-10-29 |
| After the zoom work the agent proposed more detail on `pages/sketches` (open points 5 to 8); that drifts from the base plan         | Before you propose the next step, read the agreed order: all pages first, then extract components (`design-system.md:905`).                         | 2026-10-29 |
| The agent wrote new plain CSS files (`header.css`, `heads.css`) for a sketch, though sketches may use the Studio Tailwind utilities | Use utilities in sketch markup (`f27c66d0e`). Plain CSS only for what utilities cannot express.                                                     | 2026-10-29 |
| `components/tree-row` was extracted with one host (`part-tree`); its sketch missed the host's cases and cost an extra round         | A part becomes a component only when two hosts draw the same case. Until then it stays in its host. `tree-row` has two: `part-tree`, `pages/flows`. | 2026-10-29 |

### Parked: open points on `pages/sketches` (2026-10-29)

Parked until all pages exist and the components are extracted. Next is `pages/flows`, the only shell
section without a page.

- Several state rows per variant, with the head on the top frame.
- Pending "Wird gezeichnet" placeholders.
- The head of the "Aktuell" column.
- Pins and comments at zoom. Recommendation: keep them at screen size.
- Several screen sizes side by side.

### 6.3 `yarn design` rebuilds the CLI on every call - open

- **Pain:** about 2.4 s per call; noticeable in a check-and-shot loop. Agents switch to
  `node dist/libs/cli/src/index.js design` on their own.
- **Fix options:** 1. the skill names the direct `node dist/...` call for loops (recommended). 2. nx skips the build on a cache hit.

### 6.4 `dist/libs/cli` disappears while another agent builds the CLI - open

- **Pain:** a sketch agent got MODULE_NOT_FOUND from `sketch check` while a parallel agent ran
  `nx build cli`; a retry worked.
- **Fix options:** 1. build to a temp dir and rename it into place (recommended). 2. the skill
  says to retry once.

## 7. Open checks

These fixes are built, but nobody checked them in the real Studio.

1. The status-watch reload with `et design sketch report` (L1918): the Studio side is verified headless. The Rust side (the watcher) needs the Tauri host and is still unchecked.
2. The `stale` footer (L1980): the Studio side is verified headless. The Rust side (`is_stale`) needs the Tauri host and is still unchecked.
3. Shot size against live size on Tom's HiDPI window (L1214).
4. Round d on macOS WebKit, at 800%, and on touch (L2792).
