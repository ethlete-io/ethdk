# Ethlete Studio - fixed pain points from the self-test

The fixed entries of `design-system-actions.md`, with their numbers kept. `Lnnn` is a line in
`design-system.md`.

## 1. Studio app (native and WebKit)

### 1.4 The WebKit reload script cannot narrow a hang - fixed

- **Pain:** `verify-webkit-frame-reloads.swift` prints only every tenth batch, without time, and the
  FAIL line does not name the last batch.
- **Fix option:** print each batch with a timestamp, and name the last batch in the FAIL line.
- **Checked 2026-10-29:** fixed by the script change in `2d3e44cae`.

## 2. Review on the canvas

### 2.4 Outlines and pins are clipped - fixed (L2773, L2876)

- **Pain:** the Merge button outline, the frame edges and a comment pin were cut off.
- **Fix done:** a contour gutter in round e.
- **Fix done (`48a1c9a79`):** `data-et-skip="CLIPPED"` skips one element. Only `.sk-crop` has it
  now. The archived variants in `sketches/pages-sketches/*` keep the old page skip.
- **Option:** include focus rings and painted bounds in the geometry check.

### 2.5 Double-click on a frame did nothing - fixed (L2818)

- **Pain:** pointer capture lost the target of the double-click.
- **Fix done:** the canvas remembers the frame of the pointerdown.

### 2.7 The newest round is dimmed while in progress - fixed (L978)

- **Pain:** the agent cannot judge the newest round in its context.
- **Fix done:** the dim is a Studio overlay. `et design shot` draws undimmed, and the skill says so.

### 2.1 Each sketch builds its own camera - fixed (L2595, L2940)

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
- **Check (2026-10-29, headless Chromium):** verified on the app canvas and the sketch drawing. Two
  differences: a plain drag pans only in the drawing; double-click activates a frame in the app but
  zooms it in the drawing. Trackpad and the real Tauri window not checked. Move to fixed.
- **Checked 2026-10-29:** verified on the app canvas and the sketch drawing; see the check above.

### 2.3 Zoom breaks the sketch layout - fixed (L2737, L2748, L2763, L2921)

- **Pain:** at 100% the full drawing was offscreen. At high zoom the variant heads stretched past
  the viewport. The first fit measured a header that was not stable yet.
- **Now:** round d anchors the focused frame and clamps the heads. Round e reopened the heads.
- **Fix done (`b9ebae71d`):** camera targets `all`, `focused` and `visible`. The viewport fits
  again after the layout is stable. In the app, 100% now anchors a frame at the top-left.
- **Check (2026-10-29):** verified at fit, 100%, 296% and 800% on `page-sketch`; `zoomed-page` not
  run. Move to fixed.
- **Checked 2026-10-29:** verified at fit, 100%, 296% and 800%; see the check above.

## 3. Feedback, rounds and merge

### 3.3 Two sources disagree on who merges - fixed (L1041, L1770)

- **Pain:** the inbox and the skill give different steps after a pick.
- **Now:** Studio writes the decision, and the agent runs `sketch merge`.
- **Fix done (`3504d8352`):** Studio merges with its Merge button. The inbox and the skill tell
  the agent not to run `sketch merge`. Pick and Merge are still two clicks.

### 3.5 Rounds cannot be edited after creation - fixed (L1514, L1520)

- **Pain:** no command changes the title or note of a round. `sketch list` does not show rounds.
- **Fix done (`987871473`):** `sketch round <sketch> <round> --title --note`. `sketch list` shows
  the rounds.

### 3.8 A variant stylesheet edit marks every state as changed - fixed

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
- **Fixed by 3.15:** a state with the same body and other styles now folds when each frame draws the
  same pixels. The `below.css` convention is no longer needed.

### 3.9 `sketch variant` adds an answer to comments to the running round - fixed

