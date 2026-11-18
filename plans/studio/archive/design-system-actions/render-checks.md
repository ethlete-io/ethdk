# Archive, done: 4. Render checks and shots

### 4.51 A round that changes no pixel looks broken in Studio - done

- **Pain (Tom, 2026-10-30):** "was ist mit dem inbox sketch?" The Inbox round r2 showed only
  folded "unchanged in c" row heads, empty dashed cells under Current and c, and the folded
  r1. Nothing said what c changes or why the canvas is empty.
- **Cause:** c restores the accepted L look on purpose (6.8). It drops the extra
  `comment-draft-focus` state and adds one sentence to the page note: the editor is open only
  while focus is within it. Both are real changes, but no state differs in pixels, so every
  row folds. c also has no variant note, and Studio shows no change to the part note.
- **Now:** the agent compares `shared/inbox.ts` with `c/shared/inbox.ts` by hand and
  explains it in chat.
- **Fix options:** 1. when a round's variants change no pixel, the canvas shows one line in
  place of the empty grid, for example "c changes no pixel: part note changed, state
  `comment-draft-focus` dropped", with the note diff on a click (recommended). 2. a
  variant-note check: `sketch ready` refuses a variant without a note when its round has a
  new variant. 3. a note-only change opens the merge preview directly.
- **Acceptance:** for the Inbox r2, Tom sees at the first view that c changes only the
  part note and drops one state, and can read the new note text without the agent.
- **Decision (Tom, 2026-10-30):** option 1. Build it.
- **As built (2026-10-30):** `/__design/sketches` gives each variant target `changes` (`added`, `dropped` states
  against the product part, `note` before/after or `null`), read without drawing. The sketch canvas shows one
  line per shown variant whose states are all unchanged, e.g. "a changes no pixel: part note changed, states xs,
  ... dropped"; a click opens the part note now / in the variant, plus the variant note. Spec bites
  (`serve.spec.ts`, `pixel-free.spec.ts`); headless check on a scratch copy (`/tmp/451/pixel-free-line.png`).
  Deviation: the line sits above the grid; the folded rows stay. Not verified: the real Inbox r2, the Tauri window.
- **Decision (Tom, 2026-10-30, on the deviation):** the line replaces the grid, as first decided. The folded rows
  show only after "Show all states"; the "in pages/merge" embed stays visible.
- **As built (2026-10-30):** `14c419a43`: when every shown variant is pixel-free and no state head is open,
  Studio drops the folded state heads; "Show all states" opens them, "Fold unchanged states" hides them. A sketch
  where only some variants are pixel-free keeps the grid. Spec failed on the old source. Not checked visually.
- **Decision (Tom, 2026-10-30, mixed sketch):** also when only some variants are pixel-free, the folded state heads
  go away until "Show all states"; the grid shows only the states that change in some variant. Open until built.
- **As built (2026-10-30):** the folded state heads drop as soon as one shown variant is pixel-free and no state head
  is open; each pixel-free variant keeps its line. Spec (`sketch-view.component.spec.ts`, mixed a/b) failed on the old
  condition. Not checked visually.

### 4.52 A pick in Studio shows only after a long delay - done

- **Pain (Tom, 2026-10-30):** in the ready `pages/inbox` sketch, Tom clicked "Pick c". All
  buttons were disabled for a moment, then enabled again, and nothing showed as picked.
  After a wait, c showed as picked. In between, the view looks as if the pick failed.
- **Evidence:** `sketch.json` holds `decision: { kind: 'pick', variant: 'c' }` with
  `decidedAt` 13:26:27Z, the same second as the file write. The pick reached the disk; the
  view did not follow it.
- **Suspects, not checked:** the sketch list that Studio reloads after the pick still
  returns no `decision`, or the view keeps its own pick state and drops it on the reload.
  c changes no pixel (4.51), so a view that derives "picked" from a diff may also fail.
- **Fix options:** 1. after the pick request, Studio reads the decision from the answer of
  that request and shows it at once, then confirms it from the next list read
  (recommended). 2. reload the sketch list and fail visibly when it has no decision.
- **Acceptance:** a click on "Pick c" shows c as picked at once and enables Merge, also for a variant
  that changes no pixel; a failed pick shows an error instead of a silent reset.
- **Decision (Tom, 2026-10-30):** option 1. Build it.
- **Done (2026-10-30, 5c44e2edb):** `decideSketch$` returned the answer's decision to nobody; the view
  waited for the list read. It now lays the answer over the listed sketch at once.

- **Migration (Tom, 2026-10-30):** once the 4.47 and 4.53 rules stand, every existing Studio
  design gets one pass: declare its interactive controls, draw the missing states and
  surfaces, and cut CSS to what utilities cannot express. One page per commit.

### 4.53 Studio designs use plain CSS where Tailwind utilities would do - done

- **Pain (Tom, 2026-10-30):** many Studio designs style with plain CSS, though the rule is
  Tailwind utilities in the markup and CSS only where utilities cannot express it.
- **Evidence:** about 1,800 lines of CSS outside sketches, for example `pages/inbox/shared/inbox.css`
  (258), `elements/shell-main/shell-main.css` (246), `pages/merge/merge.css` (161),
  `elements/canvas-frames/canvas-frames.css` (126). `foundations/colors/colors.css` (454) is
  token definitions and probably stays. The process rule from 2026-10-29 (see the fixed
  table, "new plain CSS files for a sketch") covers only new sketch code, and no check
  enforces it.
- **Fix options:** 1. a `design check` rule that flags a CSS declaration with a matching
  Studio utility, for example `display: flex` or a spacing or colour token, and lets the
  rest pass (recommended). Then move the existing parts, one page per commit, with no
  pixel change. 2. only a one-time manual move, without a rule; new CSS comes back.
- **Acceptance:** `design check` fails on a new utility-expressible declaration, and the
  existing pages draw the same pictures with their CSS cut to what utilities cannot do.
- **Decision (Tom, 2026-10-30):** option 1, the `design check` rule, then the one-page-per-commit
  move. `foundations/colors` stays CSS.
- **State (2026-10-30):** the `UTILITY-CSS` rule is in `libs/cli/src/lib/design/system/rules/utility-css.ts`,
  not yet in `RULES`. Token utilities come from the product's `@theme`, keywords from a fixed table. The checkout
  has 318 findings in 12 files, most in `elements/shell-main/shell-main.css` (55) and `pages/inbox/shared/inbox.css`
  (42). Known gaps: a parent-state selector over an SDK element is flagged; inline `style="..."` is not checked.
  Next: the one-page-per-commit move through sketches, then register the rule.

- **Progress (2026-10-30):** `elements/shell-main` moved; `ready` auto-merged it (no visible change). Kept in CSS:
  px sizes, 1px borders, inset shadows, the dot-grid image, calc offsets. State overrides now pick utilities in
  the TS (a utility beats the components layer). Class names with no rule left were removed from the markup.
  Next: `pages/inbox` after its open sketch merges, then the other pages.
- **Tool notes (2026-10-30):** (1) `sketch check` fails on a baseline finding of another part (inbox contrast),
  `ready` still merges. (2) `UTILITY-CSS` is not in `RULES`, so the move was checked by hand against the rule's
  tables. (3) Each move triggers `UNDEFINED-CLASS` for semantic class names with no rule left. (4) The rule does
  not flag px sizes on the 4px scale (40px = `w-10`); open whether intended.
