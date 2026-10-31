# Studio design tooling backlog - parallel plan (2026-10-30)

Goal (Tom): finish the open items of `design-system-actions.md` and `motion.md` as fast as possible, without
Tom. Tom is not there to merge sketches: sketch work stops at `ready` and goes onto the merge queue below.

## Builder status (2026-10-30)

- A1 done (`0c4b8a887`). A2 + Q32 done (`0c307a0c3`); F1 done, auto-merged (`e6fcf97c5`). A3-A5, the `STALE-REPLACE`
  false positive, then exceptions and `handoff` run in one subagent.
- D done (`493d1f6f9` 6.7 and 5.60 rule, `c94f3e095` 6.6). F3 and F4 were already built (token in `colors.css`,
  `UTILITY-CSS` in `RULES`). C1 done (`2a90d0cfd`, Inventory toggle on `pages/*` parts; `by` is `designer`). B, E and G slice 5 run; C2
  done (`4b57f37af`); C3 (1.2 re-run) not started; F 5.51 r2 at ready; F 5.32 at ready. G slice 4 done (`eebccd5f6`); slice 5 waits for Q41 (how flow lines
  animate). Queued: A 5.39 after A2-A5; F 5.32 (F2 merged by Tom).
- Tom merged `foundations/colors` r2 and `elements/canvas-frames` + `pages/sketches` r1 (`b47bae5e9`). Q43 (zoom
  chip as its own part `elements/zoom-chip`) is now a new sketch on the merged parts - in progress.
- In progress (2026-10-30): fifagg backdrop close during enter (opus, `libs/cdk`).
- B done: `et design mcp` (`90724234f`), `/__design/motion` (`dacf9bd64`). E done: 5.52, 5.55, 5.56. G slice 5 done
  (`a0ba7dd81`). A: 5.60 (`0652fc1df`), 3.39 (`a9ad0200c`), 5.39 (`c3ad43bcf`) and the `STALE-REPLACE` fix (`1704a6dda`) done.
- `design check` warns `STALE-REPLACE` on `components/button/button.ts` (`replace(/^<(button|a) /)` matches nothing) - as built (`1704a6dda`): a replace on markup a package draws is skipped. Found on the way: `aae2914f3` broke every render of the built CLI
  (`exports is not defined`); fixed in `203aa2c35`.
- Open, not urgent (SDK session): a sketch cannot add a target, and `sketch new` with two targets is refused while one
  has an open sketch, so splitting a part forces a new sketch plus a discard of the old one.
- Paused for the usage limit (2026-10-31). Pushed up to `de9070776`. Landed: MCP registration (`0d81f2066`,
  `2c0d2ad4c`), MCP sketch and `comment reply` tools (`1d05b8789`), `kind: 'field'` (`855f4c06e`, Q61), sketch spec
  timeout (`ab444e8c6`), `.mcp.json` in `.prettierignore` (`de9070776`). Next, in order:
  1. Wait for CI on `de9070776`. CI on `0b239880c` failed in two places: the sketch spec timeout (now fixed) and a
     Timetrack Rust test, `peer.rs:2146` (`last_seen_ms >= started_ms`). Nobody changed `peer.rs` for 3 weeks, so
     the Rust failure is probably flaky; if it fails again, fix it. Then merge version PR #3162 (base `next`), wait for
     the publish, and send `fifagg-frontend-a5` the new `@ethlete/cdk` version (backdrop click during enter closes; the
     second click of a double-click does not).
  2. Viewport per state: built (`e9a7ba58c`). `fitOutOfFlow` in `define-call.ts` grows `#root` to cover absolute and
     fixed descendants after `placeOverlays`. Real sdk select open shot at 320 px checked; live Studio canvas not seen.
     Open for Tom: a frame with a declared width does not grow sideways; content above the root is not added; a
     `fixed; inset: 0` backdrop stretches the frame to the 800 px viewport.
  - Done (2026-10-31): Q66 live canvas frame height in `9e41365d3`; Q69 grid shots follow the Studio colour mode in
    `395fd54b4`.
  - In progress (2026-10-31, opus subagent): sdk `components/form-field` live canvas draws empty cells (CLI shots
    fine); then 1e: the :4402 server survives a `dist/libs/components` rebuild, a 500 shot shows an error state, a
    loading state until the products are indexed, and the ~15 s cold start.
  3. Q60 (Tom): MCP `check` gets `call`/`variant` args; `et design check --receipt <path>`; new MCP tool `call`
     (call.ts, fixture.ts, variant path, frame URL); then delete `tools.rs` and move `cli_entry` into
     `design_server.rs`. One MCP server.
  4. Q64 done (`c70713442`): `fitOutOfFlow` skips a fixed element on all four edges. Q90 done (`9d8ae9723`).
  - Done (2026-10-31, night): 2c grid speed - one reveal per grid (`5970825b3`), page clip + 8 draws at once
    (`0e5f9e106`); 40-cell grid 1.4 s -> 0.75-0.9 s, PNG bytes identical; Rust not needed (Q94). `STALE-REPLACE` on a
    parameter (`c8f060913`). Gone-sketch shots are 404 and leave the footer (`52e3c1812`, `7bd2e50e9`). Q60 one MCP
    server (`932d95e07`, `ca45612b1`, `30bf2e496`, `26090ed81`); Studio chat sends call + variant as tools
    (`8454ff6e0`, one real `claude` turn called `call`; Tauri window and `check` receipt not verified). Flaky timetrack
    peer test was a listener race (`9bb3572a1`). Release published (cdk next.46, core next.71, components next.78).
  - Done: Q92 for part grids (`03a2369fb`, Light/Dark column groups, `frame.html?scheme=` pins the scheme); contrast
    against `z-index: -1` fills (`c1a9ea834`, sdk-33 confirmed on accent-on-light); swap between shot and live page
    without a blank frame (`c96564d46`; blank frames grid live -> shot 5/6 -> 0/6 in Chromium, WebKit 1/6 -> 0/6;
    Tauri WebKitGTK not seen; grid cells still go live one by one, each without a blank).
  - Done: `design complete` knows a composite widget focus container (`5e71b7526`; sdk-33 dropped its menu
    workaround in `b072b382a`, menu a/b design complete).
  - Done (2026-10-31): a grid goes live in one step (`2c7ae20d3`). Every cell keeps its shot until all live cells
    painted, then all switch in one frame; a 3 s timeout switches the painted cells and leaves a stuck one on its shot.
    Headless studio-lab `components/button` (20 cells): going live 2 switch steps -> 1, 0 blank frames before and
    after; back to shots unchanged. Headless run was on the version just before a lint-only reorder; the timeout path
    is covered only by a fake-timer spec.
  - Done (2026-10-31): Q92 for non-grid frames (`aa6165ad5`). Pages, declared-width parts, "used in" pages and flow
    frames draw a Light and a Dark copy; up to 1024 px wide side by side (48 px gap), wider stacked, never shrunk.
    Legacy call shots, cropped, error and empty frames stay single; sketch matrix and merge-preview frames stay
    single (asked the grill). Pins, outlines, comments and picking use the Light copy. Headless studio-lab `library`
    and `add-a-film`: layout, labels, pins and outlines checked; the page renders failed on the scratch server, so real
    light/dark content and a declared-width part on screen are not seen.
  - Done (2026-10-31): 1e CLI side. HEAD renders on a fresh scratch server (studio 254/254, sdk 134/134 shots); the
    earlier failed renders came from a scratch copy without `dist/libs` (inferred). The server watches the
    `render.packages` dirs and redraws after a dist rebuild with no restart (`ec5b5316d`, simulated rebuild only).
    `claimViteCache`: the first command server keeps the shared `vite-check` cache via a pid lock, an overlapping one
    gets its own dir, removed on close (`4fb728034`). Cold start: the tool's own modules leave `optimizeDeps`, so no
    late full reload (`489d2ad17`); first shot 2.4 -> 1.8 s, studio grid 9.5 -> 7.9 s. The bulk of the ~15 s is likely
    Studio's debug `npx nx cli-runtime` (nx + a full `npm install` of a runtime the dev server does not use) before each
    server start (`design_server.rs` `build_cli`) - next slice.
  - Done (2026-10-31): 1e Studio states (`b27437525`). `img[ethleteShot]` tracks loading / slow (> 2 s) / loaded /
    failed per shot copy and per grid cell; failed shows "Render failed" in the error theme, slow a "Rendering" pill;
    a failed cell still settles the grid. Footer says "starting" and the body waits until `/__design/system` answers
    below 500. Headless against a stub server (500 for 8 s, then failing shots): starting -> running, grid cells show
    "Render failed" in Light and Dark. Limits: no HTTP status in the error (img hides it); a restart on the same port
    does not show "starting" again; per-cell slow marker hidden until the grid reveals (as before).
  - Done (2026-10-31): debug Studio runs `npx nx build cli` before a server start, not `nx cli-runtime` (`ca4227c0b`);
    the dev spawn uses `dist/libs/cli`, the runtime copy is only the release fallback. The stale-server check now
    compares against `dist/libs/cli`. Warm: build cli 0.55 s, the skipped runtime install 1.1 s; the uncached numbers
    and a real debug start are not measured. `beforeDevCommand` still runs `cli-runtime` once per `yarn studio`. Closed (2026-10-31, grill decision): measured, ~1.1 s (`nx cli-runtime` 1.6 s warm vs `nx build cli` 0.5 s), not worth a stale fallback CLI for checkouts without their own CLI in dev; no change.
  - Done (2026-10-31): merge-preview frames draw Light + Dark (`075e48532`, `mergePreviewOf` sets `schemes`); the
    sketch matrix cells stay single (its "in context" page frames draw both since `aa6165ad5`). Data spec only, no
    render check.
  - Checked (2026-10-31): real Studio render of Q92 on own servers (scratch HEAD 2066f33b4 with `dist/libs`).
    studio-lab `pages/library` and flow `add-a-film` side by side, studio 1440 px `used in` frames stacked; real
    content in both copies, pins on the Light copy. Light and Dark copies are pixel-identical for studio and
    studio-lab pages: their CSS has no `prefers-color-scheme`, so both draw dark (sdk part shots do differ). No
    declared-width part exists to check. Defect: in narrow phone frames the frame label is clipped with no ellipsis
    ("LIGHT pages/film-deta") - open, small.
  5. Q76: shots get a transparent page like live frames (both colour modes). Q69 landed in `395fd54b4`.
  - Done (2026-10-31): Q76 in `fe61aa1ff`. Shots use `omitBackground` (part and call shots); pixel diffs fill white
    first, so diff counts stay. Real call shot corner is alpha 0 in light and dark. sdk part shots stay opaque: the
    sdk `colors.css` paints `body` with `--et-surface-background-solid`, and the live frame paints the same, so shot and
    live frame match. Not seen in Studio; motion and asset shots unchanged. `et design` honours `DE_PORT` outside
    Studio (`67f8d7924`).
  - Done (2026-10-31): `fitOutOfFlow` counts an absolute element only up to the overflow ancestors in its
    containing block chain (`a516c4c48`; jsdom spec on the real overlay structure, 444 -> 244 px). Real check on a
    fresh own server with the sentinels back in a scratch copy: dialog long-body b, 480 light shot 480x440 (stale
    :4402 gave 480x656). sdk-33 can drop the sentinel workaround from `libs/components/design/dialog.ts` (83e428e99).
  6. Q78: a way to record a regenerated token part (`generate-sdk-tokens.mjs` rewrites sdk `foundations/colors/colors.css`) as merged, so `design check` stops the "changed outside a sketch" warning. A sketch does not fit: CI `sdk:tokens:check` forces the change in the same commit.
  7. Q79: one shared sheet helper per foundation kind in `@design-system` (`libs/cli/design`), like `tokenSheet`; products pass only data. First `iconSheet` with views `catalogue` and `construction` (pixel grid, centre lines, padding box from studio `foundations/icons/icons.ts`), grid size as input (sdk: 24 px, 16 px, Font Awesome 512 units). Studio and sdk icons use it; sdk-33 holds sdk icons until it lands. Then colors, type, spacing, motion, logo. As built (2026-10-31): colors, type, spacing and motion already used `tokenSheet`; `logoSheet({ marks })` added in db8121f27 (spec, docs, cli minor changeset); studio `foundations/logo` `sizes` moved onto it through a sketch, auto-merged with "No visible change in any state" (3a7fc6aa0). The `sidebar` view stays a product drawing; agent-logos unchanged (lead decision).
  8. Agent-rules skill for `et design mcp`. Q59: live-frame drive and token names on tracks, a later motion slice. As built: "The `ethlete-design` MCP server" section in `design-exploration/SKILL.md` (tools by job, `sketch_report` before each edit, `sketch_ready` render check).

