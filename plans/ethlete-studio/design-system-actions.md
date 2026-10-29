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
round 1 report from L700-L1100). A pass on 2026-10-28 checked and fixed most entries.

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

### 1.2 Studio freezes at 100% CPU during frame reloads - fixed, one check open (L2697, L2965, L3076)

- **Pain:** Studio hung two times. Cmd+R and SIGTERM did not help. Only a kill of the WebContent
  process helped.
- **Where:** fast reloads of sketch frames while we drew the Sketches page.
- **Fix done:** `frame.ts` has no top-level await during an iframe removal. A native test with 40
  replacements passed.
- **Open:** a 100-cycle run started, but nobody recorded the result. Run it again.
- **Options not taken:** a bounded log of module-load failures with the active frame; a native
  menu item that creates the webview again.

## 2. Review on the canvas

### 2.1 Each sketch builds its own camera - unverified (L2595, L2940)

- **Pain:** the Sketches page sketch needed real zoom and pan. The agent wrote a local camera in
  `canvas-setup.ts`. That camera has fixed column widths and different behavior from the real
  canvas. Most bugs in rounds c and d came from this copy.
- **Fix done (`b9ebae71d`):** `canvas-camera.ts` holds the camera for the Studio canvas and the
  sketch. `canvas-viewport.ts` is the shared element, imported as `ethlete-studio/canvas`. The
  local camera is deleted.
- **Open:** the Angular canvas uses the camera module, not the shared element. Nobody checked the
  System view visually or the wheel zoom on a real trackpad.
- **Decide (Tom):** which chip both use (`− | 100 % | + | Fit` or `Fit | 100%`), and the 100%
  composition (frame 64 px from the top-left).

### 2.2 A new sketch adds controls that already exist - unverified (L2562)

- **Pain:** the sketch added a zoom toolbar. The accepted `canvas-frames` chip already does this.
- **Now:** the sketch reuses the chip.
- **Fix done:** the shared canvas element (2.1). No check for repeated markup.

### 2.3 Zoom breaks the sketch layout - unverified (L2737, L2748, L2763, L2921)

- **Pain:** at 100% the full drawing was offscreen. At high zoom the variant heads stretched past
  the viewport. The first fit measured a header that was not stable yet.
- **Now:** round d anchors the focused frame and clamps the heads. Round e reopened the heads.
- **Fix done (`b9ebae71d`):** camera targets `all`, `focused` and `visible`. The viewport fits
  again after the layout is stable. In the app, 100% now anchors a frame at the top-left.

### 2.4 Outlines and pins are clipped - fixed (L2773, L2876)

- **Pain:** the Merge button outline, the frame edges and a comment pin were cut off.
- **Fix done:** a contour gutter in round e.
- **Fix done (`48a1c9a79`):** `data-et-skip="CLIPPED"` skips one element. Only `.sk-crop` has it
  now. The archived variants in `sketches/pages-sketches/*` keep the old page skip.
- **Option:** include focus rings and painted bounds in the geometry check.

### 2.5 Double-click on a frame did nothing - fixed (L2818)

- **Pain:** pointer capture lost the target of the double-click.
- **Fix done:** the canvas remembers the frame of the pointerdown.

### 2.6 Note cards overlap the next row - open (L1140)

- **Pain:** between 25% and 100% zoom, note cards reach into the next row of the matrix.
- **Fix:** reserve note room at the fitted zoom / accept it.

### 2.7 The newest round is dimmed while in progress - fixed (L978)

- **Pain:** the agent cannot judge the newest round in its context.
- **Fix done:** the dim is a Studio overlay. `et design shot` draws undimmed, and the skill says so.

## 3. Feedback, rounds and merge

### 3.1 A new round resolves the comments too early - unverified (L2648)

- **Pain:** when a feedback round starts, the source comments resolve before the new round exists.
  Tom cannot see which comments are really done.
- **Fix done (`3504d8352`):** a round, merge, discard or `inbox done` marks a comment "addressed".
  Only Tom resolves it in Studio. Old files read as addressed.
- **Open:** check the badge and the Resolve button in the running app. Decide (Tom) if the pins of
  addressed comments look different.

### 3.2 Tom withdraws his own comments before a merge - unverified (L1047, L1011)

- **Pain:** open comments block the merge, and the pick does not close them. The agent cannot
  reply to a resolved comment to say what it changed.
- **Fix done (`3504d8352`):** comments do not block a merge. The agent can reply to an addressed
  comment. A reply by Tom opens it again.

### 3.3 Two sources disagree on who merges - fixed (L1041, L1770)