- **Progress (2026-10-30):** `components/tree-row` moved; `ready` auto-merged it after one fix. `rounded-full`
  (9999px) antialiases a 1.5px ring on a 6px dot differently from `50%`, so `border-radius: 50%` stays in CSS.
  `text-ui-xs` also sets a line height; use the plain size where the old CSS set only `font-size`. Tool note
  (not proven): `rounded-[50%]` in a sketch file drew square dots, so an arbitrary-value class in a sketch may
  not reach the sketch stylesheet.
- **Progress (2026-10-30):** `elements/canvas-frames` moved; `ready` auto-merged it. Kept in CSS: ring shadows,
  off-scale text sizes, calc grid columns, `nth-child` padding, `.st-sgrid-cell` (`inbox.ts` rewrites its exact
  markup with a regex) and `.st-canvas-zoom*` (`pages/sketches` selects them). `pages/merge` moved the same way. Next:
  `components/disclosure`, `foundations/*` (except colors); `inbox`, `comment-pin`, `pages/sketches` after their
  open sketches merge.
- **Progress (2026-10-30):** `32209b1ff` agent-logos (68 -> 0 CSS lines), `1dabc66e1` comment-pin (115 -> 0),
  `dff51765f` shell-main `shared/picker.css` (21 -> 15: calc offsets, a box shadow whose arbitrary class changed
  pixels, the SDK button override). comment-pin keeps `styles: ''` because inbox.ts and sketches.ts concatenate
  `commentPin.styles`; drop that in their moves. Gotchas: a top-level comma in `bg-[...]` makes an invalid
  background-image; `ready` needs a round note first. Next: `pages/inbox` (running), `pages/sketches`, then
  register `UTILITY-CSS`. Tom (2026-10-30): respect the canonical-class lint (`w-[420px]` -> `w-2xl`); the
  `CANONICAL-CLASS` rule is being built.
- **Progress (2026-10-30):** `bc6a85e62` pages/inbox (258 -> 22: a calc height, the SDK switch `--et-*` props,
  two `border-radius: 50%`), then a sketch dropped `commentPin.styles` from inbox.ts. Tool note: `prettier --write`
  on a merged part changes its hash, so `design check` says "changed outside a sketch"; format in the sketch.
  CANONICAL-CLASS findings to fix via sketch: `w-[420px]` in pages/start and pages/system, `min-h-[900px]` in
  pages/start. Left: pages/sketches (after the frame bug), then register `UTILITY-CSS`.
- **As built (2026-10-30):** `02ed9a85d` `CANONICAL-CLASS` and `a2bf53b0f` `UTILITY-CSS` run in `design check`
  (specs through `ruleProblemsOf`, docs, changesets). `6518f3712`: a rule whose selectors all end on an SDK `.et-*`
  element passes; a product whose stylesheets import no `tailwindcss` is not checked. Moves: `8c6154d63`
  pages/sketches (227 -> 45 CSS lines), `34f73f3e2` the last 35 findings in disclosure, tree-row, canvas-frames and
  merge (shared markup now takes exported class strings). Both auto-merged with no visible change. `design check
--product studio` now reports only the six `CONTRAST` findings in `foundations/colors`. CLI design specs: 728
  pass. Not verified: real-pointer hover and press, the running Studio app. Tool note: `sketch check` does not run
  `CANONICAL-CLASS`; only `ready` caught a non-canonical class.
- **Tool note checked (2026-10-30):** `sketch check` and `ready` run the same rules. Repro in a scratch copy: a
  class in the sketch's `shared/` folder passed both, and `design check` caught it only after the merge. Fix
  (`cli` commit after this note): both rules now read the files of the product's, the sketch's and the variant's
  `shared/` folders that a checked part imports. `sketch check` on the repro then failed with `CANONICAL-CLASS`.

### 4.55 A comment on a new part in a sketch cannot be marked done - fixed

- **Pain (2026-10-30):** `inbox done 20261030T135029Z-35c6 --note "…"` on a comment on the
  sketch `components/disclosure` variant a answers "components/disclosure is no part of studio -
  the note has nowhere to go". The part exists only in the sketch, but the variant holds its note.
- **Fix option:** for a comment on a sketch variant, write the note into the variant even when
  the merged product does not have the part yet.
- **Decision (Tom, 2026-10-30):** this fix. No design question left.
- **Status:** fixed - `completeComment` checks the merged part only for a comment outside a sketch variant.

### 4.56 An interactive component draws its interactions as flat states, not as a grid - fixed

- **Status:** fixed - `design complete` fails a control that draws its own interactions with
  `CONTROL-GRID-MISSING` when its part has no grid column per required interaction, or a grid row
  without a state in one; the docs example uses `interactionRows`.

- **Pain (Tom, 2026-10-30):** "wieso nutzt du nicht den grid view wie wir ihn schon bei comment
  pin etc nutzen? das darf nicht vorkommen". `components/disclosure` drew `rest`, `hover`,
  `focus-visible` and `open` as a flat list, so `open` had no hover, active or focus-visible.
  The agent added `active` as a fifth flat state in sketch r1 instead of moving to the grid.
- **Cause:** nothing points to the grid. `interactionRows` exists (`comment-pin`, `tree-row`), but
  the `design complete` example in `apps/docs/cli/index.md` shows flat `hovered`, `pressed` and
  `focused` states. `design check` and `design complete` accept flat interaction states.
- **Now:** sketch r2 variants d and e use `interactionRows` with the rows `rest` and `open`.
- **Fix options:** 1. `design complete` fails a declared control when its part has no `grid`
  with a column per required interaction, and the docs example uses `interactionRows`
  (recommended). 2. a `design check` warning on a state named after an interaction. A warning
  can be ignored, so it does not meet "das darf nicht vorkommen".
- **Acceptance:** a disclosure with flat `hover` and `active` states fails `design complete`
  with a message that names `interactionRows`; the docs show only the grid.

### 4.57 A rest frame can draw a real hover - fixed

- **Status:** fixed - headless Chromium's pointer starts at 0,0 on a new page, so the first frame of a page hovered a control in its top-left corner; `openFrame` now moves the pointer to -1,-1 after each load, which covers `design shot`, thumbs, `render-check` and `design complete`.
- **Pain (2026-10-30):** in `design shot`, `components/disclosure` e `rest` and `open` show
  the hover tint, though no state forces hover. The toggle fills the frame from its top-left
  corner, so the real `:hover` matches where the headless pointer stands.
- **Risk:** `design complete` compares a forced frame with the rest frame. A rest frame that
  draws real hover can hide a hover requirement or fail it wrongly.
- **Fix option:** before each shot, move the pointer out of the frame, or turn off real
  `:hover` in drawn frames, so only `data-et-force` draws an interaction. Add a spec with a
  full-width control that bites.

### 4.58 Controls change state without a transition - done

- **Pain (Tom, 2026-10-30):** "einfache transitions fehlen. zb beim disclosure". The hover and
  active fill of `components/disclosure` and `components/tree-row` switch in one frame.
- **Cause:** Studio has no motion tokens. The only transition in a merged part is the disclosure
  chevron (`transition: rotate 120ms`). `design complete` checks forced frames as stills, and its
  frames turn off all motion (`NO_MOTION`), so nothing asks for a transition.
- **Not 4.54:** 4.54 is about a layout change between two states (FLIP, a sidebar that opens).
  This finding is about the fade of an interaction state on the same control.
