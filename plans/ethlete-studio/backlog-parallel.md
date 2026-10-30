# Studio design tooling backlog - parallel plan (2026-10-30)

Goal (Tom): finish the open items of `design-system-actions.md` and `motion.md` as fast as possible, without
Tom. Tom is not there to merge sketches: sketch work stops at `ready` and goes onto the merge queue below.

## Builder status (2026-10-30)

- A1 done (`0c4b8a887`). A2 + Q32 done (`0c307a0c3`); F1 done, auto-merged (`e6fcf97c5`). A3-A5, the `STALE-REPLACE`
  false positive, then exceptions and `handoff` run in one subagent.
- D done (`493d1f6f9` 6.7 and 5.60 rule, `c94f3e095` 6.6). F3 and F4 were already built (token in `colors.css`,
  `UTILITY-CSS` in `RULES`). C1 done (`2a90d0cfd`, Inventory toggle on `pages/*` parts; `by` is `designer`). B, E and G slice 5 run; C2
  waits for B2; C3 (1.2 re-run) not started; F 5.51 r2 at ready; F 5.32 at ready. G slice 4 done (`eebccd5f6`); slice 5 waits for Q41 (how flow lines
  animate). Queued: A 5.39 after A2-A5; F 5.32 (F2 merged by Tom).
- Tom merged `foundations/colors` r2 and `elements/canvas-frames` + `pages/sketches` r1 (`b47bae5e9`). Q43 (zoom
  chip as its own part `elements/zoom-chip`) is now a new sketch on the merged parts - in progress.
- In progress (2026-10-30): fifagg backdrop close during enter (opus, `libs/cdk`).
- B done: `et design mcp` (`90724234f`), `/__design/motion` (`dacf9bd64`). E done: 5.52, 5.55, 5.56. G slice 5 done
  (`a0ba7dd81`). A: 5.60 (`0652fc1df`), 3.39 (`a9ad0200c`), 5.39 (`c3ad43bcf`) and the `STALE-REPLACE` fix (`1704a6dda`) done.
- `design check` warns `STALE-REPLACE` on `components/button/button.ts` (`replace(/^<(button|a) /)` matches nothing) - as built (`1704a6dda`): a replace on markup a package draws is skipped. Found on the way: `aae2914f3` broke every render of the built CLI
  (`exports is not defined`); fixed in `203aa2c35`.

## Rules for every stream

- One subagent per stream, run the streams at the same time. Inside a stream, work serially: its items touch
  the same files.
- Each stream commits only its own paths (`git add -- <new files>`, `git commit -- <paths>`). Never `git add -A`,
  stash, amend, reset or `checkout --`.
- A typecheck or build error in another stream's uncommitted file is not yours: check your own files with tsc and
  eslint on changed files, and say so in the report.
- Every lib change: a spec that bites, a changeset, docs (`apps/docs/cli/index.md`), no new lint warnings.
- Record each item as built in its plan section, with the commit.

## Stream A - `libs/cli` sketch and complete checks

Serial, all in `system/sketch`, `system/complete.ts`, `inventory*.ts`:

1. 4.47 inventory slice 1 (CLI) - in progress.
2. `sketch ready` refuses a variant that does not load (`exports is not defined` printed "is ready").
3. 5.60 `sketch ready` fails on unused imports, styles or params in the picked variant's closure.
4. 3.39 a component sketch may carry host edits that only change an import.
5. 5.39 the state grid shows empty cells for undrawn state combos, and `sketch check` lists them - if Tom
   decides it (see open decisions).

## Stream B - `libs/cli` MCP and motion endpoint

1. `et design mcp` (design-system.md slice 8), then the `motion_shots` tool (sheet image + JSON).
2. `/__design/motion` over `motionOf` with the shot cache (`serve.ts`), for motion slice 3.

## Stream C - Studio app (`apps/ethlete-studio/src`)

1. 4.47 slice 2: the inventory approval view (marked page, list, approve button). Starts when stream A step 1
   lands; build the UI against the CLI output.
2. Motion slice 3: keyframe strip and timeline. Starts when stream B step 2 lands.
3. 1.2 re-run the 100-cycle frame-reload test and record the result.

## Stream D - agent skill text (`.agents/skills/ethlete-design-exploration`, `libs/agent-rules/content`)

One sonnet subagent, small items: 6.7 reference rule (check first whether it is already in the skill), 5.60
authoring rule, 6.6 critique rule and 5.56 "one scale only" rule if Tom decides them. Then `yarn agents:sync`.