- **Pain:** the inbox and the skill give different steps after a pick.
- **Now:** Studio writes the decision, and the agent runs `sketch merge`.
- **Fix done (`3504d8352`):** Studio merges with its Merge button. The inbox and the skill tell
  the agent not to run `sketch merge`. Pick and Merge are still two clicks.

### 3.4 A merged part changes without a sketch - unverified (L2493, L2497, L763)

- **Pain:** the agent changed an accepted part directly. Tom saw it only later.
- **Now:** the rule says each change to a merged part is a sketch, with one variant if there is no
  choice. The skill has the rule.
- **Fix done (`e554d1297`):** a merge records the folder hash in `<product>/merged.json`. The
  command `design check` warns, and Studio shows a "changed" badge, when the hash differs and no
  open sketch holds the part. The next merge of a sketch clears the flag.
- **Limit:** parts merged before this change have no record until their next merge.
- **Open:** check the badge in the running app. Decide (Tom) on its look.

### 3.5 Rounds cannot be edited after creation - fixed (L1514, L1520)

- **Pain:** no command changes the title or note of a round. `sketch list` does not show rounds.
- **Fix done (`987871473`):** `sketch round <sketch> <round> --title --note`. `sketch list` shows
  the rounds.

### 3.6 A merge silently drops states of the part - fixed option 1, unverified (`e26e219ca`)

- **Pain:** Tom merged variant g of `pages/sketches`. The page lost its states `open` and
  `page-sketch`, and the live canvas camera (`mountCanvasViewport`). Only `zoomed-page` is left.
  Neither Studio nor the CLI warned before the merge.
- **Cause:** a merge copies the variant folder over the part, as designed. The variants of this
  sketch held only the state under discussion. Their `sketches.ts` was a new mock, not the product
  page with one state changed. A variant cannot change one state and keep the others.
- **Now:** nothing. The loss shows only after the merge.
- **Fix options:**
  1. `sketch check` and `sketch ready` fail when a variant has fewer states than the part, unless
     the round says it removes them.
  2. The merge preview in Studio lists states that the merge removes, and asks before it merges.
  3. A variant can change one state of a part and inherit the other states from the product.
- **Fix done (`ed59b5f18`):** option 1 without the opt-out. `sketch check` and `sketch ready` fail
  with a `STATES` problem for each part of a variant that drops a state the product's part has. The
  problem also shows in Studio's sketch problems. A new part has nothing to compare.
- **Opt-out done (`159eeeef3`):** `sketch round <part> <round> --drops <state,state>` names the states
  a round removes on purpose. `STATES` then skips them for the variants of that round.
- **Used (`6f6032799`):** round r3 of `pages/sketches` dropped `open` and `zoomed-below` with
  `--drops`. Check passed, and Tom merged it in Studio without a problem.
- **Open:** check the problem in the running Studio.

### 3.7 A new sketch opens with its only round folded - fixed, unverified (`b7fa2c621`)

- **Pain:** a new sketch on `pages/sketches` opened with its only round folded. The user saw only
  the current column and no variants. Studio had remembered the open and folded rounds of the
  sketch before it on the same part, which had a folded `r1`.
- **Where:** Studio remembers the round flags by part, not by sketch. A new sketch starts at `r1`
  again and found the old `r1: false`.
- **Now:** the flags are stored with the time the sketch was created and used only for that sketch.
  Flags stored without it are ignored.
- **Fix done (`b7fa2c621`):** fixed, unverified. Check it with a new sketch on a part whose last sketch
  had a folded round.

### 3.8 A variant stylesheet edit marks every state as changed - open

- **Pain:** a variant of `pages/sketches` changed the part's `sketches.css` for one new state.
  Studio then showed every state of every variant as changed, 16 screens. Tom: "totally
  overwhelming".
- **Cause:** all states of a part share one stylesheet. The change check compares a state's render
  inputs, so a stylesheet edit counts as a change in every state.
- **Now:** a workaround by convention. A variant puts its CSS in its own file (`below.css`) and
  imports it only in the render function of the state under discussion. Check with
  `curl -s "http://localhost:4402/__design/sketches?product=studio"`: each variant must list the
  other states under `unchanged`.
- **Fix options:**
  1. Compare the rendered shot of each state, not its inputs. A stylesheet edit without visible
     effect then changes nothing.
  2. `sketch check` warns when a variant edits a stylesheet that more states than the round's
     state use.

### 3.9 `sketch variant` adds an answer to comments to the running round - open

- **Pain:** the agent answered two comments on g with variant h. The CLI put h into the running round
  r4 without a question. Tom: "why is this not a new round?"