- **Fix options:** 1. a `foundations/motion` part with duration and easing tokens (a plain fade,
  no scale or slide), and `design complete` fails a control whose interaction states change its
  colour while its computed `transition-duration` is 0 (recommended). 2. only the tokens and a
  rule in the design-exploration skill. A rule can be skipped, as in 4.56.
- **Open for Tom:** the duration (proposal: `120ms ease` on background, color, border-color and
  box-shadow, as `libs/components/src/lib/button/button.component.css`) and whether the disclosure
  body fades in when it opens (proposal: no, a body fade is a 4.54 transition).
- **Decision (Tom, 2026-10-30):**
  - Option 1: a `foundations/motion` part with duration and easing tokens, and the
    `design complete` check on a colour change with a computed `transition-duration` of 0.
  - Colour changes use `120ms ease` on background, color, border-color and box-shadow. They stay
    in reduced motion (`motion.md` allows `color` as an exception).
  - The disclosure body fades in by opacity in 120 ms when it opens. Its height still jumps; no
    height or slide animation.
  - Prepare for the motion model: every simple transition uses only the `foundations/motion`
    tokens, never a literal duration or easing, and an appearing element (the disclosure body)
    uses `@starting-style`, as `motion.md` prescribes. The later motion system then recognizes
    these transitions and its timeline names them by token.
- **Done (2026-10-30):** `foundations/motion` (`--duration-state`, `--duration-appear`,
  `--ease-standard`, `--transition-state`), loaded in `apps/ethlete-studio/src/styles.css`.
  `design complete` fails `CONTROL-TRANSITION-MISSING` (`87033303b`); `design check` fails
  `HARD-CODED-MOTION` (`bb9754494`). Shots now show the end of finite transitions (`3737b12a3`),
  so a `@starting-style` body is drawn fully visible. The disclosure and tree-row fade with the tokens.

### 4.59 Icons are inline SVG in each part, not a catalogue - done

- **Pain (Tom, 2026-10-30):** "ist das chevron nicht eig ein icon was wir als asset extrahieren
  sollten in eine art icon catalouge?"
- **Evidence:** 7 merged parts hold an inline `<svg>` (`components/disclosure`,
  `components/tree-row`, `elements/shell-main`, `pages/inbox`, `pages/merge`, `pages/flows`,
  `foundations/colors`). The check mark path `m3.5 8.5 3 3 6-7` is copied 4 times, the warning
  triangle 2 times. The viewBox is 16, 24 or 32 and the stroke width 1.5, 1.75 or 2.
- **Existing mechanism:** `svgAsset` and a product `assets/` folder. `foundations/logo` and
  `foundations/agent-logos` already draw their SVGs this way and export a helper.
- **Fix options:** 1. a `foundations/icons` part: one `.svg` per icon in `assets/icons/`, its
  drawing is the catalogue (each icon with its name, at each size), and it exports
  `icon(name, { size })`. `design check` fails an inline `<svg>` outside `foundations/`
  (recommended). 2. the part only, without the check. An agent then draws inline again.
- **Open for Tom:** one stroke width and one grid for all icons (proposal: 16 px viewBox,
  1.5 stroke), and whether the Studio app later takes the same files through the SDK icon system.
- **Decision (Tom, 2026-10-30):** option 1 with the `design check` rule. All icons use a 16 px
  viewBox and a 1.5 stroke. The Studio app later takes the same files through the SDK icon
  system, in a later slice.
- **State (2026-10-30):** Tom merged `foundations/icons` (`merged.json` hash `9f686e3ce096e6b8`); the parts draw from it since `d8e224f30`. The sketch had 15 icons, `icon(name, { size, cls })`, a `construction` state with the grid).
  The `INLINE-SVG` rule is in `libs/cli/src/lib/design/system/rules/inline-svg.ts`, in `RULES` of
  `check-system.ts`: active since `928eebbc9`. An `<svg>` with `data-et-drawing`
  passes, so the `pages/flows` sketch adds it to its edges. Next: after the merge, one sketch per part, then
  register the rule with a minor changeset and `apps/docs/cli/index.md`. The `elements/shell-main` mark is a logo
  and moves to `foundations/logo`.
- **Decision (Tom, 2026-10-30), replaces the `viewBox` exemption:** a missing `viewBox` does not
  exempt an `<svg>`, because an icon without one would slip past. A computed drawing, such as the
  `pages/flows` edges, carries an explicit marker attribute (for example `data-et-drawing`);
  every other inline `<svg>` outside `foundations/` fails `INLINE-SVG`. The rail mark of
  `elements/shell-main` moving to `foundations/logo` is confirmed.
- **Done (2026-10-30):** every part outside `foundations/` draws `icon()`, the rail logo is
  `studioMarkLine` from `foundations/logo`, and `INLINE-SVG` is in `RULES` (commit 928eebbc9).
  `foundations/colors` still draws its status marks inline; foundations are exempt.

### 4.60 The changed area is one box around all changes - done

- **Pain (Tom, 2026-10-30):** in the `components/tree-row` icon sketch, the changed area of the `tree` state
  covers almost the whole row column, though only four small icons change.
- **Cause:** `changedBoxOf` in `libs/cli/src/lib/design/contact-sheet.ts` returns one box around every
  changed pixel of a state. Changes far apart, as the warning at the top and the check at the bottom, give
  one tall box that is mostly unchanged.
- **Fix options:** 1. one box per cluster of changed pixels: boxes closer than a margin merge, and Studio
  shows each box as its own crop, before and after side by side (recommended). 2. keep one box, but outline
  each cluster inside it. 3. no change.
- **Decision (Tom, 2026-10-30):** option 1. Build it.
- **Done (2026-10-30):** one box per cluster (16 px gap, max 8), one crop per box in Studio and `--crop changed`.

### 4.61 The merge editor renders slowly - done

- **Pain (Tom, 2026-10-30):** "das rendering im merge editor etc ist mittlerweile ziemlich langsam
  geworden." It got slower over time, also in other views.
- **Evidence:** not measured yet. One hint from 4.52: the sketch list read (`/__design/sketches`)
  renders the targets and took 7 s on its first call.
- **Next:** measure before a fix. Time each shot request of the merge view (server log or the
  network panel of a headless run on an own server): render queue wait, page render, pixel diff,
  changed box. Compare with a small part to see if the time grows with the part count or the state count.
- **Measured (2026-10-30):** own server on a scratch copy, 3 open sketches (`components/tree-row` 20 states,
  `components/comment-pin` 40, `foundations/logo` 2; variant `a` a copy, `b` a CSS change). Cold / warm:

  | Request                                              | Cold          | Warm     | Dominant                                  |
  | ---------------------------------------------------- | ------------- | -------- | ----------------------------------------- |
  | `sketches` (list)                                    | 17.5 s        | 0.23 s   | 124 draws: every state of each `b`, twice |
  | `sketch-diff` tree-row `a` / `b`                     | 5.6 s / 3.1 s | 1-300 ms | 40 / 20 draws; 20 boxes cost ~0.3 s       |
  | `sketch-crop`                                        | 2 ms          | 2 ms     | reuses the diff pictures                  |
  | `sketch-compare` tree-row / logo                     | 3.8 s / 4.7 s | 2 ms     | 20 / 33 draws of 5 / 7 affected parts     |
  | 4 merge requests at once, comment-pin                | 9.2 s wall    | -        | queue busy all the time                   |
  | `sketches` after a one-line CSS edit in tree-row `b` | 17.0 s        | -        | all 124 drawn again                       |