- **Pain:** the agent answered two comments on g with variant h. The CLI put h into the running round
  r4 without a question. Tom: "why is this not a new round?"
- **Fix options:** fail on open comments / fail plus a `--same-round` opt-out / fail only on comments
  after a stored `readyAt` / warn only. Tom chose the first.
- **Fix done:** `sketch variant` without `--round` fails while the sketch has open comments. The error
  lists each comment with its variant and text, and gives the `--round` command. A variant that
  answers none of them closes them first with `inbox done`. The design-exploration skill says so.

### 3.10 A merge leaves sibling states with the old design - fixed

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
- **Decision (Tom, 2026-10-29):** solved through 3.14 option 1.
- **Fix done (`434a38b1c`):** every state of `pages/sketches` renders through one function with
  per-state props. Copies across pages remain (empty-state card, page title, `agent-logos.ts`).

### 3.14 The states of a page drift apart - fixed

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
- **Decision (Tom, 2026-10-29):** option 1. Every state calls the same render with other props.
- **In progress:** one-variant sketch on `pages/sketches` is ready for Tom. The audit found the other
  pages clean. Copies across pages remain: the empty-state card (system, flows, start), the page
  title, and `agent-logos.ts` (inbox, sketches).
- **Fix done (`434a38b1c`):** every state of `pages/sketches` renders through one function with
  per-state props. Copies across pages remain (empty-state card, page title, `agent-logos.ts`).

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

### 3.12 `inbox done --note` overwrites the part note in the product - fixed

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
- **Now:** `done` on a sketch thread writes the note into the variant's copy of the part. It never touches the product. If the variant does not hold the part, no part file changes and the comment is only addressed.

### 3.13 No way to accept a direct edit the user approved - fixed

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
- **Decision (Tom, 2026-10-29):** option 1, `design accept`.
- **Fix done (`382320daf`):** `design accept` writes the hash into `merged.json` and logs who and
  why in `accepted.json`. It refuses an unknown part, an open sketch and a part without a change.

### 3.15 A sketch shows the states it does not change - fixed

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
- **Now:** option 1 existed, but it compared the styles of the whole part, and the variant added
  `emptyStyles` to every state. A state with the same body and other styles now folds when each frame
  draws the same pixels in the default theme.

### 3.16 A sketch on a merged part copies its `shared/` into each variant - fixed

- **Pain:** the empty-state sketch on `pages/flows` got `a/pages/flows/shared/flow-data.ts` and
  `b/pages/flows/shared/flow-data.ts`, two copies. A change to common code had to go into both.
- **Cause:** a merge moves the sketch's `shared/` into the part folder (`pages/flows/shared/`, imported
  relatively). `sketch new` then copies the whole part folder into each variant.
- **Now:** this breaks the rule "common code goes in the sketch's `shared/`, never into copies per
  variant".
- **Fix option:** `sketch new` moves the part's `shared/` back into the sketch's `shared/` and rewrites
  the imports to `@shared/`, the reverse of the merge.
- **Fix done:** `sketch new` (also with `--like` on a merged part) moves the part's `shared/` into
  the sketch's `shared/` and rewrites the relative imports to `@shared/`. A spec checks it.

### 3.1 A new round resolves the comments too early - fixed (L2648)

- **Pain:** when a feedback round starts, the source comments resolve before the new round exists.
  Tom cannot see which comments are really done.
- **Fix done (`3504d8352`):** a round, merge, discard or `inbox done` marks a comment "addressed".
  Only Tom resolves it in Studio. Old files read as addressed.
- **Checked 2026-10-29:** verified. `sketch variant --round` addresses the comments of lost variants with round r2 and keeps the comment of the surviving variant open. A merge addresses with reason "merge". The Studio badge was not looked at.

### 3.2 Tom withdraws his own comments before a merge - fixed (L1047, L1011)

- **Pain:** open comments block the merge, and the pick does not close them. The agent cannot
  reply to a resolved comment to say what it changed.
