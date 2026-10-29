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

## 3. Feedback, rounds and merge

### 3.18 `sketch report` prints nothing and exits 0 - open

- **Pain:** `sketch report` prints nothing and exits 0, also on a `ready` sketch. There it records a
  report that Studio never shows.
- **Where:** `reported` in `libs/cli/src/lib/design/sketch-command.ts`, and `reportSketch` in
  `libs/cli/src/lib/design/system/sketch/sketch.ts`.
- **Fix option:** print "reported", and warn when the sketch is not in progress.

### 3.19 The merge preview compare grid is unreadable and slow - open

- **Pain:** the compare grid of the merge preview fits at 3-4% zoom, and the text is not readable.
  "Comparing…" ran over 25 s on a sketch whose change touches five parts.
- **Where:** the merge preview in `sketch-view.component.ts` (`apps/ethlete-studio`).
- **Fix option:** fit to the first changed row, not to the whole column. Show progress while it
  compares.

### 3.20 A product switch keeps the entry of the old product - triage

- **Pain:** after a switch from studio-lab to studio, with a sketch of the old product open, the
  sidebar showed the sketches of studio-lab in the list of studio. The old sketch view stayed. A
  click on "Merge b" ran against the wrong product, and Studio refused it.
- **Where:** the product switch in the System view. Seen one time, from a script race. Not
  reproduced.
- **Fix option:** reset the selected entry when the product changes.

### 3.21 `sketch check` blocks `ready` for a comment of a merged sketch - open

- **Pain:** a reply by the user reopens a comment on a merged sketch. Then `sketch check` raises
  `COMMENT ... the sketch on pages/start no longer exists - answer or drop the comment`. This blocks
  `ready` on a new sketch of the same part until the user resolves the comment.
- **Where:** the `COMMENT` rule in `sketch check`.
- **Fix option:** name the action in the message (reply, or the user resolves the comment). Do not
  block `ready` for a comment whose sketch was merged.

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

## 5. Drawing parts and pages

### 5.5 Wireframe kit gaps - partly fixed, decision open (L742-L1036)

- **Pain:** drawing agents fought the kit more than the structure questions (L805). Missing:
  dividers, alignment, per-side padding, list rows, avatars, some glyphs. `fill` uses `100vh`.
- **Fix:** add the missing pieces / decide if wireframes are worth the cost (L805).

### 5.13 No rule for assets (marks, logos, icons, images) - decided, building

- **Pain:** the Studio mark lives as inline SVG in `foundations/logo`, in `pages/start` and as a
  separate glyph in `elements/shell-main`; the app has a fourth copy in
  `apps/ethlete-studio/src/app/components/studio-mark.component.ts`. No rule says where an asset
  lives, how a part draws it, or how it reaches the real app.
- **Decision (Tom, 2026-10-29):** the shell glyph stays its own design for now.
- **Fix options:** (1) assets are named exports of a foundation part (`studioMark`, 5.7); (2) an
  `assets/` folder per product, imported by parts and by the app; (3) the app's component is the
  source and the design system embeds it.
- **Decision (Tom, 2026-10-29):** option 2 with (1) as a thin wrapper, but for every file type, not
  only SVG. Example: a header picture as PNG.
- **Rule:**
  - An asset is a file in `.ethlete/design/<product>/assets/`: SVG, PNG, WebP, JPEG, or another
    type. One file is the only source.
  - A part imports it as `@assets/<file>`. The default import is a URL for `<img src>`. An SVG that
    must follow tokens (`var(--accent)`, `currentColor`) imports with `?raw` and goes inline.
  - A foundation part may wrap an asset in a named export, for example `studioMark(size)`.
  - A product finds the assets of its base product too (`studio` finds `sdk` assets).
  - A sketch variant can add or change an asset in its own `assets/`; a merge copies it.
  - `design check` and the "changed outside a sketch" hash count the bytes of the assets a part
    imports.
  - The app gets the same files when a design goes into the real app; not part of this build.
- **Extension (Tom, 2026-10-29):** the rule covers fonts and icons too.
  - Fonts: files in `assets/fonts/` (`woff2`). The product's `styles.css` declares `@font-face`
    with `url('@assets/fonts/<file>')`; `foundations/tokens` names the family in a `--font-*`
    token. Only fonts whose license allows the repo.
  - Icons: one SVG per icon in `assets/icons/<name>.svg`, `currentColor`, square `viewBox`. A part
    imports it with `?raw` and inlines it. The same text is the `data` of an SDK `IconDefinition`
    (`provideIcons`), so the app registers the same files.
  - A `foundations/icons` part that shows the whole set is design work: a sketch after this build.

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