- **Per draw:** ~140 ms (part) to ~190 ms (page), one at a time; the pixel diff and box are cheap. Time is linear in
  draws: 2 x target states (diff), 2 x states of each affected part (compare), 2 x states x frames per variant (list).
- **Cause:** any edit of a file under `.ethlete/design/studio/` drops every cached picture of the product: 154
  parts (22 product, 66 per variant name over all sketches). `studio/styles.css` has `@source './'`, so Tailwind
  makes each part file a dependency of it; `dependentIdsOf` (`serve.ts:485`) finds it and `styled` in
  `changed-parts.ts:87-93` redraws `everyPartOf` the product. Each Studio revision then pays the full cold cost
  again, on the one-page-at-a-time `createDrawQueue` (`thumb.ts:76-115`). It grows with parts x states x sketches.
- **Fix (recommended):** a change that reaches the product styles only as a Tailwind source redraws only the parts
  of its own file (and their importers), not `everyPartOf`. A new utility only styles the elements that use it.
  Gain: a sketch edit redraws one variant (tree-row `b`: ~20 draws, ~3 s) instead of 124-154 (~17 s + merge view).
- **Alternative:** let the draw queue run 4 pages at once. Measured with a patched dist: list 17.5 s -> 5.7 s
  (same answer), compare 3.8 s -> 1.7 s, diff `a` 5.6 s -> 0.9 s. About 3x on every cold path, no cache change.
- **Decision (Tom, 2026-10-30):** build both, as two slices. First the targeted redraw, then the draw queue with
  4 pages at once. Each slice gets a spec that fails without the fix, a changeset for `@ethlete/cli` and a docs
  line.
- **As built (slice 1, `2cd0ec45a`):** a PostCSS plugin records the files each stylesheet `@import`s; `dependentIdsOf`
  no longer climbs from a file to a stylesheet that only scans it as a Tailwind source. Spec in `changed-parts.spec.ts`
  bites (6 parts instead of 2 without the fix). Measured on a scratch copy: a part `.ts`/`.css` edit redraws 1 part
  instead of 22; an untouched part's next shot stays cached (0.7 ms vs 0.22 s); `styles.css` and the `@import`ed
  `colors.css` still redraw all 22. Not measured: the sketch list (no open sketch in the copy).

- **As built (slice 2, 2026-10-30):** `createDrawQueue` (`libs/cli/src/lib/design/thumb.ts`) runs up to
  `DRAWS_AT_ONCE = 4` drawings; high lane first; `--disable-partial-raster` kept. Probe on `pages/merge` 1440x900:
  2.7-2.8x faster. **Open:** 1 of 60 (`open`, `toggle`) and 1 of 120 parallel pictures differed from the rest
  (the 4.66 fix had 0 of 90). A `ready` compare can again see a false change. Find the cause before relying on it;
  fallback: draw compare pictures one at a time. Not verified: a real `ready` or the Studio merge view under load.
- **Probe of the open point (2026-10-30):** not reproduced. About 3,500 drawings of `pages/merge` `open` and
  `toggle` at 4 at once gave one hash per state, also with 32 CPU burners, 6 probes at once, a cold server and a
  mixed queue of 480 drawings. The embedded frames of `pages/merge open` have no font face, running animation or
  unloaded image at screenshot time, so a per-frame wait would fix nothing. Likely cause (timeline only): the old
  probe ran while `16cfed851` and `86d9f66e9` wrote into `.ethlete/design/studio/`, so a drawing caught a
  stylesheet rebuild. A replay of both writes on a scratch copy gave no odd picture either. Found on the way:
  `openFrame` (`thumb.ts`) gives up silently after `DRAW_TIMEOUT_MS`, so a frame that never draws becomes a blank
  picture with no error. Recommended next: a frame that never draws fails the drawing, and `ready` redraws each
  changed state one at a time before it accepts the change. Keep 4 at once.
- **As built (guard, `ee14a8bee`):** `openFrame` throws a `ShotTimeoutError` with the URL when the frame content
  or an embedded frame never draws (a Vite error overlay still passes). `drawnPair` (`merge-compare.ts`) draws a
  differing pair once more with `fresh` (no picture cache), and only the second pair counts; `compareMerge` and the
  target-state check use it. Five specs; each fails on the old source (run, not read). Not verified: a real
  `ready` that meets an odd picture.

### 4.63 Auto-merge ignores the parts that use the changed part - done

- **Pain (2026-10-30):** the `foundations/colors` sketch that removed the copied generator output auto-merged
  as "no visible change", but it removed `.et-color--accent`, which the inherited sdk part `components/select`
  (state `open`, `panelColor: 'accent'`) needs. `design check --product studio` fails since then.
- **Cause:** `sketch ready` compares only the target part's own states with the merged part.
- **Decision (Tom, 2026-10-30):** fix the tool. The auto-merge also draws the affected parts that
  `sketch preview` lists and stops at `ready` if any of them changes visibly.
- **Not part of this fix:** the select part itself. Tom: the sdk part is not usable as it is; it waits for the
  open plan to adopt the needed SDK components cleanly. Until then the `UNKNOWN-THEME` finding on
  `components/select` stays.
- **As built (`693cd80cc`):** `sketchShowsNoChange` in `libs/cli/src/lib/design/system/sketch/no-visible-change.ts`
  runs `compareMerge` after the target's own states show no change. It draws every state of each `affected` part
  from the merge preview, with and without the variant. A change, or a part that fails to draw, stops at `ready`
  and prints e.g. `auto-merge skipped: variant a changes pages/home default`. Spec bites (fails with the old
  `return null`). Verified: unit specs, spec typecheck, `nx build cli`, lint. Not verified: a live run against a
  render server. Affected parts draw only at the first width, as `compareMerge` does.

### 4.65 A token value change in a sketch auto-merges as "no visible change" - done

- **Pain (2026-10-30):** the colour step B sketch `foundations/colors` had two variants: a (each `*-active`
  0.05 L darker, `--text-subtle` oklch(0.62 0 0)) and b (0.09 L darker, oklch(0.58 0 0)). `sketch ready`
  printed "No visible change in any state: merged foundations/colors automatically" and merged variant a.
  The part draws `.co-fill--active` with `var(--accent-active)` and `.co-subtle-text` with `var(--text-subtle)`,
  so the change must show. The builder undid the uncommitted merge.
- **Two defects:** (1) a token value edit in a variant's `.css` does not reach the compared drawings (suspect:
  the drawing loads the merged product CSS); (2) auto-merge picks one of two variants, which is the designer's
  choice.
- **Decision (Tom, 2026-10-30):** `ready` auto-merges only when every live variant draws the same as the
  merged part in every state; otherwise it stops at ready. Order: finish 4.61 slice 1, then fix both defects,
  then redo step B. Before the redo, change both variants so every text on every surface reaches at least
  4.5:1 (today a fails on raised and overlay, b on raised, overlay and `on-danger` on `danger-active`); Tom
  then picks.
- **Step B values and WCAG 2 contrast** (redo the sketch after the fix): subtle on surface / raised / overlay:
  a 5.25 / 4.46 / 3.88, b 4.46 / 3.79 / 3.30; `on-*` on `*-active` accent / warning / danger: a 5.75 / 7.42 /
  4.95, b 4.95 / 6.40 / 4.20.
