# Ethlete Studio - fixed pain points from the self-test

The fixed entries of `design-system-actions.md`, with their numbers kept. `Lnnn` is a line in
`design-system.md`.

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