- **Now:** a new round opens only with `--round`. Nothing tells the agent that comments arrived
  since the last `sketch ready`.
- **Fix option:** `sketch variant` fails without `--round` when comments on the sketch arrived after
  the last `ready`. It names the comments.

### 3.10 A merge leaves sibling states with the old design - open

- **Pain:** Tom merged variant i of `pages/sketches`. It gave the header of state `zoomed-below` no
  status badge and a muted round select close under the title. State `zoomed-page` of the same page
  kept the old header, with the badge and the round line at 68 px. Tom found it after the merge:
  "this now has weird spacing". A second sketch was needed.
- **Cause:** the rule "a variant changes only the state the question is about" protects Tom from a
  wall of changed screens. However, a decision about shared chrome, for example the header, applies
  to every state that draws it. Neither the agent nor the tool compared the sibling states.
- **Repeat:** the agent then fixed only `zoomed-page`. `open` and `page-sketch` still had the badge,
  the bold static round line and a teal "Verwerfen". Tom: "there are even more diffs between the
  sketches views". The agent had compared two states, not all four.
- **Now:** nothing. The mismatch shows only when Tom opens the other state.
- **Fix options:**
  1. The merge preview in Studio shows each unchanged state next to the changed one, so a mismatch
     is visible before the merge.
  2. The round note names which states the decision applies to. `sketch ready` warns when a named
     state is unchanged.

### 3.11 A new sketch shows the comments of an old sketch - fixed

- **Pain:** a new sketch on `pages/sketches` showed many old comments in its variant a. Tom: "there
  are now many old comments in the sketch visible".
- **Cause:** a comment stores its sketch as `{ target, variant }` only. Variant letters start at `a`
  again in each sketch, so the 8 comments on variant a of the sketch of 2026-10-28 match the new a.
- **Now:** nothing separates them. The same bug class as 3.7, where round flags were keyed by part.
- **Fix option:** store the sketch's `createdAt` in the comment, as the 3.7 fix does for round
  flags. Show a comment only in the sketch it was made in. Comments without it stay hidden in a
  sketch.
- **Seen again (2026-10-29):** the empty-state sketch on `pages/flows` showed the three addressed
  round-2 comments (pins 32, 33, 34) of the merged flows sketch on its new variant a.
- **Now:** the CLI stamps the sketch's `createdAt` into each new comment on a variant. Studio pins and
  tree marks show a comment only in the sketch with that `createdAt`, so older comments stay hidden.

### 3.12 `inbox done --note` overwrites the part note in the product - open

- **Pain:** an agent closed a comment on a sketch variant with
  `design inbox done <id> --note "Variante c"`. The command replaced the whole `note` of the product
  part `pages/sketches` with "Variante c". Studio then said the product changed since the sketch
  was made, and asked for a rebase.
- **Cause:** `done` writes `--note` into the part the thread is about. The thread was about a sketch
  variant, but the command wrote into the product, not into the variant. The flag name reads like a
  short closing remark, and `sketch round --note` and `sketch variant --note` use it that way.
- **Now:** the agent restored the product note by hand.
- **Fix options:**
  1. For a thread on a sketch variant, write the note into that variant, never into the product.
  2. Rename the flag to `--part-note`, and add a separate `--reason` for the closing remark.
  3. Fail when the new note is much shorter than the old one, unless `--force` is given.

### 3.13 No way to accept a direct edit the user approved - open

- **Pain:** Tom approved a cleanup of `pages/sketches` without a sketch (dead code removed, 0 changed
  pixels in both states). After the commit, `design check` warns `pages/sketches changed outside a
sketch` until the next merge of the part.
- **Cause:** the check compares the part folder with the hash in `merged.json`. Only a merge writes
  that hash. A one-variant sketch needs the product folder back at HEAD first, which is extra work
  for a change that does not change the drawing.
- **Now:** the warning stays (Tom chose this). Editing `merged.json` by hand would record a merge
  that did not happen.
- **Fix options:**
  1. `design accept <part> --by <model id> --note <why>`: write the new hash and log who approved the
     direct edit.
  2. `sketch new --from-tree`: open a one-variant sketch from the working tree and restore the
     product, so the normal merge path covers the edit.

### 3.14 The states of a page drift apart - open

- **Pain:** the states of `pages/sketches` showed the same chrome in different ways. The variant
  heads had other font sizes, another Merge position and a "Gemergt" label in one state only. In
  `zoomed-page` the head of variant b had no agent and no subline. Tom found each difference by eye,
  one sketch at a time.