- **Fix done (`3504d8352`):** comments do not block a merge. The agent can reply to an addressed
  comment. A reply by Tom opens it again.
- **Checked 2026-10-29:** verified. An open comment does not block a merge. `comment reply --by` works on an addressed comment, and a user reply opens it again.

### 3.4 A merged part changes without a sketch - fixed (L2493, L2497, L763)

- **Pain:** the agent changed an accepted part directly. Tom saw it only later.
- **Now:** the rule says each change to a merged part is a sketch, with one variant if there is no
  choice. The skill has the rule.
- **Fix done (`e554d1297`):** a merge records the folder hash in `<product>/merged.json`. The
  command `design check` warns, and Studio shows a "changed" badge, when the hash differs and no
  open sketch holds the part. The next merge of a sketch clears the flag.
- **Limit:** parts merged before this change have no record until their next merge.
- **Checked 2026-10-29:** verified. `design check` warns "changed outside a sketch" and Studio shows "changed". Both are off while a sketch is open.

### 3.6 A merge silently drops states of the part - fixed (`e26e219ca`)

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
- **Checked 2026-10-29:** verified. A dropped state fails `sketch check` and `ready` with `STATES`, and Studio shows it. `sketch round r1 --drops` clears it.

### 3.7 A new sketch opens with its only round folded - fixed (`b7fa2c621`)

- **Pain:** a new sketch on `pages/sketches` opened with its only round folded. The user saw only
  the current column and no variants. Studio had remembered the open and folded rounds of the
  sketch before it on the same part, which had a folded `r1`.
- **Where:** Studio remembers the round flags by part, not by sketch. A new sketch starts at `r1`
  again and found the old `r1: false`.
- **Now:** the flags are stored with the time the sketch was created and used only for that sketch.
  Flags stored without it are ignored.
- **Fix done (`b7fa2c621`):** fixed, unverified. Check it with a new sketch on a part whose last sketch
  had a folded round.
- **Checked 2026-10-29:** verified. The folded round of another sketch is ignored, and a matching `roundsFor` folds.

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

### 4.8 A scaled `embedPage` fails the CLIPPED rule - fixed

- **Pain:** every Flows variant shows pages through `embedPage(..., { scale })`. The check reported
  `CLIPPED ... content 1440x900 in 288x180` on the embed box, so each variant needs
  `checks: { skip: ['CLIPPED'] }`. That skip also hides a real clip anywhere else in the page.
- **Cause:** `embedPage` wraps a scaled iframe in `[data-et-embed-box]` with `overflow: hidden`, and
  the rule measures the unscaled iframe.
- **Fix option:** the CLIPPED rule ignores `[data-et-embed-box]`, or measures the scaled size.
- **Fix done:** the rule measures the scaled iframe inside `[data-et-embed-box]`. A spec checks a
  scaled embed that fits and one that clips.
- **Open:** `pages/flows` still has `checks: { skip: ['CLIPPED'] }`. Take it out with a one-variant
  sketch.

### 4.9 A failed shot answers 200 with a picture of the error - fixed

- **Pain:** on 2026-10-29 every shot on :4402 failed with "Failed to fetch dynamically imported
  module", also for merged pages. The endpoint answered HTTP 200 with a PNG of the error text, so a
  plain `curl` looked like it worked.
- **Fix options:** answer 5xx for a failed state, or add an `X-Design-Error` header.
- **Fix done (`070a374f1`):** a failed state answers 500 with the error PNG; the contact sheet
  shows the error text.

### 4.10 `preset` and `width` together give a 400 that is easy to miss - fixed

- **Pain:** the agent brief passed `preset=desktop&width=1440`; the endpoint refused with 400. With
  `curl -s` the agent saw nothing.
- **Fix options:** accept the pair when the width matches the preset, or name the rule in the
  skill's shot command.
- **Fix done (`070a374f1`):** a width equal to the preset's width is accepted; a mismatch names both.