- **As built (2026-10-30, 2b3919780):** cause: a frame loaded the product stylesheet as merged, so its `@import`
  of `foundations/colors/colors.css` drew the merged tokens for every variant, and the markup shortcut called
  equal markup unchanged. Now a variant frame loads the product stylesheet with the variant's file in place of the
  merged one, and the shortcut is off when a variant changes a stylesheet the product imports. Defect 2 was defect
  1: `ready` already needs every variant equal. Verified: specs that bite, a scratch `sketch ready` stops with
  "variant a changes accent". Not verified: Studio frames by eye; rejected variants still block an auto-merge.
- **Decision (Tom, 2026-10-30), step B redo r1 (399b0ae9e):** variant b: `text-subtle` 0.66, `accent-active`
  0.59, `warning-active` 0.69, `danger-active` 0.61. Only b keeps `text-subtle` apart from `text-muted` (0.72).
  `danger-active` stays 0.07 below `danger`, not 0.09, so `on-danger` stays the same on every danger fill
  (4.56:1). The merge OK still has to be typed by Tom in the builder session.
- **Merged (Tom, 2026-10-30):** Tom merged variant a in Studio, not b (`e304eb3d0`). `design check --product studio`
  passes.
- **Merged (Tom, 2026-10-30):** then Tom chose b after all; a new one-variant sketch with the b values replaced a
  (fix forward, no restore).

### 4.66 `sketch ready` gives a different answer on a re-run - done

- **Pain (2026-10-30):** in the colour cleanup (`2a4b435da`), `sketch ready` on a CSS-only sketch sometimes
  printed "auto-merge skipped: ... changes pages/merge ...", and a plain re-run then auto-merged. The same
  input must give the same answer.
- **Suspect:** a draw of an affected part (4.63 compare) is not deterministic, for example a font, an image or an
  animation that is not settled when the picture is taken.
- **Next:** draw `pages/merge` several times on an own server and compare the pictures; find the unstable state.
- **As built (2026-10-30):** cause: Chromium partial raster. Under load, the anti-aliased rounded corners of the
  `.mg-shot` clips over the embedded `pages/system` frames drew 2-6 levels apart (about 20 pixels, both states of
  `pages/merge`; 16 of 60 parallel draws). The draw browser now starts with `--disable-partial-raster`: 0 of 90.
  Fonts, animations and images were settled every time. Verified: a probe script and a spec on the launch flag.
  Not verified: a real `sketch ready` under load. Saved pictures from before differ at those corners.

### 4.67 The design render does not load the generated SDK theme classes - premise wrong

- **Pain (2026-10-30):** `pages/sketches/sketch-data.css` keeps its own `:root, .et-color--default` block to map
  the SDK default blue to the Studio accent. A sketch that removed it changed `page-sketch` and `zoomed-page`.
- **Cause:** the design render does not load `apps/ethlete-studio/src/styles/themes.css`, which
  `yarn studio:themes` generates from `foundations/colors`. A part with SDK components draws other colours than
  the app.
- **Fix option:** the product render loads the generated theme classes; then the override goes away (see Q4).
- **Decision (Tom, 2026-10-30):** discard the `pages/sketches` sketch that removes the override; the block stays
  until this fix lands. Also for the colour cleanup: a separate sketch drops the `surface-sunken` cell from
  `foundations/agent-logos` (`surfaces` list); the builder may merge it and then the `foundations/colors`
  sketch that removes the alias itself.

- **Finding (2026-10-30):** the render already loads the theme classes: `.ethlete/design/config.json` gives `studio`
  `styles: [".ethlete/design/studio/styles.css"]`, which imports `apps/ethlete-studio/src/styles.css` and so
  `styles/themes.css`. The `sketch-data.css` override is redundant: without it `page-sketch` and `zoomed-page`
  differ by at most 2/255 per channel (oklch `--accent` vs the generated rgb), which is why the removal sketch
  showed a change. UNKNOWN-THEME has another cause: the inherited SDK part `components/select` passes
  `panelColor: 'accent'`, a theme only the SDK product defines; Studio registers `brand`.
- **Open for Tom:** remove the override through a sketch (the strict check shows the rounding change); fix
  `select` with a Studio `components/select` that uses `brand` or no `panelColor`, or drop the theme name from
  the SDK base part.
- **Decision (Tom, 2026-10-30):** a sketch removes the `sketch-data.css` override; Tom accepts the rounding
  change. Drop `panelColor` from the SDK base part `.ethlete/design/sdk/components/select` now, so the panel
  uses the default theme in every product; the rest of that part still waits for the SDK components plan.
  Merges: Tom wrote "merges gehen klar wenns visuell kleinvieh ist" - allowed when the visible change is minor.

### 4.72 A `foundations/colors` variant does not reach the SDK components in its frame - done

- **Pain (2026-10-30, found in 4.67):** `themes.css` is generated from the merged `foundations/colors`. A colours
  sketch variant changes `--accent` and the other part tokens, but SDK components in that frame keep the merged
  theme colours until `yarn studio:themes` runs. Not tested with a real colours sketch.
- **Fix option:** the render generates the theme classes from the variant's `foundations/colors` for a variant frame.
- **As built (2026-10-30):** product config field `generated: [{ part, command, stylesheets }]`. When a variant
  changes `part`, the render runs `command --part <variant css> --out <dir>` (cached by content) and the variant
  frame loads the listed stylesheets from `<dir>`. `studio` lists `foundations/colors` with
  `tools/scripts/generate-studio-themes.mjs` (new `--part`, `--out`). Verified: a fixture spec; an end-to-end run
  on the real product (variant accent changed `.et-color--brand`; merged compile byte-identical). Not verified:
  Studio by eye, a real colours sketch. Old run folders in `node_modules/.design-explore/generated` stay.

### 4.68 One change across many parts needs one sketch per part - done

- **Pain (2026-10-30):** the removal of the alias `--surface-sunken` touched 10 parts. It took 10 sketches, each
  with its own `new`, `report`, `ready` and commit. A `shared/` edit through `foundations/spacing` also
  changed `foundations/colors`, `foundations/motion` and `foundations/type` without a sign in the command.
- **Fix option:** a sketch with several targets, or `sketch new --each <part,part>` that runs the same
  edit and one `ready` over all of them. `ready` names every part a `shared/` edit reaches.
- **Decision (Tom, 2026-10-30):** one sketch with several targets: `sketch new <part> <part>... --variants a`. One
  variant folder holds all target parts; one `ready` compares every target and every part the edit reaches; one
  merge, one commit. `ready` and `preview` name every part a `shared/` edit reaches.
- **As built (2026-10-30):** `b1330edc6` `sketch new` with several parts; `sketch.json` gets `targets` only for more
  than one, `target` stays the first (id, folder), so old sketches read unchanged; other commands find a sketch by
  any target; merge notes and copies every target. `f0e6ad84d` `mergePreviewOf` returns `shared` (parts a changed
  `shared/` file reaches); `preview`/`ready` name them; the no-visible-change check compares every target and
  reached part. `f40478081` skill docs. `7bc1c025c` studio-api `targetParts`, `targetsOf` per part x variant.
  `1d0517e74` Studio: one row group per target (`<part> · <state>`), later targets' keys prefixed by the part.
  Verified: specs that failed on the old source, 717 CLI and 163 Studio system-view specs, both tsc runs.
  Not verified: a real multi-target sketch in the CLI or Studio. Open: diff marks and the "used in" band cover
  the first target only; Studio's `MergePreview` type lacks `shared`.