## Rules for every stream

- One subagent per stream, run the streams at the same time. Inside a stream, work serially: its items touch
  the same files.
- Each stream commits only its own paths (`git add -- <new files>`, `git commit -- <paths>`). Never `git add -A`,
  stash, amend, reset or `checkout --`.
- A typecheck or build error in another stream's uncommitted file is not yours: check your own files with tsc and
  eslint on changed files, and say so in the report.
- Every lib change: a spec that bites, a changeset, docs (`apps/docs/cli/index.md`), no new lint warnings.
- Record each item as built in its plan section, with the commit.
- **`ready` means final (Tom, 2026-10-30).** A sketch goes to `ready` only when no change to it waits on
  anything: no open decision, no landing helper, no "once X is decided I adapt the sketch". While such a change
  is pending, the sketch stays in work and is not in the merge queue. Put the open question to Tom first, change
  the sketch, then mark it `ready`. A sketch that is `ready` and then gets such a pending change leaves the queue
  until the change is in.

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
3. `ethlete-agents sync` registers `et design mcp` as `ethlete-design` in `.mcp.json` and `.codex/config.toml`
   when `@ethlete/cli` is installed, started through `packageRunner`: built (`0d81f2066`, `2c0d2ad4c`). Specs only;
   no real Claude Code or Codex client started the server.
4. The `motionOf` cache key: no change needed. The motion cache in `shot.ts` has its own key with every field that
   changes the render.
5. Studio chat on `et design mcp`, delete `tools.rs`: blocked. `read_call`, `read_fixture` and `check_call` (with
   its receipt for `call_status.rs`) have no MCP match. Question sent to the grill session.

## Stream C - Studio app (`apps/ethlete-studio/src`)

1. 4.47 slice 2: the inventory approval view (marked page, list, approve button). Starts when stream A step 1
   lands; build the UI against the CLI output.
2. Motion slice 3: keyframe strip and timeline: built (`4b57f37af`). A strip below the part canvas with a row of
   keyframes per motion (preset and reduced toggles); a keyframe opens a read-only timeline. Specs and build only,
   not seen live.
3. 1.2 re-run the 100-cycle frame-reload test: done. 0 hangs in 4000 cycles; Tom closed 1.2 as not reproduced
   (`design-system-actions.md` 1.2, Results 3 and 4).
4. 4.47 exception approval: built (`4a15e30a9`). An Exceptions button on a part lists its pending and reopened
   exceptions (key, reason) with an approve button (`by: designer`). Specs and build only, not seen live.
5. 5.39 empty grid cells: built (`2ec039ddc`). A grid row that draws a state marks each empty column "not drawn".
   Specs and build only, not seen live.

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

- `sdk` `components/select`, round r2 "Final select": merge variant d - Tom's pick b (Q56) with the field frame and
  trigger as `data-et-control-part`. `design complete --variant d` passes and fails without the markers.

- `sdk` `foundations/colors`, round r1 "Colors" (`bee047389`, `ae46cc05b`): merge variant a - the token sheet on `tokenSheet`
  (Q54/Q55) with the Q57 e values and the on-light themes (Q51); no design choice. Then discard the held
  `foundations/tokens` sketch; it is superseded.