### 4.11 `sketch check` prints only `ok` - fixed

- **Pain:** the output does not name the states it rendered, so an agent cannot tell what passed.
- **Fix option:** one line per variant and state, with the result.
- **Fix done (`070a374f1`):** one line per variant and state, then the issues and `ok`.

### 4.13 A second design server breaks the first through the shared Vite cache - fixed

- **Pain:** on 2026-10-29 Tom's :4402 failed every page with "Failed to fetch dynamically imported
  module"; `@design-system.js` answered 504 (Outdated Optimize Dep).
- **Cause:** a subagent's design server on a scratch checkout shares `node_modules` by symlink, and
  `serve.ts` sets `cacheDir` to `<work root>/vite` under `node_modules/.design-explore`. The second
  server rewrote the deps of the first.
- **Now:** restart :4402.
- **Fix options:** a Vite cache folder per server (per pid or per hashed target path).
- **Fix done (`5eb5fff4c`):** each server gets a cache folder named by a hash of its resolved target path.

### 4.14 No merged and variant cells side by side in one sheet - fixed

- **Pain:** `design shot --variants --state X` draws only the variant cells; a comparison needs two
  runs and a manual diff.
- **Fix option:** draw the merged state as the first cell.
- **Fix done (`0a97acb2c`):** `design shot --variants` draws a `merged` row first.

## 5. Drawing parts and pages

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

### 5.6 `design sketch report` fails outside the repository root - fixed

- **Pain:** a report from inside a sketch folder failed with `no config at
<cwd>/.ethlete/design/config.json`. The report did not land.
- **Fix option:** look for `.ethlete/design/config.json` in the parent folders, as git does.
- **Now:** fixed in 7f42e56f3; every command walks up to the nearest `.ethlete/design/config.json`.

### 5.7 A foundation cannot give its pieces to a page - fixed

- **Pain:** `pages/start` needs the Studio mark. `foundations/logo` draws it, but only as the
  `sizes` and `sidebar` states. The page copied the SVG, and `shell-main` holds a third copy.
- **Cause:** a part exports one `render`; nothing exports a piece of a part.
- **Fix option:** let a part file export named helpers that other parts may import, or extract
  the mark into an element.
- **Decision (Tom, 2026-10-29):** a part file may export named helpers that other parts import.
- **Fix done (`9bb1fb247`):** the CLI already allowed named exports. Specs now lock it in, and the
  skill says to import a piece instead of copying it.
- **Open:** `foundations/logo` keeps the mark private. A sketch on logo exports it as `studioMark`.
  Then sketches on `pages/start` (line 11) and `elements/shell-main` (line 35) import it.

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

### 5.10 Two stylesheets of one part define the same class without a warning - fixed

- **Pain:** `sketch-data.css` still defines `.sk-head`; a new `.sk-head` in the variant broke the
  layout silently.
- **Fix option:** `sketch check` warns when two stylesheets of one part define the same class.
- **Fix done (`5aa652f54`):** `sketch check` and `ready` warn on a class defined in two stylesheets of a part.

### 5.11 `sketch new --round` asks for `--note` before any work exists - fixed

- **Pain:** the agent wrote a placeholder note and fixed it later with `sketch round`.
- **Fix option:** make `--note` optional on `sketch new`; require it at `sketch ready`.
- **Fix done (`1f5daef48`):** `sketch new --round` needs no note; `sketch ready` refuses a round without one.

### 5.1 Page sketches cannot use Tailwind - fixed (L2797)

- **Pain:** the app uses Tailwind, but the sketches use plain CSS. The design server has a
  Tailwind 4 pipeline, but `styles.css` uses `source('../')`, so it does not scan the sketch
  folder.
- **Fix done (`f27c66d0e`):** `.ethlete/design/studio/styles.css` imports the app styles and
  registers the folders with `@source`. A spec checks that a utility compiles.
