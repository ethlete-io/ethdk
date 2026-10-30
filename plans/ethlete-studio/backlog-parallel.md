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

- `components/zoom-chip` r1 "Zoom chip as its own part" (`3d00519df`), with `elements/canvas-frames`,
  `pages/sketches`, `pages/system`: Q43 as `components/zoom-chip`, since an element may not import an element; one
  variant. Question: merge it as a component, or keep it an element that canvas-frames stops drawing?

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
- **In progress (ethlete-sdk-33, 2026-10-30):** sketch `foundations/tokens` in `sdk`. The part is a hand copy
  of old Storybook CSS: themes `accent`/`danger` where the mocks and `calls/components/themes.ts` use `brand`,
  `danger`, `warning`; no `--et-shadow-color-rgb` or `--et-font-family`; a dead Tailwind `--color-et-*` layer.
  Q47 (token source: hand fix or generated from the real themes) is with the grill session.
- **CLI gap (sent to stream A):** `design complete` checks only merged parts, so a sketch variant cannot prove
  its 4.47 coverage before the merge. Request: `design complete --variant`.

## Zoom chip tier (Tom, 2026-10-30, Q45)

The zoom chip is `components/zoom-chip`, not `elements/zoom-chip`: an element may not import another element
(`UPWARD-DEPENDENCY`). Before Tom merges r1 (3d00519df): its `−`, `+` and `Fit` buttons are declared controls with
hover, active and focus, and `design complete components/zoom-chip` passes. The zoom values (100 %, 250 %, 25 %)
are content states, not the interaction coverage Q43 asked for.