After that merge the builder runs `part remove foundations/tokens`, moves `generate-sdk-tokens.mjs` and
`sdk:tokens:check` to `foundations/colors/colors.css`, applies the e values and on-light themes to
`apps/storybook/src/themes.ts`/`surface-themes.ts`, drops `foundations/tokens` from the sdk `tokens` list in
`.ethlete/design/config.json` and the studio `hideBaseParts` entry.

Tom merged `components/zoom-chip` r2 b (`6fef28d85`); `design complete components/zoom-chip` passes.
Tom merged `sdk` `foundations/tokens` r1 c, the token sheet (`d40af99ed`).

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
  `tree`. **Built** in `6b6467a95`: the named option must differ in computed look from a plain sibling (not
  selected, named or forced); the gap says which evidence is missing.
- **Token overview decision (Tom, 2026-10-30, Q49, superseded by the merge):** Tom answered a (matrix of chips),
  then merged variant c (token sheet with name and value) in Studio, d40af99ed. The merge stands: the sdk token
  overview is the token sheet. Drift check: `yarn sdk:tokens:check` in CI and pre-push (9f391f97b).
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
- **As built (ethlete-sdk-33, 2026-10-30):** Tom's merge of the token sheet committed (`d40af99ed`);
  `yarn sdk:tokens:check` runs in CI and pre-push (`9f391f97b`). Sketch `foundations/tokens` "Contrast values"
  d/e/f ready (`a4ef82110`): `generate-sdk-tokens.mjs --overrides <json>` adds extra themes and patches values,
  default output unchanged. Sketch `components/select` "Select controls" a/b/c ready (`276187bd7`); exception
  request withdrawn after Q56 (`fa2bbed44`). Verified: `sketch check`, `sketch preview`, `design complete
--variant` b and c pass. Not verified by eye: the select states, the tokens states other than contrast.
- **Next (builder):** after Tom merges `foundations/tokens` e, move the e values and the three `*-on-light`
  themes into `apps/storybook/src/themes.ts`/`surface-themes.ts` and the generator default set, regenerate the
  Storybook CSS, then `yarn sdk:tokens:check` must pass against the merged CSS. After `data-et-control-part`
  lands (ethlete-sdk-57), replace the select sketch's second `data-et-control` and fake `aria-disabled`. After
  the Q54 helper lands, `foundations/colors`. Storybook is no workspace package, so it needs no changeset.

- **As built (ethlete-sdk-33, 2026-10-30):** sketch `components/form-field` round "Form field controls", variant a,
  input only, on hold (`75bf259ec`): `data-et-control` on `et-form-field`, `data-et-control-part` on the frame and
  the native input, pressed border as Q56 b, declared as `kind: 'button'` for now. Verified: `design complete
--variant a` passes. Not verified: frames by eye. `textarea()` design mock in `@ethlete/components/design/form-field`
  (`7b1011df0`, changeset patch); tsc on a scratch config, not rendered. Hold reasons: (1) `kind: 'field'` in
  progress at ethlete-sdk-57 (pointer needs hover, not active); (2) textarea rows not drawn yet; (3) `sketch check`
  contrast: `danger` label and error text 2.77:1 on light - per Q51 the rows use `danger-on-light` after Tom
  merges `foundations/colors`. Q60 (pending at the grill): drop the pressed look on text fields (recommended).
- **As built (ethlete-sdk-33, 2026-10-31):** Tom merged `foundations/colors` (`7520c12ec`). The Q57 values and the
  three `-on-light` themes are in `apps/storybook/src/themes.ts`/`surface-themes.ts`, the generator default set
  and its default `--out` is `foundations/colors/colors.css`; `yarn sdk:tokens:check` passes (`2edcd1eed`).
  Form-field: `kind: 'field'` (57, `855f4c06e`), textarea rows, no pressed look (Q61) (`827fe33d0`), errors in
  `danger-on-light` (`86788394d`); `sketch check` and `design complete --variant a` pass. After 57's per-state
  viewport fix (`e9a7ba58c`) the select open panel shows all options; select r2 d is ready again (`bbcef9574`).
  Verified by eye: both shots at 320px.
- **As built (ethlete-sdk-33, 2026-10-31):** Q65 built in `c5309a6b2` (`libs/components`, changeset, docs): an
  error only remaps the text shell's colour variables to the error theme; Q67 accepted the result. Form-field r1 a
  is ready (`27fa0a925`). Waits on Tom: merge select and form-field; discard the held `foundations/tokens` sketch,
  then `part remove foundations/tokens` and drop it from the sdk `tokens` list and studio `hideBaseParts`.
- **Next:** `components/tree`, then `switch`, then the tooltip.

- **As built (ethlete-sdk-33, 2026-10-31):** old `foundations/tokens` part removed (`7fb6b115b`). Tree mock
  (`22ff6ee3a`) and sketch `components/tree` r1 a (`56ee3fa61`, on hold). Q70: the tree focus outline uses
  `--et-theme-color-ink-solid` (`bad4fc3df`, changeset, docs); not shot yet, then release + ready the tree sketch.
- **In progress (ethlete-sdk-33, 2026-10-31):** Q68 icons, one subagent: slice 1 ships
  `libs/components/src/lib/icon/headless/*-icon.ts` to dist (ng-package assets, import-free `IconDefinition` type
  file) and replaces the inline SVG copies in `libs/components/design/*.ts`; slice 2 draws sketch
  `foundations/icons`. Cause: the design tool loads the mocks from `dist/libs/components`, which ships only
  `design/**/*.ts` and CSS, so a mock cannot import an icon file today.

- **Queued (Tom, Q71):** after Q68, new part `sdk/components/select-panel` (option grid: rest, hover,
  keyboard-active, selected, selected+hover, disabled; panel with option groups and select-all). The select part
  then composes form-field + select-panel; its open states stay only as an example. `et-select-option` is shared
  with page-size-select and phone-input.
- **As built (2026-10-31):** Tom merged `select` r2, `form-field` b and the Q86 fill round c (light filled
  field 240). Q83/Q86: `LIGHT_ELEVATED_SURFACE` background is 240; `generate-sdk-tokens.mjs` adds the light and
  dark elevated surfaces and a `[data-et-surface-fill]` rule that takes the elevated surface of the scheme, so the
  form-field part has no variant CSS. Q71 select-panel mocks and sketch r1 a; Q87/Q88: option check and
  keyboard-active outline in ink, selected option check only (patch changeset, docs, e2e). Icons: Q68 shipped
  the icon files to dist; `foundations/icons` r1 a draws with `iconSheet` (Q77/Q79). Q85: the components build
  stages `.ethlete/design/sdk` (no tsconfig, sketches, comments, accepted/merged.json) plus a `design/config.json`
  with `products.sdk` through `tools/scripts/stage-design-base.mjs`; a consumer outside the repo extends
  `node_modules/@ethlete/components/design/sdk` and passes `design check` (with the CLI fix `0126f0950`).
- **Next:** Tom merges `tree`, `select-panel` and `foundations/icons`. Then Q80: a grid round for the icons
  (the set mixes 16 px, 24 px and 512/576/640-unit grids), Tom picks, redraw the off-grid icons in
  `libs/components/src/lib/icon/headless/` with a changeset. Then `components/switch` and the tooltip. No
  Storybook or `dist/libs/components` rebuild while Tom reviews in Studio: a rebuild breaks his live canvas.

### Foundation sheet decisions (2026-10-30)

Tom asked why `sdk/foundations/tokens` looks so different from the Studio foundations. Cause: Studio draws its
five foundation parts with `studio/shared/token-sheet.ts`, reachable only through Studio's `@shared` alias; the
sdk part has its own drawing code and hand-typed value labels in `sdk/foundations/tokens/tokens.ts` next to a
generated CSS file.

