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

### 1.1 Trackpad pinch kills the WebKit content process - open (L2844)

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

### 1.2 Studio freezes at 100% CPU during frame reloads - reopened (L2697, L2965, L3076)

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
- **Next:** the LAN IPv4 URL path is the suspect. Studio already uses `localhost`. To compare
  equally, repeat the LAN run with the same unthrottled probe.

## 2. Review on the canvas

### 2.2 A new sketch adds controls that already exist - unverified (L2562)

- **Pain:** the sketch added a zoom toolbar. The accepted `canvas-frames` chip already does this.
- **Now:** the sketch reuses the chip.
- **Fix done:** the shared canvas element (2.1). No check for repeated markup.
- **Check (2026-10-29):** works, but the chip is drawn twice: app `− | 100 % | + | Fit`, drawing
  `Fit | 24%`. Tom still decides which chip both use.

### 2.6 Note cards overlap the next row - open (L1140)

- **Pain:** between 25% and 100% zoom, note cards reach into the next row of the matrix.
- **Fix:** reserve note room at the fitted zoom / accept it.
- **Check (2026-10-29):** still broken. On `components/button` the cards cover outline-row frames
  from 67% to about 233% (up to 24,000 px²), also at zoom 1 and above, so "reserve room at zoom 1"
  does not hold. A click on the covered frame opens the note form. Free from 44% down and 349% up.

### 2.8 Labels and badges overlap very short frames in the sketch matrix - open

- **Pain:** the `components/tree-row` sketch (8 states, 3 interactions, 3 variants, rows about 10 px
  high) drew a matrix where the "232 px" size labels, the interaction labels and the "Agent still
  drawing" badges lay over the frames and over each other. Tom: "holy das ist viel".
- **Fix options:** 1. a row is never lower than its labels and badge; short frames get a minimum
  row height (recommended). 2. a short part shows the badge once per column, not per frame.
- **Process side:** a small component sketch draws one composed state (a stack of rows), not one
  state per case times every interaction.

## 3. Feedback, rounds and merge

### 3.20 A product switch keeps the entry of the old product - triage

- **Pain:** after a switch from studio-lab to studio, with a sketch of the old product open, the
  sidebar showed the sketches of studio-lab in the list of studio. The old sketch view stayed. A
  click on "Merge b" ran against the wrong product, and Studio refused it.
- **Where:** the product switch in the System view. Seen one time, from a script race. Not
  reproduced.
- **Fix option:** reset the selected entry when the product changes.

### 3.25 `sketch variant --round --note` replaces the old round's note - open

- **Pain:** on `pages/merge` round r2 the note "why it lost" overwrote round r1's description. The
  agent restored it by hand with `sketch round pages/merge r1 --note`.
- **Fix options:** 1. store "why it lost" as its own field (recommended). 2. refuse without
  `--replace-note` and print the old note.

### 3.26 A new round starts with an empty note - open

- **Pain:** `sketch variant --round` gives the new round no note, and `sketch ready` refuses it. The
  agent had to run `sketch round <part> r2 --note` as an extra step.
- **Fix option:** a `--round-note` flag on `sketch variant --round`.

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

### 4.18 `shot --variants` on a new part gives no reason for the missing rows - open

- **Pain:** a sketch on a part that does not exist yet draws no "now" row and no diff row, and the
  sheet does not say why.
- **Fix option:** one line in the sheet: "new part, nothing to compare with".

### 4.19 `design shot` without `--product` does not infer the product - open

- **Pain:** `design shot pages/merge --states --variants` only printed "More than one product -
  pass --product <name>", though only `studio` has an open sketch on `pages/merge`.
- **Fix option:** use the product of the open sketch or the only product with that part, as
  `sketch` commands already do.

## 5. Drawing parts and pages

### 5.5 Wireframe kit gaps - partly fixed, decision open (L742-L1036)

- **Pain:** drawing agents fought the kit more than the structure questions (L805). Missing:
  dividers, alignment, per-side padding, list rows, avatars, some glyphs. `fill` uses `100vh`.