## Stream E - `libs/cli` tokens and embed (only after Tom's decisions)

5.52 `design tokens theme add`, 5.55 `embedPage({ mark, css })`. Separate files from streams A and B.

## Stream F - sketches up to `ready`

One sketch per part; different parts run in parallel, the same part serially. Each stops at `ready` and goes
onto the merge queue. A sketch that builds on an unmerged sketch waits.

1. `components/button` controls into the SDK base (Q32), then the studio override goes away.
2. `elements/canvas-frames`: 2.2 app zoom chip, then 5.32 named frame head, frame box and zoom chip.
3. 5.31 `--surface-pressed` token, then tree-row, disclosure and comment-pin on it.
4. 4.54 `UTILITY-CSS` moves: inbox, comment-pin, pages/sketches, agent-logos, `picker.css`; then register
   `UTILITY-CSS` in `RULES` (stream A owns `RULES`; hand it over).
5. 5.51 contrast numbers in the tokens drawing, if Tom decides it.

## Merge queue (waits for Tom)

Sketches at `ready`, with the round name and the one-line question for Tom. The builder keeps this list current.

- `sdk` `foundations/tokens`, round "Token overview" (`9f92126a3`): how should the sdk overview draw the
  token set - a matrix of chips per state (a), a specimen in use (b), or a token sheet with names and values
  (c)? Builder pick: a. Token CSS is the same in all three, generated from `calls/components/themes.ts`.

Tom merged `components/zoom-chip` r2 b (`6fef28d85`); `design complete components/zoom-chip` passes.

## Waits for Tom in the real Studio

- Look at the Inventory view of a page in the running Studio (C1, `2a90d0cfd`): only specs and a GET on a scratch
  server checked it.
- Accept 3.45 (reject and reopen) and 4.43 (toggle and gaps), both built with specs only.
- Section 7 open checks: Rust status-watch reload, `is_stale` footer, shot size on the HiDPI window, round d on
  macOS WebKit and touch.
- 1.5: rebuild and restart Studio; the next panic stack lands in `/tmp/ethlete-studio-panics.log`.

## Stream G - motion runtime (`libs/cli/src/lib/design/motion-*.ts`)

Pulled into this push (Tom, 2026-10-30): motion slice 4 (`spring()`, `interrupt`), then slice 5 (flow lines).
Coordinate with stream B on `serve.ts` and with stream C on the timeline.

## Stream A, after its five steps

Pulled into this push (Tom, 2026-10-30): 4.47 approved exceptions, then the `handoff` status with CI.