- Q54: the foundation sheet helper moves into the design tool (`@design-system`, `libs/cli/design`), so every
  product (studio, sdk, studio-lab) draws its foundations with it and they look the same. Not the wireframe kit
  (`@design-system/kit`, on hold). Studio's parts switch to it; `studio/shared/token-sheet.ts` goes away.
- Q55: the sdk follows the Studio split: `foundations/colors` now, `type`, `spacing` and `motion` once the SDK
  has real values for them. Labels come from the generated CSS through the helper, never hand-typed values.
- Q54 built: `tokenSheet` is public in `@design-system` (`1ac18dd31`); Studio's four foundation parts use it, the
  sketch merged automatically with no visible change, and `studio/shared/token-sheet.ts` is gone (`acf0a439f`). The sdk
  split (Q55) is open.

### Select and contrast value decisions (2026-10-30)

- Q56 (`components/select`, round "Select controls", 276187bd7): variant b. The pressed trigger darkens the
  field border to `--et-surface-interaction-active-solid`; it differs from focus and needs no exception. Drop the
  `components/select.select.active` exception request.
- Q57 (`foundations/tokens`, round "Contrast values", a4ef82110): variant e. `danger` hover fill `185 28 28`
  (6.47:1), `danger` active fill `153 27 27` (8.31:1), `warning` active fill `251 191 36` (10.74:1; press
  lightens, accepted), surface `subtle` light `112` (4.95:1), dark `135` (4.99:1). Apply to
  `apps/storybook/src/themes.ts` and `surface-themes.ts`, regenerate the Storybook CSS, then `yarn sdk:tokens`.

### Motion, MCP and field decisions (Tom, 2026-10-30)

- Q58 (motion slice 3, `4b57f37af`): the keyframe strip stays a panel below the canvas, not a row inside it.
- Q59: the timeline driving the live frame (needs an outside switch into the frame) and token names on the
  tracks go into a later motion slice.
- Q60 (Stream B, Studio chat on `et design mcp`): one MCP server. The MCP `check` tool gets `call` and `variant`
  args, `et design check` gets `--receipt <path>` (the CLI writes the receipt `call_status.rs` reads), and a new
  MCP tool `call` returns call.ts, fixture.ts, the variant path and the frame URL. Then
  `apps/ethlete-studio/src-tauri/src/tools.rs` goes and `cli_entry` moves into `design_server.rs`.
- Q61 (`components/form-field`): `input` and `textarea` have no pressed look (hover, focus-visible and disabled
  stay); the select keeps Q56 b. Matches `kind: 'field'` (hover, no active).
- Q65 (`components/form-field`, error field showed no hover or focus change): none of the offered options. Inputs
  get no focus ring. An error only switches the field's colour theme from the normal one to the error theme
  (`injectSemanticColorTheme('error')`); hover, focus and the other states then take that theme's colours by
  themselves. Fix in `libs/components/src/lib/forms/form-field/form-field-text-shell-styles.component.css:245`:
  the `[data-error]` rule must not pin `border-color` to `--et-theme-color-primary-solid` over every state; it
  sets the theme, and the normal state rules read it. Changeset patch, docs note.

### Viewport per state (Tom feedback, 2026-10-30)

Each state is drawn in a viewport that fits that state, not one size per part. Seen on sdk `components/select`
at 320 px: the open panel is cut off at the closed trigger's height. The same holds for a field with a hint or
error versus one without, and for each size and variant of a part. Content outside the normal flow, for example an
open overlay panel, counts towards the state's size. Fix it in the tool and Studio, not per sketch.

Built in `e9a7ba58c` (`#root` grows to cover absolute and fixed content). Tom's decisions on its edges:

- Q62: a frame with a declared width does not grow sideways; a wider overlay is cut.
- Q63: content above the root (a `top` placement) is not counted; add it only when a part needs it.
- Q64: elements that fill the whole viewport (`position: fixed; inset: 0`, for example a backdrop) are skipped
  in the measure. Built in `c70713442`.
- Q66 (2026-10-31): the live Studio canvas does not fit the frame yet. After a Studio restart, select
  `open-option-hover` at 320 px is only a little taller than the closed field, and the open panel scrolls inside the
  frame. Shots are fine. `ethlete-sdk-57` fixes it now, despite the usage limit, because it blocks the select merge.
- Q69 (2026-10-31): static images in the Studio grid render in light mode while live iframes follow the dark Studio,
  so one grid (sdk button, states by interaction) mixes two colour modes. A static image always takes the colour mode
  of the live iframe. `ethlete-sdk-57` fixes it now, next to Q66, despite the usage limit. Built in `395fd54b4`.
- Q76 (2026-10-31): in light mode a shot gets an opaque white page while a live frame is transparent over the dark
  canvas. Shots get a transparent page like live frames. Later slice, after the limit reset.

### Form-field error colours decision (2026-10-31)

- Q67: accepted as built in `c5309a6b2`. In error, the field only remaps its colour variables to the error theme.
  Rest border is error primary at 50%, hover is error ink, focus-visible is error primary. Label and error text stay
  ink. No focus ring. Hover and focus-visible are close, which is fine: a keyboard user sees rest to focus-visible.
  The sdk form-field sketch goes to ready.

### SDK icons foundation decision (2026-10-31)

Tom merged sdk form-field and discarded the held `foundations/tokens` sketch. Select already builds on form-field
(`formField(...)` from `libs/components/design/form-field.ts`), so it takes form-field changes.

- Q68: new part `sdk/foundations/icons` shows every icon the SDK ships, read directly from
  `libs/components/src/lib/icon/headless/*-icon.ts`. The design drawings take their icons from the same source; the
  inline SVG copies (for example `CHEVRON_ICON_SVG` in `libs/components/design/select.ts`) go away. One source per
  icon. Built by `ethlete-sdk-33`. Drawings cannot import the headless icon files yet, because the package ships only
  `design/**/*.ts`; the packaging is fixed first.

### Tree focus ring decision (2026-10-31)

- Q70: the tree focus ring (`.et-tree-node:focus-visible`, `.et-tree-status:focus-visible` in
  `libs/components/src/lib/tree/tree.component.css`) uses `--et-theme-color-ink-solid` instead of primary. A light
  primary on a light surface gave about 1.3:1, below the 3:1 for focus indicators; ink gives about 5.5:1. The tree
  uses real DOM focus, so the ring is the only focus sign. Follows the "ink on light" rule.

### Select panel part decision (2026-10-31)

- Q71: the select's open panel gets its own part `sdk/components/select-panel`: a grid for the option (rest, hover,
  keyboard-active, selected, selected + hover, disabled), plus the panel with option groups and the select-all
  option. The select part is then form-field + select-panel; its `open` states stay only as an example of the two
  together. Same pattern as form-field: `et-select-option` is also used by page-size-select and phone-input. Built by
  `ethlete-sdk-33` after the limit reset and after the icons foundation. The select r2 d merge does not wait for it.
- Q72: the sdk form-field part shows its variants one axis at a time. Each axis gets a group of rows (appearance
  box/underline, fill transparent/filled, labelMode static/inline/floating-inside/floating-outside, size sm/md/lg);
  each row is one value with the other axes at default, with the interaction states in the columns. Not all 48
  combinations; a hard combination (for example underline + floating-inside) can come later as a single row. Select
  shows only the default variant, because its variants come from form-field. After the limit reset.
- Q73: the sdk design product ships with `@ethlete/components`. `.ethlete/design/sdk/` stays the working place in
  Studio; the build copies it into the package (for example `design/sdk/`). The drawings stay in
  `libs/components/design/`, next to their `*.design.spec.ts`, which compare drawing and real DOM. Another repo uses
  the product by pointing `"base"` in its `.ethlete/design/config.json` at the folder in `node_modules`, the same way
  `studio` uses `"base": ".ethlete/design/sdk"`. Before the build, `ethlete-sdk-33` checks what a consumer needs to
  resolve the part imports (`@design-system` from `@ethlete/cli`, `@ethlete/components/design/*`). After the limit
  reset.