- **Fix:** add the missing pieces / decide if wireframes are worth the cost (L805).

### 5.20 Variants of one sketch cannot share files - open

- **Pain:** `pages/merge` copies `merge-data.ts` and `merge-kit.css` into a, b and c.
- **Fix option:** a sketch-level `sketches/<name>/shared/` folder with an alias.

### 5.21 A sketch cannot draw another part at a sketch variant - open

- **Pain:** the merge page needs `components/button` "after merging b". The agent faked the after
  frames with a CSS override of the radius.
- **Fix option:** an alias such as `@sketch/components/button:b`. Low priority: only drawings of
  Studio itself need it.

## 6. Agent process

These pains came from how the agent worked, not from the tool. Each one has a rule now.

| Pain                                                                                                                                | Rule                                                                                                                        | Ref        |
| ----------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ---------- |
| The agent said "visually checked" after static fit shots only                                                                       | Define the check from the design claim first. Report exactly which states and actions ran.                                  | L2720      |
| The exploration became a second canvas implementation                                                                               | Name the visual question and the smallest artifact first. Reuse the real canvas.                                            | L2940      |
| One unchosen idea grew into four screens                                                                                            | Draw about three different alternatives next to each other.                                                                 | L3020      |
| The agent blamed the wrong cause for an alignment comment                                                                           | Look at the real render before you name a cause.                                                                            | L2659      |
| A synthetic `dblclick` passed, a real double-click failed                                                                           | Use real pointer sequences.                                                                                                 | L2818      |
| The agent extended the sketch while the tool was broken                                                                             | Stop the design work while a broken tool is repaired.                                                                       | L2982      |
| New controls duplicated accepted controls                                                                                           | List the accepted controls before you draw. Name what you reuse.                                                            | L2579      |
| Shared elements were extracted too early                                                                                            | Draw pages first. Record repeats as findings. Compare before you extract.                                                   | L2607      |
| The agent changed a ready variant without a report; Tom saw it change while no one was drawing                                      | Run `sketch report --variant <x>` before any edit to a variant, also a fix after `ready`.                                   | 2026-10-29 |
| The agent guessed the direction of "spacing passt nicht" and drew one answer; it made the spacing worse                             | If a comment does not say which way, draw both directions as variants, or ask.                                              | 2026-10-29 |
| The agent answered Tom's comments with a variant in the running round; `sketch variant` defaults to it                              | An answer to comments opens a new round (`--round`, `--note`).                                                              | 2026-10-29 |
| A header decision went into one state; the sibling state kept the old header and Tom found it after the merge                       | Before `ready`, shoot every state that draws the changed chrome. Carry the decision into each, or ask.                      | 2026-10-29 |
| After the zoom work the agent proposed more detail on `pages/sketches` (open points 5 to 8); that drifts from the base plan         | Before you propose the next step, read the agreed order: all pages first, then extract components (`design-system.md:905`). | 2026-10-29 |
| The agent wrote new plain CSS files (`header.css`, `heads.css`) for a sketch, though sketches may use the Studio Tailwind utilities | Use utilities in sketch markup (`f27c66d0e`). Plain CSS only for what utilities cannot express.                             | 2026-10-29 |

### Parked: open points on `pages/sketches` (2026-10-29)

Parked until all pages exist and the components are extracted. Next is `pages/flows`, the only shell
section without a page.

- Several state rows per variant, with the head on the top frame.
- Pending "Wird gezeichnet" placeholders.
- The head of the "Aktuell" column.
- Pins and comments at zoom. Recommendation: keep them at screen size.
- Several screen sizes side by side.

## 7. Open checks

These fixes are built, but nobody checked them in the real Studio.

1. The status-watch reload with `et design sketch report` (L1918): the Studio side is verified headless. The Rust side (the watcher) needs the Tauri host and is still unchecked.
2. The `stale` footer (L1980): the Studio side is verified headless. The Rust side (`is_stale`) needs the Tauri host and is still unchecked.
3. Shot size against live size on Tom's HiDPI window (L1214).
4. Round d on macOS WebKit, at 800%, and on touch (L2792).