- **Cause:** each state draws its own markup. `page-sketch` builds its heads from `PAGE_VARIANTS`
  with `sk-variant-head`; `zoomed-page` writes them by hand with `zc-attached`. The workflow makes it
  worse: a round changes only the state of its question (the rule against a wall of changed screens),
  so a decision lands in one copy and the other copies keep the old look. 3.10 is one case of this.
- **Now:** nothing finds it. Only Tom's eye compares the states.
- **Fix options:**
  1. A state is data, not markup: every state of a page calls the same render with other props, so
     shared chrome exists once.
  2. Shared chrome that more states draw becomes an element of its own early, before the page has
     more than one state. This conflicts with "draw pages first, extract later" (section 6) and needs
     Tom's decision.
  3. `design check` compares a region that more states mark as shared (for example `data-shared="head"`)
     and warns when its computed styles differ between states.

### 3.15 A sketch shows the states it does not change - open

- **Pain:** the sketch "Leerer Flows-Bereich mit Anleitung" changes only the `empty` state of
  `pages/flows`. Studio also draws the `flow` state in current, a and b, three identical frames.
  Tom: "since we only worked on the empty state why is the flow design showing".
- **Cause:** a variant must keep every state of the part (`sketch check` and `sketch ready` fail on
  a dropped state), and Studio draws every state of every variant.
- **Now:** Tom compares identical frames to find the one state that changed.
- **Fix options:**
  1. Studio compares the drawn markup of a state with current and folds an unchanged state into one
     collapsed row, "flow: unchanged in a, b".
  2. The sketch names the states of its question (`sketch new --states empty`). Studio draws those
     first and puts the rest behind a toggle.

### 3.16 A sketch on a merged part copies its `shared/` into each variant - open

- **Pain:** the empty-state sketch on `pages/flows` got `a/pages/flows/shared/flow-data.ts` and
  `b/pages/flows/shared/flow-data.ts`, two copies. A change to common code had to go into both.
- **Cause:** a merge moves the sketch's `shared/` into the part folder (`pages/flows/shared/`, imported
  relatively). `sketch new` then copies the whole part folder into each variant.
- **Now:** this breaks the rule "common code goes in the sketch's `shared/`, never into copies per
  variant".
- **Fix option:** `sketch new` moves the part's `shared/` back into the sketch's `shared/` and rewrites
  the imports to `@shared/`, the reverse of the merge.

## 4. Render checks and shots

### 4.1 The render check fails in the sandbox - fixed (L2586)

- **Pain:** `listen EPERM ::1:5173`. The failure looks like a drawing failure.
- **Now:** run the check outside the sandbox.
- **Fix done (`41bc90f74`):** `EPERM` and `EACCES` give a permission error, not a drawing error.

### 4.2 Checks pass, but the design is wrong - fixed (L2560, L2623, L2720)

- **Pain:** the render checks passed on a blank band and on wrong zoom states. Geometry checks
  cannot judge whitespace or composition.
- **Now:** the review needs a screenshot at an intermediate zoom (L2921).
- **Fix done:** `et design shot` (4.6).

### 4.3 A broken shot looks like a normal image - fixed (L912, L814)

- **Pain:** `/__design/shot` returns status 200 with text in a `.png` after a 30 s timeout. A build
  error shows the Vite overlay as the shot.
- **Fix done (`2d10626fe`, `41bc90f74`):** zero size gives 422, a timeout gives 504, a Vite
  overlay gives 422 with the build message. The overlay case has no browser test.

### 4.4 Skip rules and empty states give wrong results - fixed (L1000, L1003)

- **Pain:** `checks.skip` uses the part as the only key, so the last variant wins. The empty
  `default` state of a scaffold reports ZERO-SIZE, and `sketch report` prints nothing.
- **Fix done (`48a1c9a79`):** skips are kept per product, sketch and variant. The scaffold draws a
  label, so the `default` state has a size.

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

### 4.8 A scaled `embedPage` fails the CLIPPED rule - open

- **Pain:** every Flows variant shows pages through `embedPage(..., { scale })`. The check reported
  `CLIPPED ... content 1440x900 in 288x180` on the embed box, so each variant needs
  `checks: { skip: ['CLIPPED'] }`. That skip also hides a real clip anywhere else in the page.
- **Cause:** `embedPage` wraps a scaled iframe in `[data-et-embed-box]` with `overflow: hidden`, and
  the rule measures the unscaled iframe.
- **Fix option:** the CLIPPED rule ignores `[data-et-embed-box]`, or measures the scaled size.