- Q74: 8 shipped icons draw stroke paths without `fill="none"` and render filled (clipboard-check, floppy-disk,
  pencil, arrow-up, arrow-right, arrows-left-right, plus, underline). The real `et-icon` shows the same, so it is an
  SDK defect. Fixed in `libs/components` as a patch; then `foundations/icons` r1 a goes to ready.
- Q75: `design check --product sdk` showed 12 CONTRAST lines on button outline/tonal/transparent labels (1.0-1.33:1):
  `foundations/colors/colors.css` kept the mint ink `0 255 161` on `:root` / `.et-color--brand` under
  `prefers-color-scheme: light`. Under the light scheme `:root` takes the brand-on-light ink (`4 120 87` and its
  states), per "ink on light". The button part does not move onto `et-color--brand-on-light`; that would hide the
  defect from consumers.
- Q78: a regenerated token part (`generate-sdk-tokens.mjs` rewrites `colors.css`; CI's `sdk:tokens:check` forces the
  base change in the same commit) cannot go through a sketch. Tom accepts the "changed outside a sketch" warning for
  the Q75 commit. After the reset, `ethlete-sdk-57` adds a way to record a regenerated token part as merged.
- Q79: every kind of foundation gets one shared sheet helper in `@design-system` (`libs/cli/design`), like
  `tokenSheet`. A product passes only its data and builds no foundation layout of its own: icons, colors, type,
  spacing, motion, logo. First `iconSheet` with the views `catalogue` and `construction` (taken from
  `studio/foundations/icons`: pixel grid, centre lines, padding box), with the grid size as an input; the SDK icons
  use three grids (24 px: 25 icons, 16 px: 15, Font Awesome 512 units: 10). Studio and sdk `foundations/icons` both
  use it; sdk `foundations/icons` stays on hold until it lands. Built by `ethlete-sdk-57` after the reset.
- Q80: all SDK icons move onto one grid. After `iconSheet` lands, `ethlete-sdk-33` opens a sketch round on sdk
  `foundations/icons` with the construction view on candidate grids, and Tom picks the grid. Then the icons not on it
  are redrawn in `libs/components` (for example the Font Awesome chevron, check and times), with a changeset.

### Form-field variant rows and SDK design shipping decisions (2026-10-31)

- Q81: the sdk form-field variant rows (sketch r1) take variant b, the fields with the value "Ada Lovelace".
- Q82: the grid gets row-group headers, for example "Size" over `size-sm`, `size-md`, `size-lg`. Built by
  `ethlete-sdk-57`.
- Q83: `fill-filled` looks the same as `fill-transparent` on the light surface. `ethlete-sdk-33` finds the cause and
  shows Tom candidate light-mode fills in a sketch round; Tom picks the colour.
- Q84: a forced `focus-visible` state also sets `:focus-within` on the ancestors, so a floating label floats as in the
  real app. Built by `ethlete-sdk-57`.
- Q85: shipping the sdk design product (Q73). `ethlete-sdk-33` copies `.ethlete/design/sdk` into the package as
  `design/sdk/` (without `tsconfig.json`, `sketches/`, `comments/`, `accepted.json`, `merged.json`) plus a
  `design/config.json` with `products.sdk`, after the select-panel slice. `ethlete-sdk-57` makes the CLI default
  `render.packages` to `node_modules` when the repo has no `dist/libs` (a consumer only sets `"base"`), writes no
  generated `tsconfig.json` into a base outside the repo, and resolves `@system/*` for a base in `node_modules`. Then
  `ethlete-sdk-33` tests a consumer against a packed tarball.

### Select panel option decisions (2026-10-31)

- Q86: Tom picks the light filled-field fill (Q83 round, a 250 / b 245 / c 240 / d 235) by merging a variant in
  Studio. A sketch-round pick is never a grill question. Tom merged c: the light elevated surface background is
  240 240 240.
- Q90 (Q78, built 9d8ae9723): the product `config.json` lists generator-owned files, for example
  `"generatedFiles": ["foundations/colors/colors.css"]` (not `generated`: `DesignProduct.generated` already names
  the stylesheet generators). A base part is hashed with the base's own list. The part hash skips them, so a `yarn sdk:tokens` run never marks
  the part changed. A hand edit to `colors.ts` still does. CI `sdk:tokens:check` guards the generated file. Built by
  `ethlete-sdk-57`.
- Studio footer status (Tom, 2026-10-31): the footer gets a status line that shows the render queue (for example
  queued, rendering, slow or failed shots), so a slow or blank canvas is visible as such. Built in `d8125345d`
  (`GET /__design/queue`) and `3c02e86a1` (footer line, red "N failed" with a tooltip). Verified on an own server;
  not verified in the Tauri window.
- Studio render speed (Tom, 2026-10-31): a grid of cells must appear at once, not cell by cell. Measure first. Tom:
  "throw rust at the problem" - Rust in the Tauri host is welcome for the hot path (shot cache, render queue, image
  work, hashing) where the numbers show a gain.
- Q92: every part in Studio shows both colour schemes side by side, light and dark as two column groups, so a
  contrast fault in either scheme is visible without a switch. No toolbar switch, and no doubled `-light`/`-dark`
  states in parts. Built by `ethlete-sdk-57` (live canvas and shot route `scheme=`).
- Q80 pick (Tom merged b): all SDK icons move to the 16 px grid with 1 px padding. 16 icons are on it, 38 are
  redrawn in `libs/components` with a changeset.
- Q87: the option check icon uses the ink token (in the light scheme the brand-on-light ink), not primary mint. Same
  rule as Q75.
- Q88: a keyboard-active option gets the ink focus outline, like the tree row (Q70), so it differs from hover. A
  selected option stays check only, with no background.
- Q89: `design complete` counts the keyboard-active option look (`data-active-source="keyboard"`) as focus-visible
  for the select, menu and row kinds. No per-sketch exception. Built in `c230a42e3`: an option with
  `data-active-source="keyboard"` counts like one `aria-activedescendant` names; a `row` control with it counts
  against a plain row. Verified with a unit spec and a browser fixture (failed before the scan passed the flag on).
- Q85 consumer test (sdk-33): a product that extends a base drew without the base's tokens. Built in `0126f0950`:
  a product without `tokens` takes the base's. Verified: `design check --product app` in `/tmp/q85-consumer` gives
  `ok`. Shots there not re-checked by the builder.

### Overnight decisions (Tom, 2026-10-31)

- Q93 (was Q91): a selected tree row in the light scheme gets a stronger background tint, no edge bar. Built as a
  sketch round on sdk `components/tree`; Tom picks by merge.
- Q94: no Rust for render speed. The 2c measurement showed the time goes to Chromium and Vite, not the host.
  Reopen only if a new measurement shows a host hot spot.
- Q95: elevation on dark surfaces gets a sketch round on sdk `foundations/colors` (or the elevation part): a) a
  1 px light ring from a surface-theme token, b) stronger shadows in the dark scheme only, c) a top-edge
  highlight. No variant changes the background (one background per surface theme).
- Q96: overnight the grill session decides alone only inside existing rules (token choice, spacing on the
  grid, states after a decided pattern) and records each one here. New looks become sketch rounds. No builder
  merges a round; merging stays with Tom. Risky points (public API, breaking change, release) are noted for Tom
  with a recommendation.
- Tom: keep the tree committed, push from time to time, and check CI.
- Grill decision (inside Q51): the switch focus ring uses the ink token, like the tree focus ring. It is part of
  the switch round `f49f5ab8a` (all variants). The light on-track fill (primary, 1.33:1 on the light panel) gets
  its own round later.
- Tom: the swap between the live iframe and the shot image (both ways) flickers. Optimise it: keep the old view
  until the new one has painted, then switch in one step. Queued for `ethlete-sdk-57`.
- Grill decision (inside Q60): Studio chat sends `tools: null`, so the one MCP server never starts from Studio.
  Wire it now; the chat prompt names the call and the variant. Queued for `ethlete-sdk-57`.