### 4.73 A multi-target sketch shows diff marks and "used in" for its first target only - done

- **Pain (2026-10-30, found in 4.68):** a sketch with several targets draws one row group per target, but the diff
  marks and the "used in" band cover only the first target. A change in a later target has no mark, and the parts
  that embed it do not show. Studio's `MergePreview` type also lacks `shared`, so Studio cannot name the parts a
  `shared/` edit reaches.
- **Fix option:** compute diff marks and the "used in" band per target; add `shared` to Studio's `MergePreview`
  type and show those parts.
- **As built (2026-10-30):** `3917404ee`: `diffVariant` takes `part`, the sketch-diff endpoint reads `?part=`
  (404 for a non-target); Studio asks per target and keys later targets' marks `<part> <state>`;
  `sketchUsingPagesOf` lists pages using any target once; Studio shows "A shared/ edit reaches: ...". Specs failed
  on the old source. Not verified: a real multi-target sketch in Studio, the 404, the shared line's look.

### 4.69 A CLI rebuild breaks sketch commands that run at the same time - done

- **Pain (2026-10-30):** two agents ran at once: one rebuilt `dist/libs/cli`, one ran `sketch ready`. The
  builder had to copy the build to `dist/cli-css-snapshot` for the sketch agent.
- **Fix option:** `nx build cli` writes to a temp folder and swaps it in at the end, so a running command
  never sees a half-built `dist`.
- **As built (2026-10-29, b2142f3c1):** `compile` writes to `tmp/cli-build`; `move-into-place.mts` renames file by file into `dist/libs/cli` and never empties it. Found on 2026-10-30; the snapshot copy is no longer needed. Not verified: a rebuild while a `design sketch` command runs.

### 4.70 A rejected variant still blocks the auto-merge - done

- **Pain (2026-10-30):** `sketchShowsNoChange` counts every variant, also a rejected one. Tom's rule (4.65
  "Decision") names only live variants. A rejected variant with a change stops a merge that is safe.
- **Fix option:** skip rejected variants in the "every variant draws the same" check.
- **As built (2026-10-30):** `sketchShowsNoChange` checks only live variants; with none it answers "the sketch has no live variant". The auto-merge already picks the first live variant. Verified: a spec that fails without the filter; design specs and spec typecheck pass. Not verified: a real `sketch ready` with a rejected variant.

### 4.71 A merge Tom allows in the plan has no CLI path - done

- **Pain (2026-10-30):** Tom allowed the builder to merge the `foundations/agent-logos` and `foundations/colors`
  sketches itself. The CLI merges only after a pick in Studio ("has no pick - the user picks a variant in
  Studio"), and agents have no pick command.
- **Decision (Tom, 2026-10-30):** add `sketch merge --variant <key> --allowed-by <plan ref>`, only for a sketch
  with exactly one live variant; the merge note names the plan reference. A sketch with more than one live
  variant still needs Tom's pick.
- **Condition (Tom):** if a sketch works around an issue of the theming system that belongs in the system (SDK
  theming, the generator, the render), do not merge it this way. Fix the system instead, and tell Tom.
- **As built (2026-10-30):** `sketch merge <part> --variant <key> --allowed-by <plan ref> --by <model>`; refuses
  unless `<key>` is the only live variant; both flags go together; a sketch Tom picked merges as before.
  `accepted.json` logs "merged without a pick: allowed by <ref>"; the part note stays. Verified: 4 specs.

### 4.64 Shared helper code had to be a part - done

- **Pain (Tom, 2026-10-30):** `foundations/sheet` is no design. It only exports the token-sheet layout that
  colors, type, spacing and motion import, and its canvas state duplicates `foundations/spacing`.
- **Cause:** `@shared/<path>` resolved only inside sketches, so a merged product had no place for helper code.
- **Decision (Tom, 2026-10-30):** build the missing capability.
- **Done (2026-10-30):** a product `shared/` folder, imported as `@shared/<path>` by any part (sketch lookup:
  variant, sketch, product). Part hashes cover the shared files they reach. A sketch file with a product
  shared path replaces it at merge. The sheet is `shared/token-sheet.ts`; `foundations/sheet` is removed.

### 4.74 Studio performance check - findings (2026-10-30)

A headless check (own production build, own design server, scratch copy, studio-lab with 3 small sketches)
measured the items 4.75 to 4.80. Frontend change detection is cheap (40 pan events: 26 ms script; part switch:
13-30 ms; startup 148 ms task time), and nothing polls while idle. Not measured: frame times in WebKitGTK, the
`tick` burst of a real file save, the dev build on :4221, and a sketch with many variants.

- **Decision (Tom, 2026-10-30):** build in this order: 4.76, then 4.75, then 4.77, then 4.78 to 4.80. For 4.75,
  measure the pop-in steps on a real sketch before and after the change.

### 4.75 Variants pop in one by one on a part with many states - built

- **Pain (Tom, 2026-10-30):** on a part like `components/comment-pin`, the variants appear one after another,
  about 300 ms apart. In a sketch this is very slow.
- **Measured:** zoom to 158 % on `components/comment-pin` (40 states) mounted 42 iframes: 1,443 requests and 43
  documents; JS heap 10 to 38 MB, one Vite HMR client per frame. A frame that leaves the view unmounts, and back in
  view it loads everything again (one zoom run: 316 requests, 289 duplicates).
- **Cause:** `design-canvas.component.ts:85-86,457-476` makes every frame in the viewport plus a 400-unit margin
  live at zoom 0.5 and up, with no cap, delay or hysteresis. Each live frame is a full `frame.html` with 24-34
  module requests (`partials/canvas-frame.component.ts:182-193`). `frame-render-queue.ts:5` loads at most 4 at once.
- **Fix option:** go live only after the camera rests about 250 ms; cap live frames (for example 6, nearest the
  centre); keep a loaded iframe for a grace period after it leaves the view; show the drawn shot `img` elsewhere.
  Effort M. The measure did not prove that this alone explains the 300 ms steps; measure the steps on a real
  sketch before and after.
- **As built (2026-10-30, `53d7802c6`):** `live-frames.ts` picks the live set; the canvas goes live 250 ms after
  the camera rests, on at most 6 frames or grid cells nearest the viewport centre (a target without a shot stays
  live whenever it is in view), and keeps up to 6 left-behind ones live for 5 s. The others show their shot. A
  grid cell now goes live on its own (`liveCells`), so the cap also holds on a one-frame grid like `comment-pin`.
  Measured headless (own production Studio build, own design server, scratch copy, Chromium 1600x1000, warm
  server), before / after:
  - Part `components/comment-pin`, one zoom-in click (35 % to 53 %): iframes 42 / 6, requests 1,570 / 310,
    frame documents 42 / 6; first iframe 127 / 331 ms, iframes painted 415-609 ms / 391-474 ms. Pan away and back
    within 1.5 s: 1,570 repeated requests and 42 reloads / 0 requests and 0 reloads.
  - Sketch `components/comment-pin` (a, b; 120 state frames), seven zoom-in clicks to 85 %: iframes 39 / 6,
    requests 1,084 / 210; the visible iframes painted within 44 ms / 0 ms of each other. Pan back: 945 repeated
    requests and 27 reloads / 1 request and 0 reloads. With 6x CPU throttling: painted 2.0 s / 0.65 s after
    the iframes mounted.
  - Not reproduced: the 300 ms steps. In headless Chromium and Playwright WebKit all live frames paint in one
    burst, before and after; every cell shows its shot first. The cost scales with the live iframe count. A cold
    design server is a different cause: a cold sketch showed no frame for about 12 s, waiting for
    `GET /__design/sketches` before it asked for any shot or diff.
  - Not verified: WebKitGTK in the Tauri window, the dev Studio on :4221, Tom's design server under real load, and
    a shot redraw after a file save (the stub sends no `design_watch` events).
- **Decision (Tom, 2026-10-30):** keep raster shots above zoom 1, the 250 ms rest delay, the cap of 6 and the 5 s
  grace. Tom checks the sharpness and the pop-in in the real Tauri app; if the steps remain, the builder measures
  there. The 12 s cold wait becomes item 4.81.

### 4.81 A cold sketch shows no frame until `GET /__design/sketches` answers - built

- **Pain (found in 4.75, 2026-10-30):** a cold sketch showed no frame for about 12 s. Studio waits for
  `GET /__design/sketches` before it asks for any shot or diff.
- **Decision (Tom, 2026-10-30):** Studio requests the shots without waiting for `/__design/sketches`.
- **As built (2026-10-30, `06b5dd248` cli, `b82f9f144` Studio):** shots need the sketch's states (only the sketch
  list has them), so the list got a quick form: `GET /__design/sketches?unchanged=no` skips the slow part, the
  pixel comparison behind `unchanged` (cold 4.4-4.7 s, quick 0.75 s). On the first listing of a product the system
  view reads the quick list, then the full one (`concat`); later reloads read the full list only. Shots and diffs
  start from the quick list. Until the full list arrives the unchanged states are not folded, so frames of states
  that later fold may draw once.
  - Measured (own production Studio build, own design server on the scratch copy, cold server, Chromium
    1600x1000, sketch `components/card`, 3 runs each), before / after: first shot and diff request 5.2-5.5 s /
    1.9-2.0 s after page load; first frame painted 5.2-5.55 s / 3.2-3.3 s. The cold list alone: 4.4-4.7 s / 0.75 s
    quick. The old 12 s is now about 5 s because the server is faster since 4.76 and 4.77.
  - Specs bite: the system view spec (the shot starts while the full list never answers) fails on the HEAD
    component; the serve spec (fewer loads with `unchanged=no`) fails on the HEAD `studio-api.ts`.
  - Not verified: WebKitGTK in the Tauri window, the dev Studio on :4221, Tom's design server under real load.