- **Checked 2026-10-29:** verified. Tailwind arbitrary classes compute in a variant frame, and one Tailwind style loads.

### 5.2 Sketches cannot share code - fixed (L949, L998, L996)

- **Pain:** a variant cannot import a sibling, and a page cannot import a page. The agent copies
  data between variants.
- **Fix done (`4927aeac8`):** all three. A sketch `shared/` folder imported as `@shared/...` (a
  merge copies it into the part), `sketch new --like`, and `embedPage()`.
- **Checked 2026-10-29:** verified. An `@shared/` import renders, a merge copies `shared/` and rewrites the import, `sketch new --like` copies `shared/`, and `embedPage` renders.

### 1.3 The design server listens on `[::1]` only - fixed

- **Pain:** the Mac test needed a hand-made TCP forwarder to reach the design server over the LAN.
- **Fix option:** a `--host` option (or `DE_HOST`) passed to Vite's `server.host`.
- **Fix done (`104598751`):** `yarn design --host <address>` or `DE_HOST` goes to Vite `server.host`. The default is unchanged.
- **Checked 2026-10-29:** the spec bites (it fails with the host line removed). `--help` shows the option.

### 3.17 A pure refactor sketch still waits for a manual merge - fixed, open points

- **Pain:** the `foundations/logo` sketch (export `studioMark`, no visible change) showed every state
  as "unchanged in a" with empty dashed rows. Tom had nothing to judge but had to merge.
- **Fix done (`f5ad82acd`):** option 1. `sketch ready` compares every state of every variant with the
  product part. Same markup and styles count as unchanged. Same markup with other styles is compared
  pixel-exact. Other markup is always a change. With no change, it merges the first variant through
  the normal merge and writes an `auto: true` entry to the `accepted.json` of the product.
- **Checked 2026-10-29:** real CLI on a scratch copy of the `foundations/logo` sketch. No change: "No visible
  change in any state: merged foundations/logo automatically." and the `auto` entry. With `rx="8"`
  changed to `rx="2"`, the sketch stays `ready`.
- **Open points:**
  - Only the states of the target part are compared, not the pages that use it.
  - A pure markup refactor with equal pixels does not auto-merge.
  - Studio does not show `auto` entries yet.

### 4.12 `design shot` fails on a busy port 5173 and writes nothing - fixed

- **Pain:** `design shot pages/flows --states --variants` printed only `Port 5173 is already in use`
  and exited without a sheet. `check-system.spec` failed the same way in a full `src/lib/design` run.
- **Root cause:** Vite treats `port: 0` as unset and falls back to 5173 with `strictPort`. The port-0
  change of `1902a2675` never worked for the render check, `design shot` and the shots of `sketch ready`.
- **Fix done (`f8d196b15`):** `serve.ts` probes a free port first.
- **Checked 2026-10-29:** full `src/lib/design` run with 5173 held by another process: no port error.
  Full run alone: 72 files, 460 tests pass.

### 5.12 `sketch new` does not print the variant file path - fixed

- **Pain:** the output ended at `... in progress: <dir> with a`. The agent listed the folder to find
  `a/foundations/logo/logo.ts`.
- **Fix done (`7666803d3`):** `sketch new` and `sketch variant` print one line per variant with the part file path.

### 3.18 `sketch report` prints nothing and exits 0 - fixed

- **Pain:** `sketch report` printed nothing and exited 0, also on a `ready` sketch. There it recorded
  a report that Studio never shows.
- **Fix done (`4d9b46aa5`):** it prints `reported on <part> variant <v>: <text>`. On a sketch not in
  progress it records nothing, says why, and exits non-zero.
- **Checked 2026-10-29:** the spec bites: on a sketch not in progress, no report file is written.

### 3.21 `sketch check` blocks `ready` for a comment of a merged sketch - fixed, open points