- Q93 round ready: sdk `components/tree` r1 "Light selected row tint" (`0a75f4f34`), builder pick b
  (32/38/44 %, ink 4.74-4.56:1). A pure tint stops at about 1.2:1 against the panel (ink falls under 4.5:1 above
  47 %). Grill decision: add variant d now (56-64 % tint with a darker selected-row ink), so Tom sees the full
  range in one review.
- Q93 variant d added: 56/60/64 % tint, label ink 80 % mixed with black (ink vs fill about 6:1, fill vs panel
  1.27:1). A merge of d needs a darker selected ink (new generator token or a color-mix in tree.component.css).
- Q95 round ready: new part sdk `foundations/elevation`, r1 "Dark elevation edge" (`466dfc5b5`), dark only. Edge
  vs base / pane on panel: today 1.76/1.50, a ring 2.61/2.22, b shadows 1.92/1.86, c highlight 1.76/1.50. Builder
  pick a. Grill decision: add variant d, the ring at the strength that reaches 3:1 (about 29 %). A merge needs a
  lib change: generator emits `--et-surface-ring` per surface theme (light = border); select-panel, floating
  panels and the menu use it.
- Generator bug: in foundations/colors `colors.css`, `.et-surface--default-dark` sits in both the dark and the
  dark-elevated blocks, so the dark-elevated values win. Grill decision: a round for Tom (a today, b fixed), not a
  silent fix, because tonight's merges were reviewed against today's look.
- MCP from Studio chat wired in `8454ff6e0` (real haiku turn called `mcp__studio__call`; Tauri window not
  verified). Open for Tom (Q97): Studio has no selected call/variant, so the /agent chat page has two text inputs,
  Call and Variant. Builder recommendation: open the chat from a call's view with both filled in, and drop the
  inputs.
- Q95 variant d added: ring at 30 % (3.12:1 vs the base, 2.64:1 vs the panel fill). Builder pick stays a (quieter).
- Tooltip round ready: sdk `components/tooltip` r1 "Pane edge" (`058c0fd85`). In dark the fill equals the base
  (1.00:1); only the 1 px border marks it (1.73:1). b = `--et-surface-ring` at 24 % (2.12:1), c = 35 % (3.1:1).
  Light unchanged. Builder pick b. Open for Tom (Q98): decide the dark ring once for elevation and tooltip. For
  WCAG 3:1 one mix does not fit both (elevation needs 30 % over the fill, tooltip 35 % over the base): use 35 %
  for both, or per-surface values in the generator.
- Generator bug, revised: cause `tools/scripts/generate-sdk-tokens.mjs:56` keeps `isDefault: true` on the
  elevated surfaces. No sdk part uses `.et-surface--default-dark`, dark shots of a and b are byte-identical. Grill
  decision: fix the generator directly (no visible change). The round on foundations/colors (`a862255fc`) is moot;
  only Tom discards it in Studio (morning list).
- Q92 built in `03a2369fb` (Light and Dark column groups, `frame.html?scheme=`; Tauri window not checked). Grill
  decision (inside Q92): non-grid part frames (pages, declared-width parts, flow frames) also show Light then Dark,
  side by side, or stacked when a frame is too wide for two in a row. Legacy call shots keep the Studio colour mode
  (Q69). A part without a dark scheme still shows both groups, so the fault is visible.
- Switch r2 "On track in light" ready (same sketch, assumes r1 pick b). d (pick): mint fill + 1 px ink inset
  ring (5.48:1), ink dash and thumb; e: on track filled in ink, light loses the mint.
- Mint under 3:1 in light is one system question (like Q75/Q87): `ethlete-sdk-33` scans libs/components and
  proposes one rule with variants instead of one round per part. For Tom as Q99.
- Noted for Tom, low priority: the choice-field label line box clips by under 1 px at sm and lg (line-height
  1.2, overflow hidden). No glyph is cut.
- Q92 non-grid frames built (`aa6165ad5`). Lead decisions under Q96: keep the 1024 px side-by-side threshold;
  merge-preview frames also draw Light + Dark (they show what lands); the sketch matrix stays one copy (a variant
  comparison, already wide).
- Q59 lead decisions under Q96: 6a shows the first token with the track's value in foundations declaration order,
  plus "+N" when more tokens share it; the title lists all names and the raw value. 6b: opening the timeline makes
  the frame live and drives it; closing it leaves the frame live, resumed at 1x.
- Q59 6b built (`840272d27`). Lead decisions: keep the hidden keyframe image and the "in the live frame" header;
  a preset or Reduced change makes the new frame live too; opening the timeline focuses the driven frame. For Tom:
  only the first colour-scheme copy is driven, and a `from` state in a part grid cell keeps images (both accepted
  for now).
- `sketch ready` vs render issues (found on description-list): ready runs only static checks, so a render OVERFLOW
  passes. Lead decision under Q96: ready runs the render check and refuses on a render issue, also one the product
  part already has, unless a `data-et-skip` mark names it; no browser prints "RENDER CHECK SKIPPED" and accepts.
- Grid reveal with a hung shot (found in the 6b check): reveal waits only on image load or error, so a shot that
  never answers hides the grid forever. Lead decision under Q96: reveal once every cell is loaded, failed, or in the
  existing slow state (over 2 s), so the user sees per-cell slow marks.
- Q59 6a token names: Jost renders "--" as an en dash. Lead decision under Q96: token names use font-mono, like
  the element name above them. As built ("Show motion token names in the mono font"): a token name gets
  `font-mono`, a raw value keeps the body font. Spec checked to fail without the fix; no real-browser check.
  As built ("Reveal a Studio frame grid when a shot is slow"): a cell settles when its shot turns slow and keeps
  the failed min size. Chromium, studio-lab `components/button` with the 5 solid light shots held: the grid revealed
  at ~2.3 s with those 5 cells "Rendering", the rest drawn; released, they swapped to loaded.

### Input and textarea decisions (Tom, 2026-10-31)

From input r1 (`da383db15`) and textarea r1 (`4bacbaf9b`). Asked in chat as Q104-Q116 by a fresh grill session
that missed the handoff; renumbered here because Q104/Q105 were already taken.

- Q106 (L1): `et-form-field > et-description` gets the same inline-start padding as hint and errors. Patch.
- Q107 (L2): `.et-input-native::-webkit-search-cancel-button { appearance: none }`. Patch. No et- clear button until
  a case needs one.
- Q108: every input frame is at least 3:1 against its surface, also in error; error uses the full danger tone.
  Follows Q42 (inputs keep their own 3:1 tokens).
- Q109: the placeholder is at least 4.5:1 and still lighter than the value.
- Q110: readonly needs a visible signal that is not only a colour; a dashed frame is the candidate.
- Q111: focus is always the strongest input state: a 2px frame in ink or accent, no halo ring (focus stays on while
  typing). Hover is a small step over rest, only on unfocused fields; a focused field does not change on hover.
- Q112: a text prefix (for example "€", "https://") sits about 4px from the value; an icon prefix keeps the full
  affix gap.
- Q113: the required marker is not exempt (checkbox r1 only listed it as open). It needs 4.5:1, so the danger text
  tone gets lighter in dark. Applies to all form fields.
- Q114: rules Q108-Q113 are drawn first as an r2 round of input and textarea (plus checkbox and radio shots for the
  danger text), then built in one lib commit after Tom merges.
- Q115 (L3): textarea padding-block centres the first line like the input (13.5px at md). Patch; the changeset says a
  rows=1 textarea grows by 15px.
- Q116 (L4): `[data-resize='vertical']` gets `min-block-size: 1lh`. Patch.
- Q117: keep the browser resize grip; draw its position (corner vs 13px inside) as an r2 variant.
- Q118: no fade on scrolled textarea content; text scrolls to the frame edge like a native textarea (r2 variant).

### Morning decisions (Tom, 2026-10-31)