- **Built (`aaa57a950`): 4.47 approved exceptions.** `design complete --request <part>.<control>.<requirement> --reason`
  writes a pending entry to `<product>/exceptions.json` (the owner's for a base part); the gap still fails, marked
  pending. `POST /__design/exception-approve?product=` `{ key, by }` records `by`, `at` and the part hash; then the gap
  drops. A later part edit reopens it. `GET /__design/exceptions?product=` lists them; `design complete` prints an
  `EXCEPTION` line each. Studio has no approve button yet (stream C).
- **Built (`acc020fd0`): the `handoff` status with CI.** `design complete <part> --handoff` writes a passing part to
  `<product>/handoff.json`; `design complete --handoff --product studio` re-checks each one and exits 1 on a
  regression. The CI Build job runs it. No studio part has the status yet: granting it is the user's call. Passing
  today: `components/disclosure`, `components/zoom-chip`, `elements/canvas-frames`, `foundations/logo`, `foundations/icons`.
- **Built (`c7c9a0be9`): `design complete <layer>/<name> --variant <key>`** (SDK base session request). Chose the flag
  over a `sketch check` section: it reuses `completenessOf` whole, only threading the variant into `seePart`. Every
  part is drawn as the variant draws it; a part the variant changes skips `PART-UNREVIEWED`. Approved exceptions and
  inventories hold the merged hash, so they read as reopened on a variant that changes the part.
- **Open (option focus):** the check forces only `data-et-force` (CSS `:hover`/`:focus-visible`/`:active` are
  rewritten to it) and needs a pixel diff with the force on vs off. `[data-active]:hover` counts only when the forced
  option also carries `data-active`; `data-active-source="keyboard"` is static, so option focus-visible fails until
  the drawing has a `:focus-visible` rule or the CLI maps the force to that attribute.

## Nothing to build

3.41 (did not reproduce), 4.7 (known limit), 5.21 (parked), 5.23 (SDK issue), 5.24 (done), 6.5 (covered by 4.47).

## Decisions (Tom, 2026-10-30)

- 5.39: the state grid shows an empty cell for each undrawn state combo; `sketch check` lists them. Stream A.
- 5.51: the tokens drawing prints the contrast of each token on each surface. Stream F (sketch).
- 5.52: if a generator already reads the tokens, generate all three theme blocks from that one source; else add
  `design tokens theme add <name> --type --oklch`. Check which first. Stream E.
- 5.55: `embedPage({ mark, css })`, both applied inside the iframe. Stream E.
- 5.56: `design check` warns when both `embedPage({ scale })` and the host's own scale are set. Stream A or E.
- 5.32: `elements/canvas-frames` exports the frame head, the frame box and the zoom chip as named parts. Stream F,
  after 2.2 on the same part.
- 6.6: a skill rule: before `ready`, critique hierarchy, spacing, form nesting and host context; no render gate.
  Stream D.
- 5.51 / Q42: `--surface-border` (1.2-1.6:1) is marked decorative and exempt from the 3:1 non-text bar (WCAG
  1.4.11: it only separates surfaces). Controls with a visible boundary (inputs, focus) keep their own 3:1 tokens.
- 5.32 / Q43: the zoom chip becomes its own part (for example `elements/zoom-chip`) with its own states, so it
  carries `data-et-part` and `design complete` checks it wherever it is drawn. Frame head and frame box stay named
  exports of `elements/canvas-frames` (layout pieces without states). Redo r1 (b907cf29d) before Tom merges.

## New finding 4.85 (Tom, 2026-10-30): a failed module import stays in the frame

- **Built (`91b224b61`):** `frame.ts` retries a failed part import after 300 ms and 1.5 s and shows the error only
  when all three tries fail. Chromium 156 fetches a failed module URL again (checked). Two specs in
  `frame-bootstrap.spec.ts` bite; its fixture got the missing `applyEmbed`. Not reproduced live in Studio.

- **Pain (screenshot):** on `components/tree-row` most state frames show `design-explore: state "<state>" of
"components/tree-row" failed / Failed to fetch dynamically imported module:
http://localhost:4402/@fs/.../.ethlete/design/studio/components/tree-row/tree-row.ts?design-product=studio`.
  The first states rendered, the rest failed. Tom sees this often, after parts change.
- **Likely cause (not verified):** the part file changed while the frames loaded (for example the auto-merged
  `34f73f3e2`), Vite invalidated the module, and each frame that imported it during the change failed. Nothing
  retries the import once the file settles, so the error stays until a manual reload.
- **Fix option:** reproduce first (edit a part while its grid loads). Then the frame retries a failed dynamic
  import after the next `parts` event for that part, or after a short back-off; only a repeated failure shows the
  error. A spec that bites. Stream A or C, whichever owns `libs/cli/design/web/frame.ts` now.

## SDK base designs (Tom, 2026-10-30, Q44)

A separate design session draws the SDK base parts under `.ethlete/design/sdk/` that Studio uses. It starts once
the builder's `components/button` move into the base (Q32) has landed, so both never edit the same part. Order by
use: `components/select` with the open panel and options (the 4.47 gap that blocks inherited coverage), then
`form-field` with `input` and `textarea`, then `tree`, `switch` and the tooltip. Each part declares its controls
for 4.47, goes to `ready` and waits on the merge queue for Tom. The session follows the
`ethlete-design-exploration` skill: Tom picks every design.

- **Order change (Tom, 2026-10-30):** the sdk foundations come first, then one component at a time.
- **As built (ethlete-sdk-33, 2026-10-30):** sketch `foundations/tokens` in `sdk`, round "Token overview",
  variants a (chip matrix), b (specimen), c (token sheet), at `ready` (`9f92126a3`, regenerated `5c610fb70`). Tom
  picked a (Q49); the merge is his click in Studio. `tools/scripts/generate-sdk-tokens.mjs` (`yarn sdk:tokens`,
  `--out`, `--check`) writes the token CSS from the Storybook themes with `libs/core/design/theme-css.ts` through
  `jiti`; it forces `isDefault` on both surfaces and strips the Tailwind-only output. Verified: `sketch check` ok,
  the three variant files are byte-identical to the script output. Not done: `--check` in CI, because the merged
  part only matches after the merge; the product `generated` hook is not used, because its source is a part file.
- **Next:** after Tom's merge, wire `yarn sdk:tokens --check` next to the `studio:themes` check. Q50: a small
  contrast round on the below-AA theme values (numbers go to the grill first). Then `components/select`: declare
  controls, option hover with `data-active`, option focus through `aria-activedescendant` (Q48, builder builds the
  CLI side), trigger `active` has no SDK look yet (a design question). `brand-on-light` is a later open point.
- **Token source decision (Tom, 2026-10-30, Q47, source corrected by Tom):** generate `foundations/tokens` from
  `apps/storybook/src/themes.ts` (the existing SDK brand theme, green `0 255 161`, plus `danger` and `warning`)
  and `apps/storybook/src/surface-themes.ts` (`light`, `dark`), not from `calls/components/themes.ts`. Use the
  real SDK theme generators (`libs/core/design/theme-css.ts`), through the product
  `generated` hook Studio already uses; the part only draws, no hand-kept colour CSS. Drop the Tailwind
  `--color-et-*` layer. Include `--et-shadow-color-rgb` and `--et-font-family`. Label `brand`, `danger` and
  `warning` as demo themes of this fixture: the SDK ships no theme names, the app registers them.
- **CLI gap (sent to stream A):** `design complete` checks only merged parts, so a sketch variant cannot prove
  its 4.47 coverage before the merge. Request: `design complete --variant`.
- **Active-descendant focus decision (Tom, 2026-10-30, Q48):** `design complete` accepts focus-visible evidence
  for an option that never takes DOM focus: in a shown surface, the option whose id the control's
  `aria-activedescendant` names counts when its look differs from an unforced, unselected option. Generic ARIA,
  no SDK names in `libs/cli`. No fake `:focus-visible` rule in drawings. Applies to `components/select` and later
  `tree`.
- **Token overview decision (Tom, 2026-10-30, Q49):** the sdk token overview draws a matrix of chips, one per
  theme and state. Pick holds for the round regenerated from the Storybook themes.
- **Contrast decision (Tom, 2026-10-30, Q50):** contrast below AA in the base themes gets its own small round
  after the overview; Tom picks the new values. Measured on the first token set: `danger` hover 3.76:1, `brand`
  ink on dark 3.47:1. Re-measure on the Storybook themes first.
- **Contrast scope decisions (Tom, 2026-10-30, Q51-Q53),** on the Storybook source (53 pairs, 23 fail):
  - Q51: add `brand-on-light`, `danger-on-light` and `warning-on-light` (`apps/storybook/src/themes.ts`) to the
    sdk set; ink on a light surface uses them. No value change. Closes the `brand-on-light` open point.
  - Q52: one colour round, Tom picks the values, for all three remaining fails: on-primary on `danger` fill at
    hover/focus (3.76:1), on-primary on `warning` fill at active (3.57:1), surface `subtle` text on bg (light
    2.58:1, dark 3.78:1). Target 4.5:1; `subtle` stays visibly weaker than `muted`. Touches
    `apps/storybook/src/themes.ts`, `surface-themes.ts`, their generated `apps/storybook/src/styles/*.css`, then
    `yarn sdk:tokens`.
  - Q53: the surface border stays decorative (light 1.26:1, dark 1.73:1). A control whose only boundary is a
    border gets its own 3:1 boundary in its component design, not via the surface border.
- **In progress (ethlete-sdk-33, 2026-10-30):** round 2 on the `foundations/tokens` sketch (Q51 on-light
  themes, Q52 value candidates through a generator override; the source themes change only after Tom's pick),
  and the `components/select` sketch (controls, option states, trigger `active` as variants). Storybook is no
  workspace package, so it needs no changeset.

## Zoom chip tier (Tom, 2026-10-30, Q45)

The zoom chip is `components/zoom-chip`, not `elements/zoom-chip`: an element may not import another element
(`UPWARD-DEPENDENCY`). Before Tom merges r1 (3d00519df): its `−`, `+` and `Fit` buttons are declared controls with
hover, active and focus, and `design complete components/zoom-chip` passes. The zoom values (100 %, 250 %, 25 %)
are content states, not the interaction coverage Q43 asked for.

- **r2 ready (2026-10-30, 1534846c9):** variant b declares −, percent, + and Fit as button controls in 16 states;
  `design complete` passed in a scratch copy with b merged. Not checked by eye. Waits for Tom's merge in Studio.