### 4.76 `GET /__design/sketches` redraws its pixel comparisons on every call - built

- **Measured:** 2.05-2.1 s per call (5.1 s first), about 2.5 s server CPU each (0.9 s Node, 1.6 s Chromium). The
  system view is usable at 283 ms but the sketch list and tree badges arrive at 2.2 s. It reloads on every `tick`
  and agent status change (`system-view.component.ts:603-623`).
- **Cause:** `sketch/unchanged-states.ts:161` skips the cache when `pictureOf` is set, `:204` never stores the
  result; `merge-compare.ts:50` (`drawnPair`) redraws both pictures whenever they differ, and fresh draws replace
  the shot cache (`shot.ts:308`).
- **Fix option:** cache the unchanged-states result under the hash key it already computes; clear it on the
  `parts` event. Later: serve `unchanged` from a separate lazy request. Effort S-M.
- **As built (4bb09890e):** `unchangedStatesOf` takes `keepPictures`; the studio API sets it, the merge check
  (`no-visible-change.ts`) does not. A result whose draw failed is never kept. `serve.ts` `redraw` calls
  `forgetUnchangedStates()` on every parts change. Specs bite (two breaks each fail a spec).
- **Verified:** scratch copy of `studio-lab` (3 open sketches), own server: five calls 5.08, 0.135, 0.127, 0.129,
  0.150 s; after an edit to `components/button/button.ts`: 2.56, 0.125, 0.118 s. Not verified: on :4221, or in
  the Studio app.

### 4.77 Each server shot opens a new browser context and loads all modules - built

- **Measured:** one warm shot 70-190 ms (cold up to 944 ms), 4 at once (`thumb.ts:84`); 13 library shots cost
  about 870 ms CPU.
- **Cause:** `shot.ts:213-222` makes a `newContext`, a `newPage` and opens `frame.html` for every draw.
- **Fix option (not measured):** one warm page per worker and viewport that switches the part in place. Also makes
  4.76 cheaper. Effort M-L.
- **As built (2026-10-30, `53802ecdf`):** `warm-pages.ts` lends the part shooter one page per browser context and
  set of context options (viewport, scale) and keeps it open: after a draw it clears local and session storage and
  cookies and parks on `about:blank`, which also stops its Vite client and timers. A thrown or timed-out draw closes
  the page; at most 8 idle pages, oldest closed first; they close with the browser. No switch in place: `frame.ts`
  reads its query and injects env, tokens and part styles at module top level, so each draw still navigates, but on a
  warm context (the 19 of 21 module requests come back 304). Specs bite (two breaks each fail a spec).
  Measured on a scratch copy, own server, `studio-lab`, `pictureOf` with `fresh`, 4 at once, before / after (two
  runs each): library batch (32 shots incl. 16 interaction shots) cold 1,523-1,621 / 1,347-1,357 ms, warm
  1,214-1,235 / 1,017-1,050 ms; sketch `components/card` (8 shots) warm 280-300 / 266-283 ms; one shot after
  another 133 / 117 ms; CPU of the whole run (Node and Chromium) 14.4-15.1 / 11.4-11.5 s. All 80 PNGs (first and
  fifth round) are byte-identical to before.
  - Found: of a warm draw on a reused page (about 115 ms), the element screenshot (`root.screenshot`) takes 67 ms,
    `settled` 23 ms and the navigation 22 ms; a page screenshot with the same clip takes 31 ms but differed in
    bytes. That is the next lever, not the context.
  - Not verified: the thumbnailer (`thumb.ts`, call thumbnails) and `changedBoxesOf` still open a context per
    draw; Tom's server under real load; the Studio app.

### 4.78 A file change reloads several lists at once - built

- **From the code:** each `tick` reloads products, calls, flows, comments and sketches
  (`system-view.component.ts:542,564,610,652,991`, `studio-view.component.ts:372-375`). Warm `system` 44-55 ms.
- **Fix option:** reload only what the `parts` event names. Effort M.
- **Found (2026-10-30):** `tick` comes from the Tauri watcher (`host/design.ts:108`, `src-tauri/src/design_watch.rs`,
  `Channel<()>`): it names no path and no kind. The design server events (`serve.ts:326,505-530`) name `comments`,
  `notes`, `flows` and `parts`, but nothing for a call file or a `sketch.json` change.
- **Plan (builder):** `src-tauri` is off-limits, so the design server also sends `calls` and `sketches` events;
  Studio reloads each list on its own event, and `parts` with `all`, a reconnect or an unknown change reload
  everything. Build after 4.77 (both touch `libs/cli`), then 4.81.
- **Decision (Tom, 2026-10-30):** `src-tauri` is not off-limits; that rule had no source. Build the proper fix,
  not a workaround around the Rust watcher: each change names what changed, and Studio reloads only that list.
  If the watcher and the design server events then overlap, keep one source. A reconnect or an unknown change
  still reloads everything.