- Q97 rejected: the Studio chat's Call/Variant inputs and the MCP `call` tool build on the old `.ethlete/design/calls`
  system (last touched 2026-10-26). Tom: "calls? das ist doch das alte system". Follow-up question open.
- Q98: one dark ring mix for elevation and tooltip, 35 % `--et-surface-ring`. Condition from Tom: the builder first
  reads the theming skill (surface system, including auto surface) and checks that panes and tooltips also look good,
  not only pass 3:1.
- Q99: rule a. In light, edges, rings, focus rings, indicators, dots, text and icons use ink; mint fills stay with a
  1 px inset ink edge; buttons keep their mint fill. Dark unchanged.
- Q100: hover and error borders in primary are a lib bug; error resolves through the semantic error theme. Patch.
- Q101: a filled et-button hovers to the theme's `-active` token; pressed goes 16 % further (button r1 b).
- Q103: a product without a light scheme (studio, studio-lab) draws one colour-scheme copy.
  As built (builder 57, 2026-10-31): a product declares `schemes` in `.ethlete/design/config.json` (`["light"]`,
  `["dark"]` or both; inherited from its base; both when absent; a bad list is a `SCHEMES` problem and falls back to
  both). `studio` and `studio-lab` declare `["dark"]`. `/__design/system` sends the list; every frame kind that had
  two copies draws one, pinned to `?scheme=dark`, with no scheme label or Light/Dark grid heading. A Studio on an
  older CLI keeps both copies. Verified: 7 new specs failed at HEAD and pass (Studio 411, CLI design 878 tests), tsc
  and lint clean, the real config resolves `studio`/`studio-lab` to dark and `sdk` to both. Not verified: a running
  Studio; the :4402 server serves `schemes` only after a restart on the new CLI.