- **Pain:** a reply by the user reopens a comment on a merged sketch. Then `sketch check` raised
  `COMMENT ... the sketch on pages/start no longer exists - answer or drop the comment`. This blocked
  `ready` on a new sketch of the same part until the user resolved the comment.
- **Fix done (`4ec57e079`):** a comment of a merged, discarded or replaced sketch is a warning, not a
  problem, in `sketch ready`, `sketch check` and `design check`. The message names `comment reply
--by` or a resolve in Studio. Comments of the current sketch fail as before.
- **Open point:** the warning prints once per variant.

### 5.13 No rule for assets (marks, logos, icons, images) - fixed, open points

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
- **Fix done (`5b73392d9`):**
  - `@assets/<file>` looks in the `assets/` of the variant, then of the product, then of the base
    product. The default import is a URL (any file type). `?raw` is text.
  - CSS `url('@assets/...')` works in part stylesheets and in the product `styles.css`.
  - `libs/cli/design/assets.d.ts` types the imports.

### 5.14 A merge can mark unedited parts as "changed outside a sketch" - fixed

- **Pain:** when a merge changes an asset that other merged parts also use, those parts can show
  "changed outside a sketch" although nobody edited them.
- **Where:** `partHashOf` and the "changed outside a sketch" check in `libs/cli/src/lib/design`.
- **Fix options:** (1) a merge re-records the hash of every merged part that uses a changed asset and
  lists them in the merge output; (2) the sketch baseline lists dependent parts, and Studio shows them
  in the merge preview (as for element-in-context). Recommendation: (1) with the list in the output.
- **Fix done (`3c89d65bf`):** option 1. A merge that changes an asset re-records the `merged.json` hash
  of every other merged part that uses it, if that hash matched before the merge, and prints
  `Asset change also updates: <parts>`. A part with a foreign edit still shows "changed outside a
  sketch".
- **Checked 2026-10-29:** the new spec failed against the old `merge.ts` and passes now; 470 design
  specs pass.
  - `design check` flags a missing asset (IMPORT).
  - A merge copies the `assets/` of the variant.
  - `partHashOf` counts the bytes of the assets a part uses. Parts without assets hash as before.
- **Checked 2026-10-29:** 72 spec files / 468 tests pass. `design check --product studio` is ok on the
  real tree (old hashes valid). A scratch run with `design shot` drew a PNG `<img>`, an inline `?raw`
  SVG from `icons/` with `currentColor`, a CSS background PNG, a woff2 from the base product loaded
  through `@font-face` in `styles.css`, and a variant PNG that replaced the product PNG. Merge is only
  checked in specs.
- **Open points:**
  - The `assets/` of a variant does not reach the product `styles.css`.
  - `url(@assets)` in a CSS `@import`-ed sheet is not rewritten.
  - A query or fragment after a CSS asset URL (`#iefix`) is dropped.
  - Assets used only by `styles.css` are in no part hash.

### 3.22 Other whitespace in the markup stops the auto merge - fixed

- **Pain:** the sketch that moves the Studio mark into `assets/studio-mark.svg` draws the same
  mark, but the SVG has other indentation. `sketch ready` (3.17) counts any markup difference as a
  change and compares no pixels, so the sketch stays `ready` and waits for Tom.
- **Where:** `unchangedStatesOf` in `libs/cli/src/lib/design/system/sketch/unchanged-states.ts`.
- **Fix done:** option 1. A markup difference now goes to the pixel compare, the same as a style
  difference. Only body and styles both equal skip the pixels.
- **Also seen:** in the `sidebar` state the active nav item of variant a looked a little lighter
  than merged in `design shot`, with unchanged CSS. Not checked; option 1 would show it.

### 5.15 Assets in a sketch: path, size and format - fixed, one open point