## 5. Drawing parts and pages

### 5.1 Page sketches cannot use Tailwind - unverified (L2797)

- **Pain:** the app uses Tailwind, but the sketches use plain CSS. The design server has a
  Tailwind 4 pipeline, but `styles.css` uses `source('../')`, so it does not scan the sketch
  folder.
- **Fix done (`f27c66d0e`):** `.ethlete/design/studio/styles.css` imports the app styles and
  registers the folders with `@source`. A spec checks that a utility compiles.
- **Open:** check a utility in a live sketch frame, and that the app `styles.css` loads one time.

### 5.2 Sketches cannot share code - unverified (L949, L998, L996)

- **Pain:** a variant cannot import a sibling, and a page cannot import a page. The agent copies
  data between variants.
- **Fix done (`4927aeac8`):** all three. A sketch `shared/` folder imported as `@shared/...` (a
  merge copies it into the part), `sketch new --like`, and `embedPage()`.
- **Open:** nobody ran them on a live design server.

### 5.3 Editor and typecheck gaps - fixed (L833, L1009, L975)

- **Pain:** the editor shows errors on `@design-system` and `@system/*`. `design check` and
  `sketch check` use different typecheck paths. ESLint skips `libs/cli/design/`.
- **Fix done (`d761ddd93`, `9b7358d94`):** the server and `design check` write gitignored editor
  tsconfigs. One typecheck path. ESLint covers `libs/cli/design/`.

### 5.4 CLI usage text is wrong - fixed (L790, L793, L1014)

- **Pain:** usage lines print `yarn et ...`, which fails here. An unknown subcommand gives no
  error. `sketch variant --round` does not show the notes of the previous round. `sketch report`
  needs `--product` with one open sketch.
- **Fix done (`987871473`):** the prefix is `yarn design`. An unknown command exits 2 with the
  usage. `--round` prints the notes of the previous round.

### 5.5 Wireframe kit gaps - partly fixed, decision open (L742-L1036)

- **Pain:** drawing agents fought the kit more than the structure questions (L805). Missing:
  dividers, alignment, per-side padding, list rows, avatars, some glyphs. `fill` uses `100vh`.
- **Fix:** add the missing pieces / decide if wireframes are worth the cost (L805).

### 5.6 `design sketch report` fails outside the repository root - fixed

- **Pain:** a report from inside a sketch folder failed with `no config at
<cwd>/.ethlete/design/config.json`. The report did not land.
- **Fix option:** look for `.ethlete/design/config.json` in the parent folders, as git does.
- **Now:** fixed in 7f42e56f3; every command walks up to the nearest `.ethlete/design/config.json`.

### 5.7 A foundation cannot give its pieces to a page - open

- **Pain:** `pages/start` needs the Studio mark. `foundations/logo` draws it, but only as the
  `sizes` and `sidebar` states. The page copied the SVG, and `shell-main` holds a third copy.
- **Cause:** a part exports one `render`; nothing exports a piece of a part.
- **Fix option:** let a part file export named helpers that other parts may import, or extract
  the mark into an element.

### 5.8 `sketch new` for a page writes a bare scaffold - fixed

- **Pain:** the scaffold for `pages/start` held a `start.css` with a `.start` class, no `madeBy`,
  no `widths` and an empty `note`. Every page in studio uses Tailwind and the tokens instead.
- **Fix option:** scaffold a page like its siblings: tokens import, `madeBy` from `--by`, the
  product widths, and no CSS file.
- **Now:** fixed in 8c71b5712; a page scaffold has the tokens import (when the product has `foundations/tokens`), `madeBy`, the preset widths and no CSS file.

### 5.9 A Prettier run after a merge counts as a change outside a sketch - fixed

- **Pain:** `pages/start` merged unformatted, so `prettier --check` failed. After `prettier --write`,
  `design check` warns `pages/start changed outside a sketch`.
- **Cause:** `sketch check` and `sketch ready` do not check the format, and the merge hash covers
  the raw file text.
- **Fix option:** format the variant files at `sketch ready` or at the merge, or hash the
  formatted text.
- **Now:** `sketch check` and `sketch ready` run the checkout's own Prettier over each variant and fail
  with `FORMAT` per unformatted file.

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

1. Merge preview, after a restart that rebuilds the CLI (L1464).
2. The status-watch reload with `et design sketch report` (L1918).
3. The `stale` footer (L1980).
4. The merge and rebase UI, headless (L363).
5. Shot size against live size on Tom's HiDPI window (L1214).
6. Round d on macOS WebKit, at 800%, and on touch (L2792).