- Q104: a stat-tile without a success theme falls back to the inherited theme with a dev-mode warning. Patch.
- Q105: the floating trigger gets a light shadow only while it floats, faded in with opacity only.
- Q119 (otp, 33's "Q103"): filled and empty otp segments look the same; every segment gets the 3:1 input frame
  (Q108). Caret and focus frame show the next segment.
- Q102: the Q99a inset ink edge draws only in light. In dark ink is mint (13.50:1), so the edge adds a second line
  and no contrast. Applies to every part.
- Q120 (replaces Q97): calls are legacy and go away once the existing calls are migrated. The Studio chat becomes a
  new, global system: one chat that stays open while Tom moves between pages, parts and sketches. When the agent
  opens a sketch, the same chat goes on; no new chat per view. Details (how the chat learns the current view) are
  the next grill round.
- Slider r1 (`63d4f261a`) lib bugs, all patches: Q121 (S1) the value bubble no longer covers the label (host flag
  when a thumb label template exists, 18px block-start space). Q122 (S2) the range slider's interaction box is
  `max(44px, var(--et-slider-thumb-size))` like et-slider; the changeset says it grows by 16px. Q123 (S3) vertical
  tick labels get a grid column sized to the longest label. Q124 (S4) end bubbles and tick labels clamp at the ends.
- Q125: slider contrast rule: the thumb is at least 3:1 against the page and the rail; the fill is at least 3:1
  against the rail; the rail itself may stay light (a dark rail takes the fill's contrast away).
- Q126: an invalid slider gets no own mark; the error text under the field carries it, like every form field.

### Global Studio chat decisions (Tom, 2026-10-31)

Follows Q120. Built on products, parts, sketches and variants; nothing on legacy calls.

- Q127: like Copilot, every message carries the current view as context automatically: product, part, sketch,
  variant, and the selection when one exists (a clicked frame or state). A chip above the input shows it; one click
  removes it.
- Q128: the agent navigates smartly. If Tom asked for something on view X and is still on X (waiting), Studio opens
  the result directly. If Tom has moved on to other work, the chat shows a link instead. The chat stays open either
  way.
- Q129: the chat is a collapsible panel on the right that survives navigation. The `/agent` page goes away.
- Q130: one running chat with a "New chat" button; a list of old chats only when Tom asks for it.

### Studio MVP scope (Tom, 2026-10-31)

The yardstick for every new task. Tom: "ziel 1 war Studio zu nutzen um Studio zu designen um Studio dadurch besser zu
machen".

- Q131 MVP: Tom designs Studio's own UI in Studio, with agents. Every friction he finds becomes a fix to the tool.
  The MVP is done when all Studio pages are designed this way and merged.
- Q132 SDK rounds: no new sketches that Studio does not need. Studio uses button, form-field, select, input,
  textarea, tree and slider. Open rounds and their findings and lib fixes are finished; other open rounds wait for
  Tom's merge after the MVP.
- Q133 builder 33: after the slider fix, the input/textarea r2 rounds and the open findings, draw Studio pages and
  Studio parts as sketches for Tom to review in Studio.
- Q134 builder 57: finish the shot invalidation bug (friction). Build the global chat up to the view-context chip
  (Q127). Smart navigation (Q128) is after the MVP.
- Q135 after the MVP, unless one blocks Tom while he designs Studio (then it is friction and in scope): CEF runtime,
  more motion work, the SDK catalog in Studio, existing-code import, the git-free designer workflow, the old-chats
  list, wireframes.
- Q136 shot cache on disk (Tom, 2026-10-31, option b): build it now, before the view-context chip. Today the shots
  live only in memory, so a Studio restart (an edit under `src-tauri/**`) re-renders every part. The disk cache must
  keep shots across a restart and still invalidate on a render-path change (same rules as the in-memory key after
  the sha1 fix `42392387e`).
- Q137 builder 33 order (Tom, 2026-10-31, option a): the SDK rounds Studio needs, then the Studio pages and parts as
  sketches (Q133), then the other SDK components. This lifts the Q132 stop on new SDK sketches for the time after
  the Studio sketches.
- Lead call (Q96, 2026-10-31): chat MVP scope pushed (Q127 in `9d6a2789d`). Builder 57 next: (1) close the two Q127
  context gaps (no part source path; the context sends the picked variant, not the variant Tom looks at); (2)
  dogfood the MVP loop on its own ports and fix plain bugs, sending new looks or behaviour as questions.
- Q138 floating-action over a grey row (Tom, 2026-10-31, option b): the floating trigger gets the Q99a 1px inset
  ink edge in light only, for 3:1 against a light grey row (today the fill is 1.13, the Q105 shadow 1.19-1.46). Dark
  stays as is (fill 10.96). Round re-check `c3807b19f`.
- Q139 error-theme hover tones (Tom, 2026-10-31, option b): a hover in the error state uses the theme's next stronger
  tone (`-active` instead of `-hover`), the same rule as Q101 for filled buttons. Today the checkbox error hover is
  2.77 on dark and the text-field hover ink about 2.8 on white. No theme generator change.

### Input/textarea r2 and chat dogfood decisions (Tom, 2026-10-31)

From input r2 (`6760644ee`, checkbox/radio `93a856190`), textarea r2 (`478d57480`) and builder 57's dogfood run.
Tom took every recommendation.

- Q140 focus colour, input and textarea alike: the surface text colour (17.9 light / 17.2 dark) for the 2px focus
  frame (input variant e, textarea variant d). The theme ink (5.48 light) loses to the light hover (6.69), against
  Q111.
- Q141 readonly signal: dashed frame (variant d). No lock icon; the lock already means "secret" on the API key field.
- Q142 readonly focus: a 2px dashed frame in the focus colour (Q140). Today the lib draws no focus frame there.
- Q143 rest frame: input and textarea use the same value, the input one (4.74 light / 6.94 dark).
- Q144 textarea resize grip in the corner (variant d), so text scrolls to the frame edge (Q118).
- Q145 Studio brief for the chat agent through `--append-system-prompt` in `agent_claude.rs`: how to check a change
  (`et design check`, a shot), no changeset for design files, use the product type tokens. Rust edit, Studio restarts.
- Q146 the brief points at the foundations/type part (`font-ui-medium`, `font-ui-strong`). No check warning yet; add
  one only if the agent still uses raw font classes.
- Q147 chat messages render a markdown subset: code, bold, lists. No tables, no images.
- Q148 a click on a part grid cell selects that state; the context line names the state.
- Q149 a sketch selection label reads like `pages/system · desktop (context)`, no repeats.
- Q150 opening the chat keeps Tom's zoom; Studio re-fits only when the view was fitted before.
  As built Q145-Q150 (builder 57, 2026-10-31):
  - Q145/Q146 `e902ae12a`: `STUDIO_BRIEF` in `agent_claude.rs` goes in through `--append-system-prompt` on runs
    without a tool server (the chat). Call runs get none. It names `npx et design check`, `npx et design shot
<layer>/<name> --states`, no changeset under `.ethlete/`, and the `foundations/type` tokens (`text-ui-sm`,
    `font-ui-medium`, `font-ui-strong`). Verified: cargo tests (one fails without the change), clippy, fmt. Not
    verified with a real chat run.
  - Q147 `06c986d1e`: `chat/chat-markdown.ts` parses paragraphs, fenced code, `-`/`1.` lists, inline code and bold
    into a typed tree; the panel renders it with control flow, no innerHTML. An unclosed fence runs to the end of
    the message. No nested lists, links, tables or images.
  - Q148/Q149 `2ac793020`: `DesignCanvasComponent.selectedCellId` (a click on a `[data-cell-id]` cell; resets with
    the frame selection); `ViewContext.state` reads `filled · hover` (no `rest`). A second click keeps the cell;
    grid padding clears the state. A sketch matrix frame reads `<part> · <size> (<state or context>)`; other
    frames drop a name another name contains.
  - Q150 `96ec2fe9f`: no code change. The canvas already re-fits on a width change only while it follows a fit
    (`following`); a manual zoom sets it to null. Specs lock this in. The dogfood re-fit came from a view that was
    still in its first fit. `focusFrame` keeps following its frame.
    Verified: 448 app tests, app and spec tsc, lint on the changed files; each new spec fails without its change.
    Not verified in Tom's Studio.
    As built (`f3727c4c8`): `libs/cli/src/lib/design/shot-store.ts`. An entry is keyed by the cli build stamp plus
    the memory cache key, and holds the picture, a scope string (drawn parts, fixtures, a listing of the shared
    directories) and the sha1 of every input file from the module graph (part, imports, product stylesheets, package
    files, tokens, config). A lookup rehashes the inputs; any change, a missing file or a corrupt entry is a miss.
    Entries live in `node_modules/.design-explore/shots-<checkout hash>/`, only for the shared listening server, and
    past 512 MB the oldest go. Verified: specs for a restart that keeps the shot (failed before the fix) and for a part,
    package, stylesheet or new shared file that redraws it; tsc, lint; a live check on own ports, 348 ms first draw,
    32 ms from disk. Not verified in Tom's Studio. Earlier fix `42392387e`: a rebuild that writes a package file back
    with the same bytes redraws nothing.

#### Build slices (builder ethlete-sdk-57)

1. Q129, built (`d3003cfc3`): a collapsible chat panel on the right of the app shell. Its state lives in a root store, so it
   survives navigation. Follow-up messages resume the same agent session. The `/agent` page and its call inputs
   go away; the Rust call tools stay as they are, and the chat sends `tools: null`.
2. Q127, built (`9d6a2789d`): a root view-context store that the system and sketch views write (product, part, sketch, variant,
   selection). A chip above the input shows it; one click removes it for the next message.
3. Q128, after the MVP (Studio MVP scope, 2026-10-31), not built now: during a run, Studio compares the frame revisions to find the part or sketch the run changed. If the view
   is still the one the message was sent from, Studio opens the result; otherwise the reply shows a link.
4. Q130: a "New chat" button that clears the messages and the session. No list of old chats (grill, 2026-10-31).

As built, slice 2 (`9d6a2789d`): `injectViewContext()` in `apps/ethlete-studio/src/app/chat/view-context.ts`. The
system view writes product, part and the clicked frame (`DesignCanvasComponent.selectedId`); the sketch view writes
sketch, sketch dir and the picked variant, and wins. A legacy call view writes nothing. `send` puts one line
`Studio view: product …, part …, sketch … (dir …), variant …, selected frame ….` in front of the prompt; the chat
shows the chip text muted above the user's own text. A removed chip stays away until the view changes or a message
goes. Gaps: no part source path (`ListedPart` has none); the variant is the picked one, not the one looked at.
Verified: 425 app tests, tsc, lint; the specs fail without the behaviour; a headless check with a faked design
server showed the chip, the remove, and the preamble. Not verified with a real design server.

5. Q127 gaps, built (`4d8f359ea`, `24fa2c9cc`): `ListedPart.file` (relative to the workspace, from
   `listSystem`) goes into the line as `part … (file …)`; a sketch names its target part's file. The variant is the
   selected frame's variant, else the one with the most visible frame area (`areasInView` in `canvas-math.ts`, the
   canvas signal `frameAreasInView` at rest), else the only one; the pick shows as `picked a` when it differs.
   Verified: app tests, 887 cli design tests, tsc, lint; specs fail without the change. Not verified in a running
   Studio; the in-view rule only by the pure spec.
6. Dogfood, done (2026-10-31): a headless Studio on own ports, with real `claude` sonnet runs bridged into the
   stub. The agent found the part file from the context line alone. The frame redrew about 0.4 s after the edit.
   Follow-ups resumed the session. A sketch from the chat appeared in about 3 s. Fixed: `edf553ea7` (the finished
   line repeated the last message) and `8b35a636f` (sketch check, new and ready wrote the four design tsconfigs
   again with the same bytes, so Vite reloaded every frame). Open design questions went to the grill: a Studio brief
   with `--append-system-prompt` (design check, no changeset, type tokens), markdown in messages, a grid-cell state
   as the selection, a shorter sketch selection label, and the canvas zoom when the chat opens. Not exercised: the
   real Rust `agent_run`, Stop, Codex, chip removal, the disk cache across a restart.

As built, slice 1 (`d3003cfc3`): `injectChatStore()` in `apps/ethlete-studio/src/app/chat/chat-store.ts` (root
provider) holds the CLI, the model, the entries, the session and the open flag. `ChatPanelComponent` sits beside
the router outlet in `app.component.ts`, 420px wide when open. A follow-up message resumes the session; a CLI change
clears it. The open flag is stored as `chatOpen` in the remembered view; the panel starts closed. The "New chat"
button of slice 4 is in too. Verified: 419 app tests, spec and app typecheck, build, lint on the changed files;
the resume spec and the panel specs fail without the behaviour. Not verified yet: the panel by eye (a headless
check runs).

### Open point: elevation on dark surfaces (Tom feedback, 2026-10-30, design round decided in Q95)

Seen on sdk `foundations/colors`, "Surface, dark": the `Resting` and `Raised` shadow samples are almost
invisible; on "Surface, light" the shadows work. On dark UIs an elevated element usually also gets a lighter
background, but a raised background breaks the surface system (one background per surface theme). Needs its own
design round: how elevation reads on a dark surface within the surface theming. Doc only for now, nothing to
build.

## Zoom chip tier (Tom, 2026-10-30, Q45)

The zoom chip is `components/zoom-chip`, not `elements/zoom-chip`: an element may not import another element
(`UPWARD-DEPENDENCY`). Before Tom merges r1 (3d00519df): its `−`, `+` and `Fit` buttons are declared controls with
hover, active and focus, and `design complete components/zoom-chip` passes. The zoom values (100 %, 250 %, 25 %)
are content states, not the interaction coverage Q43 asked for.

- **r2 ready (2026-10-30, 1534846c9):** variant b declares −, percent, + and Fit as button controls in 16 states;
  `design complete` passed in a scratch copy with b merged. Not checked by eye. Waits for Tom's merge in Studio.