- **Pain:** from the first asset sketch (`foundations/logo`, 2026-10-29):
  - `sketch new` prints the part file path but not that the variant's assets go to
    `<variant>/assets/`. The agent read `assets.ts` to find out.
  - An SVG asset has no size input. `studioMark(size)` replaces `width="32" height="32"` as a
    string, which breaks silently when the attributes change.
  - Prettier has no SVG parser, so an SVG asset is not formatted and not checked.
  - `design shot --states --variants` shows merged and variant rows, but no pixel diff.
- **Fix done:** `sketch new` and `sketch variant` print `assets: <sketch>/<variant>/assets/`, and
  the skill names it. `svgAsset(raw, { size })` from `@design-system` sets `width` and `height` on
  the root `<svg>`. `design check` has a rule `SVG-ASSET` for an SVG without a root `<svg>` or
  without `xmlns`. `design shot --states --variants` adds a row "<cell> vs merged" with changed
  pixels in red, or "no pixel change".
- **Also seen:** the merged `assets/studio-mark.svg` has no `xmlns`, so VS Code cannot preview it.
  `SVG-ASSET` now flags it; a sketch on `foundations/logo` fixes it.
- **Open:** no XML well-formedness check. No XML parser is a dependency of `@ethlete/cli`, and the
  check rules are synchronous.

### 3.23 A problem in another part stops the auto merge - fixed

- **Pain:** `sketch ready pages/start` showed no visible change, but did not merge: "the check
  failed after the merge". The only problem was `SVG-ASSET` on the merged
  `assets/studio-mark.svg`, which the sketch does not touch. A problem that was there before the
  merge blocks every auto merge until another sketch fixes it.
- **Where:** the check after the auto merge (3.17) in `libs/cli/src/lib/design/system/sketch/`.
- **Fix done:** a merge restores the old files only on problems it adds; older ones print as
  `NOTE (was there before)`. `sketch ready` on a `ready` sketch runs the unchanged check and the
  auto merge again. Real case: `pages/start` then merged automatically.
- **Was:** block only on problems the merge adds. Compare the problem list before and after
  the merge, and print the old ones as a note.
- **Also:** after the problem was fixed, a second `sketch ready pages/start` printed "ready, not
  in progress" and did not try the auto merge again. Let `sketch ready` on a `ready` sketch run the
  unchanged check again.
- **Open:** the merge failure message does not name the problem. `sketch check` and `sketch ready`
  have no `--root`, so a scratch copy of `.ethlete/design` cannot be tested.

### 3.19 The merge preview compare grid is unreadable and slow - fixed, one open point

- **Pain:** the compare grid of the merge preview fits at 3-4% zoom, and the text is not readable.
  "Comparing…" ran over 25 s on a sketch whose change touches five parts.
- **Where:** the merge preview in `sketch-view.component.ts` (`apps/ethlete-studio`).
- **Fix done:** the preview opens fitted to its first changed row (`fitTo` on the design canvas);
  Fit still shows the whole column. While it compares, Studio shows the part count and the seconds so far.
- **Cause of the 25 s:** not the compare. One shared Chromium draws all shots in one serial queue
  (`createDrawQueue` in `libs/cli/src/lib/design/thumb.ts`). 22 cold pictures took 3.5 s; behind 42
  queued shots, 9.9 s. See 4.12.
- **Was:** fit to the first changed row, not to the whole column. Show progress while it
  compares.

### 2.7 "used in" lists every page for a part that every page uses - fixed, one open point

- **Pain:** on `foundations/tokens`, the "used in" row draws one frame for each page (`flows`,
  `inbox`, `sketches`, `start`, `system`). Every page reaches the tokens, so the row tells
  nothing and makes the canvas longer (Tom, 2026-10-29).
- **Where:** `usedInOf` in `libs/cli/src/lib/design/system/list-system.ts` (static import reach),
  and the `used in` row in `apps/ethlete-studio/src/app/system-view/system-tree.ts`.
- **Agreed fix:** when every page uses the part, draw no frames and show one label "used in all N
  pages". Keep the frames when only some pages use it.