- **As built (2026-10-30, `371d807f2`, `7e912ed22`):** the design server is the one source. It now sends `calls`
  for any file under the calls root, `sketches` for any file under `<product>/sketches/` (`sketch.json` too), and
  `parts` with no parts for a system file that redraws no frame (the product list still changes). Studio maps each
  burst (300 ms) to list revisions: `calls` reloads the call list and call frames, `sketches` the sketch list, `parts`
  products, sketches and flows (sketch and flow problems overlay the parts), and a reconnect, `parts.all`, an
  unreadable `parts` or Reload reload every list, comments, notes and the project. The Tauri `design_watch` command
  (recursive, undebounced, a full `design_project` rescan per burst) is deleted: nothing else used it, `design()` only
  feeds port and themes (config change = `parts.all`), and the server path also works for headless Studio.
  `design_status_watch` stays. Bites: the new server spec, the `designChanges$` spec, the studio-view and system-view
  list specs all fail on the HEAD sources; a mutation coupling sketches to calls fails the system-view spec. Verified:
  Studio and cli design suites, tsc, eslint, `nx build cli`, `cargo check/test/clippy/fmt`, and a live scratch server
  (call edit -> `calls` only, `sketch.json` -> `sketches` only, comment -> `comments` only). Not verified: a headless
  Studio build counting requests. An older `@ethlete/cli` in a checkout sends no `calls`/`sketches`, so its lists
  refresh only on Reload. Tom must rebuild Studio (Rust changed).

### 4.79 Four SSE streams to the same host - built

- **Measured:** `comment-events` opens 4 times (`host/design.ts:640`, `host/design-parts.ts:32`,
  `host/design-notes.ts:71`, `host/design-flows.ts:25`), which leaves 2 of 6 per-host connections. No effect in
  headless Chromium; WebKitGTK not measured.
- **Fix option:** one shared `EventSource` with `share()`, split by event name. Effort S.
- **As built (2026-10-30, 560731d81):** `host/design-events.ts` holds one `EventSource` per port behind `share()`; `commentChanges$`, `partsChanges$`, `noteChanges$` and `flowChanges$` filter it by event name. A drop arrives as an `error` event and `commentChanges$` still errors on it; a late comment subscriber gets `connected` if the stream is open. Verified: new spec (one source for four subscribers, closes on the last unsubscribe, reopens), studio vitest, both tsc, eslint. The spec bites: with the old four call sites, 2 of its 4 tests fail. Not verified: a live server, WebKitGTK.

### 4.80 The lazy Studio chunk holds every view - built

- **Measured:** 887 KB raw, 247 KB gzip: `main` 289 KB, one lazy chunk 539 KB; `libs/components` forms 178 KB of
  it (select 74 KB, form-field 60 KB). Low priority for a desktop app.
- **Fix option:** lazy-load the agent view and the dialogs. Effort S-M.
- **As built (2026-10-30, e5d007cdf):** the agent view was already its own route. `@defer` now wraps the new-product form, note form, comment draft, comment thread and comment panel in `system-view`. Before: main 289 KB + one chunk 540 KB (146 KB gzip). After: main 301 KB (93 KB gzip) + view chunk 417 KB (118 KB gzip) + a 102 KB deferred chunk (24 KB gzip) loaded on demand. First view loads about 122 KB raw / 28 KB gzip less. Select stays in the first view (product picker, checkouts footer). Verified: 321 specs, tsc, headless Chromium on the static build starts without errors and the agent view renders. Not verified: the deferred panels in a browser (need the design server). No spec: the chunk measurement is the evidence.

### Rust side of Studio - findings (2026-10-30)

The 4.74 check was headless and never read `src-tauri`. A read-only review of `src-tauri/src` (nothing run, no
measurement) found the Rust side lean: no polling in Rust, no unbounded channels, agent children do not leak. The
watcher findings (recursive over all of `.ethlete/design`, no debounce, a full `design_project` rescan per burst)
belong to 4.78, which replaces the `tick` with design server events.

- **Decision (Tom, 2026-10-30):** build 4.82, 4.83 and 4.84 right after 4.78, then 4.47 discovery.

### 4.82 `design_server_state` spawns `node` on every 3 s poll - built

- **From the code:** while a foreign server listens, Studio polls `design_server_state` every 3 s
  (`studio-view.component.ts:421`). Each call runs the `stale` check (`design_server.rs:172-236`): a walk of up to
  5000 entries of `libs/cli` with a stat each (on a tokio worker, not `spawn_blocking`), an HTTP GET for the served
  stamp, and a `node <cli> design stamp` spawn (about 50-150 ms CPU). It also clones the whole server log and sends
  it over IPC each time (`design_server.rs:311-327,387-419`).
- **Fix option:** compute `stale` once per start or restart and cache the stamp per checkout and port; send the log
  only on change. Effort S-M.
- **As built (6ae2d14e6):** `DesignServers` caches the stale verdict per checkout and port; it is dropped when the
  port stops answering and on Studio's start or restart, and the walk runs in `spawn_blocking`. Every log change
  bumps a global `logRevision`; `design_server_state` takes the caller's revision and sends `log: null` when it
  matches, and `designServerState$` keeps the known log. Rust tests for the cache and the log revision, a host spec
  for the merge; each bites (mutations fail them). cargo test/clippy/fmt, Studio vitest, tsc and eslint pass. Not
  run in the app: Tom must rebuild Studio.

### 4.83 Sync Tauri commands block the window - built

- **From the code:** non-async Tauri v2 commands run on the main thread. `design_project` (`design.rs:299-330`)
  rescans every call and parses each `call.ts` without a cache, after each watcher burst. `workspace_root`,
  `workspace_status`, `workspace_diff`, `workspace_check` (`lib.rs:55-85`) each spawn `git rev-parse` plus
  `git status` or `git diff`. `design_roots_search` and `design_scan` (`design_roots.rs:158-181`) walk two levels
  and do not skip `node_modules`. `check_call` (`tools.rs:231-260`) runs a full `design check --lint` with a
  blocking `output()`; its thread is not confirmed.
- **Cost:** small in this repo (ms to tens of ms), but a slow `git status` or a large project freezes the UI.
- **Fix option:** `#[tauri::command(async)]` or `spawn_blocking`; cache the repository root in a `OnceLock`; skip
  `node_modules`; a timeout for `check_call`; optional mtime cache for parsed calls. Effort S (M with the cache).
- **As built (f543a6ba2):** `design_project`, `design_scan` and the four `workspace_*` commands are async and run in
  `spawn_blocking`; the repository root sits in a `OnceLock`; the scan skips `node_modules`. `check_call` runs in
  the MCP tool process, not the main thread; it now kills `design check` after 120 s. No mtime cache. Tests for
  the `node_modules` skip and the timeout bite (mutations fail them). cargo test/clippy/fmt pass; no frontend
  signature changed. Not run in the app: Tom must rebuild Studio.

### 4.84 Small Rust hygiene - built

- `agent.rs`: the stderr buffer `complaints` grows without a cap until the end of the run. Cap it.
- `design_server.rs:74-78`: `listening()` blocks a tokio worker with `connect_timeout` inside async loops. Use a
  tokio `TcpStream`. Loopback usually answers at once, so the cost is low.
- Effort S each.
- **As built (2895e32ff):** `complaints` keeps the first 4096 bytes (the summary is clipped from the start);
  `listening()` is async on a tokio `TcpStream` (tokio `net` feature), so `state()` is async and probes before it
  locks the table. The cap test bites (a mutation fails it). cargo test/clippy/fmt pass. Not run in the app: Tom
  must rebuild Studio.