- **Fix done:** in `framesOf` (`system-tree.ts`), when a product has more than one page and every
  page uses the part, the row label is "used in all N pages" and the row holds one dashed `empty`
  cell. With one page, the frame stays.
- **Open:** the canvas draws a row label only from a frame, so the row needs the placeholder cell.
  A label-only row needs a canvas change. Not checked visually.

### 4.12 One serial draw queue for every shot - fixed, open points

- **Pain:** the merge compare, canvas shots and thumbnails share one Chromium and one queue
  (`createDrawQueue` in `libs/cli/src/lib/design/thumb.ts`). A compare waits behind every queued
  thumbnail, so "Comparing…" can run 25 s for 3.5 s of work.
- **Fix options:** a priority lane for the compare; or two or three pages in parallel; or drop
  queued thumbnails that are no longer on screen.
- **Fix done:** a priority lane in `createDrawQueue`. Every `pictureOf` call (merge compare, merge
  preview, shot commands) and every `/__design/shot` without `priority=low` is high. Studio's canvas
  images send `&priority=low`. A high request for a shot that waits in the low lane promotes it.
- **Open:** the frame in view still waits behind off-screen frames, because Studio loads every
  canvas `<img>` at once; lazy loading would fix it. An aborted request does not drop its queued
  thumbnail. Not measured again after the fix.

### 5.17 Each part adds the product tokens to its own CSS - fixed

- **Pain:** `shell-main`, `part-tree`, `canvas-frames` and `pages/start` each import
  `@system/foundations/tokens.css?inline` and write `styles: tokens + styles`. `pages/system`
  composes three of them and gets the token CSS three times. A new part without the import draws
  unresolved `var(--…)` in its own frame, but resolves them inside a page.
- **Fix option:** the frame loads the product tokens one time; parts stop importing them. Then
  "used in" for tokens comes from the frame, not from imports.

- **Step 1 done:** `libs/cli/design/web/frame.ts` loads one `<style>` with the product tokens
  (the product's own `foundations/tokens`, else the base's), before the part's style. A tokens edit
  redraws every part; the new-page stub no longer imports tokens; "used in" counts the tokens part
  for every page. Shots of `part-tree` and `pages/system` stayed byte-identical.
- **Step 2 done:** one-variant sketches dropped the import from `shell-main`, `part-tree`,
  `canvas-frames`, `pages/start`, `foundations/logo` (studio) and `button`, `form-field`, `select`
  (sdk). Each merged automatically with no visible change. The note of `sdk/foundations/tokens`
  names the frame now, not the import.

### 5.16 `sketch new` prints the assets folder but does not create it - fixed

- **Pain:** both sketch agents of 2026-10-29 had to `mkdir` `<variant>/assets/`.
- **Fix option:** create the folder, or print "(create it when needed)".
- **Fix done:** `sketch new` and `sketch variant` create `<variant>/assets/`. A merge copies only
  the files below it, so an empty folder changes nothing.

### 4.10 `design shot` keeps the pixel diff result inside the PNG - fixed

- **Pain:** `shot --states --variants` prints only the PNG path. The agent must open the image to
  learn "no pixel change" or "N px changed".
- **Fix option:** print one line per diff cell, for example `a / sizes: no pixel change`.
- **Fix done:** `design shot --states --variants` prints one line per diff cell after the PNG path, for example `a / danger vs merged: 2836 px changed`.

### 4.9 Diff cells of a page make the contact sheet very wide - fixed

- **Pain:** the diff row (5.15) draws each cell at the natural PNG size, so a page diff makes the
  sheet wide.
- **Where:** `contact-sheet.ts` in `libs/cli/src/lib/design`.
- **Fix option:** scale diff cells to the width of the state cell above them.
- **Fix done:** a diff cell is as wide as the state cell above it; a page diff no longer widens the sheet.
